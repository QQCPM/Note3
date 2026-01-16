# coursegen/video_frames.py
from __future__ import annotations

import hashlib
import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


# ---------------------------------
# Small helpers
# ---------------------------------

def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:20]


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _unescape_spec(s: str) -> str:
    """YouTube embeds storyboard spec with JSON escaping and \u0026."""
    if not s:
        return s
    # common YouTube escape
    s = s.replace("\\u0026", "&")
    # if it still looks JSON-escaped, try decoding
    try:
        return json.loads(f'"{s}"')
    except Exception:
        return s


def _http_get(url: str, *, timeout: int = 12) -> str:
    """Fetch text from URL with a browser-ish user agent."""
    try:
        import requests  # type: ignore

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            )
        }
        r = requests.get(url, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.text
    except Exception:
        # stdlib fallback
        import urllib.request

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                )
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as fp:
            return fp.read().decode("utf-8", errors="ignore")


def _download_bytes(url: str, *, timeout: int = 15) -> bytes:
    try:
        import requests  # type: ignore

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            )
        }
        r = requests.get(url, headers=headers, timeout=timeout)
        r.raise_for_status()
        return r.content
    except Exception:
        import urllib.request

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/121.0.0.0 Safari/537.36"
                )
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as fp:
            return fp.read()


# ---------------------------------
# Public data shapes
# ---------------------------------


@dataclass
class StoryboardLevel:
    level: int
    width: int
    height: int
    frames: int
    cols: int
    rows: int
    interval_s: float


@dataclass
class StoryboardSpec:
    video_id: str
    base_url: str
    levels: List[StoryboardLevel]


@dataclass
class FrameResult:
    video_id: str
    time_s: float
    path: str
    ok: bool
    meta: Dict[str, Any]


# ---------------------------------
# Storyboard scraping + parsing
# ---------------------------------


_STORYBOARD_SPEC_PATTERNS = [
    # common: ..."playerStoryboardSpecRenderer":{"spec":"..."}
    re.compile(r"playerStoryboardSpecRenderer\"\s*:\s*\{\s*\"spec\"\s*:\s*\"([^\"]+)\""),
    # fallback: "storyboard_spec":"..."
    re.compile(r"\"storyboard_spec\"\s*:\s*\"([^\"]+)\""),
]


def _extract_storyboard_spec_string(html: str) -> Optional[str]:
    for pat in _STORYBOARD_SPEC_PATTERNS:
        m = pat.search(html)
        if m:
            return _unescape_spec(m.group(1))
    return None


def _parse_level(entry: str, level_idx: int) -> Optional[StoryboardLevel]:
    # format (observed): width#height#frames#cols#rows#interval#... (extra fields vary)
    parts = entry.split("#")
    if len(parts) < 6:
        return None
    try:
        w = int(parts[0])
        h = int(parts[1])
        frames = int(parts[2])
        cols = int(parts[3])
        rows = int(parts[4])
        raw_interval = float(parts[5])
    except Exception:
        return None

    # Heuristic: interval is often in milliseconds; if it looks large, treat as ms
    interval_s = raw_interval / 1000.0 if raw_interval > 50 else raw_interval
    interval_s = max(0.5, float(interval_s))

    return StoryboardLevel(
        level=level_idx,
        width=w,
        height=h,
        frames=frames,
        cols=max(1, cols),
        rows=max(1, rows),
        interval_s=interval_s,
    )


def get_storyboard_spec(video_id: str) -> Optional[StoryboardSpec]:
    """Scrape YouTube watch page for storyboard spec (no YouTube Data API quota)."""
    vid = (video_id or "").strip()
    if not vid:
        return None

    url = f"https://www.youtube.com/watch?v={vid}"
    html = _http_get(url)

    spec_str = _extract_storyboard_spec_string(html)
    if not spec_str:
        return None

    # spec format: base_url | level1 | level2 | ...
    # where each level is a # separated descriptor
    parts = spec_str.split("|")
    if not parts:
        return None

    base_url = parts[0]
    levels: List[StoryboardLevel] = []

    # Parse subsequent parts as levels
    # The number of entries varies; skip anything that doesn't parse.
    for i, entry in enumerate(parts[1:], start=1):
        lvl = _parse_level(entry, level_idx=i)
        if lvl:
            levels.append(lvl)

    if not levels:
        return None

    return StoryboardSpec(video_id=vid, base_url=base_url, levels=levels)


def _pick_best_level(spec: StoryboardSpec) -> StoryboardLevel:
    # prefer higher level index, then larger tile area
    return sorted(
        spec.levels,
        key=lambda l: (l.level, l.width * l.height),
        reverse=True,
    )[0]


def _format_storyboard_url(base_url: str, *, level: int, image_index: int) -> str:
    # base_url usually contains $L and $M (or $N)
    u = base_url
    u = u.replace("$L", str(int(level)))
    u = u.replace("$M", str(int(image_index)))
    u = u.replace("$N", str(int(image_index)))
    return u


