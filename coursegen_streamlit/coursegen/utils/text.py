import re
from rapidfuzz import fuzz

def normalize(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s

def soft_contains(haystack: str, needle: str) -> float:
    """Returns [0,1] soft match confidence."""
    h = normalize(haystack)
    n = normalize(needle)
    if not h or not n:
        return 0.0
    if n in h:
        return 1.0
    return fuzz.partial_ratio(n, h) / 100.0