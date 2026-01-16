
from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple

from coursegen.gemini_client import GeminiClient


def _judge_schema() -> Dict[str, Any]:
    # Keep schema simple; we still parse defensively.
    return {
        "type": "object",
        "properties": {
            "ranked": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "video_id": {"type": "string"},
                        "score": {"type": "number"},
                        "why": {"type": "string"},
                    },
                    "required": ["video_id", "score", "why"],
                },
            }
        },
        "required": ["ranked"],
    }


def _build_prompt(*, lesson_text: str, candidates: List[Dict[str, Any]], top_k: int) -> str:
    """Builds a listwise rerank prompt for Gemini.

    We include only the most useful fields and keep each candidate short to
    minimize token usage.
    """
    top_k = max(1, int(top_k))

    lines: List[str] = []
    lines.append("You are an expert course designer and YouTube video curator.")
    lines.append("Task: rank the candidate YouTube videos for the lesson below.")
    lines.append("")
    lines.append("LESSON:")
    lines.append(lesson_text.strip())
    lines.append("")
    lines.append("CANDIDATES:")

    for i, c in enumerate(candidates, start=1):
        vid = str(c.get("video_id", "")).strip()
        title = str(c.get("title", "")).strip()
        channel = str(c.get("channel_title", c.get("channel", ""))).strip()
        desc = str(c.get("description", c.get("description_excerpt", ""))).replace("\n", " ").strip()
        if len(desc) > 260:
            desc = desc[:260] + "..."

        # Optional signals (if stage-1 scoring already ran)
        sig = {
            "semantic": c.get("semantic"),
            "coverage": c.get("coverage"),
            "quality": c.get("quality"),
            "match_percent": c.get("match_percent"),
        }

        lines.append(f"{i}. id={vid}")
        if title:
            lines.append(f"   title={title}")
        if channel:
            lines.append(f"   channel={channel}")
        dur = c.get("duration_sec")
        if dur is not None:
            lines.append(f"   duration_sec={dur}")
        views = c.get("view_count", c.get("views"))
        if views is not None:
            lines.append(f"   views={views}")
        like_ratio = c.get("like_ratio")
        if like_ratio is not None:
            lines.append(f"   like_ratio={like_ratio}")
        if desc:
            lines.append(f"   desc={desc}")
        # Include signals but do NOT blindly trust them.
        lines.append("   signals=" + json.dumps(sig, ensure_ascii=False))
        lines.append("")

    lines.append("RANKING RULES (very important):")
    lines.append("1) Prefer videos that directly teach the lesson objectives clearly and accurately.")
    lines.append("2) Avoid clickbait, vague commentary, low educational density, or off-topic content.")
    lines.append("3) Prefer structured tutorials/explanations; match depth to the lesson.")
    lines.append("4) If two are similar, prefer clearer structure and better coverage of the lesson.")
    lines.append("")

    lines.append("OUTPUT:")
    lines.append(f"Return JSON only. Rank ALL candidates, but the top {top_k} are most important.")
    lines.append("Use this schema:")
    lines.append(
        json.dumps(
            {"ranked": [{"video_id": "string", "score": 0, "why": "string"}]},
            ensure_ascii=False,
        )
    )
    lines.append("")
    lines.append("Scoring guidance: score is 0..100 (100 = perfect fit for the lesson).")

    return "\n".join(lines)


def judge_rerank(
    gemini: GeminiClient,
    *,
    lesson_text: str,
    candidates: List[Dict[str, Any]],
    top_k: int,
) -> List[Tuple[str, float, str]]:
    """Returns list of (video_id, judge_score_0_100, why) in ranked order."""

    if not candidates:
        return []

    prompt = _build_prompt(lesson_text=lesson_text, candidates=candidates, top_k=top_k)

    payload = gemini.generate_json(
        prompt,
        json_schema=_judge_schema(),
        temperature=0.2,
    )

    # Defensive parsing
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    ranked = payload.get("ranked") if isinstance(payload, dict) else None
    if not isinstance(ranked, list):
        ranked = []

    results: List[Tuple[str, float, str]] = []
    seen = set()

    for r in ranked:
        if not isinstance(r, dict):
            continue
        vid = str(r.get("video_id", "")).strip()
        if not vid or vid in seen:
            continue

        sc = r.get("score", 0)
        try:
            sc = float(sc)
        except Exception:
            sc = 0.0
        sc = max(0.0, min(100.0, sc))

        why = str(r.get("why", r.get("rationale", ""))).strip()
        results.append((vid, sc, why))
        seen.add(vid)

    # If model omitted some IDs, append missing at the end with score 0.
    for c in candidates:
        vid = str(c.get("video_id", "")).strip()
        if vid and vid not in seen:
            results.append((vid, 0.0, ""))
            seen.add(vid)

    return results
