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


class ServiceType(str, Enum):
    """Services that consume credits."""
    PLIVO = "plivo"
    DEEPGRAM = "deepgram"
    ELEVENLABS = "elevenlabs"
    CARTESIA = "cartesia"
    OPENROUTER = "openrouter"
    GEMINI = "gemini"
    PLATFORM = "platform"


class CreditUsage(BaseModel):
    """Credit usage record - tracks consumption, purchases, and refunds."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    call_id: PyObjectId
    amount: float = Field(
        ...,
        description="Estimated USD amount (negative for usage deductions, positive for purchase/refund)",
    )
    description: str
    type: CreditType
    # Service is required for 'usage' type to track which API consumed credits
    service: Optional[ServiceType] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")
    updated_at: datetime = Field(default_factory=datetime.utcnow, alias="updatedAt")

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class CreditUsageCreate(BaseModel):
    call_id: PyObjectId
    amount: float
    description: str
    type: CreditType
    service: Optional[ServiceType] = None
    metadata: Optional[dict] = None


class CreditUsageUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    type: Optional[CreditType] = None
    service: Optional[ServiceType] = None
    metadata: Optional[dict] = None