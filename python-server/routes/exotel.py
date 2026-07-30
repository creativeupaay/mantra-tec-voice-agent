"""Exotel telephony HTTP endpoints.

  POST /exotel/answer  — Answer URL; returns ExoML → /ws/exotel

Point your Exotel flow's Connect Applet / Stream Applet at ``/exotel/answer``.
"""

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import Response
from loguru import logger

from env_config import settings
from services.exotel.xml import build_stream_xml, build_websocket_url
from services.plivo.urls import resolve_websocket_url  # Reuse generic WS resolver

router = APIRouter(prefix="/exotel", tags=["exotel"])


def _exotel_params(request: Request, form: dict[str, Any] | None = None) -> dict[str, str]:
    """Merge query + form params Exotel sends on answer."""
    merged: dict[str, str] = {k: str(v) for k, v in request.query_params.items()}
    if form:
        for k, v in form.items():
            if v is not None and str(v) != "":
                merged[str(k)] = str(v)
    return merged


@router.post("/answer", operation_id="exotel_answer")
async def exotel_answer(request: Request) -> Response:
    """Webhook endpoint for Exotel inbound calls.
    
    Returns ExoML instructing Exotel to connect the audio stream to our WebSocket.
    """
    try:
        form_data = dict(await request.form())
    except Exception:
        form_data = {}

    params = _exotel_params(request, form_data)
    
    # Exotel typically sends 'From' and 'To'
    from_number = params.get("From", "unknown")
    to_number = params.get("To", "unknown")
    call_sid = params.get("CallSid", "unknown")
    
    logger.info(
        f"[exotel] Incoming call — CallSid={call_sid} From={from_number} To={to_number}"
    )

    # Base websocket URL (e.g., wss://my-app.run.app/ws/exotel)
    ws_base = resolve_websocket_url(request)
    ws_base = ws_base.replace("/exotel/answer", "/ws/exotel")
    
    # Pass metadata via the WS connection so we know the caller identity
    body = {
        "from": from_number,
        "to": to_number,
        "call_sid": call_sid,
        "direction": "inbound",
    }
    
    ws_url = build_websocket_url(ws_base, body)
    xml_response = build_stream_xml(ws_url)

    logger.debug(f"[exotel] Returning ExoML:\n{xml_response}")
    return Response(content=xml_response, media_type="application/xml")
