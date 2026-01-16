from coursegen.config import load_settings
from coursegen.gemini_client import GeminiClient
from coursegen.rerank import gemini_judge_rerank_topk

# Use your existing candidate class/structure; below is a tiny mock
class C:
    def __init__(self, video_id, title, description="", channel_title=""):
        self.video_id = video_id
        self.title = title
        self.description = description
        self.channel_title = channel_title
        self.components = {"semantic": 0.8, "quality": 0.6, "coverage": 0.4}

class Lesson:
    title = "Introduction to MCP"
    objectives = ["Explain what MCP is", "Why it matters", "Core components"]

s = load_settings()
g = GeminiClient(api_key=s.GEMINI_API_KEY, model=s.GEMINI_MODEL)

cands = [
    C("a1", "Model Context Protocol (MCP) explained clearly", "deep dive into MCP components..."),
    C("a2", "Random AI News Week 12", "news roundup..."),
    C("a3", "MCP Tutorial: build a tool-using agent", "hands-on demo, code..."),
]

res = gemini_judge_rerank_topk(gemini=g, lesson=Lesson(), candidates=cands, topk=3, n_trials=2)
print([c.video_id for c in res.ranked])
print(res.judge_scores)
print(res.judge_reasons)