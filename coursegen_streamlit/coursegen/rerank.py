from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# -------------------------
# Utilities: cache + hashing
# -------------------------
def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _now() -> float:
    return time.time()


def _is_fresh(path: Path, ttl_days: int) -> bool:
    if not path.exists():
        return False
    age_s = _now() - path.stat().st_mtime
    return age_s <= ttl_days * 86400


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _clamp01(x: float) -> float:
    try:
        x = float(x)
    except Exception:
        x = 0.0
    return max(0.0, min(1.0, x))


# -------------------------
# Data shapes (lightweight)
# -------------------------
@dataclass
class JudgeResult:
    ranked_ids: List[str]
    scores: Dict[str, float]        # 0..1
    rationales: Dict[str, str]


# -------------------------
# Prompting (listwise)
# -------------------------
def _build_listwise_prompt(
    lesson_title: str,
    lesson_objectives: List[str],
    query_hints: List[str],
    items: List[Dict[str, Any]],
) -> str:
    """
    items: list of {video_id,title,channel,duration_sec,views,like_ratio,description_excerpt,semantic,coverage,quality}
    """
    obj = "\n".join([f"- {x}" for x in (lesson_objectives or [])]) or "- (not provided)"
    hints = ", ".join(query_hints or [])

    lines: List[str] = []
    lines.append("You are an expert course designer and video curator.")
    lines.append("Task: rank the candidate YouTube videos for a single lesson.")
    lines.append("")
    lines.append("LESSON TITLE:")
    lines.append(str(lesson_title))
    lines.append("")
    lines.append("LESSON OBJECTIVES:")
    lines.append(obj)
    lines.append("")
    if hints:
        lines.append("SEARCH HINTS / QUERIES:")
        lines.append(hints)
        lines.append("")

    lines.append("CANDIDATES:")
    for i, it in enumerate(items, start=1):
        lines.append(f"{i}. id={it.get('video_id')}")
        lines.append(f"   title={it.get('title','')}")
        lines.append(f"   channel={it.get('channel','')}")
        lines.append(f"   duration_sec={it.get('duration_sec')}")
        if it.get("views") is not None:
            lines.append(f"   views={it.get('views')}")
        if it.get("like_ratio") is not None:
            lines.append(f"   like_ratio={it.get('like_ratio')}")

        desc = (it.get("description_excerpt") or "").strip().replace("\n", " ")
        if len(desc) > 220:
            desc = desc[:220] + "..."
        if desc:
            lines.append(f"   desc={desc}")

        lines.append(
            "   signals="
            + json.dumps(
                {
                    "semantic": it.get("semantic"),
                    "coverage": it.get("coverage"),
                    "quality": it.get("quality"),
                },
                ensure_ascii=False,
            )
        )
        lines.append("")

    lines.append("RANKING RULES (very important):")
    lines.append("1) Prefer videos that directly teach the lesson objectives clearly and accurately.")
    lines.append("2) Avoid clickbait, vague commentary, low educational density, or off-topic content.")
    lines.append("3) Prefer structured tutorials/explanations; prefer depth appropriate to the lesson.")
    lines.append("4) If two are similar, prefer higher clarity and better coverage of objectives.")
    lines.append("")
    lines.append("OUTPUT FORMAT:")
    lines.append("Return JSON only matching this schema:")
    lines.append(
        json.dumps(
            {
                "ranked": [
                    {"video_id": "string", "score": 0.0, "rationale": "string"}
                ]
            },
            ensure_ascii=False,
        )
    )
    lines.append("")
    lines.append("Scoring guidance: score in [0,1]. A '1.0' means perfect fit for lesson.")
    return "\n".join(lines)


def _judge_schema() -> Dict[str, Any]:
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
                        "rationale": {"type": "string"},
                    },
                    "required": ["video_id", "score", "rationale"],
                },
            }
        },
        "required": ["ranked"],
    }


