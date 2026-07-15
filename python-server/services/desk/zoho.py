"""Zoho Desk service — concrete HTTP implementation."""

from typing import Any

import httpx
from loguru import logger

from env_config import settings
from services.desk.base import BaseDeskService
from services.auth.zoho import ZohoAuthMixin


class ZohoDeskService(BaseDeskService, ZohoAuthMixin):
    """Production Zoho Desk implementation over REST API v1."""

    @property
    def _org_header(self) -> dict[str, str]:
        return {"orgId": settings.zoho_desk_org_id}

    async def find_contact(self, phone: str) -> dict[str, Any] | None:
        headers = {**await self._auth_headers(), **self._org_header}
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.zoho_desk_base_url}/contacts/search",
                headers=headers,
                params={"phone": phone},
            )
            if resp.status_code == 204:
                return None
            resp.raise_for_status()
            items = resp.json().get("data", [])
            return items[0] if items else None

    async def get_open_tickets(self, contact_id: str) -> list[dict[str, Any]]:
        headers = {**await self._auth_headers(), **self._org_header}
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.zoho_desk_base_url}/tickets",
                headers=headers,
                params={"contactId": contact_id, "status": "Open"},
            )
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def create_ticket(self, data: dict[str, Any]) -> dict[str, Any]:
        headers = {**await self._auth_headers(), **self._org_header}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.zoho_desk_base_url}/tickets",
                headers=headers,
                json=data,
            )
            resp.raise_for_status()
            return resp.json()

    async def update_ticket(
        self, ticket_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        headers = {**await self._auth_headers(), **self._org_header}
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{settings.zoho_desk_base_url}/tickets/{ticket_id}",
                headers=headers,
                json=data,
            )
            resp.raise_for_status()
            return resp.json()
