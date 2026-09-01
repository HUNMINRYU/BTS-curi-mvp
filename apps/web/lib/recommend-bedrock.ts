import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

import type { RecommendationCandidate, RecommendationProfile } from "./recommendations";

const MODEL_ID = "global.anthropic.claude-sonnet-5";
const client = new BedrockRuntimeClient({});

const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          courseId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["courseId", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
} as const;


export function buildRecommendationCommand(
  profile: RecommendationProfile,
  candidates: readonly RecommendationCandidate[],
): ConverseCommand {
  return new ConverseCommand({
    modelId: MODEL_ID,
    system: [{
      text: "당신은 대학 과목 추천 도우미입니다. 제공된 학생 프로필과 후보 정보만 사용하세요. 후보 중 서로 다른 3~5개만 고르고, 각 이유에는 전공·관심분야·목표·진로·학습방식·투자 시간 중 실제 프로필 값 하나 이상을 자연스러운 한국어로 명시하세요.",
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
    inferenceConfig: { maxTokens: 800 },
    outputConfig: {
      textFormat: {
        type: "json_schema",
        structure: {
          jsonSchema: {
            name: "course_recommendations",
            description: "학생 프로필에 맞는 후보 과목과 추천 이유",
            schema: JSON.stringify(RECOMMENDATION_SCHEMA),
          },
        },
      },
    },
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
