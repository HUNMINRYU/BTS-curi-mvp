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

## Chatbot overlay
- The sticky topbar owns the first `4.5rem` of the viewport. The fixed chatbot shell starts below that boundary and ends above the viewport safe-area inset.
- `.chatbot-panel` owns its vertical scroll. Long answers and citations scroll inside the panel; the document and topbar do not move to reveal them.
- Launcher and panel remain at `z-index: 20`; geometry, not z-index escalation, prevents topbar overlap.
- The fixed `.chatbot-shell` never captures background pointer input; only `.chatbot-panel` and `.chatbot-launcher` accept pointer events.

## Timetable course actions
- Desktop timetable cards use one `.timetable-course-actions` footer containing metadata badges at the start and the remove button at the end.
- The remove button keeps a minimum `2.75rem` hit target while its visible tile is `2rem`; this preserves touch accessibility without dominating the course card.
- Standard and one-period cards place the visible remove tile at the top-right. Narrow overlap cards reserve the bottom-right area so the course title can use the full lane width.
- Remove controls use the card/purple token pair, a visible focus ring, and 150ms hover/press feedback without changing layout bounds.
- Mobile and unscheduled lists keep their two-column content/action layout with the same button class and accessible course-specific label.

## Profile edit hierarchy
- Profile editing is the primary task: dark page header, one editor card, and one secondary insights rail.
- Ranking and ability simulation are grouped in `.profile-page-insights`, never peers of the editor in the page grid.
- At tablet widths the insight cards may share two columns; at mobile widths every region stacks into one column.

## Palette
Reuse existing CSS variables only: `--navy`, `--card`, `--purple`, `--purple-bright`, `--lavender`, plus the existing translucent overlays `rgba(255,255,255,0.16)` / `rgba(149,106,232,0.18)`. No new hex values.

## Typography
The bundled "Hakgyoansim Allimjang" font ships only two faces: 400 (regular) and 700 (bold). CSS must use only `font-weight: 400` (body/secondary copy) or `700` (labels, headings, buttons, emphasized values); intermediate numeric weights are unsupported and must not be reintroduced.

## Metadata pills and callouts (shared patterns)
- Small metadata pills (`.timetable-course-badge`, `.reward-badge`, `.source-badge`) share one geometry: `border-radius: 999px`, compact padding, `var(--purple)` text on `var(--lavender)`/`var(--card)`.
- Emphasis callouts (`.recommendation-reason`, `.recommendation-fallback`) use `background: var(--lavender)` with an `inset 3px 0 var(--purple)` leading border.
- Course detail back navigation: desktop uses the `← 내 시간표` text link (`.course-detail-back`); at or below `1023px` a bordered ghost button (`.course-detail-back-mobile`, `aria-label="이전 페이지로 돌아가기"`) appears and returns to the previous history entry, falling back to `/` when no history exists.
