"""Credit Tracker — Real-time credit usage tracking during voice calls.

This module provides a lightweight frame processor that tracks credit usage
for STT, LLM, and TTS services during live calls without adding latency.

Costs are estimated in USD from published list rates (see credit_usage.pricing).
"""

import asyncio
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    MetricsFrame,
)
from pipecat.metrics.metrics import MetricsData, LLMUsageMetricsData, TTSUsageMetricsData
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from agent.state import CallState


class CreditTracker(FrameProcessor):
    """Lightweight frame processor that tracks credit usage from Pipecat metrics.

    Listens for MetricsFrame containing LLM/TTS usage data and records
    estimated USD cost to the database asynchronously (non-blocking).
    """

    def __init__(self, state: CallState):
        super().__init__()
        self.state = state
        self._pending_tasks: set[asyncio.Task] = set()
        # Accumulate totals so post-call can skip duplicate duration fallbacks
        self.state.llm_tokens_tracked = 0
        self.state.tts_chars_tracked = 0

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, MetricsFrame) and direction == FrameDirection.UPSTREAM:
            for metric_data in frame.data:
                self._handle_metric(metric_data)

        await self.push_frame(frame, direction)

    def _handle_metric(self, metric: MetricsData):
        """Process a single metric and record credit usage if applicable."""
        try:
            if isinstance(metric, LLMUsageMetricsData):
                tokens = metric.value
                prompt_tokens = int(getattr(tokens, "prompt_tokens", 0) or 0)
                completion_tokens = int(getattr(tokens, "completion_tokens", 0) or 0)
                total_tokens = int(
                    getattr(tokens, "total_tokens", None)
                    or (prompt_tokens + completion_tokens)
                    or 0
                )

                if total_tokens > 0:
                    processor = (metric.processor or "").lower()
                    service = self._determine_llm_service(processor)
                    self.state.llm_tokens_tracked = (
                        getattr(self.state, "llm_tokens_tracked", 0) + total_tokens
                    )

                    task = asyncio.create_task(
                        self._record_llm_usage(
                            service, prompt_tokens, completion_tokens, total_tokens
                        )
                    )
                    self._pending_tasks.add(task)
                    task.add_done_callback(self._pending_tasks.discard)

            elif isinstance(metric, TTSUsageMetricsData):
                chars = int(metric.value or 0)
                if chars > 0:
                    processor = (metric.processor or "").lower()
                    service = self._determine_tts_service(processor)
                    self.state.tts_chars_tracked = (
                        getattr(self.state, "tts_chars_tracked", 0) + chars
                    )

                    task = asyncio.create_task(
                        self._record_tts_usage(service, chars)
                    )
                    self._pending_tasks.add(task)
                    task.add_done_callback(self._pending_tasks.discard)

        except Exception as e:
            logger.debug(f"[credit-tracker] Error processing metric: {e}")

    def _resolve_db_call_id(self) -> str | None:
        """Return the MongoDB Call `_id` used by CreditUsage.call_id refs."""
        return getattr(self.state, "db_call_id", None)

    def _determine_llm_service(self, processor: str) -> str:
        """Map processor name to our ServiceType."""
        if "openrouter" in processor:
            return "openrouter"
        if "gemini" in processor or "google" in processor:
            return "gemini"
        return "gemini"

    def _determine_tts_service(self, processor: str) -> str:
        """Map processor name to our ServiceType."""
        if "cartesia" in processor:
            return "cartesia"
        if "elevenlabs" in processor or "eleven" in processor:
            return "elevenlabs"
        if "deepgram" in processor:
            return "deepgram"
        return "deepgram"

    def _service_enum(self, service: str, fallback: str):
        from modules.credit_usage.model import ServiceType

        try:
            return ServiceType[(service or fallback).upper()]
        except KeyError:
            return ServiceType[fallback.upper()]

    async def _record_llm_usage(
        self,
        service: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
    ):
        """Record LLM token usage as estimated USD."""
        try:
            from modules.credit_usage.service import get_credit_usage_service
            from modules.credit_usage.pricing import estimate_llm_cost
            from modules.identity.model import PyObjectId

            db_call_id = self._resolve_db_call_id()
            if not db_call_id:
                return

            estimate = estimate_llm_cost(service, prompt_tokens, completion_tokens)
            # Avoid zero-dollar rows that hide activity — keep a tiny floor only when
            # tokens exist but round to 0 at 6dp (extremely rare).
            amount = estimate.estimated_usd if estimate.estimated_usd > 0 else 0.000001

            await get_credit_usage_service().record_usage(
                call_id=PyObjectId(db_call_id),
                amount=amount,
                description=(
                    f"LLM ({service}) — {total_tokens:,} tokens "
                    f"({prompt_tokens:,} in / {completion_tokens:,} out) "
                    f"≈ ${amount:.6f}"
                ),
                service=self._service_enum(service, "gemini"),
                metadata={
                    "plivo_call_id": self.state.call_id,
                    "service": service,
                    "api": "llm",
                    "calculation": estimate.calculation,
                    "rates": estimate.rates,
                    **estimate.metadata,
                },
            )
            logger.info(
                f"[credit-tracker] LLM ({service}): {total_tokens} tokens → ${amount:.6f}"
            )
        except Exception as e:
            logger.debug(f"[credit-tracker] Failed to record LLM usage: {e}")

    async def _record_tts_usage(self, service: str, chars: int):
        """Record TTS character usage as estimated USD."""
        try:
            from modules.credit_usage.service import get_credit_usage_service
            from modules.credit_usage.pricing import estimate_tts_cost
            from modules.identity.model import PyObjectId

            db_call_id = self._resolve_db_call_id()
            if not db_call_id:
                return

            estimate = estimate_tts_cost(service, chars)
            amount = estimate.estimated_usd if estimate.estimated_usd > 0 else 0.000001

            await get_credit_usage_service().record_usage(
                call_id=PyObjectId(db_call_id),
                amount=amount,
                description=(
                    f"TTS ({service}) — {chars:,} chars ≈ ${amount:.6f}"
                ),
                service=self._service_enum(service, "deepgram"),
                metadata={
                    "plivo_call_id": self.state.call_id,
                    "service": service,
                    "api": "tts",
                    "calculation": estimate.calculation,
                    "rates": estimate.rates,
                    **estimate.metadata,
                },
            )
            logger.info(
                f"[credit-tracker] TTS ({service}): {chars} chars → ${amount:.6f}"
            )
        except Exception as e:
            logger.debug(f"[credit-tracker] Failed to record TTS usage: {e}")

    async def cleanup(self):
        """Wait for any pending credit recording tasks to complete."""
        if self._pending_tasks:
            await asyncio.gather(*self._pending_tasks, return_exceptions=True)
            self._pending_tasks.clear()


def create_credit_tracker(state: CallState) -> CreditTracker:
    """Factory function to create a CreditTracker for the pipeline."""
    return CreditTracker(state)
