"""Credit Usage model for tracking credit consumption."""

from datetime import datetime
from typing import Optional, Literal
from enum import Enum
from pydantic import BaseModel, Field
from modules.identity.model import PyObjectId


class CreditType(str, Enum):
    USAGE = "usage"
    PURCHASE = "purchase"
    REFUND = "refund"


class CreditUsage(BaseModel):
    """Credit usage record - tracks consumption, purchases, and refunds."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    amount: int = Field(..., description="Credit amount (positive for usage/purchase, negative for refund)")
    description: str
    type: CreditType
    metadata: dict = Field(default_factory=dict)
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