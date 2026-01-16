from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class LessonIntent(BaseModel):
    title: str
    objective: str
    must_concepts: List[str] = Field(default_factory=list)
    nice_concepts: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)
    difficulty: str = "intermediate"  # beginner|intermediate|advanced
    format_pref: Optional[str] = None  # tutorial|lecture|walkthrough|theory|project
    anti_goals: List[str] = Field(default_factory=list)

class CoursePlan(BaseModel):
    topic: str
    difficulty: str
    duration_weeks: int
    lessons: List[LessonIntent]

class VideoCandidate(BaseModel):
    video_id: str
    url: str
    title: str
    description: str = ""
    channel_title: str = ""
    published_at: str = ""
    duration_seconds: Optional[int] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None

    transcript: Optional[str] = None  # if you add transcript retrieval later
    features: Dict[str, float] = Field(default_factory=dict)

class VideoMatch(BaseModel):
    lesson_title: str
    video: VideoCandidate
    match_percent: int
    score: float
    why: str = ""

class FullCourse(BaseModel):
    plan: CoursePlan
    matches: List[VideoMatch]