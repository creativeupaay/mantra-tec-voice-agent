"""Plivo Answer XML and stream-body helpers."""

import base64
import json
from typing import Any
from urllib.parse import urlencode


def encode_stream_body(data: dict[str, Any]) -> str:
    """Base64-encode JSON for the WebSocket ``body`` query param."""
    raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(raw).decode("utf-8")


def decode_stream_body(encoded: str | None) -> dict[str, Any]:
    """Decode the WebSocket ``body`` query param. Returns {} on failure."""
    if not encoded:
        return {}
    try:
        return json.loads(base64.b64decode(encoded).decode("utf-8"))
    except Exception:
        return {}


def build_websocket_url(ws_base: str, body: dict[str, Any] | None = None) -> str:
    """Build ``wss://…/ws/plivo`` URL with optional encoded body metadata."""
    if not body:
        return ws_base
    return f"{ws_base}?{urlencode({'body': encode_stream_body(body)})}"


def build_stream_xml(websocket_url: str) -> str:
    """Return Plivo Answer XML that opens a bidirectional audio stream.

    Uses μ-law 8 kHz to match ``PlivoFrameSerializer`` defaults.
    Recording remains in-process (Pipecat AudioBuffer) — do not add Plivo
    ``<Record>`` here or it will duplicate / conflict with our GCS upload path.
    """
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        '  <Stream bidirectional="true" keepCallAlive="true" '
        'contentType="audio/x-mulaw;rate=8000">\n'
        f"    {websocket_url}\n"
        "  </Stream>\n"
        "</Response>\n"
    )
