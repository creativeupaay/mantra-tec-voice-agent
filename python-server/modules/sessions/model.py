"""Session model for voice agent call sessions."""

from datetime import datetime
from typing import Optional
from enum import Enum
from pydantic import BaseModel, Field
from modules.identity.model import PyObjectId


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    TRANSFERRED = "transferred"


class Session(BaseModel):
    """Voice agent call session."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    call_id: str  # Plivo call UUID
    agent_id: Optional[PyObjectId] = None
    user_id: Optional[PyObjectId] = None
    phone_number: str
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    duration: Optional[int] = None  # seconds
    status: SessionStatus = SessionStatus.ACTIVE
    transcript: Optional[str] = None
    call_summary: Optional[str] = None
    recording_url: Optional[str] = None
    credit_cost: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class SessionCreate(BaseModel):
    call_id: str
    agent_id: Optional[PyObjectId] = None
    user_id: Optional[PyObjectId] = None
    phone_number: str


class SessionUpdate(BaseModel):
    end_time: Optional[datetime] = None
    duration: Optional[int] = None
    status: Optional[SessionStatus] = None
    transcript: Optional[str] = None
    call_summary: Optional[str] = None
    recording_url: Optional[str] = None
    credit_cost: Optional[int] = None