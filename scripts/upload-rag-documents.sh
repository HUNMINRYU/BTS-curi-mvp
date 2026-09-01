#!/usr/bin/env bash
# Uploads only the prepared staging tree to the private S3 documents/ prefix.
# It never reads or uploads the source ZIP files directly.
#
# Usage:
#   CURI_DOCUMENT_BUCKET=curi-documents scripts/upload-rag-documents.sh
#   CURI_DOCUMENT_BUCKET=curi-documents scripts/upload-rag-documents.sh --dry-run
#
# An EC2-local indexer rebuilds its FAISS index from this S3 prefix after sync.
# CURI_RAG_STAGING_DIR defaults to /tmp/curi-rag-documents and must contain
# the documents/ tree created by scripts/prepare-rag-documents.mjs.

set -euo pipefail

usage() {
  echo "Usage: CURI_DOCUMENT_BUCKET=<bucket> $0 [--dry-run]" >&2
}

if [[ $# -gt 1 ]]; then
  usage
  exit 2
fi

is_dry_run=false
if [[ $# -eq 1 ]]; then
  if [[ "$1" != "--dry-run" ]]; then
    usage
    exit 2
  fi
  is_dry_run=true
fi

if [[ -z "${CURI_DOCUMENT_BUCKET:-}" ]]; then
  echo "CURI_DOCUMENT_BUCKET is required." >&2
  exit 2
fi

if [[ "${CURI_DOCUMENT_BUCKET}" == *[[:space:]]* || "${CURI_DOCUMENT_BUCKET}" == *"/"* ]]; then
  echo "CURI_DOCUMENT_BUCKET must be a bucket name, not an S3 URI." >&2
  exit 2
fi

staging_directory="${CURI_RAG_STAGING_DIR:-/tmp/curi-rag-documents}"
documents_directory="${staging_directory%/}/documents"
if [[ ! -d "$documents_directory" ]]; then
  echo "Prepared documents directory is missing: $documents_directory" >&2
  echo "Run node scripts/prepare-rag-documents.mjs first." >&2
  exit 2
fi

sync_arguments=(s3 sync "$documents_directory/" "s3://${CURI_DOCUMENT_BUCKET}/documents/")
if [[ "$is_dry_run" == true ]]; then
  sync_arguments+=(--dryrun)
fi
aws "${sync_arguments[@]}"

