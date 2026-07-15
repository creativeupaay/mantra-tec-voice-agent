"""Booking package — exports the active service singleton."""

from services.booking.factory import booking_service

__all__ = ["booking_service"]
