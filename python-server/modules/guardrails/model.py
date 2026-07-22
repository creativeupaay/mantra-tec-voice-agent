"""Guardrails configuration for the voice agent.

Guardrails prevent disclosure of sensitive information and provide predefined
responses for specific trigger topics. Configurable via GUARDRAILS_JSON env var.
"""

import json
import os
from typing import Optional


class Guardrail:
    """A single guardrail rule."""
    trigger: str
    response: Optional[str]
    is_block: bool  # If True, block and use response; if False, just flag

    def __init__(self, trigger: str, response: Optional[str] = None, is_block: bool = True):
        self.trigger = trigger.lower()
        self.response = response
        self.is_block = is_block


# Default guardrails - can be overridden via GUARDRAILS_JSON env var
DEFAULT_GUARDRAILS: list[dict] = [
    {
        "trigger": "password",
        "response": "I cannot share or discuss passwords. Please contact support for account-related issues.",
        "is_block": True,
    },
    {
        "trigger": "api key",
        "response": "I cannot disclose API keys. You can find them in your developer portal.",
        "is_block": True,
    },
    {
        "trigger": "secret",
        "response": "I cannot discuss internal secrets or confidential information.",
        "is_block": True,
    },
    {
        "trigger": "competitor",
        "response": None,  # Flag only, no auto-response
        "is_block": False,
    },
    {
        "trigger": "politics",
        "response": None,
        "is_block": False,
    },
    {
        "trigger": "religion",
        "response": None,
        "is_block": False,
    },
    {
        "trigger": "salary",
        "response": "I cannot discuss internal salary or compensation details.",
        "is_block": True,
    },
    {
        "trigger": "financials",
        "response": "I cannot share internal financial information.",
        "is_block": True,
    },
]


def load_guardrails() -> list[Guardrail]:
    """Load guardrails from environment or use defaults."""
    guardrails_json = os.getenv("GUARDRAILS_JSON", "")

    if guardrails_json:
        try:
            guardrails_data = json.loads(guardrails_json)
            return [
                Guardrail(
                    trigger=g.get("trigger", ""),
                    response=g.get("response"),
                    is_block=g.get("is_block", True),
                )
                for g in guardrails_data
            ]
        except json.JSONDecodeError:
            pass

    return [Guardrail(**g) for g in DEFAULT_GUARDRAILS]


def format_guardrails_prompt(guardrails: list[Guardrail]) -> str:
    """Format guardrails for injection into system prompt."""
    if not guardrails:
        return ""

    sections = ["## Guardrails (Apply These Rules)"]

    blocked = [g for g in guardrails if g.is_block and g.response]
    flagged = [g for g in guardrails if not g.is_block]

    if blocked:
        sections.append("\n### Blocked Topics - DO NOT DISCUSS")
        for g in blocked:
            sections.append(f'- **{g.trigger.capitalize()}**: "{g.response}"')

    if flagged:
        sections.append("\n### Sensitive Topics - Flag for Review")
        for g in flagged:
            sections.append(f"- '{g.trigger}' — detect and note in call_summary if mentioned")

    return "\n".join(sections)


# Global guardrails instance
_guardrails: Optional[list[Guardrail]] = None


def get_guardrails() -> list[Guardrail]:
    """Get the global guardrails instance (lazy load)."""
    global _guardrails
    if _guardrails is None:
        _guardrails = load_guardrails()
    return _guardrails


def check_guardrail(text: str) -> Optional[Guardrail]:
    """Check if text triggers any guardrail."""
    text_lower = text.lower()
    for guardrail in get_guardrails():
        if guardrail.trigger in text_lower:
            return guardrail
    return None