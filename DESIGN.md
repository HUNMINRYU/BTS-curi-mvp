# CURI Design Contract (Topbar / Account Area)

This document codifies the existing implicit design patterns of the app topbar.
It describes what already ships; it does not introduce new tokens or redesigns.

## Topbar structure
- `header.app-topbar` > `.app-topbar-inner` contains: brand link (`CuriMascot` + "CURI 학생을 이해하는 AI"), hamburger `.topbar-menu-button`, and `.app-topbar-menu` (nav + account + logout).
- Mobile menu toggles via `data-open="true"|"false"`; Escape closes and returns focus to the menu button.

## Account area
- `.topbar-account`: flex row, `gap: 0.65rem`, separated by a `1px rgba(255,255,255,0.16)` left border on wide desktop; below `1024px` the topbar uses its menu button and the account area becomes a full-width row separated by a top border (`border-left: 0`, `justify-content: flex-start` with the same `0.65rem` gap, wrapping allowed).
- `.topbar-user`: student name, `color: var(--card)`, `font-size: 0.82rem`, `font-weight: 700`.
- Progress pill `.topbar-progress`: inline-flex pill, `border-radius: 999px`, `padding: 0.35rem 0.55rem`, translucent purple background `rgba(149,106,232,0.18)`, `color: var(--card)`, `font-size: 0.72rem`; the points value (`strong`) shares the same `0.72rem` size and is emphasized only by `var(--purple-bright)` color and bold weight. Points and level carry a combined `aria-label`.

## Badges in the account area
- Earned badges render as a list (`ul.topbar-badges`, `aria-label="획득한 배지"`) of pill items (`.topbar-badge`) reusing the `.topbar-progress` pill geometry and translucent purple background; they sit inline on desktop and wrap on mobile. Nothing renders when the student has no badges.
- Newly earned badges are announced through a visually-hidden `aria-live="polite"` `role="status"` region (`.visually-hidden`) using the exact badge names from `badgeAnnouncement`.

## Focus / interaction
- Nav links show hover/current state with `rgba(149,106,232,0.18)` background; current page gets an inset `var(--purple-bright)` underline.
- `.topbar-logout` is a ghost button (`1px rgba(255,255,255,0.2)` border, transparent background), hover border `var(--purple-bright)`, disabled state `opacity: 0.55`.
- Errors surface in `.topbar-status`, an `aria-live="polite"` paragraph under the topbar.

## Palette
Reuse existing CSS variables only: `--navy`, `--card`, `--purple`, `--purple-bright`, `--lavender`, plus the existing translucent overlays `rgba(255,255,255,0.16)` / `rgba(149,106,232,0.18)`. No new hex values.

## Typography
The bundled "Hakgyoansim Allimjang" font ships only two faces: 400 (regular) and 700 (bold). CSS must use only `font-weight: 400` (body/secondary copy) or `700` (labels, headings, buttons, emphasized values); intermediate numeric weights are unsupported and must not be reintroduced.

## Metadata pills and callouts (shared patterns)
- Small metadata pills (`.timetable-course-badge`, `.reward-badge`, `.source-badge`) share one geometry: `border-radius: 999px`, compact padding, `var(--purple)` text on `var(--lavender)`/`var(--card)`.
- Emphasis callouts (`.recommendation-reason`, `.recommendation-fallback`) use `background: var(--lavender)` with an `inset 3px 0 var(--purple)` leading border.
- Course detail back navigation: desktop uses the `← 내 시간표` text link (`.course-detail-back`); at or below `1023px` a bordered ghost button (`.course-detail-back-mobile`, `aria-label="이전 페이지로 돌아가기"`) appears and returns to the previous history entry, falling back to `/` when no history exists.
