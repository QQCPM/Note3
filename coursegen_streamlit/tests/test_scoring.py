print("START test_scoring.py")

from coursegen.config import GEMINI_API_KEY, GEMINI_MODEL, EMBEDDING_MODEL
from coursegen.gemini_client import GeminiClient
from coursegen.scoring import score_candidate

# minimal "lesson" dict shape (planner models may differ; scorer is defensive)
lesson = {
    "lesson_title": "Introduction to MCP",
    "description": "Explain what Model Context Protocol is and why it matters for tool-using agents.",
    "objectives": [
        "Define MCP and the problems it solves",
        "Describe core components (clients, servers, tools)",
        "Explain why standardization matters",
    ],
    "key_concepts": ["model context protocol", "mcp client", "mcp server", "tools", "standardization"],
}

good = {
    "id": "good1",
    "title": "Model Context Protocol (MCP), clearly explained (why it matters)",
    "description": "A clear explanation of MCP: clients, servers, tools; and why it matters for agent ecosystems.",
    "view_count": 120000,
    "like_count": 4500,
    "comment_count": 380,
    "duration_seconds": 18 * 60,
    # optional transcript
    "transcript": "In this video we define the Model Context Protocol, explain clients and servers, and how tools integrate..."
}

bad = {
    "id": "bad1",
    "title": "Random AI News Roundup 🔥 You won't believe this!",
    "description": "Weekly AI news. Lots of stuff happening.",
    "view_count": 800,
    "like_count": 15,
    "comment_count": 2,
    "duration_seconds": 2 * 60,
}

g = GeminiClient(api_key=GEMINI_API_KEY, model=GEMINI_MODEL, embedding_model=EMBEDDING_MODEL)

for cand in [good, bad]:
    pct, comps, dbg = score_candidate(
        gemini=g,
        course_title="Mastering the Model Context Protocol (MCP)",
        module_title="MCP Fundamentals and Architecture",
        lesson=lesson,
        cand=cand,
        use_transcript=True,
    )
    print("\n---", cand["id"], "---")
    print("match:", pct, "%")
    print("components:", comps)
    print("semantic dbg:", dbg["semantic_dbg"])
    print("coverage dbg:", {k: dbg["coverage_dbg"][k] for k in ["hit_rate","stuff_penalty"]})
    print("quality dbg:", {k: dbg["quality_dbg"][k] for k in ["dur_norm","penalty","clickbait","newsy"]})
