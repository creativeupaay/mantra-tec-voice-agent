"""Plivo REST API client (outbound calls)."""

from typing import Any

import httpx
from loguru import logger

from env_config import settings


async def make_outbound_call(
    *,
    to_number: str,
    from_number: str,
    answer_url: str,
    answer_method: str = "POST",
    hangup_url: str | None = None,
) -> dict[str, Any]:
    """Place an outbound call via Plivo Voice API.

    Returns the Plivo API JSON body (includes ``request_uuid`` on success).
    """
    auth_id = settings.plivo_auth_id
    auth_token = settings.plivo_auth_token
    if not auth_id or not auth_token:
        raise ValueError("PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN must be set")

    payload: dict[str, Any] = {
        "to": to_number,
        "from": from_number,
        "answer_url": answer_url,
        "answer_method": answer_method,
    }
    if hangup_url:
        payload["hangup_url"] = hangup_url
        payload["hangup_method"] = "POST"

    url = f"https://api.plivo.com/v1/Account/{auth_id}/Call/"
    logger.info(f"[plivo] Initiating outbound call to={to_number} from={from_number}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            json=payload,
            auth=(auth_id, auth_token),
            headers={"Content-Type": "application/json"},
        )

    if response.status_code != 201:
        raise RuntimeError(
            f"Plivo API error ({response.status_code}): {response.text}"
        )

    result = response.json()
    logger.info(
        f"[plivo] Call initiated — request_uuid={result.get('request_uuid')}"
    )
    return result
