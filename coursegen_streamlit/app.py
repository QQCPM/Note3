
import hashlib
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import streamlit as st

from coursegen.config import SETTINGS
from coursegen.gemini_client import GeminiClient
from coursegen.ingest import extract_text_from_pdf_bytes, fetch_url_text_and_images, parse_links_multiline
from coursegen.keymoments import pick_key_moments, youtube_thumbnail_url
from coursegen.planner import generate_course_plan
from coursegen.retrieval import match_videos_for_lesson
from coursegen.youtube_client import YouTubeClient


# -------------------
# Page setup
# -------------------
st.set_page_config(page_title="Course Generator", layout="wide")

st.markdown(
    """
<style>
.block-container { padding-top: 1.0rem; }

/* Coursera/Udemy-ish layout */
.cg-hero h1 { margin: 0.1rem 0 0.25rem 0; }
.cg-sub { opacity: 0.85; margin: 0 0 0.75rem 0; }
.cg-pill { display:inline-block; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); font-size: 0.85rem; opacity: 0.9; margin-right: 6px; }
.cg-card { border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; padding: 14px 14px 10px 14px; background: rgba(255,255,255,0.02); }
.cg-muted { opacity: 0.85; }
.cg-small { font-size: 0.92rem; opacity: 0.90; }
.cg-outline { border-right: 1px solid rgba(255,255,255,0.08); padding-right: 10px; }
.cg-lesson-title { font-size: 1.35rem; font-weight: 700; margin: 0.25rem 0 0.25rem 0; }
.cg-section-title { font-size: 1.05rem; font-weight: 700; margin-top: 0.75rem; }

/* Make buttons look more like nav items */
div.stButton > button {
  width: 100%;
  border-radius: 10px;
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
}

/* Reduce expander padding */
details summary { font-size: 0.95rem; }
</style>
""",
    unsafe_allow_html=True,
)



def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:16]


# --- Streamlit key helper ---
def _st_key(*parts: Any) -> str:
    """Generate a stable, collision-resistant Streamlit widget key.

    Streamlit widget keys must be globally unique per rerun.
    We hash a tuple of semantic parts so repeated labels don't collide.
    """
    try:
        blob = "||".join([str(p) for p in parts])
    except Exception:
        blob = repr(parts)
    return "k_" + _sha1(blob)


def _is_youtube_quota_error(e: Exception) -> bool:
    msg = str(e)
    return "YouTube API error 403" in msg and "exceeded your" in msg and "quota" in msg


def _normalize_image_src(src: str, base_url: Optional[str] = None) -> Optional[str]:
    """Return a Streamlit-safe image reference: URL or existing local path.

    - Accepts absolute URLs
    - Accepts protocol-relative URLs
    - Resolves root-relative paths against base_url
    - Accepts local paths only if they exist
    - Rejects unknown relative paths (Streamlit treats them as local files)
    """
    if not src:
        return None

    s = str(src).strip()

    if s.startswith("http://") or s.startswith("https://"):
        return s
    if s.startswith("//"):
        return "https:" + s

    if base_url and s.startswith("/"):
        try:
            return urljoin(base_url, s)
        except Exception:
            return None

    p = Path(s)
    if p.exists():
        return str(p)

    return None


_LOGO_HINTS = [
    "logo",
    "icon",
    "favicon",
    "sprite",
    "avatar",
    "profile",
    "badge",
    "sign",
    "masthead",
    "wordmark",
    "brand",
    "og-image",
    "twitter-image",
]


def _looks_like_logo(url: str) -> bool:
    u = (url or "").lower()
    if any(h in u for h in _LOGO_HINTS):
        return True
    # common tiny assets
    if re.search(r"/(?:favicons?|icons?)/", u):
        return True
    if re.search(r"\b(16|24|32|48|64)x(16|24|32|48|64)\b", u):
        return True
    if u.endswith(".svg") and any(x in u for x in ["logo", "icon", "mark"]):
        return True
    return False


def _content_image_score(url: str, base: str) -> float:
    """Heuristic score to prefer content-like images (figures/tables/diagrams)."""
    u = (url or "").lower()
    score = 0.0

    # Boosts
    if any(k in u for k in ["figure", "fig", "diagram", "chart", "plot", "table", "heatmap", "confusion", "roc", "architecture"]):
        score += 2.0
    if any(k in u for k in ["/wp-content/", "/images/", "/img/", "/static/", "/media/"]):
        score += 0.6
    if any(k in (base or "").lower() for k in ["arxiv", "papers", "docs", "documentation"]):
        score += 0.2

    # Penalties
    if _looks_like_logo(u):
        score -= 3.0
    if any(k in u for k in ["header", "nav", "footer", "banner", "ads", "doubleclick", "pixel", "tracking"]):
        score -= 1.0

    # Filetype
    if u.endswith(".png"):
        score += 0.3
    if u.endswith(".jpg") or u.endswith(".jpeg"):
        score += 0.2
    if u.endswith(".gif"):
        score -= 0.5

    return score


