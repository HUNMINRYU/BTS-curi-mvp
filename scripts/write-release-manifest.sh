#!/usr/bin/env bash
# Write immutable deployment provenance from the checked-out Git object graph.
set -euo pipefail

if (($# > 1)); then
  printf '%s\n' 'usage: write-release-manifest.sh [OUTPUT]' >&2
  exit 64
fi

output_path="${1:-.curi-release.json}"
github_sha="${GITHUB_SHA:-}"
if [[ ! "$github_sha" =~ ^[0-9a-f]{40}$ ]]; then
  printf '%s\n' 'GITHUB_SHA must be a full lowercase commit SHA' >&2
  exit 1
fi
checkout_sha="$(git rev-parse --verify HEAD)"
if [[ "$github_sha" != "$checkout_sha" ]]; then
  printf '%s\n' 'GITHUB_SHA does not match the checked-out commit' >&2
  exit 1
fi
tree_sha="$(git rev-parse --verify 'HEAD^{tree}')"
output_directory="$(dirname "$output_path")"
if [[ ! -d "$output_directory" ]]; then
  printf '%s\n' 'manifest output directory does not exist' >&2
  exit 1
fi
if [[ -e "$output_path" || -L "$output_path" ]]; then
  printf '%s\n' 'release manifest already exists and is immutable' >&2
  exit 1
fi

temporary_path="$(mktemp "$output_directory/.curi-release.XXXXXX")"
cleanup() {
  rm -f "$temporary_path"
}
trap cleanup EXIT
python3 - "$temporary_path" "$checkout_sha" "$tree_sha" <<'PY'
import json
import sys
from pathlib import Path

Path(sys.argv[1]).write_text(json.dumps({
    "githubSha": sys.argv[2],
    "treeSha": sys.argv[3],
}, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
PY
mv "$temporary_path" "$output_path"
trap - EXIT
printf '%s\n' "wrote $output_path"
