import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  LoginForm,
  loginFailureMessage,
  loginWithCredentials,
} from "../components/login-form";
import {
  SignupForm,
  createStudentAccount,
  validateSignupInput,
} from "../components/signup-form";

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
  assert.equal(validateSignupInput({ username: "Student", name: "학생", password: "1234567890" }), "아이디는 영문 소문자, 숫자, 밑줄만 사용해 4~20자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "abc", name: "학생", password: "1234567890" }), "아이디는 영문 소문자, 숫자, 밑줄만 사용해 4~20자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "student_1", name: "   ", password: "1234567890" }), "이름은 공백을 제외하고 1~30자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "student_1", name: "학생", password: "short" }), "비밀번호는 10~72자로 입력해 주세요.");
  assert.equal(validateSignupInput({ username: "student_1", name: "  새 학생  ", password: "1234567890" }), null);
});

test("signup trims display name, creates a student account, and follows onboarding redirect", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  let destination = "";

  const didSignup = await createStudentAccount(
    { username: "student_1", name: "  새 학생  ", password: "1234567890" },
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
      body: JSON.stringify({ username: "student_1", name: "새 학생", password: "1234567890" }),
    },
  }]);
  assert.equal(destination, "/onboarding");
});

test("signup form exposes browser validation and accessible rule descriptions", () => {
  const markup = renderToStaticMarkup(<SignupForm />);

  assert.match(markup, /<input(?=[^>]*id="signup-username")(?=[^>]*pattern="\[a-z0-9_\]\{4,20\}")(?=[^>]*aria-describedby="signup-username-rules")[^>]*>/);
  assert.match(markup, /<input(?=[^>]*id="signup-name")(?=[^>]*maxLength="30")(?=[^>]*aria-describedby="signup-name-rules")[^>]*>/);
  assert.match(markup, /<input(?=[^>]*id="signup-password")(?=[^>]*minLength="10")(?=[^>]*maxLength="72")(?=[^>]*type="password")[^>]*>/);
  assert.match(markup, /aria-live="polite"/);
});
