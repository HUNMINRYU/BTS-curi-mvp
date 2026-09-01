"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export type SignupInput = {
  username: string;
  name: string;
  password: string;
};

type SignupResponse = {
  redirectTo: string;
};

const USERNAME_ERROR = "아이디는 영문 소문자, 숫자, 밑줄만 사용해 4~20자로 입력해 주세요.";
const NAME_ERROR = "이름은 공백을 제외하고 1~30자로 입력해 주세요.";
const PASSWORD_ERROR = "비밀번호는 10~72자로 입력해 주세요.";
const SIGNUP_ERROR = "회원가입하지 못했습니다. 입력한 정보를 확인해 주세요.";

export function validateSignupInput(input: SignupInput): string | null {
  if (!/^[a-z0-9_]{4,20}$/.test(input.username)) return USERNAME_ERROR;
  const name = input.name.trim();
  if (name.length < 1 || name.length > 30) return NAME_ERROR;
  if (input.password.length < 10 || input.password.length > 72) return PASSWORD_ERROR;
  return null;
}

function isSignupResponse(value: unknown): value is SignupResponse {
  return typeof value === "object"
    && value !== null
    && "redirectTo" in value
    && value.redirectTo === "/onboarding";
}

export async function createStudentAccount(
  input: SignupInput,
  request: typeof fetch = fetch,
  navigate: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  const response = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, name: input.name.trim() }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.status !== 201 || !isSignupResponse(body)) return false;

  navigate(body.redirectTo);
  return true;
}

export function SignupForm() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: SignupInput = {
      username: String(formData.get("username") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
    const validationError = validateSignupInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!await createStudentAccount(input)) setError(SIGNUP_ERROR);
    } catch {
      setError(SIGNUP_ERROR);
    } finally {
      setIsSubmitting(false);
      const passwordInput = form.elements.namedItem("password");
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    }
  }

  return (
    <section className="login-card" aria-labelledby="signup-form-title">
      <h2 id="signup-form-title">학생 계정 만들기</h2>
      <p>간단한 계정 정보만 입력하면 내 수업 취향을 찾는 온보딩으로 이어집니다.</p>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        <div className="account-field">
          <label htmlFor="signup-username">아이디</label>
          <input
            aria-describedby="signup-username-rules"
            autoCapitalize="none"
            autoComplete="username"
            id="signup-username"
            maxLength={20}
            minLength={4}
            name="username"
            pattern="[a-z0-9_]{4,20}"
            required
            spellCheck={false}
            type="text"
          />
          <small id="signup-username-rules">영문 소문자, 숫자, 밑줄을 사용해 4~20자</small>
        </div>
        <div className="account-field">
          <label htmlFor="signup-name">이름</label>
          <input
            aria-describedby="signup-name-rules"
            autoComplete="name"
            id="signup-name"
            maxLength={30}
            name="name"
            required
            type="text"
          />
          <small id="signup-name-rules">화면에 표시할 이름, 공백을 제외하고 1~30자</small>
        </div>
        <div className="account-field">
          <label htmlFor="signup-password">비밀번호</label>
          <input
            aria-describedby="signup-password-rules"
            autoComplete="new-password"
            id="signup-password"
            maxLength={72}
            minLength={10}
            name="password"
            required
            type="password"
          />
          <small id="signup-password-rules">10~72자</small>
        </div>
        <button className="primary-button account-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "계정 만드는 중…" : "회원가입하고 시작하기"}
        </button>
      </form>
      <p aria-live="polite" className="form-status" role="status">{error}</p>
      <p className="account-switch">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
    </section>
  );
}
