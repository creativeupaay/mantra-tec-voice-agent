"""Post-call pipeline for LLM extraction and long-term memory updates."""

from typing import List, Optional

from google import genai
from google.genai import types
from loguru import logger
from pydantic import BaseModel, Field

from agent.state import CallState
from env_config import settings
from modules.calls.model import CallCategory, CallRecording, CallStatus
from modules.calls.service import call_service
from modules.credit_usage.service import get_credit_usage_service
from modules.credit_usage.model import ServiceType
from modules.identity.service import identity_service
from services.crm import crm_service
from services.desk import desk_service
from services.phonetic_utils import normalize_spoken_email


def _resolve_call_status(
    *,
    has_transcript: bool,
    duration_seconds: int,
    is_red_flagged: bool,
    requires_ticket: bool,
    callback_required: bool = False,
    is_support_escalation: bool = False,
    support_number_given: bool = False,
) -> CallStatus:
    """Derive a CallsPage status from post-call signals.
    
    Rules:
    - If support helpline was reported not picking up and callback was arranged -> ESCALATED.
    - If agent gave / dictated the support helpline number -> RESOLVED (do NOT escalate!).
    - If other callback required (delivery, subscription renewal) -> CALLBACK_REQUIRED.
    - If red flagged -> ESCALATED.
    - If duration < 5s or no transcript -> MISSED.
    - If requires_ticket (and not support number given) -> ESCALATED.
    - Otherwise -> RESOLVED.
    """
    if not has_transcript or duration_seconds < 5:
        return CallStatus.MISSED
    if is_support_escalation or is_red_flagged:
        return CallStatus.ESCALATED
    if support_number_given:
        # Giving the support number resolves the call — never escalate!
        return CallStatus.RESOLVED
    if callback_required:
        return CallStatus.CALLBACK_REQUIRED
    if requires_ticket:
        return CallStatus.ESCALATED
    return CallStatus.RESOLVED


def _resolve_call_outcome(
    *,
    requires_ticket: bool,
    requires_lead: bool,
    has_transcript: bool,
    callback_required: bool = False,
    is_support_escalation: bool = False,
    support_number_given: bool = False,
) -> Optional[str]:
    if is_support_escalation or callback_required:
        return "callback_needed"
    if support_number_given:
        return "completed"
    if requires_ticket:
        return "ticket_needed"
    if requires_lead:
        return "lead_needed"
    if has_transcript:
        return "completed"
    return "no_transcript"


