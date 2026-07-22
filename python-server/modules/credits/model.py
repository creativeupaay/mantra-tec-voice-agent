"""Credit Usage model — tracks credit transactions for users."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from bson import ObjectId
from pydantic import BaseModel, Field
from pydantic.functional_validators import BeforeValidator
from typing import Annotated


def validate_object_id(v: Any) -> str:
    if not ObjectId.is_valid(v):
        raise ValueError(f"Invalid ObjectId: {v!r}")
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


class CreditType(str, Enum):
    USAGE = "usage"
    PURCHASE = "purchase"
    REFUND = "refund"


class CreditUsage(BaseModel):
    """Record of credit transaction for a user."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    amount: int
    description: str
    type: CreditType
    metadata: Optional[dict] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class CreditUsageCreate(BaseModel):
    user_id: PyObjectId
    amount: int
    description: str
    type: CreditType
    metadata: Optional[dict] = None


class CreditUsageUpdate(BaseModel):
    amount: Optional[int] = None
    description: Optional[str] = None
    type: Optional[CreditType] = None
    metadata: Optional[dict] = None