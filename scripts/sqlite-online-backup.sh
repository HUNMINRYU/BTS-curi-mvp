#!/usr/bin/env bash
# Create an SQLite online-backup API snapshot named for one app release.
set -euo pipefail
umask 077

usage() {
  printf '%s\n' 'usage: sqlite-online-backup.sh --release-id ID --source DATABASE --backup-dir DIRECTORY' >&2
}

release_id=''
source_database=''
backup_dir=''
while (($#)); do
  case "$1" in
    --release-id)
      release_id="${2:-}"
      shift 2
      ;;
    --source)
      source_database="${2:-}"
      shift 2
      ;;
    --backup-dir)
      backup_dir="${2:-}"
      shift 2
      ;;
    *)
      usage
      exit 64
      ;;
  esac
done

if [[ ! "$release_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || [[ -z "$source_database" || -z "$backup_dir" ]]; then
  usage
  exit 64
fi
if [[ ! -f "$source_database" ]]; then
  printf '%s\n' 'source database is not a regular file' >&2
  exit 1
fi
if ! command -v sqlite3 >/dev/null 2>&1; then
  printf '%s\n' 'sqlite3 is required for an online backup' >&2
  exit 1
fi

backup_path="$backup_dir/$release_id.sqlite"
if [[ -e "$backup_path" || -L "$backup_path" ]]; then
  printf '%s\n' 'release backup already exists and is immutable' >&2
  exit 1
fi

mkdir -p "$backup_dir"
escaped_backup_path=${backup_path//\'/\'\'}
sqlite3 -readonly "$source_database" ".backup '$escaped_backup_path'"
readonly_backup_uri="file:$backup_path?immutable=1"
integrity_check="$(sqlite3 -readonly "$readonly_backup_uri" 'PRAGMA integrity_check;')"
if [[ "$integrity_check" != 'ok' ]]; then
  printf '%s\n' 'backup integrity_check did not return ok' >&2
  exit 1
fi

python3 - "$release_id" "$backup_path" <<'PY'
import json
import sys

print(json.dumps({
    "releaseId": sys.argv[1],
    "backupPath": sys.argv[2],
    "integrityCheck": "ok",
}, separators=(",", ":")))
PY
