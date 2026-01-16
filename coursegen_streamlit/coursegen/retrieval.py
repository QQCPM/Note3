from __future__ import annotations

from typing import Any, Dict, List, Optional

from coursegen.youtube_client import (
    YouTubeClient,
    YouTubeAPIError,
    YouTubeAuthError,
    YouTubeQuotaExceeded,
)
from coursegen.matcher import match_lesson_videos
from coursegen.gemini_client import GeminiClient


def build_candidates_for_lesson(
    yt: YouTubeClient,
    *,
    youtube_queries: List[str],
    max_per_query: int = 10,
    cache_only: bool = False,
    fail_silently: bool = True,
) -> List[Dict[str, Any]]:
    # 1) search video IDs (cache-first / quota-aware)
    all_ids: List[str] = []
    seen = set()

    def _search(q: str) -> List[str]:
        """Call yt.search_videos with backward-compatible support for cache_only."""
        try:
            # Newer client supports cache_only
            return yt.search_videos(q, max_results=max_per_query, cache_only=cache_only)  # type: ignore[arg-type]
        except TypeError:
            # Older client doesn't accept cache_only
            return yt.search_videos(q, max_results=max_per_query)

    for q in youtube_queries:
        q = (q or "").strip()
        if not q:
            continue
        try:
            ids = _search(q)
        except YouTubeQuotaExceeded:
            # Stop making further requests; proceed with what we already have
            if fail_silently:
                break
            raise
        except YouTubeAuthError:
            # Bad key / auth error
            if fail_silently:
                break
            raise
        except YouTubeAPIError:
            # Other API errors
            if fail_silently:
                continue
            raise
        except Exception:
            # Defensive: do not crash the whole app for a single query
            if fail_silently:
                continue
            raise

        for vid in ids or []:
            if vid and vid not in seen:
                seen.add(vid)
                all_ids.append(vid)

    if not all_ids:
        return []

    # 2) fetch metadata (cache-first / quota-aware)
    def _get_videos(ids: List[str]):
        try:
            return yt.get_videos(ids, cache_only=cache_only)  # type: ignore[arg-type]
        except TypeError:
            return yt.get_videos(ids)

    try:
        vids = _get_videos(all_ids)
    except YouTubeQuotaExceeded:
        if fail_silently:
            return []
        raise
    except YouTubeAuthError:
        if fail_silently:
            return []
        raise
    except YouTubeAPIError:
        if fail_silently:
            return []
        raise

    # 3) convert to dict candidates for matcher
    candidates: List[Dict[str, Any]] = []
    for v in vids or []:
        # Be defensive across versions / partial metadata
        candidates.append(
            {
                "video_id": getattr(v, "video_id", None) or getattr(v, "id", ""),
                "title": getattr(v, "title", "") or "",
                "description": getattr(v, "description", "") or "",
                "channel_title": getattr(v, "channel_title", "") or "",
                "published_at": getattr(v, "published_at", "") or "",
                "duration_sec": getattr(v, "duration_sec", 0) or 0,
                "view_count": getattr(v, "view_count", 0) or 0,
                "like_count": getattr(v, "like_count", 0) or 0,
                "comment_count": getattr(v, "comment_count", 0) or 0,
            }
        )

    # Filter out any missing IDs
    candidates = [c for c in candidates if c.get("video_id")]
    return candidates


def match_videos_for_lesson(
    gemini: GeminiClient,
    yt: YouTubeClient,
    *,
    lesson_text: str,
    youtube_queries: List[str],
    cache_dir: str,
    embed_model: str,
    max_per_query: int = 10,
    topk_rerank: int = 8,
    cache_only: bool = False,
    fail_silently: bool = True,
) -> Any:
    candidates = build_candidates_for_lesson(
        yt,
        youtube_queries=youtube_queries,
        max_per_query=max_per_query,
        cache_only=cache_only,
        fail_silently=fail_silently,
    )

    if not candidates:
        # Keep Streamlit alive when quota is exceeded or cache is empty
        return []

    return match_lesson_videos(
        gemini,
        lesson_text=lesson_text,
        candidates=candidates,
        cache_dir=cache_dir,
        embed_model=embed_model,
        topk_rerank=topk_rerank,
    )
