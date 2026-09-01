import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { Citation } from "./types";

const MODEL_ID = "global.anthropic.claude-sonnet-5";
const client = new BedrockRuntimeClient({});

export function buildAnswerCommand(question: string, citations: Citation[]): ConverseCommand {
  const context = citations
    .map((citation) => `[${citation.id}] ${citation.documentName} · ${citation.week ?? "공통"}주차 · ${citation.sourceKind}\n${citation.excerpt}`)
    .join("\n\n");

  return new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: "당신은 대학 수업 안내원입니다. 제공된 공식 근거만 사용하고, 근거 밖 내용은 추측하지 마세요. 답변은 한국어로 간결하게 작성하세요." }],
    messages: [{
      role: "user",
      content: [{ text: `[공식 근거]\n${context}\n\n[질문]\n${question}` }],
    }],
    inferenceConfig: { maxTokens: 500 },
  });
}

export async function answerWithBedrock(question: string, citations: Citation[]): Promise<string> {
  const command = buildAnswerCommand(question, citations);
  const response = await client.send(command);
  const text = response.output?.message?.content
    ?.flatMap((block) => ("text" in block && typeof block.text === "string" ? [block.text] : []))
    .join("\n")
    .trim();

  if (!text) throw new Error("Bedrock response contained no text.");
  return text;
}
