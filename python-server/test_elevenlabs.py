import asyncio
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from env_config import settings

async def main():
    tts = ElevenLabsTTSService(
        api_key=settings.elevenlabs_api_key,
        voice_id=settings.elevenlabs_voice_id,
    )
    print("TTS init OK")

asyncio.run(main())
