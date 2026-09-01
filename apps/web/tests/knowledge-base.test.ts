import assert from "node:assert/strict";
import test from "node:test";

import { createKnowledgeBaseRetriever } from "../lib/knowledge-base";

test("로컬 검색 어댑터는 courseId와 5개 결과 제한을 전달하고 다른 과목 chunk를 제외한다", async () => {
  let receivedUrl: string | undefined;
  let receivedBody: unknown;
  const retrieveCitations = createKnowledgeBaseRetriever({
    endpoint: "http://127.0.0.1:8788/retrieve",
    fetch: async (url, init) => {
      receivedUrl = url;
      receivedBody = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return {
            results: [
              {
                content: { text: "K컬처 7주차 공식 수업 내용" },
                location: { s3Uri: "s3://curi-syllabus/general/k-culture-and-global-sensitivity.pdf" },
                metadata: {
                  courseId: "k-culture-and-global-sensitivity",
                  courseName: "K컬처와글로벌감수성",
                  department: "교양",
                  week: 7,
                },
              },
              {
                content: { text: "다른 과목 내용" },
                location: { s3Uri: "s3://curi-syllabus/computer/database.pdf" },
                metadata: { courseId: "database", week: 3 },
              },
            ],
          };
        },
      };
    },
  });

  const result = await retrieveCitations("k-culture-and-global-sensitivity", "7주차에는 무엇을 배우나요?");

  assert.equal(receivedUrl, "http://127.0.0.1:8788/retrieve");
  assert.deepEqual(receivedBody, {
    courseId: "k-culture-and-global-sensitivity",
    question: "7주차에는 무엇을 배우나요?",
    numberOfResults: 5,
  });
  assert.deepEqual(result, {
    status: "success",
    citations: [{
      id: "local-1",
      documentName: "k-culture-and-global-sensitivity.pdf",
      sourceKind: "actual",
      week: 7,
      excerpt: "K컬처 7주차 공식 수업 내용",
    }],
  });
});

test("로컬 검색 어댑터는 sidecar 오류와 잘못된 응답을 안전한 검색 오류로 반환한다", async () => {
  const unavailable = createKnowledgeBaseRetriever({
    endpoint: "http://127.0.0.1:8788/retrieve",
    fetch: async () => { throw new Error("sidecar unavailable"); },
  });
  const invalidResponse = createKnowledgeBaseRetriever({
    endpoint: "http://127.0.0.1:8788/retrieve",
    fetch: async () => ({
      ok: true,
      async json() {
        return { unexpected: [] };
      },
    }),
  });
  const rejectedResponse = createKnowledgeBaseRetriever({
    endpoint: "http://127.0.0.1:8788/retrieve",
    fetch: async () => ({
      ok: false,
      async json() {
        return {};
      },
    }),
  });

  assert.deepEqual(await unavailable("database", "질문"), { status: "search_error" });
  assert.deepEqual(await invalidResponse("database", "질문"), { status: "search_error" });
  assert.deepEqual(await rejectedResponse("database", "질문"), { status: "search_error" });
});
