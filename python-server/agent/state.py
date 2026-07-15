"""Call state — the central data object for a single active call.

One CallState instance is created per call when the connection opens,
populated in parallel by the context builder, and then referenced
throughout the call by every tool handler.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional

from modules.calls.model import Call
from modules.identity.model import Identity


@dataclass
class CallState:
    """All context available for a single active call."""

    # ── Core identifiers ──────────────────────────────────────────────────────
    call_id: str
    phone_number: str

    # ── Context fetched in parallel on connect ────────────────────────────────
    identity: Optional[Identity] = None
    crm_lead: Optional[dict[str, Any]] = None
    crm_contact: Optional[dict[str, Any]] = None
    open_tickets: List[dict[str, Any]] = field(default_factory=list)
    recent_calls: List[Call] = field(default_factory=list)

    # ── Detected / updated during the call ───────────────────────────────────
    preferred_language: str = "hinglish"   # "en" | "hi" | "hinglish"

    # ── Transcript accumulation (used by post-call pipeline in Phase 4) ───────
    transcript_lines: List[str] = field(default_factory=list)
