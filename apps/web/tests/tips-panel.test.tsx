import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TipsPanel } from "../components/tips-panel";
import type { TipAggregate } from "../lib/tips";

const initialAggregate: TipAggregate = {
  count: 12,
  visible: true,
  averages: { prerequisite: 2, practice: 2.3, workload: 1.8 },
  tags: [
    { tag: "VS Code 설치", count: 9 },
    { tag: "HTML/CSS 기초", count: 7 },
  ],
  includesDemo: true,
};

test("학습 팁 패널은 집계의 출처 경계와 응답 수를 표시한다", () => {
  const html = renderToStaticMarkup(<TipsPanel courseId="web-content-development" initialAggregate={initialAggregate} />);

  assert.match(html, /수강생 학습 팁/);
  assert.match(html, /수강생 참고 정보/);
  assert.match(html, /데모 데이터 포함/);
  assert.match(html, /12건/);
  assert.match(html, /2\.3/);
  assert.match(html, /VS Code 설치/);
});

test("학습 팁 입력은 세 척도, 복수 태그, 동의, 상태 영역을 이름으로 노출한다", () => {
  const html = renderToStaticMarkup(<TipsPanel courseId="web-content-development" initialAggregate={initialAggregate} />);

  assert.match(html, /선수지식 필요도/);
  assert.match(html, /실습 비중/);
  assert.match(html, /과제량/);
  assert.match(html, /준비 태그/);
  assert.match(html, /HTML\/CSS 기초/);
  assert.match(html, /JavaScript 기초/);
  assert.match(html, /구조화된 학습 팁 수집에 동의합니다/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /type="submit"/);
});
