"""Disjoint deterministic stream keys across seeds AND roles (not seed + 1)."""
import hashlib
import random


def stream_seed(seed: int, role: str) -> int:
    key = f"simurgencias:sha256-v1:{seed}:{role}".encode("utf-8")
    return int.from_bytes(hashlib.sha256(key).digest(), "big")


def random_stream(seed: int, role: str) -> random.Random:
    return random.Random(stream_seed(seed, role))
