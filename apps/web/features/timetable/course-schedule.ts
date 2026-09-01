import type { CatalogCourse } from "@/features/catalog/catalog-data";

export function scheduleLabel(course: CatalogCourse): string {
  const { schedule } = course;

  if (!schedule) return "시간 미정";

  return `${schedule.day}요일 ${String(schedule.start).padStart(2, "0")}:00 · ${schedule.duration}시간`;
}
