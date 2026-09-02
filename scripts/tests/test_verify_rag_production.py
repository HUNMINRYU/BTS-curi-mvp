"""Fixture-backed parser and read-only shell contract tests for production RAG verification."""

from __future__ import annotations

import json
import os
import signal
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]
VERIFIER = REPOSITORY / "scripts/verify-rag-production.sh"
PARSER = REPOSITORY / "scripts/verify_rag_production.py"
FIXTURES = REPOSITORY / "scripts/tests/fixtures/verify_rag"
INDEX_HASH = "a" * 64
CHUNKS_HASH = "b" * 64


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")


def make_parser_inputs(root: Path, *, index_count: int = 458, chunks_count: int = 458) -> dict[str, Path]:
    files = {
        "public_access": root / "public-access.json",
        "encryption": root / "encryption.json",
        "versioning": root / "versioning.json",
        "objects": root / "objects.json",
        "hashes": root / "hashes.txt",
        "metadata": root / "metadata.json",
        "health": root / "health.json",
        "retrieve": root / "retrieve.json",
    }
    for fixture, destination in (
        ("public-access.json", files["public_access"]),
        ("encryption.json", files["encryption"]),
        ("versioning.json", files["versioning"]),
        ("health.json", files["health"]),
        ("retrieve.json", files["retrieve"]),
    ):
        destination.write_text((FIXTURES / fixture).read_text(encoding="utf-8"), encoding="utf-8")
    write_json(
        files["objects"],
        {"Contents": [
            item
            for number in range(77)
            for item in (
                {"Key": f"documents/course-{number}.pdf"},
                {"Key": f"documents/course-{number}.pdf.metadata.json"},
            )
        ]},
    )
    files["hashes"].write_text(
        f"{INDEX_HASH}  /var/lib/curi/rag/state/current/index.faiss\n"
        f"{CHUNKS_HASH}  /var/lib/curi/rag/state/current/chunks.jsonl\n",
        encoding="utf-8",
    )
    write_json(files["metadata"], {
        "dimensions": 512,
        "indexCount": index_count,
        "chunksCount": chunks_count,
        "courseIds": 77,
        "sourcePrefixMatches": True,
        "probeCourseId": "fixture-course",
    })
    return files