def _parse_judge_payload(payload: Any) -> JudgeResult:
    """
    Robust parse:
      - canonical: {"ranked":[{"video_id":"..","score":0..1,"rationale":".."},...]}
      - ranked string list + maps: {"ranked":["id1","id2"],"scores":{...},"rationales":{...}}
      - object style: payload.ranked_ids / payload.judge_scores / payload.judge_reasons
      - score may be 0..100 (we normalize)
    """
    # If string JSON
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    # If object-like (test stubs sometimes)
    if payload is not None and not isinstance(payload, (dict, list, str)):
        try:
            ranked_ids_attr = getattr(payload, "ranked_ids", None)
            scores_attr = getattr(payload, "scores", None)
            rats_attr = getattr(payload, "rationales", None)

            if scores_attr is None:
                scores_attr = getattr(payload, "judge_scores", None)
            if rats_attr is None:
                rats_attr = getattr(payload, "judge_reasons", None)
            if ranked_ids_attr is None:
                ranked_ids_attr = getattr(payload, "ranked", None)

            if ranked_ids_attr is not None or scores_attr is not None or rats_attr is not None:
                payload = {
                    "ranked_ids": ranked_ids_attr,
                    "scores": scores_attr,
                    "rationales": rats_attr,
                }
        except Exception:
            payload = {}

    if not isinstance(payload, dict):
        return JudgeResult(ranked_ids=[], scores={}, rationales={})

    # Case: ranked_ids list of strings
    ranked_list = payload.get("ranked")
    if ranked_list is None:
        ranked_list = payload.get("ranked_ids")
    if ranked_list is None:
        ranked_list = payload.get("ranking")

    if isinstance(ranked_list, list) and ranked_list and all(isinstance(x, str) for x in ranked_list):
        ranked_ids = [str(x).strip() for x in ranked_list if str(x).strip()]
        scores: Dict[str, float] = {}
        rats: Dict[str, str] = {}

        sc_map = payload.get("scores") or payload.get("judge_scores") or {}
        rs_map = payload.get("rationales") or payload.get("judge_reasons") or payload.get("reasons") or {}

        if isinstance(sc_map, dict):
            for k, v in sc_map.items():
                try:
                    scores[str(k)] = float(v)
                except Exception:
                    pass

        if isinstance(rs_map, dict):
            for k, v in rs_map.items():
                if v is None:
                    continue
                rats[str(k)] = str(v)

        # normalize 0..100 if needed
        if scores and max(scores.values() or [0.0]) > 1.5:
            for k in list(scores.keys()):
                scores[k] = _clamp01(scores[k] / 100.0)
        else:
            for k in list(scores.keys()):
                scores[k] = _clamp01(scores[k])

        return JudgeResult(ranked_ids=ranked_ids, scores=scores, rationales=rats)

    # Case: list of dict items
    items = None
    for key in ("ranked", "items", "results"):
        v = payload.get(key)
        if isinstance(v, list):
            items = v
            break
    if not isinstance(items, list):
        return JudgeResult(ranked_ids=[], scores={}, rationales={})

    ranked_ids: List[str] = []
    scores: Dict[str, float] = {}
    rats: Dict[str, str] = {}

    for it in items:
        if isinstance(it, str):
            vid = it.strip()
            if vid:
                ranked_ids.append(vid)
            continue

        if not isinstance(it, dict):
            # can't parse
            continue

        vid = (
            it.get("video_id")
            or it.get("videoId")
            or it.get("id")
            or it.get("video")
            or ""
        )
        vid = str(vid).strip()
        if not vid:
            continue

        sc = it.get("score")
        if sc is None:
            sc = it.get("score_0_100")
        if sc is None:
            sc = it.get("judge")

        try:
            sc_f = float(sc) if sc is not None else 0.0
        except Exception:
            sc_f = 0.0

        if sc_f > 1.5:
            sc_f = sc_f / 100.0
        sc_f = _clamp01(sc_f)

        rat = it.get("rationale")
        if rat is None:
            rat = it.get("why")
        if rat is None:
            rat = it.get("reason")
        rat_s = str(rat).strip() if rat is not None else ""

        ranked_ids.append(vid)
        scores[vid] = sc_f
        rats[vid] = rat_s

    return JudgeResult(ranked_ids=ranked_ids, scores=scores, rationales=rats)


# -------------------------
# Aggregation (stability)
# -------------------------
def _borda_aggregate(rankings: List[List[str]]) -> Dict[str, float]:
    all_ids = set()
    for r in rankings:
        all_ids.update(r)
    all_ids = list(all_ids)

    agg: Dict[str, float] = {vid: 0.0 for vid in all_ids}
    for r in rankings:
        n = len(r)
        for idx, vid in enumerate(r):
            agg[vid] += float(n - idx)
    return agg


