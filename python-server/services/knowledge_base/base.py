"""Knowledge base service — abstract interface + stub implementation.

Phase 1: StubKnowledgeBaseService returns placeholder content.
Phase 3: Replace with real vector search (MongoDB Atlas or Qdrant).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List


@dataclass
class KBResult:
    """A single knowledge base search result."""

    content: str
    source: str
    score: float


class BaseKnowledgeBaseService(ABC):
    """Abstract interface for knowledge base vector search.

    All consumers code against this interface so the provider can be swapped
    in Phase 3 without touching the LangGraph tool layer.
    """

    @abstractmethod
    async def search(self, query: str, top_k: int = 5) -> List[KBResult]:
        """Search the KB and return ranked results."""
        ...


class StubKnowledgeBaseService(BaseKnowledgeBaseService):
    """Placeholder KB — returns minimal static content until Phase 3.

    Remove this once real vector search is wired in.
    """

    async def search(self, query: str, top_k: int = 5) -> List[KBResult]:
        return [
            KBResult(
                content=(
                    "Mantra Tech provides ERP, CRM, and custom software solutions "
                    "for small and medium businesses across India."
                ),
                source="company_overview",
                score=1.0,
            )
        ]


# Active KB implementation — swap StubKnowledgeBaseService for real one in Phase 3
knowledge_base_service: BaseKnowledgeBaseService = StubKnowledgeBaseService()
