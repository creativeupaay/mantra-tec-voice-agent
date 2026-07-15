"""Calls service — business logic for call lifecycle management."""

from typing import List, Optional

from config.database import get_db
from modules.calls.model import Call, CallCreate, CallUpdate
from modules.calls.repository import CallRepository


class CallService:
    def _repo(self) -> CallRepository:
        return CallRepository(get_db())

    async def start_call(self, call_id: str, phone_number: str) -> Call:
        """Register the call when it first connects."""
        return await self._repo().create(
            CallCreate(call_id=call_id, phone_number=phone_number)
        )

    async def finalize_call(
        self,
        call_id: str,
        *,
        duration: Optional[int] = None,
        transcript: Optional[str] = None,
        summary: Optional[str] = None,
        intent: Optional[str] = None,
        outcome: Optional[str] = None,
    ) -> Optional[Call]:
        """Persist post-call data once the post-call pipeline completes."""
        return await self._repo().update(
            call_id,
            CallUpdate(
                duration=duration,
                transcript=transcript,
                call_summary=summary,
                detected_intent=intent,
                call_outcome=outcome,
            ),
        )

    async def get_recent_calls(
        self, phone_number: str, limit: int = 3
    ) -> List[Call]:
        return await self._repo().find_recent_by_phone(phone_number, limit)

    async def get_call(self, call_id: str) -> Optional[Call]:
        return await self._repo().find_by_call_id(call_id)


call_service = CallService()
