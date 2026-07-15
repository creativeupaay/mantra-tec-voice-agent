"""FastAPI server for Mantra Tech Voice Agent.

Provides the FastAPI application, lifespan events for database/redis initialization,
and WebSocket endpoints for Plivo telephony integration.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
import uuid
import asyncio

from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.base_transport import TransportParams

from config.database import init_db
from config.redis_client import init_redis
from pipeline.bot import run_bot
from env_config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hook for startup and shutdown."""
    logger.info("[server] Starting up...")
    await init_db()
    await init_redis()
    yield
    logger.info("[server] Shutting down...")


from routes.v1 import router as v1_router

app = FastAPI(lifespan=lifespan, title="Mantra Tech Voice Agent API")
app.include_router(v1_router)

# Mount static files
import os
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
    """Simple health check endpoint."""
    return {"status": "ok"}


@app.websocket("/ws/plivo")
async def plivo_websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for Plivo media streams."""
    await websocket.accept()

    try:
        from pipecat.serializers.plivo import PlivoFrameSerializer
        
        _, call_data = await parse_telephony_websocket(websocket)
        call_id = call_data.get("call_id", "unknown_call")
        phone_number = call_data.get("from", "unknown")

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
        await websocket.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
