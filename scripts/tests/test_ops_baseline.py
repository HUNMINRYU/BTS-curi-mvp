"""Characterize deployment and sidecar seams before rollback safeguards change them."""

from __future__ import annotations

import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]


class DeploymentBaselineTests(unittest.TestCase):
    def test_workflow_uploads_timestamped_release_then_checks_login_readiness(self) -> None:
        workflow = (REPOSITORY / ".github/workflows/deploy-ec2.yml").read_text(encoding="utf-8")

        self.assertIn('release="$(date -u +%Y%m%dT%H%M%SZ)"', workflow)
        self.assertIn('rsync -az --delete', workflow)
        self.assertIn('http://127.0.0.1:3000/login', workflow)
        self.assertIn('sudo systemctl restart curi', workflow)

    def test_sidecar_keeps_index_and_chunks_path_override_seam(self) -> None:
        sidecar = (REPOSITORY / "scripts/rag_sidecar.py").read_text(encoding="utf-8")

        self.assertIn('DEFAULT_INDEX_PATH = "/var/lib/curi/rag/index.faiss"', sidecar)
        self.assertIn('DEFAULT_CHUNKS_PATH = "/var/lib/curi/rag/chunks.jsonl"', sidecar)
        self.assertIn('os.environ.get("CURI_RAG_INDEX_PATH", DEFAULT_INDEX_PATH)', sidecar)
        self.assertIn('os.environ.get("CURI_RAG_CHUNKS_PATH", DEFAULT_CHUNKS_PATH)', sidecar)


if __name__ == "__main__":
    unittest.main()
