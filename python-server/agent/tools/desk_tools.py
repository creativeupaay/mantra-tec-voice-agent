"""Zoho Desk tools — create and check support tickets."""

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from services.desk import desk_service

# ── Schema definitions ────────────────────────────────────────────────────────

CREATE_TICKET_SCHEMA = FunctionSchema(
    name="create_support_ticket",
    description=(
        "Create a new support ticket in Zoho Desk for a technical issue or support request. "
        "Use this when the caller reports a problem, bug, or service issue that needs follow-up from the team. "
        "Ask the caller for their 10-digit mobile number to associate with the ticket."
    ),
    properties={
        "subject": {
            "type": "string",
            "description": "A brief, clear subject line for the ticket (e.g. 'ERP login not working').",
        },
        "description": {
            "type": "string",
            "description": "Detailed description of the issue, including any steps to reproduce.",
        },
        "priority": {
            "type": "string",
            "enum": ["Low", "Medium", "High", "Urgent"],
            "description": "Priority level. Default is Medium.",
        },
        "phone_number": {
            "type": "string",
            "description": "The customer's 10-digit mobile contact number collected from the caller.",
        },
    },
    required=["subject", "description", "phone_number"],
)

CHECK_TICKETS_SCHEMA = FunctionSchema(
    name="check_open_tickets",
    description=(
        "Get the caller's current open support tickets and their status. "
        "Use this when the caller asks about the status of their existing issues or tickets."
    ),
    properties={},
    required=[],
)


# ── Handlers ──────────────────────────────────────────────────────────────────

async def handle_create_ticket(params: FunctionCallParams) -> None:
    state = params.app_resources
    subject: str = params.arguments.get("subject", "Support Request")
    description: str = params.arguments.get("description", "")
    priority: str = params.arguments.get("priority", "Medium")

    raw_phone = params.arguments.get("phone_number")
    clean_phone = "".join(filter(str.isdigit, str(raw_phone))) if raw_phone else ""
    SHARED_FORWARDING_NUMBERS = {"07969268119", "07948501661"}
    if len(clean_phone) >= 10 and clean_phone[-10:] not in SHARED_FORWARDING_NUMBERS:
        phone = clean_phone[-10:]
        if state:
            state.phone_number = phone
            try:
                from modules.identity.service import identity_service
                await identity_service.get_or_create(phone)
            except Exception:
                pass
    elif state and getattr(state, "telephony_provider", "") == "exotel":
        phone = ""
    elif state and "".join(filter(str.isdigit, str(state.phone_number)))[-10:] not in SHARED_FORWARDING_NUMBERS:
        phone = state.phone_number
    else:
        phone = ""

    ticket_data: dict = {
        "subject": subject,
        "description": description,
        "priority": priority,
        "status": "Open",
        "phone": phone,
    }

    # Attach desk contact if available in state
    if state and state.crm_contact:
        ticket_data["contactId"] = state.crm_contact.get("id")

    try:
        result = await desk_service.create_ticket(ticket_data)
        ticket_number = result.get("ticketNumber") or result.get("id", "N/A")
        await params.result_callback(
            f"Support ticket #{ticket_number} has been created. "
            f"Subject: '{subject}'. Our team will get back to you shortly."
        )
    except Exception as e:
        await params.result_callback(f"Could not create support ticket at this time: {e}")


async def handle_check_tickets(params: FunctionCallParams) -> None:
    state = params.app_resources
    if state is None or not state.open_tickets:
        await params.result_callback("You currently have no open support tickets.")
        return

    tickets = state.open_tickets
    lines = [f"You have {len(tickets)} open ticket(s):"]
    for t in tickets[:5]:
        lines.append(
            f"  Ticket #{t.get('ticketNumber', '?')}: {t.get('subject', '—')} "
            f"[{t.get('priority', 'Normal')} / {t.get('status', 'Open')}]"
        )
    await params.result_callback("\n".join(lines))
