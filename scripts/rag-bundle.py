#!/usr/bin/env python3
"""Validate, activate, and roll back immutable CURI RAG bundles.

Bundles live under ``bundles/`` and are never rewritten.  A prepared state
contains its ``current`` and optional ``previous`` bundle links beneath
``states/``.  Publishing a state is one atomic replacement of the ``state``
symlink, so readers of ``state/current`` and ``state/previous`` observe one
complete generation rather than an independently updated pointer pair.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import hmac
import json
import os
import re
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any, Iterator


SCHEMA_VERSION = 1
MODEL_ID = "amazon.titan-embed-text-v2:0"
EMBEDDING_DIMENSIONS = 512
RELEASE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
STATE_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
COURSE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REQUIRED_FILES = ("index.faiss", "chunks.jsonl", "manifest.json")
STATE_POINTER = "state"
STATE_DIRECTORY = "states"


class BundleError(ValueError):
    """A candidate cannot safely become the current RAG bundle."""


def release_id(value: str) -> str:
    if not RELEASE_ID_PATTERN.fullmatch(value):
        raise BundleError("release ID is invalid")
    return value


def state_id(value: str) -> str:
    if not STATE_ID_PATTERN.fullmatch(value):
        raise BundleError("state generation is invalid")
    return value


def require_root(value: str) -> Path:
    root = Path(value).expanduser()
    if not root.is_dir():
        raise BundleError("bundle root is not a directory")
    return root.resolve()


def bundles_directory(root: Path) -> Path:
    bundles = root / "bundles"
    if not bundles.is_dir() or bundles.is_symlink():
        raise BundleError("bundle root does not contain a real bundles directory")
    return bundles


def candidate_directory(root: Path, identifier: str) -> Path:
    bundles = bundles_directory(root)
    candidate = bundles / release_id(identifier)
    if not candidate.is_dir() or candidate.is_symlink():
        raise BundleError("candidate bundle directory is missing or is a symlink")
    return candidate


def required_file(bundle: Path, name: str) -> Path:
    path = bundle / name
    if not path.is_file() or path.is_symlink():
        raise BundleError(f"bundle {name} is missing or is a symlink")
    return path


def sha256_file(path: Path) -> str:
    before = path.stat()
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024 * 1024):
            digest.update(block)
    after = path.stat()
    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        raise BundleError(f"bundle {path.name} changed while it was validated")
    return digest.hexdigest()


def require_string(mapping: dict[str, Any], name: str) -> str:
    value = mapping.get(name)
    if not isinstance(value, str) or not value:
        raise BundleError(f"manifest {name} is invalid")
    return value


def require_integer(mapping: dict[str, Any], name: str) -> int:
    value = mapping.get(name)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise BundleError(f"manifest {name} is invalid")
    return value


def validate_source_prefix(value: str) -> str:
    if not value.startswith("s3://") or not value.endswith("/") or value == "s3://":
        raise BundleError("manifest sourcePrefix is invalid")
    return value


def load_manifest(path: Path, identifier: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BundleError("manifest is not valid JSON") from error
    if not isinstance(payload, dict) or payload.get("schemaVersion") != SCHEMA_VERSION:
        raise BundleError("manifest schemaVersion is invalid")
    if payload.get("bundleId") != identifier:
        raise BundleError("manifest bundleId does not match the release ID")
    if require_string(payload, "modelId") != MODEL_ID:
        raise BundleError("manifest modelId is unsupported")
    validate_source_prefix(require_string(payload, "sourcePrefix"))
    for name in ("index", "chunks"):
        section = payload.get(name)
        if not isinstance(section, dict):
            raise BundleError(f"manifest {name} is invalid")
        digest = require_string(section, "sha256")
        if not SHA256_PATTERN.fullmatch(digest):
            raise BundleError(f"manifest {name}.sha256 is invalid")
        require_integer(section, "count")
    index = payload["index"]
    assert isinstance(index, dict)
    dimensions = require_integer(index, "dimensions")
    if dimensions != EMBEDDING_DIMENSIONS:
        raise BundleError("manifest index.dimensions is invalid")
    return payload


def read_chunks(path: Path, source_prefix: str) -> tuple[int, set[str]]:
    count = 0
    course_ids: set[str] = set()
    try:
        with path.open("r", encoding="utf-8") as source:
            for number, line in enumerate(source, start=1):
                if not line.strip():
                    raise BundleError(f"chunks.jsonl has a blank record at line {number}")
                record = json.loads(line)
                if not isinstance(record, dict):
                    raise BundleError(f"chunks.jsonl has a non-object record at line {number}")
                course_id = record.get("courseId")
                text = record.get("text")
                source_uri = record.get("s3Uri")
                if not isinstance(course_id, str) or not COURSE_ID_PATTERN.fullmatch(course_id):
                    raise BundleError(f"chunks.jsonl has an invalid courseId at line {number}")
                if not isinstance(text, str) or not text.strip():
                    raise BundleError(f"chunks.jsonl has an invalid text record at line {number}")
                if not isinstance(source_uri, str) or not source_uri.startswith(source_prefix):
                    raise BundleError(f"chunks.jsonl source prefix differs at line {number}")
                count += 1
                course_ids.add(course_id)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BundleError("chunks.jsonl is not valid UTF-8 JSONL") from error
    if count < 1:
        raise BundleError("chunks.jsonl has no records")
    return count, course_ids


def read_index(path: Path) -> tuple[int, int]:
    try:
        import faiss

        index = faiss.read_index(str(path))
        dimensions = int(index.d)
        count = int(index.ntotal)
    except Exception as error:  # FAISS has implementation-specific parse errors.
        raise BundleError("index.faiss cannot be read") from error
    if dimensions != EMBEDDING_DIMENSIONS or count < 0:
        raise BundleError("index.faiss metadata is invalid")
    return dimensions, count


def inspect_bundle(root: Path, identifier: str) -> dict[str, Any]:
    bundle = candidate_directory(root, identifier)
    index_path = required_file(bundle, "index.faiss")
    chunks_path = required_file(bundle, "chunks.jsonl")
    manifest_path = required_file(bundle, "manifest.json")
    manifest = load_manifest(manifest_path, identifier)
    index_info = manifest["index"]
    chunks_info = manifest["chunks"]
    assert isinstance(index_info, dict) and isinstance(chunks_info, dict)
    index_hash = sha256_file(index_path)
    chunks_hash = sha256_file(chunks_path)
    if not hmac.compare_digest(index_hash, require_string(index_info, "sha256")):
        raise BundleError("index.faiss hash differs from the manifest")
    if not hmac.compare_digest(chunks_hash, require_string(chunks_info, "sha256")):
        raise BundleError("chunks.jsonl hash differs from the manifest")
    dimensions, index_count = read_index(index_path)
    chunks_count, course_ids = read_chunks(chunks_path, validate_source_prefix(require_string(manifest, "sourcePrefix")))
    if dimensions != require_integer(index_info, "dimensions"):
        raise BundleError("index.faiss dimensions differ from the manifest")
    if index_count != require_integer(index_info, "count"):
        raise BundleError("index.faiss count differs from the manifest")
    if chunks_count != require_integer(chunks_info, "count"):
        raise BundleError("chunks.jsonl count differs from the manifest")
    if index_count != chunks_count:
        raise BundleError("index.faiss and chunks.jsonl counts differ")
    return {
        "bundleId": identifier,
        "index": {"sha256": index_hash, "dimensions": dimensions, "count": index_count},
        "chunks": {"sha256": chunks_hash, "count": chunks_count, "courseIds": len(course_ids)},
    }


def create_manifest(root: Path, identifier: str, model_id: str, source_prefix: str) -> dict[str, Any]:
    if model_id != MODEL_ID:
        raise BundleError("model ID is unsupported")
    bundle = candidate_directory(root, identifier)
    index_path = required_file(bundle, "index.faiss")
    chunks_path = required_file(bundle, "chunks.jsonl")
    manifest_path = bundle / "manifest.json"
    if os.path.lexists(manifest_path):
        raise BundleError("manifest.json already exists and is immutable")
    source_prefix = validate_source_prefix(source_prefix)
    index_hash = sha256_file(index_path)
    chunks_hash = sha256_file(chunks_path)
    dimensions, index_count = read_index(index_path)
    chunks_count, _ = read_chunks(chunks_path, source_prefix)
    if index_count != chunks_count:
        raise BundleError("index.faiss and chunks.jsonl counts differ")
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "bundleId": identifier,
        "modelId": model_id,
        "sourcePrefix": source_prefix,
        "index": {"sha256": index_hash, "dimensions": dimensions, "count": index_count},
        "chunks": {"sha256": chunks_hash, "count": chunks_count},
    }
    encoded = (json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    descriptor, temporary_name = tempfile.mkstemp(prefix=".manifest.", dir=bundle)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())
        try:
            os.link(temporary, manifest_path)
        except FileExistsError as error:
            raise BundleError("manifest.json already exists and is immutable") from error
    finally:
        temporary.unlink(missing_ok=True)
    return inspect_bundle(root, identifier)


def state_directory(root: Path, generation: str, *, create: bool = False) -> Path:
    states = root / STATE_DIRECTORY
    if not os.path.lexists(states) and create:
        states.mkdir(mode=0o700)
    if not states.is_dir() or states.is_symlink():
        raise BundleError("bundle root does not contain a real states directory")
    state = states / state_id(generation)
    if not state.is_dir() or state.is_symlink():
        raise BundleError("state generation is missing or is a symlink")
    return state


def bundle_link_target(root: Path, directory: Path, name: str, *, state_link: bool) -> str | None:
    pointer = directory / name
    if pointer.is_symlink():
        target = os.readlink(pointer)
        parts = Path(target).parts
        expected_prefix = ("..", "..", "bundles") if state_link else ("bundles",)
        if Path(target).is_absolute() or len(parts) != len(expected_prefix) + 1 or parts[:-1] != expected_prefix:
            raise BundleError(f"{name} pointer must be a relative bundle target")
        identifier = release_id(parts[-1])
        candidate_directory(root, identifier)
        return identifier
    if os.path.lexists(pointer):
        raise BundleError(f"{name} pointer is not a symlink")
    return None


def state_pointer(root: Path) -> Path | None:
    pointer = root / STATE_POINTER
    if pointer.is_symlink():
        target = os.readlink(pointer)
        parts = Path(target).parts
        if Path(target).is_absolute() or len(parts) != 2 or parts[0] != STATE_DIRECTORY:
            raise BundleError("state pointer must be a relative state generation target")
        return state_directory(root, parts[1])
    if os.path.lexists(pointer):
        raise BundleError("state pointer is not a symlink")
    return None


def active_pair(root: Path) -> tuple[str, str | None] | None:
    state = state_pointer(root)
    if state is not None:
        current = bundle_link_target(root, state, "current", state_link=True)
        if current is None:
            raise BundleError("state generation has no current bundle pointer")
        previous = bundle_link_target(root, state, "previous", state_link=True)
        if current == previous:
            raise BundleError("current and previous bundle pointers must differ")
        return current, previous

    # A single atomic state publish can absorb a pre-state layout without
    # altering its legacy links.  This keeps the first state publication safe
    # while service configuration moves to state/current.
    current = bundle_link_target(root, root, "current", state_link=False)
    previous = bundle_link_target(root, root, "previous", state_link=False)
    if current is None:
        if previous is not None:
            raise BundleError("legacy previous pointer requires a legacy current pointer")
        return None
    if current == previous:
        raise BundleError("current and previous bundle pointers must differ")
    return current, previous


def create_state(root: Path, current: str, previous: str | None) -> str:
    candidate_directory(root, current)
    if previous is not None:
        candidate_directory(root, previous)
        if current == previous:
            raise BundleError("current and previous bundle pointers must differ")
    states = root / STATE_DIRECTORY
    if not os.path.lexists(states):
        states.mkdir(mode=0o700)
    if not states.is_dir() or states.is_symlink():
        raise BundleError("bundle root does not contain a real states directory")
    generation = uuid.uuid4().hex
    state = states / generation
    state.mkdir(mode=0o700)
    try:
        os.symlink(f"../../bundles/{current}", state / "current")
        if previous is not None:
            os.symlink(f"../../bundles/{previous}", state / "previous")
    except OSError as error:
        raise BundleError("state generation could not be prepared") from error
    return generation


def replace_state(root: Path, generation: str) -> None:
    state_directory(root, generation)
    pointer = root / STATE_POINTER
    temporary = root / f".{STATE_POINTER}.{uuid.uuid4().hex}.tmp"
    os.symlink(f"{STATE_DIRECTORY}/{generation}", temporary)
    try:
        os.replace(temporary, pointer)
    finally:
        if os.path.lexists(temporary):
            temporary.unlink()


@contextlib.contextmanager
def pointer_lock(root: Path) -> Iterator[None]:
    import fcntl

    descriptor = os.open(root / ".rag-pointer.lock", os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def validate_active_pair(root: Path, pair: tuple[str, str | None]) -> None:
    current, previous = pair
    inspect_bundle(root, current)
    if previous is not None:
        inspect_bundle(root, previous)


def activate(root: Path, identifier: str) -> dict[str, Any]:
    with pointer_lock(root):
        report = inspect_bundle(root, identifier)
        existing = active_pair(root)
        if existing is not None:
            current, _ = existing
            validate_active_pair(root, existing)
            if current == identifier:
                report["action"] = "already-current"
                return report
            previous = current
        else:
            previous = None
        generation = create_state(root, identifier, previous)
        replace_state(root, generation)
        report["action"] = "activated"
        report["previousBundleId"] = previous
        return report


def rollback(root: Path) -> dict[str, Any]:
    with pointer_lock(root):
        existing = active_pair(root)
        if existing is None:
            raise BundleError("current and previous bundle pointers are required for rollback")
        current, previous = existing
        if previous is None:
            raise BundleError("current and previous bundle pointers are required for rollback")
        validate_active_pair(root, existing)
        report = inspect_bundle(root, previous)
        generation = create_state(root, previous, current)
        replace_state(root, generation)
        report["action"] = "rolled-back"
        report["previousBundleId"] = current
        return report


def parser() -> argparse.ArgumentParser:
    argument_parser = argparse.ArgumentParser(description=__doc__)
    commands = argument_parser.add_subparsers(dest="command", required=True)

    def add_root_and_release(command: argparse.ArgumentParser) -> None:
        command.add_argument("--root", required=True)
        command.add_argument("--release-id", required=True)

    create = commands.add_parser("create-manifest")
    add_root_and_release(create)
    create.add_argument("--model-id", required=True)
    create.add_argument("--source-prefix", required=True)
    validate = commands.add_parser("validate")
    add_root_and_release(validate)
    activate_command = commands.add_parser("activate")
    add_root_and_release(activate_command)
    rollback_command = commands.add_parser("rollback")
    rollback_command.add_argument("--root", required=True)
    return argument_parser


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    try:
        root = require_root(arguments.root)
        if arguments.command == "create-manifest":
            report = create_manifest(root, release_id(arguments.release_id), arguments.model_id, arguments.source_prefix)
        elif arguments.command == "validate":
            report = inspect_bundle(root, release_id(arguments.release_id))
        elif arguments.command == "activate":
            report = activate(root, release_id(arguments.release_id))
        else:
            report = rollback(root)
    except BundleError as error:
        print(f"rag bundle: {error}", file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
