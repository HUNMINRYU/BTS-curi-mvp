import type { CatalogCourse } from "@/features/catalog/catalog-data";

type ScheduledCourse = CatalogCourse & {
  readonly schedule: NonNullable<CatalogCourse["schedule"]>;
};

export type CourseGridLane = {
  readonly index: number;
  readonly count: number;
};

function isScheduledCourse(course: CatalogCourse): course is ScheduledCourse {
  return course.schedule !== null && course.schedule !== undefined;
}

export function courseGridLanes(
  courses: readonly CatalogCourse[],
): ReadonlyMap<string, CourseGridLane> {
  const lanes = new Map<string, CourseGridLane>();
  const coursesByDay = new Map<string, ScheduledCourse[]>();
  for (const course of courses.filter(isScheduledCourse)) {
    const dayCourses = coursesByDay.get(course.schedule.day) ?? [];
    dayCourses.push(course);
    coursesByDay.set(course.schedule.day, dayCourses);
  }

  for (const dayCourses of coursesByDay.values()) {
    const sortedCourses = dayCourses.toSorted(
      (left, right) => left.schedule.start - right.schedule.start
        || left.id.localeCompare(right.id),
    );
    let component: ScheduledCourse[] = [];
    let componentEnd = -1;

    function assignComponent() {
      if (component.length === 0) return;
      const laneEnds: number[] = [];
      const laneIndexes = new Map<string, number>();
      for (const course of component) {
        const availableLane = laneEnds.findIndex((end) => end <= course.schedule.start);
        const laneIndex = availableLane === -1 ? laneEnds.length : availableLane;
        laneEnds[laneIndex] = course.schedule.start + course.schedule.duration;
        laneIndexes.set(course.id, laneIndex);
      }
      for (const course of component) {
        lanes.set(course.id, {
          index: laneIndexes.get(course.id) ?? 0,
          count: laneEnds.length,
        });
      }
    }

    for (const course of sortedCourses) {
      if (component.length > 0 && course.schedule.start >= componentEnd) {
        assignComponent();
        component = [];
      }
      component.push(course);
      componentEnd = Math.max(
        componentEnd,
        course.schedule.start + course.schedule.duration,
      );
    }
    assignComponent();
  }

  return lanes;
}

export function scheduleLabel(course: CatalogCourse): string {
  const { schedule } = course;

  if (!schedule) return "시간 미정";

  return `${schedule.day}요일 ${String(schedule.start).padStart(2, "0")}:00 · ${schedule.duration}시간`;
}
