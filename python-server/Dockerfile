# Mantra Tech Voice Agent — Cloud Run image
#
# Build (from python-server/):
#   docker build -t mantra-voice-agent .
#
# Run locally:
#   docker run --rm -p 8080:8080 --env-file .env \
#     -e PORT=8080 -e PUBLIC_BASE_URL=http://localhost:8080 mantra-voice-agent
#
# Cloud Run notes:
#   - Set PUBLIC_BASE_URL to the service HTTPS URL (required for Plivo Answer XML)
#   - Enable WebSockets (default on Cloud Run); request timeout ≥ max call length
#   - Attach a GCS-capable service account when STORAGE_PROVIDER=gcs
#   - Plivo Application Answer URL: https://<service>/plivo/answer

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

# onnxruntime / Silero VAD / fastembed
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

COPY . .

RUN uv sync --frozen --no-dev


FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

# Runtime shared libs only (no compilers)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
        ca-certificates \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libxcb1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home /app --shell /usr/sbin/nologin app

# Copy the virtualenv and application from the builder
COPY --from=builder --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    # Ensure local recording fallback dir is writable if STORAGE_PROVIDER=local
    HOME=/app

# Local storage fallback path (GCS/S3 preferred in production)
RUN mkdir -p /app/recordings /app/static \
    && chown -R app:app /app/recordings /app/static

USER app

EXPOSE 8080

# Cloud Run injects PORT; health checks hit /health
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --timeout-keep-alive 75 --ws-ping-interval 20 --ws-ping-timeout 20"]
