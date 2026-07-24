"""Credit Usage service — business logic for credit tracking."""

from datetime import datetime
from typing import Optional

from bson import ObjectId
from loguru import logger

from config.database import get_db, is_db_available
from modules.credit_usage.model import CreditUsage, CreditUsageCreate, CreditType, ServiceType
from modules.identity.model import PyObjectId


class CreditUsageRepository:
    def _get_collection(self):
        if not is_db_available():
            raise RuntimeError("MongoDB not available — call history and identity features are offline.")
        return get_db().credit_usage

    async def create(self, data: CreditUsageCreate) -> CreditUsage:
        """Record a new credit usage entry."""
        now = datetime.utcnow()
        doc = data.model_dump(mode="json", exclude_none=True)

        # Store as ObjectId so Node/Mongoose can populate Call refs.
        doc["call_id"] = ObjectId(str(doc["call_id"]))

        # Align with Mongoose `{ timestamps: true }` field names used by analytics.
        doc["createdAt"] = now
        doc["updatedAt"] = now
        doc["created_at"] = now
        doc["updated_at"] = now

        result = await self._get_collection().insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["call_id"] = str(doc["call_id"])
        return CreditUsage(**doc)


class CreditUsageService:
    def __init__(self):
        self._repo = CreditUsageRepository()

    async def record_usage(
        self,
        call_id: PyObjectId,
        amount: float,
        description: str,
        service: Optional[ServiceType] = None,
        metadata: Optional[dict] = None,
    ) -> CreditUsage:
        """Record estimated USD usage (stored as a negative deduction)."""
        usd = round(abs(float(amount or 0)), 6)
        meta = dict(metadata or {})
        meta.setdefault("estimated_usd", usd)

        data = CreditUsageCreate(
            call_id=call_id,
            amount=-usd,
            description=description,
            type=CreditType.USAGE,
            service=service,
            metadata=meta,
        )
        usage = await self._repo.create(data)
        logger.debug(
            f"[credit-usage] Recorded ${usd:.6f} "
            f"(service={service}, call_id={call_id})"
        )
        return usage


# Lazy initialization - only create when needed
_credit_usage_service: CreditUsageService | None = None


def get_credit_usage_service() -> CreditUsageService:
    """Get the credit usage service instance (lazy init)."""
    global _credit_usage_service
    if _credit_usage_service is None:
        _credit_usage_service = CreditUsageService()
    return _credit_usage_service


# Backward compatibility - this will be initialized lazily on first access
credit_usage_service = None
