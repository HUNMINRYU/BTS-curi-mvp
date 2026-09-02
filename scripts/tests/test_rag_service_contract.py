"""Ensure systemd resolves both runtime files through one current bundle."""

from __future__ import annotations

import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]


class RagServiceContractTests(unittest.TestCase):
    def test_index_and_chunks_share_current_bundle_pointer(self) -> None:
        service = (REPOSITORY / "scripts/curi-rag.service").read_text(encoding="utf-8")

        self.assertIn("Environment=CURI_RAG_BUNDLE_PATH=/var/lib/curi/rag/state/current", service)
        self.assertIn("Environment=CURI_RAG_INDEX_PATH=/var/lib/curi/rag/state/current/index.faiss", service)
        self.assertIn("Environment=CURI_RAG_CHUNKS_PATH=/var/lib/curi/rag/state/current/chunks.jsonl", service)


if __name__ == "__main__":
    unittest.main()
