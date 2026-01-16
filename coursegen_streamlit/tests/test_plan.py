print("START test_plan.py")

from coursegen.config import SETTINGS
from coursegen.gemini_client import GeminiClient
from coursegen.planner import generate_course_plan

print("API KEY set?", bool(SETTINGS.GEMINI_API_KEY))
print("Model:", SETTINGS.GEMINI_MODEL)

g = GeminiClient(api_key=SETTINGS.GEMINI_API_KEY, model=SETTINGS.GEMINI_MODEL)
print("Client created. Model=", g.model)

plan = generate_course_plan(
    gemini=g,
    topic="Model Context Protocol (MCP) for tool-using agents",
    difficulty="Intermediate",
    duration_weeks=2,
)

print(plan.course_title)
print(len(plan.modules), "modules")
print(plan.modules[0].lessons[0].youtube_queries)
