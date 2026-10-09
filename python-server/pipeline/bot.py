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
    InterruptionFrame,
    LLMContextFrame,
    LLMMessagesAppendFrame,
    LLMRunFrame,
    TranscriptionFrame,
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
                stability=0.75,
                similarity_boost=0.8,
                style=0.0,
                use_speaker_boost=False,
            ),
        )

    # Default → Deepgram
    from pipecat.services.deepgram.tts import DeepgramTTSService
    return DeepgramTTSService(
        api_key=settings.deepgram_api_key,
        voice="aura-asteria-en",
    )


# ── Silence & Inactivity Monitoring ──────────────────────────────────────────

class UserTranscriptCollector(FrameProcessor):
    """Passive frame processor that logs user transcriptions and notifies activity."""
    def __init__(self, state, on_speech=None):
        super().__init__()
        self.state = state
        self.on_speech = on_speech

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame):
            content = (frame.text or "").strip()
            if content:
                if direction == FrameDirection.UPSTREAM:
                    logger.info(f"[bot] Transcript — user: {content}")
                    self.state.transcript_lines.append(f"user: {content}")
                if self.on_speech:
                    self.on_speech(content)
        elif isinstance(frame, InterruptionFrame):
            if self.on_speech:
                self.on_speech("interruption")

        await self.push_frame(frame, direction)


class SilenceTimeoutMonitor:
    """Monitors silence/inactivity during a call across Gemini Live and classic pipelines.

    Workflow:
      1. When bot stops speaking (greeting or answer), inactivity countdown starts.
      2. If caller remains silent for `initial_timeout` (default 10s):
         Prompt bot to confirm if user is still on the line.
      3. If caller remains silent for another `confirm_timeout` (default 6s):
         Prompt bot to say goodbye and automatically cut the call.
      4. Any user speech resets the silence timer and returns phase to 0.
    """

    def __init__(
        self,
        *,
        call_id: str,
        state: CallState,
        initial_timeout: float,
        confirm_timeout: float,
        send_prompt_fn,
        disconnect_fn,
    ):
        self.call_id = call_id
        self.state = state
        self.initial_timeout = max(3.0, initial_timeout)
        self.confirm_timeout = max(2.0, confirm_timeout)
        self.send_prompt_fn = send_prompt_fn
        self.disconnect_fn = disconnect_fn

        self.bot_is_speaking: bool = True  # True initially while greeting is being delivered
        self.last_activity_time: float = time.monotonic()
        self.silence_phase: int = 0  # 0: normal wait, 1: confirmation asked, 2: disconnecting
        self.is_active: bool = False
        self._watchdog_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    def start(self):
        self.is_active = True
        self.bot_is_speaking = True
        self.last_activity_time = time.monotonic()
        self._watchdog_task = asyncio.create_task(self._watchdog_loop())
        logger.info(
            f"[bot] SilenceTimeoutMonitor started for call {self.call_id} "
            f"(initial={self.initial_timeout}s, confirm={self.confirm_timeout}s)"
        )

    async def stop(self):
        self.is_active = False
        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except asyncio.CancelledError:
                pass
            self._watchdog_task = None

    def on_bot_started_speaking(self):
        """Called when assistant begins speaking."""
        self.bot_is_speaking = True

    def on_bot_stopped_speaking(self):
        """Called when assistant finishes speaking."""
        self.bot_is_speaking = False
        self.last_activity_time = time.monotonic()

    def on_user_speech(self, text: str = ""):
        """Called whenever caller speaks or interrupts."""
        self.last_activity_time = time.monotonic()
        if self.silence_phase == 1:
            logger.info(f"[bot] User resumed speaking during confirmation check ('{text[:30]}'). Resetting silence timer.")
        self.silence_phase = 0

    async def _watchdog_loop(self):
        while self.is_active:
            try:
                await asyncio.sleep(0.5)
                if not self.is_active:
                    break

                # Do not count silence while bot is speaking or generating audio
                if self.bot_is_speaking:
                    continue

                elapsed = time.monotonic() - self.last_activity_time

                if self.silence_phase == 0:
                    if elapsed >= self.initial_timeout:
                        async with self._lock:
                            if self.silence_phase == 0 and not self.bot_is_speaking and self.is_active:
                                self.silence_phase = 1
                                self.bot_is_speaking = True
                                logger.info(
                                    f"[bot] Call {self.call_id}: Inactivity detected ({elapsed:.1f}s >= {self.initial_timeout}s). "
                                    f"Asking confirmation check."
                                )
                                await self._trigger_confirmation()
                elif self.silence_phase == 1:
                    if elapsed >= self.confirm_timeout:
                        async with self._lock:
                            if self.silence_phase == 1 and not self.bot_is_speaking and self.is_active:
                                self.silence_phase = 2
                                self.bot_is_speaking = True
                                logger.info(
                                    f"[bot] Call {self.call_id}: Still silent after confirmation ({elapsed:.1f}s >= {self.confirm_timeout}s). "
                                    f"Disconnecting call now."
                                )
                                await self._trigger_disconnect_wrapup()
                                break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[bot] Error in SilenceTimeoutMonitor watchdog: {e}")
                await asyncio.sleep(1.0)

    async def _trigger_confirmation(self):
        is_hindi = self.state.preferred_language in ("hi", "hinglish")
        if is_hindi:
            prompt = (
                "Caller kafi der se chup hain (inactivity check). Polite aur natural Hinglish mein check kijiye: "
                "'Hello? Kya aap line par hain?' ya 'Hello, kya aap mujhe sun pa rahe hain?' "
                "Sirf ek chhota sentence boliye."
            )
        else:
            prompt = (
                "The caller has been silent for a while. In a polite, natural tone, briefly check if they are still on the line: "
                "'Hello, are you still there?' or 'Hello, can you hear me?' "
                "Keep it strictly to one short sentence."
            )
        await self.send_prompt_fn(prompt)

    async def _trigger_disconnect_wrapup(self):
        is_hindi = self.state.preferred_language in ("hi", "hinglish")
        if is_hindi:
            prompt = (
                "Caller abhi bhi silent hain check ke baad bhi. Polite Hinglish mein boliye: "
                "'Aapki taraf se koi response na milne ke karan, main call disconnect kar rahi hoon. Mantra Tech mein call karne ke liye dhanyawad. Have a nice day!' "
                "Koi sawaal mat puchiye."
            )
        else:
            prompt = (
                "The caller is still silent after the check. Say politely: "
                "'Since I haven't received a response, I will disconnect the call now. Thank you for calling Mantra Tech, have a great day!' "
                "Do not ask any questions."
            )
        await self.send_prompt_fn(prompt)
        await self.disconnect_fn(delay=4.5)


