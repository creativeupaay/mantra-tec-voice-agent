"""Identity repository — raw MongoDB CRUD. No business logic lives here."""

from datetime import datetime
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from modules.identity.model import Identity, IdentityCreate, IdentityUpdate


class IdentityRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db.identities

    async def find_by_phone(self, phone_number: str) -> Optional[Identity]:
        doc = await self._col.find_one({"phone_number": phone_number})
        return Identity(**doc) if doc else None

    async def find_by_id(self, identity_id: str) -> Optional[Identity]:
        doc = await self._col.find_one({"_id": ObjectId(identity_id)})
        return Identity(**doc) if doc else None

    async def create(self, data: IdentityCreate) -> Identity:
        doc = data.model_dump()
        doc["created_at"] = datetime.utcnow()
        result = await self._col.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return Identity(**doc)

    async def update(self, phone_number: str, data: IdentityUpdate) -> Optional[Identity]:
        updates = {k: v for k, v in data.model_dump().items() if v is not None}
        if updates:
            await self._col.update_one(
                {"phone_number": phone_number}, {"$set": updates}
            )
        return await self.find_by_phone(phone_number)

    async def upsert(self, data: IdentityCreate) -> Identity:
        """Get the existing identity or create a new one atomically."""
        existing = await self.find_by_phone(data.phone_number)
        return existing if existing else await self.create(data)

    async def append_to_array(self, phone_number: str, field: str, value: str) -> None:
        """Helper to push a single item to an array field like previous_discussions."""
        await self._col.update_one(
            {"phone_number": phone_number}, {"$push": {field: value}}
        )
