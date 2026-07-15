"""Identity service — business logic for caller identity management."""

from datetime import datetime
from typing import Optional

from config.database import get_db
from modules.identity.model import Identity, IdentityCreate, IdentityUpdate
from modules.identity.repository import IdentityRepository


class IdentityService:
    """All identity business logic. Consumers import the singleton below."""

    def _repo(self) -> IdentityRepository:
        return IdentityRepository(get_db())

    async def get_or_create(
        self, phone_number: str, name: Optional[str] = None
    ) -> Identity:
        """Return the existing identity or create a fresh one for this phone number."""
        return await self._repo().upsert(
            IdentityCreate(phone_number=phone_number, name=name)
        )

    async def get_by_phone(self, phone_number: str) -> Optional[Identity]:
        return await self._repo().find_by_phone(phone_number)

    async def update_after_call(
        self,
        phone_number: str,
        *,
        name: Optional[str] = None,
        agent_notes: Optional[str] = None,
        profile_summary: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Optional[Identity]:
        """Stamp the identity after a call ends."""
        return await self._repo().update(
            phone_number,
            IdentityUpdate(
                name=name,
                last_call_at=datetime.utcnow(),
                agent_notes=agent_notes,
                customer_profile_summary=profile_summary,
                preferred_language=language,
            ),
        )

    async def update_profile(
        self, phone_number: str, data: IdentityUpdate
    ) -> Optional[Identity]:
        return await self._repo().update(phone_number, data)

    async def add_call_discussion(self, phone_number: str, call_summary: str) -> None:
        """Append a call summary to the identity's previous discussions list."""
        await self._repo().append_to_array(phone_number, "previous_discussions", call_summary)


identity_service = IdentityService()
