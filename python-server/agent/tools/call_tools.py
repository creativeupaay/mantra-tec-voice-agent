"""Call control tools (e.g. hangup/disconnect)."""

import asyncio
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams
from loguru import logger

SCHEMA = FunctionSchema(
    name="end_call",
    description="End and disconnect the phone call when the conversation is finished, after thanking or saying goodbye, or when the user explicitly requests to hang up.",
    properties={
        "reason": {
            "type": "string",
            "description": "Short explanation for ending the call (e.g. 'conversation_completed', 'user_requested_hangup', 'issue_resolved').",
        }
    },
    required=[],
)


async def handle(params: FunctionCallParams) -> None:
    """Handle end_call tool invocation from the LLM."""
    state = params.app_resources
    reason = params.arguments.get("reason", "conversation_completed")
    call_id = getattr(state, "call_id", "unknown") if state else "unknown"
    
    logger.info(f"[tool.end_call] Disconnecting call {call_id} (reason='{reason}')")

    # If the disconnect hook is attached to state, schedule it after TTS delivers goodbye audio
    if state and hasattr(state, "request_disconnect") and callable(state.request_disconnect):
        asyncio.create_task(state.request_disconnect(delay=3.0))

    await params.result_callback(
        "Call disconnection scheduled. Say a warm goodbye to the caller."
    )
