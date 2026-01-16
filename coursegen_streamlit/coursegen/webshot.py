# coursegen/webshot.py
from __future__ import annotations

import os
import re
import time
import json
import math
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Playwright is the most reliable way to render pages that include tables/figures
# pip install playwright
# playwright install
try:
    from playwright.sync_api import sync_playwright  # type: ignore
except Exception:  # pragma: no cover
    sync_playwright = None


# -----------------------------
# Data models
# -----------------------------
@dataclass
class WebShot:
    url: str
    kind: str  # "main" | "element"
    path: str
    score: float
    meta: Dict[str, Any]


# -----------------------------
# Utils
# -----------------------------
def _sha(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:20]


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def _now() -> float:
    return time.time()


def _is_fresh(path: Path, ttl_days: int) -> bool:
    if not path.exists():
        return False
    age = _now() - path.stat().st_mtime
    return age <= ttl_days * 86400


def _sanitize_filename(s: str, max_len: int = 100) -> str:
    s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s).strip("_")
    return s[:max_len] if len(s) > max_len else s


# -----------------------------
# Main content heuristics
# -----------------------------
# We try to find the largest "content-like" element on the page:
# - prefer article/main/#content/.content, etc
# - avoid header/nav/footer/sidebar/ads
_MAIN_SELECTORS = [
    "article",
    "main",
    "#content",
    "#main",
    ".content",
    ".article",
    ".post",
    ".entry-content",
    ".markdown-body",
    ".prose",
    ".paper",
]

_BAD_SELECTORS = [
    "header",
    "nav",
    "footer",
    "aside",
    ".sidebar",
    ".menu",
    ".navbar",
    ".topbar",
    ".cookie",
    ".consent",
    ".ads",
    ".advert",
    "[role=banner]",
    "[role=navigation]",
]


_ELEMENT_SELECTORS = [
    "figure",
    "table",
    "pre",
    "code",
    "img",
    "svg",
    "canvas",
    "h2",
    "h3",
    "h4",
]


def _js_hide_noise() -> str:
    # Hide typical noisy UI that ruins screenshots.
    return """
(() => {
  const bad = %s;
  for (const sel of bad) {
    document.querySelectorAll(sel).forEach(el => {
      el.style.visibility = 'hidden';
      el.style.display = 'none';
    });
  }

  // Hide common cookie banners by keywords
  const keywords = ['cookie', 'consent', 'gdpr', 'subscribe', 'sign in', 'newsletter'];
  const els = Array.from(document.querySelectorAll('div,section,aside'));
  for (const el of els) {
    const t = (el.innerText || '').toLowerCase();
    if (!t) continue;
    if (keywords.some(k => t.includes(k)) && t.length < 2000) {
      el.style.visibility = 'hidden';
      el.style.display = 'none';
    }
  }
})();
""" % json.dumps(_BAD_SELECTORS)


def _js_pick_main_element() -> str:
    # Return a list of candidate elements with their bounding boxes and simple signals.
    # We score by:
    # - area (bigger is better)
    # - text length (bigger is better)
    # - "content selector" bonus
    # - penalize if contains mostly links or looks like a nav list
    return """
(() => {
  function box(el) {
    const r = el.getBoundingClientRect();
    return {x:r.x, y:r.y, w:r.width, h:r.height};
  }
  function textLen(el) {
    const t = (el.innerText || '').trim();
    return t.length;
  }
  function linkRatio(el) {
    const links = el.querySelectorAll('a').length;
    const texts = (el.innerText || '').split(/\\s+/).filter(Boolean).length;
    if (texts <= 0) return 1.0;
    return Math.min(1.0, links / Math.max(1, texts));
  }
  const prefer = %s;

  const candidates = [];
  // prefer list
  for (const sel of prefer) {
    document.querySelectorAll(sel).forEach(el => candidates.push({el, sel, prefer:true}));
  }
  // fallback: body children
  if (candidates.length === 0) {
    document.querySelectorAll('body > *').forEach(el => candidates.push({el, sel:'body>*', prefer:false}));
  }

  const out = [];
  for (const c of candidates) {
    const b = box(c.el);
    if (!b || b.w < 200 || b.h < 200) continue;
    const tl = textLen(c.el);
    const lr = linkRatio(c.el);
    out.push({
      selector: c.sel,
      prefer: c.prefer,
      box: b,
      text_len: tl,
      link_ratio: lr
    });
  }
  // sort by (prefer, area, text_len)
  out.sort((a,b) => {
    const ap = a.prefer ? 1:0, bp = b.prefer ? 1:0;
    if (ap !== bp) return bp - ap;
    const aa = a.box.w * a.box.h, ba = b.box.w * b.box.h;
    if (aa !== ba) return ba - aa;
    return (b.text_len||0) - (a.text_len||0);
  });
  return out.slice(0, 12);
})();
""" % json.dumps(_MAIN_SELECTORS)


