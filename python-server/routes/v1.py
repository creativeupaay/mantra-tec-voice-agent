"""v1 API routes — internal management and inspection endpoints.

These endpoints are NOT caller-facing. They are used by internal dashboards,
monitoring, and post-call automation triggers.
"""

from fastapi import APIRouter, HTTPException, Query

from modules.calls.service import call_service
from modules.identity.model import IdentityUpdate
from modules.identity.service import identity_service

router = APIRouter(prefix="/v1")


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health", tags=["infra"])
async def health():
    return {"status": "ok", "service": "mantra-tech-voice-agent"}


# ── Identity ──────────────────────────────────────────────────────────────────

@router.get("/identity/{phone_number}", tags=["identity"])
async def get_identity(phone_number: str):
    identity = await identity_service.get_by_phone(phone_number)
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")
    return identity.model_dump(by_alias=False, exclude_none=True)


@router.patch("/identity/{phone_number}", tags=["identity"])
async def update_identity(phone_number: str, data: IdentityUpdate):
    identity = await identity_service.update_profile(phone_number, data)
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")
    return identity.model_dump(by_alias=False, exclude_none=True)


# ── Calls ─────────────────────────────────────────────────────────────────────

@router.get("/calls/{phone_number}/recent", tags=["calls"])
async def get_recent_calls(
    phone_number: str,
    limit: int = Query(default=3, ge=1, le=20),
):
    calls = await call_service.get_recent_calls(phone_number, limit)
    return [c.model_dump(by_alias=False, exclude_none=True) for c in calls]


@router.get("/calls/detail/{call_id}", tags=["calls"])
async def get_call(call_id: str):
    call = await call_service.get_call(call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call.model_dump(by_alias=False, exclude_none=True)


