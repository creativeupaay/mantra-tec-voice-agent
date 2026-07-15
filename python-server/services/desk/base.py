"""Desk support abstract interface."""

from abc import ABC, abstractmethod
from typing import Any

class BaseDeskService(ABC):
    """Abstract Desk interface — swap implementations without touching tools."""

    @abstractmethod
    async def find_contact(self, phone: str) -> dict[str, Any] | None: ...

    @abstractmethod
    async def get_open_tickets(self, contact_id: str) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def create_ticket(self, data: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    async def update_ticket(
        self, ticket_id: str, data: dict[str, Any]
    ) -> dict[str, Any]: ...


class StubDeskService(BaseDeskService):
    """Placeholder Desk service."""

    async def find_contact(self, phone: str) -> dict[str, Any] | None:
        return None

    async def get_open_tickets(self, contact_id: str) -> list[dict[str, Any]]:
        return []

    async def create_ticket(self, data: dict[str, Any]) -> dict[str, Any]:
        return {"ticketNumber": "STUB-1234", "id": "stub_ticket_id", **data}

    async def update_ticket(
        self, ticket_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        return {"id": ticket_id, **data}
