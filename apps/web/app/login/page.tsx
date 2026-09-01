import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="account-page" aria-labelledby="login-title">
      <section className="account-intro">
        <p className="eyebrow">WELCOME BACK TO CURI</p>
        <h1 id="login-title">다시 만나서<br /><em>반가워요.</em></h1>
        <p className="account-slogan">학생과 교수 모두 자신의 계정으로 안전하게 CURI를 이어서 사용할 수 있습니다.</p>
      </section>
      <LoginForm />
    </main>
  );
}