def _js_list_content_elements() -> str:
    # Return list of content elements for element-level screenshots (tables/figures).
    # Limit to things that are large enough and visible.
    return """
(() => {
  function box(el) {
    const r = el.getBoundingClientRect();
    return {x:r.x, y:r.y, w:r.width, h:r.height};
  }
  const sels = %s;
  const out = [];
  for (const sel of sels) {
    document.querySelectorAll(sel).forEach(el => {
      const st = window.getComputedStyle(el);
      if (!st || st.display === 'none' || st.visibility === 'hidden') return;
      const b = box(el);
      if (!b || b.w < 240 || b.h < 160) return;
      // Ignore likely logos/icons: tiny images at top
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'img' && (b.w*b.h) < (350*220)) return;
      out.push({
        selector: sel,
        tag: tag,
        box: b,
        text_len: ((el.innerText||'').trim().length),
        src: (tag==='img' ? (el.getAttribute('src')||'') : ''),
      });
    });
  }
  // De-dup by box approx
  function key(b){
    return [Math.round(b.x/10),Math.round(b.y/10),Math.round(b.w/10),Math.round(b.h/10)].join(',');
  }
  const seen = new Set();
  const uniq = [];
  for (const it of out) {
    const k = key(it.box);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  // prefer tables/figures/pre/code over headings
  const tagScore = (t) => {
    if (t==='table') return 1.0;
    if (t==='figure') return 0.95;
    if (t==='pre' || t==='code') return 0.9;
    if (t==='img' || t==='svg' || t==='canvas') return 0.8;
    if (t==='h2' || t==='h3' || t==='h4') return 0.4;
    return 0.5;
  };
  uniq.sort((a,b) => {
    const as = tagScore(a.tag), bs = tagScore(b.tag);
    if (as !== bs) return bs - as;
    const aa = a.box.w*a.box.h, ba=b.box.w*b.box.h;
    if (aa !== ba) return ba - aa;
    return (b.text_len||0)-(a.text_len||0);
  });
  return uniq.slice(0, 24);
})();
""" % json.dumps(_ELEMENT_SELECTORS)


def _score_shot(kind: str, meta: Dict[str, Any]) -> float:
    """
    Heuristic to rank screenshots so you don't show logos/headers.
    Scoring signals:
      - area
      - content tag priority
      - text length
      - penalize if image src looks like a logo/icon
    """
    b = meta.get("box") or {}
    area = float(b.get("w", 0)) * float(b.get("h", 0))
    # normalize area (approx, assumes typical page sizes)
    area_norm = _clamp(area / (1200.0 * 800.0))

    text_len = float(meta.get("text_len") or 0.0)
    text_norm = _clamp(text_len / 4000.0)

    tag = (meta.get("tag") or "").lower()
    tag_bonus = 0.0
    if tag == "table":
        tag_bonus = 0.25
    elif tag == "figure":
        tag_bonus = 0.22
    elif tag in ("pre", "code"):
        tag_bonus = 0.18
    elif tag in ("img", "svg", "canvas"):
        tag_bonus = 0.10
    elif tag in ("h2", "h3", "h4"):
        tag_bonus = 0.04

    src = (meta.get("src") or "").lower()
    logo_pen = 0.0
    if any(k in src for k in ["logo", "icon", "favicon", "sprite"]):
        logo_pen += 0.35

    # main shots should depend more on area + text
    if kind == "main":
        score = 0.55 * area_norm + 0.45 * text_norm - logo_pen
    else:
        score = 0.50 * area_norm + 0.30 * text_norm + tag_bonus - logo_pen

    return _clamp(score)


