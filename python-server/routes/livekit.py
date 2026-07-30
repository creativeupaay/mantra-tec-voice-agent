"""LiveKit incoming-call webhook endpoint.

LiveKit Cloud POSTs signed webhook events here whenever something happens in
a room (e.g., a SIP caller joins).  We verify the request using TokenVerifier
(which validates the Authorization JWT against LIVEKIT_API_KEY +
LIVEKIT_API_SECRET — no separate webhook secret needed).

Flow
----
Phone call → LiveKit SIP → participant_joined webhook
  → POST /livekit/webhook
  → verify JWT via TokenVerifier(api_key, api_secret)
  → extract room_name + caller phone from SIP participant attributes
  → asyncio.create_task(_join_room(...))   ← non-blocking, returns 200 OK
      → generate_agent_token()
      → LiveKitTransport joins room
      → run_bot(transport, call_id, phone_number)
      → [call ends] on_client_disconnected → post_call pipeline

Dashboard setup (one-time)
--------------------------
LiveKit Cloud → your project → Webhooks → Add endpoint:
  URL:    https://<your-cloud-run-url>/livekit/webhook
  Events: participant_joined  (and optionally room_started)
  (no separate secret — LiveKit signs with your API key/secret)
"""

import asyncio
import uuid

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import Response
from loguru import logger

from env_config import settings
from pipeline.bot import run_bot
from services.livekit.token import generate_agent_token

# LiveKit SDK — gated so the server still starts if the extra is not installed.
try:
    from livekit.api import TokenVerifier, WebhookReceiver
    _LIVEKIT_AVAILABLE = True
except ImportError:
    _LIVEKIT_AVAILABLE = False
    logger.warning(
        "[livekit] livekit-api SDK not found — /livekit/webhook disabled. "
        "Run: uv add \"pipecat-ai[livekit]\""
    )

try:
    from pipecat.transports.services.livekit import LiveKitParams, LiveKitTransport
    _TRANSPORT_AVAILABLE = True
except ImportError:
    _TRANSPORT_AVAILABLE = False

router = APIRouter(prefix="/livekit", tags=["livekit"])

# SIP participant attributes set by LiveKit's SIP service.
# https://docs.livekit.io/sip/overview/#participant-attributes
_SIP_PHONE_ATTR = "sip.phoneNumber"

# Identity prefix for the agent participant — used to skip self-triggered events.
_AGENT_IDENTITY_PREFIX = "mantra-agent"


def _build_receiver() -> "WebhookReceiver":
    """Construct a WebhookReceiver backed by TokenVerifier using our API credentials."""
    return WebhookReceiver(
        TokenVerifier(
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
    )


def _extract_phone(attributes: dict) -> str:
    """Pull the caller's E.164 phone number from SIP participant attributes."""
    return (
        attributes.get(_SIP_PHONE_ATTR)
        or attributes.get("phoneNumber")
        or "unknown"
    )


def _is_agent(identity: str) -> bool:
    """True if the joining participant is our own agent — prevents recursive spawning."""
    return identity.startswith(_AGENT_IDENTITY_PREFIX)


async def _join_room(room_name: str, phone_number: str, call_id: str) -> None:
    """Background coroutine: generate a token, open LiveKitTransport, run the bot.

    Scheduled via asyncio.create_task() so the webhook HTTP response is
    returned immediately.  The active WebRTC connection keeps the Cloud Run
    container alive for the duration of the call.
    """
    if not _TRANSPORT_AVAILABLE:
        logger.error(
            "[livekit] LiveKitTransport unavailable — install pipecat-ai[livekit]"
        )
        return

    logger.info(
        f"[livekit] Joining room={room_name} phone={phone_number} call_id={call_id}"
    )

    try:
        token = generate_agent_token(
            room_name=room_name,
            participant_identity=f"{_AGENT_IDENTITY_PREFIX}-{call_id[:8]}",
        )
    except ValueError as e:
        logger.error(f"[livekit] Token generation failed: {e}")
        return

    transport = LiveKitTransport(
        url=settings.livekit_url,
        token=token,
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        ),
    )

    try:
        await run_bot(transport, call_id, phone_number)
    except Exception as e:
        logger.error(f"[livekit] Bot crashed for call_id={call_id}: {e}")


# ── Webhook endpoint ──────────────────────────────────────────────────────────

@router.post("/webhook", operation_id="livekit_webhook")
async def livekit_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
) -> Response:
    """Receive and process LiveKit webhook events.

    LiveKit signs the Authorization header as a JWT using your API key/secret.
    WebhookReceiver + TokenVerifier validates this before we act on any data.
    We always return 200 OK to prevent LiveKit from retrying.
    """
    if not _LIVEKIT_AVAILABLE:
        logger.error("[livekit] Webhook received but livekit-api SDK is not installed.")
        return Response(status_code=503)

    if not settings.livekit_api_key or not settings.livekit_api_secret:
        logger.error(
            "[livekit] LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set — "
            "cannot verify webhook."
        )
        return Response(status_code=500)

    # ── 1. Read raw body ────────────────────────────────────────────────────
    body = await request.body()

    # ── 2. Verify JWT signature against our API credentials ─────────────────
    try:
        receiver = _build_receiver()
        event = receiver.receive(body.decode("utf-8"), authorization)
    except Exception as e:
        logger.warning(f"[livekit] Webhook verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    event_name = event.event
    logger.info(f"[livekit] Webhook event={event_name}")

    # ── 3. Handle participant_joined ─────────────────────────────────────────
    if event_name == "participant_joined":
        participant = event.participant
        room = event.room

        if participant is None or room is None:
            logger.warning("[livekit] participant_joined missing participant/room data")
            return Response(status_code=200)

        identity = participant.identity or ""
        attributes: dict = dict(participant.attributes or {})

        # Skip if it's our own agent joining — prevents a recursive spawn loop.
        if _is_agent(identity):
            logger.debug(f"[livekit] Skipping agent participant: {identity}")
            return Response(status_code=200)

        room_name = room.name
        phone_number = _extract_phone(attributes)
        call_id = str(uuid.uuid4())

        logger.info(
            f"[livekit] Caller joined — room={room_name} phone={phone_number} "
            f"identity={identity} call_id={call_id}"
        )

        # Non-blocking: the HTTP response returns immediately.
        # The background task maintains the WebRTC connection and keeps Cloud Run alive.
        asyncio.create_task(
            _join_room(room_name, phone_number, call_id),
            name=f"livekit-bot-{call_id[:8]}",
        )

    # ── 4. room_started — informational only ─────────────────────────────────
    elif event_name == "room_started":
        room_name = event.room.name if event.room else "unknown"
        logger.info(f"[livekit] Room started: {room_name}")

    # ── 5. All other events ──────────────────────────────────────────────────
    else:
        logger.debug(f"[livekit] Unhandled event: {event_name}")

    # Always 200 — prevents LiveKit from retrying.
    return Response(status_code=200)


@router.get("/status", operation_id="livekit_status")
async def livekit_status() -> dict:
    """Check that LiveKit integration is wired up correctly."""
    return {
        "livekit_sdk_available": _LIVEKIT_AVAILABLE,
        "transport_available": _TRANSPORT_AVAILABLE,
        "url_configured": bool(settings.livekit_url),
        "api_key_configured": bool(settings.livekit_api_key),
        "api_secret_configured": bool(settings.livekit_api_secret),
    }
