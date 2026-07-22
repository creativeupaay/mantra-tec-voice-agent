"""Credit Usage service — business logic for credit tracking."""

from typing import List, Optional
from config.database import get_db, is_db_available
from modules.credit_usage.model import CreditUsage, CreditUsageCreate, CreditUsageUpdate, CreditType, ServiceType
from modules.identity.model import PyObjectId


class CreditUsageRepository:
    def _get_collection(self):
        if not is_db_available():
            raise RuntimeError("MongoDB not available — call history and identity features are offline.")
        return get_db().credit_usage

    async def create(self, data: CreditUsageCreate) -> CreditUsage:
        """Record a new credit usage entry."""
        doc = data.model_dump()
        doc["user_id"] = str(doc["user_id"])
        result = await self._get_collection().insert_one(doc)
        doc["_id"] = result.inserted_id
        return CreditUsage(**doc)

    async def find_by_user(self, user_id: PyObjectId, limit: int = 50) -> List[CreditUsage]:
        """Get credit usage history for a user."""
        cursor = self._get_collection().find({"user_id": str(user_id)}).sort("created_at", -1).limit(limit)
        return [CreditUsage(**doc) async for doc in cursor]

    async def get_balance(self, user_id: PyObjectId) -> int:
        """Calculate current credit balance for a user."""
        pipeline = [
            {"$match": {"user_id": str(user_id)}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        result = await self._get_collection().aggregate(pipeline).to_list(1)
        return result[0]["total"] if result else 0

    async def get_total_usage(self, user_id: PyObjectId, days: int = 30) -> int:
        """Get total credit usage for a user in the last N days."""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        pipeline = [
            {"$match": {
                "user_id": str(user_id),
                "type": CreditType.USAGE.value,
                "created_at": {"$gte": cutoff}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        result = await self._get_collection().aggregate(pipeline).to_list(1)
        return result[0]["total"] if result else 0

    async def get_all_usage(self, limit: int = 100) -> List[CreditUsage]:
        """Get all credit usage records (for super admin)."""
        cursor = self._get_collection().find().sort("created_at", -1).limit(limit)
        return [CreditUsage(**doc) async for doc in cursor]


class CreditUsageService:
    def __init__(self):
        self._repo = CreditUsageRepository()

    async def record_usage(
        self,
        user_id: PyObjectId,
        amount: int,
        description: str,
        service: Optional[ServiceType] = None,
        metadata: Optional[dict] = None
    ) -> CreditUsage:
        """Record credit usage (deduction)."""
        data = CreditUsageCreate(
            user_id=user_id,
            amount=-abs(amount),  # Usage is negative
            description=description,
            type=CreditType.USAGE,
            service=service,
            metadata=metadata or {}
        )
        return await self._repo.create(data)

    async def record_purchase(
        self,
        user_id: PyObjectId,
        amount: int,
        description: str,
        service: Optional[ServiceType] = None,
        metadata: Optional[dict] = None
    ) -> CreditUsage:
        """Record credit purchase (addition)."""
        data = CreditUsageCreate(
            user_id=user_id,
            amount=abs(amount),  # Purchase is positive
            description=description,
            type=CreditType.PURCHASE,
            service=service,
            metadata=metadata or {}
        )
        return await self._repo.create(data)

    async def record_refund(
        self,
        user_id: PyObjectId,
        amount: int,
        description: str,
        service: Optional[ServiceType] = None,
        metadata: Optional[dict] = None
    ) -> CreditUsage:
        """Record credit refund."""
        data = CreditUsageCreate(
            user_id=user_id,
            amount=abs(amount),  # Refund is positive
            description=description,
            type=CreditType.REFUND,
            service=service,
            metadata=metadata or {}
        )
        return await self._repo.create(data)

    async def get_user_balance(self, user_id: PyObjectId) -> int:
        """Get current credit balance for a user."""
        return await self._repo.get_balance(user_id)

    async def get_user_history(self, user_id: PyObjectId, limit: int = 50) -> List[CreditUsage]:
        """Get credit usage history for a user."""
        return await self._repo.find_by_user(user_id, limit)

    async def get_all_usage(self, limit: int = 100) -> List[CreditUsage]:
        """Get all credit usage (super admin)."""
        return await self._repo.get_all_usage(limit)


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