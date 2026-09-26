"""Tiny in-process TTL cache so read endpoints don't hit the warehouse on every request
(and so the UI never waits on a Snowflake cold start). Not thread-heavy — fine for the demo."""
import time
from functools import wraps

from server.config import CACHE_TTL

_store: dict[str, tuple[float, object]] = {}


def cached(ttl: int = CACHE_TTL):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args):
            key = f"{fn.__name__}:{args}"
            hit = _store.get(key)
            now = time.time()
            if hit and now - hit[0] < ttl:
                return hit[1]
            val = fn(*args)
            _store[key] = (now, val)
            return val
        return wrapper
    return deco


def clear():
    _store.clear()
