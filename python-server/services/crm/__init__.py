"""CRM package — exports the active service singleton."""

from services.crm.factory import crm_service

__all__ = ["crm_service"]
