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
        try:
            headers = await self._auth_headers()
            logger.info(f"[Zoho CRM] Searching lead by phone: {phone}")
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.zoho_crm_base_url}/Leads/search",
                    headers=headers,
                    params={"phone": phone},
                )
                if resp.status_code == 204:
                    logger.info(f"[Zoho CRM] No lead found for phone {phone} (status 204)")
                    return None
                resp.raise_for_status()
                data = resp.json().get("data", [None])[0]
                logger.info(f"[Zoho CRM] Found lead record: {data.get('id') if data else 'None'}")
                return data
        except Exception as e:
            logger.error(f"[Zoho CRM] Search lead failed for {phone}: {e}")
            return None

    async def search_contact_by_phone(self, phone: str) -> dict[str, Any] | None:
        try:
            headers = await self._auth_headers()
            logger.info(f"[Zoho CRM] Searching contact by phone: {phone}")
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.zoho_crm_base_url}/Contacts/search",
                    headers=headers,
                    params={"phone": phone},
                )
                if resp.status_code == 204:
                    logger.info(f"[Zoho CRM] No contact found for phone {phone} (status 204)")
                    return None
                resp.raise_for_status()
                data = resp.json().get("data", [None])[0]
                logger.info(f"[Zoho CRM] Found contact record: {data.get('id') if data else 'None'}")
                return data
        except Exception as e:
            logger.error(f"[Zoho CRM] Search contact failed for {phone}: {e}")
            return None

    async def create_lead(self, data: dict[str, Any]) -> dict[str, Any]:
        headers = await self._auth_headers()
        url = f"{settings.zoho_crm_base_url}/Leads"
        logger.info(f"[Zoho CRM API] POST {url} | Payload: {data}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers=headers,
                json={"data": [data]},
            )
            logger.info(f"[Zoho CRM API] Status Code: {resp.status_code} | Response: {resp.text}")
            resp.raise_for_status()
            res_list = resp.json().get("data", [{}])
            res_data = res_list[0] if res_list else {}
            logger.info(f"[Zoho CRM API] Lead Created Successfully: ID={res_data.get('details', {}).get('id')}")
            return res_data

    async def update_lead(self, lead_id: str, data: dict[str, Any]) -> dict[str, Any]:
        headers = await self._auth_headers()
        url = f"{settings.zoho_crm_base_url}/Leads/{lead_id}"
        logger.info(f"[Zoho CRM API] PUT {url} | Payload: {data}")
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                url,
                headers=headers,
                json={"data": [data]},
            )
            logger.info(f"[Zoho CRM API] Update Status Code: {resp.status_code} | Response: {resp.text}")
            resp.raise_for_status()
            res_list = resp.json().get("data", [{}])
            res_data = res_list[0] if res_list else {}
            logger.info(f"[Zoho CRM API] Lead Updated Successfully: ID={res_data.get('details', {}).get('id') or lead_id}")
            return res_data

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
