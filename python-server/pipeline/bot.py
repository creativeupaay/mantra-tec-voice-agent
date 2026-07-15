"""
Mantra Tech Voice Agent — Pipecat pipeline entry point.

Phase 2 pipeline:
  Plivo (WebSocket)
    → Deepgram STT
    → LLM user aggregator
    → OpenRouter LLM  (with tool calling, context-aware system prompt)
    → TTS
    → Plivo (WebSocket)
    → LLM assistant aggregator

Key additions vs Phase 1:
  - Parallel call context fetched on connect
  - Dynamic system prompt built from CallState
  - 8 tools registered on the LLM (KB, CRM, Desk, Booking, Memory)
  - Per-turn language detection with state update
  - Transcript accumulation for Phase 4 post-call pipeline
  - Call record created in MongoDB on connect

Run with:
    uv run pipeline/bot.py
"""

import asyncio
import uuid

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    TTSTextFrame,
    LLMFullResponseEndFrame,
    LLMRunFrame,
    LLMMessagesAppendFrame,
    LLMContextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    AssistantTurnStoppedMessage,
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
    UserTurnStoppedMessage,
)
from pipecat.runner.types import RunnerArguments, SmallWebRTCRunnerArguments, WebSocketRunnerArguments
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.plivo import PlivoFrameSerializer
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.services.openrouter.llm import OpenRouterLLMService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from agent import graph as agent_graph
from agent.prompts import build_system_prompt
from agent.state import CallState
from config.database import init_db
from config.redis_client import init_redis
from env_config import settings
from modules.calls.service import call_service
from pipeline.context import build_call_context
from pipeline.post_call import run_post_call_pipeline


# ── TTS Factory ───────────────────────────────────────────────────────────────

def _build_tts():
    """Construct the TTS service based on the TTS_PROVIDER env var."""
    provider = settings.tts_provider

    if provider == "cartesia":
        from pipecat.services.cartesia.tts import CartesiaTTSService
        return CartesiaTTSService(
            api_key=settings.cartesia_api_key,
            settings=CartesiaTTSService.Settings(
                model=settings.cartesia_model,
                voice=settings.cartesia_voice_id,
            ),
        )

    if provider == "elevenlabs":
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
        return ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key,
            settings=ElevenLabsTTSService.Settings(
                voice=settings.elevenlabs_voice_id,
                model=settings.elevenlabs_model,
                language="hi",
                stability=0.4,
                similarity_boost=0.8,
                style=0.25,
                use_speaker_boost=True,
            ),
        )

    # Default → Deepgram
    from pipecat.services.deepgram.tts import DeepgramTTSService
    return DeepgramTTSService(
        api_key=settings.deepgram_api_key,
        voice="aura-asteria-en",
    )


# ── Gemini Live Watchers ──────────────────────────────────────────────────────

class TranscriptCollector(FrameProcessor):
    """Passive frame processor that logs transcription frames for Phase 4.

    IMPORTANT: Pipecat's FrameProcessor base class only auto-forwards SystemFrame
    subclasses. All other frames (audio, LLMContextFrame, etc.) MUST be pushed
    explicitly, otherwise they are silently dropped and never reach GeminiLiveLLMService.
    """
    def __init__(self, state):
        super().__init__()
        self.state = state
        self._assistant_buffer = []

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        # Let the base class update internal processor state (start/cancel/pause hooks).
        # IMPORTANT: the base class does NOT push any frame downstream — we must do it.
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and direction == FrameDirection.UPSTREAM:
            content = frame.text.strip()
            if content:
                logger.info(f"[bot] Transcript — user: {content}")
                self.state.transcript_lines.append(f"user: {content}")

        elif isinstance(frame, TTSTextFrame) and direction == FrameDirection.DOWNSTREAM:
            self._assistant_buffer.append(frame.text)

        elif isinstance(frame, LLMFullResponseEndFrame) and direction == FrameDirection.DOWNSTREAM:
            content = "".join(self._assistant_buffer).strip()
            if content:
                logger.info(f"[bot] Transcript — assistant: {content}")
                self.state.transcript_lines.append(f"assistant: {content}")
            self._assistant_buffer = []

        # Always forward every frame — including StartFrame, EndFrame, CancelFrame, audio, etc.
        # The base FrameProcessor updates internal state but never propagates frames itself.
        await self.push_frame(frame, direction)


