"use client";

import { useEffect, useState } from "react";

import { CuriMascot } from "@/components/curi-mascot";
import type { CatalogCourse } from "@/features/catalog/catalog-data";
import { courseGridLanes } from "@/features/timetable/course-schedule";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const PERIODS = Array.from({ length: 15 }, (_, index) => index + 1);
const PERIOD_START_MINUTES = 9 * 60;

type Day = (typeof DAYS)[number];
type MobileTab = Day | "all" | null;
type CourseSchedule = NonNullable<CatalogCourse["schedule"]>;

function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function periodTime(period: number): { startsAt: string; endsAt: string } {
  const startsAt = PERIOD_START_MINUTES + (period - 1) * 60;
  return {
    startsAt: formatTime(startsAt),
    endsAt: formatTime(startsAt + 50),
  };
}

export function periodLabel(period: number): string {
  const { startsAt, endsAt } = periodTime(period);
  const practicalLabel = period >= 13 ? " · 전공 실기" : "";
  return `${period}교시 · ${startsAt}–${endsAt}${practicalLabel}`;
}

function periodForScheduleStart(start: number): number {
  return start - 8;
}

function hasSchedule(course: CatalogCourse): course is CatalogCourse & { schedule: CourseSchedule } {
  return course.schedule !== null && course.schedule !== undefined;
}

function firstScheduledDay(courses: readonly CatalogCourse[]): Day | null {
  return DAYS.find((day) => courses.some(
    (course) => hasSchedule(course) && course.schedule.day === day,
  )) ?? null;
}

function courseTimeLabel(schedule: CourseSchedule): string {
  const startPeriod = periodForScheduleStart(schedule.start);
  const { startsAt } = periodTime(startPeriod);
  const { endsAt } = periodTime(startPeriod + schedule.duration - 1);
  return `${startsAt}–${endsAt} · ${schedule.duration}교시`;
}

export type TimetableProps = {
  initialCourses?: readonly CatalogCourse[];
};

function isCourseSchedule(value: unknown): value is {
  day: Day;
  start: number;
  duration: number;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && "day" in value && "start" in value && "duration" in value;
}

function isCoursesResponse(value: unknown): value is { courses: CatalogCourse[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("courses" in value) || !Array.isArray(value.courses)) {
    return false;
  }
  return value.courses.every((course) => typeof course === "object" && course !== null
    && "id" in course && "name" in course && "schedule" in course
    && typeof course.id === "string" && typeof course.name === "string"
    && (course.schedule === null || isCourseSchedule(course.schedule)));
}

