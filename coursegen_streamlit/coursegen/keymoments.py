
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import hashlib
import json
import re
import time

import requests

from coursegen.embeddings import EmbeddingCache, embed_or_load, cosine_sim
from coursegen.gemini_client import GeminiClient

# transcripts.py has changed shape a few times across this repo.
# This module is intentionally defensive: it supports both
#  - fetch_transcript(video_id, cache=...) -> TranscriptResult(segments=[...])
#  - fetch_transcript_text(video_id, cache=...) -> TranscriptResult(text="...")
try:
    from coursegen.transcripts import TranscriptCache  # type: ignore
    import coursegen.transcripts as _tr  # type: ignore
except Exception:  # pragma: no cover
    TranscriptCache = None  # type: ignore
    _tr = None  # type: ignore


# -------------------------
# Data shapes
# -------------------------
@dataclass
class TranscriptSegment:
    """Local segment shape used by key-moments.

    Some repo versions already define TranscriptSegment in transcripts.py.
    We keep a local version so keymoments stays compatible.
    """

    start: float
    duration: float
    text: str


@dataclass
class KeyMoment:
    # Primary time range for the moment
    start_sec: float
    end_sec: float

    # A representative timestamp to deep-link and screenshot
    frame_sec: float

    # Similarity score (0..1)
    score: float

    # Text that justified this moment (transcript chunk or fallback message)
    text: str

    # One of: ok | text_only | no_transcript | no_backend | no_storyboard | frame_failed
    reason: str = ""

    # `image_path` may be either a local filesystem path OR a remote URL.
    # Streamlit can render both.
    image_path: str = ""


# -------------------------
# Helpers
# -------------------------
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _fmt_time(sec: float) -> str:
    sec = max(0.0, float(sec))
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m:02d}:{s:02d}"


def youtube_thumbnail_url(video_id: str) -> str:
    # lightweight fallback
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def _coerce_segments_from_text(text: str, *, chunk_words: int = 55) -> List[TranscriptSegment]:
    """Fallback when we only have transcript text (no timestamps).

    Creates pseudo segments with increasing timestamps so downstream UX can still
    show "recommended moments". The timestamps are *approximate*.
    """

    if not text:
        return []

    words = text.split()
    out: List[TranscriptSegment] = []

    # Rough speech rate ~150 wpm => 2.5 wps
    wps = 2.5
    t = 0.0

    for i in range(0, len(words), chunk_words):
        chunk = " ".join(words[i : i + chunk_words]).strip()
        if not chunk:
            continue
        dur = max(6.0, min(60.0, len(chunk.split()) / wps))
        out.append(TranscriptSegment(start=t, duration=dur, text=chunk))
        t += dur

    return out


def _coerce_segments_obj(segs: Any) -> List[TranscriptSegment]:
    """Coerce a list of foreign segment objects into our TranscriptSegment list."""
    if not isinstance(segs, list) or not segs:
        return []

    out: List[TranscriptSegment] = []
    for s in segs:
        try:
            # support dict or attribute style
            if isinstance(s, dict):
                start = float(s.get("start", 0.0))
                duration = float(s.get("duration", 0.0))
                text = str(s.get("text", ""))
            else:
                start = float(getattr(s, "start"))
                duration = float(getattr(s, "duration"))
                text = str(getattr(s, "text"))
            if duration <= 0:
                duration = 3.0
            text = text.strip()
            if not text:
                continue
            out.append(TranscriptSegment(start=start, duration=duration, text=text))
        except Exception:
            continue

    return out


def _fetch_segments(video_id: str, *, cache_dir: str) -> Tuple[List[TranscriptSegment], str]:
    """Return (segments, reason).

    reason is one of:
      - "ok" (timestamps)
      - "text_only" (pseudo timestamps)
      - "no_transcript" (unavailable/disabled)
      - "no_backend" (transcripts module missing)
    """

    if TranscriptCache is None or _tr is None:
        return [], "no_backend"

    cache = TranscriptCache(cache_dir)  # type: ignore

    # Preferred: segment-aware API
    fetch_seg = getattr(_tr, "fetch_transcript", None)
    if callable(fetch_seg):
        try:
            tr_obj = fetch_seg(video_id, cache=cache)
            segs = getattr(tr_obj, "segments", None)
            out = _coerce_segments_obj(segs)
            if out:
                return out, "ok"
        except Exception:
            pass

    # Fallback: text-only API
    fetch_txt = getattr(_tr, "fetch_transcript_text", None)
    if callable(fetch_txt):
        try:
            tr_obj = fetch_txt(video_id, cache=cache)
            txt = getattr(tr_obj, "text", "")
            if isinstance(txt, str) and txt.strip():
                return _coerce_segments_from_text(txt), "text_only"
        except Exception:
            pass

    return [], "no_transcript"


