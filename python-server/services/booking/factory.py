"""Booking factory — selects the right provider based on configuration.

If BOOKING_ENABLED=false, it uses the stub (which gracefully logs/accepts).
If BOOKING_PROVIDER="google_calendar", it attempts to load Google Calendar.
"""

from loguru import logger

from env_config import settings
from services.booking.base import BaseBookingService, StubBookingService


def _create_booking_service() -> BaseBookingService:
    if not settings.booking_enabled:
        logger.info("[booking] Booking disabled (BOOKING_ENABLED=false) — using stub")
        return StubBookingService()

    provider = (settings.booking_provider or "").lower().strip()

    if provider == "google_calendar":
        try:
            from services.booking.google_calendar import GoogleCalendarService
            logger.info("[booking] Using Google Calendar provider")
            return GoogleCalendarService()
        except ImportError as e:
            logger.warning(f"[booking] Google API client missing ({e}) — falling back to stub")
        except ValueError as e:
            logger.warning(f"[booking] Google Calendar config error ({e}) — falling back to stub")

    elif provider:
        logger.warning(f"[booking] Unknown BOOKING_PROVIDER '{provider}' — falling back to stub")
        
    else:
        logger.info("[booking] No BOOKING_PROVIDER set — using stub")

    return StubBookingService()


booking_service: BaseBookingService = _create_booking_service()
