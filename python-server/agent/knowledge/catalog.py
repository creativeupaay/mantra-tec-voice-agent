"""Product catalog loader and lookup used by the search_products tool.

Product facts live in catalog.yaml, not in the system prompt. The realtime model
only ever sees the two or three entries relevant to the caller's question, as a
short tool result, so the prompt stays the same size however big the catalog gets.

Lookup is deterministic (no LLM call): Gemini Live 3.x blocks the conversation
while a tool runs, so every millisecond here is dead air on the phone line.
"""

import re
from pathlib import Path
from typing import Any, Optional

import yaml
from loguru import logger

_PATH = Path(__file__).with_name("catalog.yaml")
_cache: dict[str, Any] = {"mtime": None, "data": None, "index": None}

# Tokens that look like model codes but are specs, not products.
_SPEC_TOKENS = {"l0", "l1", "fap10", "fap20", "fap30", "usb2", "usb3", "ip65", "ip67", "rd"}

_SYNONYMS = {
    "aadhar": "aadhaar", "adhaar": "aadhaar", "adhar": "aadhaar", "uidai": "aadhaar",
    "finger": "fingerprint", "fingerprints": "fingerprint", "thumb": "fingerprint",
    "angutha": "fingerprint", "anguthe": "fingerprint", "biometric": "fingerprint",
    "eye": "iris", "eyes": "iris", "aankh": "iris", "retina": "iris",
    "facial": "face", "chehra": "face",
    "attendence": "attendance", "haziri": "attendance", "hajri": "attendance",
    "machines": "machine", "devices": "device", "scanners": "scanner",
}

_NON_AADHAAR = re.compile(
    r"\b(non|without|bina|not|no)[\s_-]*(aadhaar|aadhar|adhaar|adhar)\b|nonaadhaar|nonaadhar"
)

_STOPWORDS = {
    "a", "an", "the", "for", "of", "and", "or", "to", "in", "on", "with", "is", "i", "we",
    "need", "want", "chahiye", "ka", "ki", "ke", "hai", "price", "rate", "kitna", "buy",
    "purchase", "available", "device", "product", "mantra", "about", "use", "based",
}


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _norm(text: str) -> str:
    return "".join(_tokens(text))


def _load() -> dict[str, Any]:
    """Load catalog.yaml, reloading when the file changes. Keeps the last good copy on error."""
    try:
        mtime = _PATH.stat().st_mtime
        if _cache["mtime"] != mtime:
            data = yaml.safe_load(_PATH.read_text(encoding="utf-8"))
            index: dict[str, dict] = {}
            for product in data.get("products", []):
                for code in [product["name"], *product.get("codes", [])]:
                    index[_norm(code)] = product
            _cache.update(mtime=mtime, data=data, index=index)
            logger.info(f"[catalog] Loaded {len(data.get('products', []))} products from {_PATH.name}")
    except Exception as e:
        if _cache["data"] is None:
            raise
        logger.error(f"[catalog] Failed to reload {_PATH.name}, keeping previous version: {e}")
    return _cache["data"]


def _named_matches(tokens: list[str], index: dict[str, dict]) -> list[dict]:
    """Products whose code equals a contiguous run of query tokens ("mfs 500 lx" → MFS500-LX)."""
    hits: dict[str, dict] = {}
    for i in range(len(tokens)):
        joined = ""
        for j in range(i, min(len(tokens), i + 5)):
            joined += tokens[j]
            if joined in index:
                hits[joined] = index[joined]
    # Drop shorter codes contained in a longer hit for another product (MFS500 inside MFS500-LX).
    kept = [
        code for code in hits
        if not any(code != other and code in other and hits[other] is not hits[code] for other in hits)
    ]
    products: list[dict] = []
    for code in sorted(kept, key=len, reverse=True):
        if not any(p is hits[code] for p in products):
            products.append(hits[code])
    return products


def _unknown_model_code(tokens: list[str]) -> Optional[str]:
    """Return something that looks like a model code ("MFS300", "xyz 9"), if the caller said one."""
    for i, tok in enumerate(tokens):
        candidate = tok
        if re.fullmatch(r"[a-z]{2,}", tok) and i + 1 < len(tokens) and tokens[i + 1].isdigit():
            candidate = tok + tokens[i + 1]
        if re.fullmatch(r"[a-z]{2,}\d{2,}[a-z0-9]*", candidate) and candidate not in _SPEC_TOKENS:
            return candidate.upper()
    return None


