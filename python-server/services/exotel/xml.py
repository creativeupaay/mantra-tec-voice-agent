"""Exotel XML (ExoML) generation utilities.

ExoML is used to control call flows in Exotel. When Exotel sends a webhook to
our answer endpoint, we respond with ExoML instructing Exotel to connect the
audio to our WebSocket endpoint using AgentStream.
"""

import json
from typing import Any
from urllib.parse import urlencode


def build_websocket_url(ws_base: str, body: dict[str, Any] | None = None) -> str:
    """Constructs the WebSocket URL with optional query parameters.
    
    If body is provided, it is JSON-encoded and appended as the `body` query
    parameter so we can retrieve call context inside the WebSocket handler.
    """
    if not body:
        return ws_base
    
    encoded = urlencode({"body": json.dumps(body)})
    return f"{ws_base}?{encoded}"


def build_stream_xml(websocket_url: str) -> str:
    """Builds the ExoML response to stream bidirectional audio.
    
    Exotel uses the <Stream> tag (or <Connect><Stream>) for AgentStream.
    """
    # Note: Exotel's AgentStream uses <Response><Stream> or similar depending on the exact flow.
    # Typically <Response><Stream url="..."/></Response> is standard for simple streaming.
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream url="{websocket_url}" />
</Response>"""
