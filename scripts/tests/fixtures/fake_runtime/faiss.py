"""Small FAISS-compatible fixture for operator-script tests."""

from __future__ import annotations

import json
from pathlib import Path


class Index:
    def __init__(self, dimensions: int, vectors: list[list[float]]) -> None:
        self.d = dimensions
        self.vectors = vectors
        self.ntotal = len(vectors)

    def reconstruct_n(self, start: int, count: int, output: list[list[float]]) -> None:
        for offset, vector in enumerate(self.vectors[start:start + count]):
            output[offset][:] = vector


def read_index(path: str) -> Index:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    dimensions = payload.get("dimensions")
    vectors = payload.get("vectors")
    if not isinstance(dimensions, int) or not isinstance(vectors, list):
        raise ValueError("invalid fake FAISS fixture")
    return Index(dimensions, vectors)