def segment_transcript(segments: List[TranscriptSegment], window_sec: float = 55.0) -> List[Tuple[float, float, str]]:
    """Merge transcript items into ~window_sec chunks.

    Returns list of (start,end,text).
    """

    if not segments:
        return []

    out: List[Tuple[float, float, str]] = []

    # sort defensively
    segments = sorted(segments, key=lambda s: float(s.start))

    cur_start = float(segments[0].start)
    cur_end = float(segments[0].start) + float(segments[0].duration)
    buf: List[str] = []

    for seg in segments:
        s = float(seg.start)
        e = float(seg.start) + float(seg.duration)
        t = str(seg.text).strip()
        if not t:
            continue

        if not buf:
            cur_start = s
            cur_end = e
            buf = [t]
            continue

        # if next segment extends window too far, flush
        if (s - cur_start) > window_sec:
            out.append((cur_start, cur_end, " ".join(buf)))
            buf = [t]
            cur_start = s
            cur_end = e
        else:
            buf.append(t)
            cur_end = max(cur_end, e)

    if buf:
        out.append((cur_start, cur_end, " ".join(buf)))

    return out


def _default_frame_sec(start_sec: float, end_sec: float) -> float:
    """Pick a stable representative time within the segment."""
    s = max(0.0, float(start_sec))
    e = max(s, float(end_sec))
    mid = (s + e) / 2.0
    # Snap to 1s for cache friendliness
    return float(int(mid))


# -------------------------
# Storyboard-based frame extraction (NO video download)
# -------------------------

@dataclass
class StoryboardLevel:
    # URL template for tile images (contains $M/$N and often $L)
    url_template: str
    width: int
    height: int
    total_frames: int
    cols: int
    rows: int
    interval_ms: int
    level_index: int

    @property
    def cells_per_tile(self) -> int:
        return max(1, int(self.cols) * int(self.rows))

    @property
    def interval_sec(self) -> float:
        v = int(self.interval_ms)
        # Most commonly interval is in milliseconds (e.g., 10000).
        # Defensive conversion if it looks like seconds.
        if v <= 0:
            return 10.0
        if v < 50:
            return float(v)
        return float(v) / 1000.0


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:16]


def _read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except Exception:
        return ""


def _write_text(p: Path, s: str) -> None:
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(s, encoding="utf-8")
    except Exception:
        pass


def _is_fresh(p: Path, ttl_days: int) -> bool:
    if not p.exists():
        return False
    age = time.time() - p.stat().st_mtime
    return age <= ttl_days * 86400


def _extract_storyboard_spec_from_html(html: str) -> Optional[str]:
    """Extract the storyboard spec string from YouTube watch HTML."""
    if not html:
        return None

    # Try a few patterns; YouTube markup changes.
    patterns = [
        r'"playerStoryboardSpecRenderer"\s*:\s*\{\s*"spec"\s*:\s*"([^"]+)"',
        r'"storyboardSpecRenderer"\s*:\s*\{\s*"spec"\s*:\s*"([^"]+)"',
    ]

    for pat in patterns:
        m = re.search(pat, html)
        if not m:
            continue
        raw = m.group(1)
        try:
            # unescape JSON string content safely
            return json.loads(f'"{raw}"')
        except Exception:
            # best-effort replacements
            return raw.replace("\\u0026", "&").replace("\\/", "/")

    return None


