#!/usr/bin/env python3
"""Loopback-only retrieval API over the EC2-local CURI FAISS index."""

from __future__ import annotations

import json
import math
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from socketserver import TCPServer
from typing import Sequence


MODEL_ID = "amazon.titan-embed-text-v2:0"
EMBEDDING_DIMENSIONS = 512
DEFAULT_INDEX_PATH = "/var/lib/curi/rag/index.faiss"
DEFAULT_CHUNKS_PATH = "/var/lib/curi/rag/chunks.jsonl"
COURSE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_REQUEST_BYTES = 16_384


def validate_request(payload: object) -> tuple[str, str, int]:
    if not isinstance(payload, dict):
        raise ValueError("Request body must be an object")
    course_id = payload.get("courseId")
    question = payload.get("question")
    requested_count = payload.get("numberOfResults", 5)
    if not isinstance(course_id, str) or not COURSE_ID_PATTERN.fullmatch(course_id):
        raise ValueError("courseId is invalid")
    if not isinstance(question, str) or not question.strip():
        raise ValueError("question is required")
    if not isinstance(requested_count, int) or isinstance(requested_count, bool) or requested_count < 1:
        raise ValueError("numberOfResults is invalid")
    return course_id, question.strip(), min(requested_count, 10)


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    numerator = sum(float(a) * float(b) for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(float(value) ** 2 for value in left))
    right_norm = math.sqrt(sum(float(value) ** 2 for value in right))
    return numerator / (left_norm * right_norm) if left_norm and right_norm else 0.0


def rank_course_records(
    records: Sequence[dict[str, object]],
    vectors: Sequence[Sequence[float]],
    query_vector: Sequence[float],
    course_id: str,
    number_of_results: int,
) -> list[dict[str, object]]:
    if len(records) != len(vectors):
        raise ValueError("Index and metadata counts differ")
    ranked = sorted(
        (
            (cosine_similarity(vector, query_vector), record)
            for record, vector in zip(records, vectors, strict=True)
            if record.get("courseId") == course_id
        ),
        key=lambda item: item[0],
        reverse=True,
    )[:number_of_results]
    return [
        {
            "content": {"text": record["text"]},
            "location": {"s3Uri": record["s3Uri"]},
            "metadata": {
                "courseId": record["courseId"],
                "courseName": record.get("courseName"),
                "department": record.get("department"),
                "week": record.get("week"),
            },
            "score": score,
        }
        for score, record in ranked
    ]


def embed_query(client, text: str) -> list[float]:
    response = client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "inputText": text,
            "dimensions": EMBEDDING_DIMENSIONS,
            "normalize": True,
            "embeddingTypes": ["float"],
        }),
    )
    payload = json.loads(response["body"].read())
    embedding = payload.get("embedding")
    if not isinstance(embedding, list) or len(embedding) != EMBEDDING_DIMENSIONS:
        raise ValueError("Titan returned an invalid embedding")
    return [float(value) for value in embedding]


class IndexStore:
    def __init__(self, index_path: Path, chunks_path: Path) -> None:
        self.index_path = index_path
        self.chunks_path = chunks_path
        self.lock = threading.Lock()
        self.signature: tuple[int, int] | None = None
        self.records: list[dict[str, object]] = []
        self.vectors: object = []

    def snapshot(self) -> tuple[list[dict[str, object]], Sequence[Sequence[float]]]:
        import faiss
        import numpy as np

        with self.lock:
            signature = (self.index_path.stat().st_mtime_ns, self.chunks_path.stat().st_mtime_ns)
            if signature != self.signature:
                index = faiss.read_index(str(self.index_path))
                records = [json.loads(line) for line in self.chunks_path.read_text(encoding="utf-8").splitlines() if line.strip()]
                if index.d != EMBEDDING_DIMENSIONS or index.ntotal != len(records):
                    raise ValueError("Index and metadata are inconsistent")
                vectors = np.empty((index.ntotal, index.d), dtype="float32")
                index.reconstruct_n(0, index.ntotal, vectors)
                self.records = records
                self.vectors = vectors
                self.signature = signature
            return self.records, self.vectors  # type: ignore[return-value]


class LoopbackThreadingHTTPServer(ThreadingHTTPServer):
    """Avoid a reverse-DNS lookup while binding the loopback-only sidecar."""

    def server_bind(self) -> None:
        TCPServer.server_bind(self)
        host, port = self.server_address[:2]
        self.server_name = str(host)
        self.server_port = int(port)


class RetrievalHandler(BaseHTTPRequestHandler):
    store: IndexStore
    bedrock: object

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_error(404)
            return
        try:
            self.store.snapshot()
        except Exception:
            self.respond(503, {"ok": False})
            return
        self.respond(200, {"ok": True})

    def do_POST(self) -> None:
        if self.path != "/retrieve":
            self.send_error(404)
            return
        try:
            content_length = int(self.headers.get("content-length", "0"))
            if content_length < 1 or content_length > MAX_REQUEST_BYTES:
                raise ValueError("Request body size is invalid")
            payload = json.loads(self.rfile.read(content_length))
            course_id, question, number_of_results = validate_request(payload)
            records, vectors = self.store.snapshot()
            query_vector = embed_query(self.bedrock, question)
            results = rank_course_records(records, vectors, query_vector, course_id, number_of_results)
            self.respond(200, {"results": results})
        except (ValueError, json.JSONDecodeError) as error:
            self.respond(400, {"error": str(error)})
        except Exception:
            self.respond(503, {"error": "retrieval unavailable"})

    def respond(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


def main() -> None:
    import boto3

    bundle_path = os.environ.get("CURI_RAG_BUNDLE_PATH", "").strip()
    if bundle_path:
        resolved_bundle = Path(bundle_path).resolve()
        index_path = resolved_bundle / "index.faiss"
        chunks_path = resolved_bundle / "chunks.jsonl"
    else:
        index_path = Path(os.environ.get("CURI_RAG_INDEX_PATH", DEFAULT_INDEX_PATH))
        chunks_path = Path(os.environ.get("CURI_RAG_CHUNKS_PATH", DEFAULT_CHUNKS_PATH))
    host = os.environ.get("CURI_RAG_HOST", "127.0.0.1")
    port = int(os.environ.get("CURI_RAG_PORT", "8788"))
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("CURI_RAG_HOST must remain loopback-only")

    RetrievalHandler.store = IndexStore(index_path, chunks_path)
    RetrievalHandler.bedrock = boto3.client("bedrock-runtime")
    RetrievalHandler.store.snapshot()
    server = LoopbackThreadingHTTPServer((host, port), RetrievalHandler)
    print(f"CURI RAG sidecar listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
