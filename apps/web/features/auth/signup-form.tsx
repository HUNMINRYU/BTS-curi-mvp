"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export type SignupRole = "student" | "professor";

export type SignupInput = {
  readonly username: string;
  readonly name: string;
  readonly password: string;
  readonly role: SignupRole;
  readonly professorInviteCode?: string;
};

type SignupResponse = {
  readonly redirectTo: "/onboarding" | "/professor";
};

const USERNAME_ERROR = "아이디는 영문 소문자, 숫자, 밑줄만 사용해 4~20자로 입력해 주세요.";
const NAME_ERROR = "이름은 공백을 제외하고 1~30자로 입력해 주세요.";
const PASSWORD_ERROR = "비밀번호는 10~72자로 입력해 주세요.";
const PROFESSOR_INVITE_ERROR = "교수 초대코드를 입력해 주세요.";
const SIGNUP_ERROR = "회원가입하지 못했습니다. 입력한 정보를 확인해 주세요.";

export function validateSignupInput(input: SignupInput): string | null {
  if (!/^[a-z0-9_]{4,20}$/.test(input.username)) return USERNAME_ERROR;
  const name = input.name.trim();
  if (name.length < 1 || name.length > 30) return NAME_ERROR;
  if (input.password.length < 10 || input.password.length > 72) return PASSWORD_ERROR;
  if (input.role === "professor" && !input.professorInviteCode?.trim()) {
    return PROFESSOR_INVITE_ERROR;
  }
  return null;
}

function isSignupResponse(value: unknown): value is SignupResponse {
  return typeof value === "object"
    && value !== null
    && "redirectTo" in value
    && (value.redirectTo === "/onboarding" || value.redirectTo === "/professor");
}

export async function createAccount(
  input: SignupInput,
  request: typeof fetch = fetch,
  navigate: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  const requestBody = input.role === "professor"
    ? {
        username: input.username,
        name: input.name.trim(),
        password: input.password,
        role: input.role,
        professorInviteCode: input.professorInviteCode?.trim(),
      }
    : {
        username: input.username,
        name: input.name.trim(),
        password: input.password,
        role: input.role,
      };
  const response = await request("/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const responseBody: unknown = await response.json().catch(() => null);
  if (response.status !== 201 || !isSignupResponse(responseBody)
    || responseBody.redirectTo !== (input.role === "professor" ? "/professor" : "/onboarding")) {
    return false;
  }

  navigate(responseBody.redirectTo);
  return true;
}

export function SignupForm() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<SignupRole>("student");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const credentials = {
      username: String(formData.get("username") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
    const input: SignupInput = role === "professor"
      ? {
          ...credentials,
          role,
          professorInviteCode: String(formData.get("professorInviteCode") ?? ""),
        }
      : { ...credentials, role };
    const validationError = validateSignupInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!await createAccount(input)) setError(SIGNUP_ERROR);
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
      <h2 id="signup-form-title">{role === "professor" ? "교수 계정 만들기" : "학생 계정 만들기"}</h2>
      <p>{role === "professor"
        ? "초대코드를 확인하면 익명 학급 인사이트 화면으로 이어집니다."
        : "간단한 계정 정보만 입력하면 내 수업 취향을 찾는 온보딩으로 이어집니다."}</p>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        <div className="account-field">
          <label htmlFor="signup-role">가입 역할</label>
          <select
            id="signup-role"
            name="role"
            onChange={(event) => {
              const selectedRole = event.currentTarget.value;
              if (selectedRole === "student" || selectedRole === "professor") {
                setRole(selectedRole);
              }
            }}
            value={role}
          >
            <option value="student">학생</option>
            <option value="professor">교수</option>
          </select>
        </div>
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
        <div className="account-field">
          <label htmlFor="signup-professor-invite-code">교수 초대코드</label>
          <input
            autoComplete="off"
            disabled={role !== "professor"}
            id="signup-professor-invite-code"
            maxLength={128}
            name="professorInviteCode"
            required={role === "professor"}
            type="password"
          />
          <small>교수 역할을 선택한 경우에만 입력합니다.</small>
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
