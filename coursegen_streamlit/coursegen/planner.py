from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from coursegen.gemini_client import GeminiClient


@dataclass
class LessonPlan:
    lesson_title: str
    objectives: List[str]
    youtube_queries: List[str]


@dataclass
class ModulePlan:
    module_title: str
    module_summary: str
    lessons: List[LessonPlan]


@dataclass
class CoursePlan:
    course_title: str
    course_summary: str
    difficulty: str
    duration_weeks: int
    modules: List[ModulePlan]


def _schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "course_title": {"type": "string"},
            "course_summary": {"type": "string"},
            "difficulty": {"type": "string"},
            "duration_weeks": {"type": "integer", "minimum": 1, "maximum": 52},
            "modules": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "properties": {
                        "module_title": {"type": "string"},
                        "module_summary": {"type": "string"},
                        "lessons": {
                            "type": "array",
                            "minItems": 1,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "lesson_title": {"type": "string"},
                                    "objectives": {"type": "array", "items": {"type": "string"}, "minItems": 2},
                                    "youtube_queries": {"type": "array", "items": {"type": "string"}, "minItems": 4},
                                },
                                "required": ["lesson_title", "objectives", "youtube_queries"],
                            },
                        },
                    },
                    "required": ["module_title", "module_summary", "lessons"],
                },
            },
        },
        "required": ["course_title", "course_summary", "difficulty", "duration_weeks", "modules"],
    }


def generate_course_plan(
    *,
    gemini: GeminiClient,
    topic: str,
    difficulty: str,
    duration_weeks: int,
) -> CoursePlan:
    # heuristics for module count
    if duration_weeks <= 1:
        modules = 2
        lessons_per_module = 3
    elif duration_weeks <= 2:
        modules = 3
        lessons_per_module = 3
    elif duration_weeks <= 4:
        modules = 4
        lessons_per_module = 3
    else:
        modules = min(8, duration_weeks)
        lessons_per_module = 3

    prompt = f"""
Create a structured course plan.

Topic: {topic}
Difficulty: {difficulty}
Duration: {duration_weeks} weeks

Constraints:
- Create exactly {modules} modules.
- Each module has exactly {lessons_per_module} lessons.
- Each lesson must include:
  - 2–4 learning objectives (concise)
  - 4–8 YouTube search queries that will find good videos.
    Queries should be diverse and robust:
    * include synonyms
    * include alternative terms and abbreviations
    * include "tutorial", "lecture", "explained", "crash course" variants
    * include both broad and specific phrasing
- Avoid brand-new/fad-only phrasing; include stable terms.
- Write for real learners: build from fundamentals → practice → advanced.

Output JSON only.
""".strip()

    data = gemini.generate_json(prompt, json_schema=_schema(), temperature=0.25)

    modules_out: List[ModulePlan] = []
    for m in data["modules"]:
        lessons_out: List[LessonPlan] = []
        for l in m["lessons"]:
            lessons_out.append(
                LessonPlan(
                    lesson_title=l["lesson_title"],
                    objectives=list(l["objectives"]),
                    youtube_queries=list(l["youtube_queries"]),
                )
            )
        modules_out.append(
            ModulePlan(
                module_title=m["module_title"],
                module_summary=m["module_summary"],
                lessons=lessons_out,
            )
        )

    return CoursePlan(
        course_title=data["course_title"],
        course_summary=data["course_summary"],
        difficulty=data["difficulty"],
        duration_weeks=int(data["duration_weeks"]),
        modules=modules_out,
    )
