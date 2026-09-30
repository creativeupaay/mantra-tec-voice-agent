"""Phonetic correction and spoken text normalization utilities.

Cleans and normalizes spoken input common in voice agents, such as:
- Spoken email addresses ("rahul dot sharma at the rate gmail dot com")
- Spelled-out letter sequences ("M A N T R A" -> "MANTRA")
- TTS formatting for letter-by-letter clarification ("M-A-N-T-R-A")
"""

import re
from typing import Optional


def normalize_spoken_email(spoken_email: Optional[str]) -> str:
    """Normalize a spoken email string into standard email format.

    Examples:
        "rahul dot sharma at the rate gmail dot com" -> "rahul.sharma@gmail.com"
        "manish.b at rate gmail.com" -> "manish.b@gmail.com"
        "info at mantra tec dot com" -> "info@mantratec.com"
        "amit underscore kumar at yahoo dot co dot in" -> "amit_kumar@yahoo.co.in"
        "r a h u l @ gmail . com" -> "rahul@gmail.com"
    """
    if not spoken_email:
        return ""

    email = spoken_email.strip().lower()

    # 1. Spoken symbols conversion
    # "at the rate of", "at the rate", "at rate", "@ rate"
    email = re.sub(r"\b(at\s+the\s+rate(\s+of)?|at\s+rate|@\s*rate)\b", "@", email)
    
    # "dot"
    email = re.sub(r"\b(dot|point)\b", ".", email)
    
    # "underscore"
    email = re.sub(r"\b(underscore|under\s+score)\b", "_", email)
    
    # "hyphen", "dash", "minus"
    email = re.sub(r"\b(hyphen|dash|minus)\b", "-", email)

    # 2. Standalone "at" if between local part and domain: e.g. "rahul at gmail.com"
    email = re.sub(r"(?<=\w)\s+at\s+(?=\w)", "@", email)

    # 3. Collapse spaces between single letters: "r a h u l" -> "rahul"
    # Matches sequences of single characters separated by spaces
    def _collapse_letters(match):
        return match.group(0).replace(" ", "")

    email = re.sub(r"\b([a-zA-Z0-9]\s+){2,}[a-zA-Z0-9]\b", _collapse_letters, email)

    # 4. Common speech-to-text domain / brand mishearings
    domain_fixes = [
        (r"\bg\s*male\b", "gmail"),
        (r"\bgee\s*mail\b", "gmail"),
        (r"\bg\s*mail\b", "gmail"),
        (r"\bya\s*hoo\b", "yahoo"),
        (r"\bhot\s*male\b", "hotmail"),
        (r"\bhot\s*mail\b", "hotmail"),
        (r"\bout\s*look\b", "outlook"),
        (r"\brediff\s*mail\b", "rediffmail"),
        (r"\bmantra\s*tec(h)?\b", "mantratec"),
    ]
    for pattern, replacement in domain_fixes:
        email = re.sub(pattern, replacement, email)

    # 5. Remove whitespace around '@' and '.'
    email = re.sub(r"\s*@\s*", "@", email)
    email = re.sub(r"\s*\.\s*", ".", email)

    # 6. Remove any remaining internal whitespace if it looks like an email
    if "@" in email:
        local_part, domain_part = email.split("@", 1)
        local_part = local_part.replace(" ", "")
        domain_part = domain_part.replace(" ", "")
        email = f"{local_part}@{domain_part}"

    # Clean stray punctuation at edges
    email = email.strip(".,;: \t\n\r")

    return email


def normalize_spelled_letters(spoken_text: Optional[str]) -> str:
    """Collapse sequences of individually spelled letters into continuous words.

    Examples:
        "M A N T R A" -> "MANTRA"
        "M - A - N - T - R - A" -> "MANTRA"
        "My company name is S O F T C R U N C H" -> "My company name is SOFTCRUNCH"
    """
    if not spoken_text:
        return ""

    text = spoken_text.strip()

    # Match 3 or more single letters separated by space or hyphen
    pattern = r"\b([A-Za-z](?:[\s\-]+[A-Za-z]){2,})\b"

    def _replace_spelled(m):
        raw = m.group(1)
        cleaned = re.sub(r"[\s\-]+", "", raw)
        return cleaned

    return re.sub(pattern, _replace_spelled, text)


def format_spelled_for_tts(text: str) -> str:
    """Format an acronym or word letter-by-letter with hyphens for crisp TTS pronunciation.

    Examples:
        "MANISH" -> "M-A-N-I-S-H"
        "priya" -> "P-R-I-Y-A"
    """
    clean = re.sub(r"[^a-zA-Z0-9]", "", text).upper()
    return "-".join(list(clean)) if clean else text