class VerifyRagProductionTests(unittest.TestCase):
    def run_parser(self, files: dict[str, Path], *, index_hash: str = INDEX_HASH, chunks_hash: str = CHUNKS_HASH) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable, str(PARSER), "report",
                "--bucket", "fixture-bucket",
                "--expected-index-sha256", index_hash,
                "--expected-chunks-sha256", chunks_hash,
                "--public-access", str(files["public_access"]),
                "--encryption", str(files["encryption"]),
                "--versioning", str(files["versioning"]),
                "--objects", str(files["objects"]),
                "--hashes", str(files["hashes"]),
                "--metadata", str(files["metadata"]),
                "--health", str(files["health"]),
                "--retrieve", str(files["retrieve"]),
            ],
            cwd=REPOSITORY,
            text=True,
            capture_output=True,
            timeout=10,
            check=False,
        )

    def assert_report_schema(self, report: object) -> None:
        self.assertIsInstance(report, dict)
        assert isinstance(report, dict)
        self.assertEqual(set(report), {"settings", "counts", "hashes", "booleans"})
        self.assertTrue(all(isinstance(value, (str, int)) and not isinstance(value, bool) for value in report["settings"].values()))
        self.assertTrue(all(isinstance(value, int) and not isinstance(value, bool) for value in report["counts"].values()))
        self.assertTrue(all(isinstance(value, str) for value in report["hashes"].values()))
        self.assertTrue(all(isinstance(value, bool) for value in report["booleans"].values()))

    def test_parser_accepts_complete_fixture_report(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            completed = self.run_parser(make_parser_inputs(Path(temporary)))

        self.assertEqual(completed.returncode, 0, completed.stderr)
        report = json.loads(completed.stdout)
        self.assert_report_schema(report)
        self.assertTrue(report["booleans"]["checksPassed"])
        self.assertEqual(report["counts"], {
            "pdf": 77,
            "metadata": 77,
            "index": 458,
            "chunks": 458,
            "courseIds": 77,
            "retrieveResults": 5,
        })

    def test_wrong_counts_or_hashes_fail_with_schema_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            files = make_parser_inputs(Path(temporary), index_count=457)
            wrong_count = self.run_parser(files)
            wrong_hash = self.run_parser(files, index_hash="c" * 64)

        for completed in (wrong_count, wrong_hash):
            self.assertNotEqual(completed.returncode, 0)
            report = json.loads(completed.stdout)
            self.assert_report_schema(report)
            self.assertFalse(report["booleans"]["checksPassed"])

    def test_shell_uses_fixture_backed_read_only_probes_and_emits_only_json(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            files = make_parser_inputs(root)
            fixture_directory = root / "fixture-data"
            fixture_directory.mkdir()
            for name, path in files.items():
                (fixture_directory / path.name).write_bytes(path.read_bytes())
            bin_directory = root / "bin"
            bin_directory.mkdir()
            self.write_stub(bin_directory / "aws", """#!/usr/bin/env bash
case "$*" in
  *get-public-access-block*) cat "$VERIFY_FIXTURE_DIR/public-access.json" ;;
  *get-bucket-encryption*) cat "$VERIFY_FIXTURE_DIR/encryption.json" ;;
  *get-bucket-versioning*) cat "$VERIFY_FIXTURE_DIR/versioning.json" ;;
  *list-objects-v2*) cat "$VERIFY_FIXTURE_DIR/objects.json" ;;
  *) exit 64 ;;
esac
""")
            self.write_stub(bin_directory / "ssh", """#!/usr/bin/env bash
case "$*" in
  *sha256sum*) cat "$VERIFY_FIXTURE_DIR/hashes.txt" ;;
  *"python3 -"*) cat "$VERIFY_FIXTURE_DIR/metadata.json" ;;
  */health*) cat "$VERIFY_FIXTURE_DIR/health.json" ;;
  */retrieve*) cat "$VERIFY_FIXTURE_DIR/retrieve.json" ;;
  *) exit 64 ;;
esac
""")
            key = root / "fixture-key"
            key.write_text("fixture only\n", encoding="utf-8")
            environment = os.environ.copy()
            environment.update({
                "PATH": str(bin_directory) + os.pathsep + environment["PATH"],
                "VERIFY_FIXTURE_DIR": str(fixture_directory),
                "CURI_DOCUMENT_BUCKET": "fixture-bucket",
                "CURI_EC2_HOST": "fixture.example",
                "CURI_EC2_KEY": str(key),
                "EXPECTED_INDEX_SHA256": INDEX_HASH,
                "EXPECTED_CHUNKS_SHA256": CHUNKS_HASH,
            })
            completed = subprocess.run(
                ["bash", str(VERIFIER)],
                cwd=REPOSITORY,
                env=environment,
                text=True,
                capture_output=True,
                timeout=15,
                check=False,
            )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        report = json.loads(completed.stdout)
        self.assert_report_schema(report)
        self.assertTrue(report["booleans"]["checksPassed"])
        self.assertEqual(completed.stderr, "")

    def test_hanging_ssh_exits_before_the_remote_command_deadline(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            files = make_parser_inputs(root)
            fixture_directory = root / "fixture-data"
            fixture_directory.mkdir()
            for name, path in files.items():
                (fixture_directory / path.name).write_bytes(path.read_bytes())
            bin_directory = root / "bin"
            bin_directory.mkdir()
            self.write_stub(bin_directory / "aws", """#!/usr/bin/env bash
case "$*" in
  *get-public-access-block*) cat "$VERIFY_FIXTURE_DIR/public-access.json" ;;
  *get-bucket-encryption*) cat "$VERIFY_FIXTURE_DIR/encryption.json" ;;
  *get-bucket-versioning*) cat "$VERIFY_FIXTURE_DIR/versioning.json" ;;
  *list-objects-v2*) cat "$VERIFY_FIXTURE_DIR/objects.json" ;;
  *) exit 64 ;;
esac
""")
            self.write_stub(bin_directory / "ssh", """#!/usr/bin/env bash
printf '%s\\n' "$$" > "$VERIFY_HANG_PID_FILE"
exec sleep 60
""")
            key = root / "fixture-key"
            key.write_text("SENTINEL_KEY_MATERIAL", encoding="utf-8")
            hanging_ssh_pid_file = root / "hanging-ssh.pid"
            environment = os.environ.copy()
            environment.update({
                "PATH": str(bin_directory) + os.pathsep + environment["PATH"],
                "VERIFY_FIXTURE_DIR": str(fixture_directory),
                "CURI_DOCUMENT_BUCKET": "fixture-bucket",
                "CURI_EC2_HOST": "fixture.example",
                "CURI_EC2_KEY": str(key),
                "EXPECTED_INDEX_SHA256": INDEX_HASH,
                "EXPECTED_CHUNKS_SHA256": CHUNKS_HASH,
                "CURI_RAG_REMOTE_COMMAND_TIMEOUT_SECONDS": "1",
                "VERIFY_HANG_PID_FILE": str(hanging_ssh_pid_file),
            })
            started = time.monotonic()
            process = subprocess.Popen(
                ["bash", str(VERIFIER)],
                cwd=REPOSITORY,
                env=environment,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True,
            )
            try:
                stdout, stderr = process.communicate(timeout=4)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.communicate(timeout=2)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.communicate(timeout=2)
                self.fail("verifier did not apply a deadline to the hanging SSH command")
            elapsed = time.monotonic() - started
            self.assertTrue(hanging_ssh_pid_file.is_file(), "fixture SSH did not start")
            hanging_ssh_pid = int(hanging_ssh_pid_file.read_text(encoding="utf-8").strip())
            try:
                os.kill(hanging_ssh_pid, 0)
            except ProcessLookupError:
                fixture_sleep_gone = True
            else:
                fixture_sleep_gone = False
                os.kill(hanging_ssh_pid, signal.SIGKILL)

        self.assertNotEqual(process.returncode, 0)
        self.assertLess(elapsed, 3, f"hanging SSH exceeded its deadline ({elapsed:.3f}s)")
        self.assertTrue(fixture_sleep_gone, "deadline left the fixture SSH process alive")
        self.assert_report_schema(json.loads(stdout))
        self.assertFalse(json.loads(stdout)["booleans"]["checksPassed"])
        self.assertNotIn("SENTINEL_KEY_MATERIAL", stdout + stderr)

    def test_sigterm_ignoring_ssh_child_leaves_no_process_group_members(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake_ssh = root / "fake-ssh"
            group_file = root / "process-group.txt"
            fake_ssh.write_text(
                """#!/usr/bin/env python3
import os
import signal

read_fd, write_fd = os.pipe()
child_pid = os.fork()
if child_pid == 0:
    os.close(read_fd)
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    os.write(write_fd, b"ready")
    os.close(write_fd)
    os.execlp("sleep", "sleep", "60")

os.close(write_fd)
if os.read(read_fd, 5) != b"ready":
    raise RuntimeError("child did not initialize")
os.close(read_fd)
with open(os.environ["VERIFY_GROUP_FILE"], "w", encoding="ascii") as record:
    record.write(f"{os.getpgrp()} {child_pid}\\n")
os.execlp("sleep", "sleep", "60")
""",
                encoding="utf-8",
            )
            fake_ssh.chmod(0o755)
            environment = os.environ.copy()
            environment["VERIFY_GROUP_FILE"] = str(group_file)
            deadline = subprocess.Popen(
                [
                    sys.executable,
                    str(REPOSITORY / "scripts/run-with-deadline.py"),
                    "--seconds",
                    "1",
                    "--",
                    str(fake_ssh),
                ],
                cwd=REPOSITORY,
                env=environment,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            returncode: int | None = None
            recorded_group: int | None = None
            members: set[int] = set()
            try:
                returncode = deadline.wait(timeout=4)
                self.assertTrue(group_file.is_file(), "fake SSH did not record its process group")
                recorded_group = int(group_file.read_text(encoding="ascii").split()[0])
                listing = subprocess.run(
                    ["ps", "-axo", "pid=,pgid="],
                    text=True,
                    capture_output=True,
                    timeout=5,
                    check=True,
                )
                for line in listing.stdout.splitlines():
                    fields = line.split()
                    if len(fields) >= 2 and fields[1] == str(recorded_group):
                        members.add(int(fields[0]))
            finally:
                if deadline.poll() is None:
                    _ = deadline.kill()
                    _ = deadline.wait(timeout=2)
                if recorded_group is None and group_file.is_file():
                    recorded_group = int(group_file.read_text(encoding="ascii").split()[0])
                if recorded_group is not None:
                    try:
                        _ = os.killpg(recorded_group, signal.SIGKILL)
                    except ProcessLookupError:
                        pass

        self.assertEqual(returncode, 124)
        self.assertFalse(
            members,
            f"process group {recorded_group} still has members after the deadline: {sorted(members)}",
        )

    def test_secret_sentinel_values_are_not_rendered_on_invalid_input(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            key = Path(temporary) / "SENTINEL_PRIVATE_KEY"
            key.write_text("SENTINEL_KEY_MATERIAL", encoding="utf-8")
            environment = os.environ.copy()
            environment.update({
                "CURI_DOCUMENT_BUCKET": "fixture-bucket",
                "CURI_EC2_HOST": "fixture.example",
                "CURI_EC2_KEY": str(key),
                "EXPECTED_INDEX_SHA256": "SENTINEL_EXPECTED_INDEX",
                "EXPECTED_CHUNKS_SHA256": "SENTINEL_EXPECTED_CHUNKS",
            })
            completed = subprocess.run(
                ["bash", str(VERIFIER)],
                cwd=REPOSITORY,
                env=environment,
                text=True,
                capture_output=True,
                timeout=10,
                check=False,
            )

        self.assertNotEqual(completed.returncode, 0)
        self.assert_report_schema(json.loads(completed.stdout))
        rendered = completed.stdout + completed.stderr
        self.assertNotIn("SENTINEL_PRIVATE_KEY", rendered)
        self.assertNotIn("SENTINEL_KEY_MATERIAL", rendered)
        self.assertNotIn("SENTINEL_EXPECTED_INDEX", rendered)
        self.assertNotIn("SENTINEL_EXPECTED_CHUNKS", rendered)

    def test_shell_contains_only_read_only_remote_and_s3_operations(self) -> None:
        source = VERIFIER.read_text(encoding="utf-8")

        for command in (
            "s3api get-public-access-block",
            "s3api get-bucket-encryption",
            "s3api get-bucket-versioning",
            "s3api list-objects-v2",
            "sha256sum",
            "curl --fail",
        ):
            self.assertIn(command, source)
        self.assertNotIn("aws s3 cp", source)
        self.assertNotIn("aws s3 sync", source)
        self.assertNotIn("scp ", source)
        self.assertNotIn("rsync ", source)

    @staticmethod
    def write_stub(path: Path, source: str) -> None:
        path.write_text(source, encoding="utf-8")
        path.chmod(path.stat().st_mode | stat.S_IXUSR)


if __name__ == "__main__":
    unittest.main()
