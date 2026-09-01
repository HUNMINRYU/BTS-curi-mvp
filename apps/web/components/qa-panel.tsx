"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { QaResult } from "@/lib/types";
import {
  isGamificationSummary,
  publishGamification,
  type GamificationSummary,
} from "@/lib/gamification";
import { SourceBadge } from "./source-badge";
import { CuriMascot } from "./curi-mascot";

function isQaResult(payload: unknown): payload is QaResult {
  if (typeof payload !== "object" || payload === null) return false;
  if (!("status" in payload) || !("answer" in payload) || !("citations" in payload)) return false;
  if (payload.status !== "answered" && payload.status !== "not_found" && payload.status !== "model_error") return false;
  if (typeof payload.answer !== "string" || !Array.isArray(payload.citations)) return false;
  return payload.citations.every((citation) => typeof citation === "object"
    && citation !== null
    && "id" in citation && typeof citation.id === "string"
    && "documentName" in citation && typeof citation.documentName === "string"
    && "sourceKind" in citation && (citation.sourceKind === "actual" || citation.sourceKind === "demo")
    && "week" in citation && (typeof citation.week === "number" || citation.week === null)
    && "excerpt" in citation && typeof citation.excerpt === "string");
}

export type QaSubmission = {
  result: QaResult | null;
  error: string | null;
};

export async function askCourseQuestion(
  courseId: string,
  question: string,
  request: typeof fetch = fetch,
  publish: (summary: GamificationSummary) => void = publishGamification,
): Promise<QaSubmission> {
  const response = await request("/api/qa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ courseId, question }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload
      ? String(payload.error)
      : "질문을 처리하지 못했습니다.";
    return { result: null, error };
  }
  if (!isQaResult(payload)
    || !(typeof payload === "object" && payload !== null && "gamification" in payload)
    || !isGamificationSummary(payload.gamification)) {
    return { result: null, error: "서버 응답 형식이 올바르지 않습니다." };
  }

  publish(payload.gamification);
  return {
    result: {
      status: payload.status,
      answer: payload.answer,
      citations: payload.citations,
    },
    error: null,
  };
}

export function QaPanel({ courseId }: { courseId: string }) {
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("실습 전에 무엇을 준비해야 하나요?");
  const [result, setResult] = useState<QaResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult(null);

    try {
      const submission = await askCourseQuestion(courseId, question);
      if (submission.result) setResult(submission.result);
      else setError(submission.error ?? "질문을 처리하지 못했습니다.");
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  function closeChatbot() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function closeOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") closeChatbot();
  }

  return (
    <div className="chatbot-shell">
      {open && (
        <section
          aria-labelledby="qa-title"
          className="chatbot-panel"
          id="curi-chatbot-panel"
          onKeyDown={closeOnEscape}
          role="dialog"
        >
          <header className="chatbot-header">
            <div>
              <p className="eyebrow">GROUNDED Q&amp;A</p>
              <h2 id="qa-title">CURI AI 도우미</h2>
            </div>
            <button aria-label="AI 도우미 닫기" className="chatbot-close" onClick={closeChatbot} type="button">×</button>
          </header>
          <p className="section-intro">강의계획서와 표시된 데모 안내문에서 근거를 찾은 뒤 답합니다.</p>

          <form className="qa-form" onSubmit={submit}>
            <label htmlFor="course-question">공식 문서에 질문하기</label>
            <div className="qa-input-row">
              <input
                autoFocus
                id="course-question"
                maxLength={200}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="예: 실습 전에 무엇을 준비해야 하나요?"
                value={question}
              />
              <button disabled={pending || question.trim().length === 0} type="submit">
                {pending ? "근거 찾는 중" : "전송"}
              </button>
            </div>
          </form>

          <div className="qa-status" aria-live="polite">
            {error && <p className="error-message">{error}</p>}
            {result && (
              <article className={`qa-result qa-result--${result.status}`}>
                <p className="result-state">
                  {result.status === "answered" ? "근거 기반 답변" : result.status === "not_found" ? "근거 없음" : "AI 연결 실패 · 근거 확인 가능"}
                </p>
                <p className="answer-text">{result.answer}</p>
                {result.citations.length > 0 && (
                  <div className="citation-list">
                    <h3>확인된 근거</h3>
                    <ul>
                      {result.citations.map((citation) => (
                        <li key={citation.id}>
                          <div>
                            <strong>{citation.documentName}</strong>
                            <span>{citation.week ? `${citation.week}주차` : "공통"}</span>
                          </div>
                          <SourceBadge sourceKind={citation.sourceKind} />
                          <p>{citation.excerpt}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            )}
          </div>
        </section>
      )}

      <button
        aria-controls={open ? "curi-chatbot-panel" : undefined}
        aria-expanded={open}
        aria-label={open ? "AI 도우미 닫기" : "AI 도우미 열기"}
        className="chatbot-launcher"
        id="curi-chatbot-launcher"
        onClick={() => setOpen((current) => !current)}
        ref={launcherRef}
        type="button"
      >
        <CuriMascot className="chatbot-avatar" variant={result?.status === "not_found" ? "question" : "chat"} />
        <strong>{open ? "닫기" : "질문하기"}</strong>
      </button>
    </div>
  );
}
