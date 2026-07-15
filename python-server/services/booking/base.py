"""Consultation booking service — abstract interface + stub implementation.

Phase 1: StubBookingService raises NotImplementedError.
Phase 3: Replace with real calendar integration (Google Calendar or Zoho Bookings).

Open Decision (see implementation_plan.md):
  Single shared calendar vs. per-team-member calendars?
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional


@dataclass
class TimeSlot:
    start: datetime
    end: datetime
    available: bool


@dataclass
class BookingResult:
    booking_id: str
    start: datetime
    end: datetime
    confirmation_code: str


class BaseBookingService(ABC):
    """Abstract interface for consultation booking.

    All agent booking tools reference this interface only.
    """

    @abstractmethod
    async def check_availability(
        self, date: datetime, duration_minutes: int = 30
    ) -> List[TimeSlot]: ...

    @abstractmethod
    async def book_consultation(
        self,
        phone_number: str,
        name: str,
        slot_start: datetime,
        duration_minutes: int = 30,
        notes: Optional[str] = None,
    ) -> BookingResult: ...

    @abstractmethod
    async def cancel_booking(self, booking_id: str) -> bool: ...

    @abstractmethod
    async def reschedule_booking(
        self, booking_id: str, new_slot_start: datetime
    ) -> BookingResult: ...


class StubBookingService(BaseBookingService):
    """Placeholder booking service — raises NotImplementedError until Phase 3."""

    async def check_availability(
        self, date: datetime, duration_minutes: int = 30
    ) -> List[TimeSlot]:
        raise NotImplementedError("Booking service not yet configured — Phase 3")

    async def book_consultation(
        self,
        phone_number: str,
        name: str,
        slot_start: datetime,
        duration_minutes: int = 30,
        notes: Optional[str] = None,
    ) -> BookingResult:
        raise NotImplementedError("Booking service not yet configured — Phase 3")

    async def cancel_booking(self, booking_id: str) -> bool:
        raise NotImplementedError("Booking service not yet configured — Phase 3")

    async def reschedule_booking(
        self, booking_id: str, new_slot_start: datetime
    ) -> BookingResult:
        raise NotImplementedError("Booking service not yet configured — Phase 3")


# Active booking implementation — swap in Phase 3
booking_service: BaseBookingService = StubBookingService()
