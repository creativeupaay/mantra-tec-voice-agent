"""Calls service — business logic for call lifecycle management."""

from modules.calls.model import CallCategory
from typing import List, Optional

from config.database import get_db
from modules.calls.model import Call, CallCreate, CallUpdate, CallRecording
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
            region=settings.recording_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            endpoint_url=settings.s3_endpoint_url,
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
        recording_url: Optional[str] = None,
        recording_path: Optional[str] = None,
        is_red_flagged: Optional[bool] = None,
        red_flag_reason: Optional[str] = None,
        guardrail_triggered: Optional[str] = None,
    ) -> Optional[Call]:
        """Persist post-call data once the post-call pipeline completes."""
        return await self._repo().update(
            call_id,
            CallUpdate(
                duration=duration,
                transcript=transcript,
                call_summary=summary,
                detected_intent=intent,
                call_category=call_category,
                call_outcome=outcome,
                recording_url=recording_url,
                recording_path=recording_path,
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


call_service = CallService()
