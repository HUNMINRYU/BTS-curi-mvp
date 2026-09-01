"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export type LoginCredentials = {
  username: string;
  password: string;
};

type LoginResponse = {
  redirectTo: "/onboarding" | "/recommend" | "/professor";
};

const LOGIN_ERROR = "아이디 또는 비밀번호를 확인해 주세요.";

export function loginFailureMessage(): string {
  return LOGIN_ERROR;
}

function isLoginResponse(value: unknown): value is LoginResponse {
  return typeof value === "object"
    && value !== null
    && "redirectTo" in value
    && (value.redirectTo === "/onboarding"
      || value.redirectTo === "/recommend"
      || value.redirectTo === "/professor");
}

export async function loginWithCredentials(
  credentials: LoginCredentials,
  request: typeof fetch = fetch,
  navigate: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  const response = await request("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !isLoginResponse(body)) return false;

  navigate(body.redirectTo);
  return true;
}

export function LoginForm() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const credentials = {
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    try {
      if (!await loginWithCredentials(credentials)) setError(loginFailureMessage());
    } catch {
      setError(loginFailureMessage());
    } finally {
      setIsSubmitting(false);
      const passwordInput = form.elements.namedItem("password");
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    }
  }

  return (
    <section className="login-card" aria-labelledby="login-form-title">
      <h2 id="login-form-title">CURI에 로그인</h2>
      <p>학생과 교수 모두 발급받은 아이디와 비밀번호로 로그인할 수 있어요.</p>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        <div className="account-field">
          <label htmlFor="login-username">아이디</label>
          <input
            autoCapitalize="none"
            autoComplete="username"
            id="login-username"
            name="username"
            required
            spellCheck={false}
            type="text"
          />
        </div>
        <div className="account-field">
          <label htmlFor="login-password">비밀번호</label>
          <input
            autoComplete="current-password"
            id="login-password"
            name="password"
            required
            type="password"
          />
        </div>
        <button className="primary-button account-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "로그인 중…" : "로그인"}
        </button>
      </form>
      <p aria-live="polite" className="form-status" role="status">{error}</p>
      <p className="account-switch">처음 오셨나요? <Link href="/signup">회원가입</Link></p>
    </section>
  );
}
