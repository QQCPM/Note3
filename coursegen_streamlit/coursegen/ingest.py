from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict
import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

try:
    from pypdf import PdfReader  # type: ignore
except Exception:
    PdfReader = None  # type: ignore

try:
    import trafilatura  # type: ignore
except Exception:
    trafilatura = None  # type: ignore


@dataclass
class LinkDoc:
    url: str
    title: str
    text: str
    images: List[str]  # URLs


def _clean(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s


# ----------------------------
# URL / HTML helpers
# ----------------------------
_IMG_BAD_HINTS = (
    "logo",
    "icon",
    "sprite",
    "avatar",
    "favicon",
    "badge",
    "spinner",
    "loading",
    "placeholder",
    "tracking",
    "pixel",
    "ads",
    "advert",
)

_IMG_BAD_EXTS = (".svg", ".ico")


def _abs_url(base: str, maybe: str) -> str:
    u = (maybe or "").strip()
    if not u:
        return ""
    if u.startswith("data:"):
        return ""  # ignore inline data URIs
    if u.startswith("//"):
        return "https:" + u
    if u.startswith("http://") or u.startswith("https://"):
        return u
    try:
        return urljoin(base, u)
    except Exception:
        return u


def _pick_best_from_srcset(srcset: str) -> str:
    """Pick the largest candidate from an img srcset string."""
    if not srcset:
        return ""
    best_url = ""
    best_score = -1.0
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        bits = part.split()
        u = bits[0].strip() if bits else ""
        score = 0.0
        if len(bits) >= 2:
            hint = bits[1].strip().lower()
            # handle "800w" or "2x"
            m = re.match(r"^(\d+)(w|x)$", hint)
            if m:
                try:
                    score = float(m.group(1))
                    if m.group(2) == "x":
                        score *= 1000.0
                except Exception:
                    score = 0.0
        if score > best_score:
            best_score = score
            best_url = u
    return best_url


def _looks_like_content_image(url: str) -> bool:
    u = (url or "").lower()
    if not u:
        return False
    if any(h in u for h in _IMG_BAD_HINTS):
        return False
    if any(u.endswith(ext) for ext in _IMG_BAD_EXTS):
        return False
    return True


def _tag_context_score(tag) -> float:
    """Boost images that appear in content-y containers."""
    score = 0.0
    try:
        # direct containers
        for parent in tag.parents:
            if not getattr(parent, "name", None):
                continue
            nm = parent.name.lower()
            if nm in ("figure",):
                score += 2.5
                break
            if nm in ("article", "main"):
                score += 1.5
                break
            if nm in ("table",):
                score += 2.0
                break
            if nm in ("header", "nav", "footer"):
                score -= 2.0
                break

        # class/id hints
        cls = " ".join(tag.get("class", [])).lower()
        tid = (tag.get("id") or "").lower()
        blob = f"{cls} {tid}"
        if any(k in blob for k in ("content", "article", "post", "body", "main", "figure", "chart", "table", "diagram")):
            score += 1.0
        if any(k in blob for k in ("logo", "icon", "avatar", "nav", "footer", "header", "ads", "advert")):
            score -= 1.5
    except Exception:
        pass
    return score


def _img_size_score(tag) -> float:
    """Estimate size score from width/height attributes if present."""
    w = tag.get("width")
    h = tag.get("height")
    try:
        w = int(str(w).strip()) if w is not None else None
    except Exception:
        w = None
    try:
        h = int(str(h).strip()) if h is not None else None
    except Exception:
        h = None

    if w is None and h is None:
        return 0.0

    # Penalize tiny assets
    if (w is not None and w <= 120) or (h is not None and h <= 120):
        return -2.0

    # Reward medium/large
    area = float((w or 600) * (h or 400))
    # normalize ~ 800x600 -> 1.0
    return min(2.0, max(0.0, area / (800.0 * 600.0)))


def _score_img(tag, base_url: str) -> Tuple[float, str]:
    """Return (score, absolute_url) for an <img> tag."""
    # Prefer srcset (largest) then src
    srcset = (tag.get("srcset") or "").strip()
    cand = _pick_best_from_srcset(srcset)
    src = (cand or tag.get("src") or "").strip()

    # Some sites lazy-load
    if not src:
        for k in ("data-src", "data-original", "data-lazy-src", "data-srcset"):
            v = (tag.get(k) or "").strip()
            if v:
                if k.endswith("srcset"):
                    v = _pick_best_from_srcset(v)
                src = v
                break

    abs_u = _abs_url(base_url, src)
    if not abs_u:
        return (-999.0, "")

    if not _looks_like_content_image(abs_u):
        return (-5.0, abs_u)

    score = 0.0
    score += _tag_context_score(tag)
    score += _img_size_score(tag)

    # Alt/caption hints
    alt = (tag.get("alt") or "").lower()
    if alt:
        if any(k in alt for k in ("figure", "chart", "table", "diagram", "architecture", "pipeline")):
            score += 0.8
        if any(k in alt for k in ("logo", "icon", "avatar")):
            score -= 1.0

    # Prefer common content formats
    u_low = abs_u.lower()
    if any(u_low.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp")):
        score += 0.3

    return (score, abs_u)


def extract_text_from_pdf_bytes(pdf_bytes: bytes, max_chars: int = 120_000) -> str:
    """
    Extract text from a PDF. If pypdf isn't installed, returns empty string.
    """
    if PdfReader is None:
        return ""
    try:
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))
        parts: List[str] = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        text = _clean("\n".join(parts))
        return text[:max_chars]
    except Exception:
        return ""


