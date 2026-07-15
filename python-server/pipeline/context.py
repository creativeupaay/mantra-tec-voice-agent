"""Parallel call context builder.

Fetches all context sources concurrently at call connect time.
Failed fetches are logged as warnings, never raised — the call
proceeds with whatever context was successfully retrieved.

Data sources (all run in parallel):
  - Our DB:   identity, customer memory, recent call history
  - Zoho CRM: lead, contact
  - Zoho Desk: open tickets (requires contact_id from CRM first)
"""

import asyncio
import pickle

from loguru import logger

from agent.state import CallState
from modules.calls.service import call_service
from modules.identity.service import identity_service
from services.crm import crm_service
from services.desk import desk_service


async def build_call_context(call_id: str, phone_number: str) -> CallState:
    """Fetch all context in parallel and return a populated CallState.

    If phone_number is 'unknown' (e.g. SmallWebRTC / browser test), all
    external fetches are skipped and an empty state is returned.
    """
    state = CallState(call_id=call_id, phone_number=phone_number)

    if phone_number in ("unknown", ""):
        logger.warning(f"[context] No phone number for call {call_id} — skipping context fetch")
        return state

    logger.info(f"[context] Fetching context for {phone_number} (call {call_id})")

    # ── Parallel fetch: DB + CRM ──────────────────────────────────────────────
    identity_r, lead_r, contact_r, calls_r = await asyncio.gather(
        identity_service.get_or_create(phone_number),
        crm_service.search_lead_by_phone(phone_number),
        crm_service.search_contact_by_phone(phone_number),
        call_service.get_recent_calls(phone_number, limit=3),
        return_exceptions=True,
    )

    # Populate state — skip anything that errored
    if isinstance(identity_r, Exception):
        logger.warning(f"[context] Identity fetch failed: {identity_r}")
    else:
        state.identity = identity_r

    if isinstance(lead_r, Exception):
        logger.warning(f"[context] CRM lead fetch failed: {lead_r}")
    else:
        state.crm_lead = lead_r

    if isinstance(contact_r, Exception):
        logger.warning(f"[context] CRM contact fetch failed: {contact_r}")
    else:
        state.crm_contact = contact_r

    if isinstance(calls_r, Exception):
        logger.warning(f"[context] Recent calls fetch failed: {calls_r}")
    else:
        state.recent_calls = calls_r or []

    # ── Sequential: Desk (needs Desk contact_id) ──────────────────────────────
    if state.crm_contact or state.crm_lead:
        try:
            desk_contact = await desk_service.find_contact(phone_number)
            if desk_contact:
                tickets = await desk_service.get_open_tickets(desk_contact["id"])
                state.open_tickets = tickets or []
        except Exception as e:
            logger.warning(f"[context] Desk fetch failed: {e}")

    # ── Preferred language from identity ──────────────────────────────────────
    if state.identity and state.identity.preferred_language:
        state.preferred_language = state.identity.preferred_language

    logger.info(
        f"[context] Ready — identity={state.identity is not None}, "
        f"crm_lead={state.crm_lead is not None}, "
        f"crm_contact={state.crm_contact is not None}, "
        f"tickets={len(state.open_tickets)}, "
        f"recent_calls={len(state.recent_calls)}, "
        f"lang={state.preferred_language}"
    )

    return state
