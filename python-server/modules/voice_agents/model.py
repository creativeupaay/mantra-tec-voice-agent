"""Voice Agent model for voice agent configurations."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from modules.identity.model import PyObjectId


class VoiceAgentStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"


class VoiceAgent(BaseModel):
    """Voice agent configuration for handling calls."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    user_id: Optional[PyObjectId] = None
    status: VoiceAgentStatus = VoiceAgentStatus.DRAFT
    # Configuration
    language: str = "en"
    voice_id: Optional[str] = None
    tts_provider: str = "deepgram"
    stt_provider: str = "deepgram"
    llm_provider: str = "gemini"
    # Prompt configuration
    system_prompt: Optional[str] = None
    greeting_message: Optional[str] = None
    # Tools/integrations
    enabled_tools: List[str] = Field(default_factory=list)
    integration_config: Dict[str, Any] = Field(default_factory=dict)
    # Analytics
    total_calls: int = 0
    total_minutes: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class VoiceAgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    user_id: Optional[PyObjectId] = None
    language: str = "en"
    voice_id: Optional[str] = None
    tts_provider: str = "deepgram"
    stt_provider: str = "deepgram"
    llm_provider: str = "gemini"
    system_prompt: Optional[str] = None
    greeting_message: Optional[str] = None
    enabled_tools: List[str] = Field(default_factory=list)
    integration_config: Dict[str, Any] = Field(default_factory=dict)


class VoiceAgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[VoiceAgentStatus] = None
    language: Optional[str] = None
    voice_id: Optional[str] = None
    tts_provider: Optional[str] = None
    stt_provider: Optional[str] = None
    llm_provider: Optional[str] = None
    system_prompt: Optional[str] = None
    greeting_message: Optional[str] = None
    enabled_tools: Optional[List[str]] = None
    integration_config: Optional[Dict[str, Any]] = None