# ---------------------------------
# Cropping frames from storyboard
# ---------------------------------


def _mmss(t: float) -> str:
    t = max(0.0, float(t))
    m = int(t // 60)
    s = int(t % 60)
    return f"{m:02d}:{s:02d}"


def get_frame(
    video_id: str,
    time_s: float,
    *,
    cache_dir: str = "data/cache",
    spec: Optional[StoryboardSpec] = None,
    level: Optional[int] = None,
) -> FrameResult:
    """Return a cached cropped storyboard frame for a given time (no video download)."""
    vid = (video_id or "").strip()
    t = max(0.0, float(time_s))

    frames_root = Path(cache_dir) / "frames" / vid
    _ensure_dir(frames_root)

    # Cache key: time rounded to nearest second (good enough for storyboard tiles)
    t_key = int(round(t))

    # Load / reuse storyboard spec
    spec = spec or get_storyboard_spec(vid)
    if not spec:
        return FrameResult(
            video_id=vid,
            time_s=t,
            path="",
            ok=False,
            meta={"reason": "no_storyboard_spec"},
        )

    # Choose level
    chosen_level = None
    if level is not None:
        for l in spec.levels:
            if l.level == int(level):
                chosen_level = l
                break
    if chosen_level is None:
        chosen_level = _pick_best_level(spec)

    # Map time -> tile
    interval = max(0.5, float(chosen_level.interval_s))
    tile_index = int(math.floor(t / interval))
    tile_index = max(0, min(tile_index, max(0, chosen_level.frames - 1)))

    tiles_per_image = int(chosen_level.cols * chosen_level.rows)
    img_index = tile_index // max(1, tiles_per_image)
    within = tile_index % max(1, tiles_per_image)
    col = within % chosen_level.cols
    row = within // chosen_level.cols

    # Final cached crop path
    out_name = f"L{chosen_level.level}_t{t_key:06d}_tile{tile_index:06d}.jpg"
    out_path = frames_root / out_name

    if out_path.exists() and out_path.stat().st_size > 0:
        return FrameResult(
            video_id=vid,
            time_s=t,
            path=str(out_path),
            ok=True,
            meta={
                "cache_hit": True,
                "level": chosen_level.level,
                "interval_s": interval,
                "tile_index": tile_index,
                "time_label": _mmss(t),
            },
        )

    # Download storyboard sheet
    sheet_url = _format_storyboard_url(spec.base_url, level=chosen_level.level, image_index=img_index)

    try:
        blob = _download_bytes(sheet_url)
    except Exception as e:
        return FrameResult(
            video_id=vid,
            time_s=t,
            path="",
            ok=False,
            meta={
                "reason": "download_failed",
                "error": str(e),
                "sheet_url": sheet_url,
            },
        )

    # Crop tile
    try:
        from PIL import Image  # type: ignore
        from io import BytesIO

        im = Image.open(BytesIO(blob)).convert("RGB")
        x0 = int(col * chosen_level.width)
        y0 = int(row * chosen_level.height)
        x1 = int(x0 + chosen_level.width)
        y1 = int(y0 + chosen_level.height)

        # Clamp crop within image bounds
        x0 = int(_clamp(x0, 0, im.size[0]))
        y0 = int(_clamp(y0, 0, im.size[1]))
        x1 = int(_clamp(x1, 0, im.size[0]))
        y1 = int(_clamp(y1, 0, im.size[1]))

        crop = im.crop((x0, y0, x1, y1))
        crop.save(out_path, format="JPEG", quality=85, optimize=True)

        ok = out_path.exists() and out_path.stat().st_size > 0
        return FrameResult(
            video_id=vid,
            time_s=t,
            path=str(out_path),
            ok=ok,
            meta={
                "cache_hit": False,
                "sheet_url": sheet_url,
                "level": chosen_level.level,
                "interval_s": interval,
                "tile_index": tile_index,
                "image_index": img_index,
                "col": col,
                "row": row,
                "time_label": _mmss(t),
            },
        )
    except Exception as e:
        return FrameResult(
            video_id=vid,
            time_s=t,
            path="",
            ok=False,
            meta={
                "reason": "crop_failed",
                "error": str(e),
                "sheet_url": sheet_url,
            },
        )


def get_frames(
    video_id: str,
    times_s: Iterable[float],
    *,
    cache_dir: str = "data/cache",
) -> List[FrameResult]:
    """Batch helper (reuses storyboard spec)."""
    spec = get_storyboard_spec(video_id)
    out: List[FrameResult] = []
    for t in times_s:
        out.append(get_frame(video_id, float(t), cache_dir=cache_dir, spec=spec))
    return out


def youtube_thumbnail_url(video_id: str, *, quality: str = "hqdefault") -> str:
    """Zero-quota fallback image."""
    vid = (video_id or "").strip()
    q = quality if quality in {"default", "mqdefault", "hqdefault", "sddefault", "maxresdefault"} else "hqdefault"
    return f"https://i.ytimg.com/vi/{vid}/{q}.jpg"