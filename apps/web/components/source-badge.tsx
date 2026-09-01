import type { SourceKind } from "@/lib/types";

const labels: Record<SourceKind, string> = {
  actual: "강의계획서",
  demo: "데모 데이터",
};

export function SourceBadge({ sourceKind }: { sourceKind: SourceKind }) {
  return <span className={`source-badge source-badge--${sourceKind}`}>{labels[sourceKind]}</span>;
}
