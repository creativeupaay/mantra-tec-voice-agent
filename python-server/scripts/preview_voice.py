"""Voice preview script for Gemini / Pipecat voice agent.

Usage:
    uv run python scripts/preview_voice.py
    uv run python scripts/preview_voice.py --voice Kore
    uv run python scripts/preview_voice.py --voice Aoede
    uv run python scripts/preview_voice.py --text "Hello, thank you for calling Mantra Tech."
"""

import argparse
import subprocess
import wave
import sys
from pathlib import Path
from google import genai
from google.genai import types

# Add parent directory to path to load env_config
sys.path.insert(0, str(Path(__file__).parent.parent))
from env_config import settings


def preview_voice(voice_name: str, text: str, output_file: str, play: bool = True):
    print(f"🎙️ Generating preview for voice: '{voice_name}'...")
    print(f"📝 Text: \"{text}\"")

    client = genai.Client(api_key=settings.gemini_api_key)

    resp = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name
                    )
                )
            ),
        ),
    )

    audio_bytes = resp.candidates[0].content.parts[0].inline_data.data
    out_path = Path(output_file)

    with wave.open(str(out_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(24000)
        wav_file.writeframes(audio_bytes)

    print(f" Audio saved to: {out_path.resolve()}")

    if play:
        print(f" Playing audio via macOS afplay...")
        try:
            subprocess.run(["afplay", str(out_path)], check=True)
        except Exception as e:
            print(f"Notice: afplay returned: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Preview voice output")
    parser.add_argument(
        "--voice",
        default=settings.gemini_voice_name or "Aoede",
        help="Gemini voice name (e.g. Aoede, Kore, Fenrir, Erinome)",
    )
    parser.add_argument(
        "--text",
        default="Hello, thank you for calling Mantra Tech, I am Priya. How can I help you today?",
        help="Text to synthesize",
    )
    parser.add_argument(
        "--output",
        default="preview.wav",
        help="Output WAV file path",
    )
    parser.add_argument(
        "--no-play",
        action="store_true",
        help="Skip playing through system speakers",
    )

    args = parser.parse_args()
    preview_voice(args.voice, args.text, args.output, play=not args.no_play)
