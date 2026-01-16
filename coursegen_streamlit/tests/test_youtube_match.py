print("START test_youtube_match.py")

from coursegen.config import SETTINGS
from coursegen.gemini_client import GeminiClient
from coursegen.youtube_client import YouTubeClient
from coursegen.retrieval import match_videos_for_lesson

g = GeminiClient(api_key=SETTINGS.GEMINI_API_KEY, model=SETTINGS.GEMINI_MODEL)
yt = YouTubeClient(api_key=SETTINGS.YOUTUBE_API_KEY, cache_dir=SETTINGS.CACHE_DIR)

lesson_text = "Model Context Protocol (MCP): what it is, why it matters for tool-using agents, core concepts, and a basic flow example."
youtube_queries = [
    "Model Context Protocol MCP explained",
    "Anthropic MCP tutorial",
    "MCP tool using agents protocol",
    "Model Context Protocol crash course",
]

results = match_videos_for_lesson(
    g,
    yt,
    lesson_text=lesson_text,
    youtube_queries=youtube_queries,
    cache_dir=SETTINGS.CACHE_DIR,
    embed_model=SETTINGS.GEMINI_EMBED_MODEL,
    max_per_query=8,
    topk_rerank=SETTINGS.TOPK_RERANK,
)

print(f"Got {len(results)} matched candidates")
for r in results[:8]:
    meta = r.meta or {}
    print(f"- {r.percent:>3}% {meta.get('title','')[:80]}")
    print(f"    id={r.video_id}  sem={r.components['semantic']:.3f} cov={r.components['coverage']:.3f} qual={r.components['quality']:.3f} judge={r.components.get('judge',0):.3f}")