# ── Bot Core ──────────────────────────────────────────────────────────────────

async def run_bot(
    transport: BaseTransport,
    call_id: str,
    phone_number: str,
    telephony_provider: str = "unknown",
) -> None:
    """Assemble and run the Pipecat pipeline for a single call.

    Args:
        transport: The configured Pipecat transport (WebSocket or WebRTC).
        call_id:   Unique call identifier (Plivo UUID or generated UUID).
        phone_number: Caller's E.164 phone number, or "unknown" for WebRTC tests.
        telephony_provider: Telephony provider identifier ("exotel", "plivo", "livekit", etc.).
    """
    logger.info(f"[bot] Starting pipeline for call {call_id} from {phone_number} (provider={telephony_provider})")
    logger.info(f"[bot] Voice mode: {settings.voice_mode}")

    if settings.voice_mode not in {"classic", "gemini_realtime"}:
        logger.warning(f"[bot] Unknown VOICE_MODE '{settings.voice_mode}', falling back to classic pipeline")

    gemini_mode = settings.voice_mode == "gemini_realtime"

    # ── 1. Fetch all context in parallel ──────────────────────────────────────
    state: CallState = await build_call_context(call_id, phone_number, telephony_provider=telephony_provider)
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

        user_transcript_collector = UserTranscriptCollector(
            state,
            on_speech=lambda text: silence_monitor.on_user_speech(text) if 'silence_monitor' in locals() else None,
        )
        credit_tracker = create_credit_tracker(state)
        # Must sit AFTER transport.output() so both user + bot audio are captured.
        audio_buffer, recorded_audio, recording_ready = _create_audio_buffer()

        pipeline = Pipeline([
            transport.input(),
            credit_tracker,
            user_aggregator,
            user_transcript_collector,
            llm,
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
                user_idle_timeout=0,  # Managed by SilenceTimeoutMonitor
            ),
        )

        credit_tracker = create_credit_tracker(state)
        # Must sit AFTER transport.output() so both user + bot audio are captured.
        audio_buffer, recorded_audio, recording_ready = _create_audio_buffer()

        pipeline = Pipeline([
            transport.input(),
            stt,
            credit_tracker,
            user_aggregator,
            llm,
            tts,
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

    async def _send_system_prompt(prompt_text: str):
        try:
            if gemini_mode:
                if hasattr(llm, "_create_single_response"):
                    await llm._create_single_response([{"role": "user", "content": prompt_text}])
                else:
                    await llm.queue_frame(LLMMessagesAppendFrame([{"role": "user", "content": prompt_text}]))
            else:
                await task.queue_frames([
                    LLMMessagesAppendFrame([{"role": "system", "content": prompt_text}]),
                    LLMRunFrame()
                ])
        except Exception as e:
            logger.error(f"[bot] Failed to send prompt to LLM for call {call_id}: {e}")

    async def _silence_disconnect(delay: float = 4.5):
        try:
            logger.info(f"[bot] Silence timeout disconnect initiated for call {call_id} in {delay}s")
            await asyncio.sleep(delay)
            await _handle_call_ended(trigger="silence_timeout_disconnect")
        except Exception as e:
            logger.error(f"[bot] Error during silence disconnect: {e}")

    silence_monitor = SilenceTimeoutMonitor(
        call_id=call_id,
        state=state,
        initial_timeout=settings.silence_timeout_initial,
        confirm_timeout=settings.silence_timeout_confirm,
        send_prompt_fn=_send_system_prompt,
        disconnect_fn=_silence_disconnect,
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

            try:
                await silence_monitor.stop()
            except Exception as e:
                logger.warning(f"[bot] Error stopping silence monitor: {e}")

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

            # Brief yield to let any in-flight aggregator turn events settle into state
            await asyncio.sleep(0.15)

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

        # Every call starts with a warm, natural Hindi/Hinglish greeting by default
        if gemini_mode:
            greeting_hint = (
                "Greet the caller calmly and warmly in a relaxed tone in Hinglish: "
                "'Hello, thank you for calling Mantra Tech, main Priya. Bataiye main aapki kya madad kar sakti hoon?' "
                "CRITICAL: If the caller speaks English, switch smoothly to English. If the caller speaks Hindi or Hinglish, continue in natural Hinglish."
            )
        else:
            greeting_hint = (
                "Greet the caller calmly and warmly in a relaxed tone in Hindi: "
                "'Hello, Mantra Tech में call करने के लिए thank you, मैं Priya बात कर रही हूँ। बताइए मैं आपकी क्या help कर सकती हूँ?' "
                "CRITICAL: If the caller speaks English, switch smoothly to English. If the caller speaks Hindi or Hinglish, continue in natural Hindi."
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

        # Start silence and inactivity monitoring
        silence_monitor.start()

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

    @assistant_aggregator.event_handler("on_assistant_turn_started")
    async def on_assistant_turn_started(aggregator):
        silence_monitor.on_bot_started_speaking()

    @assistant_aggregator.event_handler("on_assistant_turn_stopped")
    async def on_assistant_turn_stopped(aggregator, message: AssistantTurnStoppedMessage):
        silence_monitor.on_bot_stopped_speaking()
        content = (message.content or "").strip()
        if content:
            state.transcript_lines.append(f"assistant: {content}")
            tag = " (interrupted)" if message.interrupted else ""
            logger.info(f"[bot] Transcript — assistant: {content}{tag}")

    if not gemini_mode:
        @user_aggregator.event_handler("on_user_turn_stopped")
        async def on_user_turn_stopped(aggregator, strategy, message: UserTurnStoppedMessage):
            content = (message.content or "").strip()
            if content:
                silence_monitor.on_user_speech(content)
                state.transcript_lines.append(f"user: {content}")
                logger.info(f"[bot] Transcript — user: {content}")

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
