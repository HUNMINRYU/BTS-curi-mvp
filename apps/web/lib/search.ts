import type { Citation } from "./types";

const STOP_WORDS: Record<string, true> = {
  "과": true, "그": true, "및": true, "수": true, "은": true, "는": true,
  "이": true, "가": true, "을": true, "를": true, "에": true, "의": true,
  "로": true, "으로": true, "무엇": true, "무엇을": true, "어떻게": true,
  "하나요": true, "해야": true, "해야하나요": true, "인가요": true,
  "있나요": true, "주세요": true,
};

function tokens(value: string): string[] {
  return value
    .toLocaleLowerCase("ko")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && STOP_WORDS[token] !== true);
}

export function searchCitations(query: string, citations: Citation[], limit = 4): Citation[] {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0 || limit <= 0) return [];

  return citations
    .map((citation, index) => {
      const haystack = `${citation.week ?? ""}주차 ${citation.excerpt}`.toLocaleLowerCase("ko");
      const score = queryTokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { citation, index, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ citation }) => citation);
}
