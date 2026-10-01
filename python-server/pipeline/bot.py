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
import io
import time
import uuid
import wave

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    Frame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMMessagesAppendFrame,
    LLMRunFrame,
    TranscriptionFrame,
    TTSTextFrame,
)
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
from pipecat.processors.audio.audio_buffer_processor import AudioBufferProcessor
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.runner.types import (
    RunnerArguments,
    SmallWebRTCRunnerArguments,
    WebSocketRunnerArguments,
)
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.plivo import PlivoFrameSerializer
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.services.openrouter.llm import OpenRouterLLMService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from agent import graph as agent_graph
from agent.prompts import build_system_prompt, get_caller_scenario
from agent.state import CallState
from config.database import init_db
from config.redis_client import init_redis
from env_config import settings
from modules.calls.service import call_service
from pipeline.context import build_call_context
from pipeline.credit_tracker import create_credit_tracker
from pipeline.post_call import run_post_call_pipeline


def _pcm_to_wav(pcm_audio: bytes, sample_rate: int, num_channels: int) -> bytes:
    """Wrap raw 16-bit PCM in a WAV container for upload/playback."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(num_channels)
        wf.setsampwidth(2)  # 16-bit PCM
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_audio)
    return buffer.getvalue()


def _create_audio_buffer() -> tuple[AudioBufferProcessor, dict, asyncio.Event]:
    """Create an AudioBufferProcessor and wire a reliable capture handler.

    Pipecat's ``on_audio_data`` handler signature is:
      (buffer, audio, sample_rate, num_channels)

    With ``buffer_size=0``, audio is emitted once on ``stop_recording()``.
    """
    audio_buffer = AudioBufferProcessor(
        num_channels=1,
        buffer_size=0,
        enable_turn_audio=False,
        auto_start_recording=True,
    )
    capture: dict = {
        "audio": b"",
        "sample_rate": 16000,
        "num_channels": 1,
    }
    ready = asyncio.Event()

    @audio_buffer.event_handler("on_audio_data")
    async def on_audio_data(buffer, audio, sample_rate, num_channels):
        if audio:
            capture["audio"] = bytes(audio)
            capture["sample_rate"] = sample_rate or capture["sample_rate"]
            capture["num_channels"] = num_channels or capture["num_channels"]
            logger.info(
                f"[bot] Captured recording chunk: {len(capture['audio'])} bytes "
                f"@ {capture['sample_rate']}Hz x{capture['num_channels']}"
            )
        ready.set()

    @audio_buffer.event_handler("on_recording_stopped")
    async def on_recording_stopped(buffer):
        # Always unblock disconnect waiters (even when no audio was captured).
        ready.set()

    return audio_buffer, capture, ready


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

class UserTranscriptCollector(FrameProcessor):
    """Passive frame processor that logs user transcriptions going UPSTREAM."""
    def __init__(self, state):
        super().__init__()
        self.state = state

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame) and direction == FrameDirection.UPSTREAM:
            content = frame.text.strip()
            if content:
                logger.info(f"[bot] Transcript — user: {content}")
                self.state.transcript_lines.append(f"user: {content}")

        await self.push_frame(frame, direction)


class AssistantTranscriptCollector(FrameProcessor):
    """Passive frame processor that logs assistant transcriptions going DOWNSTREAM."""
    def __init__(self, state):
        super().__init__()
        self.state = state
        self._assistant_buffer = []

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TTSTextFrame) and direction == FrameDirection.DOWNSTREAM:
            self._assistant_buffer.append(frame.text)

        elif isinstance(frame, LLMFullResponseEndFrame) and direction == FrameDirection.DOWNSTREAM:
            content = "".join(self._assistant_buffer).strip()
            if content:
                logger.info(f"[bot] Transcript — assistant: {content}")
                self.state.transcript_lines.append(f"assistant: {content}")
            self._assistant_buffer = []

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
    # Start timing as early as possible so duration is never left at 0.
    state.call_started_at = time.monotonic()
    state.call_started_wall = time.time()

    # ── 2. Build initial system prompt ────────────────────────────────────────
    system_prompt = build_system_prompt(state, voice_mode=settings.voice_mode)

    # For classic mode, the system prompt goes into the messages list as role:system.
    messages = [] if gemini_mode else [{"role": "system", "content": system_prompt}]

    # ── 3. Set up LLM context ─────────────────────────────────────────────────
    context = LLMContext(messages, tools=agent_graph.TOOLS_SCHEMA)

    # Gemini Live has its own native VAD and turn detection — we must NOT use the
    # LLMUserAggregator because it broadcasts InterruptionFrames on every transcription
    # In Pipecat 1.5.0, realtime_service_mode strictly requires BOTH aggregators
    # to be created together and placed in the pipeline so they both get a TaskManager.
    from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(context)


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
                thinking=ThinkingConfig(thinking_budget=0),
            ),
        )
        llm.register_function(None, agent_graph.dispatch)

        user_transcript_collector = UserTranscriptCollector(state)
        assistant_transcript_collector = AssistantTranscriptCollector(state)
        credit_tracker = create_credit_tracker(state)
        # Must sit AFTER transport.output() so both user + bot audio are captured.
        audio_buffer, recorded_audio, recording_ready = _create_audio_buffer()

        pipeline = Pipeline([
            transport.input(),
            credit_tracker,
            user_aggregator,
            user_transcript_collector,
            llm,
            assistant_transcript_collector,
            transport.output(),
            audio_buffer,
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

        user_transcript_collector = UserTranscriptCollector(state)
        assistant_transcript_collector = AssistantTranscriptCollector(state)
        credit_tracker = create_credit_tracker(state)
        # Must sit AFTER transport.output() so both user + bot audio are captured.
        audio_buffer, recorded_audio, recording_ready = _create_audio_buffer()

        pipeline = Pipeline([
            transport.input(),
            stt,
            user_transcript_collector,
            credit_tracker,
            user_aggregator,
            llm,
            tts,
            assistant_transcript_collector,
            transport.output(),
            audio_buffer,
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

    call_ended_lock = asyncio.Lock()
    call_ended_processed = False

    async def _handle_call_ended(trigger: str = "unknown"):
        nonlocal call_ended_processed
        async with call_ended_lock:
            if call_ended_processed:
                return
            call_ended_processed = True

            logger.info(f"[bot] Call {call_id} ended (trigger={trigger}) — initiating finalization")

            # Snapshot audio BEFORE stop_recording() — that method clears buffers after
            # scheduling on_audio_data as a background task (not awaited).
            snapshot_pcm = b""
            snapshot_rate = audio_buffer.sample_rate or 16000
            snapshot_channels = audio_buffer.num_channels
            try:
                if audio_buffer.has_audio():
                    audio_buffer._align_track_buffers()
                    snapshot_pcm = audio_buffer.merge_audio_buffers()
            except Exception as e:
                logger.warning(f"[bot] Could not snapshot audio buffers: {e}")

            try:
                await audio_buffer.stop_recording()
                try:
                    await asyncio.wait_for(recording_ready.wait(), timeout=2.0)
                except asyncio.TimeoutError:
                    logger.warning("[bot] Timed out waiting for recording_stopped event")
            except Exception as e:
                logger.error(f"[bot] Failed to stop audio recording: {e}")

            pcm_audio = recorded_audio.get("audio") or snapshot_pcm or b""
            sample_rate = int(recorded_audio.get("sample_rate") or snapshot_rate or 16000)
            num_channels = int(recorded_audio.get("num_channels") or snapshot_channels or 1)

            recording_bytes = None
            if pcm_audio:
                recording_bytes = _pcm_to_wav(pcm_audio, sample_rate, num_channels)
                logger.info(
                    f"[bot] Recorded {len(pcm_audio)} PCM bytes → {len(recording_bytes)} WAV bytes "
                    f"@ {sample_rate}Hz x{num_channels}"
                )
            else:
                logger.warning(f"[bot] No audio captured for call {call_id}")

            # Prefer wall-clock duration; fall back to monotonic / audio length.
            duration_candidates: list[int] = []
            if state.call_started_wall:
                duration_candidates.append(max(0, int(time.time() - state.call_started_wall)))
            if state.call_started_at:
                duration_candidates.append(max(0, int(time.monotonic() - state.call_started_at)))
            if pcm_audio and sample_rate > 0:
                duration_candidates.append(
                    max(0, len(pcm_audio) // (sample_rate * max(1, num_channels) * 2))
                )
            duration_seconds = max(duration_candidates) if duration_candidates else 0
            logger.info(f"[bot] Call {call_id} duration calculated as {duration_seconds}s")

            # Cancel the pipeline task to teardown stream connection if still active
            try:
                if not task.has_finished():
                    await task.cancel()
            except Exception as e:
                logger.warning(f"[bot] Task cancel notice for call {call_id}: {e}")

            # Run post-call pipeline to completion (awaited directly so all DB writes and CRM sync finish)
            try:
                await run_post_call_pipeline(
                    state,
                    duration_seconds,
                    recording_bytes,
                    recording_content_type="audio/wav",
                )
                logger.info(f"[bot] Post-call pipeline completed for call {call_id}")
            except Exception as e:
                logger.error(f"[bot] Post-call pipeline failed for call {call_id}: {e}")

    async def _request_disconnect(delay: float = 3.5):
        try:
            logger.info(f"[bot] Disconnect requested for call {call_id} — waiting {delay}s for TTS goodbye delivery")
            await asyncio.sleep(delay)
            logger.info(f"[bot] Disconnecting call {call_id} now")
            await _handle_call_ended(trigger="agent_tool_disconnect")
        except Exception as e:
            logger.error(f"[bot] Error during call disconnect: {e}")

    state.request_disconnect = _request_disconnect

    # ── 4. Event handlers ──────────────────────────────────────────────────────

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"[bot] Client connected — call {call_id}")
        # Refresh timing at actual media connect (excludes pre-connect setup).
        state.call_started_at = time.monotonic()
        state.call_started_wall = time.time()

        try:
            call = await call_service.start_call(call_id, phone_number)
            # CreditUsage.call_id refs the Mongo Call `_id`, not the Plivo UUID.
            state.db_call_id = call.id
            logger.info(f"[bot] Registered call in DB — mongo_id={call.id}")
        except Exception as e:
            logger.warning(f"[bot] Could not register call in DB: {e}")

        scenario, elapsed_mins, rel_time, last_topic = get_caller_scenario(state)
        name_part = f" {state.identity.name}" if state.identity and state.identity.name else ""

        if scenario == "immediate_callback":
            topic_hint = f" Previous topic discussed was '{last_topic}'." if last_topic else ""
            greeting_hint = (
                f"The caller just called {elapsed_mins} min ago and the call likely got disconnected.{topic_hint} "
                f"Greet them warmly acknowledging the disconnected call: 'Hello{name_part}, lagta hai call disconnect ho gayi thi. Haan ji boliye.' "
                "Do NOT introduce the company or give a formal pitch because they were just on the line a minute ago. Be natural like a human picking back up."
            )
        elif scenario == "returning_caller":
            topic_hint = f" Previous discussion was '{last_topic}'." if last_topic else ""
            greeting_hint = (
                f"The caller is returning (last call: {rel_time}).{topic_hint} "
                f"Greet warmly: 'Hello{name_part}! Welcome back to Mantra Tech, main Priya. Kaise hain aap? Bataiye aaj main aapki kya help kar sakti hoon?' "
                f"Use {state.preferred_language} language."
            )
        else:
            greeting_hint = (
                "This is a first-time caller. Greet warmly with a brief professional opening: "
                f"'Hello! Thank you for calling Mantra Tech, main Priya. Bataiye main aapki kya madad kar sakti hoon?' "
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
        logger.info(f"[bot] Transport on_client_disconnected — call {call_id}")
        await _handle_call_ended(trigger="client_disconnected")

    # Extra transport events (for LiveKit or transports with alternative disconnect events)
    supported_handlers = getattr(transport, "_supported_event_handlers", set())
    if "on_participant_disconnected" in supported_handlers:
        @transport.event_handler("on_participant_disconnected")
        async def on_participant_disconnected(transport, participant):
            logger.info(f"[bot] Participant disconnected — call {call_id}")
            await _handle_call_ended(trigger="participant_disconnected")

    if "on_disconnected" in supported_handlers:
        @transport.event_handler("on_disconnected")
        async def on_disconnected(transport):
            logger.info(f"[bot] Transport disconnected — call {call_id}")
            await _handle_call_ended(trigger="transport_disconnected")

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
                asyncio.create_task(_delayed_cancel(delay=5.0))

        @assistant_aggregator.event_handler("on_assistant_turn_stopped")
        async def on_assistant_turn_stopped(aggregator, message: AssistantTurnStoppedMessage):
            content = message.content or ""
            ts = f"[{message.timestamp}] " if message.timestamp else ""
            state.transcript_lines.append(f"{ts}assistant: {content}")
            logger.info(f"[bot] Transcript — {ts}assistant: {content}")

    async def _delayed_cancel(delay: float = 5.0):
        try:
            await asyncio.sleep(delay)
            await _handle_call_ended(trigger="idle_timeout_disconnect")
        except Exception as e:
            logger.error(f"[bot] Error during delayed cancel: {e}")

    # ── 5. Run ────────────────────────────────────────────────────────────────
    runner = PipelineRunner(handle_sigint=False)
    try:
        await runner.run(task)
    finally:
        await _handle_call_ended(trigger="pipeline_finished")



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
                params=FastAPIWebsocketParams(
                    add_wav_header=False,
                    serializer=serializer,
                ),
            )

        case _:
            logger.error(f"[bot] Unsupported runner argument type: {type(runner_args)}")
            return

    await run_bot(transport, call_id, phone_number)


# ── Script Entry ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
