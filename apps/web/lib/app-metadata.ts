import type { Metadata } from "next";

export const appMetadata: Metadata = {
  title: "CURI | 학생을 이해하는 AI",
  description: "학생의 전공·관심·목표를 이해해 맞춤 과목을 추천하고, 수업 준비부터 실행까지 안내하는 AI 학습 내비게이터",
  icons: {
    icon: "/icon-192x192.png",
    apple: "/apple-icon-180x180.png",
  },
  manifest: "/manifest.webmanifest",
};
