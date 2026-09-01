"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

export function CourseBackButton() {
  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  }

  return (
    <Link
      aria-label="이전 페이지로 돌아가기"
      className="course-detail-back-mobile"
      href="/"
      onClick={goBack}
    >
      ←
    </Link>
  );
}
