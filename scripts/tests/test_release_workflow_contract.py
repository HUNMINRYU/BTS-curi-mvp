"""Failing-first release provenance and non-pruning contract tests."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPOSITORY = Path(__file__).resolve().parents[2]


class ReleaseWorkflowContractTests(unittest.TestCase):
    def test_release_manifest_is_created_before_upload_and_pruning_is_report_only(self) -> None:
        workflow = (REPOSITORY / ".github/workflows/deploy-ec2.yml").read_text(encoding="utf-8")

        manifest_call = workflow.index("scripts/write-release-manifest.sh")
        upload = workflow.index("- name: Upload release")
        self.assertLess(manifest_call, upload)
        self.assertIn("${{ github.sha }}", workflow)
        self.assertNotIn("rm -rf", workflow)
        self.assertIn("Manual cleanup candidates", workflow)

    def test_release_manifest_helper_exists(self) -> None:
        helper = REPOSITORY / "scripts/write-release-manifest.sh"
        self.assertTrue(helper.is_file())

    def test_manifest_records_checked_out_commit_and_tree(self) -> None:
        helper = REPOSITORY / "scripts/write-release-manifest.sh"
        with tempfile.TemporaryDirectory() as temporary:
            checkout = Path(temporary) / "checkout"
            checkout.mkdir()
            (checkout / "tracked.txt").write_text("release fixture\n", encoding="utf-8")
            for command in (
                ["git", "init", "--quiet"],
                ["git", "config", "user.email", "operator@example.test"],
                ["git", "config", "user.name", "Operator"],
                ["git", "add", "tracked.txt"],
                ["git", "commit", "--quiet", "-m", "fixture"],
            ):
                subprocess.run(command, cwd=checkout, check=True)
            checkout_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
            tree_sha = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=checkout, text=True).strip()
            environment = os.environ.copy()
            environment["GITHUB_SHA"] = checkout_sha
            completed = subprocess.run(
                ["bash", str(helper)],
                cwd=checkout,
                env=environment,
                text=True,
                capture_output=True,
                timeout=10,
                check=False,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            manifest = json.loads((checkout / ".curi-release.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest, {"githubSha": checkout_sha, "treeSha": tree_sha})


if __name__ == "__main__":
    unittest.main()
