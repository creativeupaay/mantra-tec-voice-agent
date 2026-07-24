"""Estimated USD pricing for voice-agent API usage.

Rates are approximate public list prices (pay-as-you-go). They are used for
cost visibility in the Usage dashboard — not for exact vendor invoices.
Amounts are rounded to 6 decimal places (fractional cents).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


def _round_usd(value: float) -> float:
    return round(max(0.0, value), 6)


@dataclass(frozen=True)
class CostEstimate:
    """Result of a cost calculation with enough detail for the UI."""

    estimated_usd: float
    billing_unit: str
    calculation: str
    rates: dict
    metadata: dict


# ── Published-ish list rates (USD) ────────────────────────────────────────────
# Gemini 2.x Flash text (input / output per 1M tokens)
GEMINI_INPUT_PER_MTOK = 0.10
GEMINI_OUTPUT_PER_MTOK = 0.40

# Gemini Live / realtime — when only audio duration is known
# Rough blended estimate covering input+output audio for the session.
GEMINI_LIVE_PER_MINUTE = 0.035

# OpenRouter mid-tier default (Claude-ish); override via model-specific later if needed
OPENROUTER_INPUT_PER_MTOK = 3.00
OPENROUTER_OUTPUT_PER_MTOK = 15.00

# Deepgram Nova-2 streaming STT
DEEPGRAM_STT_PER_MINUTE = 0.0043

# TTS character rates (per 1,000 characters)
DEEPGRAM_TTS_PER_1K_CHARS = 0.015
CARTESIA_TTS_PER_1K_CHARS = 0.022
ELEVENLABS_TTS_PER_1K_CHARS = 0.12

# Plivo voice (approx. inbound / connected minute)
PLIVO_PER_MINUTE = 0.0085


def estimate_llm_cost(
    service: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> CostEstimate:
    """Estimate LLM cost from token counts."""
    service = (service or "gemini").lower()
    prompt_tokens = max(0, int(prompt_tokens or 0))
    completion_tokens = max(0, int(completion_tokens or 0))
    total_tokens = prompt_tokens + completion_tokens

    if service == "openrouter":
        in_rate, out_rate = OPENROUTER_INPUT_PER_MTOK, OPENROUTER_OUTPUT_PER_MTOK
    else:
        # gemini (default) and any other LLM routed through Gemini
        in_rate, out_rate = GEMINI_INPUT_PER_MTOK, GEMINI_OUTPUT_PER_MTOK
        service = "gemini" if service not in {"gemini", "openrouter"} else service

    usd = (prompt_tokens / 1_000_000) * in_rate + (completion_tokens / 1_000_000) * out_rate
    usd = _round_usd(usd)

    return CostEstimate(
        estimated_usd=usd,
        billing_unit="tokens",
        calculation=(
            f"({prompt_tokens}/1M)×${in_rate} + ({completion_tokens}/1M)×${out_rate}"
        ),
        rates={"input_per_mtok": in_rate, "output_per_mtok": out_rate},
        metadata={
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            # Aliases expected by UsagePage / Node types
            "tokens_prompt": prompt_tokens,
            "tokens_completion": completion_tokens,
            "estimated_usd": usd,
            "billing_unit": "tokens",
        },
    )


def estimate_tts_cost(service: str, characters: int) -> CostEstimate:
    """Estimate TTS cost from character count."""
    service = (service or "deepgram").lower()
    characters = max(0, int(characters or 0))

    rate_map = {
        "deepgram": DEEPGRAM_TTS_PER_1K_CHARS,
        "cartesia": CARTESIA_TTS_PER_1K_CHARS,
        "elevenlabs": ELEVENLABS_TTS_PER_1K_CHARS,
    }
    rate = rate_map.get(service, DEEPGRAM_TTS_PER_1K_CHARS)
    if service not in rate_map:
        service = "deepgram"

    usd = _round_usd((characters / 1000.0) * rate)

    return CostEstimate(
        estimated_usd=usd,
        billing_unit="characters",
        calculation=f"({characters}/1000)×${rate}",
        rates={"per_1k_chars": rate},
        metadata={
            "characters": characters,
            "estimated_usd": usd,
            "billing_unit": "characters",
            "rate_per_1k_chars": rate,
        },
    )


def estimate_stt_cost(duration_seconds: float, service: str = "deepgram") -> CostEstimate:
    """Estimate STT cost from call audio duration."""
    minutes = max(0.0, float(duration_seconds or 0)) / 60.0
    rate = DEEPGRAM_STT_PER_MINUTE
    usd = _round_usd(minutes * rate)

    return CostEstimate(
        estimated_usd=usd,
        billing_unit="minutes",
        calculation=f"({minutes:.4f} min)×${rate}/min",
        rates={"per_minute": rate},
        metadata={
            "duration_seconds": round(float(duration_seconds or 0), 2),
            "duration_minutes": round(minutes, 4),
            "estimated_usd": usd,
            "billing_unit": "minutes",
            "rate_per_minute": rate,
            "service": service,
        },
    )


def estimate_plivo_cost(duration_seconds: float) -> CostEstimate:
    """Estimate Plivo telephony cost from connected duration."""
    minutes = max(0.0, float(duration_seconds or 0)) / 60.0
    rate = PLIVO_PER_MINUTE
    usd = _round_usd(minutes * rate)

    return CostEstimate(
        estimated_usd=usd,
        billing_unit="minutes",
        calculation=f"({minutes:.4f} min)×${rate}/min",
        rates={"per_minute": rate},
        metadata={
            "duration_seconds": round(float(duration_seconds or 0), 2),
            "duration_minutes": round(minutes, 4),
            "estimated_usd": usd,
            "billing_unit": "minutes",
            "rate_per_minute": rate,
        },
    )


def estimate_gemini_live_audio_cost(duration_seconds: float) -> CostEstimate:
    """Fallback Gemini Live cost when token metrics are unavailable."""
    minutes = max(0.0, float(duration_seconds or 0)) / 60.0
    rate = GEMINI_LIVE_PER_MINUTE
    usd = _round_usd(minutes * rate)

    return CostEstimate(
        estimated_usd=usd,
        billing_unit="minutes",
        calculation=f"({minutes:.4f} min)×${rate}/min (live audio blend)",
        rates={"per_minute": rate},
        metadata={
            "duration_seconds": round(float(duration_seconds or 0), 2),
            "duration_minutes": round(minutes, 4),
            "estimated_usd": usd,
            "billing_unit": "minutes",
            "rate_per_minute": rate,
            "note": "Duration-based estimate; prefer token metrics when available",
        },
    )


def estimate_tokens_from_text(text: str, overhead: int = 200) -> int:
    """Rough token estimate: ~4 characters per token + fixed overhead."""
    if not text:
        return overhead
    return overhead + max(1, len(text) // 4)


def extract_gemini_usage(response) -> tuple[int, int, Optional[int]]:
    """Pull prompt/completion token counts from a google-genai response if present."""
    usage = getattr(response, "usage_metadata", None)
    if usage is None:
        return 0, 0, None

    prompt = int(
        getattr(usage, "prompt_token_count", None)
        or getattr(usage, "prompt_tokens", None)
        or 0
    )
    completion = int(
        getattr(usage, "candidates_token_count", None)
        or getattr(usage, "completion_tokens", None)
        or 0
    )
    total = getattr(usage, "total_token_count", None)
    total_i = int(total) if total is not None else (prompt + completion or None)
    return prompt, completion, total_i
