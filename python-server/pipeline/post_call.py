"""Post-call pipeline for LLM extraction and long-term memory updates."""

import asyncio
from typing import List, Optional

import instructor
from loguru import logger
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from agent.state import CallState
from env_config import settings
from modules.calls.service import call_service
from modules.identity.service import identity_service
from services.crm import crm_service
from services.desk import desk_service


class PostCallExtraction(BaseModel):
    """Structured output from the LLM after analyzing the call transcript."""
    summary: str = Field(
        ..., description="A detailed summary of the conversation and decisions made."
    )
    intent: str = Field(
        ..., description="The primary reason for the call (e.g., Support, Sales, Booking, Inquiry)."
    )
    long_term_notes: List[str] = Field(
        ..., description="Bullet points of key facts to remember for future calls (e.g., user preferences, recurring issues). Do not include transient details."
    )
    requires_ticket: bool = Field(
        ..., description="True if a support ticket needs to be created but wasn't created during the call."
    )
    requires_lead: bool = Field(
        ..., description="True if the caller is a prospective lead but wasn't created as a lead during the call."
    )
    caller_name: Optional[str] = Field(
        None, description="The name of the caller if they introduced themselves or shared their name during the call (e.g. 'Manish')."
    )


async def run_post_call_pipeline(state: CallState, duration_seconds: int = 0) -> None:
    """Run the post-call analytics and update long-term storage asynchronously."""
    if not state.transcript_lines:
        logger.info(f"[post-call] No transcript for call {state.call_id}, skipping.")
        return

    logger.info(f"[post-call] Starting post-call pipeline for {state.call_id}")
    transcript_text = "\n".join(state.transcript_lines)

    # ── 1. LLM Extraction using Instructor ─────────────────────────────────────
    try:
        # We use OpenRouter with the OpenAI client + Instructor
        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
        # Apply instructor patch
        instructor_client = instructor.from_openai(client)

        extraction: PostCallExtraction = await instructor_client.chat.completions.create(
            model=settings.openrouter_model,
            response_model=PostCallExtraction,
            max_retries=2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a post-call analyst for Mantra Tech. Analyze the following transcript "
                        "and extract a detailed summary, the primary intent, and any long-term notes to remember. "
                        "Determine if a support ticket or sales lead still needs to be created."
                    )
                },
                {
                    "role": "user",
                    "content": f"Transcript:\n\n{transcript_text}"
                }
            ],
        )
    except Exception as e:
        logger.error(f"[post-call] LLM extraction failed: {e}")
        # Graceful fallback if LLM fails
        extraction = PostCallExtraction(
            summary="Post-call LLM extraction failed.",
            intent="Unknown",
            long_term_notes=[],
            requires_ticket=False,
            requires_lead=False,
        )

    logger.info(f"[post-call] Extracted intent: {extraction.intent}")

    # ── 2. Update Call History ────────────────────────────────────────────────
    try:
        await call_service.finalize_call(
            call_id=state.call_id,
            duration=duration_seconds,
            transcript=transcript_text,
            summary=extraction.summary,
            intent=extraction.intent,
        )
        logger.info(f"[post-call] Finalized call record for {state.call_id}")
    except Exception as e:
        logger.error(f"[post-call] Failed to finalize call {state.call_id}: {e}")

    # ── 3. Update Caller Identity ─────────────────────────────────────────────
    try:
        # Determine caller name to save (fallback to existing name if not extracted)
        caller_name = extraction.caller_name
        if not caller_name and state.identity and state.identity.name:
            caller_name = state.identity.name

        agent_notes = "\n".join(extraction.long_term_notes) if extraction.long_term_notes else None
        await identity_service.update_after_call(
            phone_number=state.phone_number,
            name=caller_name,
            agent_notes=agent_notes,
            profile_summary=extraction.summary,
            language=state.preferred_language,
        )
        logger.info(f"[post-call] Updated identity last_call_at, name={caller_name}, and notes for {state.phone_number}")
    except Exception as e:
        logger.error(f"[post-call] Failed to update identity for {state.phone_number}: {e}")

    # ── 4. Update Customer Memory ─────────────────────────────────────────────
    # A. Add conversation summary to previous discussions history
    try:
        await identity_service.add_call_discussion(
            phone_number=state.phone_number,
            call_summary=extraction.summary,
        )
        logger.info(f"[post-call] Added call discussion summary to memory for {state.phone_number}")
    except Exception as e:
        logger.error(f"[post-call] Failed to append call discussion to memory: {e}")

    # B. Append long-term notes to special_notes
    if extraction.long_term_notes:
        try:
            # Fetch existing identity to append rather than overwrite
            existing_ident = await identity_service.get_by_phone(state.phone_number)
            
            notes_text = " • " + "\n • ".join(extraction.long_term_notes)
            notes_header = f"\n[Call {state.call_id} Notes]\n{notes_text}"
            
            if existing_ident and existing_ident.special_notes:
                updated_special_notes = existing_ident.special_notes + "\n" + notes_header
            else:
                updated_special_notes = notes_header
                
            from modules.identity.model import IdentityUpdate
            await identity_service.update_profile(
                phone_number=state.phone_number,
                data=IdentityUpdate(
                    special_notes=updated_special_notes,
                    preferred_language=state.preferred_language
                )
            )
            logger.info(f"[post-call] Appended long-term notes to special_notes for {state.phone_number}")
        except Exception as e:
            logger.error(f"[post-call] Failed to update special_notes in memory: {e}")

    # ── 4. Fallback Integrations (Optional) ───────────────────────────────────
    # If LLM detected a lead is required and the caller has no identity/CRM match
    if extraction.requires_lead and not state.crm_lead and not state.crm_contact:
        try:
            logger.info(f"[post-call] Auto-creating lead for {state.phone_number}")
            name = state.identity.name if state.identity and state.identity.name else "Unknown Caller"
            await crm_service.create_lead({
                "Last_Name": name,
                "Phone": state.phone_number,
                "Description": extraction.summary,
                "Lead_Source": "Voice Agent",
            })
        except Exception as e:
            logger.warning(f"[post-call] Auto-create lead failed: {e}")

    # If LLM detected a ticket is required and none was created
    if extraction.requires_ticket:
        # Note: In a robust setup, you'd check if a ticket was already created in `state`
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
