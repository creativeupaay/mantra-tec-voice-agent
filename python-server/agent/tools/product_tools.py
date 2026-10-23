"""Product lookup tool — the agent's only source of product facts.

Facts (status, price, Aadhaar / non-Aadhaar, where to buy, client exceptions) live in
agent/knowledge/catalog.yaml. Update that file, not the system prompt.
"""

from loguru import logger
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from agent.knowledge import catalog

# ── Tool Schema ──────────────────────────────────────────────────────────────
SCHEMA = FunctionSchema(
    name="search_products",
    description=(
        "Look up Mantra Tech products. Call this before you state anything about a product "
        "(status, price, availability, Aadhaar or non-Aadhaar, where to buy) and before you "
        "recommend a device. Call it again for every new product the caller mentions; never "
        "reuse facts from one product for another. Follow the result's 'How to buy' and 'Note' "
        "lines. If the result says the product is not in the catalog, do not guess: collect the "
        "caller's details and arrange a sales team callback."
    ),
    properties={
        "query": {
            "type": "string",
            "description": (
                "In English. The model name if the caller said one (e.g. 'MFS500'), otherwise a "
                "short description of the need including Aadhaar or non-Aadhaar if known "
                "(e.g. 'non aadhaar fingerprint scanner', 'aadhaar attendance machine')."
            ),
        }
    },
    required=["query"],
)


# ── Tool Handler ─────────────────────────────────────────────────────────────
async def handle(params: FunctionCallParams) -> None:
    """Deterministic catalog lookup (no LLM call, so no added dead air on the line)."""
    query = params.arguments.get("query", "")
    try:
        result = catalog.lookup(query)
        logger.info(f"[product_tools] search_products('{query}') → {len(result)} chars")
        await params.result_callback(result)
    except Exception as e:
        logger.error(f"[product_tools] Error in search_products: {e}")
        await params.result_callback(
            "Lookup failed. Do not guess product details: offer a sales team callback."
        )
