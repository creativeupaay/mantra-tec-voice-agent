"""Identity data model — one record per phone number.

A caller may be a Lead, Contact, and Support User simultaneously.
We do not classify callers into a single type.
"""

from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, Field
from pydantic.functional_validators import BeforeValidator
from typing import Annotated, Any, List, Optional

def validate_object_id(v: Any) -> str:
    if not ObjectId.is_valid(v):
        raise ValueError(f"Invalid ObjectId: {v!r}")
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


class Identity(BaseModel):
    """A caller identity keyed by phone number."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    phone_number: str
    name: Optional[str] = None
    preferred_language: str = "hinglish"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_call_at: Optional[datetime] = None
    agent_notes: Optional[str] = None
    customer_profile_summary: Optional[str] = None
    common_issues: List[str] = Field(default_factory=list)
    previous_discussions: List[str] = Field(default_factory=list)
    special_notes: Optional[str] = None
    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class IdentityCreate(BaseModel):
    phone_number: str
    name: Optional[str] = None
    preferred_language: str = "hinglish"


class IdentityUpdate(BaseModel):
    name: Optional[str] = None
    preferred_language: Optional[str] = None
    last_call_at: Optional[datetime] = None
    agent_notes: Optional[str] = None
    customer_profile_summary: Optional[str] = None
    common_issues: Optional[List[str]] = None
    previous_discussions: Optional[List[str]] = None
    special_notes: Optional[str] = None
