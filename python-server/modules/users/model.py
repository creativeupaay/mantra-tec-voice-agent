"""User model — system users with roles and authentication."""

from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from modules.identity.model import PyObjectId


class UserRole(str, Enum):
    """User roles in the system."""
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    USER = "user"


class User(BaseModel):
    """System user with authentication and authorization."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    email: str
    name: str
    password_hash: str
    role: UserRole = UserRole.USER
    credit_balance: int = 0
    is_active: bool = True
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class UserCreate(BaseModel):
    email: str
    name: str
    password: str  # Plain text, will be hashed
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[UserRole] = None
    credit_balance: Optional[int] = None
    is_active: Optional[bool] = None
    last_login_at: Optional[datetime] = None