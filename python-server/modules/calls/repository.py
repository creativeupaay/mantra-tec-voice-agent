"""Calls repository — raw MongoDB CRUD for call records."""

from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from modules.calls.model import Call, CallCreate, CallUpdate


class CallRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db.calls

    async def create(self, data: CallCreate) -> Call:
        doc = data.model_dump()
        result = await self._col.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return Call(**doc)

    async def find_by_call_id(self, call_id: str) -> Optional[Call]:
        doc = await self._col.find_one({"call_id": call_id})
        return Call(**doc) if doc else None

    async def find_recent_by_phone(
        self, phone_number: str, limit: int = 3
    ) -> List[Call]:
        cursor = (
            self._col
            .find({"phone_number": phone_number})
            .sort("timestamp", -1)
            .limit(limit)
        )
        return [Call(**doc) async for doc in cursor]

    async def update(self, call_id: str, data: CallUpdate) -> Optional[Call]:
        updates = {k: v for k, v in data.model_dump().items() if v is not None}
        if updates:
            await self._col.update_one({"call_id": call_id}, {"$set": updates})
        return await self.find_by_call_id(call_id)
