"""Centralized environment configuration.

This is the single source of truth for all environment variables.
Direct use of os.getenv anywhere else in the codebase is forbidden.

Feature flags (auto-detected from credentials unless explicitly overridden):
  zoho_enabled     — True if ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN are all set
                     or ZOHO_ENABLED=true. False if ZOHO_ENABLED=false.
  kb_enabled       — True by default (stub works). Set KB_ENABLED=false to disable.
  booking_enabled  — False by default (stub raises). Set BOOKING_ENABLED=true to enable.
"""

import os
from dataclasses import dataclass

from pathlib import Path
from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path, override=True)
load_dotenv(override=True)


@dataclass(frozen=True)
class Settings:
    # ── Plivo (telephony transport) ──────────────────────────────────────────
    plivo_auth_id: str
    plivo_auth_token: str
    plivo_phone_number: str  # Caller ID / Answer-app number (E.164)

    # ── LiveKit (WebRTC / SIP transport) ─────────────────────────────────────
    livekit_url: str         # e.g. wss://my-project.livekit.cloud
    livekit_api_key: str
    livekit_api_secret: str

    # ── Public URLs (Cloud Run / ngrok) ───────────────────────────────────────
    # Prefer explicit URLs so Plivo Answer/Stream work behind load balancers.
    public_base_url: str     # e.g. https://voice-agent-xxxx.run.app
    public_ws_url: str       # optional override, e.g. wss://….run.app/ws/plivo
    port: int

    # ── Deepgram (STT / optional TTS) ───────────────────────────────────────
    deepgram_api_key: str

    # ── ElevenLabs (TTS) ────────────────────────────────────────────────────
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    elevenlabs_model: str

    # ── Cartesia (TTS) ──────────────────────────────────────────────────────
    cartesia_api_key: str
    cartesia_model: str
    cartesia_voice_id: str

    # ── OpenRouter (LLM) ────────────────────────────────────────────────────
    openrouter_api_key: str
    openrouter_model: str

    # ── Voice mode ───────────────────────────────────────────────────────────
    # voice_mode: "classic" = Deepgram STT + OpenRouter + TTS
    #             "gemini_realtime" = future Gemini Live bridge
    voice_mode: str

    # ── Gemini Live / Realtime ──────────────────────────────────────────────
    gemini_api_key: str
    gemini_model: str
    gemini_voice_name: str
    gemini_language: str

    # ── TTS provider selection: "deepgram" | "elevenlabs" | "cartesia" ──────
    tts_provider: str

    # ── MongoDB ──────────────────────────────────────────────────────────────
    mongodb_uri: str
    mongodb_db_name: str

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str

    # ── Zoho OAuth ───────────────────────────────────────────────────────────
    zoho_client_id: str
    zoho_client_secret: str
    zoho_refresh_token: str
    zoho_accounts_url: str    # e.g. https://accounts.zoho.in
    zoho_crm_base_url: str   # e.g. https://www.zohoapis.in/crm/v2
    zoho_desk_base_url: str  # e.g. https://desk.zoho.in/api/v1
    zoho_desk_org_id: str

    # ── Knowledge Base ────────────────────────────────────────────────────────
    # KB_PROVIDER: "" = stub, "qdrant" = Qdrant
    kb_provider: str
    kb_collection: str       # collection / index name in the KB store
    qdrant_url: str          # Qdrant: http://localhost:6333
    qdrant_api_key: str      # Qdrant Cloud API key (optional)
    kb_max_fallback_chunks: int # Max chunks to retrieve in fallback mode

    # ── Booking ───────────────────────────────────────────────────────────────
    # BOOKING_PROVIDER: "" = stub, "google_calendar" = GCal, "zoho_bookings" = Zoho
    booking_provider: str
    google_calendar_id: str  # Google Calendar ID (if booking_provider=google_calendar)
    google_service_account_json: str  # Path to service account JSON

    # ── Feature Flags (derived — do not read directly, use settings.xxx_enabled) ──
    zoho_enabled: bool    # auto-detected or ZOHO_ENABLED override
    kb_enabled: bool      # KB_ENABLED (default: True — stub is functional)
    booking_enabled: bool # BOOKING_ENABLED (default: False — stub raises)

    # ── Call Recording Storage ─────────────────────────────────────────────
    storage_provider: str     # "s3", "local", or ""
    recording_bucket_name: str  # S3 bucket name
    recording_region: str       # S3 region
    aws_access_key_id: str        # AWS credentials
    aws_secret_access_key: str
    s3_endpoint_url: str          # For S3-compatible services (MinIO, etc.)
    gcp_project_id: str

    # ── Dashboard & Notifications ────────────────────────────────────────────
    dashboard_url: str        # Frontend / Dashboard URL for deep-links in emails
    resend_api_key: str
    from_email: str

    # ── Inactivity / Silence Detection ───────────────────────────────────────
    silence_timeout_initial: float  # Inactivity seconds before checking if caller is still there (e.g. 10s)
    silence_timeout_confirm: float  # Wait seconds after check before disconnecting (e.g. 6s)

    # ── App ──────────────────────────────────────────────────────────────────
    log_level: str


def _resolve_zoho_enabled(client_id: str, secret: str, refresh: str) -> bool:
    """Auto-detect Zoho availability from credentials, with optional override."""
    override = os.getenv("ZOHO_ENABLED", "").lower()
    if override == "false":
        return False
    if override == "true":
        return True
    # Auto: all three OAuth credentials must be present
    return bool(client_id and secret and refresh)


