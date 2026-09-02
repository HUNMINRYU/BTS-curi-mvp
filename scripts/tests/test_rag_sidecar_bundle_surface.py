"""Exercise a temporary sidecar through an activated current bundle without polling."""

from __future__ import annotations

import json
import os
import selectors
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from pathlib import Path

from scripts.tests.test_rag_bundle import FAKE_RUNTIME, REPOSITORY, make_bundle


class RagSidecarBundleSurfaceTests(unittest.TestCase):
    def test_activated_current_bundle_retrieves_exactly_five_records(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            make_bundle(root, "release-one")
            environment = os.environ.copy()
            environment["PYTHONPATH"] = str(FAKE_RUNTIME) + os.pathsep + environment.get("PYTHONPATH", "")
            activated = subprocess.run(
                [sys.executable, str(REPOSITORY / "scripts/rag-bundle.py"), "activate", "--root", str(root), "--release-id", "release-one"],
                cwd=REPOSITORY,
                env=environment,
                text=True,
                capture_output=True,
                timeout=10,
                check=False,
            )
            self.assertEqual(activated.returncode, 0, activated.stderr)
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as reserved:
                reserved.bind(("127.0.0.1", 0))
                port = reserved.getsockname()[1]
            environment.update({
                "CURI_RAG_BUNDLE_PATH": str(root / "state" / "current"),
                "CURI_RAG_HOST": "127.0.0.1",
                "CURI_RAG_PORT": str(port),
            })
            process = subprocess.Popen(
                [sys.executable, str(REPOSITORY / "scripts/rag_sidecar.py")],
                cwd=REPOSITORY,
                env=environment,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            selector = selectors.DefaultSelector()
            try:
                assert process.stdout is not None
                selector.register(process.stdout, selectors.EVENT_READ)
                deadline = time.monotonic() + 10
                while True:
                    remaining = deadline - time.monotonic()
                    self.assertGreater(remaining, 0, "sidecar readiness event did not arrive")
                    events = selector.select(remaining)
                    self.assertTrue(events, "sidecar readiness event did not arrive")
                    line = process.stdout.readline()
                    self.assertTrue(line, "sidecar exited before its readiness event")
                    if "CURI RAG sidecar listening" in line:
                        break
                request = urllib.request.Request(
                    f"http://127.0.0.1:{port}/retrieve",
                    data=json.dumps({
                        "courseId": "fixture-course",
                        "question": "fixture question",
                        "numberOfResults": 5,
                    }).encode("utf-8"),
                    headers={"content-type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(request, timeout=5) as response:
                    payload = json.loads(response.read())
                self.assertEqual(len(payload["results"]), 5)
                self.assertEqual({item["metadata"]["courseId"] for item in payload["results"]}, {"fixture-course"})
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=5) as response:
                    self.assertEqual(json.loads(response.read()), {"ok": True})
            finally:
                selector.close()
                if process.poll() is None:
                    process.terminate()
                try:
                    process.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate(timeout=5)


if __name__ == "__main__":
    unittest.main()