def safe_st_image(images: List[Dict[str, str]] | List[str], *, max_n: int = 6) -> None:
    """Safely display a list of images.

    Accepts either:
      - list[str] (URLs or local paths)
      - list[dict] items like {"src":..., "base":...}
    """
    cleaned: List[str] = []

    if not images:
        return

    for it in images:
        if isinstance(it, dict):
            src = it.get("src", "")
            base = it.get("base")
            v = _normalize_image_src(src, base_url=base)
        else:
            v = _normalize_image_src(str(it), base_url=None)

        if v:
            cleaned.append(v)
        if len(cleaned) >= max_n:
            break

    if cleaned:
        # Streamlit >= 1.40 wants width='stretch' instead of use_container_width
        st.image(cleaned, width="stretch")


def lesson_to_text(lesson: Any) -> str:
    title = getattr(lesson, "lesson_title", None) or getattr(lesson, "title", None) or ""
    objectives = getattr(lesson, "objectives", None) or []
    queries = getattr(lesson, "youtube_queries", None) or []
    parts = [f"Lesson: {title}"]
    if objectives:
        parts.append("Objectives: " + "; ".join([str(x) for x in objectives]))
    if queries:
        parts.append("YouTube queries: " + ", ".join([str(x) for x in queries]))
    return "\n".join(parts).strip()


def _extract_relevant_snippets(context_text: str, lesson_title: str, objectives: List[str], max_chars: int = 2200) -> str:
    """Cheap relevance: keyword overlap over paragraphs."""
    if not context_text:
        return ""

    q = (lesson_title + " " + " ".join(objectives or [])).lower()
    q_terms = [t for t in q.replace("/", " ").replace("-", " ").split() if len(t) >= 5]
    if not q_terms:
        return context_text[:max_chars]

    paras = [p.strip() for p in context_text.split("\n\n") if p.strip()]
    scored: List[Tuple[int, str]] = []
    for p in paras:
        pl = p.lower()
        hits = sum(1 for t in q_terms if t in pl)
        if hits > 0:
            scored.append((hits, p))

    scored.sort(key=lambda x: x[0], reverse=True)
    out: List[str] = []
    total = 0
    for hits, p in scored[:10]:
        chunk = p
        if len(chunk) > 700:
            chunk = chunk[:700] + "…"
        out.append(chunk)
        total += len(chunk) + 2
        if total >= max_chars:
            break

    if not out:
        return context_text[:max_chars]
    return "\n\n".join(out)[:max_chars]


def _gen_lesson_notes_markdown(
    gemini: GeminiClient,
    *,
    cache: Dict[str, Any],
    lesson_title: str,
    objectives: List[str],
    context_excerpt: str,
    difficulty: str,
) -> str:
    """LLM-generated lesson notes. Cached in session_state to avoid reruns."""
    key_obj = {
        "lesson_title": lesson_title,
        "objectives": objectives,
        "difficulty": difficulty,
        "context": context_excerpt[:3000],
    }
    k = "lesson_notes::" + _sha1(json.dumps(key_obj, sort_keys=True, ensure_ascii=False))
    if k in cache:
        return str(cache[k])

    prompt = "\n".join(
        [
            "You are writing course lesson notes in the style of Coursera/Udemy.",
            "Return concise, well-structured Markdown.",
            "Include: a short explanation, key concepts, a tiny example (if applicable), and a quick self-check quiz (3 questions).",
            "Avoid fluff. Be accurate.",
            "",
            f"LESSON TITLE: {lesson_title}",
            f"DIFFICULTY: {difficulty}",
            "OBJECTIVES:",
            ("- " + "\n- ".join([str(x) for x in (objectives or [])])) if objectives else "(none)",
            "",
            "LEARNER MATERIAL EXCERPT (may be partial):",
            context_excerpt[:8000],
        ]
    )

    schema = {
        "type": "object",
        "properties": {"notes_markdown": {"type": "string"}},
        "required": ["notes_markdown"],
    }

    try:
        payload = gemini.generate_json(prompt, json_schema=schema, temperature=0.35)
        md = ""
        if isinstance(payload, dict):
            md = str(payload.get("notes_markdown", "")).strip()
        if not md:
            md = "(No notes generated.)"
    except Exception as e:
        md = f"(Notes generation failed: {e})"

    cache[k] = md
    return md


