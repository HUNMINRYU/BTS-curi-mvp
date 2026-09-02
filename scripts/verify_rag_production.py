#!/usr/bin/env python3
"""Parse read-only RAG verification probes into a secret-free JSON report."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import re
import sys
from pathlib import Path
from typing import Any


EXPECTED_DOCUMENT_COUNT = 77
EXPECTED_VECTOR_COUNT = 458
EXPECTED_DIMENSIONS = 512
INDEX_PATH = "/var/lib/curi/rag/state/current/index.faiss"
CHUNKS_PATH = "/var/lib/curi/rag/state/current/chunks.jsonl"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
BUCKET_PATTERN = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")
COURSE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def empty_report() -> dict[str, dict[str, Any]]:
    return {
        "settings": {
            "documentPrefix": "documents/",
            "expectedDocumentCount": EXPECTED_DOCUMENT_COUNT,
            "expectedVectorCount": EXPECTED_VECTOR_COUNT,
            "expectedDimensions": EXPECTED_DIMENSIONS,
            "indexPath": INDEX_PATH,
            "chunksPath": CHUNKS_PATH,
        },
        "counts": {
            "pdf": 0,
            "metadata": 0,
            "index": 0,
            "chunks": 0,
            "courseIds": 0,
            "retrieveResults": 0,
        },
        "hashes": {"indexSha256": "", "chunksSha256": ""},
        "booleans": {
            "inputsValid": False,
            "publicAccessBlock": False,
            "encrypted": False,
            "versioningEnabled": False,
            "documentCountsMatch": False,
            "indexHashMatch": False,
            "chunksHashMatch": False,
            "dimensionsMatch": False,
            "vectorCountsMatch": False,
            "courseIdsMatch": False,
            "sourcePrefixMatches": False,
            "healthProbe": False,
            "retrieveProbe": False,
            "checksPassed": False,
        },
    }


def read_json(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256(value: str) -> str:
    normalized = value.lower()
    if not SHA256_PATTERN.fullmatch(normalized):
        raise ValueError("invalid SHA-256")
    return normalized


def integer(mapping: dict[str, Any], name: str) -> int:
    value = mapping.get(name)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"invalid {name}")
    return value


def remote_hashes(path: str) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        fields = line.split()
        if len(fields) != 2:
            raise ValueError("invalid sha256sum output")
        digest = sha256(fields[0])
        filename = fields[1].lstrip("*")
        if filename == INDEX_PATH:
            hashes["indexSha256"] = digest
        elif filename == CHUNKS_PATH:
            hashes["chunksSha256"] = digest
    if set(hashes) != {"indexSha256", "chunksSha256"}:
        raise ValueError("sha256sum did not cover the current bundle pair")
    return hashes


def count_documents(payload: Any) -> tuple[int, int]:
    if not isinstance(payload, dict) or not isinstance(payload.get("Contents", []), list):
        raise ValueError("invalid list-objects-v2 response")
    pdf = 0
    metadata = 0
    for item in payload.get("Contents", []):
        if not isinstance(item, dict) or not isinstance(item.get("Key"), str):
            raise ValueError("invalid listed object")
        key = item["Key"]
        if key.endswith(".pdf"):
            pdf += 1
        elif key.endswith(".pdf.metadata.json"):
            metadata += 1
    return pdf, metadata


def report(arguments: argparse.Namespace) -> tuple[dict[str, dict[str, Any]], bool]:
    output = empty_report()
    if not BUCKET_PATTERN.fullmatch(arguments.bucket):
        raise ValueError("invalid bucket")
    expected_index = sha256(arguments.expected_index_sha256)
    expected_chunks = sha256(arguments.expected_chunks_sha256)
    public_access = read_json(arguments.public_access)
    encryption = read_json(arguments.encryption)
    versioning = read_json(arguments.versioning)
    objects = read_json(arguments.objects)
    metadata = read_json(arguments.metadata)
    health = read_json(arguments.health)
    retrieve = read_json(arguments.retrieve)
    if not isinstance(metadata, dict) or not isinstance(health, dict) or not isinstance(retrieve, dict):
        raise ValueError("invalid remote probe JSON")
    hashes = remote_hashes(arguments.hashes)
    pdf, object_metadata = count_documents(objects)
    dimensions = integer(metadata, "dimensions")
    index_count = integer(metadata, "indexCount")
    chunks_count = integer(metadata, "chunksCount")
    course_ids = integer(metadata, "courseIds")
    source_prefix_matches = metadata.get("sourcePrefixMatches") is True
    probe_course_id = metadata.get("probeCourseId")
    if not isinstance(probe_course_id, str) or not COURSE_ID_PATTERN.fullmatch(probe_course_id):
        raise ValueError("invalid probe course ID")
    results = retrieve.get("results")
    if not isinstance(results, list):
        raise ValueError("invalid retrieve response")
    retrieve_matches = len(results) == 5 and all(
        isinstance(item, dict)
        and isinstance(item.get("metadata"), dict)
        and item["metadata"].get("courseId") == probe_course_id
        for item in results
    )
    public_configuration = public_access.get("PublicAccessBlockConfiguration") if isinstance(public_access, dict) else None
    public_access_block = isinstance(public_configuration, dict) and all(
        public_configuration.get(name) is True
        for name in ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")
    )
    rules = encryption.get("ServerSideEncryptionConfiguration", {}).get("Rules", []) if isinstance(encryption, dict) else []
    encrypted = (
        isinstance(rules, list)
        and bool(rules)
        and isinstance(rules[0], dict)
        and isinstance(rules[0].get("ApplyServerSideEncryptionByDefault"), dict)
        and rules[0]["ApplyServerSideEncryptionByDefault"].get("SSEAlgorithm") == "AES256"
    )
    versioning_enabled = isinstance(versioning, dict) and versioning.get("Status") == "Enabled"
    output["counts"].update({
        "pdf": pdf,
        "metadata": object_metadata,
        "index": index_count,
        "chunks": chunks_count,
        "courseIds": course_ids,
        "retrieveResults": len(results),
    })
    output["hashes"].update(hashes)
    flags = output["booleans"]
    flags.update({
        "inputsValid": True,
        "publicAccessBlock": public_access_block,
        "encrypted": encrypted,
        "versioningEnabled": versioning_enabled,
        "documentCountsMatch": pdf == EXPECTED_DOCUMENT_COUNT and object_metadata == EXPECTED_DOCUMENT_COUNT,
        "indexHashMatch": hmac.compare_digest(hashes["indexSha256"], expected_index),
        "chunksHashMatch": hmac.compare_digest(hashes["chunksSha256"], expected_chunks),
        "dimensionsMatch": dimensions == EXPECTED_DIMENSIONS,
        "vectorCountsMatch": index_count == EXPECTED_VECTOR_COUNT and chunks_count == EXPECTED_VECTOR_COUNT and index_count == chunks_count,
        "courseIdsMatch": course_ids == EXPECTED_DOCUMENT_COUNT,
        "sourcePrefixMatches": source_prefix_matches,
        "healthProbe": health.get("ok") is True,
        "retrieveProbe": retrieve_matches,
    })
    flags["checksPassed"] = all(value for name, value in flags.items() if name != "checksPassed")
    return output, flags["checksPassed"]


def emit(payload: dict[str, dict[str, Any]]) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def parser() -> argparse.ArgumentParser:
    command_parser = argparse.ArgumentParser(description=__doc__)
    commands = command_parser.add_subparsers(dest="command", required=True)
    report_command = commands.add_parser("report")
    report_command.add_argument("--bucket", required=True)
    report_command.add_argument("--expected-index-sha256", required=True)
    report_command.add_argument("--expected-chunks-sha256", required=True)
    for name in ("public-access", "encryption", "versioning", "objects", "hashes", "metadata", "health", "retrieve"):
        report_command.add_argument(f"--{name}", required=True)
    probe = commands.add_parser("probe-course")
    probe.add_argument("--metadata", required=True)
    commands.add_parser("failure")
    return command_parser


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    if arguments.command == "failure":
        emit(empty_report())
        return 1
    if arguments.command == "probe-course":
        try:
            metadata = read_json(arguments.metadata)
            if not isinstance(metadata, dict):
                raise ValueError("invalid metadata")
            course_id = metadata.get("probeCourseId")
            if not isinstance(course_id, str) or not COURSE_ID_PATTERN.fullmatch(course_id):
                raise ValueError("invalid probe course ID")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            return 1
        print(course_id)
        return 0
    try:
        payload, passed = report(arguments)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        emit(empty_report())
        return 1
    emit(payload)
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
