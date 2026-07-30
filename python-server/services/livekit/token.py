"""LiveKit agent token factory.

Generates short-lived access tokens that allow the agent participant to join
a specific LiveKit room. Tokens are generated server-side and never exposed
publicly.

Imports from livekit.api are lazy (inside the function) so that if the
livekit extra is not installed the server still starts — the error only
surfaces when a token is actually requested.

Usage::

    token = generate_agent_token(room_name="my-room", participant_identity="agent")
"""

from env_config import settings


def generate_agent_token(
    room_name: str,
    participant_identity: str = "mantra-agent",
    participant_name: str = "Mantra AI Agent",
    ttl_seconds: int = 3600,
) -> str:
    """Generate a LiveKit access token for the agent to join a room.

    Args:
        room_name:             The LiveKit room to join.
        participant_identity:  Unique identity string for the agent participant.
        participant_name:      Human-readable display name shown in the room.
        ttl_seconds:           Token validity window in seconds (default: 1 hour).

    Returns:
        A signed JWT string accepted by any LiveKit server.

    Raises:
        ValueError: If LIVEKIT_API_KEY or LIVEKIT_API_SECRET are not configured.
        ImportError: If livekit-api is not installed (pipecat-ai[livekit] missing).
    """
    # Lazy import — keeps the module importable even without the livekit extra.
    try:
        from livekit.api import AccessToken, VideoGrants
    except ImportError as exc:
        raise ImportError(
            "livekit-api is not installed. Run: uv add \"pipecat-ai[livekit]\""
        ) from exc

    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise ValueError(
            "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set to generate agent tokens."
        )

    token = (
        AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_ttl(ttl_seconds)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )
    return token
