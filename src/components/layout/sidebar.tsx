"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeftIcon, SparklesIcon } from "lucide-react";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { ScienceNavTree } from "@/components/layout/science-nav-tree";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isMenuActive, menuItems } from "@/data/menu";
import { useSidebar } from "@/hooks/use-sidebar";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/**
 * 메뉴 링크 목록. 데스크톱 사이드바와 모바일 드로어가 함께 쓴다.
 * - `collapsed`: 레일(아이콘만) 상태. 라벨은 CSS로 숨기고 tooltip으로 이름을 알려 준다.
 * - `onNavigate`: 링크를 누른 직후 호출(드로어 닫기용).
 * - 과학수업 항목에는 학기 → 단원 하위 트리(ScienceNavTree)가 붙는다. 레일 상태에서는 숨긴다.
 * - 칩 아이콘은 3D 그림(색을 바꿀 수 없음)이라, 활성 항목은 색이 아니라
 *   **줄 배경 + 떠 있는 흰 칩 + 굵은 글자(600)**로 구분한다(spec §3.3·§7). 라벨은 굵기 조절이 되는 본문 글꼴.
 */
export function NavMenuList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1.5">
      {menuItems.map((item) => {
        const active = isMenuActive(item, pathname);
        const colors = menuColorClasses[item.color];
        const hasSubtree = item.id === "science" && !collapsed;
        return (
          <li key={item.id} className={hasSubtree ? "relative" : undefined}>
            <Tooltip disabled={!collapsed}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "sidebar-link group/nav flex h-12 items-center gap-3 rounded-2xl px-1.5 text-[0.95rem] outline-none transition-colors focus-visible:ring-3",
                      colors.focusRing,
                      active
                        ? cn(colors.softBg, "font-semibold text-foreground")
                        : "font-medium text-foreground/80 hover:bg-muted hover:text-foreground",
                      // 하위 메뉴 펼침 버튼 자리
                      hasSubtree && "pr-11",
                    )}
                  />
                }
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover/nav:scale-105 motion-reduce:transition-none motion-reduce:group-hover/nav:scale-100",
                    // 활성 항목은 줄 전체가 soft 배경이므로 칩은 떠 있는 흰 카드로 바꿔 구분한다.
                    active ? "bg-card shadow-(--shadow-md) ring-1 ring-foreground/5 dark:shadow-none" : colors.softBg,
                  )}
                  aria-hidden
                >
                  <Icon3D name={item.image3d} size={26} className="size-6.5" />
                </span>
                <span className="sidebar-label truncate leading-none">{item.label}</span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
            {hasSubtree ? <ScienceNavTree onSciencePage={active} onNavigate={onNavigate} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

const SIDEBAR_NAV_ID = "app-sidebar-nav";

/** 데스크톱(md 이상) 고정 사이드바. 폭 전환은 globals.css의 .app-sidebar 규칙이 담당한다. */
export function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const toggleLabel = collapsed ? "메뉴 펼치기" : "메뉴 접기";

  return (
    // 반투명 흰 판(배경의 연보라 그라데이션이 은은히 비침). 다크에서는 기존 사이드바 색 그대로 반투명.
    <aside className="app-sidebar sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col gap-3 self-start overflow-x-hidden overflow-y-auto border-r border-foreground/8 bg-sidebar/75 p-3 backdrop-blur-xl md:flex">
      <div className="sidebar-toggle-row flex items-center justify-end">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={SIDEBAR_NAV_ID}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronsLeftIcon className="sidebar-toggle-icon size-5 transition-transform duration-200" aria-hidden />
        </button>
      </div>

      <nav id={SIDEBAR_NAV_ID} aria-label="주요 메뉴">
        <NavMenuList collapsed={collapsed} />
      </nav>

      {/* 펼침 상태에서만 보이는 작은 응원 카드(브랜드 보라를 살짝 섞은 바탕) */}
      <div className="sidebar-extra mt-auto rounded-2xl bg-primary/8 p-3.5 text-xs leading-relaxed text-foreground/75 ring-1 ring-primary/15">
        <p className="flex items-center gap-1.5 font-heading text-sm text-foreground">
          <SparklesIcon className="size-4 text-primary" aria-hidden />
          오늘도 즐겁게!
        </p>
        <p className="mt-1 text-balance">궁금한 건 언제든 찾아보고, 직접 해 봐요.</p>
      </div>
    </aside>
  );
}
