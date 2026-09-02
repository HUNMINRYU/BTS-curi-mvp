"""WAL-safe SQLite online-backup operator contract tests."""

from __future__ import annotations

import json
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]
BACKUP_SCRIPT = REPOSITORY / "scripts/sqlite-online-backup.sh"


@unittest.skipUnless(shutil.which("sqlite3"), "sqlite3 CLI is required for the online-backup contract")
class SqliteOnlineBackupTests(unittest.TestCase):
    def run_backup(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(BACKUP_SCRIPT), *arguments],
            cwd=REPOSITORY,
            text=True,
            capture_output=True,
            timeout=15,
            check=False,
        )

    def test_wal_database_backup_is_readable_and_has_integrity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.sqlite"
            backups = root / "backups"
            connection = sqlite3.connect(source)
            try:
                self.assertEqual(connection.execute("PRAGMA journal_mode=WAL").fetchone()[0].lower(), "wal")
                connection.execute("CREATE TABLE release_rows (id INTEGER PRIMARY KEY, label TEXT NOT NULL)")
                connection.executemany(
                    "INSERT INTO release_rows (label) VALUES (?)",
                    [("first",), ("second",), ("third",)],
                )
                connection.commit()
                self.assertTrue((root / "source.sqlite-wal").exists())

                completed = self.run_backup(
                    "--release-id", "20260901T205327Z",
                    "--source", str(source),
                    "--backup-dir", str(backups),
                )
            finally:
                connection.close()

            self.assertEqual(completed.returncode, 0, completed.stderr)
            receipt = json.loads(completed.stdout)
            backup = backups / "20260901T205327Z.sqlite"
            self.assertEqual(receipt["releaseId"], "20260901T205327Z")
            self.assertEqual(Path(receipt["backupPath"]), backup)
            self.assertEqual(receipt["integrityCheck"], "ok")
            restored = sqlite3.connect(f"file:{backup}?mode=ro&immutable=1", uri=True)
            try:
                self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(restored.execute("SELECT COUNT(*) FROM release_rows").fetchone()[0], 3)
            finally:
                restored.close()

    def test_invalid_release_id_is_rejected_without_creating_a_backup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.sqlite"
            sqlite3.connect(source).close()
            completed = self.run_backup(
                "--release-id", "../../escape",
                "--source", str(source),
                "--backup-dir", str(root / "backups"),
            )

            self.assertNotEqual(completed.returncode, 0)
            self.assertFalse((root / "backups").exists())


if __name__ == "__main__":
    unittest.main()
