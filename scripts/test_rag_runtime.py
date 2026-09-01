import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).parent


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class RagIndexerTests(unittest.TestCase):
    def test_chunks_overlap_without_emitting_empty_text(self):
        indexer = load_module("rag_indexer", "rag_indexer.py")
        chunks = indexer.chunk_text("첫 문단입니다.\n\n둘째 문단은 조금 더 깁니다.", chunk_size=18, overlap=4)

        self.assertGreaterEqual(len(chunks), 2)
        self.assertTrue(all(chunk.strip() for chunk in chunks))
        self.assertTrue(set(chunks[0][-4:]) & set(chunks[1][:8]))

    def test_atomic_metadata_writer_preserves_vector_order(self):
        indexer = load_module("rag_indexer", "rag_indexer.py")
        records = [
            {"courseId": "course-a", "text": "첫 청크", "s3Uri": "s3://bucket/a.pdf"},
            {"courseId": "course-b", "text": "둘째 청크", "s3Uri": "s3://bucket/b.pdf"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "chunks.jsonl"
            indexer.write_jsonl_atomic(target, records)
            loaded = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines()]

        self.assertEqual(loaded, records)


class RagSidecarTests(unittest.TestCase):
    def test_request_validation_rejects_invalid_course_and_caps_results(self):
        sidecar = load_module("rag_sidecar", "rag_sidecar.py")

        with self.assertRaises(ValueError):
            sidecar.validate_request({"courseId": "../escape", "question": "질문", "numberOfResults": 5})
        self.assertEqual(
            sidecar.validate_request({"courseId": "course-a", "question": "  질문  ", "numberOfResults": 99}),
            ("course-a", "질문", 10),
        )

    def test_course_scoped_ranking_never_returns_other_course(self):
        sidecar = load_module("rag_sidecar", "rag_sidecar.py")
        records = [
            {"courseId": "course-a", "text": "A1", "s3Uri": "s3://bucket/a.pdf", "week": 1},
            {"courseId": "course-b", "text": "B1", "s3Uri": "s3://bucket/b.pdf", "week": 2},
            {"courseId": "course-a", "text": "A2", "s3Uri": "s3://bucket/a.pdf", "week": 3},
        ]
        vectors = [[1.0, 0.0], [1.0, 0.0], [0.8, 0.2]]

        results = sidecar.rank_course_records(records, vectors, [1.0, 0.0], "course-a", 5)

        self.assertEqual([item["metadata"]["courseId"] for item in results], ["course-a", "course-a"])
        self.assertEqual([item["content"]["text"] for item in results], ["A1", "A2"])


if __name__ == "__main__":
    unittest.main()
