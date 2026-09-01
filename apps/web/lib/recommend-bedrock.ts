import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

import type { RecommendationCandidate, RecommendationProfile } from "./recommendations";

const MODEL_ID = "global.anthropic.claude-sonnet-5";
const client = new BedrockRuntimeClient({});

export function buildRecommendationCommand(
  profile: RecommendationProfile,
  candidates: readonly RecommendationCandidate[],
): ConverseCommand {
  return new ConverseCommand({
    modelId: MODEL_ID,
    system: [{
      text: "당신은 대학 과목 추천 도우미입니다. 제공된 학생 프로필과 후보 정보만 사용하세요. 후보 중 서로 다른 3~5개만 고르고, 각 이유에는 전공·관심분야·목표·진로·학습방식·투자 시간 중 실제 프로필 값 하나 이상을 자연스러운 한국어로 명시하세요."
        + ' 설명이나 머리말 없이 JSON 객체 하나만 출력하세요. 형식은 {"recommendations":[{"courseId":"후보 ID","reason":"추천 이유"}]} 입니다.',
    }],
    messages: [{
      role: "user",
      content: [{
        text: JSON.stringify({
          profile,
          candidates: candidates.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            department: candidate.department,
            goalKeywords: candidate.goalKeywords,
            interestTags: candidate.interestTags,
            prerequisites: candidate.prerequisites,
            schedule: candidate.schedule,
          })),
        }),
      }],
    }],
    // 한국어 이유 3~5개는 800토큰에서 잘려 JSON 파싱이 깨졌다.
    inferenceConfig: { maxTokens: 2000 },
  });
}

function stripOuterJsonCodeFence(text: string): string {
  const match = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/.exec(text);
  return match?.[1] ?? text;
}

export async function generateRecommendationReasons(
  profile: RecommendationProfile,
  candidates: readonly RecommendationCandidate[],
): Promise<unknown> {
  const command = buildRecommendationCommand(profile, candidates);
  const response = await client.send(command);
  const text = response.output?.message?.content
    ?.flatMap((block) => ("text" in block && typeof block.text === "string" ? [block.text] : []))
    .join("\n")
    .trim();

  if (!text) throw new Error("Bedrock recommendation response contained no text.");
  return JSON.parse(stripOuterJsonCodeFence(text)) as unknown;
}
