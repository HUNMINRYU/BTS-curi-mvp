import type { StudentRanking } from "@curi/db";

export function StudentRankingPanel({ ranking }: { readonly ranking: StudentRanking }) {
  return (
    <section className="ranking-panel section-card" aria-labelledby="ranking-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WEEKLY LEAGUE</p>
          <h2 id="ranking-title">이번 주 준비왕</h2>
        </div>
        <span className="week-pill">익명 랭킹</span>
      </div>
      <ol className="ranking-list">
        {ranking.leaders.map((entry) => (
          <li className={entry.isMe ? "ranking-row ranking-row--me" : "ranking-row"} key={entry.rank}>
            <strong>{entry.rank}위</strong>
            <span>{entry.displayName}</span>
            <b>{entry.totalPoints}P</b>
          </li>
        ))}
      </ol>
      <p className="ranking-me">
        내 순위 <strong>{ranking.me.rank}위</strong>
        <span>{ranking.me.totalPoints}P</span>
      </p>
      <small>학생 이름은 익명으로 표시됩니다.</small>
    </section>
  );
}
