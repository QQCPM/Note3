from __future__ import annotations

import hashlib
import json
import math
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np

from coursegen.config import (
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_CACHE_DIR,
    EMBEDDING_MODEL,
    USE_TRANSCRIPTS,
    EMBEDDING_CACHE_TTL_DAYS,
)
from coursegen.gemini_client import GeminiClient


# ----------------------------
# Helpers
# ----------------------------

_STOPWORDS = {
    "the","a","an","and","or","to","of","in","for","on","with","by","at","from","as",
    "is","are","was","were","be","been","being","this","that","these","those","it",
    "its","into","over","under","about","your","you","we","they","i","me","my","our",
    "their","them","can","could","should","would","will","just","very","more","most",
    "how","what","why","when","where","which","who","whom","than","then","also",
}

_CLICKBAIT_PATTERNS = [
    r"\byou won't believe\b",
    r"\bshocking\b",
    r"\bexposed\b",
    r"\bsecret(s)?\b",
    r"\bultimate\b",
    r"\bwatch before\b",
    r"\bgame[- ]?changer\b",
    r"\bmust watch\b",
]

_NEWSY_PATTERNS = [
    r"\bweekly\b",
    r"\bdaily\b",
    r"\bnews\b",
    r"\broundup\b",
    r"\brecap\b",
    r"\bheadline(s)?\b",
]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _safe_int(x: Any, default: int = 0) -> int:
    try:
        return int(x)
    except Exception:
        return default


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _norm_cosine_to_01(cos: float) -> float:
    # cosine in [-1,1] -> [0,1]
    return _clip01((cos + 1.0) / 2.0)


def _hash_key(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p.encode("utf-8", errors="ignore"))
        h.update(b"\x00")
    return h.hexdigest()


