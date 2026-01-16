from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import os
import re
import subprocess
import time

from youtube_transcript_api import (  # type: ignore
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
)

# Robust cache import (older/newer versions may move this)
try:
    from coursegen.utils.cache import DiskCache  # type: ignore
except Exception:  # pragma: no cover
    DiskCache = None  # type: ignore


def _slug(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", s)[:200]


# -------------------------
# Public data shapes
# -------------------------
@dataclass
class TranscriptSegment:
    start: float
    duration: float
    text: str


@dataclass
class TranscriptResult:
    video_id: str
    language: str
    text: str
    source: str  # "youtube" | "ytdlp"

    # error details (never raises from fetch_transcript)
    error: str = ""
    error_code: str = ""  # e.g. "disabled", "not_found", "unavailable", "rate_limited", "timeout", "unknown"

    # time-aligned segments if available
    segments: List[TranscriptSegment] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return bool(self.text.strip()) and not self.error


# -------------------------
# Caching (DiskCache if available; file-cache otherwise)
# -------------------------
class _FileCache:
    """Minimal JSON file cache with TTL.

    Layout:
      <cache_dir>/<namespace>/<slug(key)>.json

    Payload stored as:
      {"_ts": <unix>, "data": <payload dict>}
    """

    def __init__(self, cache_dir: str, namespace: str, ttl_days: int) -> None:
        self.root = Path(cache_dir) / namespace
        self.root.mkdir(parents=True, exist_ok=True)
        self.ttl_s = max(1, int(ttl_days)) * 86400

    def _path(self, key: str) -> Path:
        return self.root / f"{_slug(key)}.json"

    def get(self, key: str) -> Optional[dict]:
        p = self._path(key)
        if not p.exists():
            return None
        try:
            obj = json.loads(p.read_text(encoding="utf-8"))
            ts = float(obj.get("_ts", 0.0) or 0.0)
            if ts and (time.time() - ts) > self.ttl_s:
                return None
            data = obj.get("data")
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def set(self, key: str, payload: dict) -> None:
        p = self._path(key)
        try:
            p.write_text(
                json.dumps({"_ts": time.time(), "data": payload}, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            return


class TranscriptCache:
    """Disk-backed cache for transcript payloads.

    Stored payload shape:
      {
        "video_id": str,
        "language": str,
        "text": str,
        "segments": [{"start": float, "duration": float, "text": str}, ...],
        "source": "youtube"|"ytdlp",
        "error": "" | str,
        "error_code": "" | str
      }

    If DiskCache is unavailable, falls back to a simple JSON file cache.
    """

    def __init__(self, cache_dir: str, ttl_days: int = 30) -> None:
        self.cache_dir = str(cache_dir)
        self.ttl_days = int(ttl_days)

        if DiskCache is None:
            self.cache = _FileCache(self.cache_dir, namespace="transcripts", ttl_days=self.ttl_days)
        else:
            # Some older code expected DiskCache(cache_dir, namespace=..., ttl_days=...)
            self.cache = DiskCache(self.cache_dir, namespace="transcripts", ttl_days=self.ttl_days)

    def get(self, video_id: str) -> Optional[dict]:
        try:
            return self.cache.get(_slug(video_id))
        except Exception:
            return None

    def set(self, video_id: str, payload: dict) -> None:
        try:
            self.cache.set(_slug(video_id), payload)
        except Exception:
            return


# -------------------------
# Helpers
# -------------------------
def _segments_from_api_items(items: Any) -> List[TranscriptSegment]:
    segs: List[TranscriptSegment] = []
    if not isinstance(items, list):
        return segs

    for it in items:
        if not isinstance(it, dict):
            continue
        try:
            start = float(it.get("start", 0.0) or 0.0)
        except Exception:
            start = 0.0
        try:
            duration = float(it.get("duration", 0.0) or 0.0)
        except Exception:
            duration = 0.0
        text = str(it.get("text", "") or "").strip()
        if not text:
            continue
        segs.append(TranscriptSegment(start=start, duration=duration, text=text))

    segs.sort(key=lambda s: s.start)
    return segs


def _join_segments(segs: List[TranscriptSegment]) -> str:
    return "\n".join([s.text for s in segs]).strip()


def _payload_from_result(res: TranscriptResult) -> dict:
    return {
        "video_id": res.video_id,
        "language": res.language,
        "text": res.text,
        "segments": [
            {"start": s.start, "duration": s.duration, "text": s.text}
            for s in (res.segments or [])
        ],
        "source": res.source,
        "error": res.error,
        "error_code": res.error_code,
    }


def _result_from_cached(video_id: str, cached: dict) -> TranscriptResult:
    segs: List[TranscriptSegment] = []
    seg_payload = cached.get("segments")
    if isinstance(seg_payload, list):
        for it in seg_payload:
            if not isinstance(it, dict):
                continue
            try:
                segs.append(
                    TranscriptSegment(
                        start=float(it.get("start", 0.0) or 0.0),
                        duration=float(it.get("duration", 0.0) or 0.0),
                        text=str(it.get("text", "") or "").strip(),
                    )
                )
            except Exception:
                continue
        segs.sort(key=lambda s: s.start)

    text = str(cached.get("text", "") or "")
    if not text and segs:
        text = _join_segments(segs)

    return TranscriptResult(
        video_id=video_id,
        language=str(cached.get("language", "") or ""),
        text=text,
        source=str(cached.get("source", "youtube") or "youtube"),
        error=str(cached.get("error", "") or ""),
        error_code=str(cached.get("error_code", "") or ""),
        segments=segs,
    )


def _classify_error(e: Exception) -> str:
    msg = str(e).lower()

    if isinstance(e, TranscriptsDisabled):
        return "disabled"
    if isinstance(e, NoTranscriptFound):
        return "not_found"

    if "video is unavailable" in msg or "unavailable" in msg:
        return "unavailable"
    if ("too many requests" in msg) or ("rate" in msg and "limit" in msg):
        return "rate_limited"
    if "timed out" in msg or "timeout" in msg:
        return "timeout"

    return "unknown"


# -------------------------
# yt-dlp fallback (best-effort)
# -------------------------
_VTT_TS_RE = re.compile(r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2})\.(?P<ms>\d{3})")


def _ts_to_sec(ts: str) -> float:
    m = _VTT_TS_RE.search(ts)
    if not m:
        return 0.0
    h = int(m.group("h"))
    mi = int(m.group("m"))
    s = int(m.group("s"))
    ms = int(m.group("ms"))
    return h * 3600.0 + mi * 60.0 + s + ms / 1000.0


def _parse_vtt(vtt_text: str) -> List[TranscriptSegment]:
    lines = [ln.rstrip("\n") for ln in vtt_text.splitlines()]
    segs: List[TranscriptSegment] = []

    i = 0
    while i < len(lines):
        ln = lines[i].strip()

        if "-->" in ln and _VTT_TS_RE.search(ln):
            try:
                left, right = [x.strip() for x in ln.split("-->", 1)]
                start = _ts_to_sec(left)
                end = _ts_to_sec(right)
                dur = max(0.0, end - start)
            except Exception:
                start, dur = 0.0, 0.0

            i += 1
            texts: List[str] = []
            while i < len(lines) and lines[i].strip() != "":
                t = lines[i].strip()
                t = re.sub(r"<[^>]+>", "", t).strip()
                if t:
                    texts.append(t)
                i += 1

            text = " ".join(texts).strip()
            if text:
                segs.append(TranscriptSegment(start=start, duration=dur, text=text))
        else:
            i += 1

    segs.sort(key=lambda s: s.start)
    return segs


def _which(cmd: str) -> Optional[str]:
    for p in os.environ.get("PATH", "").split(os.pathsep):
        fp = Path(p) / cmd
        if fp.exists() and os.access(str(fp), os.X_OK):
            return str(fp)
    return None


def _try_ytdlp_transcript(
    video_id: str,
    *,
    cache_dir: str,
    preferred_languages: List[str],
) -> Optional[TranscriptResult]:
    enabled = os.getenv("ENABLE_YTDLP_TRANSCRIPTS", "1").strip() not in {"0", "false", "False"}
    if not enabled:
        return None

    ytdlp = _which("yt-dlp")
    if not ytdlp:
        return None

    url = f"https://www.youtube.com/watch?v={video_id}"
    out_dir = Path(cache_dir) / "transcripts" / "ytdlp"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_tmpl = str(out_dir / f"{_slug(video_id)}.%(ext)s")

    lang_list = [l.replace("_", "-") for l in preferred_languages if l]
    sub_lang = ",".join(lang_list[:4]) if lang_list else "en"

    attempts: List[List[str]] = [
        [ytdlp, url, "--skip-download", "--quiet", "--no-warnings", "--write-subs", "--sub-format", "vtt", "--sub-lang", sub_lang, "-o", out_tmpl],
        [ytdlp, url, "--skip-download", "--quiet", "--no-warnings", "--write-auto-subs", "--sub-format", "vtt", "--sub-lang", sub_lang, "-o", out_tmpl],
    ]

    vtt_path: Optional[Path] = None

    for cmd in attempts:
        try:
            subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            continue

        candidates = sorted(out_dir.glob(f"{_slug(video_id)}*.vtt"))
        if candidates:
            vtt_path = candidates[0]
            break

    if not vtt_path or not vtt_path.exists():
        return None

    try:
        vtt_text = vtt_path.read_text(encoding="utf-8", errors="ignore")
        segs = _parse_vtt(vtt_text)
        text = _join_segments(segs)

        lang = ""
        parts = vtt_path.name.split(".")
        if len(parts) >= 3:
            lang = parts[-2]

        return TranscriptResult(
            video_id=video_id,
            language=lang,
            text=text,
            source="ytdlp",
            error="",
            error_code="",
            segments=segs,
        )
    except Exception:
        return None


# -------------------------
# Primary API (used by keymoments.py)
# -------------------------
def fetch_transcript(
    video_id: str,
    *,
    cache: TranscriptCache,
    preferred_languages: Optional[List[str]] = None,
) -> TranscriptResult:
    """Fetch transcript text + time-aligned segments (best-effort; never raises).

    Keymoments expects time-aligned segments. This returns TranscriptResult.segments
    where each segment includes (start,duration,text). When only a blob exists, we
    still return ok=False (no segments).

    Strategy:
      1) Return cached
      2) youtube_transcript_api (list_transcripts then get_transcript fallback)
      3) yt-dlp captions fallback (optional; ENABLE_YTDLP_TRANSCRIPTS=1)
    """

    preferred_languages = preferred_languages or ["en", "en-US", "en-GB"]

    cached = cache.get(video_id)
    if isinstance(cached, dict) and ("text" in cached or "segments" in cached):
        return _result_from_cached(video_id, cached)

    # 1) list_transcripts path
    last_err: Optional[Exception] = None
    try:
        tlist = YouTubeTranscriptApi.list_transcripts(video_id)
        chosen = None

        for lang in preferred_languages:
            try:
                chosen = tlist.find_manually_created_transcript([lang])
                break
            except Exception:
                pass

        if chosen is None:
            for lang in preferred_languages:
                try:
                    chosen = tlist.find_generated_transcript([lang])
                    break
                except Exception:
                    pass

        if chosen is None:
            try:
                chosen = next(iter(tlist), None)
            except Exception:
                chosen = None

        if chosen is not None:
            items = chosen.fetch()
            segs = _segments_from_api_items(items)
            text = _join_segments(segs)
            lang = getattr(chosen, "language_code", "") or ""

            res = TranscriptResult(
                video_id=video_id,
                language=lang,
                text=text,
                source="youtube",
                segments=segs,
            )
            cache.set(video_id, _payload_from_result(res))
            return res

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        last_err = e
    except Exception as e:
        last_err = e

    # 2) fast path: get_transcript
    try:
        items = YouTubeTranscriptApi.get_transcript(video_id, languages=preferred_languages)
        segs = _segments_from_api_items(items)
        text = _join_segments(segs)

        lang = preferred_languages[0] if preferred_languages else ""

        res = TranscriptResult(
            video_id=video_id,
            language=lang,
            text=text,
            source="youtube",
            segments=segs,
        )
        cache.set(video_id, _payload_from_result(res))
        return res

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        last_err = e
    except Exception as e:
        last_err = e

    # 3) yt-dlp fallback
    ytdlp_res = _try_ytdlp_transcript(
        video_id,
        cache_dir=cache.cache_dir,
        preferred_languages=preferred_languages,
    )
    if ytdlp_res and ytdlp_res.text.strip():
        cache.set(video_id, _payload_from_result(ytdlp_res))
        return ytdlp_res

    # Return classified error (still cached)
    err_msg = str(last_err) if last_err else ""
    err_code = _classify_error(last_err) if last_err else "unknown"
    res = TranscriptResult(
        video_id=video_id,
        language="",
        text="",
        source="youtube",
        error=err_msg,
        error_code=err_code,
        segments=[],
    )
    cache.set(video_id, _payload_from_result(res))
    return res


# -------------------------
# Back-compat API (older code imports this)
# -------------------------
def fetch_transcript_text(
    video_id: str,
    *,
    cache: TranscriptCache,
    preferred_languages: Optional[List[str]] = None,
) -> TranscriptResult:
    return fetch_transcript(video_id, cache=cache, preferred_languages=preferred_languages)