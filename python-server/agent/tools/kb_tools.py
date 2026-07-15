"""Knowledge base search tool."""

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from services.knowledge_base.factory import knowledge_base_service

SCHEMA = FunctionSchema(
    name="search_knowledge_base",
    description=(
        "Search Mantra Tech's knowledge base for information about the company, "
        "its products (ERP, CRM, custom software), services, pricing, or FAQs. "
        "Use this whenever the caller asks about what Mantra Tech offers or does."
    ),
    properties={
        "query": {
            "type": "string",
            "description": "The search query to look up in the knowledge base. CRITICAL: Always translate the query into English before searching, even if the user is speaking Hindi or Hinglish.",
        }
    },
    required=["query"],
)


async def handle(params: FunctionCallParams) -> None:
    query: str = params.arguments.get("query", "")
    results = await knowledge_base_service.search(query, top_k=3)

    if not results:
        await params.result_callback("No relevant information found in the knowledge base.")
        return

    formatted = "\n\n".join(f"[{r.source}]\n{r.content}" for r in results)
    await params.result_callback(formatted)
