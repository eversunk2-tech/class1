"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlagIcon, GraduationCapIcon, LayoutDashboardIcon, NewspaperIcon, ShieldCheckIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { UnreadCount } from "@/components/learning/learning-ui";
import type { MenuColor } from "@/data/menu";
import { useAdminContext } from "@/hooks/use-admin-context";
import { useUnreadFeedback } from "@/hooks/use-unread-feedback";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

export type AdminNavItem = {
  id: string;
  label: string;
  /** trailingSlash 설정에 맞춰 "/"로 끝낸다. */
  href: string;
  icon: LucideIcon;
  color: MenuColor;
};

/** 관리자 대시보드 메뉴. 존재하는 화면만 넣는다. */
export const adminNavItems: AdminNavItem[] = [
  { id: "overview", label: "개요", href: "/admin/", icon: LayoutDashboardIcon, color: "home" },
  // 학급별 '선생님 글'(docs/classes/spec.md 개정 2). 블로그 '글 관리'·'새 글 작성'은 메뉴에서만 뺐다(/admin/posts/·/admin/write/ 화면은 그대로 있음).
  { id: "notices", label: "선생님 글", href: "/admin/notices/", icon: NewspaperIcon, color: "science" },
  { id: "members", label: "회원 관리", href: "/admin/members/", icon: UsersIcon, color: "games" },
  { id: "learning", label: "학습 현황", href: "/admin/learning/", icon: GraduationCapIcon, color: "board" },
  { id: "community", label: "커뮤니티", href: "/admin/community/", icon: FlagIcon, color: "games" },
];

/** usePathname()은 basePath가 빠진 경로를 준다. 개요(/admin/)는 정확히 일치할 때만 활성. */
function isActive(item: AdminNavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (item.href === "/admin/") return path === "/admin/";
  return path.startsWith(item.href);
}

/**
 * 관리자 대시보드 크롬(docs/admin/spec.md §3.0).
 * - lg 이상: 본문 왼쪽 세로 메뉴(전역 사이드바와 별개)
 * - lg 미만: 본문 위 가로 스크롤 메뉴(개수가 적어 드로어 대신 탭 모양 링크)
 * 디자인 개편 4단계: 전역 사이드바와 같은 글꼴·모양으로 맞춘다 — 메뉴 이름은 본문 글꼴(Pretendard, 활성 600·비활성 500),
 * 둥근 줄(rounded-2xl), 활성 항목은 메뉴색 줄 배경 + 떠 있는 흰 칩. 아이콘은 lucide 그대로(spec §3.2).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // 학생이 보낸 안 읽은 피드백 수 → "학습 현황" 메뉴에 배지
  const unread = useUnreadFeedback();
  // 총괄 계정이면 메뉴 머리에 표시(docs/classes/spec.md 개정 1 — 총괄 = 전체 관리 + 자기 학급 담임)
  const { status, isSuperAdmin } = useAdminContext();
  const superAdmin = status === "ready" && isSuperAdmin;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="lg:sticky lg:top-20 lg:w-52 lg:shrink-0 lg:self-start">
        <p className="mb-2 hidden items-center gap-1.5 px-2.5 text-xs font-medium text-muted-foreground lg:flex">
          <ShieldCheckIcon className="size-3.5" aria-hidden />
          관리자{superAdmin ? " · 총괄" : ""}
        </p>
        <nav aria-label="관리자 메뉴">
          <ul className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible lg:py-0">
            {adminNavItems.map((item) => {
              const active = isActive(item, pathname);
              const colors = menuColorClasses[item.color];
              const Icon = item.icon;
              return (
                <li key={item.id} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/admin-nav flex h-10 items-center gap-2.5 rounded-2xl px-2 pr-3.5 text-[0.95rem] outline-none transition-colors focus-visible:ring-3 lg:h-11",
                      colors.focusRing,
                      active
                        ? cn(colors.softBg, "font-semibold text-foreground")
                        : "font-medium text-foreground/80 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-xl lg:size-8",
                        // 활성 항목은 줄 전체가 메뉴색이라 칩을 떠 있는 흰 카드로 바꿔 구분한다(전역 사이드바와 같은 방식).
                        active
                          ? cn("bg-card shadow-(--shadow-md) ring-1 ring-foreground/5 dark:shadow-none", colors.strongText)
                          : colors.chip,
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="whitespace-nowrap leading-none">{item.label}</span>
                    {item.id === "learning" ? <UnreadCount count={unread} className="lg:ml-auto" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/**
 * 대시보드 화면 공통 제목 영역.
 * 제목은 사이트 H1과 같은 제목 글꼴(G마켓 산스, spec §1.5 H1 단계)로 — 관리자 메뉴·섹션 제목과도 맞춘다.
 * 관리자 화면은 제목 그림자만 없다(admin-theme.css --heading-shadow:none, spec 개정 2).
 */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-heading text-2xl leading-tight font-normal sm:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
