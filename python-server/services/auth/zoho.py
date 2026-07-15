"""Zoho OAuth mixin.

Provides token caching backed by Redis.
"""

import time
import httpx
from loguru import logger

from env_config import settings

_ZOHO_TOKEN_KEY = "zoho:oauth:access_token"

class ZohoAuthMixin:
    """Handles Zoho OAuth2 token refresh with Redis-backed caching."""

    _access_token: str | None = None
    _token_expiry: float = 0.0

    async def _redis_get_token(self) -> str | None:
        try:
            from config.redis_client import get_redis
            token = await get_redis().get(_ZOHO_TOKEN_KEY)
            return token
        except Exception:
            return None

    async def _redis_set_token(self, token: str, expires_in: int) -> None:
        try:
            from config.redis_client import get_redis
            ttl = max(int(expires_in) - 120, 60)
            await get_redis().setex(_ZOHO_TOKEN_KEY, ttl, token)
        except Exception:
            pass

    async def _get_access_token(self) -> str:
        token = await self._redis_get_token()
        if token:
            return token

        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token

        logger.info("Refreshing Zoho access token...")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.zoho_accounts_url}/oauth/v2/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": settings.zoho_client_id,
                    "client_secret": settings.zoho_client_secret,
                    "refresh_token": settings.zoho_refresh_token,
                },
            )
            resp.raise_for_status()
            payload = resp.json()

        access_token: str = payload["access_token"]
        expires_in: int = payload.get("expires_in", 3600)

        await self._redis_set_token(access_token, expires_in)
        self._access_token = access_token
        self._token_expiry = time.time() + expires_in

        logger.info("Zoho access token refreshed and cached successfully")
        return access_token

    async def _auth_headers(self) -> dict[str, str]:
        token = await self._get_access_token()
        return {
            "Authorization": f"Zoho-oauthtoken {token}",
            "Content-Type": "application/json",
        }