def _load() -> Settings:
    zoho_client_id = os.getenv("ZOHO_CLIENT_ID", "")
    zoho_client_secret = os.getenv("ZOHO_CLIENT_SECRET", "")
    zoho_refresh_token = os.getenv("ZOHO_REFRESH_TOKEN", "")
    kb_provider = os.getenv("KB_PROVIDER", "")
    booking_provider = os.getenv("BOOKING_PROVIDER", "")

    return Settings(
        # Plivo
        plivo_auth_id=os.getenv("PLIVO_AUTH_ID", ""),
        plivo_auth_token=os.getenv("PLIVO_AUTH_TOKEN", ""),
        plivo_phone_number=os.getenv("PLIVO_PHONE_NUMBER", ""),
        # LiveKit
        livekit_url=os.getenv("LIVEKIT_URL", "").rstrip("/"),
        livekit_api_key=os.getenv("LIVEKIT_API_KEY", ""),
        livekit_api_secret=os.getenv("LIVEKIT_API_SECRET", ""),
        # Public URLs
        public_base_url=os.getenv("PUBLIC_BASE_URL", "").rstrip("/"),
        public_ws_url=os.getenv("PUBLIC_WS_URL", "").rstrip("/"),
        port=int(os.getenv("PORT", "8000")),
        # Deepgram
        deepgram_api_key=os.getenv("DEEPGRAM_API_KEY", ""),
        # ElevenLabs
        elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY", ""),
        elevenlabs_voice_id=os.getenv("ELEVENLABS_VOICE_ID", ""),
        elevenlabs_model=os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5"),
        # Cartesia
        cartesia_api_key=os.getenv("CARTESIA_API_KEY", ""),
        cartesia_model=os.getenv("CARTESIA_MODEL", "sonic-3.5"),
        cartesia_voice_id=os.getenv("CARTESIA_VOICE_ID", "e00d0e4c-a5c8-443f-a8a3-473eb9a62355"),
        # OpenRouter
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
        openrouter_model=os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-5-sonnet"),
        # Voice mode
        voice_mode=os.getenv("VOICE_MODE", "classic").lower(),
        # Gemini Live / Realtime
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.8-live"),
        gemini_voice_name=os.getenv("GEMINI_VOICE_NAME", "Aoede"),
        gemini_language=os.getenv("GEMINI_LANGUAGE", "hi-IN"),
        # TTS
        tts_provider=os.getenv("TTS_PROVIDER", "deepgram").lower(),
        # MongoDB
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017"),
        mongodb_db_name=os.getenv("MONGODB_DB_NAME", "mantra_voice_agent"),
        # Redis
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
        # Zoho
        zoho_client_id=zoho_client_id,
        zoho_client_secret=zoho_client_secret,
        zoho_refresh_token=zoho_refresh_token,
        zoho_accounts_url=os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com"),
        zoho_crm_base_url=os.getenv("ZOHO_CRM_BASE_URL", "https://www.zohoapis.com/crm/v2"),
        zoho_desk_base_url=os.getenv("ZOHO_DESK_BASE_URL", "https://desk.zoho.in/api/v1"),
        zoho_desk_org_id=os.getenv("ZOHO_DESK_ORG_ID", ""),
        # Knowledge Base
        kb_provider=kb_provider,
        kb_collection=os.getenv("KB_COLLECTION", "knowledge_base"),
        qdrant_url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        qdrant_api_key=os.getenv("QDRANT_API_KEY", ""),
        kb_max_fallback_chunks=int(os.getenv("KB_MAX_FALLBACK_CHUNKS", "15")),
        # Booking
        booking_provider=booking_provider,
        google_calendar_id=os.getenv("GOOGLE_CALENDAR_ID", ""),
        google_service_account_json=os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", ""),
        # Feature flags (derived)
        zoho_enabled=_resolve_zoho_enabled(zoho_client_id, zoho_client_secret, zoho_refresh_token),
        kb_enabled=os.getenv("KB_ENABLED", "true").lower() != "false",
        booking_enabled=os.getenv("BOOKING_ENABLED", "false").lower() == "true",
        # Call Recording Storage
        storage_provider=os.getenv("STORAGE_PROVIDER", "gcs"),  # "s3", "local", or "gcs"
        recording_bucket_name=os.getenv("RECORDING_BUCKET_NAME", ""),
        recording_region=os.getenv("RECORDING_REGION", "us-east-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
        s3_endpoint_url=os.getenv("S3_ENDPOINT_URL", ""),
        gcp_project_id=os.getenv("GCP_PROJECT_ID", ""),
        # Dashboard & Notifications
        dashboard_url=(os.getenv("DASHBOARD_URL") or os.getenv("CLIENT_URL") or "http://localhost:5173").rstrip("/"),
        resend_api_key=os.getenv("RESEND_API_KEY", ""),
        from_email=os.getenv("FROM_EMAIL", "noreply@creativeupaay.in"),
        # Inactivity / Silence Detection
        silence_timeout_initial=float(os.getenv("SILENCE_TIMEOUT_INITIAL_SECONDS", "20.0")),
        silence_timeout_confirm=float(os.getenv("SILENCE_TIMEOUT_CONFIRM_SECONDS", "15.0")),
        # App
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )


settings: Settings = _load()