class PostCallExtraction(BaseModel):
    """Structured output from the LLM after analyzing the call transcript."""
    
    summary: str = Field(
        ..., description="A detailed summary of the conversation and decisions made."
    )
    intent: str = Field(
        ..., description="The primary reason for the call (e.g., Support, Sales, Booking, Inquiry)."
    )
    call_category: CallCategory = Field(
        default=CallCategory.INQUIRY, description="Categorization of the call."
    )
    long_term_notes: List[str] = Field(
        ..., description="Bullet points of key facts to remember for future calls (e.g., user preferences, recurring issues). Do not include transient details."
    )
    requires_ticket: bool = Field(
        default=False,
        description=(
            "True ONLY if a human support ticket explicitly needs to be created. "
            "CRITICAL: If the agent provided the support helpline number (079-69268-000) or directed the customer "
            "to call support, DO NOT set requires_ticket to True! Providing the support number resolves the call "
            "and does NOT require a ticket. Also, if a callback was arranged, set callback_required instead."
        ),
    )
    requires_lead: bool = Field(
        default=False,
        description="True if the caller is a prospective lead (especially bulk orders, wholesale, RFQs, or products not on Servico website) but wasn't created as a lead during the call."
    )
    caller_name: Optional[str] = Field(
        None, description="The name of the caller if mentioned (e.g. 'Suman Lamsal')."
    )
    company: Optional[str] = Field(
        None, description="Company or organisation name mentioned by caller (e.g. 'Soft Crunch')."
    )
    email: Optional[str] = Field(
        None, description="Email address mentioned by caller (e.g. 'softcrunch.net@gmail.com')."
    )
    city: Optional[str] = Field(
        None, description="City mentioned for delivery or location (e.g. 'kathmandu')."
    )
    country: Optional[str] = Field(
        None, description="Country mentioned for delivery or location (e.g. 'Nepal')."
    )
    subject: Optional[str] = Field(
        None, description="Concise subject of enquiry (e.g. 'Bulk Order Enquiry - Mantra Biometric Devices')."
    )
    product_requested: Optional[str] = Field(
        None, description="Product(s) requested by customer."
    )
    quantity: Optional[str] = Field(
        None, description="Quantity requested by customer."
    )
    requirement_description: Optional[str] = Field(
        None, description="Detailed requirement description (e.g. 'I need mantra device in a bulk in nepal. You can connect me in WhatsApp')."
    )
    is_red_flagged: bool = Field(
        default=False, description="True if the call contains sensitive content, disallowed topics, or the agent lacked knowledge."
    )
    red_flag_reason: Optional[str] = Field(
        None, description="Reason for red flag: e.g., 'Sensitive PII detected', 'Agent knowledge gap', 'Off-topic content.'"
    )
    
    # Guardrail detection
    guardrail_triggered: Optional[str] = Field(
        None, description="The guardrail trigger that was detected in the conversation, if any."
    )
    detected_language: Optional[str] = Field(
        None, description="Primary language spoken by the customer: 'en' for English, 'hi' for Hindi, or 'hinglish' for Hinglish."
    )
    support_number_given: bool = Field(
        default=False,
        description=(
            "True if the agent provided, dictated, or guided the caller to the support helpline number "
            "(079-69268-000 / ending in triple zero). In this case the call is NOT an escalation."
        ),
    )
    support_unresponsive_callback: bool = Field(
        default=False,
        description=(
            "True if the caller reported that the support helpline was not picking up / not answering / unresponsive / busy, "
            "AND the agent arranged a callback for them from support. This IS an escalation."
        ),
    )
    callback_required: bool = Field(
        default=False,
        description=(
            "True if a callback is required or was promised to the customer. "
            "Set to True if the customer had an order or delivery issue and a callback was arranged, "
            "or if the customer needed device subscription / RD service / recharge / renewal and a callback was arranged, "
            "or if the customer reported support wasn't picking up and a callback was arranged."
        ),
    )
    contact_phone_number: Optional[str] = Field(
        None,
        description="The customer's 10-digit mobile or contact phone number if mentioned by the caller or collected during the conversation (e.g. '9876543210'). Only digits.",
    )


