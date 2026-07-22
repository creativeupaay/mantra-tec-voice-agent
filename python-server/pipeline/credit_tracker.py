"""Credit Tracker — Real-time credit usage tracking during voice calls.

This module provides a lightweight frame processor that tracks credit usage
for STT, LLM, and TTS services during live calls without adding latency.
"""

import asyncio
from typing import Optional
from loguru import logger
from pipecat.frames.frames import (
    Frame,
    SystemFrame,
    TranscriptionFrame,
    TTSTextFrame,
    LLMFullResponseEndFrame,
    MetricsFrame,
    FrameDirection,
)
from pipecat.metrics.metrics import MetricsData, LLMUsageMetricsData, TTSUsageMetricsData, LLMTokenUsage
from pipecat.processors.frame_processor import FrameProcessor
from agent.state import CallState


class CreditTracker(FrameProcessor):
    """Lightweight frame processor that tracks credit usage from Pipecat metrics.

    Listens for MetricsFrame containing LLM/TTS usage data and records
    credits to the database asynchronously (non-blocking).
    """

    def __init__(self, state: CallState):
        super().__init__()
        self.state = state
        self._pending_tasks: set[asyncio.Task] = set()

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        # Let base class update internal state
        await super().process_frame(frame, direction)

        # Track credit usage from metrics frames (non-blocking)
        if isinstance(frame, MetricsFrame) and direction == FrameDirection.UPSTREAM:
            for metric_data in frame.data:
                self._handle_metric(metric_data)

        # Always forward the frame
        await self.push_frame(frame, direction)

    def _handle_metric(self, metric: MetricsData):
        """Process a single metric and record credit usage if applicable."""
        try:
            # LLM token usage
            if isinstance(metric, LLMUsageMetricsData):
                tokens = metric.value
                prompt_tokens = tokens.prompt_tokens
                completion_tokens = tokens.completion_tokens
                total_tokens = tokens.total_tokens
                
                if total_tokens > 0:
                    # Determine which LLM service based on processor name
                    processor = metric.processor.lower()
                    service = self._determine_llm_service(processor)
                    
                    # Schedule async credit recording (don't await - non-blocking)
                    task = asyncio.create_task(
                        self._record_llm_usage(service, prompt_tokens, completion_tokens, total_tokens)
                    )
                    self._pending_tasks.add(task)
                    task.add_done_callback(self._pending_tasks.discard)

            # TTS character usage
            elif isinstance(metric, TTSUsageMetricsData):
                chars = metric.value
                if chars > 0:
                    processor = metric.processor.lower()
                    service = self._determine_tts_service(processor)
                    
                    task = asyncio.create_task(
                        self._record_tts_usage(service, chars)
                    )
                    self._pending_tasks.add(task)
                    task.add_done_callback(self._pending_tasks.discard)

        except Exception as e:
            logger.debug(f"[credit-tracker] Error processing metric: {e}")

    def _determine_llm_service(self, processor: str) -> str:
        """Map processor name to our ServiceType."""
        if "gemini" in processor:
            return "gemini"
        elif "openrouter" in processor:
            return "openrouter"
        return "gemini"  # default

    def _determine_tts_service(self, processor: str) -> str:
        """Map processor name to our ServiceType."""
        if "cartesia" in processor:
            return "cartesia"
        elif "elevenlabs" in processor:
            return "elevenlabs"
        elif "deepgram" in processor:
            return "deepgram"
        return "deepgram"  # default

    async def _record_llm_usage(self, service: str, prompt_tokens: int, completion_tokens: int, total_tokens: int):
        """Record LLM token usage to credit system."""
        try:
            from modules.credit_usage.service import get_credit_usage_service
            from modules.credit_usage.model import ServiceType
            from modules.identity.model import PyObjectId
            
            user_id = getattr(self.state, 'user_id', None)
            if not user_id:
                return
            
            # Estimate credits: ~1 credit per 1000 tokens (adjustable)
            # This is a rough estimate - adjust based on actual pricing
            credits = max(1, total_tokens // 1000)
            
            # Convert string to ServiceType enum
            try:
                service_enum = ServiceType[service.upper()]
            except KeyError:
                service_enum = ServiceType.GEMINI
            
            await get_credit_usage_service().record_usage(
                user_id=PyObjectId(user_id),
                amount=credits,
                description=f"LLM ({service}) - {total_tokens} tokens",
                service=service_enum,
                metadata={
                    "call_id": self.state.call_id,
                    "service": service,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                }
            )
            logger.info(f"[credit-tracker] Recorded {credits} credits for LLM ({service}): {total_tokens} tokens")
        except Exception as e:
            logger.debug(f"[credit-tracker] Failed to record LLM usage: {e}")

    async def _record_tts_usage(self, service: str, chars: int):
        """Record TTS character usage to credit system."""
        try:
            from modules.credit_usage.service import get_credit_usage_service
            from modules.credit_usage.model import ServiceType
            from modules.identity.model import PyObjectId
            
            user_id = getattr(self.state, 'user_id', None)
            if not user_id:
                return
            
            # Estimate credits: ~1 credit per 1000 characters
            credits = max(1, chars // 1000)
            
            try:
                service_enum = ServiceType[service.upper()]
            except KeyError:
                service_enum = ServiceType.DEEPGRAM
            
            await get_credit_usage_service().record_usage(
                user_id=PyObjectId(user_id),
                amount=credits,
                description=f"TTS ({service}) - {chars} chars",
                service=service_enum,
                metadata={
                    "call_id": self.state.call_id,
                    "service": service,
                    "characters": chars,
                }
            )
            logger.info(f"[credit-tracker] Recorded {credits} credits for TTS ({service}): {chars} chars")
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