import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AbilityDashboard } from "../features/profile/ability-dashboard";

test("능력 변화 대시보드는 시뮬레이션임을 밝히고 학기 전후를 비교한다", () => {
  const html = renderToStaticMarkup(<AbilityDashboard />);

  assert.match(html, /나의 능력 변화/);
  assert.match(html, /데모 데이터/);
  assert.match(html, /학기 전/);
  assert.match(html, /현재/);
  assert.match(html, /웹 구현력/);
  assert.match(html, /aria-label="웹 구현력 학기 전 35점, 현재 78점"/);
  assert.match(html, /실제 성적이나 평가 결과가 아닌 시뮬레이션/);
});
