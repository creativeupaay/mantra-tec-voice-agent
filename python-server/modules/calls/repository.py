"""Calls repository — raw MongoDB CRUD for call records."""

from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from modules.calls.model import Call, CallCreate, CallUpdate, CallRecording
from services.storage.base import StorageProvider, StorageFactory


class CallRepository:
    def __init__(
        self, 
        db: AsyncIOMotorDatabase,
        storage_provider: Optional[StorageProvider] = None
    ) -> None:
        self._col = db.calls
        self._storage = storage_provider
    
    def set_storage_provider(self, provider: StorageProvider) -> None:
        """Set or update the storage provider."""
        self._storage = provider

    async def create(self, data: CallCreate) -> Call:
        doc = data.model_dump()
        result = await self._col.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return Call(**doc)
    
    async def upload_recording(self, recording: CallRecording) -> Call:
        """
        Upload a call recording and update the call record.
        
        Args:
            recording: CallRecording model with call_id, content, and optional metadata
            
        Returns:
            Updated Call model with recording_url and recording_path
        """
        if not self._storage:
            raise RuntimeError("Storage provider not configured")
        
        # Generate storage path
        file_path = f"recordings/{recording.call_id}.mp3"
        
        # Upload to storage
        url = await self._storage.upload_recording(
            file_path=file_path,
            file_content=recording.file_content,
            content_type=recording.content_type
        )
        
        # Update call record with recording info
        await self._col.update_one(
            {"call_id": recording.call_id},
            {"$set": {"recording_url": url, "recording_path": file_path}}
        )
        
        return await self.find_by_call_id(recording.call_id)

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
