"""Desk factory — selects the right provider based on configuration.

If Zoho is enabled (auto-detected from credentials or ZOHO_ENABLED=true),
it returns the ZohoDeskService. Otherwise, it returns a StubDeskService.
"""

from loguru import logger

from env_config import settings
from services.desk.base import BaseDeskService, StubDeskService

def _create_desk_service() -> BaseDeskService:
    if settings.zoho_enabled:
        try:
            from services.desk.zoho import ZohoDeskService
            logger.info("[desk] Using Zoho Desk provider")
            return ZohoDeskService()
        except Exception as e:
            logger.warning(f"[desk] Failed to initialize Zoho Desk ({e}) — falling back to stub")

    logger.info("[desk] No Desk provider configured — using stub")
    return StubDeskService()

desk_service: BaseDeskService = _create_desk_service()
