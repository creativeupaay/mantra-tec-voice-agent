"""CRM factory — selects the right provider based on configuration.

If Zoho is enabled (auto-detected from credentials or ZOHO_ENABLED=true),
it returns the ZohoCRMService. Otherwise, it returns a StubCRMService.
"""

from loguru import logger

from env_config import settings
from services.crm.base import BaseCRMService, StubCRMService

def _create_crm_service() -> BaseCRMService:
    if settings.zoho_enabled:
        try:
            from services.crm.zoho import ZohoCRMService
            logger.info("[crm] Using Zoho CRM provider")
            return ZohoCRMService()
        except Exception as e:
            logger.warning(f"[crm] Failed to initialize Zoho CRM ({e}) — falling back to stub")

    logger.info("[crm] No CRM provider configured — using stub")
    return StubCRMService()

crm_service: BaseCRMService = _create_crm_service()
