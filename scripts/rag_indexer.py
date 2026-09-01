#!/usr/bin/env python3
"""Manually build a local CURI FAISS index from an S3 syllabus source.

This planned rebuild helper is not called by rag_sidecar.py or curi-rag.service.
"""

from __future__ import annotations

import io
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Iterable


MODEL_ID = "amazon.titan-embed-text-v2:0"
EMBEDDING_DIMENSIONS = 512
DEFAULT_INDEX_PATH = "/var/lib/curi/rag/index.faiss"
DEFAULT_CHUNKS_PATH = "/var/lib/curi/rag/chunks.jsonl"
DEFAULT_PREFIX = "documents/"


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> list[str]:
    if chunk_size < 1 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("chunk_size must be positive and overlap must be smaller")
    normalized = re.sub(r"[ \t]+", " ", text.replace("\r\n", "\n").replace("\r", "\n"))
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        limit = min(len(normalized), start + chunk_size)
        end = limit
        if limit < len(normalized):
            paragraph_break = normalized.rfind("\n\n", start + chunk_size // 2, limit)
            sentence_break = max(
                normalized.rfind(". ", start + chunk_size // 2, limit),
                normalized.rfind("다. ", start + chunk_size // 2, limit),
            )
            if paragraph_break > start:
                end = paragraph_break
            elif sentence_break > start:
                end = sentence_break + 2
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break
        start = max(start + 1, end - overlap)
    return chunks


def write_jsonl_atomic(path: Path, records: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        for record in records:
            temporary.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        temporary.flush()
        os.fsync(temporary.fileno())
    os.replace(temporary_path, path)


def list_pdf_keys(s3, bucket: str, prefix: str) -> list[str]:
    keys: list[str] = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for item in page.get("Contents", []):
            key = item.get("Key")
            if isinstance(key, str) and key.lower().endswith(".pdf"):
                keys.append(key)
    return sorted(keys)


def read_metadata(s3, bucket: str, pdf_key: str) -> dict[str, str]:
    response = s3.get_object(Bucket=bucket, Key=f"{pdf_key}.metadata.json")
    payload = json.loads(response["Body"].read())
    attributes = payload.get("metadataAttributes")
    if not isinstance(attributes, dict):
        raise ValueError(f"Missing metadataAttributes for s3://{bucket}/{pdf_key}")
    required = {name: attributes.get(name) for name in ("courseId", "courseName", "department")}
    if not all(isinstance(value, str) and value.strip() for value in required.values()):
        raise ValueError(f"Invalid course metadata for s3://{bucket}/{pdf_key}")
    return {name: str(value).strip() for name, value in required.items()}


def extract_pdf_text(pdf_bytes: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: list[str] = []
    for page in reader.pages:
        text = (page.extract_text() or "").strip()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def embed_text(client, text: str) -> list[float]:
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


def save_index_atomic(path: Path, vectors: list[list[float]]) -> None:
    import faiss
    import numpy as np

    path.parent.mkdir(parents=True, exist_ok=True)
    matrix = np.asarray(vectors, dtype="float32")
    if matrix.ndim != 2 or matrix.shape[1] != EMBEDDING_DIMENSIONS:
        raise ValueError("Embedding matrix has an invalid shape")
    faiss.normalize_L2(matrix)
    index = faiss.IndexFlatIP(EMBEDDING_DIMENSIONS)
    index.add(matrix)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        faiss.write_index(index, str(temporary_path))
        os.replace(temporary_path, path)
    finally:
        temporary_path.unlink(missing_ok=True)


def main() -> None:
    import boto3

    bucket = os.environ.get("CURI_DOCUMENT_BUCKET", "").strip()
    if not bucket:
        raise SystemExit("CURI_DOCUMENT_BUCKET is required")
    prefix = os.environ.get("CURI_DOCUMENT_PREFIX", DEFAULT_PREFIX).strip().lstrip("/")
    index_path = Path(os.environ.get("CURI_RAG_INDEX_PATH", DEFAULT_INDEX_PATH))
    chunks_path = Path(os.environ.get("CURI_RAG_CHUNKS_PATH", DEFAULT_CHUNKS_PATH))

    s3 = boto3.client("s3")
    bedrock = boto3.client("bedrock-runtime")
    keys = list_pdf_keys(s3, bucket, prefix)
    if not keys:
        raise SystemExit(f"No PDFs found under s3://{bucket}/{prefix}")

    records: list[dict[str, object]] = []
    vectors: list[list[float]] = []
    for pdf_key in keys:
        metadata = read_metadata(s3, bucket, pdf_key)
        pdf_bytes = s3.get_object(Bucket=bucket, Key=pdf_key)["Body"].read()
        chunks = chunk_text(extract_pdf_text(pdf_bytes))
        if not chunks:
            raise ValueError(f"No extractable text in s3://{bucket}/{pdf_key}")
        for text in chunks:
            records.append({
                **metadata,
                "text": text,
                "s3Uri": f"s3://{bucket}/{pdf_key}",
                "week": None,
            })
            vectors.append(embed_text(bedrock, text))
        print(f"Indexed {metadata['courseId']}: {len(chunks)} chunks", flush=True)

    save_index_atomic(index_path, vectors)
    write_jsonl_atomic(chunks_path, records)
    print(f"Built {len(records)} chunks from {len(keys)} PDFs", flush=True)


if __name__ == "__main__":
    main()
