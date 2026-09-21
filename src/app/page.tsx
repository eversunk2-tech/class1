import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  FlameIcon,
  FlaskConicalIcon,
  Gamepad2Icon,
  NewspaperIcon,
  RulerIcon,
  type LucideIcon,
} from "lucide-react";
import { AppGrid } from "@/components/apps/app-grid";
import { TaggedPostList } from "@/components/class/tagged-post-list";
import { MenuShortcutCard } from "@/components/dashboard/menu-shortcut-card";
import { PopularPosts } from "@/components/dashboard/popular-posts";
import { StatTiles } from "@/components/dashboard/stat-tile";
import { HomeIllustration } from "@/components/illustrations/home-illustration";
import { PageHero } from "@/components/layout/page-hero";
import { SITE_NAME } from "@/components/layout/topbar";
import { menuItems, type MenuColor } from "@/data/menu";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/** 대시보드 섹션 틀: 아이콘 칩 + 제목(Jua) + 오른쪽 "더 보기" 링크 */
function DashboardSection({
  id,
  title,
  icon: Icon,
  color,
  moreHref,
  moreLabel,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  color: MenuColor;
  moreHref?: string;
  /** 스크린리더용 링크 이름(예: "과학 수업 글 더 보기") */
  moreLabel?: string;
  children: ReactNode;
}) {
  const colors = menuColorClasses[color];
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", colors.chip)} aria-hidden>
          <Icon className="size-5" />
        </span>
        <h2 id={id} className="mr-auto font-heading text-xl font-normal sm:text-2xl">
          {title}
        </h2>
        {moreHref ? (
          <Link
            href={moreHref}
            aria-label={moreLabel}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            더 보기
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// 홈 대시보드(spec §4.1, §12). 각 섹션은 독립적으로 데이터를 불러오므로 하나가 실패해도 나머지는 그대로 보인다.
export default function Home() {
  const shortcuts = menuItems.filter((item) => item.href !== "/");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <PageHero
        color="home"
        eyebrow="오늘도 반가워요"
        title={
          <>
            안녕하세요! <span className="whitespace-nowrap">{SITE_NAME}예요</span>
          </>
        }
        description="우리 반이 함께 배우고 만든 것을 모아 둔 곳이에요. 궁금한 메뉴를 눌러 구경해 봐요!"
        illustration={HomeIllustration}
      />

      <section aria-label="한눈에 보기">
        <StatTiles />
      </section>

      <section aria-labelledby="shortcuts-heading" className="flex flex-col gap-4">
        <h2 id="shortcuts-heading" className="font-heading text-xl font-normal sm:text-2xl">
          어디로 가 볼까요?
        </h2>
        {/* 열 수는 본문 컬럼 폭(@container) 기준: 사이드바가 펼쳐진 태블릿에서는 한 줄에 하나씩 */}
        <div className="@container">
          <ul className="grid gap-4 @2xl:grid-cols-3">
            {shortcuts.map((item) => (
              <li key={item.id}>
                <MenuShortcutCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-10 xl:grid-cols-2 xl:gap-8">
        <DashboardSection
          id="recent-heading"
          title="최근 소식"
          icon={NewspaperIcon}
          color="home"
          moreHref="/search/"
          moreLabel="전체 글 더 보기"
        >
          <TaggedPostList limit={5} accent="home" emptyTitle="아직 올라온 소식이 없어요" />
        </DashboardSection>
        <DashboardSection id="popular-heading" title="인기 글" icon={FlameIcon} color="games">
          <PopularPosts limit={3} />
        </DashboardSection>
      </div>

      <div className="grid gap-10 xl:grid-cols-2 xl:gap-8">
        <DashboardSection
          id="science-heading"
          title="최근 과학 수업"
          icon={FlaskConicalIcon}
          color="science"
          moreHref="/science/"
          moreLabel="과학 수업 글 더 보기"
        >
          <TaggedPostList tag="과학" limit={3} accent="science" />
        </DashboardSection>
        <DashboardSection
          id="math-heading"
          title="최근 수학 수업"
          icon={RulerIcon}
          color="math"
          moreHref="/math/"
          moreLabel="수학 수업 글 더 보기"
        >
          <TaggedPostList tag="수학" limit={3} accent="math" />
        </DashboardSection>
      </div>

      <DashboardSection
        id="games-heading"
        title="학습게임 미리보기"
        icon={Gamepad2Icon}
        color="games"
        moreHref="/games/"
        moreLabel="학습게임 더 보기"
      >
        <AppGrid limit={3} />
      </DashboardSection>
    </div>
  );
}
