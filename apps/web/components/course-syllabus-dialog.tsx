"use client";

import { useEffect, useRef, useState } from "react";

import type { CatalogCourse } from "@/features/catalog/catalog-data";
import { scheduleLabel } from "@/features/timetable/course-schedule";
import type { CourseData } from "@/lib/types";
import { SourceBadge } from "./source-badge";

const DIALOG_ID = "course-syllabus-dialog";

type CourseSyllabusProps = {
  course: CatalogCourse;
  details?: CourseData;
};

export function CourseSyllabusContents({ course, details }: CourseSyllabusProps) {
  return (
    <article className="syllabus-dialog-card">
      <header className="syllabus-dialog-header">
        <div>
          <p className="eyebrow">OFFICIAL COURSE PLAN</p>
          <h2 id="course-syllabus-title">{course.name} 강의계획서</h2>
        </div>
      </header>

      <div className="syllabus-summary">
        <SourceBadge sourceKind={course.sourceKind} />
        <p>{course.summary}</p>
        <dl>
          <div><dt>개설 학과</dt><dd>{course.department}</dd></div>
          <div><dt>난이도</dt><dd>{course.difficulty}</dd></div>
          <div><dt>수업 시간</dt><dd>{scheduleLabel(course)}</dd></div>
        </dl>
      </div>

      <div className="syllabus-basics">
        <section>
          <h3>선수지식</h3>
          {course.prerequisites.length > 0
            ? <ul>{course.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>필수 선수지식이 없습니다.</p>}
        </section>
        <section>
          <h3>학습 목표</h3>
          <ul>{course.goalKeywords.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>

      {details ? (
        <>
          <section className="syllabus-assessment">
            <h3>평가 방법</h3>
            <ul>
              {details.assessment.map((item) => (
                <li key={item.label}><span>{item.label}</span><strong>{item.weight}%</strong></li>
              ))}
            </ul>
          </section>
          <section className="syllabus-weeks">
            <h3>주차별 수업 계획</h3>
            <ol>
              {details.weeks.map((week) => (
                <li key={week.week}>
                  <span>{week.week}주차</span>
                  <div>
                    <strong>{week.topic}</strong>
                    <p>{week.method}</p>
                    {week.assignment ? <small>과제 · {week.assignment}</small> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </article>
  );
}

export function CourseSyllabusDialog({ course, details }: CourseSyllabusProps) {
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  function restoreLauncherFocus() {
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function closeDialog() {
    const dialog = dialogRef.current;

    if (dialog?.open) {
      dialog.close();
      return;
    }

    setOpen(false);
    restoreLauncherFocus();
  }

  function handleDialogClose() {
    setOpen(false);
    restoreLauncherFocus();
  }

  return (
    <>
      <button
        aria-controls={DIALOG_ID}
        aria-expanded={open}
        className="syllabus-launcher"
        onClick={() => setOpen(true)}
        ref={launcherRef}
        type="button"
      >
        강의계획서 보기
      </button>
      {open ? (
        <dialog
          aria-labelledby="course-syllabus-title"
          className="syllabus-dialog"
          id={DIALOG_ID}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
          onClose={handleDialogClose}
          ref={dialogRef}
        >
          <button
            aria-label="강의계획서 닫기"
            className="syllabus-dialog-close"
            onClick={closeDialog}
            type="button"
          >
            ×
          </button>
          <CourseSyllabusContents course={course} {...(details ? { details } : {})} />
        </dialog>
      ) : null}
    </>
  );
}
