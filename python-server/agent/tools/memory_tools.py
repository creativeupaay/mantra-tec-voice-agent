"""Caller notes and escalation tools."""

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from modules.identity.model import IdentityUpdate
from modules.identity.service import identity_service

# ── Schema definitions ────────────────────────────────────────────────────────

UPDATE_NOTES_SCHEMA = FunctionSchema(
    name="update_caller_notes",
    description=(
        "Save an important note about this caller for future calls. "
        "Use this when the caller shares significant preferences, requirements, "
        "or context that should be remembered (e.g. industry, preferred contact time, key concerns)."
    ),
    properties={
        "notes": {
            "type": "string",
            "description": "The note to save. Be concise and factual.",
        }
    },
    required=["notes"],
)

ESCALATE_SCHEMA = FunctionSchema(
    name="escalate_to_human",
    description=(
        "Transfer the call to a human Mantra Tech team member. "
        "Use this when: the caller explicitly asks for a human agent, "
        "the issue is too complex for you to handle, "
        "the caller is very frustrated, or you cannot resolve their request."
    ),
    properties={
        "reason": {
            "type": "string",
            "description": "Brief reason for the escalation (for the human agent's context).",
        }
    },
    required=["reason"],
)


# ── Handlers ──────────────────────────────────────────────────────────────────

async def handle_update_notes(params: FunctionCallParams) -> None:
    state = params.app_resources
    notes: str = params.arguments.get("notes", "").strip()

    if not notes:
        await params.result_callback("No notes provided — nothing was saved.")
        return

    phone = state.phone_number if state else None
    if not phone:
        await params.result_callback("Could not save notes — no phone number available.")
        return

    try:
        await identity_service.update_profile(phone, IdentityUpdate(agent_notes=notes))
        await params.result_callback("Notes saved successfully for future reference.")
    except Exception as e:
        await params.result_callback(f"Could not save notes: {e}")


async def handle_escalate(params: FunctionCallParams) -> None:
    reason: str = params.arguments.get("reason", "Caller requested human agent")
    # Phase 4: trigger actual SIP transfer / Plivo live agent transfer here
    await params.result_callback(
        f"Escalation requested — reason: {reason}. "
        "Instruct the agent to say: "
        "'Let me connect you with one of our team members right away. "
        "Please hold for a moment.'"
    )
