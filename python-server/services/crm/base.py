"""CRM abstract interface."""

from abc import ABC, abstractmethod
from typing import Any

class BaseCRMService(ABC):
    """Abstract CRM interface — swap implementations without touching tools."""

    @abstractmethod
    async def search_lead_by_phone(self, phone: str) -> dict[str, Any] | None: ...

    @abstractmethod
    async def search_contact_by_phone(self, phone: str) -> dict[str, Any] | None: ...

    @abstractmethod
    async def create_lead(self, data: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    async def update_lead(self, lead_id: str, data: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    async def get_lead(self, lead_id: str) -> dict[str, Any] | None: ...

    @abstractmethod
    async def get_contact(self, contact_id: str) -> dict[str, Any] | None: ...

class StubCRMService(BaseCRMService):
    """Placeholder CRM service."""

    async def search_lead_by_phone(self, phone: str) -> dict[str, Any] | None:
        return None

    async def search_contact_by_phone(self, phone: str) -> dict[str, Any] | None:
        return None

    async def create_lead(self, data: dict[str, Any]) -> dict[str, Any]:
        return {"id": "stub_lead_id", **data}

    async def update_lead(self, lead_id: str, data: dict[str, Any]) -> dict[str, Any]:
        return {"id": lead_id, **data}

    async def get_lead(self, lead_id: str) -> dict[str, Any] | None:
        return None

    async def get_contact(self, contact_id: str) -> dict[str, Any] | None:
        return None
