"""Failing-first contract tests for immutable, versioned RAG bundles."""

from __future__ import annotations

import hashlib
import json
import os
import selectors
import signal
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]
BUNDLE_SCRIPT = REPOSITORY / "scripts/rag-bundle.py"
FAKE_RUNTIME = REPOSITORY / "scripts/tests/fixtures/fake_runtime"
DIMENSIONS = 512
MODEL_ID = "amazon.titan-embed-text-v2:0"
SOURCE_PREFIX = "s3://fixture-bucket/documents/"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_bundle(
    root: Path,
    release_id: str,
    *,
    count: int = 5,
    index_count: int | None = None,
    dimensions: int = DIMENSIONS,
) -> Path:
    bundle = root / "bundles" / release_id
    bundle.mkdir(parents=True)
    total = count if index_count is None else index_count
    vectors = [[1.0] + [0.0] * (dimensions - 1) for _ in range(total)]
    index = bundle / "index.faiss"
    index.write_text(json.dumps({"dimensions": dimensions, "vectors": vectors}), encoding="utf-8")
    chunks = bundle / "chunks.jsonl"
    chunks.write_text(
        "".join(
            json.dumps({
                "courseId": "fixture-course",
                "courseName": "Fixture",
                "department": "Test",
                "text": f"Fixture record {number}",
                "s3Uri": f"{SOURCE_PREFIX}fixture.pdf",
                "week": number,
            }, separators=(",", ":")) + "\n"
            for number in range(count)
        ),
        encoding="utf-8",
    )
    (bundle / "manifest.json").write_text(
        json.dumps({
            "schemaVersion": 1,
            "bundleId": release_id,
            "modelId": MODEL_ID,
            "sourcePrefix": SOURCE_PREFIX,
            "index": {"sha256": sha256(index), "dimensions": dimensions, "count": total},
            "chunks": {"sha256": sha256(chunks), "count": count},
        }, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return bundle


class RagBundleTests(unittest.TestCase):
    def run_bundle(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        environment = os.environ.copy()
        environment["PYTHONPATH"] = str(FAKE_RUNTIME) + os.pathsep + environment.get("PYTHONPATH", "")
        return subprocess.run(
            [sys.executable, str(BUNDLE_SCRIPT), *arguments],
            cwd=REPOSITORY,
            env=environment,
            text=True,
            capture_output=True,
            timeout=10,
            check=False,
        )

    def test_mismatched_candidate_never_replaces_current_pointer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = make_bundle(root, "release-one")
            activated = self.run_bundle("activate", "--root", str(root), "--release-id", "release-one")
            self.assertEqual(activated.returncode, 0, activated.stderr)
            self.assertEqual(self.visible_pair(root), (first.name, None))

            candidate = make_bundle(root, "release-two")
            with (candidate / "chunks.jsonl").open("a", encoding="utf-8") as output:
                output.write("{}\n")

            rejected = self.run_bundle("activate", "--root", str(root), "--release-id", "release-two")
            self.assertNotEqual(rejected.returncode, 0)
            self.assertEqual(self.visible_pair(root), (first.name, None))

    def test_count_mismatch_never_replaces_current_pointer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = make_bundle(root, "release-one")
            self.assertEqual(
                self.run_bundle("activate", "--root", str(root), "--release-id", "release-one").returncode,
                0,
            )
            make_bundle(root, "release-two", count=5, index_count=4)

            rejected = self.run_bundle("activate", "--root", str(root), "--release-id", "release-two")
            self.assertNotEqual(rejected.returncode, 0)
            self.assertEqual(self.visible_pair(root), (first.name, None))

    def test_manifest_dimension_mismatch_never_replaces_current_pointer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = make_bundle(root, "release-one")
            self.assertEqual(
                self.run_bundle("activate", "--root", str(root), "--release-id", "release-one").returncode,
                0,
            )
            make_bundle(root, "release-two", dimensions=DIMENSIONS - 1)

            rejected = self.run_bundle("activate", "--root", str(root), "--release-id", "release-two")
            self.assertNotEqual(rejected.returncode, 0)
            self.assertEqual(self.visible_pair(root), (first.name, None))

    def test_manifest_command_records_hashes_counts_and_dimensions_once(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bundle = make_bundle(root, "release-one")
            (bundle / "manifest.json").unlink()

            created = self.run_bundle(
                "create-manifest", "--root", str(root), "--release-id", "release-one",
                "--model-id", MODEL_ID, "--source-prefix", SOURCE_PREFIX,
            )
            self.assertEqual(created.returncode, 0, created.stderr)
            manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["index"]["dimensions"], DIMENSIONS)
            self.assertEqual(manifest["index"]["count"], 5)
            self.assertEqual(manifest["chunks"]["count"], 5)
            duplicate = self.run_bundle(
                "create-manifest", "--root", str(root), "--release-id", "release-one",
                "--model-id", MODEL_ID, "--source-prefix", SOURCE_PREFIX,
            )
            self.assertNotEqual(duplicate.returncode, 0)

    def visible_pair(self, root: Path) -> tuple[str, str | None]:
        state = root / "state"
        if state.is_symlink():
            state_directory = state.resolve()
            current = state_directory / "current"
            self.assertTrue(current.is_symlink(), "state has no current pointer")
            previous = state_directory / "previous"
            return current.resolve().name, previous.resolve().name if previous.exists() else None

        # The fallback makes the test a regression reproduction for the old
        # two-live-pointer layout as well as the state-generation layout.
        current = root / "current"
        self.assertTrue(current.is_symlink(), "current pointer is missing")
        previous = root / "previous"
        return current.resolve().name, previous.resolve().name if previous.exists() else None

    def interrupt_after_first_replace(self, root: Path, *arguments: str) -> None:
        injection_directory = root / "interruption"
        injection_directory.mkdir()
        (injection_directory / "sitecustomize.py").write_text(
            """import os
import signal

original_replace = os.replace

def replace(source, destination, *arguments, **keywords):
    result = original_replace(source, destination, *arguments, **keywords)
    os.write(int(os.environ[\"RAG_BUNDLE_INTERRUPT_FD\"]), b\"replaced\\n\")
    signal.pause()
    return result

os.replace = replace
""",
            encoding="utf-8",
        )
        read_descriptor, write_descriptor = os.pipe()
        os.set_inheritable(write_descriptor, True)
        environment = os.environ.copy()
        environment["PYTHONPATH"] = (
            str(injection_directory)
            + os.pathsep
            + str(FAKE_RUNTIME)
            + os.pathsep
            + environment.get("PYTHONPATH", "")
        )
        environment["RAG_BUNDLE_INTERRUPT_FD"] = str(write_descriptor)
        process = subprocess.Popen(
            [sys.executable, str(BUNDLE_SCRIPT), *arguments],
            cwd=REPOSITORY,
            env=environment,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            pass_fds=(write_descriptor,),
            start_new_session=True,
        )
        os.close(write_descriptor)
        selector = selectors.DefaultSelector()
        try:
            selector.register(read_descriptor, selectors.EVENT_READ)
            events = selector.select(5)
            self.assertTrue(events, "activation did not reach an atomic pointer replacement")
            self.assertEqual(os.read(read_descriptor, 32), b"replaced\n")
            os.killpg(process.pid, signal.SIGTERM)
            stdout, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, -signal.SIGTERM, stdout + stderr)
        finally:
            selector.close()
            os.close(read_descriptor)
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate(timeout=5)

    def assert_interruption_keeps_a_complete_pair(
        self,
        root: Path,
        before: tuple[str, str | None],
        after: tuple[str, str | None],
        *arguments: str,
    ) -> None:
        self.interrupt_after_first_replace(root, *arguments)
        observed = self.visible_pair(root)
        self.assertIn(observed, {before, after})
        self.assertNotEqual(observed[0], observed[1], "pointer pair became duplicated after interruption")

    def test_activation_and_rollback_preserve_both_version_directories(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = make_bundle(root, "release-one")
            second = make_bundle(root, "release-two")
            for release_id in ("release-one", "release-two"):
                activated = self.run_bundle("activate", "--root", str(root), "--release-id", release_id)
                self.assertEqual(activated.returncode, 0, activated.stderr)

            self.assertEqual(self.visible_pair(root), ("release-two", "release-one"))
            rolled_back = self.run_bundle("rollback", "--root", str(root))
            self.assertEqual(rolled_back.returncode, 0, rolled_back.stderr)
            self.assertEqual(self.visible_pair(root), ("release-one", "release-two"))
            self.assertTrue(first.is_dir())
            self.assertTrue(second.is_dir())

    def test_sigterm_during_activation_keeps_the_old_or_new_complete_pair(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            make_bundle(root, "release-one")
            make_bundle(root, "release-two")
            initial = self.run_bundle("activate", "--root", str(root), "--release-id", "release-one")
            self.assertEqual(initial.returncode, 0, initial.stderr)

            self.assert_interruption_keeps_a_complete_pair(
                root,
                ("release-one", None),
                ("release-two", "release-one"),
                "activate", "--root", str(root), "--release-id", "release-two",
            )

    def test_sigterm_during_rollback_keeps_the_old_or_new_complete_pair(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            make_bundle(root, "release-one")
            make_bundle(root, "release-two")
            for release_id in ("release-one", "release-two"):
                activated = self.run_bundle("activate", "--root", str(root), "--release-id", release_id)
                self.assertEqual(activated.returncode, 0, activated.stderr)

            self.assert_interruption_keeps_a_complete_pair(
                root,
                ("release-two", "release-one"),
                ("release-one", "release-two"),
                "rollback", "--root", str(root),
            )

    def test_stale_or_missing_state_target_is_rejected_without_replacing_it(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            make_bundle(root, "release-one")
            make_bundle(root, "release-two")
            activated = self.run_bundle("activate", "--root", str(root), "--release-id", "release-one")
            self.assertEqual(activated.returncode, 0, activated.stderr)

            stale_generation = "a" * 32
            stale = root / "states" / stale_generation
            stale.mkdir()
            os.symlink("../../bundles/missing-release", stale / "current")
            (root / "state").unlink()
            os.symlink(f"states/{stale_generation}", root / "state")
            stale_target = os.readlink(root / "state")
            rejected_stale = self.run_bundle("activate", "--root", str(root), "--release-id", "release-two")
            self.assertNotEqual(rejected_stale.returncode, 0)
            self.assertEqual(os.readlink(root / "state"), stale_target)

            (root / "state").unlink()
            missing_target = "b" * 32
            os.symlink(f"states/{missing_target}", root / "state")
            rejected_missing = self.run_bundle("rollback", "--root", str(root))
            self.assertNotEqual(rejected_missing.returncode, 0)
            self.assertEqual(os.readlink(root / "state"), f"states/{missing_target}")


if __name__ == "__main__":
    unittest.main()
