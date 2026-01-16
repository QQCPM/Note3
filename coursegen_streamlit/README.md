# CourseAI — Course Video Matching Demo 
Turn a **topic + PDFs/links** into a **scrollable course page**, then **retrieve + score + rerank** YouTube videos per lesson, with **key moments + storyboard screenshots** (no video downloads).

![license](https://img.shields.io/badge/license-not%20specified-lightgrey)
![app](https://img.shields.io/badge/app-Streamlit-ff4b4b)
![python](https://img.shields.io/badge/python-3.11-blue)
![llm](https://img.shields.io/badge/LLM-Gemini-6f42c1)
![matching](https://img.shields.io/badge/matching-semantic%20%2B%20coverage%20%2B%20quality%20%2B%20judge-success)

---

## What it does
- **Course planning**: generates modules/lessons from a topic (optionally grounded by uploaded PDFs + article links).
- **YouTube retrieval**: builds candidate lists from lesson queries.
- **Scoring** (stable base rank):
  - **Semantic** similarity (embeddings)
  - **Coverage** (keyword/term coverage)
  - **Quality** heuristics (duration, clickbait/news penalties, etc.)
- **Rerank (LLM judge)**: listwise judge for Top-K to improve relevance while keeping stability.
- **Key moments**:
  - Uses **transcripts when available** to locate topic→timestamp segments
  - Falls back gracefully when transcripts are missing
  - Shows **storyboard-based screenshots** at timestamps (**no downloading videos**)

---

## Repo structure 
- `app.py` — Streamlit UI (course-like lesson view + full scroll)
- `coursegen/retrieval.py` — YouTube candidate building + calling matcher
- `coursegen/scoring.py` / `coursegen/matcher.py` — scoring components + stage-2 judge blend
- `coursegen/rerank.py` — listwise rerank + stability aggregation
- `coursegen/transcripts.py` — transcript fetching (segments + start times)
- `coursegen/keymoments.py` — topic→moments + storyboard frame attaching
- `coursegen/video_frames.py` — storyboard frame fetch + caching
- `coursegen/ingest.py` — PDF + URL ingestion (text + images)

---

## Setup
### 1) Create & activate venv
```bash
python -m venv .venv
source .venv/bin/activate

Create coursegen_streamlit/.env

```bash
GEMINI_API_KEY=...
GEMINI_MODEL=models/gemini-3-pro-preview
EMBEDDING_MODEL=...
YOUTUBE_API_KEY=...
CACHE_DIR=data/cache
```

Run: streamlit run app.py

Notes on YouTube quota
	•	Turn off “Auto-fetch ALL lessons” to avoid burning quota.
	•	Prefer “Use cached matches only” after a successful run.
	•	When quota is exceeded, the app still renders the course + notes (video fetch is skipped).
