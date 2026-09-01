/* Supplied CURI PNGs are served directly at their intrinsic guide dimensions. */
/* eslint-disable @next/next/no-img-element */

export type MascotVariant =
  | "brand"
  | "coach"
  | "roadmap"
  | "chatbot"
  | "reading"
  | "writing"
  | "checklist"
  | "calendar"
  | "chat"
  | "search"
  | "star"
  | "heart"
  | "question"
  | "running"
  | "sleeping";

export type RewardStage = "start" | "growing" | "complete";

const MASCOTS: Record<MascotVariant, { alt: string; height: number; width: number }> = {
  brand: { alt: "CURI 브랜드 캐릭터", height: 298, width: 259 },
  coach: { alt: "체크리스트를 안내하는 CURI", height: 230, width: 225 },
  roadmap: { alt: "학기 로드맵을 살펴보는 CURI", height: 245, width: 200 },
  chatbot: { alt: "질문을 듣는 CURI", height: 235, width: 225 },
  reading: { alt: "책을 읽는 CURI", width: 239, height: 289 },
  writing: { alt: "메모하는 CURI", width: 223, height: 285 },
  checklist: { alt: "체크리스트를 든 CURI", width: 239, height: 290 },
  calendar: { alt: "달력을 든 CURI", width: 262, height: 272 },
  chat: { alt: "말을 거는 CURI", width: 252, height: 264 },
  search: { alt: "과목을 찾는 CURI", width: 249, height: 274 },
  star: { alt: "별을 안은 CURI", width: 259, height: 279 },
  heart: { alt: "하트를 안은 CURI", width: 284, height: 252 },
  question: { alt: "궁금해하는 CURI", width: 261, height: 246 },
  running: { alt: "달리는 CURI", width: 284, height: 250 },
  sleeping: { alt: "잠든 CURI", width: 250, height: 230 },
};

const REWARD_PRESENTATIONS: Record<RewardStage, { message: string; variant: MascotVariant }> = {
  start: { message: "쿠리가 자고 있어요…", variant: "sleeping" },
  growing: { message: "쿠리가 달리는 중!", variant: "running" },
  complete: { message: "쿠리가 별을 안았어요! 이번 주 완주!", variant: "star" },
};

export function rewardPresentation(stage: RewardStage) {
  return REWARD_PRESENTATIONS[stage];
}

type CuriMascotProps = {
  className?: string;
  variant: MascotVariant;
};

export function CuriMascot({ className, variant }: CuriMascotProps) {
  const mascot = MASCOTS[variant];

  return (
    <img
      alt={mascot.alt}
      className={className}
      data-variant={variant}
      height={mascot.height}
      src={`/characters/curi-${variant}.png`}
      width={mascot.width}
    />
  );
}
