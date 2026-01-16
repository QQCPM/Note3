
from __future__ import annotations

import hashlib
import json
import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Optional


def _safe_name(s: str) -> str:
    """Filesystem-safe-ish name."""
    s = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in s)
    return s[:200] if len(s) > 200 else s


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def cosine_sim(a: List[float], b: List[float]) -> float:
    """Cosine similarity for embedding vectors. Returns 0.0 on degenerate input."""
    if not a or not b:
        return 0.0
    if len(a) != len(b):
        # defensive: truncate to common length
        n = min(len(a), len(b))
        a = a[:n]
        b = b[:n]

    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        fx = float(x)
        fy = float(y)
        dot += fx * fy
        na += fx * fx
        nb += fy * fy

    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


@dataclass
class EmbeddingCache:
    """Small on-disk cache for embedding vectors."""

    cache_dir: str
    ttl_days: int = 30

    def __post_init__(self) -> None:
        self.root = Path(self.cache_dir) / "embeddings"
        self.root.mkdir(parents=True, exist_ok=True)

    def _path_for_key(self, key: str) -> Path:
        # Use a stable hash so keys can be long.
        h = _sha256(key)
        return self.root / f"{_safe_name(h)}.json"

    def get(self, key: str) -> Optional[List[float]]:
        p = self._path_for_key(key)
        if not p.exists():
            return None

        try:
            age_s = time.time() - p.stat().st_mtime
            if self.ttl_days is not None and self.ttl_days > 0:
                if age_s > float(self.ttl_days) * 86400.0:
                    return None

            data = json.loads(p.read_text(encoding="utf-8"))
            vec = data.get("vec")
            if isinstance(vec, list):
                return [float(x) for x in vec]
        except Exception:
            return None

        return None

    def set(self, key: str, vec: List[float]) -> None:
        p = self._path_for_key(key)
        try:
            payload = {"vec": [float(x) for x in vec]}
            p.write_text(json.dumps(payload), encoding="utf-8")
        except Exception:
            # Best-effort cache; never crash pipeline.
            pass


def _call_embed_texts(gemini: Any, texts: List[str], embed_model: str) -> List[List[float]]:
    """Call gemini.embed_texts across older/newer client signatures."""
    # Preferred: keyword arg
    try:
        return gemini.embed_texts(texts, embed_model=embed_model)
    except TypeError:
        # Older client: positional or no model override
        try:
            return gemini.embed_texts(texts, embed_model)
        except TypeError:
            return gemini.embed_texts(texts)


def embed_or_load(
    gemini: Any,
    *,
    cache: EmbeddingCache,
    key: str,
    text: str,
    embed_model: str,
) -> List[float]:
    """Get embedding for `text`, using cache. Always returns a list (may be empty)."""
    cached = cache.get(key)
    if cached is not None:
        return cached

    vecs = _call_embed_texts(gemini, [text], embed_model=embed_model)
    vec: List[float] = []
    if isinstance(vecs, list) and vecs:
        if isinstance(vecs[0], list):
            vec = [float(x) for x in vecs[0]]

    if vec:
        cache.set(key, vec)

    return vec
