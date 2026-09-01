import assert from "node:assert/strict";
import test from "node:test";

import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

import { buildAnswerCommand } from "../lib/bedrock";
import { buildRecommendationCommand, generateRecommendationReasons } from "../lib/recommend-bedrock";
import type { Citation } from "../lib/types";

const citation: Citation = {
  id: "week-7-preparation",
  documentName: "7주차 실습 준비 안내",
  sourceKind: "demo",
  week: 7,
  excerpt: "실습 전에 VS Code를 설치하고 실행 여부를 확인하세요.",
};

function mockRecommendationResponse(text: string): () => void {
  const originalSend = BedrockRuntimeClient.prototype.send;
  Object.defineProperty(BedrockRuntimeClient.prototype, "send", {
    configurable: true,
    value: async () => ({
      output: { message: { content: [{ text }] } },
    }),
  });

  return () => {
    Object.defineProperty(BedrockRuntimeClient.prototype, "send", {
      configurable: true,
      value: originalSend,
    });
  };
}

async function generateReasonsFromResponse(text: string): Promise<unknown> {
  const restore = mockRecommendationResponse(text);
  try {
    return await generateRecommendationReasons(
      {
        major: "컴퓨터공학과",
        interest: "웹 개발",
        goal: "포트폴리오",
        career: "프론트엔드 개발자",
        style: "직접 해보기",
        hours: "주 5시간",
        avoid: null,
      },
      [{
        id: "web-content-development",
        name: "웹컨텐츠개발",
        department: "컴퓨터공학과",
        goalKeywords: ["웹프로그램"],
        interestTags: ["웹 개발"],
        prerequisites: [],
        schedule: { day: "월", start: 9, duration: 2 },
      }],
    );
  } finally {
    restore();
  }
}

test("Claude Sonnet 5 Q&A 요청은 지원 중단된 temperature를 보내지 않는다", () => {
  const command = buildAnswerCommand("무엇을 준비해야 하나요?", [citation]);

  assert.deepEqual(command.input.inferenceConfig, { maxTokens: 500 });
  assert.equal("temperature" in (command.input.inferenceConfig ?? {}), false);
});

test("Claude Sonnet 5 추천 요청은 지원 중단된 temperature를 보내지 않는다", () => {
  const command = buildRecommendationCommand(
    {
      major: "컴퓨터공학과",
      interest: "웹 개발",
      goal: "포트폴리오",
      career: "프론트엔드 개발자",
      style: "직접 해보기",
      hours: "주 5시간",
      avoid: "디자인",
    },
    [{
      id: "web-content-development",
      name: "웹컨텐츠개발",
      department: "컴퓨터공학과",
      goalKeywords: ["웹프로그램"],
      interestTags: ["웹 개발"],
      prerequisites: [],
      schedule: { day: "월", start: 9, duration: 2 },
    }],
  );

  assert.deepEqual(command.input.inferenceConfig, { maxTokens: 2000 });
  assert.equal("temperature" in (command.input.inferenceConfig ?? {}), false);
});

test("추천 응답의 공백 포함 JSON 코드 펜스는 일반 JSON과 동일하게 파싱한다", async () => {
  const expected = {
    recommendations: [{
      courseId: "web-content-development",
      reason: "웹 개발 관심과 포트폴리오 목표에 맞는 제작 수업입니다.",
    }],
  };
  const json = JSON.stringify(expected);
  const plain = await generateReasonsFromResponse(json);

  assert.deepEqual(plain, expected);
  await assert.doesNotReject(async () => {
    const fenced = await generateReasonsFromResponse(`  \n\`\`\`json\n${json}\n\`\`\`  \n`);
    assert.deepEqual(fenced, plain);
  });
});

test("형식이 잘못된 JSON 코드 펜스 응답은 계속 거부한다", async () => {
  await assert.rejects(
    generateReasonsFromResponse("  \n\`\`\`json\n{recommendations: []}\n\`\`\`  \n"),
    SyntaxError,
  );
});

// 배포 환경의 Bedrock은 이 요청의 outputConfig를 거부한다.
// ValidationException: "output_config.format: Extra inputs are not permitted"
// 그 결과 추천 이유가 매번 결정론적 폴백으로 대체됐다.
test("추천 요청은 모델이 거부하는 outputConfig를 보내지 않는다", () => {
  const command = buildRecommendationCommand(
    {
      major: "컴퓨터공학과",
      interest: "웹 개발",
      goal: "포트폴리오",
      career: "프론트엔드 개발자",
      style: "직접 해보기",
      hours: "주 5시간",
      avoid: null,
    },
    [{
      id: "web-content-development",
      name: "웹컨텐츠개발",
      department: "컴퓨터공학과",
      goalKeywords: ["웹프로그램"],
      interestTags: ["웹 개발"],
      prerequisites: [],
      schedule: { day: "월", start: 9, duration: 2 },
    }],
  );

  assert.equal(command.input.outputConfig, undefined);
  // 한국어 이유 3~5개는 800토큰에서 잘려 JSON이 끊겼다.
  // SyntaxError: "Unterminated string in JSON at position 549"
  assert.deepEqual(command.input.inferenceConfig, { maxTokens: 2000 });
});
