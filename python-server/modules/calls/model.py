"""Call record model — one document per Plivo call."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from modules.identity.model import PyObjectId


class Call(BaseModel):
    """A single call record stored after the call completes."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    call_id: str              # Plivo call UUID — unique
    phone_number: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration: Optional[int] = None        # seconds
    transcript: Optional[str] = None      # full turn-by-turn transcript
    call_summary: Optional[str] = None    # LLM-generated summary
    detected_intent: Optional[str] = None # e.g. "support", "booking", "query"
    call_outcome: Optional[str] = None    # e.g. "ticket_created", "booking_made"

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class CallCreate(BaseModel):
    call_id: str
    phone_number: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CallUpdate(BaseModel):
    duration: Optional[int] = None
    transcript: Optional[str] = None
    call_summary: Optional[str] = None
    detected_intent: Optional[str] = None
    call_outcome: Optional[str] = None
