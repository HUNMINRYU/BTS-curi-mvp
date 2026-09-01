export type SourceKind = "actual" | "demo";

export type Citation = {
  id: string;
  documentName: string;
  sourceKind: SourceKind;
  week: number | null;
  excerpt: string;
};

export type QaResult = {
  status: "answered" | "not_found" | "model_error";
  answer: string;
  citations: Citation[];
};

export type Preparation = {
  id: string;
  label: string;
  source: Citation;
};

export type WeekPlan = {
  week: number;
  topic: string;
  objectives: string[];
  assignment: string | null;
  method: string;
  source: Citation;
  preparations: Preparation[];
};

export type CourseData = {
  id: string;
  name: string;
  summary: string;
  objective: string;
  currentWeek: number;
  assessment: Array<{ label: string; weight: number }>;
  weeks: WeekPlan[];
};
