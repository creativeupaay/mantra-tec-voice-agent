"""MongoDB async connection, database access, and index management.

Graceful degradation: if MongoDB is unreachable on init, a warning is logged
and _db remains None. All services that call get_db() will raise RuntimeError,
which the context builder catches via return_exceptions=True — the call
continues with an empty state.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from loguru import logger

from env_config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def init_db() -> None:
    """Initialize MongoDB connection and ensure indexes exist.

    Safe to call multiple times — subsequent calls are no-ops.
    On failure, logs a warning but does NOT crash the process.
    """
    global _client, _db
    if _db is not None:
        return  # Already initialized

    logger.info("Connecting to MongoDB...")
    try:
        _client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,   # fail fast if unreachable
        )
        _db = _client[settings.mongodb_db_name]
        # Ping to verify connectivity before declaring success
        await _db.command("ping")
        await _ensure_indexes()
        logger.info(f"MongoDB ready: {settings.mongodb_db_name}")
    except Exception as e:
        logger.warning(
            f"MongoDB unavailable ({e}). "
            "Caller identity and call history storage will be disabled for this session."
        )
        _client = None
        _db = None


async def close_db() -> None:
    """Close the MongoDB connection gracefully."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed")


async def _ensure_indexes() -> None:
    """Create all required collection indexes (idempotent)."""
    db = get_db()

    # identities: unique lookup by phone number
    await db.identities.create_index("phone_number", unique=True)

    # calls: lookup by phone + time, and by unique plivo call_id
    await db.calls.create_index([("phone_number", 1), ("timestamp", -1)])
    await db.calls.create_index("call_id", unique=True)

    # memory: unique long-term record per phone number
    await db.memory.create_index("phone_number", unique=True)

    # users: unique email lookup
    await db.users.create_index("email", unique=True)

    # voice_agents: lookup by status and phone number
    await db.voice_agents.create_index("status")
    await db.voice_agents.create_index("phone_number", unique=True, sparse=True)

    # sessions: lookup by call_id, agent_id, phone_number
    await db.sessions.create_index("call_id", unique=True)
    await db.sessions.create_index("agent_id")
    await db.sessions.create_index("phone_number")

    # credit_usage: lookup by call_id and time (supports both Python + Mongoose timestamp fields)
    await db.credit_usage.create_index([("call_id", 1), ("createdAt", -1)])
    await db.credit_usage.create_index([("call_id", 1), ("created_at", -1)])

    logger.info("MongoDB indexes ensured")


def get_db() -> AsyncIOMotorDatabase:
    """Return the active database instance.

    Raises RuntimeError if MongoDB is not initialized or unavailable.
    The context builder catches this via return_exceptions=True.
    """
    if _db is None:
        raise RuntimeError("MongoDB not available — call history and identity features are offline.")
    return _db


def is_db_available() -> bool:
    """Return True if MongoDB is currently connected."""
    return _db is not None