def _stable_sort(
    ids: List[str],
    borda: Dict[str, float],
    mean_score: Dict[str, float],
    base_score: Dict[str, float],
) -> List[str]:
    pos = {vid: i for i, vid in enumerate(ids)}

    def key(vid: str):
        return (
            borda.get(vid, 0.0),
            mean_score.get(vid, 0.0),
            base_score.get(vid, 0.0),
            -pos.get(vid, 10**9),
        )

    return sorted(ids, key=key, reverse=True)


# -------------------------
# Public API
# -------------------------
def rerank_topk_listwise(
    gemini: Any,
    *,
    lesson_title: str,
    lesson_objectives: List[str],
    query_hints: List[str],
    candidates: List[Dict[str, Any]],
    topk: int = 8,
    rounds: int = 3,
    temperature: float = 0.1,
    cache_dir: str = "data/cache",
    cache_ttl_days: int = 14,
    judge_model: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if not candidates:
        return candidates, {"used_judge": False, "reason": "no_candidates"}

    # TopK window
    topk = max(1, min(int(topk), len(candidates)))
    head = candidates[:topk]
    tail = candidates[topk:]

    # Base score (tie-break + fallback ordering)
    base_score: Dict[str, float] = {}
    for c in head:
        vid = c.get("video_id")
        if not vid:
            continue
        if c.get("match_percent") is not None:
            try:
                base_score[str(vid)] = float(c.get("match_percent")) / 100.0
            except Exception:
                base_score[str(vid)] = 0.0
        else:
            try:
                base_score[str(vid)] = float(c.get("semantic") or 0.0)
            except Exception:
                base_score[str(vid)] = 0.0
        base_score[str(vid)] = _clamp01(base_score[str(vid)])

    cache_root = Path(cache_dir) / "judge"
    _ensure_dir(cache_root)

    cache_payload = {
        "cache_format_version": 2,
        "lesson_title": lesson_title,
        "lesson_objectives": lesson_objectives,
        "query_hints": query_hints,
        "judge_model": judge_model or getattr(gemini, "model", None),
        "topk": topk,
        "rounds": rounds,
        "ids": [c.get("video_id") for c in head],
        "titles": [c.get("title") for c in head],
    }
    cache_key = _sha256(json.dumps(cache_payload, ensure_ascii=False, sort_keys=True))
    cache_file = cache_root / f"listwise_{cache_key}.json"

    def _fallback_with_base(reason: str, errors: Optional[List[str]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        known_ids = [str(c.get("video_id")) for c in head if c.get("video_id")]
        pos = {vid: i for i, vid in enumerate(known_ids)}

        ordered_ids = sorted(
            known_ids,
            key=lambda vid: (base_score.get(vid, 0.0), -pos.get(vid, 10**9)),
            reverse=True,
        )

        id_to_c = {str(c.get("video_id")): c for c in head if c.get("video_id")}
        ordered: List[Dict[str, Any]] = []
        for vid in ordered_ids:
            c0 = id_to_c.get(vid)
            if not c0:
                continue
            c = dict(c0)
            c["judge"] = float(base_score.get(vid, 0.0))
            c["judge_rationale"] = "Judge unavailable; using base score proxy."
            ordered.append(c)

        out_tail: List[Dict[str, Any]] = []
        for c0 in tail:
            c = dict(c0)
            c.setdefault("judge", 0.0)
            c.setdefault("judge_rationale", "")
            out_tail.append(c)

        dbg = {
            "used_judge": False,
            "fallback": True,
            "reason": reason,
            "errors": errors or [],
        }
        return ordered + out_tail, dbg

    # HARD GUARD
    if gemini is None:
        return _fallback_with_base("no_gemini_client")

    # Cache load (if valid)
    if _is_fresh(cache_file, cache_ttl_days):
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            ranked_ids = cached.get("ranked_ids") or []
            scores = cached.get("scores") or {}
            rationales = cached.get("rationales") or {}
            if not ranked_ids and not scores and not rationales:
                raise ValueError("empty_cache")

            id_to_c = {str(c.get("video_id")): c for c in head if c.get("video_id")}
            ordered: List[Dict[str, Any]] = []
            seen = set()

            for vid in ranked_ids:
                if vid in id_to_c and vid not in seen:
                    cc = dict(id_to_c[vid])
                    cc["judge"] = _clamp01(scores.get(vid, 0.0))
                    cc["judge_rationale"] = str(rationales.get(vid, ""))
                    ordered.append(cc)
                    seen.add(vid)

            for c0 in head:
                vid = str(c0.get("video_id"))
                if vid and vid not in seen:
                    cc = dict(c0)
                    cc["judge"] = _clamp01(scores.get(vid, 0.0))
                    cc["judge_rationale"] = str(rationales.get(vid, ""))
                    ordered.append(cc)

            dbg = {
                "used_judge": True,
                "cache_hit": True,
                "judge_model": cached.get("debug", {}).get("judge_model") if isinstance(cached.get("debug"), dict) else cached.get("judge_model"),
            }
            return ordered + [dict(x) for x in tail], dbg
        except Exception:
            pass

    # Live judge
    items_for_prompt: List[Dict[str, Any]] = []
    for c in head:
        items_for_prompt.append(
            {
                "video_id": c.get("video_id"),
                "title": c.get("title", ""),
                "channel": c.get("channel", ""),
                "duration_sec": c.get("duration_sec"),
                "views": c.get("views"),
                "like_ratio": c.get("like_ratio"),
                "description_excerpt": c.get("description_excerpt", ""),
                "semantic": c.get("semantic"),
                "coverage": c.get("coverage"),
                "quality": c.get("quality"),
            }
        )

    prompt = _build_listwise_prompt(
        lesson_title=lesson_title,
        lesson_objectives=lesson_objectives,
        query_hints=query_hints,
        items=items_for_prompt,
    )

    rankings: List[List[str]] = []
    score_runs: List[Dict[str, float]] = []
    rationale_runs: List[Dict[str, str]] = []
    errors: List[str] = []

    rounds = max(1, int(rounds))

    for r in range(rounds):
        try:
            schema = _judge_schema()
            payload = None

            # Try common call signatures safely (works with your GeminiClient + many stubs)
            try:
                payload = gemini.generate_json(
                    prompt,
                    json_schema=schema,
                    temperature=temperature,
                    model_override=judge_model,
                )
            except TypeError:
                try:
                    payload = gemini.generate_json(prompt, json_schema=schema, temperature=temperature)
                except TypeError:
                    try:
                        payload = gemini.generate_json(prompt)
                    except Exception as e:
                        raise e

            jr = _parse_judge_payload(payload)

            known_ids = [str(c.get("video_id")) for c in head if c.get("video_id")]
            set_known = set(known_ids)

            rr = [vid for vid in jr.ranked_ids if vid in set_known]
            for vid in known_ids:
                if vid not in rr:
                    rr.append(vid)

            rankings.append(rr)
            score_runs.append({k: _clamp01(v) for k, v in jr.scores.items()})
            rationale_runs.append({k: str(v) for k, v in jr.rationales.items()})
        except Exception as e:
            errors.append(f"round {r+1}: {e}")

    if not rankings:
        return _fallback_with_base("judge_failed_all_rounds", errors)

    # Aggregate
    borda = _borda_aggregate(rankings)

    all_ids = [str(c.get("video_id")) for c in head if c.get("video_id")]
    mean_score: Dict[str, float] = {}
    for vid in all_ids:
        vals = [float(run.get(vid, 0.0)) for run in score_runs]
        mean_score[vid] = _clamp01(sum(vals) / max(1, len(vals)))

    final_rationale: Dict[str, str] = {}
    for vid in all_ids:
        best = ("", -1.0)
        for run_s, run_r in zip(score_runs, rationale_runs):
            sc = float(run_s.get(vid, 0.0))
            rr = str(run_r.get(vid, "")).strip()
            if rr and sc > best[1]:
                best = (rr, sc)
        final_rationale[vid] = best[0]

    ordered_ids = _stable_sort(all_ids, borda=borda, mean_score=mean_score, base_score=base_score)

    id_to_c = {str(c.get("video_id")): c for c in head if c.get("video_id")}
    ordered: List[Dict[str, Any]] = []
    for vid in ordered_ids:
        c0 = id_to_c.get(vid)
        if not c0:
            continue
        c = dict(c0)
        c["judge"] = float(mean_score.get(vid, 0.0))
        c["judge_rationale"] = final_rationale.get(vid, "")
        ordered.append(c)

    dbg = {
        "used_judge": True,
        "cache_hit": False,
        "topk": topk,
        "rounds": rounds,
        "temperature": temperature,
        "judge_model": judge_model or getattr(gemini, "model", None),
        "errors": errors,
    }

    # Save cache
    try:
        cache_file.write_text(
            json.dumps(
                {
                    "ranked_ids": ordered_ids,
                    "scores": mean_score,
                    "rationales": final_rationale,
                    "debug": dbg,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception:
        pass

    return ordered + [dict(x) for x in tail], dbg


# -------------------------
# Back-compat wrapper for tests / older imports
# -------------------------
@dataclass
class TopKRerankResult:
    ranked: List[Any]
    ranked_ids: List[str]
    judge_scores: Dict[str, float]
    judge_reasons: Dict[str, str]


def gemini_judge_rerank_topk(
    *,
    gemini: Any,
    lesson: Any,
    candidates: List[Any],
    topk: int = 8,
    n_trials: int = 3,
    temperature: float = 0.1,
    cache_dir: str = "data/cache",
    cache_ttl_days: int = 14,
    judge_model: Optional[str] = None,
) -> TopKRerankResult:
    def pick(obj: Any, *names: str, default=None):
        for n in names:
            if isinstance(obj, dict) and n in obj:
                return obj.get(n)
            if hasattr(obj, n):
                return getattr(obj, n)
        return default

    lesson_title = pick(lesson, "lesson_title", "title", default="Lesson")
    lesson_objectives = pick(lesson, "lesson_objectives", "objectives", default=[]) or []
    query_hints = pick(lesson, "query_hints", "youtube_queries", default=[]) or []

    orig_by_id: Dict[str, Any] = {}
    norm: List[Dict[str, Any]] = []

    for c in candidates:
        if isinstance(c, dict):
            d = dict(c)
        else:
            d = {
                "video_id": pick(c, "video_id", default=""),
                "title": pick(c, "title", default=""),
                "description_excerpt": (pick(c, "description", "description_excerpt", default="") or "")[:400],
                "channel": pick(c, "channel", "channel_title", default=""),
                "duration_sec": pick(c, "duration_sec", default=None),
                "views": pick(c, "views", "view_count", default=None),
                "like_ratio": pick(c, "like_ratio", default=None),
            }
            comps = pick(c, "components", default=None)
            if isinstance(comps, dict):
                d["semantic"] = comps.get("semantic")
                d["coverage"] = comps.get("coverage")
                d["quality"] = comps.get("quality")
            mp = pick(c, "match_percent", default=None)
            if mp is not None:
                d["match_percent"] = mp

        vid0 = d.get("video_id")
        if vid0:
            orig_by_id[str(vid0)] = c
        if not d.get("video_id"):
            continue
        norm.append(d)

    reranked, debug = rerank_topk_listwise(
        gemini,
        lesson_title=str(lesson_title),
        lesson_objectives=[str(x) for x in lesson_objectives],
        query_hints=[str(x) for x in query_hints],
        candidates=norm,
        topk=topk,
        rounds=n_trials,
        temperature=temperature,
        cache_dir=cache_dir,
        cache_ttl_days=cache_ttl_days,
        judge_model=judge_model,
    )

    ranked_ids_all = [str(x.get("video_id")) for x in reranked if x.get("video_id")]
    cut_n = max(1, min(int(topk), len(ranked_ids_all)))
    ranked_ids = ranked_ids_all[:cut_n]

    ranked: List[Any] = [orig_by_id.get(vid, {"video_id": vid}) for vid in ranked_ids]

    judge_scores: Dict[str, float] = {}
    judge_reasons: Dict[str, str] = {}

    # IMPORTANT: even fallback attaches judge + judge_rationale; harvest them.
    for x in reranked:
        vid = str(x.get("video_id", "")).strip()
        if not vid:
            continue
        if x.get("judge") is not None:
            judge_scores[vid] = _clamp01(x.get("judge"))
        if x.get("judge_rationale") is not None:
            s = str(x.get("judge_rationale") or "").strip()
            if s:
                judge_reasons[vid] = s

    # If still empty (shouldn’t happen now), at least fill base ordering 0s
    if not judge_scores:
        for vid in ranked_ids:
            judge_scores[vid] = 0.0

    return TopKRerankResult(
        ranked=ranked,
        ranked_ids=ranked_ids,
        judge_scores=judge_scores,
        judge_reasons=judge_reasons,
    )
