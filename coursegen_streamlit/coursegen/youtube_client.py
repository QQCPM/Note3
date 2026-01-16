from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:24]


class YouTubeAPIError(RuntimeError):
    """Generic YouTube API error."""


class YouTubeQuotaExceeded(YouTubeAPIError):
    """Raised when YouTube Data API quota is exceeded (HTTP 403 quotaExceeded)."""


class YouTubeAuthError(YouTubeAPIError):
    """Raised when API key is missing/invalid."""


class YouTubeCache:
    def __init__(self, cache_dir: str) -> None:
        self.root = Path(cache_dir) / "youtube"
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        p = self.path(key)
        if not p.exists():
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return None

    def set(self, key: str, payload: Dict[str, Any]) -> None:
        p = self.path(key)
        p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


@dataclass
class VideoCandidate:
    video_id: str
    title: str
    description: str
    channel_title: str
    published_at: str
    duration_sec: int
    view_count: int
    like_count: int
    comment_count: int


class YouTubeClient:
    """Minimal YouTube Data API v3 client using API key (public data only).

    Endpoints used:
      - search.list (expensive: 100 units)
      - videos.list (cheap: 1 unit)

    This client is intentionally quota-aware:
      - Strong disk caching.
      - Optional cache-only mode.
      - Clean exception types for quota / auth.
    """

    API = "https://www.googleapis.com/youtube/v3"

    def __init__(
        self,
        api_key: str,
        cache_dir: str,
        *,
        timeout_s: int = 20,
        max_retries: int = 2,
        backoff_s: float = 0.8,
        allow_cache_only: bool = True,
    ) -> None:
        # We allow missing key if the app wants to run “cache-only” (demo/offline/quota exceeded).
        self.api_key = api_key or ""
        self.allow_cache_only = bool(allow_cache_only)
        self.cache = YouTubeCache(cache_dir)
        self.timeout_s = int(timeout_s)
        self.max_retries = int(max_retries)
        self.backoff_s = float(backoff_s)

    def _raise_for_status(self, status_code: int, text: str) -> None:
        t = (text or "")[:600]
        if status_code in (401, 400):
            raise YouTubeAuthError(
                f"YouTube API auth/key error {status_code}: {t}"
            )
        if status_code == 403 and ("quota" in t.lower() or "quotaExceeded" in t):
            raise YouTubeQuotaExceeded(
                f"YouTube API quota exceeded (403): {t}"
            )
        raise YouTubeAPIError(f"YouTube API error {status_code}: {t}")

    def _get(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """HTTP GET with simple retries + quota-aware error types."""
        if not self.api_key:
            raise YouTubeAuthError(
                "Missing YOUTUBE_API_KEY (client is in cache-only mode)."
            )

        url = f"{self.API}/{path}"
        params = dict(params)
        params["key"] = self.api_key

        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                r = requests.get(url, params=params, timeout=self.timeout_s)
                if r.status_code != 200:
                    self._raise_for_status(r.status_code, r.text)
                return r.json()
            except YouTubeQuotaExceeded:
                # No point retrying quota.
                raise
            except YouTubeAuthError:
                # No point retrying auth.
                raise
            except Exception as e:
                last_exc = e
                if attempt >= self.max_retries:
                    break
                time.sleep(self.backoff_s * (2 ** attempt))

        raise YouTubeAPIError(f"YouTube request failed after retries: {last_exc}")

    @staticmethod
    def _iso8601_duration_to_seconds(d: str) -> int:
        # e.g. PT1H2M3S, PT15M, PT45S
        if not d or not d.startswith("PT"):
            return 0
        h = m = s = 0
        num = ""
        for ch in d[2:]:
            if ch.isdigit():
                num += ch
            else:
                if ch == "H":
                    h = int(num or "0")
                elif ch == "M":
                    m = int(num or "0")
                elif ch == "S":
                    s = int(num or "0")
                num = ""
        return h * 3600 + m * 60 + s

    def search_videos(
        self,
        query: str,
        *,
        max_results: int = 12,
        relevance_language: str = "en",
        safe_search: str = "none",
        published_after: Optional[str] = None,  # RFC3339
        order: str = "relevance",
        cache_ttl_s: int = 24 * 3600,
        cache_only: bool = False,
    ) -> List[str]:
        """Returns videoIds (no metadata).

        Quota note: search.list costs 100 units per call.
        Use `cache_only=True` to avoid any network calls.
        """
        payload_for_key = {
            "q": query,
            "n": max_results,
            "lang": relevance_language,
            "safe": safe_search,
            "after": published_after,
            "order": order,
        }
        cache_key = f"search_{_sha(json.dumps(payload_for_key, sort_keys=True))}"
        cached = self.cache.get(cache_key)
        now = int(time.time())
        if cached and (now - int(cached.get("ts", 0))) < cache_ttl_s:
            return list(cached.get("video_ids", []))

        if cache_only or (not self.api_key and self.allow_cache_only):
            # Cache miss in cache-only mode.
            return []

        params: Dict[str, Any] = {
            "part": "snippet",
            "type": "video",
            "q": query,
            "maxResults": max_results,
            "relevanceLanguage": relevance_language,
            "safeSearch": safe_search,
            "order": order,
        }
        if published_after:
            params["publishedAfter"] = published_after

        try:
            data = self._get("search", params)
        except YouTubeQuotaExceeded:
            # Persist a short-lived negative cache to stop hammering search.
            self.cache.set(cache_key, {"ts": now, "video_ids": [], "query": query, "quota_exceeded": True})
            return []

        ids: List[str] = []
        for item in data.get("items", []):
            vid = (item.get("id") or {}).get("videoId")
            if vid:
                ids.append(str(vid))

        self.cache.set(cache_key, {"ts": now, "video_ids": ids, "query": query})
        return ids

    def get_videos(
        self,
        video_ids: List[str],
        *,
        cache_ttl_s: int = 7 * 24 * 3600,
        cache_only: bool = False,
    ) -> List[VideoCandidate]:
        """Fetch metadata for a list of video ids (batched).

        videos.list is cheap (1 unit), but we still cache aggressively.
        """
        out: List[VideoCandidate] = []
        ids = [vid for vid in video_ids if vid]
        if not ids:
            return out

        now = int(time.time())

        # Try cached per-video first
        remaining: List[str] = []
        for vid in ids:
            cache_key = f"video_{vid}"
            cached = self.cache.get(cache_key)
            if cached and (now - int(cached.get("ts", 0))) < cache_ttl_s:
                c = cached.get("candidate") or {}
                try:
                    out.append(VideoCandidate(**c))
                except Exception:
                    remaining.append(vid)
            else:
                remaining.append(vid)

        if cache_only or (not self.api_key and self.allow_cache_only):
            # cache-only mode: return only what we had
            rank = {vid: idx for idx, vid in enumerate(ids)}
            out.sort(key=lambda c: rank.get(c.video_id, 10**9))
            return out

        # Batch fetch uncached
        B = 50
        for i in range(0, len(remaining), B):
            chunk = remaining[i : i + B]
            params = {
                "part": "snippet,contentDetails,statistics",
                "id": ",".join(chunk),
                "maxResults": len(chunk),
            }

            try:
                data = self._get("videos", params)
            except YouTubeQuotaExceeded:
                # videos.list is cheap but quota can still be blown; stop gracefully
                break

            for item in data.get("items", []):
                vid = str(item.get("id", ""))
                snippet = item.get("snippet") or {}
                stats = item.get("statistics") or {}
                content = item.get("contentDetails") or {}

                cand = VideoCandidate(
                    video_id=vid,
                    title=str(snippet.get("title", "")),
                    description=str(snippet.get("description", "")),
                    channel_title=str(snippet.get("channelTitle", "")),
                    published_at=str(snippet.get("publishedAt", "")),
                    duration_sec=self._iso8601_duration_to_seconds(str(content.get("duration", ""))),
                    view_count=int(stats.get("viewCount", 0) or 0),
                    like_count=int(stats.get("likeCount", 0) or 0),
                    comment_count=int(stats.get("commentCount", 0) or 0),
                )
                out.append(cand)
                self.cache.set(f"video_{vid}", {"ts": now, "candidate": cand.__dict__})

        # Preserve original order if possible
        rank = {vid: idx for idx, vid in enumerate(ids)}
        out.sort(key=lambda c: rank.get(c.video_id, 10**9))
        return out

    @staticmethod
    def thumbnail_url(video_id: str, *, quality: str = "hq") -> str:
        """Return a stable YouTube thumbnail URL (no API quota)."""
        q = quality.lower().strip()
        # valid: default, mqdefault, hqdefault, sddefault, maxresdefault
        if q in ("max", "maxres"):
            key = "maxresdefault"
        elif q in ("sd", "sddefault"):
            key = "sddefault"
        elif q in ("mq", "mqdefault"):
            key = "mqdefault"
        elif q in ("default", "low"):
            key = "default"
        else:
            key = "hqdefault"
        return f"https://i.ytimg.com/vi/{video_id}/{key}.jpg"

    def is_cache_only(self) -> bool:
        return (not self.api_key) and self.allow_cache_only
