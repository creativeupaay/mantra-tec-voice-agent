"""Zoho CRM tools — get CRM information and create leads."""

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from services.crm import crm_service

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
        "Register a new lead in Zoho CRM for a caller who is not yet in the system. "
        "Use this when a new caller expresses interest in Mantra Tech's products or services."
    ),
    properties={
        "name": {
            "type": "string",
            "description": "Full name of the caller.",
        },
        "company": {
            "type": "string",
            "description": "Company or business name (if the caller mentions it).",
        },
        "notes": {
            "type": "string",
            "description": "Summary of the caller's requirements or reason for calling.",
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
    name: str = params.arguments.get("name", "Unknown")
    company: str = params.arguments.get("company", "")
    notes: str = params.arguments.get("notes", "")

    phone = state.phone_number if state else "unknown"

    name_parts = name.strip().split()
    lead_data: dict = {
        "Last_Name": name_parts[-1] if name_parts else "Unknown",
        "First_Name": " ".join(name_parts[:-1]) if len(name_parts) > 1 else "",
        "Phone": phone,
        "Lead_Source": "Voice Agent",
        "Description": notes,
    }
    if company:
        lead_data["Company"] = company

    try:
        result = await crm_service.create_lead(lead_data)
        lead_id = result.get("id", "unknown")
        if state:
            state.crm_lead = lead_data  # optimistic state update
        await params.result_callback(
            f"Lead created in Zoho CRM (ID: {lead_id}). "
            "Our sales team will follow up with you soon."
        )
    except Exception as e:
        await params.result_callback(f"Could not create lead at this time: {e}")