# -----------------------------
# Public API
# -----------------------------
def screenshot_article(
    url: str,
    *,
    out_dir: str = "data/cache/webshot",
    timeout_ms: int = 25000,
    ttl_days: int = 14,
    viewport: Tuple[int, int] = (1280, 720),
    full_page: bool = True,
    max_element_shots: int = 8,
    headless: bool = True,
) -> Dict[str, Any]:
    """
    Returns:
      {
        "url": str,
        "main": WebShot or None,
        "elements": [WebShot...],
        "all": [WebShot...],
        "debug": {...}
      }
    """
    if sync_playwright is None:
        raise RuntimeError(
            "Playwright not installed. Run: pip install playwright && playwright install"
        )

    root = Path(out_dir)
    _ensure_dir(root)

    cache_key = _sha(f"{url}|{viewport}|{full_page}|{max_element_shots}")
    cache_json = root / f"{cache_key}.json"
    if _is_fresh(cache_json, ttl_days):
        try:
            return json.loads(cache_json.read_text(encoding="utf-8"))
        except Exception:
            pass

    shots: List[WebShot] = []
    debug: Dict[str, Any] = {"url": url, "cache_key": cache_key}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            # allow some render time for dynamic content
            page.wait_for_timeout(800)
            # hide noise
            page.evaluate(_js_hide_noise())
            page.wait_for_timeout(200)

            # pick main content candidates
            main_cands = page.evaluate(_js_pick_main_element())
            debug["main_candidates"] = main_cands

            main_shot: Optional[WebShot] = None
            if isinstance(main_cands, list) and main_cands:
                best = main_cands[0]
                box = best.get("box") or {}
                clip = {
                    "x": max(0, float(box.get("x", 0))),
                    "y": max(0, float(box.get("y", 0))),
                    "width": max(1, float(box.get("w", 1))),
                    "height": max(1, float(box.get("h", 1))),
                }
                # Scroll near the box so screenshot captures actual pixels
                page.evaluate(
                    """(y) => window.scrollTo({top: Math.max(0,y-120), behavior:'instant'})""",
                    clip["y"],
                )
                page.wait_for_timeout(200)

                main_path = root / f"{cache_key}_main.png"
                page.screenshot(path=str(main_path), clip=clip)

                meta = {
                    "box": box,
                    "selector": best.get("selector"),
                    "text_len": best.get("text_len"),
                    "prefer": best.get("prefer"),
                }
                sc = _score_shot("main", meta)
                main_shot = WebShot(url=url, kind="main", path=str(main_path), score=sc, meta=meta)
                shots.append(main_shot)

            # element shots (figures/tables)
            elem_meta = page.evaluate(_js_list_content_elements())
            debug["element_candidates"] = elem_meta

            elems: List[WebShot] = []
            if isinstance(elem_meta, list) and elem_meta:
                for i, it in enumerate(elem_meta[: max(1, max_element_shots)]):
                    box = it.get("box") or {}
                    clip = {
                        "x": max(0, float(box.get("x", 0))),
                        "y": max(0, float(box.get("y", 0))),
                        "width": max(1, float(box.get("w", 1))),
                        "height": max(1, float(box.get("h", 1))),
                    }
                    # scroll close
                    page.evaluate(
                        """(y) => window.scrollTo({top: Math.max(0,y-120), behavior:'instant'})""",
                        clip["y"],
                    )
                    page.wait_for_timeout(150)

                    tag = (it.get("tag") or "el").lower()
                    elem_path = root / f"{cache_key}_el{i+1}_{_sanitize_filename(tag)}.png"
                    try:
                        page.screenshot(path=str(elem_path), clip=clip)
                    except Exception:
                        continue

                    sc = _score_shot("element", it)
                    elems.append(WebShot(url=url, kind="element", path=str(elem_path), score=sc, meta=dict(it)))
                    shots.append(elems[-1])

            # sort element shots best-first
            elems.sort(key=lambda s: s.score, reverse=True)

            result = {
                "url": url,
                "main": (vars(main_shot) if main_shot else None),
                "elements": [vars(s) for s in elems],
                "all": [vars(s) for s in sorted(shots, key=lambda s: s.score, reverse=True)],
                "debug": debug,
            }

            cache_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
            return result

        finally:
            try:
                page.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass


def pick_best_content_shots(
    webshot_result: Dict[str, Any],
    *,
    k: int = 4,
    prefer_tables: bool = True,
) -> List[str]:
    """
    Given screenshot_article() output, return file paths of best "content-like" images.
    """
    all_items = webshot_result.get("all") or []
    if not isinstance(all_items, list):
        return []

    def boost(it: Dict[str, Any]) -> float:
        sc = float(it.get("score") or 0.0)
        meta = it.get("meta") or {}
        tag = (meta.get("tag") or "").lower()
        if prefer_tables and tag == "table":
            sc += 0.12
        if prefer_tables and tag == "figure":
            sc += 0.08
        return sc

    ranked = sorted(all_items, key=boost, reverse=True)
    out: List[str] = []
    for it in ranked:
        p = it.get("path")
        if p and isinstance(p, str) and os.path.exists(p):
            out.append(p)
        if len(out) >= k:
            break
    return out