def build_context_text(pdf_files_local, links_text_local: str) -> Dict[str, Any]:
    """Collect PDF text + link docs for planner and per-lesson notes."""
    ctx_parts: List[str] = []
    link_docs: List[Dict[str, Any]] = []
    link_images: List[Dict[str, str]] = []  # {"src":..., "base":...}

    # PDFs
    if pdf_files_local:
        for pf in pdf_files_local[:6]:
            try:
                pdf_bytes = pf.read()
                pdf_text = extract_text_from_pdf_bytes(pdf_bytes)
                if pdf_text:
                    ctx_parts.append(f"PDF: {pf.name}\n" + pdf_text[:80_000])
            except Exception:
                continue

    # Links
    urls = parse_links_multiline(links_text_local)
    for u in urls[:10]:
        try:
            doc = fetch_url_text_and_images(u)
            link_docs.append({"url": doc.url, "title": doc.title, "text": doc.text})
            ctx_parts.append(f"LINK: {doc.title}\nURL: {doc.url}\nCONTENT:\n{doc.text[:30_000]}")
            for im in (doc.images or [])[:30]:
                link_images.append({"src": str(im), "base": doc.url})
        except Exception:
            continue

    context_text = "\n\n---\n\n".join([x for x in ctx_parts if x.strip()]).strip()

    # de-dupe + filter junk images (logos) + rank for content-like
    seen = set()
    imgs: List[Dict[str, str]] = []
    for it in link_images:
        s = it.get("src", "")
        b = it.get("base", "")
        if not s:
            continue
        k = f"{b}::{s}"
        if k in seen:
            continue
        seen.add(k)
        if _looks_like_logo(s):
            continue
        imgs.append(it)

    imgs.sort(key=lambda it: _content_image_score(it.get("src", ""), it.get("base", "")), reverse=True)

    return {"context_text": context_text, "link_docs": link_docs, "link_images": imgs}


def _ctx_cache_key(pdf_files_local, links_text_local: str) -> str:
    names = [getattr(p, "name", "") for p in (pdf_files_local or [])]
    blob = json.dumps({"names": names, "links": links_text_local.strip()[:5000]}, ensure_ascii=False)
    return "ctx::" + _sha1(blob)