def _parse_storyboard_levels(spec: str, video_id: str) -> List[StoryboardLevel]:
    """Parse storyboard spec into levels.

    Spec format (common):
      <url_template>#<w>#<h>#<count>#<cols>#<rows>#<interval_ms>#... | <level2> | ...

    We parse what we can and skip malformed levels.
    """
    if not spec:
        return []

    levels: List[StoryboardLevel] = []
    parts = spec.split("|")
    for idx, lvl in enumerate(parts):
        if not lvl or "#" not in lvl:
            continue

        bits = lvl.split("#")
        if len(bits) < 7:
            continue

        url_tmpl = bits[0]

        # YouTube sometimes includes $L in template; keep it.
        # Ensure the video_id is present (some templates use it implicitly).
        if "$" not in url_tmpl and video_id not in url_tmpl:
            # not expected, but keep anyway
            pass

        try:
            w = int(float(bits[1]))
            h = int(float(bits[2]))
            total = int(float(bits[3]))
            cols = int(float(bits[4]))
            rows = int(float(bits[5]))
            interval = int(float(bits[6]))
        except Exception:
            continue

        levels.append(
            StoryboardLevel(
                url_template=url_tmpl,
                width=w,
                height=h,
                total_frames=total,
                cols=max(1, cols),
                rows=max(1, rows),
                interval_ms=interval,
                level_index=idx,
            )
        )

    # Prefer higher-res (area)
    levels.sort(key=lambda x: (x.width * x.height, x.level_index), reverse=True)
    return levels


def _fetch_storyboard_levels(video_id: str, *, cache_dir: str, ttl_days: int = 7) -> List[StoryboardLevel]:
    """Fetch and cache storyboard spec, parse into levels."""

    root = Path(cache_dir) / "storyboards"
    spec_file = root / f"{video_id}.json"

    if _is_fresh(spec_file, ttl_days):
        try:
            data = json.loads(_read_text(spec_file) or "{}")
            spec = str(data.get("spec", "") or "")
            if spec:
                return _parse_storyboard_levels(spec, video_id)
        except Exception:
            pass

    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        r = requests.get(url, headers={"User-Agent": _UA}, timeout=15)
        if r.status_code != 200:
            return []
        html = r.text
    except Exception:
        return []

    spec = _extract_storyboard_spec_from_html(html)
    if not spec:
        return []

    _write_text(spec_file, json.dumps({"video_id": video_id, "spec": spec}, ensure_ascii=False, indent=2))
    return _parse_storyboard_levels(spec, video_id)


def _build_tile_url(level: StoryboardLevel, *, video_id: str, level_variant: int, tile_index: int) -> str:
    """Fill placeholders in storyboard template."""
    url = level.url_template

    # Fill $L (level) if present.
    # Some templates use "L$L" and expect 0- or 1-based index; we try variants.
    url = url.replace("$L", str(level_variant))

    # Fill tile index placeholders ($M and/or $N)
    url = url.replace("$M", str(tile_index)).replace("$N", str(tile_index))

    return url


def _download_bytes(url: str, *, timeout: int = 20) -> Optional[bytes]:
    try:
        r = requests.get(url, headers={"User-Agent": _UA, "Referer": "https://www.youtube.com/"}, timeout=timeout)
        if r.status_code != 200:
            return None
        return r.content
    except Exception:
        return None


def _crop_storyboard_cell(img_bytes: bytes, *, col: int, row: int, cell_w: int, cell_h: int) -> Optional[bytes]:
    """Crop a cell from a storyboard tile.

    Returns PNG bytes.
    """
    try:
        from PIL import Image  # type: ignore
        from io import BytesIO

        im = Image.open(BytesIO(img_bytes)).convert("RGB")
        x0 = int(max(0, col * cell_w))
        y0 = int(max(0, row * cell_h))
        x1 = int(min(im.width, x0 + cell_w))
        y1 = int(min(im.height, y0 + cell_h))
        crop = im.crop((x0, y0, x1, y1))

        buf = BytesIO()
        crop.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception:
        return None


