import assert from "node:assert/strict";
import test from "node:test";

import { appMetadata } from "../lib/app-metadata";

test("브라우저 제목은 피벗된 CURI 브랜드를 사용한다", () => {
  assert.equal(appMetadata.title, "CURI | 학생을 이해하는 AI");
});