def _flatten_outline(plan: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for mi, m in enumerate(getattr(plan, "modules", []) or [], start=1):
        mod_title = getattr(m, "module_title", None) or getattr(m, "title", None) or f"Module {mi}"
        lessons = getattr(m, "lessons", None) or []
        for li, lesson in enumerate(lessons, start=1):
            lesson_title = getattr(lesson, "lesson_title", None) or getattr(lesson, "title", None) or f"Lesson {mi}.{li}"
            out.append(
                {
                    "mi": mi,
                    "li": li,
                    "key": f"{mi}.{li}",
                    "module_title": mod_title,
                    "lesson_title": lesson_title,
                    "lesson": lesson,
                }
            )
    return out


# -------------------
# Sidebar inputs
# -------------------
with st.sidebar:
    st.header("Inputs")

    topic = st.text_input("Topic", value="Model Context Protocol (MCP) for tool-using agents")
    difficulty = st.selectbox("Difficulty", ["Beginner", "Intermediate", "Advanced"], index=1)
    duration_weeks = st.slider("Duration (weeks)", 1, 8, 2)

    st.divider()
    st.subheader("Personalization")

    pdf_files = st.file_uploader("Upload PDF(s)", type=["pdf"], accept_multiple_files=True)
    links_text = st.text_area("Paste links (one per line)", height=120, placeholder="https://...\nhttps://...")

    st.divider()
    st.subheader("Course UI")
    view_mode = st.selectbox(
        "View mode",
        ["Lesson view (Udemy-like)", "Full scroll (lightweight)"],
        index=0,
    )
    auto_fetch_first = st.checkbox("Auto-fetch videos for first lesson", value=True)
    auto_fetch_all = st.checkbox("Auto-fetch videos for ALL lessons (uses quota)", value=False)
    use_cached_only = st.checkbox("Use cached matches only (no new YouTube calls)", value=False)

    st.divider()
    st.subheader("YouTube retrieval")
    max_per_query = st.slider("Candidates per query", 3, 15, 8)
    topk_rerank = st.slider("TopK rerank (judge)", 3, 15, SETTINGS.TOPK_RERANK)

    st.divider()
    st.subheader("Course content")
    gen_lesson_notes = st.checkbox("Generate lesson notes with Gemini", value=True)
    show_more_matches = st.checkbox("Show more matches", value=True)
    show_scoring = st.checkbox("Show scoring components", value=True)

    st.divider()
    st.subheader("Video screenshots")
    enable_frame_capture = st.checkbox("Enable storyboard screenshots (no downloads)", value=True)
    moments_per_lesson = st.slider("Key moments per lesson", 1, 6, 3)

    st.divider()
    generate = st.button("Generate course", type="primary")


# -------------------
# Session state
# -------------------
if "plan" not in st.session_state:
    st.session_state["plan"] = None
if "ctx" not in st.session_state:
    st.session_state["ctx"] = None
if "ctx_key" not in st.session_state:
    st.session_state["ctx_key"] = ""
if "selected_lesson_key" not in st.session_state:
    st.session_state["selected_lesson_key"] = None

# caches
if "matches_cache" not in st.session_state:
    st.session_state["matches_cache"] = {}
if "notes_cache" not in st.session_state:
    st.session_state["notes_cache"] = {}
if "moments_cache" not in st.session_state:
    st.session_state["moments_cache"] = {}


# -------------------
# Generate
# -------------------
if generate:
    if not SETTINGS.GEMINI_API_KEY:
        st.error("Missing GEMINI_API_KEY in environment/.env")
        st.stop()

    # YouTube is optional now (so the course UI still works when quota is exceeded)
    if not SETTINGS.YOUTUBE_API_KEY:
        st.warning("Missing YOUTUBE_API_KEY. You can still generate the course and notes, but video matching is disabled.")

    ck = _ctx_cache_key(pdf_files, links_text)
    if st.session_state.get("ctx") is None or st.session_state.get("ctx_key") != ck:
        with st.spinner("Reading PDFs / links…"):
            ctx = build_context_text(pdf_files, links_text)
        st.session_state["ctx"] = ctx
        st.session_state["ctx_key"] = ck
    else:
        ctx = st.session_state["ctx"]

    context_text = (ctx or {}).get("context_text", "")

    gemini = GeminiClient(api_key=SETTINGS.GEMINI_API_KEY, model=SETTINGS.GEMINI_MODEL, embedding_model=SETTINGS.EMBEDDING_MODEL)

    # Inject personalization into planner prompt (minimal, works today)
    topic_aug = topic
    if context_text:
        topic_aug = topic + "\n\nUse these learner materials as context (may be partial):\n" + context_text[:25_000]

    with st.spinner("Planning course…"):
        plan = generate_course_plan(
            gemini=gemini,
            topic=topic_aug,
            difficulty=difficulty,
            duration_weeks=int(duration_weeks),
        )

    st.session_state["plan"] = plan

    # select first lesson by default
    outline = _flatten_outline(plan)
    if outline:
        st.session_state["selected_lesson_key"] = outline[0]["key"]

    # Optional prefetch (careful with quota)
    if SETTINGS.YOUTUBE_API_KEY and outline and (auto_fetch_first or auto_fetch_all):
        yt = YouTubeClient(api_key=SETTINGS.YOUTUBE_API_KEY, cache_dir=SETTINGS.CACHE_DIR)
        targets = outline if auto_fetch_all else [outline[0]]
        with st.spinner("Prefetching video matches…"):
            for it in targets:
                lesson = it["lesson"]
                youtube_queries = getattr(lesson, "youtube_queries", None) or []
                if not youtube_queries:
                    continue
                cache_key_obj = {
                    "mi": it["mi"],
                    "li": it["li"],
                    "lesson_title": it["lesson_title"],
                    "queries": list(youtube_queries),
                    "max_per_query": int(max_per_query),
                    "topk_rerank": int(topk_rerank),
                    "embed_model": SETTINGS.EMBEDDING_MODEL,
                }
                mkey = "match::" + _sha1(json.dumps(cache_key_obj, sort_keys=True, ensure_ascii=False))
                if mkey in st.session_state["matches_cache"]:
                    continue
                try:
                    results = match_videos_for_lesson(
                        gemini=gemini,
                        yt=yt,
                        lesson_text=lesson_to_text(lesson),
                        youtube_queries=list(youtube_queries),
                        max_per_query=max_per_query,
                        cache_dir=SETTINGS.CACHE_DIR,
                        embed_model=SETTINGS.EMBEDDING_MODEL,
                        topk_rerank=topk_rerank,
                    )
                    st.session_state["matches_cache"][mkey] = results
                except Exception as e:
                    if _is_youtube_quota_error(e):
                        st.warning("YouTube quota exceeded while prefetching. Continuing without more video matches.")
                        break


# -------------------
# Render
# -------------------
plan = st.session_state.get("plan")
ctx = st.session_state.get("ctx") or {"context_text": "", "link_docs": [], "link_images": []}


def _render_sources_panel(pdf_files_local, links_text_local: str, ctx_local: Dict[str, Any]) -> None:
    with st.expander("Your sources (PDFs + links)", expanded=True):
        c1, c2 = st.columns([1.15, 0.85], gap="large")
        with c1:
            if pdf_files_local:
                st.markdown("**PDFs**")
                for pf in pdf_files_local[:12]:
                    st.markdown(f"- 📄 `{pf.name}`")
            urls = parse_links_multiline(links_text_local)
            if urls:
                st.markdown("**Links**")
                for u in urls[:12]:
                    st.markdown(f"- 🔗 {u}")

        with c2:
            imgs = ctx_local.get("link_images") or []
            if imgs:
                st.markdown("**Content-like images found on links (best effort)**")
                safe_st_image(imgs, max_n=6)
                st.caption("If you still see logos: your article sources may not expose figure images directly. The next step is true webpage screenshot-cropping.")
            else:
                st.caption("No images collected from links yet.")


def _render_outline(plan_local: Any) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    outline = _flatten_outline(plan_local)
    selected_key = st.session_state.get("selected_lesson_key")

    selected = None
    if selected_key:
        for it in outline:
            if it["key"] == selected_key:
                selected = it
                break

    st.markdown("<div class='cg-outline'>", unsafe_allow_html=True)
    st.markdown("### Curriculum")

    by_mod: Dict[str, List[Dict[str, Any]]] = {}
    for it in outline:
        by_mod.setdefault(it["module_title"], []).append(it)

    for mod_title, lessons in by_mod.items():
        with st.expander(mod_title, expanded=(selected and selected.get("module_title") == mod_title)):
            for it in lessons:
                label = f"{it['key']} {it['lesson_title']}"
                btn_key = _st_key(
                    "nav",
                    it.get("key"),
                    it.get("mi"),
                    it.get("li"),
                    it.get("module_title"),
                    it.get("lesson_title"),
                )
                if st.button(label, key=btn_key):
                    st.session_state["selected_lesson_key"] = it["key"]
                    selected = it

    st.markdown("</div>", unsafe_allow_html=True)

    return outline, selected


def _get_or_match_videos(
    *,
    gemini: GeminiClient,
    yt: Optional[YouTubeClient],
    lesson_item: Dict[str, Any],
) -> List[Any]:
    """Centralized matching with caching + quota-safe behavior."""
    mi = lesson_item["mi"]
    li = lesson_item["li"]
    lesson = lesson_item["lesson"]

    lesson_title = lesson_item["lesson_title"]
    youtube_queries = getattr(lesson, "youtube_queries", None) or []
    if not youtube_queries:
        return []

    cache_key_obj = {
        "mi": mi,
        "li": li,
        "lesson_title": lesson_title,
        "queries": list(youtube_queries),
        "max_per_query": int(max_per_query),
        "topk_rerank": int(topk_rerank),
        "embed_model": SETTINGS.EMBEDDING_MODEL,
    }
    mkey = "match::" + _sha1(json.dumps(cache_key_obj, sort_keys=True, ensure_ascii=False))

    matches_cache: Dict[str, Any] = st.session_state["matches_cache"]
    if mkey in matches_cache:
        return matches_cache[mkey]

    if use_cached_only:
        return []

    if yt is None:
        return []

    # Do the call
    try:
        results = match_videos_for_lesson(
            gemini=gemini,
            yt=yt,
            lesson_text=lesson_to_text(lesson),
            youtube_queries=list(youtube_queries),
            max_per_query=max_per_query,
            cache_dir=SETTINGS.CACHE_DIR,
            embed_model=SETTINGS.EMBEDDING_MODEL,
            topk_rerank=topk_rerank,
        )
        matches_cache[mkey] = results
        return results
    except Exception as e:
        if _is_youtube_quota_error(e):
            matches_cache[mkey] = []
            return []
        raise


def _render_video_card(
    *,
    gemini: GeminiClient,
    yt: Optional[YouTubeClient],
    plan_local: Any,
    lesson_item: Dict[str, Any],
    ctx_local: Dict[str, Any],
) -> None:
    mi = lesson_item["mi"]
    li = lesson_item["li"]
    lesson = lesson_item["lesson"]

    lesson_title = lesson_item["lesson_title"]
    objectives = getattr(lesson, "objectives", None) or []
    youtube_queries = getattr(lesson, "youtube_queries", None) or []

    if not youtube_queries:
        st.info("No youtube_queries for this lesson.")
        return

    if yt is None:
        st.warning("YouTube is not configured (missing API key).")
        return

    # get matches
    try:
        if f"loading_{mi}_{li}" not in st.session_state:
            st.session_state[f"loading_{mi}_{li}"] = False

        with st.spinner("Matching videos…") if (not use_cached_only) else st.empty():
            results = _get_or_match_videos(gemini=gemini, yt=yt, lesson_item=lesson_item)
    except Exception as e:
        if _is_youtube_quota_error(e):
            st.error("YouTube quota exceeded (403).\n\nFix: reduce candidates per query, disable auto-fetch, or wait for quota reset. The rest of the course UI still works.")
            st.info("Tip: turn on 'Use cached matches only' after you successfully fetch once, to avoid reruns spending quota.")
            return
        st.error(f"Video matching failed: {e}")
        return

    if not results:
        if use_cached_only:
            st.info("No cached matches for this lesson yet. Turn off 'Use cached matches only' to fetch.")
        else:
            st.warning("No candidates found.")
        return

    st.markdown("<div class='cg-section-title'>Recommended videos</div>")
    st.caption(f"Found {len(results)} candidates.")

    show_n = 10 if show_more_matches else 5
    shown = results[:show_n]

    options = []
    label_to_video = {}
    for r in shown:
        meta = r.meta or {}
        title = meta.get("title", "")
        vid = r.video_id
        label = f"{r.percent}% • {title[:70]}" if title else f"{r.percent}% • {vid}"
        options.append(label)
        label_to_video[label] = r

    pick = st.selectbox(
        "Pick a video for this lesson",
        options,
        index=0,
        key=_st_key("pick_video", mi, li, lesson_title),
    )

    if show_more_matches and len(results) > show_n:
        with st.expander("See more ranked matches", expanded=False):
            for rr in results[show_n : min(len(results), show_n + 12)]:
                mm = rr.meta or {}
                tt = (mm.get("title") or "").strip()
                st.markdown(f"- **{rr.percent}%** — {tt[:110] if tt else rr.video_id}")

    r = label_to_video[pick]
    meta = r.meta or {}
    vid = r.video_id
    title = meta.get("title", "")
    channel = meta.get("channel_title", "")
    why = r.why or meta.get("judge_rationale", "") or ""

    st.markdown("---")
    st.markdown(f"<div class='cg-card'>", unsafe_allow_html=True)

    left, right = st.columns([1.2, 0.8], gap="large")
    with left:
        st.markdown(f"**{title}**" if title else f"**{vid}**")
        if channel:
            st.caption(channel)
        st.video(f"https://www.youtube.com/watch?v={vid}")

    with right:
        if show_scoring:
            st.markdown("**Signals**")
            s = r.components or {}
            cols = st.columns(4)
            cols[0].metric("Semantic", f"{s.get('semantic', 0):.3f}")
            cols[1].metric("Coverage", f"{s.get('coverage', 0):.3f}")
            cols[2].metric("Quality", f"{s.get('quality', 0):.3f}")
            cols[3].metric("Judge", f"{s.get('judge', 0):.3f}")

        st.markdown("**Why this matches**")
        st.write(why if why else "—")

        st.markdown("**Key moments (with screenshots)**")
        query_override = st.text_input(
            "Find a moment about… (optional)",
            value="",
            key=_st_key("km_query", mi, li, vid),
            placeholder="e.g., 'recommendation algorithm', 'client/server', 'tool calling'",
        )
        km_query = (query_override.strip() or (lesson_title + " " + " ".join(list(objectives)[:4]))).strip()

        km_key_obj = {
            "video_id": vid,
            "q": km_query,
            "n": int(moments_per_lesson),
            "embed_model": SETTINGS.EMBEDDING_MODEL,
        }
        km_key = "moments::" + _sha1(json.dumps(km_key_obj, sort_keys=True, ensure_ascii=False))

        moments_cache: Dict[str, Any] = st.session_state["moments_cache"]

        if km_key not in moments_cache:
            with st.spinner("Finding key moments…"):
                moments = pick_key_moments(
                    gemini=gemini,
                    cache_dir=SETTINGS.CACHE_DIR,
                    embed_model=SETTINGS.EMBEDDING_MODEL,
                    video_id=vid,
                    lesson_query=km_query,
                    top_n=moments_per_lesson,
                )
            moments_cache[km_key] = moments
        else:
            moments = moments_cache[km_key]

        # Determine duration for manual slider
        dur_sec = float(meta.get("duration_sec") or 0.0)
        if dur_sec <= 0:
            dur_sec = 900.0

        def render_screenshot(at_sec: float) -> None:
            # Prefer storyboard frame (no download/quota). If missing, fall back to thumbnail.
            frame = youtube_thumbnail_url(vid)
            if enable_frame_capture:
                try:
                    from coursegen.video_frames import get_frame

                    fr = get_frame(video_id=vid, time_s=float(at_sec), cache_dir=SETTINGS.CACHE_DIR)
                    if fr and getattr(fr, "path", None):
                        frame = fr.path
                    elif fr and getattr(fr, "url", None):
                        frame = fr.url
                except Exception:
                    pass

            st.image(frame, width="stretch")

        if not moments:
            st.caption("No transcript moments available for this video (transcripts disabled or missing).")
            st.markdown("**Manual screenshot**")
            at = st.slider(
                "Pick a time (seconds)",
                min_value=0,
                max_value=int(dur_sec),
                value=min(60, int(dur_sec)),
                key=_st_key("manual_shot", mi, li, vid),
            )
            render_screenshot(float(at))
            st.markdown(f"[Open at {int(at)}s](https://www.youtube.com/watch?v={vid}&t={int(at)}s)")
        else:
            # Choose a moment and allow changing screenshot time around it
            labels = []
            for idx, km in enumerate(moments, start=1):
                t0 = int(float(km.start_sec))
                t1 = int(float(km.end_sec))
                labels.append(f"Moment {idx}: {t0}s–{t1}s (score={km.score:.2f})")

            pick_idx = st.selectbox(
                "Select a moment",
                list(range(len(labels))),
                format_func=lambda i: labels[i],
                key=_st_key("km_pick", mi, li, vid, km_query),
            )
            km = moments[int(pick_idx)]
            t0 = float(km.start_sec)
            t1 = float(km.end_sec)
            mid = max(0.0, min(dur_sec, (t0 + t1) / 2.0))

            # If keymoments already attached a frame for this moment, show it first.
            if getattr(km, "frame_path", None) or getattr(km, "frame_url", None):
                frame_ref = getattr(km, "frame_path", None) or getattr(km, "frame_url", None)
                st.image(frame_ref, width="stretch", caption=f"~{int(mid)//60:02d}:{int(mid)%60:02d}")
            else:
                # otherwise fetch storyboard frame at the chosen time
                pass

            # Screenshot time control
            at = st.slider(
                "Screenshot time (seconds)",
                min_value=0,
                max_value=int(dur_sec),
                value=int(mid),
                key=_st_key("km_shot", mi, li, vid, pick_idx, km_query),
            )
            render_screenshot(float(at))

            def _mmss(x: float) -> str:
                x = int(max(0, x))
                return f"{x//60:02d}:{x%60:02d}"

            st.caption(f"Time range: {_mmss(t0)}–{_mmss(t1)} • screenshot={_mmss(float(at))}")
            st.write(km.text[:260] + ("…" if len(km.text) > 260 else ""))
            st.markdown(f"[Open at {_mmss(t0)}](https://www.youtube.com/watch?v={vid}&t={int(t0)}s)")

    st.markdown("</div>", unsafe_allow_html=True)


def _render_lesson_page(
    *,
    gemini: GeminiClient,
    yt: Optional[YouTubeClient],
    plan_local: Any,
    lesson_item: Dict[str, Any],
    ctx_local: Dict[str, Any],
) -> None:
    lesson = lesson_item["lesson"]
    lesson_title = lesson_item["lesson_title"]
    objectives = getattr(lesson, "objectives", None) or []
    youtube_queries = getattr(lesson, "youtube_queries", None) or []

    # --- lesson navigation (Udemy/Coursera-ish) ---
    outline_all = _flatten_outline(plan_local)
    cur_idx = 0
    for i, it in enumerate(outline_all):
        if it.get("key") == lesson_item.get("key"):
            cur_idx = i
            break

    nav_c1, nav_c2, nav_c3 = st.columns([0.33, 0.34, 0.33], gap="small")
    with nav_c1:
        prev_disabled = cur_idx <= 0
        if st.button(
            "← Previous",
            disabled=prev_disabled,
            key=_st_key("prev", lesson_item.get("key"), cur_idx),
        ):
            st.session_state["selected_lesson_key"] = outline_all[max(0, cur_idx - 1)]["key"]
            st.rerun()

    with nav_c2:
        st.markdown(
            f"<div class='cg-muted cg-small' style='text-align:center;'>Lesson {cur_idx + 1} of {max(1, len(outline_all))}</div>",
            unsafe_allow_html=True,
        )

    with nav_c3:
        next_disabled = cur_idx >= (len(outline_all) - 1)
        if st.button(
            "Next →",
            disabled=next_disabled,
            key=_st_key("next", lesson_item.get("key"), cur_idx),
        ):
            st.session_state["selected_lesson_key"] = outline_all[min(len(outline_all) - 1, cur_idx + 1)]["key"]
            st.rerun()

    st.markdown(f"<div class='cg-lesson-title'>{lesson_item['key']} — {lesson_title}</div>", unsafe_allow_html=True)

    tabs = st.tabs(["Overview", "Notes", "Videos", "Sources"])

    with tabs[0]:
        st.markdown("<div class='cg-card'>", unsafe_allow_html=True)
        c1, c2 = st.columns([1.1, 0.9], gap="large")
        with c1:
            st.markdown("**Objectives**")
            if objectives:
                for o in objectives:
                    st.markdown(f"- {o}")
            else:
                st.caption("No objectives provided by planner.")

        with c2:
            st.markdown("**YouTube queries**")
            if youtube_queries:
                for q in list(youtube_queries)[:10]:
                    st.markdown(f"- {q}")
            else:
                st.caption("(none)")
        st.markdown("</div>", unsafe_allow_html=True)

    with tabs[1]:
        if not ctx_local.get("context_text"):
            st.info("Upload PDFs and/or paste links to generate personalized notes.")
        else:
            excerpt = _extract_relevant_snippets(ctx_local["context_text"], lesson_title, objectives)
            if gen_lesson_notes:
                notes_cache: Dict[str, Any] = st.session_state["notes_cache"]
                md = _gen_lesson_notes_markdown(
                    gemini,
                    cache=notes_cache,
                    lesson_title=lesson_title,
                    objectives=list(objectives),
                    context_excerpt=excerpt,
                    difficulty=str(getattr(plan_local, "difficulty", "")),
                )
                st.markdown(md)
            else:
                st.markdown("**Relevant excerpts from your sources**")
                st.write(excerpt)

    with tabs[2]:
        _render_video_card(gemini=gemini, yt=yt, plan_local=plan_local, lesson_item=lesson_item, ctx_local=ctx_local)

    with tabs[3]:
        st.markdown("<div class='cg-card'>", unsafe_allow_html=True)
        st.markdown("**Most relevant source snippets (heuristic)**")
        if ctx_local.get("context_text"):
            excerpt = _extract_relevant_snippets(ctx_local["context_text"], lesson_title, objectives)
            st.write(excerpt)
        else:
            st.caption("No sources loaded.")

        st.markdown("\n**Content-like images from links (best effort)**")
        imgs = ctx_local.get("link_images") or []
        if imgs:
            safe_st_image(imgs, max_n=8)
        else:
            st.caption("No images collected.")
        st.markdown("</div>", unsafe_allow_html=True)



# -------------------
# Full scroll rendering (Coursera-like)
# -------------------
def _render_full_scroll(
    *,
    gemini: GeminiClient,
    yt: Optional[YouTubeClient],
    plan_local: Any,
    ctx_local: Dict[str, Any],
) -> None:
    """Coursera-like scrolling page. Quota-safe: videos are fetched only when user clicks."""
    outline = _flatten_outline(plan_local)

    st.markdown("### Course content")

    # Build module groups
    by_mod: Dict[str, List[Dict[str, Any]]] = {}
    for it in outline:
        by_mod.setdefault(it["module_title"], []).append(it)

    for mod_title, lessons in by_mod.items():
        with st.expander(mod_title, expanded=False):
            for it in lessons:
                lesson = it["lesson"]
                lesson_title = it["lesson_title"]
                objectives = getattr(lesson, "objectives", None) or []

                st.markdown(f"<div class='cg-card'>", unsafe_allow_html=True)
                st.markdown(f"<div class='cg-lesson-title'>{it['key']} — {lesson_title}</div>", unsafe_allow_html=True)

                if objectives:
                    st.markdown("**Objectives**")
                    for o in objectives[:6]:
                        st.markdown(f"- {o}")

                # Notes (cached)
                if ctx_local.get("context_text"):
                    excerpt = _extract_relevant_snippets(ctx_local["context_text"], lesson_title, objectives)
                    if gen_lesson_notes:
                        notes_cache: Dict[str, Any] = st.session_state["notes_cache"]
                        md = _gen_lesson_notes_markdown(
                            gemini,
                            cache=notes_cache,
                            lesson_title=lesson_title,
                            objectives=list(objectives),
                            context_excerpt=excerpt,
                            difficulty=str(getattr(plan_local, "difficulty", "")),
                        )
                        st.markdown(md)
                    else:
                        st.write(excerpt)

                # Videos: on-demand button
                btn = st.button(
                    f"Fetch videos for {it['key']}",
                    key=_st_key("fetch", it.get("key"), it.get("module_title"), it.get("lesson_title")),
                )
                if btn:
                    _render_video_card(gemini=gemini, yt=yt, plan_local=plan_local, lesson_item=it, ctx_local=ctx_local)
                else:
                    st.caption("Videos load on demand to avoid YouTube quota exhaustion.")

                st.markdown("</div>", unsafe_allow_html=True)


# -------------------
# Main layout
# -------------------
st.title("🎓 Course Generator")

if plan is None:
    st.info("Set your inputs on the left, then click **Generate course**.")
    st.caption("Tip: Add PDFs or links to personalize lesson notes and improve video matching.")
else:
    # Clients
    gemini = GeminiClient(api_key=SETTINGS.GEMINI_API_KEY, model=SETTINGS.GEMINI_MODEL, embedding_model=SETTINGS.EMBEDDING_MODEL)
    yt = None
    if SETTINGS.YOUTUBE_API_KEY:
        yt = YouTubeClient(api_key=SETTINGS.YOUTUBE_API_KEY, cache_dir=SETTINGS.CACHE_DIR)

    # Hero
    st.markdown("<div class='cg-hero'>", unsafe_allow_html=True)
    st.markdown(f"# {plan.course_title}")
    sub = f"{len(plan.modules)} modules • {plan.difficulty} • {plan.duration_weeks} week(s)"
    st.markdown(f"<p class='cg-sub'>{sub}</p>", unsafe_allow_html=True)
    st.markdown(
        """<span class='cg-pill'>Scroll course</span>
            <span class='cg-pill'>Notes</span>
            <span class='cg-pill'>Videos</span>
            <span class='cg-pill'>Key moments</span>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)

    if getattr(plan, "course_description", None):
        st.write(plan.course_description)

    # What you'll learn
    if getattr(plan, "learning_outcomes", None):
        st.markdown("### What you'll learn")
        cols = st.columns(2)
        for i, o in enumerate(plan.learning_outcomes[:10]):
            cols[i % 2].markdown(f"- {o}")

    st.divider()

    _render_sources_panel(pdf_files, links_text, ctx)

    st.divider()

    if view_mode == "Full scroll (lightweight)":
        _render_full_scroll(gemini=gemini, yt=yt, plan_local=plan, ctx_local=ctx)
    else:
        # Two-column experience: outline left, lesson page right
        left, right = st.columns([0.38, 0.62], gap="large")

        with left:
            outline, selected = _render_outline(plan)

        with right:
            if not selected:
                st.info("Pick a lesson from the left.")
            else:
                _render_lesson_page(gemini=gemini, yt=yt, plan_local=plan, lesson_item=selected, ctx_local=ctx)