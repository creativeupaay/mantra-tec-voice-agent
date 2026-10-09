"""Call record model — one document per Plivo call."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from modules.identity.model import PyObjectId


class CallCategory(str, Enum):
    """Categorization for calls."""
    SUPPORT = "support"
    SALES = "sales"
    BOOKING = "booking"
    INQUIRY = "inquiry"
    FEEDBACK = "feedback"
    COMPLAINT = "complaint"
    TECHNICAL = "technical"
    BILLING = "billing"


class CallStatus(str, Enum):
    LIVE = "live"
    RESOLVED = "resolved"
    ESCALATED = "escalated"
    MISSED = "missed"
    CALLBACK_REQUIRED = "callback_required"


class Call(BaseModel):
    """A single call record stored after the call completes."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    call_id: str              # Plivo call UUID — unique
    caller_name: Optional[str] = None  # Resolved from CRM / phone lookup
    phone_number: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration: Optional[int] = None        # seconds
    status: CallStatus = CallStatus.LIVE
    is_red_flag: bool = False
    transcript: Optional[str] = None      # full turn-by-turn transcript
    call_summary: Optional[str] = None    # LLM-generated summary
    detected_intent: Optional[str] = None # e.g. "support", "booking", "query"
    call_category: Optional[CallCategory] = CallCategory.INQUIRY  # Structured category from enum
    call_outcome: Optional[str] = None    # e.g. "ticket_created", "booking_made"
    recording_url: Optional[str] = None   # URL to the call recording (presigned or local)
    recording_path: Optional[str] = None  # Storage path/key for the recording
    # Red flag fields
    is_red_flagged: bool = False
    red_flag_reason: Optional[str] = None
    guardrail_triggered: Optional[str] = None
    # Reviewed / Read fields
    is_reviewed: bool = False
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class CallCreate(BaseModel):
    call_id: str
    caller_name: Optional[str] = None
    phone_number: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CallUpdate(BaseModel):
    caller_name: Optional[str] = None
    phone_number: Optional[str] = None
    duration: Optional[int] = None
    status: Optional[CallStatus] = None
    is_red_flag: Optional[bool] = None
    transcript: Optional[str] = None
    call_summary: Optional[str] = None
    detected_intent: Optional[str] = None
    call_category: Optional[CallCategory] = None
    call_outcome: Optional[str] = None
    recording_url: Optional[str] = None
    recording_path: Optional[str] = None
    is_red_flagged: Optional[bool] = None
    red_flag_reason: Optional[str] = None
    guardrail_triggered: Optional[str] = None
    is_reviewed: Optional[bool] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None


class CallRecording(BaseModel):
    """Model for call recording data."""
    call_id: str
    file_content: bytes
    content_type: str = "audio/mpeg"
    metadata: Optional[dict] = None