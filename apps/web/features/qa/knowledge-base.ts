import type { Citation } from "@/lib/types";

export const KNOWLEDGE_BASE_SEARCH_ERROR_MESSAGE = "공식 문서를 검색할 수 없습니다. 잠시 후 다시 시도해 주세요.";

const DEFAULT_RETRIEVER_URL = "http://127.0.0.1:8788/retrieve";
const RETRIEVAL_RESULT_LIMIT = 5;

type RetrievalSuccess = { status: "success"; citations: Citation[] };
type RetrievalFailure = { status: "search_error" };

export type KnowledgeBaseRetrieval = RetrievalSuccess | RetrievalFailure;
export type RetrieveCourseCitations = (courseId: string, question: string) => Promise<KnowledgeBaseRetrieval>;

export type LocalRetrieverFetch = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

type KnowledgeBaseRetrieverOptions = {
  endpoint?: string;
  fetch?: LocalRetrieverFetch;
};

function getResults(payload: unknown): unknown[] | undefined {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    !("results" in payload) ||
    !Array.isArray(payload.results)
  ) {
    return undefined;
  }

  return payload.results;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getS3DocumentName(sourceUri: string): string | undefined {
  if (!sourceUri.startsWith("s3://")) return undefined;

  const documentName = sourceUri.slice(sourceUri.lastIndexOf("/") + 1);
  return documentName || undefined;
}

function toCitation(result: unknown, index: number, courseId: string): Citation | undefined {
  if (typeof result !== "object" || result === null || Array.isArray(result) || !("metadata" in result)) {
    return undefined;
  }

  const metadata = result.metadata;
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata) ||
    !("courseId" in metadata) ||
    getString(metadata.courseId) !== courseId
  ) {
    return undefined;
  }

  if (
    !("content" in result) ||
    typeof result.content !== "object" ||
    result.content === null ||
    Array.isArray(result.content) ||
    !("text" in result.content)
  ) {
    return undefined;
  }
  const excerpt = getString(result.content.text);
  if (!excerpt) return undefined;

  if (
    !("location" in result) ||
    typeof result.location !== "object" ||
    result.location === null ||
    Array.isArray(result.location) ||
    !("s3Uri" in result.location)
  ) {
    return undefined;
  }
  const documentName = getS3DocumentName(getString(result.location.s3Uri) ?? "");
  if (!documentName) return undefined;

  const week = "week" in metadata ? metadata.week : undefined;
  return {
    id: `local-${index + 1}`,
    documentName,
    sourceKind: "actual",
    week: typeof week === "number" && Number.isFinite(week) ? week : null,
    excerpt,
  };
}

export function createKnowledgeBaseRetriever(options: KnowledgeBaseRetrieverOptions = {}): RetrieveCourseCitations {
  const endpoint = options.endpoint ?? process.env.CURI_RAG_RETRIEVER_URL ?? DEFAULT_RETRIEVER_URL;
  const request: LocalRetrieverFetch = options.fetch ?? ((url, init) => fetch(url, init));

  return async (courseId, question) => {
    try {
      const response = await request(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, question, numberOfResults: RETRIEVAL_RESULT_LIMIT }),
      });
      if (!response.ok) return { status: "search_error" };

      const payload = await response.json();
      const results = getResults(payload);
      if (!results) return { status: "search_error" };

      const citations = results
        .map((result, index) => toCitation(result, index, courseId))
        .filter((citation): citation is Citation => citation !== undefined);
      return { status: "success", citations };
    } catch {
      return { status: "search_error" };
    }
  };
}
