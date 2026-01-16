from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional, TypeVar

T = TypeVar("T")


def _safe_key(key: str, max_len: int = 200) -> str:
    """Make a filename-safe key."""
    safe = "".join(ch if (ch.isalnum() or ch in ("-", "_", ".")) else "_" for ch in str(key))
    if len(safe) > max_len:
        safe = safe[:max_len]
    return safe


def _atomic_write_text(path: Path, text: str) -> None:
    """Best-effort atomic write (write temp then replace)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(str(tmp), str(path))


@dataclass
class DiskCache:
    """Simple JSON disk cache with TTL.

    Stores each key as a JSON file under <root>/<namespace>/<safe_key>.json.

    Backward compatible with prior implementation:
      - DiskCache(root, namespace='default', ttl_days=30)
      - get(key) -> Optional[Any]
      - set(key, value) -> None

    Additions:
      - ttl_seconds (preferred internally)
      - delete(key), clear(), exists(key)
      - get_or_set(key, factory)
      - optional JSON dumps/loads hooks

    NOTE: Cache failures should never crash the app.
    """

    root: str
    namespace: str = "default"
    ttl_days: int = 30

    # Optional hooks (useful if callers want to tweak JSON settings)
    dumps: Callable[[Any], str] = field(default=lambda v: json.dumps(v, ensure_ascii=False))
    loads: Callable[[str], Any] = field(default=json.loads)

    def __post_init__(self) -> None:
        self.base = Path(self.root).expanduser().resolve() / self.namespace
        self.base.mkdir(parents=True, exist_ok=True)

    @property
    def ttl_seconds(self) -> float:
        return float(self.ttl_days) * 86400.0

    def _path_for(self, key: str) -> Path:
        return self.base / f"{_safe_key(key)}.json"

    def _fresh(self, p: Path) -> bool:
        try:
            if not p.exists():
                return False
            age_s = time.time() - p.stat().st_mtime
            return age_s <= self.ttl_seconds
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        p = self._path_for(key)
        return self._fresh(p)

    def get(self, key: str) -> Optional[Any]:
        p = self._path_for(key)
        if not self._fresh(p):
            return None
        try:
            return self.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return None

    def set(self, key: str, value: Any) -> None:
        p = self._path_for(key)
        try:
            _atomic_write_text(p, self.dumps(value))
        except Exception:
            # cache should never crash the app
            pass

    def delete(self, key: str) -> None:
        try:
            p = self._path_for(key)
            if p.exists():
                p.unlink()
        except Exception:
            pass

    def clear(self) -> None:
        """Remove all cached entries in this namespace."""
        try:
            if not self.base.exists():
                return
            for p in self.base.glob("*.json"):
                try:
                    p.unlink()
                except Exception:
                    pass
        except Exception:
            pass

    def get_or_set(self, key: str, factory: Callable[[], T]) -> T:
        """Get cached value if fresh, otherwise compute, store, and return."""
        v = self.get(key)
        if v is not None:
            return v  # type: ignore[return-value]
        created = factory()
        self.set(key, created)
        return created