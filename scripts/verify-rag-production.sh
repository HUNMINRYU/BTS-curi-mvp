#!/usr/bin/env bash
# Read-only S3, SSH, metadata, and loopback verification for the live RAG bundle.
set -euo pipefail

script_directory="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
parser="$script_directory/verify_rag_production.py"
deadline_runner="$script_directory/run-with-deadline.py"
remote_command_timeout_seconds="${CURI_RAG_REMOTE_COMMAND_TIMEOUT_SECONDS:-30}"
work_directory=''

cleanup() {
  if [[ -n "$work_directory" ]]; then
    rm -rf "$work_directory"
  fi
}
trap cleanup EXIT

emit_failure() {
  python3 "$parser" failure
  exit 1
}

bucket="${CURI_DOCUMENT_BUCKET:-}"
host="${CURI_EC2_HOST:-}"
key="${CURI_EC2_KEY:-}"
expected_index="${EXPECTED_INDEX_SHA256:-}"
expected_chunks="${EXPECTED_CHUNKS_SHA256:-}"
if [[ ! "$bucket" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] \
  || [[ ! "$host" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]*$ ]] \
  || [[ ! "$expected_index" =~ ^[0-9A-Fa-f]{64}$ ]] \
  || [[ ! "$expected_chunks" =~ ^[0-9A-Fa-f]{64}$ ]] \
  || [[ ! -f "$key" || ! -r "$key" ]]; then
  emit_failure
fi
if [[ ! -f "$parser" || ! -f "$deadline_runner" ]]; then
  emit_failure
fi
case "$remote_command_timeout_seconds" in
  [1-9]|[1-9][0-9]|[12][0-9][0-9]|300) ;;
  *) emit_failure ;;
esac

work_directory="$(mktemp -d "${TMPDIR:-/tmp}/curi-rag-verify.XXXXXX")"
capture() {
  local output="$1"
  shift
  "$@" >"$output" 2>"$work_directory/command.stderr"
}

if ! capture "$work_directory/public-access.json" aws --no-cli-pager --cli-connect-timeout 10 --cli-read-timeout 20 s3api get-public-access-block --bucket "$bucket" --output json; then
  emit_failure
fi
if ! capture "$work_directory/encryption.json" aws --no-cli-pager --cli-connect-timeout 10 --cli-read-timeout 20 s3api get-bucket-encryption --bucket "$bucket" --output json; then
  emit_failure
fi
if ! capture "$work_directory/versioning.json" aws --no-cli-pager --cli-connect-timeout 10 --cli-read-timeout 20 s3api get-bucket-versioning --bucket "$bucket" --output json; then
  emit_failure
fi
if ! capture "$work_directory/objects.json" aws --no-cli-pager --cli-connect-timeout 10 --cli-read-timeout 20 s3api list-objects-v2 --bucket "$bucket" --prefix documents/ --output json; then
  emit_failure
fi

ssh_command=(
  ssh
  -i "$key"
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=accept-new
  -o "UserKnownHostsFile=$work_directory/known_hosts"
  "ubuntu@$host"
)
run_ssh() {
  python3 "$deadline_runner" --seconds "$remote_command_timeout_seconds" -- "${ssh_command[@]}" "$@"
}

capture_ssh() {
  local output="$1"
  local command="$2"
  run_ssh "$command" >"$output" 2>"$work_directory/command.stderr"
}

index_path='/var/lib/curi/rag/state/current/index.faiss'
chunks_path='/var/lib/curi/rag/state/current/chunks.jsonl'
if ! capture_ssh "$work_directory/hashes.txt" "sha256sum -- '$index_path' '$chunks_path'"; then
  emit_failure
fi
cat >"$work_directory/read-metadata.py" <<'PY'
import json
import re
import sys
from pathlib import Path

import faiss

index_path, chunks_path, bucket = sys.argv[1:]
prefix = f"s3://{bucket}/documents/"
course_pattern = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
index = faiss.read_index(index_path)
course_counts = {}
source_prefix_matches = True
chunks_count = 0
with Path(chunks_path).open(encoding="utf-8") as source:
    for line in source:
        if not line.strip():
            raise ValueError("blank JSONL record")
        record = json.loads(line)
        if not isinstance(record, dict):
            raise ValueError("non-object JSONL record")
        course_id = record.get("courseId")
        source_uri = record.get("s3Uri")
        if not isinstance(course_id, str) or not course_pattern.fullmatch(course_id):
            raise ValueError("invalid course ID")
        if not isinstance(source_uri, str) or not source_uri.startswith(prefix):
            source_prefix_matches = False
        course_counts[course_id] = course_counts.get(course_id, 0) + 1
        chunks_count += 1
probe_course_id = next((course for course in sorted(course_counts) if course_counts[course] >= 5), "")
print(json.dumps({
    "dimensions": int(index.d),
    "indexCount": int(index.ntotal),
    "chunksCount": chunks_count,
    "courseIds": len(course_counts),
    "sourcePrefixMatches": source_prefix_matches,
    "probeCourseId": probe_course_id,
}, separators=(",", ":")))
PY
if ! run_ssh "python3 - '$index_path' '$chunks_path' '$bucket'" <"$work_directory/read-metadata.py" >"$work_directory/metadata.json" 2>"$work_directory/command.stderr"; then
  emit_failure
fi
if ! probe_course_id="$(python3 "$parser" probe-course --metadata "$work_directory/metadata.json" 2>"$work_directory/command.stderr")"; then
  emit_failure
fi
if ! capture_ssh "$work_directory/health.json" 'curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8788/health'; then
  emit_failure
fi
retrieve_payload="$(printf '{"courseId":"%s","question":"production verification","numberOfResults":5}' "$probe_course_id")"
if ! capture_ssh "$work_directory/retrieve.json" "curl --fail --silent --show-error --max-time 10 --request POST --header 'content-type: application/json' --data '$retrieve_payload' http://127.0.0.1:8788/retrieve"; then
  emit_failure
fi

if ! python3 "$parser" report \
  --bucket "$bucket" \
  --expected-index-sha256 "$expected_index" \
  --expected-chunks-sha256 "$expected_chunks" \
  --public-access "$work_directory/public-access.json" \
  --encryption "$work_directory/encryption.json" \
  --versioning "$work_directory/versioning.json" \
  --objects "$work_directory/objects.json" \
  --hashes "$work_directory/hashes.txt" \
  --metadata "$work_directory/metadata.json" \
  --health "$work_directory/health.json" \
  --retrieve "$work_directory/retrieve.json"; then
  exit 1
fi