def _ensure_dir(p: str) -> Path:
    path = Path(p)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _write_json(path: Path, obj: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")


def _chunk_text(text: str, max_chars: int = 1400) -> List[str]:
    """
    Simple chunker: splits by paragraphs/sentences then groups into ~max_chars.
    Good enough to avoid embedding huge transcripts in one go.
    """
    text = (text or "").strip()
    if not text:
        return []

    # split on blank lines or sentence-ish boundaries
    parts = re.split(r"(?:\n\s*\n)|(?<=[\.\!\?])\s+(?=[A-Z0-9])", text)
    parts = [p.strip() for p in parts if p and p.strip()]

    chunks: List[str] = []
    buf = ""
    for p in parts:
        if len(buf) + len(p) + 1 <= max_chars:
            buf = (buf + " " + p).strip()
        else:
            if buf:
                chunks.append(buf)
            buf = p
    if buf:
        chunks.append(buf)

    return chunks[:80]  # cap worst-case


def _tokenize(text: str) -> List[str]:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9\+\#\-\s]", " ", text)
    toks = [t for t in text.split() if len(t) >= 3 and t not in _STOPWORDS]
    return toks


def _top_keywords(text: str, k: int = 18) -> List[str]:
    toks = _tokenize(text)
    if not toks:
        return []
    freq: Dict[str, int] = {}
    for t in toks:
        freq[t] = freq.get(t, 0) + 1
    # prefer medium frequency terms; extremely frequent can be generic
    scored = sorted(freq.items(), key=lambda kv: (kv[1], len(kv[0])), reverse=True)
    return [w for w, _ in scored[:k]]


# ----------------------------
# Embedding cache (disk + TTL)
# ----------------------------

@dataclass
class EmbeddingCache:
    cache_dir: Path
    ttl_days: int = EMBEDDING_CACHE_TTL_DAYS

    def _is_fresh(self, p: Path, meta: Optional[Dict[str, Any]]) -> bool:
        # Prefer explicit timestamp in meta; fall back to file mtime.
        try:
            if meta and isinstance(meta, dict) and isinstance(meta.get("ts"), (int, float)):
                age_s = time.time() - float(meta["ts"])
            else:
                age_s = time.time() - p.stat().st_mtime
            return age_s <= float(self.ttl_days) * 86400.0
        except Exception:
            return False

    def get(self, key: str) -> Optional[List[float]]:
        p = self.cache_dir / f"{key}.json"
        obj = _read_json(p)
        if not obj or "v" not in obj or not isinstance(obj.get("v"), list):
            return None
        meta = obj.get("meta") if isinstance(obj, dict) else None
        if not self._is_fresh(p, meta if isinstance(meta, dict) else None):
            return None
        return obj["v"]

    def set(self, key: str, vec: List[float], meta: Optional[Dict[str, Any]] = None) -> None:
        p = self.cache_dir / f"{key}.json"
        payload = {
            "v": vec,
            "meta": {**(meta or {}), "ts": time.time()},
        }
        _write_json(p, payload)


def _embed_texts_compat(gemini: GeminiClient, texts: List[str], *, embed_model: str) -> List[List[float]]:
    """Call gemini.embed_texts with best-effort compatibility across client versions.

    Some clients accept `embed_model=...`; others use a mutable `embedding_model` attribute;
    others accept only positional args.
    """
    # Try keyword arg first
    try:
        return gemini.embed_texts(texts, embed_model=embed_model)  # type: ignore[arg-type]
    except TypeError:
        pass

    # Try setting attribute if present
    try:
        if hasattr(gemini, "embedding_model"):
            setattr(gemini, "embedding_model", embed_model)
        return gemini.embed_texts(texts)  # type: ignore[arg-type]
    except TypeError:
        # Last resort: positional embed_model (if supported)
        try:
            return gemini.embed_texts(texts, embed_model)  # type: ignore[misc]
        except Exception as e:
            raise RuntimeError(f"embed_texts failed for embedding_model={embed_model}: {e}")


def embed_with_cache(
    gemini: GeminiClient,
    texts: List[str],
    embedding_model: str = EMBEDDING_MODEL,
    cache_dir: str = EMBEDDING_CACHE_DIR,
    batch_size: int = EMBEDDING_BATCH_SIZE,
    ttl_days: int = EMBEDDING_CACHE_TTL_DAYS,
) -> List[List[float]]:
    """Embeds texts using Gemini embeddings + disk cache.

    Cache key includes embedding model + text hash.
    """
    cache = EmbeddingCache(_ensure_dir(cache_dir), ttl_days=ttl_days)

    out: List[Optional[List[float]]] = [None] * len(texts)
    missing: List[Tuple[int, str, str]] = []

    for i, t in enumerate(texts):
        key = _hash_key(embedding_model, t)
        v = cache.get(key)
        if v is None:
            missing.append((i, key, t))
        else:
            out[i] = v

    if missing:
        for start in range(0, len(missing), max(1, batch_size)):
            batch = missing[start : start + max(1, batch_size)]
            batch_texts = [t for _, _, t in batch]

            vecs = _embed_texts_compat(gemini, batch_texts, embed_model=embedding_model)

            if len(vecs) != len(batch):
                raise RuntimeError("Embedding count mismatch")

            for (idx, key, _t), v in zip(batch, vecs):
                cache.set(key, v, meta={"m": embedding_model, "n_chars": len(_t)})
                out[idx] = v

    return [v if v is not None else [] for v in out]


# ----------------------------
# Core scoring
# ----------------------------

def build_lesson_text(course_title: str, module_title: str, lesson: Any) -> str:
    """
    lesson can be a pydantic model or dict; be defensive.
    """
    def g(obj: Any, name: str, default: Any = "") -> Any:
        if isinstance(obj, dict):
            return obj.get(name, default)
        return getattr(obj, name, default)

    title = g(lesson, "lesson_title", "") or g(lesson, "title", "")
    objectives = g(lesson, "objectives", []) or []
    key_concepts = g(lesson, "key_concepts", []) or []
    desc = g(lesson, "description", "") or ""

    if isinstance(objectives, str):
        objectives = [objectives]
    if isinstance(key_concepts, str):
        key_concepts = [key_concepts]

    parts = [
        f"Course: {course_title}",
        f"Module: {module_title}",
        f"Lesson: {title}",
        f"Description: {desc}",
    ]
    if objectives:
        parts.append("Objectives: " + "; ".join([str(x) for x in objectives][:12]))
    if key_concepts:
        parts.append("Key concepts: " + "; ".join([str(x) for x in key_concepts][:20]))

    return "\n".join([p for p in parts if p.strip()])


def build_video_text(cand: Any) -> str:
    def g(obj: Any, name: str, default: Any = "") -> Any:
        if isinstance(obj, dict):
            return obj.get(name, default)
        return getattr(obj, name, default)

    title = g(cand, "title", "")
    desc = g(cand, "description", "")
    channel = g(cand, "channel_title", "") or g(cand, "channelTitle", "")

    return f"Title: {title}\nChannel: {channel}\nDescription: {desc}"


def semantic_score(
    gemini: GeminiClient,
    lesson_text: str,
    cand: Any,
    use_transcript: bool = USE_TRANSCRIPTS,
) -> Tuple[float, Dict[str, Any]]:
    """
    Advanced semantic score:
    - embed(lesson) vs embed(video title+desc)
    - optionally also embed transcript chunks and take top-k pooling
    """
    video_text = build_video_text(cand)

    # transcript can be absent; if present should be string or list[str]
    transcript = None
    if isinstance(cand, dict):
        transcript = cand.get("transcript", None) or cand.get("transcript_text", None)
        chunks = cand.get("transcript_chunks", None)
    else:
        transcript = getattr(cand, "transcript", None) or getattr(cand, "transcript_text", None)
        chunks = getattr(cand, "transcript_chunks", None)

    transcript_chunks: List[str] = []
    if use_transcript:
        if isinstance(chunks, list) and chunks:
            transcript_chunks = [str(x) for x in chunks if str(x).strip()]
        elif isinstance(transcript, str) and transcript.strip():
            transcript_chunks = _chunk_text(transcript)

    # embed lesson + meta
    base_vecs = embed_with_cache(gemini, [lesson_text, video_text])
    v_lesson = np.array(base_vecs[0], dtype=np.float32)
    v_meta = np.array(base_vecs[1], dtype=np.float32)

    sim_meta = _norm_cosine_to_01(_cosine(v_lesson, v_meta))

    # transcript pooling (max + avg of top3)
    sim_tr = None
    if transcript_chunks:
        # limit embed budget
        transcript_chunks = transcript_chunks[:24]
        tr_vecs = embed_with_cache(gemini, transcript_chunks)
        sims = []
        for v in tr_vecs:
            vv = np.array(v, dtype=np.float32)
            sims.append(_norm_cosine_to_01(_cosine(v_lesson, vv)))

        sims.sort(reverse=True)
        top1 = sims[0] if sims else 0.0
        top3 = float(sum(sims[:3]) / max(1, min(3, len(sims))))
        sim_tr = 0.65 * top1 + 0.35 * top3

    if sim_tr is None:
        sem = sim_meta
        detail = {"sim_meta": sim_meta, "sim_transcript": None, "n_tr_chunks": 0}
    else:
        # combine: transcript can rescue cases where title is vague
        sem = 0.55 * sim_meta + 0.45 * sim_tr
        detail = {"sim_meta": sim_meta, "sim_transcript": sim_tr, "n_tr_chunks": len(transcript_chunks)}

    return _clip01(sem), detail


def coverage_score(lesson_text: str, cand: Any, use_transcript: bool = USE_TRANSCRIPTS) -> Tuple[float, Dict[str, Any]]:
    """
    Coverage focuses on whether key lesson concepts appear at all.
    We:
    - extract lesson keywords (deterministic)
    - check presence in video text (+ transcript if available)
    - penalize keyword stuffing lightly
    """
    video_text = build_video_text(cand).lower()

    transcript = None
    if isinstance(cand, dict):
        transcript = cand.get("transcript", None) or cand.get("transcript_text", None)
        chunks = cand.get("transcript_chunks", None)
    else:
        transcript = getattr(cand, "transcript", None) or getattr(cand, "transcript_text", None)
        chunks = getattr(cand, "transcript_chunks", None)

    tr_text = ""
    if use_transcript:
        if isinstance(chunks, list) and chunks:
            tr_text = "\n".join([str(x) for x in chunks[:40]])
        elif isinstance(transcript, str) and transcript.strip():
            tr_text = transcript

    haystack = (video_text + "\n" + tr_text.lower()).strip()

    kws = _top_keywords(lesson_text, k=18)
    if not kws:
        return 0.0, {"keywords": [], "hit_rate": 0.0, "stuff_penalty": 0.0}

    hits = 0
    counts = 0
    for kw in kws:
        # naive containment for now; robust enough with embedding semantic as primary
        c = haystack.count(kw.lower())
        counts += c
        if c > 0:
            hits += 1

    hit_rate = hits / max(1, len(kws))

    # stuffing penalty: if a few keywords repeated excessively relative to text size
    text_len = max(200, len(haystack))
    density = counts / text_len  # rough
    stuff_penalty = 0.0
    if density > 0.02:
        stuff_penalty = min(0.25, (density - 0.02) * 5.0)

    cov = _clip01(hit_rate - stuff_penalty)

    return cov, {"keywords": kws, "hit_rate": hit_rate, "kw_count": counts, "stuff_penalty": stuff_penalty}


def quality_score(cand: Any) -> Tuple[float, Dict[str, Any]]:
    """
    Quality tries to rank:
    - good engagement
    - reasonable length
    - not clickbait/newsy for educational content
    All signals are heuristic and robust to missing fields.
    """
    def g(obj: Any, name: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(name, default)
        return getattr(obj, name, default)

    title = str(g(cand, "title", "") or "")
    desc = str(g(cand, "description", "") or "")

    views = _safe_int(g(cand, "view_count", None) or g(cand, "views", None) or g(cand, "viewCount", None), 0)
    likes = _safe_int(g(cand, "like_count", None) or g(cand, "likes", None) or g(cand, "likeCount", None), 0)
    comments = _safe_int(g(cand, "comment_count", None) or g(cand, "commentCount", None), 0)

    duration_sec = _safe_int(g(cand, "duration_seconds", None) or g(cand, "durationSeconds", None), 0)

    published_at = g(cand, "published_at", None) or g(cand, "publishedAt", None)
    days = None
    if isinstance(published_at, str) and published_at:
        try:
            # support common YouTube format: 2025-01-10T12:34:56Z
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            days = max(1.0, (_now_utc() - dt).total_seconds() / 86400.0)
        except Exception:
            days = None

    # Engagement components
    vpd = 0.0
    if days is not None and views > 0:
        vpd = views / days

    # Normalize with log + sigmoid
    vpd_norm = _sigmoid((math.log1p(vpd) - 6.5) / 1.5)  # ~center around exp(6.5) ≈ 665 vpd
    views_norm = _sigmoid((math.log1p(views) - 10.0) / 2.0)  # center around exp(10) ≈ 22k

    like_rate = (likes / max(1, views)) if views > 0 else 0.0
    like_norm = _clip01(like_rate * 40.0)  # 2.5% -> 1.0

    comment_rate = (comments / max(1, views)) if views > 0 else 0.0
    comment_norm = _clip01(comment_rate * 200.0)  # 0.5% -> 1.0

    # Duration fit: prefer 6–45 mins; light penalty outside.
    dur_norm = 0.5
    if duration_sec > 0:
        mins = duration_sec / 60.0
        if mins < 3:
            dur_norm = 0.15
        elif mins < 6:
            dur_norm = 0.45
        elif mins <= 45:
            dur_norm = 1.0
        elif mins <= 75:
            dur_norm = 0.75
        else:
            dur_norm = 0.55

    # Clickbait / news penalty
    tb = (title + " " + desc).lower()
    clickbait = any(re.search(p, tb) for p in _CLICKBAIT_PATTERNS)
    newsy = any(re.search(p, tb) for p in _NEWSY_PATTERNS)

    penalty = 0.0
    if clickbait:
        penalty += 0.18
    if newsy:
        penalty += 0.22

    # ALL CAPS-ish penalty
    if title and sum(1 for c in title if c.isupper()) / max(1, len(title)) > 0.45 and len(title) > 10:
        penalty += 0.10

    raw = (
        0.30 * vpd_norm
        + 0.20 * views_norm
        + 0.20 * like_norm
        + 0.10 * comment_norm
        + 0.20 * dur_norm
    )

    qual = _clip01(raw - penalty)

    detail = {
        "views": views,
        "likes": likes,
        "comments": comments,
        "days_since_pub": days,
        "vpd_norm": vpd_norm,
        "views_norm": views_norm,
        "like_norm": like_norm,
        "comment_norm": comment_norm,
        "dur_norm": dur_norm,
        "penalty": penalty,
        "clickbait": clickbait,
        "newsy": newsy,
    }
    return qual, detail


def score_candidate(
    gemini: GeminiClient,
    course_title: str,
    module_title: str,
    lesson: Any,
    cand: Any,
    use_transcript: bool = USE_TRANSCRIPTS,
) -> Tuple[int, Dict[str, float], Dict[str, Any]]:
    """
    Returns:
      match_percent (int 0-100),
      components: semantic/coverage/quality,
      debug details (breakdowns)
    """
    lesson_text = build_lesson_text(course_title, module_title, lesson)

    sem, sem_dbg = semantic_score(gemini, lesson_text, cand, use_transcript=use_transcript)
    cov, cov_dbg = coverage_score(lesson_text, cand, use_transcript=use_transcript)
    qual, qual_dbg = quality_score(cand)

    # Advanced weighting:
    # - semantic is primary
    # - coverage prevents "semantic-ish but missing key parts"
    # - quality influences but never dominates
    #
    # We also "gate" semantic when coverage is near zero:
    cov_gate = 0.70 + 0.30 * cov  # 0.70..1.0
    sem_gated = sem * cov_gate

    # Soft-AND blend (harmonic-ish)
    soft_and = (2 * sem_gated * (0.5 + 0.5 * cov)) / max(1e-6, (sem_gated + (0.5 + 0.5 * cov)))

    score = (
        0.62 * sem_gated
        + 0.18 * cov
        + 0.12 * qual
        + 0.08 * soft_and
    )

    score = _clip01(score)
    match_percent = int(round(100 * score))

    components = {"semantic": float(sem), "coverage": float(cov), "quality": float(qual)}
    debug = {
        "score": score,
        "match_percent": match_percent,
        "lesson_text_preview": lesson_text[:350],
        "semantic_dbg": sem_dbg,
        "coverage_dbg": cov_dbg,
        "quality_dbg": qual_dbg,
        "sem_gated": sem_gated,
        "soft_and": soft_and,
        "weights": {"sem_gated": 0.62, "cov": 0.18, "qual": 0.12, "soft_and": 0.08},
        "embedding_model": EMBEDDING_MODEL,
        "use_transcripts": bool(use_transcript),
    }

    return match_percent, components, debug
