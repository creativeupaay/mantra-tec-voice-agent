"""Google Calendar implementation for consultation booking.

Uses a Service Account to manage a single shared Google Calendar.
Prerequisites:
  1. Google Cloud Project with Google Calendar API enabled.
  2. Service Account created, keys downloaded as JSON.
  3. A target Calendar ID shared with the Service Account (Make changes to events).
  4. BOOKING_PROVIDER="google_calendar" in .env
  5. GOOGLE_CALENDAR_ID="..." in .env
  6. GOOGLE_SERVICE_ACCOUNT_JSON="path/to/credentials.json"
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from loguru import logger

from env_config import settings
from services.booking.base import BaseBookingService, BookingResult, TimeSlot


class GoogleCalendarService(BaseBookingService):
    """Books appointments on a single shared Google Calendar."""

    def __init__(self):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError:
            raise ImportError(
                "Google API client not installed. Run: uv add google-api-python-client google-auth-httplib2 google-auth-oauthlib"
            )

        self.calendar_id = settings.google_calendar_id
        if not self.calendar_id or not settings.google_service_account_json:
            raise ValueError(
                "Missing GOOGLE_CALENDAR_ID or GOOGLE_SERVICE_ACCOUNT_JSON in environment."
            )

        creds = service_account.Credentials.from_service_account_file(
            settings.google_service_account_json,
            scopes=["https://www.googleapis.com/auth/calendar.events"],
        )
        self.service = build("calendar", "v3", credentials=creds)

    async def check_availability(
        self, date: datetime, duration_minutes: int = 30
    ) -> List[TimeSlot]:
        """Check free/busy on the given date (simplified stub for now)."""
        # In a full implementation, call freebusy.query
        # Returning a simplified available slot list based on 9 AM to 5 PM
        # for demonstration.
        slots = []
        # Normalise to start of day
        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        for hour in range(9, 17):
            slot_start = start_of_day + timedelta(hours=hour)
            slot_end = slot_start + timedelta(minutes=duration_minutes)
            slots.append(TimeSlot(start=slot_start, end=slot_end, available=True))
        return slots

    async def book_consultation(
        self,
        phone_number: str,
        name: str,
        slot_start: datetime,
        duration_minutes: int = 30,
        notes: Optional[str] = None,
    ) -> BookingResult:
        slot_end = slot_start + timedelta(minutes=duration_minutes)
        confirmation_code = str(uuid.uuid4())[:8].upper()

        event = {
            "summary": f"Consultation: {name}",
            "description": f"Phone: {phone_number}\nNotes: {notes or 'None'}\nCode: {confirmation_code}",
            "start": {
                "dateTime": slot_start.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": slot_end.isoformat(),
                "timeZone": "UTC",
            },
        }

        try:
            # Note: The googleapiclient is synchronous, in a real async environment
            # this should be wrapped in run_in_executor
            import asyncio
            loop = asyncio.get_running_loop()
            
            def _insert():
                return self.service.events().insert(
                    calendarId=self.calendar_id, body=event
                ).execute()

            created_event = await loop.run_in_executor(None, _insert)
            
            logger.info(f"[booking] Google Calendar event created: {created_event.get('id')}")

            return BookingResult(
                booking_id=created_event.get("id", ""),
                start=slot_start,
                end=slot_end,
                confirmation_code=confirmation_code,
            )
        except Exception as e:
            logger.error(f"[booking] Google Calendar API error: {e}")
            raise RuntimeError(f"Failed to book on Google Calendar: {e}")

    async def cancel_booking(self, booking_id: str) -> bool:
        import asyncio
        loop = asyncio.get_running_loop()
        def _delete():
            self.service.events().delete(
                calendarId=self.calendar_id, eventId=booking_id
            ).execute()
            
        try:
            await loop.run_in_executor(None, _delete)
            return True
        except Exception as e:
            logger.error(f"[booking] Failed to cancel {booking_id}: {e}")
            return False

    async def reschedule_booking(
        self, booking_id: str, new_slot_start: datetime
    ) -> BookingResult:
        raise NotImplementedError("Rescheduling not yet implemented in Google Calendar provider.")