def try_extract_frame(
    *,
    video_id: str,
    at_sec: float,
    cache_dir: str,
    prefer_download: bool = True,  # kept for backward-compat; ignored (we do NOT download videos)
) -> str:
    """Best-effort screenshot extraction at timestamp WITHOUT downloading the video.

    Implementation uses YouTube *storyboards* (tile thumbnails) when available:
      - fetch watch HTML, parse storyboard spec
      - download the tile image for the computed frame index
      - crop the exact cell to a PNG

    Output is cached under: {cache_dir}/frames/{video_id}_{sec}.png

    Returns:
      - local path to PNG if successful
      - "" on failure
    """

    frames_dir = Path(cache_dir) / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    sec_i = int(max(0.0, float(at_sec)))
    out_png = frames_dir / f"{video_id}_{sec_i}.png"
    if out_png.exists():
        return str(out_png)

    levels = _fetch_storyboard_levels(video_id, cache_dir=cache_dir)
    if not levels:
        return ""

    level = levels[0]  # highest-res

    # Compute frame index in storyboard timeline
    interval = max(1.0, float(level.interval_sec))
    frame_index = int(max(0.0, float(at_sec)) // interval)

    # Clamp to available frames
    if level.total_frames > 0:
        frame_index = min(frame_index, max(0, level.total_frames - 1))

    cells = level.cells_per_tile
    tile_index = int(frame_index // cells)
    cell_index = int(frame_index % cells)
    row = int(cell_index // max(1, level.cols))
    col = int(cell_index % max(1, level.cols))

    # Download tile; try both 0-based and 1-based $L substitutions
    tile_bytes: Optional[bytes] = None
    tile_url_used: Optional[str] = None

    for lvar in [level.level_index, level.level_index + 1]:
        tile_url = _build_tile_url(level, video_id=video_id, level_variant=int(lvar), tile_index=tile_index)

        # Cache tile by URL hash to avoid repeated network
        tile_dir = Path(cache_dir) / "storyboards" / "tiles"
        tile_dir.mkdir(parents=True, exist_ok=True)
        tile_path = tile_dir / f"{video_id}_{_sha1(tile_url)}.jpg"

        if tile_path.exists():
            try:
                tile_bytes = tile_path.read_bytes()
                tile_url_used = tile_url
                break
            except Exception:
                tile_bytes = None

        b = _download_bytes(tile_url)
        if b:
            tile_bytes = b
            tile_url_used = tile_url
            try:
                tile_path.write_bytes(b)
            except Exception:
                pass
            break

    if not tile_bytes:
        return ""

    # Crop the cell from the tile.
    png_bytes = _crop_storyboard_cell(tile_bytes, col=col, row=row, cell_w=level.width, cell_h=level.height)

    # If cropping isn't available (no Pillow), fall back to writing the raw jpg tile
    # as a "frame". (Streamlit will still render it, but it's a grid.)
    try:
        if png_bytes:
            out_png.write_bytes(png_bytes)
            return str(out_png)
    except Exception:
        pass

    # Fallback: save tile as-is
    try:
        out_jpg = frames_dir / f"{video_id}_{sec_i}.jpg"
        out_jpg.write_bytes(tile_bytes)
        return str(out_jpg)
    except Exception:
        # ultimate fallback: return the remote tile URL so Streamlit can still show *something*
        return tile_url_used or ""


def _extract_with_jitter(
    *,
    video_id: str,
    frame_sec: float,
    cache_dir: str,
    jitter_sec: int = 2,
    prefer_download: bool = True,
) -> str:
    """Try a few nearby timestamps to avoid blank/transition frames."""

    base = int(max(0.0, float(frame_sec)))
    tries: List[int] = [base]
    for d in range(1, max(0, int(jitter_sec)) + 1):
        tries.append(max(0, base - d))
        tries.append(base + d)

    for t in tries:
        p = try_extract_frame(video_id=video_id, at_sec=float(t), cache_dir=cache_dir, prefer_download=prefer_download)
        if p:
            return p

    return ""


# -------------------------
# Public API
# -------------------------

def pick_key_moments(
    gemini: GeminiClient,
    *,
    cache_dir: str,
    embed_model: str,
    video_id: str,
    lesson_query: str,
    top_n: int = 3,
    # If we cannot access transcripts, we still return thumbnail/storyboard placeholders.
    allow_no_transcript_fallback: bool = True,
    # If you know duration, pass it for better fallback timestamps.
    video_duration_sec: Optional[float] = None,
    # If True, attempt to extract real screenshot frames via storyboards.
    extract_frames: bool = True,
    # When extracting frames, also try +/- jitter seconds.
    frame_jitter_sec: int = 2,
    # Kept for backwards compat; ignored (no video downloads).
    prefer_download: bool = True,
) -> List[KeyMoment]:
    """Select key moments in a video that best match the lesson_query.

    Strategy:
      1) If transcript segments exist: embed query + chunk text, cosine similarity.
      2) If only transcript text exists: create pseudo-timestamp segments.
      3) If no transcript: return a small set of reasonable timestamp placeholders.

    Screenshots:
      - Uses YouTube storyboards (tile thumbnails) to crop a representative frame.
      - This avoids downloading full videos (fast + low bandwidth).
      - If storyboards are unavailable, falls back to standard YouTube thumbnail.
    """

    top_n = max(1, int(top_n))

    segments, tr_reason = _fetch_segments(video_id, cache_dir=cache_dir)

    # -----------------
    # No transcript path
    # -----------------
    if not segments:
        if not allow_no_transcript_fallback:
            return []

        # Fallback moments: pick a few evenly spaced timestamps.
        # If we don't know duration, assume ~10 minutes.
        dur = float(video_duration_sec) if video_duration_sec else 600.0
        dur = max(60.0, dur)

        # pick up to top_n timestamps, avoid 0
        picks: List[float] = []
        for k in range(top_n):
            frac = (k + 1) / (top_n + 1)
            t = dur * frac
            # snap to 5s to make cache-friendly
            t = float(int(t / 5.0) * 5)
            picks.append(t)

        msg = (
            "Transcript unavailable (disabled/missing). "
            "These are approximate moments; open the video and scrub near the timestamp."
        )

        out: List[KeyMoment] = []
        for t in picks:
            s = max(0.0, t - 8.0)
            e = min(dur, t + 8.0)
            frame_sec = float(int(max(0.0, t)))

            img = ""
            reason = tr_reason

            if extract_frames:
                img = _extract_with_jitter(
                    video_id=video_id,
                    frame_sec=frame_sec,
                    cache_dir=cache_dir,
                    jitter_sec=frame_jitter_sec,
                    prefer_download=prefer_download,
                )
                if not img:
                    reason = "no_storyboard"

            if not img:
                img = youtube_thumbnail_url(video_id)

            out.append(
                KeyMoment(
                    start_sec=s,
                    end_sec=e,
                    frame_sec=frame_sec,
                    score=0.0,
                    text=f"{msg}  Suggested: {_fmt_time(t)}  (reason={tr_reason})",
                    reason=reason,
                    image_path=img,
                )
            )

        return out

    # -----------------
    # Transcript scoring
    # -----------------
    chunks = segment_transcript(segments, window_sec=55.0)
    if not chunks:
        return []

    # Embed query once
    ecache = EmbeddingCache(cache_dir)
    q_key = f"km_query::{hash(lesson_query)}::{embed_model}"
    vq = embed_or_load(gemini, cache=ecache, key=q_key, text=lesson_query, embed_model=embed_model)

    scored: List[KeyMoment] = []

    # Cap worst-case to avoid huge compute
    for i, (s, e, txt) in enumerate(chunks[:260]):
        key = f"km::{video_id}::{i}::{hash(txt)}::{embed_model}"
        vc = embed_or_load(gemini, cache=ecache, key=key, text=txt, embed_model=embed_model)
        sim = cosine_sim(vq, vc)
        score = _clamp((sim + 1.0) / 2.0)

        # Add a tiny preference for tighter segments (teaching moments)
        seg_len = max(1.0, float(e) - float(s))
        len_penalty = _clamp((seg_len - 30.0) / 120.0) * 0.15  # up to -0.15 on very long
        score = _clamp(score * (1.0 - len_penalty))

        frame_sec = _default_frame_sec(s, e)

        scored.append(
            KeyMoment(
                start_sec=float(s),
                end_sec=float(e),
                frame_sec=float(frame_sec),
                score=float(score),
                text=str(txt),
                reason=tr_reason,
                image_path="",
            )
        )

    # Deduplicate near-duplicates (avoid 3 moments all in same minute)
    scored.sort(key=lambda x: x.score, reverse=True)
    picked: List[KeyMoment] = []
    for km in scored:
        if len(picked) >= top_n:
            break
        ok = True
        for p in picked:
            if abs(km.frame_sec - p.frame_sec) < 35.0:
                ok = False
                break
        if ok:
            picked.append(km)

    # If still short, backfill
    if len(picked) < top_n:
        for km in scored:
            if len(picked) >= top_n:
                break
            if km not in picked:
                picked.append(km)

    # Attach images (storyboard crop if possible, else thumbnails)
    for km in picked:
        img = ""
        reason = km.reason

        if extract_frames:
            img = _extract_with_jitter(
                video_id=video_id,
                frame_sec=km.frame_sec,
                cache_dir=cache_dir,
                jitter_sec=frame_jitter_sec,
                prefer_download=prefer_download,
            )
            if not img:
                reason = "no_storyboard"

        if img:
            km.image_path = img
            km.reason = reason
        else:
            km.image_path = youtube_thumbnail_url(video_id)
            km.reason = reason

    return picked[:top_n]