# ── Bot Core ──────────────────────────────────────────────────────────────────

async def run_bot(
    transport: BaseTransport,
    call_id: str,
    phone_number: str,
) -> None:
    """Assemble and run the Pipecat pipeline for a single call.

    Args:
        transport: The configured Pipecat transport (WebSocket or WebRTC).
        call_id:   Unique call identifier (Plivo UUID or generated UUID).
        phone_number: Caller's E.164 phone number, or "unknown" for WebRTC tests.
    """
    logger.info(f"[bot] Starting pipeline for call {call_id} from {phone_number}")
    logger.info(f"[bot] Voice mode: {settings.voice_mode}")

    if settings.voice_mode not in {"classic", "gemini_realtime"}:
        logger.warning(f"[bot] Unknown VOICE_MODE '{settings.voice_mode}', falling back to classic pipeline")

    gemini_mode = settings.voice_mode == "gemini_realtime"

    # ── 1. Fetch all context in parallel ──────────────────────────────────────
    state: CallState = await build_call_context(call_id, phone_number)

    # ── 2. Build initial system prompt ────────────────────────────────────────
    system_prompt = build_system_prompt(state)

    # For classic mode, the system prompt goes into the messages list as role:system.
    messages = [] if gemini_mode else [{"role": "system", "content": system_prompt}]

    # ── 3. Set up LLM context ─────────────────────────────────────────────────
    context = LLMContext(messages, tools=agent_graph.TOOLS_SCHEMA)

    # Gemini Live has its own native VAD and turn detection — we must NOT use the
    # LLMUserAggregator because it broadcasts InterruptionFrames on every transcription
    # arrival, which kills tool calls before they finish.
    # We ONLY need the LLMAssistantAggregator to catch FunctionCallResultFrames and
    # feed tool results back into the GeminiLiveLLMService context.
    from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
    _, assistant_aggregator = LLMContextAggregatorPair(context)


    if gemini_mode:
        from google.genai.types import ThinkingConfig

        llm = GeminiLiveLLMService(
            model=settings.gemini_model,
            api_key=settings.gemini_api_key,
            tools=agent_graph.TOOLS_SCHEMA,
            settings=GeminiLiveLLMService.Settings(
                system_instruction=system_prompt,
                voice=settings.gemini_voice_name,
                language=settings.gemini_language,
                temperature=0.7,
                max_tokens=1024,
                thinking=ThinkingConfig(thinkingBudget=0),
            ),
        )
        llm.register_function(None, agent_graph.dispatch)

        transcript_collector = TranscriptCollector(state)

        pipeline = Pipeline([
            transport.input(),
            transcript_collector,
            llm,
            transport.output(),
            assistant_aggregator,
        ])

        task = PipelineWorker(
            pipeline,
            params=PipelineParams(
                enable_metrics=True,
                enable_usage_metrics=True,
                audio_in_sample_rate=16000,
                audio_out_sample_rate=16000,
            ),
            app_resources=state,
            enable_rtvi=False,
        )
    else:
        llm = OpenRouterLLMService(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
        )

        llm.register_function(None, agent_graph.dispatch)

        from pipecat.services.deepgram.stt import LiveOptions

        stt = DeepgramSTTService(
            api_key=settings.deepgram_api_key,
            live_options=LiveOptions(language="hi", model="nova-2"),
        )
        tts = _build_tts()

        user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                vad_analyzer=SileroVADAnalyzer(),
                user_idle_timeout=15.0,
            ),
        )

        pipeline = Pipeline([
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ])

        task = PipelineWorker(
            pipeline,
            params=PipelineParams(
                enable_metrics=True,
                enable_usage_metrics=True,
                audio_in_sample_rate=8000,
                audio_out_sample_rate=8000,
            ),
            app_resources=state,
            enable_rtvi=False,
        )

    # ── 4. Event handlers ──────────────────────────────────────────────────────

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"[bot] Client connected — call {call_id}")

        try:
            await call_service.start_call(call_id, phone_number)
        except Exception as e:
            logger.warning(f"[bot] Could not register call in DB: {e}")

        name_part = f", {state.identity.name}" if state.identity and state.identity.name else ""
        greeting_hint = (
            f"Start with a natural, human-like 'Hello{name_part}'. "
            "Do not say Namaste and do not introduce yourself. "
            f"Use {state.preferred_language} language."
        )

        if gemini_mode:
            # Send the greeting as a user turn in the context.
            # LLMContextFrame triggers GeminiLiveLLMService to open its WebSocket
            # and immediately generate a response (the greeting).
            context.add_message({"role": "user", "content": greeting_hint})
            await task.queue_frames([LLMContextFrame(context)])
        else:
            messages.append({"role": "system", "content": greeting_hint})
            await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"[bot] Client disconnected — call {call_id}")

        duration_seconds = 0
        asyncio.create_task(run_post_call_pipeline(state, duration_seconds))

        await task.cancel()

    if not gemini_mode:
        @user_aggregator.event_handler("on_user_turn_stopped")
        async def on_user_turn_stopped(aggregator, strategy, message: UserTurnStoppedMessage):
            content = message.content or ""
            ts = f"[{message.timestamp}] " if message.timestamp else ""

            state.transcript_lines.append(f"{ts}user: {content}")
            logger.info(f"[bot] Transcript — {ts}user: {content}")

        @user_aggregator.event_handler("on_user_turn_idle")
        async def on_user_turn_idle(aggregator):
            logger.info(f"[bot] User turn idle (no response) for call {call_id}")

            if not hasattr(state, "no_response_count"):
                state.no_response_count = 0

            state.no_response_count += 1

            if state.no_response_count == 1:
                logger.info("[bot] No response retry 1")
                await task.queue_frames([
                    LLMMessagesAppendFrame([{"role": "system", "content": "The user has been silent for a while. Ask them 'Hello, are you still there?' or something similar briefly."}]),
                    LLMRunFrame()
                ])
            else:
                logger.info("[bot] No response retry 2 - Disconnecting")
                await task.queue_frames([
                    LLMMessagesAppendFrame([{"role": "system", "content": "The user is still silent. Say 'I haven't heard anything for a while, so I will disconnect the call now. Have a great day!' and then use your tools to hang up or just say it and we will cancel the task."}]),
                    LLMRunFrame()
                ])
                asyncio.create_task(_delayed_cancel(task, delay=5.0))

        @assistant_aggregator.event_handler("on_assistant_turn_stopped")
        async def on_assistant_turn_stopped(aggregator, message: AssistantTurnStoppedMessage):
            content = message.content or ""
            ts = f"[{message.timestamp}] " if message.timestamp else ""
            state.transcript_lines.append(f"{ts}assistant: {content}")
            logger.info(f"[bot] Transcript — {ts}assistant: {content}")

    async def _delayed_cancel(task: PipelineWorker, delay: float = 5.0):
        await asyncio.sleep(delay)
        await task.cancel()

    # ── 5. Run ────────────────────────────────────────────────────────────────
    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)