def _need_matches(query: str, products: list[dict]) -> tuple[list[dict], Optional[bool]]:
    """Score products against a need description ("non aadhaar fingerprint scanner")."""
    lowered = query.lower()
    want_aadhaar: Optional[bool] = None
    if _NON_AADHAAR.search(lowered):
        want_aadhaar = False
        lowered = _NON_AADHAAR.sub(" non_aadhaar ", lowered)
    words = {_SYNONYMS.get(t, t) for t in re.findall(r"[a-z0-9_]+", lowered)} - _STOPWORDS
    if want_aadhaar is None and words & {"aadhaar", "aebas", "aeps"}:
        want_aadhaar = True

    scored: list[tuple[int, dict]] = []
    for p in products:
        if p.get("recommend") is False:
            continue
        if want_aadhaar is not None and p.get("aadhaar") is not None and p["aadhaar"] != want_aadhaar:
            continue
        tags = {str(t).lower() for t in p.get("tags", [])}
        title = set(_tokens(p.get("type", ""))) | set(_tokens(p["name"]))
        text = set(_tokens(p.get("summary", ""))) | set(_tokens(p.get("use_when", "")))
        score = 3 * len(words & tags) + 2 * len(words & title) + len(words & text)
        if score and want_aadhaar is not None and p.get("aadhaar") == want_aadhaar:
            score += 2
        if score >= 3:
            scored.append((score, p))
    scored.sort(key=lambda sp: sp[0], reverse=True)
    # Keep only close contenders, so "iris scanner" doesn't also list fingerprint scanners.
    top = scored[0][0] if scored else 0
    return [p for score, p in scored[:3] if score >= 0.6 * top], want_aadhaar


def _format(product: dict, data: dict) -> str:
    aadhaar = {True: " Aadhaar certified.", False: " Non-Aadhaar."}.get(product.get("aadhaar"), "")
    lines = [f"{product['name']}: {product.get('type', '')}.{aadhaar}"]
    if product.get("summary"):
        lines.append(f"- About: {product['summary']}")
    lines.append(f"- Status: {data['status_text'][product.get('status', 'unconfirmed')]}")
    if product.get("availability"):
        lines.append(f"- Availability: {product['availability']}")
    if product.get("price"):
        lines.append(f"- Price: {product['price']}")
    elif product.get("sales") == "website":
        lines.append("- Price: not confirmed here; it is shown on the website, or the sales team can quote.")
    elif product.get("sales"):
        lines.append("- Price: not shared on the phone; the sales team sends a quotation.")
    if product.get("sales"):
        route = data["sales_routes"][product["sales"]].format(website=data["website_spoken"])
        lines.append(f"- How to buy: {route}")
    for note in product.get("notes", []):
        lines.append(f"- Note: {note}")
    return "\n".join(lines)


def lookup(query: str) -> str:
    """Return a short, speakable fact sheet for the products matching the query."""
    data = _load()
    products = data.get("products", [])
    tokens = _tokens(query)
    footer = "Use only these facts. Say them in the caller's language, in your own words."

    # First line is a status the model can act on without parsing the rest.
    not_found = "STATUS: not_found (do not search again for this)."

    named = _named_matches(tokens, _cache["index"])
    if named:
        body = "\n\n".join(_format(p, data) for p in named)
        return f"STATUS: found\n\n{body}\n\n{footer}"

    unknown_code = _unknown_model_code(tokens)
    if unknown_code:
        return f"{not_found}\n{unknown_code}: {data['not_found']}"

    matches, want_aadhaar = _need_matches(query, products)
    if not matches:
        return f"{not_found}\nNo match for '{query}'. {data['not_found']}"

    header = "STATUS: found\n\nMatching devices, best fit first:"
    mixed = {p.get("aadhaar") for p in matches} >= {True, False}
    if want_aadhaar is None and mixed:
        header = (
            "STATUS: needs_clarification\n\nMatching devices. Ask whether the caller needs it "
            "for Aadhaar or Non-Aadhaar use before recommending one:"
        )
    return header + "\n\n" + "\n\n".join(_format(p, data) for p in matches) + f"\n\n{footer}"
