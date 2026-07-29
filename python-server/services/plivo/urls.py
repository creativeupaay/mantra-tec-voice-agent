"""Public HTTP / WebSocket URL resolution for Plivo callbacks."""

from fastapi import HTTPException, Request

from env_config import settings


def resolve_public_base_url(request: Request) -> str:
    """Resolve the externally reachable HTTPS base URL.

    Prefer ``PUBLIC_BASE_URL`` (required for reliable Cloud Run / load-balancer
    setups). Fall back to ``X-Forwarded-*`` / ``Host`` for local ngrok use.
    """
    configured = (settings.public_base_url or "").rstrip("/")
    if configured:
        return configured

    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or ""
    ).split(",")[0].strip()
    if not host:
        raise HTTPException(
            status_code=400,
            detail="Unable to determine public host; set PUBLIC_BASE_URL",
        )

    proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    if not proto:
        proto = (
            "http"
            if host.startswith("localhost") or host.startswith("127.0.0.1")
            else "https"
        )
    return f"{proto}://{host}"


def resolve_websocket_url(request: Request) -> str:
    """``wss://host/ws/plivo`` (or ``ws://`` for local)."""
    if settings.public_ws_url:
        return settings.public_ws_url.rstrip("/")

    base = resolve_public_base_url(request)
    if base.startswith("https://"):
        return "wss://" + base[len("https://") :] + "/ws/plivo"
    if base.startswith("http://"):
        return "ws://" + base[len("http://") :] + "/ws/plivo"
    raise HTTPException(status_code=500, detail="Invalid PUBLIC_BASE_URL scheme")