# ── Runner Entry Point ─────────────────────────────────────────────────────────

async def bot(runner_args: RunnerArguments) -> None:
    """Pipecat runner entry point — called once per inbound connection.

    Initializes infrastructure on first call (idempotent).
    Phase 4 will move this to a proper FastAPI lifespan.
    """
    await init_db()
    await init_redis()

    transport: BaseTransport | None = None
    call_id: str = str(uuid.uuid4())
    phone_number: str = "unknown"

    match runner_args:
        case SmallWebRTCRunnerArguments():
            # Browser / WebRTC test mode
            webrtc_connection: SmallWebRTCConnection = runner_args.webrtc_connection
            transport = SmallWebRTCTransport(
                webrtc_connection=webrtc_connection,
                params=TransportParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                ),
            )

        case WebSocketRunnerArguments():
            # Production Plivo telephony
            _, call_data = await parse_telephony_websocket(runner_args.websocket)
            call_id = call_data.get("call_id", call_id)
            phone_number = call_data.get("from", "unknown")

            serializer = PlivoFrameSerializer(
                stream_id=call_data["stream_id"],
                call_id=call_id,
                auth_id=settings.plivo_auth_id,
                auth_token=settings.plivo_auth_token,
            )
            transport = FastAPIWebsocketTransport(
                websocket=runner_args.websocket,
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                serializer=serializer,
            )

        case _:
            logger.error(f"[bot] Unsupported runner argument type: {type(runner_args)}")
            return

    await run_bot(transport, call_id, phone_number)


# ── Script Entry ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
