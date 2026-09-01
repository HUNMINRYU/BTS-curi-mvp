import type { TipAggregate } from "@/lib/tips";
import { CuriMascot } from "./curi-mascot";

export type ProfessorQaLog = {
  courseId: string;
  courseName: string;
  question: string;
  count: number;
  lastOccurredAt: string;
};

type ProfessorReportProps = {
  qaLogs: readonly ProfessorQaLog[];
  tipAggregate: TipAggregate;
};

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function ProfessorReport({ qaLogs, tipAggregate }: ProfessorReportProps) {
  return (
    <main className="professor-report" aria-labelledby="professor-title">
      <header className="professor-header">
        <div className="section-title-group">
          <CuriMascot className="section-mascot" variant="heart" />
          <div>
            <p className="eyebrow">COURSE SIGNAL REPORT</p>
            <h1 id="professor-title">교수 리포트</h1>
            <p>학생 식별정보 없이 반복 질문과 구조화된 학습 팁만 확인합니다.</p>
          </div>
        </div>
        <a className="text-link" href="/login">계정 전환</a>
      </header>

      <div className="professor-report-grid">
        <section className="section-card" aria-labelledby="unanswered-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GROUNDING GAPS</p>
              <h2 id="unanswered-title">근거 없음 질문</h2>
            </div>
            <span className="week-pill">{qaLogs.length}개 주제</span>
          </div>
          {qaLogs.length === 0 ? (
            <p className="report-empty">아직 기록된 근거 없음 질문이 없습니다.</p>
          ) : (
            <ol className="qa-log-list">
              {qaLogs.map((log) => (
                <li key={`${log.courseId}:${log.question}`}>
                  <div><strong>{log.courseName}</strong><span>{log.count}회</span></div>
                  <p>{log.question}</p>
                  <small>최근 발생 {dateLabel(log.lastOccurredAt)}</small>
                </li>
              ))}
            </ol>
          )}
          <p className="report-callout">공지 한 번으로 반복 질문을 줄여 보세요.</p>
        </section>

        <section className="section-card" aria-labelledby="tip-report-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">STUDENT INSIGHT</p>
              <h2 id="tip-report-title">구조화 학습 팁</h2>
            </div>
            <span className="week-pill">응답 {tipAggregate.count}건</span>
          </div>
          <p>수강생 참고 정보{tipAggregate.includesDemo ? " · 데모 데이터 포함" : ""}</p>
          {tipAggregate.visible && tipAggregate.averages ? (
            <>
              <dl className="tip-averages">
                <div><dt>선수지식 필요도</dt><dd>{tipAggregate.averages.prerequisite}</dd></div>
                <div><dt>실습 비중</dt><dd>{tipAggregate.averages.practice}</dd></div>
                <div><dt>과제량</dt><dd>{tipAggregate.averages.workload}</dd></div>
              </dl>
              <ul className="tip-tags">
                {tipAggregate.tags.map(({ tag, count }) => (
                  <li key={tag}>{tag}<span>{count}</span></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="report-empty">응답 5건부터 집계를 공개합니다.</p>
          )}
        </section>
      </div>
    </main>
  );
}
