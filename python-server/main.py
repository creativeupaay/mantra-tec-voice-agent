"""FastAPI server for Mantra Tech Voice Agent.

Provides the FastAPI application, lifespan events for database/redis initialization,
Plivo Answer/outbound HTTP endpoints, and the Plivo media WebSocket.
"""

import asyncio
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Request, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from config.database import init_db
from config.redis_client import init_redis
from env_config import settings
from pipeline.bot import run_bot
from routes.livekit import router as livekit_router
from routes.plivo import resolve_phone_from_stream_query
from routes.plivo import router as plivo_router
from routes.v1 import router as v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hook for startup and shutdown."""
    logger.info("[server] Starting up...")
    await init_db()
    await init_redis()
    yield
    logger.info("[server] Shutting down...")


app = FastAPI(lifespan=lifespan, title="Mantra Tech Voice Agent API")
app.include_router(v1_router)
app.include_router(plivo_router)
app.include_router(livekit_router)

# Mount static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/test", response_class=HTMLResponse)
async def test_page():
    """Serve the WebRTC test page."""
    with open("static/index.html", "r") as f:
        return f.read()


@app.post("/webrtc/offer")
async def webrtc_offer(request: Request):
    """Handle WebRTC offer from the browser test page."""
    data = await request.json()
    sdp = data["sdp"]
    type = data["type"]
    phone_number = request.query_params.get("phone_number", "unknown_webrtc")
    call_id = str(uuid.uuid4())

    connection = SmallWebRTCConnection()
    await connection.initialize(sdp=sdp, type=type)
    answer = connection.get_answer()

    # Start the bot in the background
    async def _run():
        transport = SmallWebRTCTransport(
            webrtc_connection=connection,
            params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
        )
        try:
            await run_bot(transport, call_id, phone_number)
        except Exception as e:
            logger.error(f"[webrtc] Bot crashed: {e}")

    asyncio.create_task(_run())

    return answer


@app.get("/health")
async def health_check():
    """Simple health check endpoint (Cloud Run / load balancers)."""
    return {"status": "ok"}


@app.websocket("/ws/plivo")
async def plivo_websocket_endpoint(
    websocket: WebSocket,
    body: str | None = Query(None, description="Base64 JSON with from/to/phone_number"),
):
    """WebSocket endpoint for Plivo bidirectional media streams.

    Phone numbers are not present in Plivo's stream ``start`` event (Pipecat
    only parses streamId/callId). The Answer XML attaches them via the ``body``
    query param so identity / CRM lookup still works.

    In-process AudioBuffer recording is unchanged — handled inside ``run_bot``.
    """
    await websocket.accept()

    try:
        from pipecat.serializers.plivo import PlivoFrameSerializer

        _, call_data = await parse_telephony_websocket(websocket)
        call_id = call_data.get("call_id", "unknown_call")
        phone_number, stream_body = resolve_phone_from_stream_query(
            body_param=body,
            call_data_from=call_data.get("from"),
        )

        logger.info(
            f"[server] Plivo WS connected — call_id={call_id} phone={phone_number} "
            f"direction={stream_body.get('direction', 'unknown')}"
        )

        if not settings.plivo_auth_id or not settings.plivo_auth_token:
            logger.warning(
                "[server] PLIVO_AUTH_ID/TOKEN missing — auto hang-up will fail"
            )

        serializer = PlivoFrameSerializer(
            stream_id=call_data["stream_id"],
            call_id=call_id,
            auth_id=settings.plivo_auth_id,
            auth_token=settings.plivo_auth_token,
        )

        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                serializer=serializer,
            ),
        )

        await run_bot(transport, call_id, phone_number)
    except Exception as e:
        logger.error(f"[server] WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
    )
