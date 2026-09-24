import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { TaggedPostList } from "@/components/class/tagged-post-list";
import { CommunityPostList } from "@/components/community/community-post-list";
import { HomeHero } from "@/components/dashboard/home-hero";
import { MenuShortcutCard } from "@/components/dashboard/menu-shortcut-card";
import { ScienceAppStatus } from "@/components/dashboard/science-app-status";
import { StatTiles } from "@/components/dashboard/stat-tile";
import { Icon3D, type Icon3DName } from "@/components/illustrations/icon-3d";
import { menuItems, type MenuColor } from "@/data/menu";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/** 홈 섹션 제목: 앞에 작은 3D 반짝이 + 조금 큰 Jua 글자(개정 2) */
function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 font-heading text-2xl font-normal sm:text-[1.75rem]">
      <Icon3D name="sparkles" size={30} className="size-7 sm:size-7.5" />
      {children}
    </h2>
  );
}

/**
 * 대시보드 정보 카드: 흰 둥근 카드 + 메뉴색 부드러운 그림자 + 큰 3D 아이콘 칩 + 제목(Jua) + 메뉴색 "더 보기" 알약.
 * 목록 글자가 페이지 배경(연보라)이 아니라 흰 카드 위에 놓여 대비가 안정적이다(redesign spec §4.3, 개정 2).
 */
function DashboardSection({
  id,
  title,
  image,
  color,
  moreHref,
  moreLabel,
  className,
  children,
}: {
  id: string;
  title: string;
  image: Icon3DName;
  color: MenuColor;
  moreHref?: string;
  /** 스크린리더용 링크 이름(예: "과학 수업 글 더 보기") */
  moreLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const colors = menuColorClasses[color];
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-[2rem] bg-card p-5 ring-1 ring-foreground/5 sm:p-7 dark:shadow-none dark:ring-foreground/10",
        colors.glowShadow,
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {/* 휴대폰에서는 칩·제목을 한 단계 작게(제목이 두 줄로 꺾이지 않게) */}
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl sm:size-14", colors.gradientBg)} aria-hidden>
          <Icon3D name={image} size={38} className="size-8 sm:size-9.5" />
        </span>
        <h2 id={id} className="mr-auto font-heading text-xl font-normal sm:text-2xl md:text-[1.7rem]">
          {title}
        </h2>
        {moreHref ? (
          <Link
            href={moreHref}
            aria-label={moreLabel}
            className={cn(
              "group/more inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-3",
              colors.pill,
              colors.focusRing,
            )}
          >
            더 보기
            <ArrowRightIcon className="size-4 transition-transform group-hover/more:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// 홈 대시보드(docs/community/spec.md §6: 최근 과학 수업 · 최근 자유게시판 · 학습게임 미리보기). 각 섹션은 독립적으로 데이터를 불러오므로 하나가 실패해도 나머지는 그대로 보인다.
// 디자인: docs/design/redesign/spec.md §4.3 + build-1b-instructions.md("더 화려하게") —
// 히어로(큰 부엉이 + 떠다니는 3D 소품 + 버튼 2개) → 기능 카드 3개 → 정보 카드 줄 → 정보 카드 섹션.
export default function Home() {
  const shortcuts = menuItems.filter((item) => item.href !== "/");

  return (
    <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-11">
      <HomeHero />

      <section aria-labelledby="shortcuts-heading" className="flex flex-col gap-5">
        <SectionTitle id="shortcuts-heading">어디로 가 볼까요?</SectionTitle>
        {/* 열 수는 본문 컬럼 폭(@container) 기준: 사이드바가 펼쳐진 태블릿에서는 한 줄에 하나씩 */}
        <div className="@container">
          <ul className="grid gap-5 @2xl:grid-cols-3">
            {shortcuts.map((item) => (
              <li key={item.id}>
                <MenuShortcutCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="glance-heading" className="flex flex-col gap-5">
        <SectionTitle id="glance-heading">우리 반 한눈에 보기</SectionTitle>
        <StatTiles />
      </section>

      <DashboardSection
        id="science-heading"
        title="최근 과학 수업"
        image="test-tube"
        color="science"
        moreHref="/science/"
        moreLabel="과학 수업 더 보기"
      >
        <div className="@container">
          <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2 @3xl:gap-8">
            <ScienceAppStatus />
            <TaggedPostList tag="과학" limit={3} accent="science" emptyTitle="아직 과학 수업 글이 없어요" />
          </div>
        </div>
      </DashboardSection>

      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
        <DashboardSection
          id="board-heading"
          title="최근 자유게시판"
          image="speech-balloon"
          color="board"
          moreHref="/board/"
          moreLabel="자유게시판 더 보기"
        >
          <CommunityPostList kind="board" limit={3} />
        </DashboardSection>
        <DashboardSection
          id="games-heading"
          title="학습게임 미리보기"
          image="video-game"
          color="games"
          moreHref="/games/"
          moreLabel="학습게임 더 보기"
        >
          <CommunityPostList kind="game" limit={3} />
        </DashboardSection>
      </div>
    </div>
  );
}
