"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AppUser } from "@curi/db";
import { CuriMascot } from "./curi-mascot";

export type GamificationSummary = {
  totalPoints: number;
  level: 1 | 2 | 3;
  badges: string[];
  newlyEarnedBadges: string[];
};

type AppTopbarClientProps = {
  currentPath?: string;
  gamification?: GamificationSummary | null;
  user: AppUser | null;
};

type MenuItem = {
  href: string;
  label: string;
};

export async function logoutSession(
  request: typeof fetch = fetch,
  navigate: (href: string) => void = (href) => window.location.assign(href),
): Promise<boolean> {
  const response = await request("/api/session", { method: "DELETE" });
  if (!response.ok) return false;

  navigate("/login");
  return true;
}

export function badgeAnnouncement(badges: readonly string[]): string {
  return badges.length > 0 ? `새 배지를 획득했습니다: ${badges.join(", ")}` : "";
}

function menuItems(user: AppUser | null): readonly MenuItem[] {
  if (!user) {
    return [
      { href: "/signup", label: "회원가입" },
      { href: "/login", label: "로그인" },
    ];
  }
  if (user.role === "professor") return [{ href: "/professor", label: "교수 리포트" }];
  return [
    { href: "/", label: "내 시간표" },
    { href: "/recommend", label: "과목 추천" },
    { href: "/profile", label: "프로필 수정" },
  ];
}

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/courses/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGamificationSummary(value: unknown): value is GamificationSummary {
  return typeof value === "object"
    && value !== null
    && "totalPoints" in value
    && typeof value.totalPoints === "number"
    && "level" in value
    && (value.level === 1 || value.level === 2 || value.level === 3)
    && "badges" in value
    && Array.isArray(value.badges)
    && value.badges.every((badge) => typeof badge === "string")
    && "newlyEarnedBadges" in value
    && Array.isArray(value.newlyEarnedBadges)
    && value.newlyEarnedBadges.every((badge) => typeof badge === "string");
}

export function AppTopbarClient({ currentPath, gamification: initialGamification = null, user }: AppTopbarClientProps) {
  const pathname = usePathname();
  const activePath = currentPath ?? pathname;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [gamification, setGamification] = useState(initialGamification);
  const [badgeStatus, setBadgeStatus] = useState(
    badgeAnnouncement(initialGamification?.newlyEarnedBadges ?? []),
  );

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    function onGamification(event: Event) {
      if (!(event instanceof CustomEvent) || !isGamificationSummary(event.detail)) return;
      setGamification(event.detail);
      setBadgeStatus(badgeAnnouncement(event.detail.newlyEarnedBadges));
    }

    window.addEventListener("curi:gamification", onGamification);
    return () => window.removeEventListener("curi:gamification", onGamification);
  }, []);

  async function logout() {
    setPendingLogout(true);
    setLogoutError("");
    try {
      if (!await logoutSession()) setLogoutError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } catch {
      setLogoutError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setPendingLogout(false);
    }
  }

  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <Link className="topbar-brand" href={user?.role === "professor" ? "/professor" : "/"} aria-label="CURI 홈">
          <CuriMascot className="topbar-brand-mascot" variant="brand" />
          <span className="topbar-brand-copy">CURI<small>학생을 이해하는 AI</small></span>
        </Link>

        <button
          aria-controls="app-topbar-menu"
          aria-expanded={open}
          aria-label={open ? "주요 메뉴 닫기" : "주요 메뉴 열기"}
          className="topbar-menu-button"
          onClick={() => setOpen((current) => !current)}
          ref={menuButtonRef}
          type="button"
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div className="app-topbar-menu" data-open={open ? "true" : "false"} id="app-topbar-menu" ref={menuRef}>
          <nav aria-label="주요 메뉴">
            {menuItems(user).map((item) => (
              <Link
                aria-current={isCurrentPath(activePath, item.href) ? "page" : undefined}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <div className="topbar-account" aria-label="계정 정보">
              <span className="topbar-user">{user.name}</span>
              {user.role === "student" && gamification ? (
                <span className="topbar-progress" aria-label={`${gamification.totalPoints}포인트, 레벨 ${gamification.level}`}>
                  <strong>{gamification.totalPoints}P</strong>
                  <span>Lv.{gamification.level}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {user ? (
            <button className="topbar-logout" disabled={pendingLogout} onClick={() => void logout()} type="button">
              {pendingLogout ? "로그아웃 중…" : "로그아웃"}
            </button>
          ) : null}
        </div>
      </div>
      <p aria-live="polite" className="topbar-status" role="status">{logoutError}</p>
      <p aria-live="polite" aria-atomic="true" className="visually-hidden" role="status">{badgeStatus}</p>
    </header>
  );
}
