"""Zoho CRM service — concrete HTTP implementation."""

from typing import Any

import httpx
from loguru import logger

from env_config import settings
from services.crm.base import BaseCRMService
from services.auth.zoho import ZohoAuthMixin

class ZohoCRMService(BaseCRMService, ZohoAuthMixin):
    """Production Zoho CRM implementation over REST API v2."""

    async def search_lead_by_phone(self, phone: str) -> dict[str, Any] | None:
        headers = await self._auth_headers()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.zoho_crm_base_url}/Leads/search",
                headers=headers,
                params={"phone": phone},
            )
            if resp.status_code == 204:
                return None
            resp.raise_for_status()
            return resp.json().get("data", [None])[0]

    async def search_contact_by_phone(self, phone: str) -> dict[str, Any] | None:
        headers = await self._auth_headers()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.zoho_crm_base_url}/Contacts/search",
                headers=headers,
                params={"phone": phone},
            )
            if resp.status_code == 204:
                return None
            resp.raise_for_status()
            return resp.json().get("data", [None])[0]

    async def create_lead(self, data: dict[str, Any]) -> dict[str, Any]:
        headers = await self._auth_headers()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.zoho_crm_base_url}/Leads",
                headers=headers,
                json={"data": [data]},
            )
            resp.raise_for_status()
            return resp.json().get("data", [{}])[0]

    async def get_lead(self, lead_id: str) -> dict[str, Any] | None:
        headers = await self._auth_headers()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.zoho_crm_base_url}/Leads/{lead_id}",
                headers=headers,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json().get("data", [None])[0]

    async def get_contact(self, contact_id: str) -> dict[str, Any] | None:
        headers = await self._auth_headers()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.zoho_crm_base_url}/Contacts/{contact_id}",
                headers=headers,
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json().get("data", [None])[0]
