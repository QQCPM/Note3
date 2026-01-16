print("START test_matcher.py")

from coursegen.config import SETTINGS
from coursegen.gemini_client import GeminiClient
from coursegen.matcher import match_lesson_videos

g = GeminiClient(api_key=SETTINGS.GEMINI_API_KEY, model=SETTINGS.GEMINI_MODEL)

lesson_text = "MCP fundamentals: what MCP is, why it standardizes tool calling, client/server concepts, and a basic example."
candidates = [
    {
        "video_id": "abc123",
        "title": "Model Context Protocol (MCP) Explained - Tool Using Agents",
        "channel_title": "AI Systems",
        "description": "Intro to MCP and how agents call tools safely.",
        "duration_sec": 900,
        "view_count": 120000,
    },
    {
        "video_id": "def456",
        "title": "Random AI News",
        "channel_title": "Vibes",
        "description": "Today we talk about AI stuff.",
        "duration_sec": 180,
        "view_count": 5000,
    },
]

res = match_lesson_videos(
    g,
    lesson_text=lesson_text,
    candidates=candidates,
    cache_dir=SETTINGS.CACHE_DIR,
    embed_model=SETTINGS.GEMINI_EMBED_MODEL,
    topk_rerank=2,
)

for r in res:
    print(r.video_id, r.percent, r.components, (r.why[:80] + "..." if r.why else ""))
