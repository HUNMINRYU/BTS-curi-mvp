import { RecommendationsPanel } from "@/components/recommendations-panel";

export default function RecommendPage() {
  return (
    <main className="student-page">
      <header className="student-page-header">
        <div className="student-page-intro">
          <p className="eyebrow">PERSONAL COURSE MATCH</p>
          <h1>나를 이해하고,<br /><em>수업을 골라요.</em></h1>
          <p className="hero-copy">저장한 전공, 관심분야, 목표와 학습 방식을 바탕으로 과목을 추천합니다.</p>
        </div>
      </header>
      <div className="student-page-content">
        <RecommendationsPanel />
      </div>
    </main>
  );
}
