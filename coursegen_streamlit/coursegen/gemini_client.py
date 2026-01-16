from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from google import genai


class GeminiError(RuntimeError):
    pass


@dataclass
class GeminiClient:
    api_key: str
    model: str
    embedding_model: str = "models/text-embedding-004"

    def __post_init__(self) -> None:
        if not self.api_key:
            raise GeminiError("Missing GEMINI_API_KEY")
        self.client = genai.Client(api_key=self.api_key)

    def _retry(self, fn: Callable[[], Any], tries: int = 4, base_sleep: float = 0.8) -> Any:
        last: Exception | None = None
        for i in range(tries):
            try:
                return fn()
            except Exception as e:
                last = e
                # naive backoff
                time.sleep(base_sleep * (2**i))
        raise GeminiError(f"Gemini call failed after {tries} tries: {last}") from last

    def generate_json(
        self,
        prompt: str,
        json_schema: Dict[str, Any],
        temperature: float = 0.2,
        max_output_tokens: int = 4096,
        model_override: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Uses Gemini generateContent to produce JSON."""

        def _call() -> Dict[str, Any]:
            resp = self.client.models.generate_content(
                model=(model_override or self.model),
                contents=prompt,
                config={
                    "temperature": temperature,
                    "max_output_tokens": max_output_tokens,
                    "response_mime_type": "application/json",
                    "response_schema": json_schema,
                },
            )

            # SDK variations: resp.text or resp.candidates[0].content.parts[0].text
            txt = getattr(resp, "text", None)
            if not txt:
                txt = str(resp)

            try:
                return json.loads(txt)
            except Exception:
                # last resort: try to extract JSON substring
                start = txt.find("{")
                end = txt.rfind("}")
                if start >= 0 and end >= 0 and end > start:
                    return json.loads(txt[start : end + 1])
                raise

        return self._retry(_call)

    def embed_texts(self, texts: List[str], embed_model: Optional[str] = None) -> List[List[float]]:
        """Returns one embedding vector per input text."""
        if not texts:
            return []

        def _call() -> List[List[float]]:
            resp = self.client.models.embed_content(
                model=(embed_model or self.embedding_model),
                contents=texts,
            )

            # SDK variations; handle both shapes:
            # - resp.embeddings = [{values:[...]}...]
            # - resp.embedding = {values:[...]} for single
            embs: List[List[float]] = []

            if hasattr(resp, "embeddings") and getattr(resp, "embeddings"):
                for e in resp.embeddings:
                    vals = getattr(e, "values", None) or getattr(e, "embedding", None) or e
                    if isinstance(vals, dict) and "values" in vals:
                        vals = vals["values"]
                    embs.append(list(vals))
                return embs

            if hasattr(resp, "embedding") and getattr(resp, "embedding"):
                vals = getattr(resp.embedding, "values", None) or resp.embedding
                if isinstance(vals, dict) and "values" in vals:
                    vals = vals["values"]
                return [list(vals)]

            raise GeminiError("Unexpected embed response shape from SDK")

        return self._retry(_call)

    # -----------------------------
    # Back-compat for older code paths
    # -----------------------------
    def judge_rerank_json(self, prompt: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        """Backward-compatible wrapper used by coursegen/judge.py.

        Accepts prompt either positionally or as a keyword. Some older callers
        mistakenly omit the positional prompt and instead pass `prompt=...`.

        Supported kwargs (extras ignored):
          - json_schema=...  (or schema=...)
          - temperature=...
          - model_override=...
          - max_output_tokens=...
          - prompt=... (if positional prompt is None)
        """
        if prompt is None:
            prompt = kwargs.pop("prompt", None)
        if prompt is None:
            prompt = kwargs.pop("contents", None) or kwargs.pop("content", None)
        if prompt is None:
            raise GeminiError("judge_rerank_json missing prompt")

        json_schema = kwargs.pop("json_schema", None)
        if json_schema is None:
            json_schema = kwargs.pop("schema", None)
        if json_schema is None:
            raise GeminiError("judge_rerank_json missing json_schema")

        temperature = float(kwargs.pop("temperature", 0.2))
        max_output_tokens = int(kwargs.pop("max_output_tokens", 4096))
        model_override = kwargs.pop("model_override", None)

        return self.generate_json(
            str(prompt),
            json_schema=json_schema,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            model_override=model_override,
        )
