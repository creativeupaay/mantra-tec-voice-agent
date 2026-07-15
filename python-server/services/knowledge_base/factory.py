"""Knowledge base factory — selects the right provider from KB_PROVIDER env var.

Supported providers:
  ""              (default) → StubKnowledgeBaseService — minimal static content
  "qdrant"                  → QdrantKBService — Qdrant vector DB

If KB_ENABLED=false in .env, the tool is removed from the agent schema entirely
(no search calls are made). If KB_ENABLED=true (default) with no KB_PROVIDER,
the stub is used — the agent still has the search_knowledge_base tool but returns
generic company info until a real provider is configured.
"""

from loguru import logger

from env_config import settings
from services.knowledge_base.base import BaseKnowledgeBaseService, StubKnowledgeBaseService


def _create_kb_service() -> BaseKnowledgeBaseService:
    provider = (settings.kb_provider or "").lower().strip()

    if provider == "qdrant":
        try:
            from services.knowledge_base.qdrant_kb import QdrantKBService
            logger.info("[kb] Using Qdrant vector search")
            return QdrantKBService()
        except ImportError as e:
            logger.warning(f"[kb] Qdrant provider unavailable ({e}) — falling back to stub")

    elif provider:
        logger.warning(f"[kb] Unknown KB_PROVIDER '{provider}' — falling back to stub")

    else:
        logger.info("[kb] No KB_PROVIDER set — using stub (set KB_PROVIDER to enable real search)")

    return StubKnowledgeBaseService()


# Singleton — created once at import time based on current settings
knowledge_base_service: BaseKnowledgeBaseService = _create_kb_service()
