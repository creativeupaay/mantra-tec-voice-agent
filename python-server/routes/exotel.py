"""Exotel telephony HTTP endpoints.

  POST /exotel/answer  — Answer URL; returns ExoML → /ws/exotel

Point your Exotel flow's Connect Applet / Stream Applet at ``/exotel/answer``.
"""

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from loguru import logger

from config.database import get_db
from env_config import settings
from services.exotel.xml import build_stream_xml, build_websocket_url
from services.plivo.urls import resolve_public_base_url

router = APIRouter(prefix="/exotel", tags=["exotel"])


def _exotel_params(request: Request, form: dict[str, Any] | None = None) -> dict[str, str]:
    """Merge query + form params Exotel sends on answer."""
    merged: dict[str, str] = {k: str(v) for k, v in request.query_params.items()}
    if form:
        for k, v in form.items():
            if v is not None and str(v) != "":
                merged[str(k)] = str(v)
    return merged


@router.api_route("/answer", methods=["GET", "POST"], operation_id="exotel_answer")
async def exotel_answer(request: Request) -> Response:
    """Webhook endpoint for Exotel inbound calls.
    
    Returns ExoML instructing Exotel to connect the audio stream to our WebSocket.
    """
    form_data = {}
    if request.method == "POST":
        try:
            form_data = dict(await request.form())
        except Exception:
            pass

    params = _exotel_params(request, form_data)
    
    # Exotel typically sends 'From' and 'To'
    from_number = params.get("From", "unknown")
    to_number = params.get("To", "unknown")
    call_sid = params.get("CallSid", "unknown")
    
    logger.info(
        f"[exotel] Incoming call — CallSid={call_sid} From={from_number} To={to_number}"
    )

    # Base websocket URL (e.g., wss://my-app.run.app/ws/exotel)
    base = resolve_public_base_url(request)
    if base.startswith("https://"):
        ws_base = "wss://" + base[len("https://") :] + "/ws/exotel"
    else:
        ws_base = "ws://" + base[len("http://") :] + "/ws/exotel"
    
    # Pass metadata via the WS connection so we know the caller identity
    body = {
        "from": from_number,
        "to": to_number,
        "call_sid": call_sid,
        "direction": "inbound",
    }
    
    ws_url = build_websocket_url(ws_base, body)
    
    # Exotel Stream Applet expects a JSON response with the "url" key
    logger.debug(f"[exotel] Returning dynamic WebSocket URL: {ws_url}")
    return JSONResponse(content={"url": ws_url})


@router.api_route("/routing", methods=["GET", "POST"], operation_id="exotel_routing")
async def exotel_routing(request: Request) -> Response:
    """Decision endpoint for Exotel Passthru applet.
    
    If 'forward_to_human' is enabled in settings, returns 302 Found (routing to Connect Applet).
    Otherwise returns 200 OK (routing to Voicebot Applet).
    """
    try:
        db = get_db()
        settings_doc = await db["settings"].find_one()
        if settings_doc and settings_doc.get("forward_to_human", False):
            logger.info("[exotel/routing] Forward to human is ENABLED. Returning 302 Found for Connect applet.")
            return Response(status_code=302)
    except Exception as e:
        logger.error(f"[exotel/routing] Error checking forwarding settings: {e}")

    logger.info("[exotel/routing] Forward to human is DISABLED. Returning 200 OK for Voicebot applet.")
    return Response(status_code=200)


@router.api_route("/forward-number", methods=["GET", "POST"], operation_id="exotel_forward_number")
async def exotel_forward_number(request: Request) -> Response:
    """Returns the plain text destination phone number for Exotel Connect applet."""
    phone_number = ""
    try:
        db = get_db()
        settings_doc = await db["settings"].find_one()
        if settings_doc:
            phone_number = str(settings_doc.get("forward_phone_number", "") or "").strip()
    except Exception as e:
        logger.error(f"[exotel/forward-number] Error fetching forward phone number: {e}")

    # Fallback default if not configured in dashboard
    if not phone_number:
        phone_number = "+919876543210"

    logger.info(f"[exotel/forward-number] Returning destination number: {phone_number}")
    return PlainTextResponse(content=phone_number, status_code=200)

