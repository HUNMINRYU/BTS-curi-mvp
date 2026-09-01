import { SignupForm } from "@/features/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="account-page" aria-labelledby="signup-title">
      <section className="account-intro">
        <p className="eyebrow">START WITH YOUR STORY</p>
        <h1 id="signup-title">수업보다 먼저,<br /><em>나를 알려주세요.</em></h1>
        <p className="account-slogan">학생은 관심사와 목표를 바탕으로 수업을 찾고, 교수는 초대코드로 익명 학급 인사이트를 확인합니다.</p>
      </section>
      <SignupForm />
    </main>
  );
}