async def run_post_call_pipeline(
    state: CallState, 
    duration_seconds: int = 0,
    recording_content: Optional[bytes] = None,
    recording_content_type: str = "audio/wav",
) -> None:
    """Run the post-call analytics and update long-term storage asynchronously."""
    has_transcript = bool(state.transcript_lines)
    if not has_transcript and not recording_content:
        logger.info(f"[post-call] No transcript or recording for call {state.call_id}. Finalizing as missed call.")
        try:
            call_status = CallStatus.MISSED if duration_seconds < 5 else CallStatus.RESOLVED
            await call_service.finalize_call(
                call_id=state.call_id,
                duration=max(0, int(duration_seconds or 0)),
                transcript=None,
                summary="Call ended without audio or transcript recorded.",
                intent="None",
                call_category=CallCategory.INQUIRY,
                outcome="no_transcript",
                status=call_status,
                caller_name=state.identity.name if (state.identity and state.identity.name) else None,
                is_red_flagged=False,
                red_flag_reason=None,
                guardrail_triggered=None,
            )
            logger.info(f"[post-call] Finalized zero-data call {state.call_id} as status={call_status.value}")
        except Exception as e:
            logger.error(f"[post-call] Failed to finalize zero-data call {state.call_id}: {e}")
        return

    logger.info(f"[post-call] Starting post-call pipeline for {state.call_id}")
    transcript_text = "\n".join(state.transcript_lines) if has_transcript else ""

    # ── 1. LLM Extraction using Gemini ─────────────────────────────────────
    gemini_prompt_tokens = 0
    gemini_completion_tokens = 0
    gemini_raw_response = None
    is_bulk = False

    if has_transcript:
        try:
            client = genai.Client(api_key=settings.gemini_api_key)

            gemini_raw_response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=[
                    types.Part.from_text(text=f"Transcript:\n\n{transcript_text}")
                ],
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are a post-call analyst for Mantra Tech. Analyze the following transcript "
                        "and extract a detailed summary, the primary intent, and categorize the call.\n\n"
                        "CRITICAL RULES FOR SUPPORT CALLS & ESCALATION:\n"
                        "1. GIVING SUPPORT NUMBER IS NOT AN ESCALATION:\n"
                        "   - If the agent provided, dictated, or guided the caller to the support helpline number "
                        "     (079-69268-000 / ending in triple zero), set support_number_given = true. "
                        "   - DO NOT set requires_ticket to true! Giving the caller the support helpline number is "
                        "     standard resolved routing, NOT an escalation and NOT a ticket.\n"
                        "2. SUPPORT UNRESPONSIVE & CALLBACK ARRANGED (ONLY SUPPORT ESCALATION):\n"
                        "   - If the caller reported that they tried calling the support helpline but support is NOT picking up / "
                        "     not answering / unresponsive / line busy, AND the agent arranged a callback for them, "
                        "     set support_unresponsive_callback = true and callback_required = true. "
                        "   - This specific case IS an escalation because support was unreachable and a callback was promised.\n"
                        "3. OTHER CALLBACKS (Delivery issues, Device subscription / renewal):\n"
                        "   - If a callback was arranged for an order/delivery issue or device subscription/renewal, "
                        "     set callback_required = true (support_unresponsive_callback remains false).\n\n"
                        "Extract the customer's 10-digit mobile contact number mentioned or provided by the caller into contact_phone_number. DO NOT use forwarding trunk numbers (such as 07969268119, 07948501661).\n"
                        "Flag if the agent lacked knowledge or detected sensitive/disallowed content.\n\n"
                        "CRITICAL RULE FOR AI CALL SUMMARY:\n"
                        "If the conversation is identified as a Bulk Order, Wholesale Enquiry, Enterprise Purchase, "
                        "Government Purchase, Institutional Purchase, or RFQ (Request for Quotation):\n"
                        "The summary MUST start with the clear heading 'BULK' (on its own line before the summary text).\n"
                        "Example:\n"
                        "BULK\n\n"
                        "Customer from ABC Technologies requested a quotation for 250 biometric attendance devices. "
                        "The agent collected the organisation name, email, location, required quantity and guided the customer to contact the Sales Team at sales@mantratec.com.\n\n"
                        "For all normal customer conversations, generate the summary WITHOUT adding the BULK heading."
                    ),
                    response_mime_type="application/json",
                    response_schema=PostCallExtraction,
                )
            )
            
            # Parse the JSON response into PostCallExtraction
            import json
            extraction = PostCallExtraction(**json.loads(gemini_raw_response.text or "{}"))

            # Enforce Rule 4 for AI Call Summary (BULK heading)
            raw_summary = (extraction.summary or "").strip()
            lower_summary = raw_summary.lower()
            lower_intent = (extraction.intent or "").lower()

            # Inspect only user lines so agent's template phrases aren't false positives
            user_transcript_lines = [line.lower() for line in state.transcript_lines if line.lower().startswith("user:")]
            user_transcript_text = " ".join(user_transcript_lines)

            is_bulk = False
            bulk_terms = [
                "bulk", "wholesale", "enterprise quantity", "enterprise purchase", "enterprise",
                "government quantity", "government purchase", "government",
                "institutional quantity", "institutional purchase", "institutional",
                "rfq", "request for quotation", "quotation"
            ]
            if any(term in lower_intent for term in bulk_terms) or any(term in lower_summary for term in bulk_terms) or raw_summary.startswith("BULK"):
                is_bulk = True
            elif any(term in user_transcript_text for term in bulk_terms):
                is_bulk = True

            if is_bulk:
                if not raw_summary.startswith("BULK"):
                    if raw_summary.lower().startswith("bulk"):
                        raw_summary = raw_summary[4:].lstrip(":\n\r\t ")
                    extraction.summary = f"BULK\n\n{raw_summary}"

            from modules.credit_usage.pricing import extract_gemini_usage, estimate_tokens_from_text
            gemini_prompt_tokens, gemini_completion_tokens, _ = extract_gemini_usage(
                gemini_raw_response
            )
            if gemini_prompt_tokens == 0 and gemini_completion_tokens == 0:
                gemini_prompt_tokens = estimate_tokens_from_text(transcript_text, overhead=250)
                gemini_completion_tokens = estimate_tokens_from_text(
                    gemini_raw_response.text or "", overhead=50
                )
        except Exception as e:
            logger.error(f"[post-call] LLM extraction failed: {e}")
            # Graceful fallback if LLM fails
            extraction = PostCallExtraction(
                summary="Post-call LLM extraction failed.",
                intent="Unknown",
                call_category=CallCategory.INQUIRY,
                long_term_notes=[],
                requires_ticket=False,
                requires_lead=False,
                callback_required=False,
                is_red_flagged=False,
            )
    else:
        extraction = PostCallExtraction(
            summary="No transcript available for this call.",
            intent="Unknown",
            call_category=CallCategory.INQUIRY,
            long_term_notes=[],
            requires_ticket=False,
            requires_lead=False,
            callback_required=False,
            is_red_flagged=False,
        )

    logger.info(f"[post-call] Extracted intent: {extraction.intent}")

    # ── 2. Update Call History & Recording ───────────────────────────────────────
    # A. Upload recording if available
    recording_url = None
    if recording_content:
        try:
            recording = CallRecording(
                call_id=state.call_id,
                file_content=recording_content,
                content_type=recording_content_type,
                metadata={"phone_number": state.phone_number}
            )
            updated_call = await call_service.upload_recording(recording)
            recording_url = updated_call.recording_url if updated_call else None
            logger.info(
                f"[post-call] Uploaded recording for {state.call_id} "
                f"({len(recording_content)} bytes, url={recording_url})"
            )
        except Exception as e:
            logger.error(f"[post-call] Failed to upload recording for {state.call_id}: {e}")
    
    # B. Finalize call record (status + all analytics fields the Calls UI reads)
    caller_name = extraction.caller_name
    if not caller_name and state.identity and state.identity.name:
        caller_name = state.identity.name

    callback_needed = bool(extraction.callback_required)
    lower_summary = (extraction.summary or "").lower()
    full_transcript_lower = transcript_text.lower() if has_transcript else ""

    if not callback_needed and has_transcript:
        cb_terms = [
            "call back arrange",
            "callback arrange",
            "arrange a call back",
            "arrange a callback",
            "call back karwati",
            "callback karwati",
            "call back karwa",
            "directly support se call back",
            "support team se call back",
            "support se call back",
            "callback karwa",
        ]
        if any(term in full_transcript_lower or term in lower_summary for term in cb_terms):
            callback_needed = True
            extraction.callback_required = True

    # 1. Did the caller report support wasn't answering / picking up?
    support_unresponsive_terms = [
        "call nahi utha rahe", "call nahi utha raha", "phone nahi utha rahe", "phone nahi utha raha",
        "pick nahi kar rahe", "pick nahi ho raha", "not picking", "not answering", "not responding",
        "no response", "reply nahi aa raha", "lines not connecting", "unable to reach support",
        "support team was not answering", "support was not answering", "support is not responding",
        "support not answering", "support not responding", "tried calling support",
        "support pe call kiya tha", "support par call kiya tha", "support ko call lagaya",
        "support number par call", "helpdesk not responding",
    ]
    is_support_unresponsive = (
        bool(getattr(extraction, "support_unresponsive_callback", False))
        or any(term in full_transcript_lower or term in lower_summary for term in support_unresponsive_terms)
    )

    # 2. Was a callback arranged specifically because support was unresponsive?
    is_support_escalation = bool(getattr(extraction, "support_unresponsive_callback", False)) or (
        is_support_unresponsive and callback_needed
    )

    # 3. Did the agent provide the support helpline number?
    support_number_terms = [
        "07969268000", "079-69268-000", "079 692", "triple zero", "triple 0", "last me triple zero",
        "last mein triple zero", "support number", "support helpline", "support me call", "support mein call",
        "support team ko call", "dedicated support team", "support contact number", "support phone number",
    ]
    gave_support_number = (
        bool(getattr(extraction, "support_number_given", False))
        or (
            any(term in full_transcript_lower or term in lower_summary for term in support_number_terms)
            and not is_support_escalation
        )
    )

    # CRITICAL USER RULE: For calls where the agent is giving the support number, DO NOT escalate!
    # Only escalate if support was not picking up and the agent arranged a callback.
    if gave_support_number and not is_support_escalation:
        extraction.requires_ticket = False

    call_status = _resolve_call_status(
        has_transcript=has_transcript,
        duration_seconds=duration_seconds,
        is_red_flagged=bool(extraction.is_red_flagged),
        requires_ticket=bool(extraction.requires_ticket),
        callback_required=callback_needed,
        is_support_escalation=is_support_escalation,
        support_number_given=gave_support_number,
    )
    call_outcome = _resolve_call_outcome(
        requires_ticket=bool(extraction.requires_ticket),
        requires_lead=bool(extraction.requires_lead),
        has_transcript=has_transcript,
        callback_required=callback_needed,
        is_support_escalation=is_support_escalation,
        support_number_given=gave_support_number,
    )

    # ── Resolve effective customer phone number ──────────────────────────────
    SHARED_FORWARDING_NUMBERS = {"07969268119", "07948501661", "+917969268119", "+917948501661"}
    final_phone = state.phone_number

    extracted_contact = getattr(extraction, "contact_phone_number", None)
    clean_extracted = "".join(filter(str.isdigit, str(extracted_contact))) if extracted_contact else ""
    clean_state = "".join(filter(str.isdigit, str(state.phone_number))) if state.phone_number else ""

    is_exotel_or_trunk = (
        getattr(state, "telephony_provider", "") == "exotel"
        or clean_state[-10:] in {"07969268119", "07948501661"}
    )

    if len(clean_extracted) >= 10 and clean_extracted[-10:] not in {"07969268119", "07948501661"}:
        final_phone = clean_extracted[-10:]
    elif is_exotel_or_trunk:
        # Caller connected via Exotel or forwarded trunk and did not state their own number.
        # DO NOT consider or save the Exotel trunk number as the customer's phone number!
        final_phone = "unknown"
    elif len(clean_state) >= 10 and clean_state[-10:] not in {"07969268119", "07948501661"}:
        final_phone = clean_state[-10:]
    else:
        final_phone = "unknown"

    try:
        await call_service.finalize_call(
            call_id=state.call_id,
            duration=max(0, int(duration_seconds or 0)),
            transcript=transcript_text or None,
            summary=extraction.summary,
            intent=extraction.intent,
            call_category=extraction.call_category,
            outcome=call_outcome,
            status=call_status,
            caller_name=caller_name,
            phone_number=final_phone,
            is_red_flagged=bool(extraction.is_red_flagged),
            red_flag_reason=extraction.red_flag_reason,
            guardrail_triggered=extraction.guardrail_triggered,
        )
        logger.info(
            f"[post-call] Finalized call {state.call_id} "
            f"(status={call_status.value}, duration={duration_seconds}s, outcome={call_outcome}, phone={final_phone})"
        )

        if call_status == CallStatus.ESCALATED:
            try:
                from services.email.notifier import send_escalation_email
                phone_display = final_phone if final_phone not in (SHARED_FORWARDING_NUMBERS | {"unknown", ""}) else "Not provided by caller (Exotel trunk call)"
                category_display = extraction.call_category.value if hasattr(extraction.call_category, 'value') else str(extraction.call_category)
                if is_support_escalation:
                    category_display = f"{category_display} - Helpline Unresponsive (Callback Arranged)"
                await send_escalation_email(
                    call_id=state.call_id,
                    caller_name=caller_name,
                    phone_number=phone_display,
                    call_category=category_display,
                    call_summary=extraction.summary,
                    transcript=transcript_text or None,
                )
                logger.info(f"[post-call] Triggered escalation email notification for call {state.call_id}")
            except Exception as e:
                logger.error(f"[post-call] Failed to trigger escalation email notification: {e}")
    except Exception as e:
        logger.error(f"[post-call] Failed to finalize call {state.call_id}: {e}")

    # ── 3. Update Caller Identity ─────────────────────────────────────────────
    # Only update individual identity if we have a real customer number (not the shared trunk or unknown)
    if has_transcript and final_phone not in (SHARED_FORWARDING_NUMBERS | {"unknown", ""}):
        try:
            if extraction.detected_language and extraction.detected_language.lower() in ("en", "hi", "hinglish"):
                state.preferred_language = extraction.detected_language.lower()
            agent_notes = "\n".join(extraction.long_term_notes) if extraction.long_term_notes else None
            await identity_service.update_after_call(
                phone_number=final_phone,
                name=caller_name,
                agent_notes=agent_notes,
                profile_summary=extraction.summary,
                language=state.preferred_language,
            )
            logger.info(f"[post-call] Updated identity last_call_at, name={caller_name}, and notes for {final_phone}")
        except Exception as e:
            logger.error(f"[post-call] Failed to update identity for {final_phone}: {e}")

        # ── 4. Update Customer Memory ─────────────────────────────────────────────
        # A. Add conversation summary to previous discussions history
        try:
            await identity_service.add_call_discussion(
                phone_number=final_phone,
                call_summary=extraction.summary,
            )
            logger.info(f"[post-call] Added call discussion summary to memory for {final_phone}")
        except Exception as e:
            logger.error(f"[post-call] Failed to append call discussion to memory: {e}")

        # B. Append long-term notes to special_notes
        if extraction.long_term_notes:
            try:
                # Fetch existing identity to append rather than overwrite
                existing_ident = await identity_service.get_by_phone(final_phone)
                
                notes_text = " • " + "\n • ".join(extraction.long_term_notes)
                notes_header = f"\n[Call {state.call_id} Notes]\n{notes_text}"
                
                if existing_ident and existing_ident.special_notes:
                    updated_special_notes = existing_ident.special_notes + "\n" + notes_header
                else:
                    updated_special_notes = notes_header
                    
                from modules.identity.model import IdentityUpdate
                await identity_service.update_profile(
                    phone_number=final_phone,
                    data=IdentityUpdate(
                        special_notes=updated_special_notes,
                        preferred_language=state.preferred_language
                    )
                )
                logger.info(f"[post-call] Appended long-term notes to special_notes for {final_phone}")
            except Exception as e:
                logger.error(f"[post-call] Failed to update special_notes in memory: {e}")

        # ── 5. Fallback Integrations (Optional) ───────────────────────────────────
        # If LLM detected a lead is required or call is a Bulk Order and the caller has no identity/CRM match
        if (extraction.requires_lead or is_bulk) and not state.crm_lead and not state.crm_contact:
            try:
                logger.info(f"[post-call] Auto-creating Zoho CRM lead for {final_phone}")
                name = caller_name or extraction.caller_name or (state.identity.name if state.identity and state.identity.name else "Unknown Caller")
                name_parts = name.strip().split()
                last_name = name_parts[-1] if name_parts else "Unknown"
                first_name = " ".join(name_parts[:-1]) if len(name_parts) > 1 else ""

                desc = extraction.requirement_description or extraction.summary
                if extraction.product_requested and "product" not in desc.lower():
                    desc = f"Product Requested: {extraction.product_requested}\nQuantity: {extraction.quantity or 'N/A'}\n\n{desc}"
                if "[voice agent]" not in desc.lower():
                    desc = f"{desc}\n\n[voice agent]"

                lead_phone = final_phone if final_phone not in (SHARED_FORWARDING_NUMBERS | {"unknown", ""}) else ""
                lead_payload = {
                    "Last_Name": last_name,
                    "First_Name": first_name,
                    "Company": extraction.company or "Individual / Pending",
                    "Phone": lead_phone,
                    "Mobile": lead_phone,
                    "Email": normalize_spoken_email(extraction.email) or "",
                    "City": extraction.city or "",
                    "Country": extraction.country or "",
                    "Subject": extraction.subject or (f"Bulk Order Enquiry - {extraction.product_requested or 'Mantra Devices'}" if is_bulk else f"Voice Lead - {name}"),
                    "Description": desc,
                    "Lead_Source": "Voice Agent - Bulk Order" if is_bulk else "Voice Agent",
                }
                res = await crm_service.create_lead(lead_payload)
                logger.info(f"[post-call] Successfully created Zoho CRM lead: {res}")
            except Exception as e:
                logger.warning(f"[post-call] Auto-create lead failed: {e}")

        # If LLM detected a ticket is required and none was created
        if extraction.requires_ticket:
            try:
                logger.info(f"[post-call] Auto-creating ticket for {state.phone_number}")
                contact_id = state.crm_contact.get("id") if state.crm_contact else None
                
                # Simple subject derived from summary (up to 50 chars)
                subject = (extraction.summary[:47] + "...") if len(extraction.summary) > 50 else extraction.summary
                
                await desk_service.create_ticket({
                    "subject": f"[Auto] {subject}",
                    "departmentId": settings.zoho_desk_department_id,
                    "contactId": contact_id,
                    "description": f"Transcript summary:\n{extraction.summary}",
                    "phone": state.phone_number,
                    "channel": "Phone",
                })
            except Exception as e:
                logger.warning(f"[post-call] Auto-create ticket failed: {e}")

    logger.info(f"[post-call] Pipeline completed for {state.call_id}")

    # ── 6. Credit Usage Tracking (API-specific estimated USD) ─────────────────
    # Live LLM/TTS usage is recorded by CreditTracker during the call.
    # Here we record remaining APIs: Plivo telephony, Deepgram STT (classic),
    # Gemini post-call analysis, and a Gemini Live duration fallback if needed.
    try:
        db_call_id = getattr(state, "db_call_id", None)
        if not db_call_id:
            call = await call_service.get_call(state.call_id)
            db_call_id = call.id if call else None
            if db_call_id:
                state.db_call_id = db_call_id

        if not db_call_id:
            logger.warning(
                f"[post-call] Skipping credit usage — no Mongo Call _id for {state.call_id}"
            )
        else:
            from modules.identity.model import PyObjectId
            from modules.credit_usage.pricing import (
                estimate_llm_cost,
                estimate_plivo_cost,
                estimate_stt_cost,
                estimate_gemini_live_audio_cost,
            )

            oid = PyObjectId(db_call_id)
            credit_svc = get_credit_usage_service()
            gemini_mode = settings.voice_mode == "gemini_realtime"

            # A. Plivo telephony (connected minutes)
            if duration_seconds > 0:
                plivo = estimate_plivo_cost(duration_seconds)
                if plivo.estimated_usd > 0:
                    await credit_svc.record_usage(
                        call_id=oid,
                        amount=plivo.estimated_usd,
                        description=(
                            f"Plivo telephony — {duration_seconds}s "
                            f"≈ ${plivo.estimated_usd:.6f}"
                        ),
                        service=ServiceType.PLIVO,
                        metadata={
                            "plivo_call_id": state.call_id,
                            "phone_number": state.phone_number,
                            "api": "telephony",
                            "calculation": plivo.calculation,
                            "rates": plivo.rates,
                            **plivo.metadata,
                        },
                    )

            # B. Deepgram STT (classic pipeline only — Gemini Live has no separate STT)
            if not gemini_mode and duration_seconds > 0 and settings.deepgram_api_key:
                stt = estimate_stt_cost(duration_seconds, service="deepgram")
                if stt.estimated_usd > 0:
                    await credit_svc.record_usage(
                        call_id=oid,
                        amount=stt.estimated_usd,
                        description=(
                            f"Deepgram STT — {duration_seconds}s "
                            f"≈ ${stt.estimated_usd:.6f}"
                        ),
                        service=ServiceType.DEEPGRAM,
                        metadata={
                            "plivo_call_id": state.call_id,
                            "api": "stt",
                            "calculation": stt.calculation,
                            "rates": stt.rates,
                            **stt.metadata,
                        },
                    )

            # C. Gemini post-call extraction (when transcript analysis ran)
            if has_transcript and (gemini_prompt_tokens or gemini_completion_tokens):
                post = estimate_llm_cost(
                    "gemini", gemini_prompt_tokens, gemini_completion_tokens
                )
                amount = post.estimated_usd if post.estimated_usd > 0 else 0.000001
                await credit_svc.record_usage(
                    call_id=oid,
                    amount=amount,
                    description=(
                        f"Gemini post-call analysis — "
                        f"{gemini_prompt_tokens + gemini_completion_tokens:,} tokens "
                        f"({gemini_prompt_tokens:,} in / {gemini_completion_tokens:,} out) "
                        f"≈ ${amount:.6f}"
                    ),
                    service=ServiceType.GEMINI,
                    metadata={
                        "plivo_call_id": state.call_id,
                        "api": "post_call_llm",
                        "model": "gemini-3.5-flash-lite",
                        "calculation": post.calculation,
                        "rates": post.rates,
                        **post.metadata,
                    },
                )

            # D. Gemini Live audio fallback — only when no live token metrics arrived
            llm_tracked = int(getattr(state, "llm_tokens_tracked", 0) or 0)
            if gemini_mode and llm_tracked == 0 and duration_seconds > 0:
                live = estimate_gemini_live_audio_cost(duration_seconds)
                if live.estimated_usd > 0:
                    await credit_svc.record_usage(
                        call_id=oid,
                        amount=live.estimated_usd,
                        description=(
                            f"Gemini Live audio — {duration_seconds}s "
                            f"≈ ${live.estimated_usd:.6f} (duration estimate)"
                        ),
                        service=ServiceType.GEMINI,
                        metadata={
                            "plivo_call_id": state.call_id,
                            "api": "gemini_live",
                            "calculation": live.calculation,
                            "rates": live.rates,
                            **live.metadata,
                        },
                    )

            logger.info(
                f"[post-call] Recorded API-specific credit usage for {state.call_id} "
                f"(duration={duration_seconds}s, gemini_mode={gemini_mode}, "
                f"llm_tokens_tracked={llm_tracked})"
            )
    except Exception as e:
        logger.error(f"[post-call] Failed to record credit usage: {e}")