def fetch_url_text_and_images(url: str, timeout: int = 12, max_chars: int = 60_000) -> LinkDoc:
    """
    Fetch page text (best-effort) and a few *content-like* images.

    Text extraction:
      - trafilatura if available
      - fallback BeautifulSoup visible text

    Images:
      - prioritize content images (figures/tables/article body)
      - de-prioritize logos/icons/avatars
      - resolve relative URLs

    NOTE: this returns image URLs (not screenshots). Screenshotting article regions is handled elsewhere.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (coursegen_streamlit) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"
    }

    r = requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()

    # Some sites lie about encoding; requests usually guesses well.
    html = r.text or ""

    soup = BeautifulSoup(html, "html.parser")

    # Title
    title = ""
    try:
        if soup.title and soup.title.text:
            title = _clean(soup.title.text)
    except Exception:
        title = ""

    # -----------------
    # Collect images
    # -----------------
    scored: List[Tuple[float, str]] = []

    # 1) Meta images (often the share card) - keep but low priority unless it looks content-like
    meta_urls: List[str] = []
    for sel in [
        ("meta", {"property": "og:image"}),
        ("meta", {"name": "twitter:image"}),
        ("meta", {"property": "og:image:url"}),
    ]:
        tag = soup.find(sel[0], sel[1])
        if tag and tag.get("content"):
            u = _abs_url(url, tag["content"])
            if u:
                meta_urls.append(u)

    for u in meta_urls:
        # share cards are often logos; keep but score them modestly
        base = 0.4 if _looks_like_content_image(u) else -1.0
        scored.append((base, u))

    # 2) Strong signals: figures/tables
    for container in soup.find_all(["figure", "table"]):
        for img in container.find_all("img"):
            sc, u = _score_img(img, url)
            # strong container boost
            if u:
                scored.append((sc + 1.5, u))

    # 3) Article/main content images
    main_like = soup.find("article") or soup.find("main")
    if main_like:
        for img in main_like.find_all("img"):
            sc, u = _score_img(img, url)
            if u:
                scored.append((sc + 0.8, u))

    # 4) Fallback: all images, but with context scoring
    for img in soup.find_all("img"):
        sc, u = _score_img(img, url)
        if u:
            scored.append((sc, u))

    # Dedupe by URL; keep best score per URL
    best_by_url: Dict[str, float] = {}
    for sc, u in scored:
        if not u:
            continue
        prev = best_by_url.get(u)
        if prev is None or sc > prev:
            best_by_url[u] = sc

    # Sort by score desc, then keep top few
    ranked_urls = [u for u, _ in sorted(best_by_url.items(), key=lambda kv: kv[1], reverse=True)]

    # Filter out very low scores unless we have nothing
    filtered = [u for u in ranked_urls if best_by_url.get(u, -999.0) >= -0.5]
    images = (filtered or ranked_urls)[:8]

    # -----------------
    # Extract text
    # -----------------
    text = ""

    if trafilatura is not None:
        try:
            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                text = trafilatura.extract(downloaded) or ""
        except Exception:
            text = ""

    if not text:
        # bs4 fallback: visible text
        try:
            for s in soup(["script", "style", "noscript"]):
                s.extract()
            text = soup.get_text(" ")
        except Exception:
            text = ""

    text = _clean(text)[:max_chars]

    return LinkDoc(url=url, title=title or url, text=text, images=images)


def parse_links_multiline(s: str) -> List[str]:
    urls: List[str] = []
    for line in (s or "").splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("- "):
            line = line[2:].strip()
        if line.startswith("http://") or line.startswith("https://"):
            urls.append(line)
    # de-dupe, keep order
    out = []
    seen = set()
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out