export function Timetable({ initialCourses }: TimetableProps) {
  const [courses, setCourses] = useState<readonly CatalogCourse[] | null>(initialCourses ?? null);
  const [error, setError] = useState<string | null>(null);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  const [selectedMobileTab, setSelectedMobileTab] = useState<MobileTab>(() => (
    initialCourses ? firstScheduledDay(initialCourses) ?? "all" : null
  ));

  useEffect(() => {
    if (initialCourses) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/courses");
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        const body: unknown = await response.json();
        if (!response.ok || !isCoursesResponse(body)) {
          if (!cancelled) setError("시간표를 불러오지 못했습니다. 다시 시도해 주세요.");
          return;
        }
        if (!cancelled) {
          setCourses(body.courses);
          setSelectedMobileTab(firstScheduledDay(body.courses) ?? "all");
        }
      } catch {
        if (!cancelled) setError("시간표를 불러오지 못했습니다. 다시 시도해 주세요.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialCourses]);

  async function removeCourse(courseId: string) {
    setRemovingCourseId(courseId);
    setError(null);
    try {
      const response = await fetch("/api/courses", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const body: unknown = await response.json();
      if (!response.ok || !isCoursesResponse(body)) {
        setError("시간표에서 과목을 빼지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setCourses(body.courses);
    } catch {
      setError("시간표에서 과목을 빼지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setRemovingCourseId(null);
    }
  }

  return (
    <section className="timetable" aria-labelledby="timetable-title">
      <div className="section-heading timetable-heading">
        <div>
          <p className="eyebrow">WEEKLY COURSE PLAN</p>
          <h2 id="timetable-title">이번 주 시간표</h2>
        </div>
        <a className="timetable-recommendation-cta" href="/recommend">
          <CuriMascot className="timetable-recommendation-mascot" variant={courses?.length === 0 ? "sleeping" : "calendar"} />
          <span>
            <strong>과목 추천받기</strong>
            <small>전공·관심·목표에 맞는 수업 찾기</small>
          </span>
          <b aria-hidden="true">→</b>
        </a>
      </div>
      <p aria-live="polite" className="form-status" role="status">{error}</p>

      {courses === null && !error ? <p aria-live="polite">시간표를 불러오는 중입니다.</p> : null}
      {courses?.length === 0 ? (
        <div className="timetable-empty">
          <p>시간표가 비어 있습니다.</p>
          <a className="primary-button" href="/recommend">추천 과목 보러 가기</a>
        </div>
      ) : null}
      {courses && courses.length > 0 ? (() => {
        const scheduledCourses = courses.filter(hasSchedule);
        const unscheduledCourses = courses.filter((course) => !hasSchedule(course));
        const mobileTab = selectedMobileTab ?? firstScheduledDay(courses) ?? "all";
        const gridLanes = courseGridLanes(scheduledCourses);

        function renderCourseList(courseList: readonly CatalogCourse[]) {
          return (
            <ul>
              {courseList.map((course) => (
                <li key={course.id}>
                  <div>
                    <a href={`/courses/${course.id}`}>{course.name}</a>
                    <span>{hasSchedule(course) ? courseTimeLabel(course.schedule) : "시간 미정"}</span>
                    <span className="timetable-course-badges">
                      <span className="timetable-course-badge">{course.department}</span>
                    </span>
                  </div>
                  <button
                    aria-label={`${course.name} 시간표에서 빼기`}
                    className="timetable-remove-button"
                    disabled={removingCourseId === course.id}
                    onClick={() => void removeCourse(course.id)}
                    type="button"
                  >
                    {removingCourseId === course.id ? "제거 중…" : "빼기"}
                  </button>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <>
            <div className="timetable-grid-scroll">
            <div className="timetable-grid" role="grid" aria-label="주간 시간표">
              <div role="row" style={{ display: "contents" }}>
                <span aria-hidden="true" className="timetable-corner" />
                {DAYS.map((day) => <span className="timetable-day" key={day} role="columnheader">{day}</span>)}
              </div>
              {PERIODS.map((period) => (
                <div key={period} role="row" style={{ display: "contents" }}>
                  <span
                    className="timetable-hour"
                    role="rowheader"
                    style={{ gridColumn: 1, gridRow: period + 1 }}
                  >
                    {periodLabel(period)}
                  </span>
                  {DAYS.map((day) => (
                    <span
                      aria-hidden="true"
                      className="timetable-slot"
                      key={day}
                      role="gridcell"
                      style={{ gridColumn: DAYS.indexOf(day) + 2, gridRow: period + 1 }}
                    />
                  ))}
                  {scheduledCourses
                    .filter((course) => periodForScheduleStart(course.schedule.start) === period)
                    .map((course) => {
                      const lane = gridLanes.get(course.id) ?? { index: 0, count: 1 };
                      const compact = course.schedule.duration === 1 || lane.count > 1;
                      return (
                        <div
                        className={`timetable-course${compact ? " timetable-course--compact" : ""}${lane.count > 1 ? " timetable-course--overlap" : ""}`}
                        key={course.id}
                        role="gridcell"
                        style={{
                          gridColumn: DAYS.indexOf(course.schedule.day) + 2,
                          gridRow: `${period + 1} / span ${course.schedule.duration}`,
                          marginInlineStart: lane.count > 1
                            ? `calc(${(lane.index * 100) / lane.count}% + 0.25rem)`
                            : undefined,
                          width: lane.count > 1
                            ? `calc(${100 / lane.count}% - 0.5rem)`
                            : undefined,
                        }}
                      >
                        <a href={`/courses/${course.id}`}>{course.name}</a>
                        <span className="timetable-course-time">{courseTimeLabel(course.schedule)}</span>
                        <div className="timetable-course-actions">
                          <span className="timetable-course-badges">
                            <span className="timetable-course-badge">{course.department}</span>
                          </span>
                          <button
                            aria-label={`${course.name} 시간표에서 빼기`}
                            className="timetable-remove-button"
                            disabled={removingCourseId === course.id}
                            onClick={() => void removeCourse(course.id)}
                            type="button"
                          >
                            <span aria-hidden="true">{removingCourseId === course.id ? "…" : "×"}</span>
                            <span className="visually-hidden">
                              {removingCourseId === course.id ? "제거 중" : "빼기"}
                            </span>
                          </button>
                        </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
            </div>
            {unscheduledCourses.length > 0 ? (
              <div className="timetable-unscheduled" aria-label="시간 미정 과목">
                <h3>시간 미정</h3>
                {renderCourseList(unscheduledCourses)}
              </div>
            ) : null}
            <div className="timetable-mobile-list">
              <div aria-label="모바일 시간표 요일 선택" className="timetable-mobile-tabs" role="tablist">
                {DAYS.map((day) => (
                  <button
                    aria-controls={`timetable-mobile-panel-${day}`}
                    aria-selected={mobileTab === day}
                    className={`timetable-mobile-tab${mobileTab === day ? " timetable-mobile-tab--selected" : ""}`}
                    id={`timetable-mobile-tab-${day}`}
                    key={day}
                    onClick={() => setSelectedMobileTab(day)}
                    role="tab"
                    type="button"
                  >
                    {day}
                  </button>
                ))}
                <button
                  aria-controls="timetable-mobile-panel-all"
                  aria-selected={mobileTab === "all"}
                  className={`timetable-mobile-tab${mobileTab === "all" ? " timetable-mobile-tab--selected" : ""}`}
                  id="timetable-mobile-tab-all"
                  onClick={() => setSelectedMobileTab("all")}
                  role="tab"
                  type="button"
                >
                  전체
                </button>
              </div>
              {mobileTab === "all" ? (
                <div
                  aria-labelledby="timetable-mobile-tab-all"
                  className="timetable-mobile-panel"
                  id="timetable-mobile-panel-all"
                  role="tabpanel"
                >
                  {DAYS.map((day) => {
                    const dayCourses = scheduledCourses.filter((course) => course.schedule.day === day);
                    if (dayCourses.length === 0) return null;
                    return (
                      <section key={day}>
                        <h3>{day}요일</h3>
                        {renderCourseList(dayCourses)}
                      </section>
                    );
                  })}
                  {unscheduledCourses.length > 0 ? (
                    <section>
                      <h3>시간 미정</h3>
                      {renderCourseList(unscheduledCourses)}
                    </section>
                  ) : null}
                </div>
              ) : (
                <div
                  aria-labelledby={`timetable-mobile-tab-${mobileTab}`}
                  className="timetable-mobile-panel"
                  id={`timetable-mobile-panel-${mobileTab}`}
                  role="tabpanel"
                >
                  <h3>{mobileTab}요일</h3>
                  {renderCourseList(
                    scheduledCourses.filter((course) => course.schedule.day === mobileTab),
                  )}
                </div>
              )}
            </div>
          </>
        );
      })() : null}
    </section>
  );
}
