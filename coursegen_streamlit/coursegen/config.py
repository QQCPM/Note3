from __future__ import annotations

import os
from pathlib import Path
from pydantic import BaseModel

# --- Load .env robustly (works no matter where you run from) ---
def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv  # type: ignore
    except Exception:
        return

    cur = Path.cwd().resolve()
    for p in [cur, *cur.parents]:
        env_path = p / ".env"
        if env_path.exists():
            load_dotenv(dotenv_path=env_path, override=False)
            return

_load_dotenv()


class Settings(BaseModel):
    # --- Gemini ---
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "models/gemini-3-pro-preview"

    # --- Embeddings ---
    # Back-compat: some code/tests still refer to GEMINI_EMBED_MODEL.
    # We keep both names and ensure they stay in sync.
    GEMINI_EMBED_MODEL: str = "models/text-embedding-004"
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    EMBEDDING_BATCH_SIZE: int = 64
    EMBEDDING_CACHE_TTL_DAYS: int = 30

    # --- YouTube ---
    YOUTUBE_API_KEY: str = ""

    # --- App ---
    CACHE_DIR: str = "data/cache"
    MAX_CANDIDATES_PER_LESSON: int = 40
    TOPK_RERANK: int = 8

    # --- Scoring weights (tunable) ---
    W_SEM: float = 0.55
    W_COV: float = 0.20
    W_QUAL: float = 0.10
    W_JUDGE: float = 0.15


def load_settings() -> Settings:
    def _f(name: str, default: str) -> float:
        try:
            return float(os.getenv(name, default))
        except Exception:
            return float(default)

    embed_model = os.getenv(
        "GEMINI_EMBED_MODEL",
        os.getenv("EMBEDDING_MODEL", "models/text-embedding-004"),
    )

    return Settings(
        GEMINI_API_KEY=os.getenv("GEMINI_API_KEY", ""),
        GEMINI_MODEL=os.getenv("GEMINI_MODEL", "models/gemini-3-pro-preview"),

        GEMINI_EMBED_MODEL=embed_model,
        EMBEDDING_MODEL=embed_model,
        EMBEDDING_BATCH_SIZE=int(os.getenv("EMBEDDING_BATCH_SIZE", "64")),
        EMBEDDING_CACHE_TTL_DAYS=int(os.getenv("EMBEDDING_CACHE_TTL_DAYS", "30")),

        YOUTUBE_API_KEY=os.getenv("YOUTUBE_API_KEY", ""),

        CACHE_DIR=os.getenv("CACHE_DIR", "data/cache"),
        MAX_CANDIDATES_PER_LESSON=int(os.getenv("MAX_CANDIDATES_PER_LESSON", "40")),
        TOPK_RERANK=int(os.getenv("TOPK_RERANK", "8")),

        W_SEM=_f("W_SEM", "0.55"),
        W_COV=_f("W_COV", "0.20"),
        W_QUAL=_f("W_QUAL", "0.10"),
        W_JUDGE=_f("W_JUDGE", "0.15"),
    )


# Backward-compatible module-level exports (so existing imports keep working)
SETTINGS = load_settings()

GEMINI_API_KEY = SETTINGS.GEMINI_API_KEY
GEMINI_MODEL = SETTINGS.GEMINI_MODEL
GEMINI_EMBED_MODEL = SETTINGS.GEMINI_EMBED_MODEL

EMBEDDING_MODEL = SETTINGS.EMBEDDING_MODEL
EMBEDDING_BATCH_SIZE = SETTINGS.EMBEDDING_BATCH_SIZE
EMBEDDING_CACHE_TTL_DAYS = SETTINGS.EMBEDDING_CACHE_TTL_DAYS

YOUTUBE_API_KEY = SETTINGS.YOUTUBE_API_KEY

CACHE_DIR = SETTINGS.CACHE_DIR
MAX_CANDIDATES_PER_LESSON = SETTINGS.MAX_CANDIDATES_PER_LESSON
TOPK_RERANK = SETTINGS.TOPK_RERANK

W_SEM = SETTINGS.W_SEM
W_COV = SETTINGS.W_COV
W_QUAL = SETTINGS.W_QUAL
W_JUDGE = SETTINGS.W_JUDGE

# --- Back-compat alias expected by older scoring.py ---
# Where embedding vectors are cached on disk (under CACHE_DIR by default).
EMBEDDING_CACHE_DIR = os.getenv("EMBEDDING_CACHE_DIR", str(Path(CACHE_DIR) / "embeddings"))

# --- Transcript options (used by scoring / semantic matching) ---
# If true, we will try to fetch + use video transcripts to compute S_sem.
USE_TRANSCRIPTS = os.getenv("USE_TRANSCRIPTS", "true").strip().lower() in ("1","true","yes","y","on")

# Preferred transcript language (YouTube transcript APIs often return multiple)
TRANSCRIPT_LANG = os.getenv("TRANSCRIPT_LANG", "en")

# Safety limits to avoid gigantic transcripts blowing up prompts/embeddings
TRANSCRIPT_MAX_CHARS = int(os.getenv("TRANSCRIPT_MAX_CHARS", "8000"))
TRANSCRIPT_MAX_SEGMENTS = int(os.getenv("TRANSCRIPT_MAX_SEGMENTS", "200"))


# =========================
# Step 3: Judge rerank knobs
# =========================
# Turn judge rerank on/off (useful for dev / quota control)
USE_JUDGE = os.getenv("USE_JUDGE", "true").lower() in ("1", "true", "yes", "y", "on")

# Judge model can differ from main planner model (default: GEMINI_MODEL)
JUDGE_MODEL = os.getenv("JUDGE_MODEL", GEMINI_MODEL)

# How many independent judge runs to stabilize ordering
JUDGE_ROUNDS = int(os.getenv("JUDGE_ROUNDS", "3"))

# Temperature for judge (keep low for stability)
JUDGE_TEMPERATURE = float(os.getenv("JUDGE_TEMPERATURE", "0.1"))

# Cache TTL days for judge outputs
JUDGE_CACHE_TTL_DAYS = int(os.getenv("JUDGE_CACHE_TTL_DAYS", "14"))
