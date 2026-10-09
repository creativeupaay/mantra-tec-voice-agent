"""Plivo telephony HTTP endpoints.

  GET/POST /plivo/answer  — Answer URL; returns Stream XML → /ws/plivo
  POST     /plivo/call    — Initiate an outbound agent call
  POST     /plivo/hangup  — Optional hangup / status callback (logging only)

Point your Plivo Application's Answer URL at ``/plivo/answer``.
"""

import json
from typing import Any, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from loguru import logger
from pydantic import BaseModel, Field

from env_config import settings
from services.plivo.client import make_outbound_call
from services.plivo.urls import resolve_public_base_url, resolve_websocket_url
from services.plivo.xml import build_stream_xml, build_websocket_url, decode_stream_body

router = APIRouter(prefix="/plivo", tags=["plivo"])


class OutboundCallRequest(BaseModel):
    """Body for POST /plivo/call."""

    phone_number: str = Field(..., description="Customer E.164 number to dial")
    from_number: Optional[str] = Field(
        None, description="Caller ID (defaults to PLIVO_PHONE_NUMBER)"
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Optional metadata forwarded into the stream session body",
    )


def _plivo_params(request: Request, form: dict[str, Any] | None = None) -> dict[str, str]:
    """Merge query + form params Plivo sends on answer/hangup."""
    merged: dict[str, str] = {k: str(v) for k, v in request.query_params.items()}
    if form:
        for k, v in form.items():
            if v is not None and str(v) != "":
                merged[str(k)] = str(v)
    return merged


def _customer_phone(*, direction: str, from_number: str, to_number: str) -> str:
    """Identity key: inbound caller = From; outbound customer = To."""
    if direction == "outbound":
        return to_number or from_number or "unknown"
    return from_number or "unknown"


async def _answer_xml(request: Request) -> Response:
    form_data: dict[str, Any] | None = None
    if request.method == "POST":
        try:
            form = await request.form()
            form_data = dict(form)
        except Exception:
            form_data = None

    params = _plivo_params(request, form_data)
    call_uuid = params.get("CallUUID", "")
    from_number = params.get("From", "")
    to_number = params.get("To", "")

    # Outbound initiation may attach direction/metadata via answer_url query.
    direction = params.get("direction", "inbound")
    extra_meta: dict[str, Any] = {}
    raw_body = params.get("body_data")
    if raw_body:
        try:
            # Query params are already URL-decoded by Starlette.
            extra_meta = json.loads(raw_body)
            if isinstance(extra_meta, dict) and "direction" in extra_meta:
                direction = str(extra_meta.get("direction") or direction)
        except Exception:
            logger.warning("[plivo] Failed to parse body_data on answer URL")

    phone_number = _customer_phone(
        direction=direction, from_number=from_number, to_number=to_number
    )

    body: dict[str, Any] = {
        "direction": direction,
        "from": from_number,
        "to": to_number,
        "phone_number": phone_number,
        "call_uuid": call_uuid,
    }
    if isinstance(extra_meta, dict):
        # Keep telephony fields authoritative; merge optional metadata.
        for key, value in extra_meta.items():
            if key not in body or not body[key]:
                body[key] = value

    ws_base = resolve_websocket_url(request)
    ws_url = build_websocket_url(ws_base, body)
    xml = build_stream_xml(ws_url)

    logger.info(
        f"[plivo] Answer XML — direction={direction} call={call_uuid} "
        f"from={from_number} to={to_number} phone={phone_number}"
    )
    return Response(content=xml, media_type="application/xml")


@router.get("/answer", operation_id="plivo_answer_get")
@router.post("/answer", operation_id="plivo_answer_post")
async def plivo_answer(request: Request):
    """Plivo Answer URL — returns bidirectional Stream XML."""
    try:
        return await _answer_xml(request)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[plivo] Answer XML failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build answer XML: {e}")


@router.post("/call", operation_id="plivo_call")
@router.post("/start", operation_id="plivo_start")
async def initiate_outbound_call(payload: OutboundCallRequest, request: Request):
    """Initiate an outbound call; Plivo fetches /plivo/answer on pickup."""
    to_number = payload.phone_number.strip()
    if not to_number:
        raise HTTPException(status_code=400, detail="phone_number is required")

    from_number = (payload.from_number or settings.plivo_phone_number or "").strip()
    if not from_number:
        raise HTTPException(
            status_code=400,
            detail="from_number missing; set PLIVO_PHONE_NUMBER or pass from_number",
        )

    if not settings.plivo_auth_id or not settings.plivo_auth_token:
        raise HTTPException(
            status_code=500,
            detail="PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN must be configured",
        )

    base = resolve_public_base_url(request)
    body_data = {
        "direction": "outbound",
        "phone_number": to_number,
        "from": from_number,
        "to": to_number,
        **(payload.metadata or {}),
    }
    answer_qs = urlencode(
        {
            "direction": "outbound",
            "body_data": json.dumps(body_data, separators=(",", ":")),
        }
    )
    answer_url = f"{base}/plivo/answer?{answer_qs}"
    hangup_url = f"{base}/plivo/hangup"

    try:
        result = await make_outbound_call(
            to_number=to_number,
            from_number=from_number,
            answer_url=answer_url,
            answer_method="POST",
            hangup_url=hangup_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"[plivo] Outbound call failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {e}")

    call_uuid = (
        result.get("request_uuid")
        or result.get("message_uuid")
        or result.get("call_uuid")
        or "unknown"
    )
    return JSONResponse(
        {
            "status": "call_initiated",
            "call_uuid": call_uuid,
            "phone_number": to_number,
            "from_number": from_number,
            "plivo": result,
        }
    )


@router.get("/hangup", operation_id="plivo_hangup_get")
@router.post("/hangup", operation_id="plivo_hangup_post")
async def plivo_hangup(request: Request):
    """Optional hangup/status callback — logs only; recording is in-process."""
    form_data: dict[str, Any] | None = None
    if request.method == "POST":
        try:
            form = await request.form()
            form_data = dict(form)
        except Exception:
            form_data = None

    params = _plivo_params(request, form_data)
    logger.info(
        f"[plivo] Hangup callback — CallUUID={params.get('CallUUID')} "
        f"Duration={params.get('Duration')} HangupCause={params.get('HangupCause')} "
        f"From={params.get('From')} To={params.get('To')}"
    )
    return Response(content="OK", media_type="text/plain")


def resolve_phone_from_stream_query(
    *,
    body_param: str | None,
    call_data_from: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """Resolve customer phone from WS query ``body`` (preferred) or call_data."""
    body = decode_stream_body(body_param)
    phone = (
        body.get("phone_number")
        or _customer_phone(
            direction=str(body.get("direction") or "inbound"),
            from_number=str(body.get("from") or ""),
            to_number=str(body.get("to") or ""),
        )
    )
    if not phone or phone == "unknown":
        phone = call_data_from or "unknown"
    return phone, body
