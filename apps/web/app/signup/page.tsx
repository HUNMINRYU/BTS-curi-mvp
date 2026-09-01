import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="account-page" aria-labelledby="signup-title">
      <section className="account-intro">
        <p className="eyebrow">START WITH YOUR STORY</p>
        <h1 id="signup-title">수업보다 먼저,<br /><em>나를 알려주세요.</em></h1>
        <p className="account-slogan">학생 계정을 만들고 관심사와 목표를 알려주면 CURI가 나에게 맞는 시작점을 함께 찾습니다.</p>
      </section>
      <SignupForm />
    </main>
  );
}
