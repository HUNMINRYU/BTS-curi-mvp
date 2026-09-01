import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LoginForm,
  loginFailureMessage,
  loginWithCredentials,
} from "../features/auth/login-form";
import {
  SignupForm,
  createAccount,
  validateSignupInput,
} from "../features/auth/signup-form";

test("login submits username and password in a JSON request and follows the server role redirect", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  let destination = "";

  const didLogin = await loginWithCredentials(
    { username: "professor-test", password: "a-secure-password" },
    async (input, init) => {
      requests.push({ input, init });
      return Response.json({ redirectTo: "/professor" });
    },
    (href) => {
      destination = href;
    },
  );

  assert.equal(didLogin, true);
  assert.deepEqual(requests, [{
    input: "/api/session",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "professor-test", password: "a-secure-password" }),
    },
  }]);
  assert.equal(destination, "/professor");
  assert.doesNotMatch(destination, /a-secure-password/);
});

test("login renders a generic failure without retaining the submitted password", async () => {
  const markup = renderToStaticMarkup(<LoginForm />);
  const didLogin = await loginWithCredentials(
    { username: "student-test", password: "not-the-right-password" },
    async () => Response.json({ error: "internal detail" }, { status: 401 }),
    () => assert.fail("failed login must not navigate"),
  );

  assert.equal(didLogin, false);
  assert.doesNotMatch(markup, /not-the-right-password|value="[^"]+"/);
  assert.equal(loginFailureMessage(), "아이디 또는 비밀번호를 확인해 주세요.");
});

test("signup validation enforces the public credential rules", () => {
  assert.equal(validateSignupInput({ username: "Student", name: "학생", password: "1234567890", role: "student" }), "아이디는 영문 소문자, 숫자, 밑줄만 사용해 4~20자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "abc", name: "학생", password: "1234567890", role: "student" }), "아이디는 영문 소문자, 숫자, 밑줄만 사용해 4~20자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "student_1", name: "   ", password: "1234567890", role: "student" }), "이름은 공백을 제외하고 1~30자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "student_1", name: "학생", password: "short", role: "student" }), "비밀번호는 10~72자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "student_1", name: "  새 학생  ", password: "1234567890", role: "student" }), null);
  assert.equal(validateSignupInput({ username: "professor_1", name: "교수", password: "1234567890", role: "professor" }), "교수 초대코드를 입력해 주세요.");
});

test("signup trims display name, creates a student account, and follows onboarding redirect", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  let destination = "";

  const didSignup = await createAccount(
    { username: "student_1", name: "  새 학생  ", password: "1234567890", role: "student" },
    async (input, init) => {
      requests.push({ input, init });
      return Response.json({ redirectTo: "/onboarding" }, { status: 201 });
    },
    (href) => {
      destination = href;
    },
  );

  assert.equal(didSignup, true);
  assert.deepEqual(requests, [{
    input: "/api/signup",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "student_1",
        name: "새 학생",
        password: "1234567890",
        role: "student",
      }),
    },
  }]);
  assert.equal(destination, "/onboarding");
});

test("signup sends the professor role and invite code before following the professor redirect", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  let destination = "";
  const professorInput = {
    username: "professor_1",
    name: "새 교수",
    password: "1234567890",
    role: "professor" as const,
    professorInviteCode: "faculty-invite",
  };

  const didSignup = await createAccount(
    professorInput,
    async (input, init) => {
      requests.push({ input, init });
      return Response.json({ redirectTo: "/professor" }, { status: 201 });
    },
    (href) => {
      destination = href;
    },
  );

  assert.equal(didSignup, true);
  assert.deepEqual(requests, [{
    input: "/api/signup",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "professor_1",
        name: "새 교수",
        password: "1234567890",
        role: "professor",
        professorInviteCode: "faculty-invite",
      }),
    },
  }]);
  assert.equal(destination, "/professor");
});

test("signup form exposes browser validation and accessible rule descriptions", () => {
  const markup = renderToStaticMarkup(<SignupForm />);

  assert.match(markup, /<select[^>]*id="signup-role"[^>]*name="role"[^>]*>/);
  assert.match(markup, /<option[^>]*value="student"[^>]*>학생<\/option>/);
  assert.match(markup, /<option[^>]*value="professor"[^>]*>교수<\/option>/);
  assert.match(markup, /<input(?=[^>]*id="signup-professor-invite-code")(?=[^>]*name="professorInviteCode")(?=[^>]*type="password")[^>]*>/);
  assert.match(markup, /<input(?=[^>]*id="signup-username")(?=[^>]*pattern="\[a-z0-9_\]\{4,20\}")(?=[^>]*aria-describedby="signup-username-rules")[^>]*>/);
  assert.match(markup, /<input(?=[^>]*id="signup-name")(?=[^>]*maxLength="30")(?=[^>]*aria-describedby="signup-name-rules")[^>]*>/);
  assert.match(markup, /<input(?=[^>]*id="signup-password")(?=[^>]*minLength="10")(?=[^>]*maxLength="72")(?=[^>]*type="password")[^>]*>/);
  assert.match(markup, /aria-live="polite"/);
});
