export function AbilityDashboard() {
  const abilities = [
    { label: "웹 구현력", before: 35, current: 78 },
    { label: "문제 해결력", before: 42, current: 72 },
    { label: "협업 준비도", before: 50, current: 81 },
    { label: "학습 루틴", before: 28, current: 69 },
  ] as const;

  return (
    <section className="ability-dashboard section-card" aria-labelledby="ability-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEMESTER GROWTH</p>
          <h2 id="ability-title">나의 능력 변화</h2>
        </div>
        <span className="week-pill">데모 데이터</span>
      </div>
      <div className="ability-legend" aria-hidden="true">
        <span>학기 전</span><span>현재</span>
      </div>
      <ul className="ability-list">
        {abilities.map((ability) => (
          <li
            aria-label={`${ability.label} 학기 전 ${ability.before}점, 현재 ${ability.current}점`}
            key={ability.label}
          >
            <strong>{ability.label}</strong>
            <div className="ability-bars">
              <span style={{ width: `${ability.before}%` }}>{ability.before}</span>
              <span style={{ width: `${ability.current}%` }}>{ability.current}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="report-empty">실제 성적이나 평가 결과가 아닌 시뮬레이션입니다.</p>
    </section>
  );
}
