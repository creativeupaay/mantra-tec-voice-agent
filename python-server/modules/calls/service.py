"""Calls service — business logic for call lifecycle management."""

from typing import List, Optional

from config.database import get_db
from modules.calls.model import (
    Call,
    CallCategory,
    CallCreate,
    CallRecording,
    CallStatus,
    CallUpdate,
)
from modules.calls.repository import CallRepository
from services.storage.base import StorageProvider, StorageFactory
from env_config import settings


class CallService:
    def _repo(self) -> CallRepository:
        return CallRepository(get_db())
    
    def _get_storage_provider(self) -> Optional[StorageProvider]:
        """Get configured storage provider for recordings."""
        storage_provider = settings.storage_provider
        if not storage_provider:
            return None

        return StorageFactory.create(
            provider=storage_provider,
            bucket_name=settings.recording_bucket_name,
            project_id=settings.gcp_project_id,
        )

    async def start_call(self, call_id: str, phone_number: str) -> Call:
        """Register the call when it first connects."""
        return await self._repo().create(
            CallCreate(call_id=call_id, phone_number=phone_number)
        )

    async def upload_recording(self, recording: CallRecording) -> Call:
        """
        Upload a call recording and update the call record.
        
        Args:
            recording: CallRecording model with call_id, content, and optional metadata
            
        Returns:
            Updated Call model with recording_url and recording_path
        """
        storage = self._get_storage_provider()
        if not storage:
            # Store null values if no storage configured
            return await self.finalize_call(
                recording.call_id,
                recording_url=None,
                recording_path=None
            )
        
        repository = self._repo()
        repository.set_storage_provider(storage)
        
        return await repository.upload_recording(recording)

    async def finalize_call(
        self,
        call_id: str,
        *,
        duration: Optional[int] = None,
        transcript: Optional[str] = None,
        summary: Optional[str] = None,
        intent: Optional[str] = None,
        call_category: Optional[CallCategory] = None,
        outcome: Optional[str] = None,
        status: Optional[CallStatus] = None,
        caller_name: Optional[str] = None,
        recording_url: Optional[str] = None,
        recording_path: Optional[str] = None,
        is_red_flagged: Optional[bool] = None,
        red_flag_reason: Optional[str] = None,
        guardrail_triggered: Optional[str] = None,
    ) -> Optional[Call]:
        """Persist post-call data once the post-call pipeline completes."""
        # Keep legacy `is_red_flag` in sync with `is_red_flagged` for the UI.
        is_red_flag = is_red_flagged if is_red_flagged is not None else None

        return await self._repo().update(
            call_id,
            CallUpdate(
                caller_name=caller_name,
                duration=duration,
                status=status,
                transcript=transcript,
                call_summary=summary,
                detected_intent=intent,
                call_category=call_category,
                call_outcome=outcome,
                recording_url=recording_url,
                recording_path=recording_path,
                is_red_flag=is_red_flag,
                is_red_flagged=is_red_flagged,
                red_flag_reason=red_flag_reason,
                guardrail_triggered=guardrail_triggered,
            ),
        )

    async def get_recent_calls(
        self, phone_number: str, limit: int = 3
    ) -> List[Call]:
        return await self._repo().find_recent_by_phone(phone_number, limit)

    async def get_call(self, call_id: str) -> Optional[Call]:
        return await self._repo().find_by_call_id(call_id)

    async def cleanup_old_recordings(self, days: int = 30) -> int:
        """
        Delete recordings older than specified days (default 30) from storage and update DB records.
        """
        from datetime import datetime, timedelta, timezone
        from loguru import logger

        db = get_db()
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_iso = cutoff_date.isoformat()

        # Query calls created before cutoff date with recording references
        query = {
            "$and": [
                {
                    "$or": [
                        {"timestamp": {"$lt": cutoff_iso}},
                        {"created_at": {"$lt": cutoff_date}},
                    ]
                },
                {
                    "$or": [
                        {"recording_path": {"$ne": None, "$exists": True}},
                        {"recording_url": {"$ne": None, "$exists": True}},
                    ]
                }
            ]
        }

        cursor = db.calls.find(query)
        expired_calls = await cursor.to_list(length=500)

        if not expired_calls:
            logger.info(f"[cleanup] No expired recordings (> {days} days) found to purge.")
            return 0

        logger.info(f"[cleanup] Purging {len(expired_calls)} expired call recordings older than {days} days...")
        storage = self._get_storage_provider()
        cleaned_count = 0

        for doc in expired_calls:
            call_id = doc.get("call_id")
            recording_path = doc.get("recording_path") or f"recordings/{call_id}.wav"

            if storage and recording_path:
                try:
                    await storage.delete_recording(recording_path)
                except Exception as e:
                    logger.warning(f"[cleanup] Failed to delete recording {recording_path} for {call_id}: {e}")

            await db.calls.update_one(
                {"_id": doc["_id"]},
                {
                    "$unset": {"recording_url": "", "recording_path": ""},
                    "$set": {"recording_deleted_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            cleaned_count += 1

        logger.info(f"[cleanup] Successfully purged {cleaned_count} expired recordings.")
        return cleaned_count


call_service = CallService()

