"""Offline Bedrock fixture for sidecar process tests."""

from __future__ import annotations

import io
import json


class BedrockClient:
    def invoke_model(self, **_kwargs: object) -> dict[str, io.BytesIO]:
        embedding = [1.0] + [0.0] * 511
        return {"body": io.BytesIO(json.dumps({"embedding": embedding}).encode("utf-8"))}


def client(name: str) -> BedrockClient:
    if name != "bedrock-runtime":
        raise ValueError(name)
    return BedrockClient()
