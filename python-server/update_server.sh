#!/usr/bin/env bash
# ==============================================================================
# Mantra Tech Voice Agent — VM Update Script for Python Server
# ==============================================================================
# Usage:
#   cd /path/to/mantra-tec-voice-agent/main/python-server
#   bash update_server.sh
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=================================================================="
echo "🚀 Updating Mantra Tech Voice Agent Python Server"
echo "=================================================================="
echo "Script directory: ${SCRIPT_DIR}"
echo "Repository root:  ${ROOT_DIR}"
echo ""

# ── 1. Pull latest code from Git ──────────────────────────────────────────────
echo "📥 Step 1: Pulling latest changes from Git..."
cd "${ROOT_DIR}"
git pull origin main
echo "✅ Git pull complete."
echo ""

cd "${SCRIPT_DIR}"

# ── 2. Detect Deployment Method & Apply Updates ─────────────────────────────────
echo "🔍 Step 2: Detecting deployment environment..."

DOCKER_CONTAINER=""
if command -v docker >/dev/null 2>&1; then
    # Look for running container matching voice-agent or python-server
    DOCKER_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "mantra.*voice|voice.*agent|python.*server" | head -n 1 || true)
fi

# A) DOCKER CONTAINER DEPLOYMENT
if [ -n "${DOCKER_CONTAINER}" ]; then
    echo "🐳 Detected running Docker container: ${DOCKER_CONTAINER}"
    echo "🔨 Rebuilding Docker image..."
    
    IMAGE_NAME="mantra-voice-agent"
    docker build -t "${IMAGE_NAME}" .
    
    echo "🔄 Recreating and restarting container ${DOCKER_CONTAINER}..."
    # Inspect port and env-file / env mapping
    HOST_PORT=$(docker port "${DOCKER_CONTAINER}" 8080 2>/dev/null | head -n 1 | awk -F: '{print $NF}' || echo "8080")
    if [ -z "${HOST_PORT}" ]; then
        HOST_PORT="8080"
    fi
    
    echo "Stopping old container..."
    docker stop "${DOCKER_CONTAINER}" || true
    docker rm "${DOCKER_CONTAINER}" || true
    
    echo "Starting new container with updated image..."
    if [ -f ".env" ]; then
        docker run -d \
            --name "${DOCKER_CONTAINER}" \
            --restart always \
            -p "${HOST_PORT}:8080" \
            --env-file .env \
            "${IMAGE_NAME}"
    else
        echo "⚠️ Warning: .env file not found in ${SCRIPT_DIR}. Starting with defaults..."
        docker run -d \
            --name "${DOCKER_CONTAINER}" \
            --restart always \
            -p "${HOST_PORT}:8080" \
            "${IMAGE_NAME}"
    fi
    echo "✅ Docker container restarted."

# B) DOCKER COMPOSE DEPLOYMENT
elif [ -f "${ROOT_DIR}/docker-compose.yml" ] || [ -f "${SCRIPT_DIR}/docker-compose.yml" ]; then
    echo "📦 Detected Docker Compose deployment."
    echo "🔨 Rebuilding and restarting service..."
    if [ -f "${ROOT_DIR}/docker-compose.yml" ]; then
        cd "${ROOT_DIR}"
        docker compose build python-server || docker compose build
        docker compose up -d --no-deps python-server || docker compose up -d
    else
        docker compose build
        docker compose up -d
    fi
    echo "✅ Docker Compose service updated."

# C) SYSTEMD SERVICE DEPLOYMENT
elif command -v systemctl >/dev/null 2>&1 && (systemctl is-active --quiet mantra-voice-agent || systemctl is-active --quiet python-server); then
    SERVICE_NAME="mantra-voice-agent"
    if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
        SERVICE_NAME="python-server"
    fi
    echo "⚙️ Detected active systemd service: ${SERVICE_NAME}"
    
    if command -v uv >/dev/null 2>&1; then
        echo "Syncing Python virtualenv..."
        uv sync --frozen --no-dev
    fi
    
    echo "Restarting systemd service..."
    sudo systemctl restart "${SERVICE_NAME}"
    echo "✅ systemd service restarted."

# D) PM2 DEPLOYMENT
elif command -v pm2 >/dev/null 2>&1 && pm2 list | grep -qE "voice-agent|python-server"; then
    echo "🟢 Detected PM2 deployment."
    if command -v uv >/dev/null 2>&1; then
        echo "Syncing Python virtualenv..."
        uv sync --frozen --no-dev
    fi
    PM2_APP=$(pm2 list | grep -oE "mantra[a-zA-Z0-9_-]*|python[a-zA-Z0-9_-]*" | head -n 1)
    echo "Restarting PM2 process ${PM2_APP}..."
    pm2 restart "${PM2_APP}"
    echo "✅ PM2 process restarted."

# E) DIRECT UV / STANDALONE DEPLOYMENT
else
    echo "🐍 No container or service manager detected. Updating virtual environment directly..."
    if command -v uv >/dev/null 2>&1; then
        uv sync --frozen --no-dev
        echo "✅ uv sync complete."
    elif [ -d ".venv" ]; then
        source .venv/bin/activate
        pip install -r <(python -c "import tomli; ..." 2>/dev/null) 2>/dev/null || true
    fi
    
    # Check if a standalone uvicorn process is running
    UVICORN_PID=$(pgrep -f "uvicorn main:app" || true)
    if [ -n "${UVICORN_PID}" ]; then
        echo "Restarting uvicorn process (PID ${UVICORN_PID})..."
        kill -HUP "${UVICORN_PID}" 2>/dev/null || kill "${UVICORN_PID}" 2>/dev/null || true
        sleep 2
        nohup uv run uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" > server.log 2>&1 &
        echo "✅ uvicorn restarted in background."
    else
        echo "ℹ️ Note: No running uvicorn process detected."
        echo "You can start it with: uv run uvicorn main:app --host 0.0.0.0 --port 8000"
    fi
fi

echo ""
# ── 3. Health Check ───────────────────────────────────────────────────────────
echo "🏥 Step 3: Checking service health..."
sleep 3

PORT_TO_TEST="${PORT:-8000}"
if [ -n "${HOST_PORT}" ]; then
    PORT_TO_TEST="${HOST_PORT}"
fi

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT_TO_TEST}/health" 2>/dev/null || echo "failed")

if [ "${HEALTH_STATUS}" = "200" ]; then
    echo "🎉 SUCCESS: Service is healthy and responding (HTTP 200) on port ${PORT_TO_TEST}!"
else
    echo "⚠️ Warning: Health check on http://localhost:${PORT_TO_TEST}/health returned: ${HEALTH_STATUS}."
    echo "Please check your server logs (e.g., docker logs <container> or journalctl -u <service> -n 50)."
fi

echo ""
echo "=================================================================="
echo "✨ Update Finished!"
echo "=================================================================="
