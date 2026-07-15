"""Redis async connection and cache helpers.

Graceful degradation: if Redis is unreachable on init, a warning is logged
and _redis remains None. Callers (e.g. Zoho OAuth token caching) wrap
get_redis() in try/except and fall back to in-memory alternatives.
"""

from redis.asyncio import Redis
from loguru import logger

from env_config import settings

_redis: Redis | None = None


async def init_redis() -> None:
    """Initialize the Redis connection.

    Safe to call multiple times — subsequent calls are no-ops.
    On failure, logs a warning but does NOT crash the process.
    """
    global _redis
    if _redis is not None:
        return

    logger.info("Connecting to Redis...")
    try:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
        await _redis.ping()
        logger.info("Redis ready")
    except Exception as e:
        logger.warning(
            f"Redis unavailable ({e}). "
            "Zoho OAuth token caching will fall back to in-memory storage."
        )
        _redis = None


async def close_redis() -> None:
    """Close the Redis connection gracefully."""
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> Redis:
    """Return the active Redis instance.

    Raises RuntimeError if Redis is not initialized or unavailable.
    Callers should wrap this in try/except for graceful fallback.
    """
    if _redis is None:
        raise RuntimeError("Redis not available.")
    return _redis


def is_redis_available() -> bool:
    """Return True if Redis is currently connected."""
    return _redis is not None
