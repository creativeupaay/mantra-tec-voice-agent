"""Consultation booking tool — single shared calendar."""

from datetime import datetime, timezone

from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from services.booking import booking_service

BOOK_SCHEMA = FunctionSchema(
    name="book_consultation",
    description=(
        "Book a consultation call with the Mantra Tech team on the shared calendar. "
        "Ask the caller for their preferred date and time BEFORE calling this tool. "
        "Confirm the details with them before booking."
    ),
    properties={
        "date": {
            "type": "string",
            "description": "Preferred date in YYYY-MM-DD format (e.g. 2026-06-15).",
        },
        "time": {
            "type": "string",
            "description": "Preferred time in HH:MM 24-hour format (e.g. 14:30 for 2:30 PM).",
        },
        "duration_minutes": {
            "type": "integer",
            "description": "Duration of the call in minutes. Default is 30.",
        },
        "notes": {
            "type": "string",
            "description": "Topics or requirements the caller wants to discuss.",
        },
    },
    required=["date", "time"],
)


async def handle_book_consultation(params: FunctionCallParams) -> None:
    state = params.app_resources
    date_str: str = params.arguments.get("date", "")
    time_str: str = params.arguments.get("time", "")
    duration: int = params.arguments.get("duration_minutes", 30)
    notes: str = params.arguments.get("notes", "")

    try:
        slot_start = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        slot_start = slot_start.replace(tzinfo=timezone.utc)
    except ValueError:
        await params.result_callback(
            f"I couldn't understand the date or time '{date_str} {time_str}'. "
            "Please provide the date in YYYY-MM-DD format and time as HH:MM."
        )
        return

    phone = state.phone_number if state else "unknown"
    name = (
        state.identity.name
        if state and state.identity and state.identity.name
        else "Valued Customer"
    )

    try:
        result = await booking_service.book_consultation(
            phone_number=phone,
            name=name,
            slot_start=slot_start,
            duration_minutes=duration,
            notes=notes,
        )
        await params.result_callback(
            f"Consultation booked! Confirmation code: {result.confirmation_code}. "
            f"Scheduled for {result.start.strftime('%d %B %Y at %I:%M %p')} for {duration} minutes."
        )
    except NotImplementedError:
        # Stub is active — Phase 3 will replace with real calendar
        await params.result_callback(
            "I've noted your request for a consultation. "
            f"Our team will contact you at {phone} to confirm the appointment. "
            f"Preferred slot: {date_str} at {time_str}."
        )
    except Exception as e:
        await params.result_callback(f"Could not complete the booking at this time: {e}")
