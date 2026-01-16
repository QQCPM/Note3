from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from coursegen.embeddings import EmbeddingCache, embed_or_load, cosine_sim
from coursegen.transcripts import TranscriptCache, fetch_transcript_text
from coursegen.judge import judge_rerank
from coursegen.gemini_client import GeminiClient


@dataclass
class MatchResult:
    video_id: str
    total_score: float          # 0..1
    percent: int                # 0..100
    components: Dict[str, float]  # each 0..1
    why: str = ""               # judge explanation (optional)
    meta: Dict[str, Any] = None


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _sigmoid_like(x: float) -> float:
    # maps any positive-ish to 0..1 with diminishing returns
    # x expected around 0..something
    return x / (1.0 + x)


def quality_score(candidate: Dict[str, Any]) -> float:
    """
    Heuristic quality signals -> 0..1.
    Uses views, duration, channel title keywords, etc.
    """
    views = float(candidate.get("view_count", 0) or 0)
    duration = float(candidate.get("duration_sec", 0) or 0)

    # views: 10k -> decent, 100k -> strong, 1M -> excellent
    v = _sigmoid_like(views / 100000.0)  # 100k scale
    # duration: prefer 6–40 minutes for teaching (soft)
    if duration <= 0:
        d = 0.3
    else:
        if duration < 180:
            d = 0.25
        elif duration < 360:
            d = 0.55
        elif duration < 2400:
            d = 1.0
        elif duration < 5400:
            d = 0.85
        else:
            d = 0.6

    title = (candidate.get("title") or "").lower()
    channel = (candidate.get("channel_title") or "").lower()
    text = f"{title} {channel}"

    # light boosts for education-ish signals
    boosts = 0.0
    for kw in ["lecture", "tutorial", "course", "explained", "deep dive", "university", "stanford", "mit", "harvard"]:
        if kw in text:
            boosts += 0.05
    # light penalties for clickbait-ish signals
    penalties = 0.0
    for kw in ["shocking", "crazy", "you won't believe", "insane", "secret", "must watch"]:
        if kw in text:
            penalties += 0.07

    q = 0.55 * v + 0.45 * d + boosts - penalties
    return _clamp(q)


def coverage_score(lesson_text: str, candidate: Dict[str, Any]) -> float:
    """
    Coverage proxy without transcripts: checks overlap of key terms.
    If transcript present, we’ll use transcript snippet too.
    """
    lt = lesson_text.lower()
    blob = " ".join(
        [
            str(candidate.get("title", "")),
            str(candidate.get("description", "")),
            str(candidate.get("transcript_snippet", "")),
        ]
    ).lower()

    # naive token overlap but robust enough as a component
    lesson_terms = set([t for t in lt.replace("/", " ").replace("-", " ").split() if len(t) >= 5])
    if not lesson_terms:
        return 0.2

    hits = sum(1 for t in lesson_terms if t in blob)
    return _clamp(hits / max(8, len(lesson_terms)))


def semantic_score(
    gemini: GeminiClient,
    *,
    lesson_text: str,
    candidate: Dict[str, Any],
    embed_cache: EmbeddingCache,
    embed_model: str,
) -> float:
    """
    True semantic similarity using embeddings.
    If transcript available, embed (title+desc+transcript_snippet).
    """
    ctext = " ".join(
        [
            str(candidate.get("title", "")),
            str(candidate.get("description", "")),
            str(candidate.get("transcript_snippet", "")),
        ]
    ).strip()

    if not ctext:
        return 0.0

    lesson_key = f"lesson::{hash(lesson_text)}::{embed_model}"
    cand_key = f"cand::{candidate.get('video_id','')}::{hash(ctext)}::{embed_model}"

    v_l = embed_or_load(gemini, cache=embed_cache, key=lesson_key, text=lesson_text, embed_model=embed_model)
    v_c = embed_or_load(gemini, cache=embed_cache, key=cand_key, text=ctext, embed_model=embed_model)
    sim = cosine_sim(v_l, v_c)  # -1..1 typically, but embeddings tend to be >=0
    # normalize to 0..1
    return _clamp((sim + 1.0) / 2.0)


def attach_transcript_snippet(
    *,
    candidate: Dict[str, Any],
    transcript_cache: TranscriptCache,
    max_chars: int = 2200,
) -> Dict[str, Any]:
    vid = candidate.get("video_id")
    if not vid:
        return candidate
    tr = fetch_transcript_text(str(vid), cache=transcript_cache)
    if tr and tr.text:
        candidate = dict(candidate)
        candidate["transcript_snippet"] = tr.text[:max_chars]
    return candidate


def match_lesson_videos(
    gemini: GeminiClient,
    *,
    lesson_text: str,
    candidates: List[Dict[str, Any]],
    cache_dir: str,
    embed_model: str,
    topk_rerank: int = 8,
) -> List[MatchResult]:
    """
    2-stage advanced matcher:
    - Stage 1: compute S_sem (embeddings) + S_cov + S_qual => base score
    - Stage 2: Gemini judge reranks topK and blends judge score into final
    """
    embed_cache = EmbeddingCache(cache_dir)
    transcript_cache = TranscriptCache(cache_dir)

    enriched: List[Dict[str, Any]] = []
    for c in candidates:
        enriched.append(attach_transcript_snippet(candidate=c, transcript_cache=transcript_cache))

    base: List[Tuple[Dict[str, Any], float, Dict[str, float]]] = []
    for c in enriched:
        s_sem = semantic_score(gemini, lesson_text=lesson_text, candidate=c, embed_cache=embed_cache, embed_model=embed_model)
        s_cov = coverage_score(lesson_text, c)
        s_qual = quality_score(c)

        # advanced weighting (stage-1)
        # semantic dominates, coverage ensures lesson alignment, quality protects from junk
        score = 0.62 * s_sem + 0.23 * s_cov + 0.15 * s_qual
        comps = {"semantic": s_sem, "coverage": s_cov, "quality": s_qual}
        base.append((c, score, comps))

    base.sort(key=lambda x: x[1], reverse=True)

    # Stage 2 judge rerank on topK
    top_candidates = [b[0] for b in base[:topk_rerank]]
    judge = judge_rerank(gemini, lesson_text=lesson_text, candidates=top_candidates, top_k=topk_rerank)
    judge_map = {vid: (score / 100.0, why) for vid, score, why in judge}

    results: List[MatchResult] = []
    for c, s_base, comps in base:
        vid = str(c.get("video_id", ""))
        j = judge_map.get(vid)
        if j is None:
            final = s_base
            why = ""
            jscore = 0.0
        else:
            jscore, why = j
            # blend: judge dominates among the shortlist, but base keeps stability
            final = 0.55 * jscore + 0.45 * s_base

        final = _clamp(final)
        percent = int(round(final * 100))
        comps = dict(comps)
        comps["judge"] = jscore

        results.append(
            MatchResult(
                video_id=vid,
                total_score=final,
                percent=percent,
                components=comps,
                why=why,
                meta=c,
            )
        )

    results.sort(key=lambda r: r.total_score, reverse=True)
    return results
