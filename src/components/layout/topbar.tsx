import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export const SITE_NAME = "우리 반 배움터";

/** 로고 옆 작은 마스코트(웃는 새싹 얼굴). 장식용. */
function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="10" fill="var(--home-soft)" />
      {/* 새싹 */}
      <path d="M16 11c0-3 2-5 5-5 0 3-2 5-5 5Z" fill="var(--science-strong)" />
      <path d="M16 11c0-2.4-1.6-4-4-4 0 2.4 1.6 4 4 4Z" fill="var(--science-strong)" opacity="0.7" />
      {/* 얼굴 */}
      <circle cx="16" cy="19" r="8" fill="var(--card)" stroke="var(--home-strong)" strokeWidth="1.6" />
      <circle cx="13" cy="18" r="1.2" fill="var(--foreground)" />
      <circle cx="19" cy="18" r="1.2" fill="var(--foreground)" />
      <path d="M13.2 21.2c1.6 1.6 4 1.6 5.6 0" fill="none" stroke="var(--foreground)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="20.6" r="1.1" fill="var(--games-strong)" opacity="0.45" />
      <circle cx="21" cy="20.6" r="1.1" fill="var(--games-strong)" opacity="0.45" />
    </svg>
  );
}

/**
 * 전체 폭 상단 바. 모바일에서는 왼쪽에 햄버거(드로어) 버튼이 나타난다.
 * 반투명 흰 바 + blur라 페이지 배경의 연보라 빛이 은은하게 비친다(spec §4.2). 작은 기능 버튼은 둥근 lucide 아이콘.
 */
export function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/8 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-14 w-full items-center gap-2 px-3 sm:px-4">
        <MobileNavDrawer siteName={SITE_NAME} />
        <Link
          href="/"
          className="mr-auto flex min-w-0 items-center gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-2.5"
        >
          <LogoMark />
          <span className="truncate font-heading text-xl leading-none">{SITE_NAME}</span>
        </Link>
        {/* 휴대폰(375px)에서는 사이트 이름이 잘리지 않도록 예전 크기(32px)를 유지하고 sm부터 키운다. */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full sm:size-9"
            aria-label="검색"
            title="검색"
            render={<Link href="/search/" />}
            nativeButton={false}
          >
            <SearchIcon />
          </Button>
          <ThemeToggle className="rounded-full sm:size-9" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
