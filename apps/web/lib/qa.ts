import type { Citation, QaResult } from "./types";

export type GenerateGroundedAnswer = (question: string, citations: Citation[]) => Promise<string>;

export const NOT_FOUND_MESSAGE = "공식 문서에서 근거를 찾지 못했습니다. 담당자에게 확인해 주세요.";
const MODEL_ERROR_MESSAGE = "AI 답변을 생성하지 못했습니다. 아래 공식 근거를 확인해 주세요.";

export function notFoundQaResult(answer = NOT_FOUND_MESSAGE): QaResult {
  return { status: "not_found", answer, citations: [] };
}

export async function answerCourseQuestion(
  question: string,
  citations: Citation[],
  generateAnswer: GenerateGroundedAnswer,
): Promise<QaResult> {
  if (citations.length === 0) {
    return notFoundQaResult();
  }

  try {
    const answer = await generateAnswer(question, citations);
    return { status: "answered", answer, citations };
  } catch {
    return { status: "model_error", answer: MODEL_ERROR_MESSAGE, citations };
  }
}
