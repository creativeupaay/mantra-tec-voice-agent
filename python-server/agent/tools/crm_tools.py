"""Zoho CRM tools — get CRM information and create leads."""

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from services.crm import crm_service
from services.phonetic_utils import normalize_spoken_email, normalize_spelled_letters

# ── Schema definitions ────────────────────────────────────────────────────────

GET_CRM_SCHEMA = FunctionSchema(
    name="get_crm_information",
    description=(
        "Get the caller's current CRM status — lead details, contact information, "
        "owner, and recent CRM activity. Use this when the caller asks about their "
        "account status or relationship with Mantra Tech."
    ),
    properties={},
    required=[],
)

CREATE_LEAD_SCHEMA = FunctionSchema(
    name="create_lead_in_crm",
    description=(
        "Register a new lead in Zoho CRM for callers whose query is regarding orders that cannot be made "
        "directly on the Servico website (such as bulk orders, wholesale enquiries, RFQs, or products not on Servico). "
        "Collect and pass all available details: name, company, email, city, country, subject, and detailed description."
    ),
    properties={
        "name": {
            "type": "string",
            "description": "Full name of the caller/customer (e.g. 'Suman Lamsal').",
        },
        "company": {
            "type": "string",
            "description": "Company or organisation name (e.g. 'Soft Crunch').",
        },
        "email": {
            "type": "string",
            "description": "Email address of the customer (e.g. 'softcrunch.net@gmail.com').",
        },
        "city": {
            "type": "string",
            "description": "City of delivery or location (e.g. 'kathmandu').",
        },
        "country": {
            "type": "string",
            "description": "Country of delivery or location (e.g. 'Nepal').",
        },
        "subject": {
            "type": "string",
            "description": "Concise subject of lead (e.g. 'Bulk Order Enquiry - Mantra Biometric Devices').",
        },
        "description": {
            "type": "string",
            "description": "Detailed description of customer requirement (e.g. 'I need mantra device in a bulk in nepal. You can connect me in WhatsApp').",
        },
        "notes": {
            "type": "string",
            "description": "Additional notes or reason for calling.",
        },
        "phone_number": {
            "type": "string",
            "description": "The customer's 10-digit mobile contact number collected from the caller.",
        },
    },
    required=["name"],
)


# ── Handlers ──────────────────────────────────────────────────────────────────

async def handle_get_crm(params: FunctionCallParams) -> None:
    """Return CRM data from the call state (already fetched on connect)."""
    # Access state via app_resources (passed through PipelineWorker)
    state = params.app_resources
    if state is None:
        await params.result_callback("CRM data not available in this session.")
        return

    parts: list[str] = []

    if state.crm_lead:
        l = state.crm_lead
        owner = l.get("Owner", {})
        owner_name = owner.get("name", "N/A") if isinstance(owner, dict) else "N/A"
        parts.append(
            f"Lead: {l.get('Full_Name', 'N/A')} | Status: {l.get('Lead_Status', 'N/A')} "
            f"| Owner: {owner_name} | Source: {l.get('Lead_Source', 'N/A')}"
        )

    if state.crm_contact:
        c = state.crm_contact
        parts.append(
            f"Contact: {c.get('Full_Name', 'N/A')} | Account: {c.get('Account_Name', 'N/A')}"
        )

    if not parts:
        await params.result_callback("No CRM record found for this caller.")
        return

    await params.result_callback("\n".join(parts))


async def handle_create_lead(params: FunctionCallParams) -> None:
    state = params.app_resources
    raw_name: str = params.arguments.get("name", "Unknown Caller")
    name: str = normalize_spelled_letters(raw_name)
    raw_company: str = params.arguments.get("company", "")
    company: str = normalize_spelled_letters(raw_company)
    raw_email: str = params.arguments.get("email", "")
    email: str = normalize_spoken_email(raw_email)
    city: str = params.arguments.get("city", "")
    country: str = params.arguments.get("country", "")
    subject: str = params.arguments.get("subject", "")
    description: str = params.arguments.get("description", "") or params.arguments.get("notes", "")

    raw_phone = params.arguments.get("phone_number")
    clean_phone = "".join(filter(str.isdigit, str(raw_phone))) if raw_phone else ""
    if len(clean_phone) >= 10:
        phone = clean_phone[-10:]
        if state:
            state.phone_number = phone
            try:
                from modules.identity.service import identity_service
                await identity_service.get_or_create(phone)
            except Exception:
                pass
    else:
        phone = state.phone_number if state else "unknown"

    name_parts = name.strip().split()
    last_name = name_parts[-1] if name_parts else "Unknown"
    first_name = " ".join(name_parts[:-1]) if len(name_parts) > 1 else ""

    desc = description or f"Lead created via Voice Agent for {name}"
    if "[voice agent]" not in desc.lower():
        desc = f"{desc}\n\n[voice agent]"

    lead_data: dict = {
        "Last_Name": last_name,
        "First_Name": first_name,
        "Company": company if company else "Individual / Pending",
        "Phone": phone,
        "Mobile": phone,
        "Email": email,
        "City": city,
        "Country": country,
        "Subject": subject or f"Voice Lead - {name}",
        "Description": desc,
        "Lead_Source": "Voice Agent - Bulk Order" if "bulk" in (subject + description).lower() else "Voice Agent",
    }

    try:
        result = await crm_service.create_lead(lead_data)
        lead_id = result.get("id", "unknown")
        if state:
            state.crm_lead = lead_data  # optimistic state update
        await params.result_callback(
            f"Lead successfully created in Zoho CRM (ID: {lead_id}). "
            "Our sales team will follow up with you soon."
        )
    except Exception as e:
        await params.result_callback(f"Could not create lead at this time: {e}")
