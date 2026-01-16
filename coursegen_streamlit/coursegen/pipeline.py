from typing import List
from .models import CoursePlan, FullCourse, VideoMatch
from .youtube_client import YouTubeClient
from .retrieval import get_candidates
from .rerank import rerank_lesson

def build_course_with_videos(plan: CoursePlan, yt: YouTubeClient, max_candidates: int = 40, topk: int = 8) -> FullCourse:
    all_matches: List[VideoMatch] = []
    for lesson in plan.lessons:
        candidates = get_candidates(yt, lesson, max_candidates=max_candidates)
        ranked = rerank_lesson(lesson, candidates, topk=topk)
        # pick best 1 video per lesson by default
        all_matches.append(ranked[0])
    return FullCourse(plan=plan, matches=all_matches)