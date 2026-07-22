"""Agent tool registry and catch-all dispatcher.

Centralises ALL tool schemas (sent to the LLM) and ALL handlers (executed on call).
The dispatcher is registered as a catch-all on the LLM service via:

    llm.register_function(None, graph.dispatch)

The handler receives a FunctionCallParams object, routes by function_name,
and delivers the result via params.result_callback().
"""

from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams
from loguru import logger

from agent.tools import booking_tools, crm_tools, desk_tools, memory_tools, product_tools

# ── Tool Schema Registry ──────────────────────────────────────────────────────
# ToolsSchema is what LLMContext expects.

TOOLS_SCHEMA = ToolsSchema(
    standard_tools=[
        product_tools.SCHEMA,
        # Tools temporarily detached as per user request to mimic flow only.
    ]
)

# ── Handler Registry ──────────────────────────────────────────────────────────

_HANDLERS = {
    "search_products": product_tools.handle,
    "zoho_crm_create_lead": crm_tools.handle_create_lead,
    "zoho_crm_search_lead": crm_tools.handle_get_crm,
    "zoho_desk_create_ticket": desk_tools.handle_create_ticket,
    "zoho_desk_check_tickets": desk_tools.handle_check_tickets,    
    # Handlers temporarily detached.
}


# ── Catch-all Dispatcher ──────────────────────────────────────────────────────

async def dispatch(params: FunctionCallParams) -> None:
    """Single catch-all handler registered on the LLM via register_function(None, dispatch).

    Routes by params.function_name → specific handler.
    app_resources on params holds the per-call CallState.
    """
    name = params.function_name
    handler = _HANDLERS.get(name)

    if not handler:
        logger.warning(f"[agent.graph] Unknown tool called: '{name}'")
        await params.result_callback(
            f"The tool '{name}' is not available. Please try a different approach."
        )
        return

    logger.info(f"[agent.graph] Tool call: {name}({dict(params.arguments)})")

    try:
        await handler(params)
    except Exception as e:
        logger.error(f"[agent.graph] Tool '{name}' raised: {e}")
        await params.result_callback(
            f"Something went wrong while running '{name}'. Please try again."
        )
