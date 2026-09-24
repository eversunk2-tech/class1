"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FilePenLineIcon,
  Gamepad2Icon,
  GraduationCapIcon,
  MessageCircleIcon,
  PenSquareIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { LoginRequiredCard } from "@/components/admin/login-required-card";
import { MemberAvatar, ProviderBadges } from "@/components/admin/member-badges";
import { StatTile } from "@/components/dashboard/stat-tile";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuColor } from "@/data/menu";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/hooks/use-session";
import { accountLabel, fetchRecentMembers, isMissingSchemaError, memberName, MISSING_SCHEMA_MESSAGE } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { FEEDBACK_CHANGED_EVENT, fetchLearningStats } from "@/lib/learning";
import { menuColorClasses } from "@/lib/menu-colors";
import type { MemberRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RecentActivitySection } from "./learning/learning-overview";

/**
 * 학습 통계 카드 4개(admin_dashboard_stats RPC 한 번 + 오늘 결과 수는 브라우저 시간대 기준으로 다시 셈).
 * 한 번의 호출이라 로딩/오류는 네 카드가 함께 바뀌고, 오류 시 카드마다 다시 시도 버튼이 있다.
 */
function LearningStatTiles() {
  const load = useCallback(() => fetchLearningStats(), []);
  const { state, reload, refresh } = useAsyncData(load);

  // 피드백을 읽거나 보내면 "안 읽은 피드백" 숫자를 다시 센다.
  useEffect(() => {
    window.addEventListener(FEEDBACK_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FEEDBACK_CHANGED_EVENT, refresh);
  }, [refresh]);

  const status = state.status;
  const v = state.status === "ready" ? state.data : null;
  const tiles: { label: string; unit: string; icon: LucideIcon; color: MenuColor; value: number | null }[] = [
    { label: "전체 회원", unit: "명", icon: UsersIcon, color: "games", value: v?.totalMembers ?? null },
    { label: "오늘 학습 결과", unit: "건", icon: Gamepad2Icon, color: "home", value: v?.resultsToday ?? null },
    { label: "검토 대기 제출", unit: "건", icon: ClipboardCheckIcon, color: "board", value: v?.pendingSubmissions ?? null },
    { label: "안 읽은 피드백", unit: "개", icon: MessageCircleIcon, color: "science", value: v?.unreadFeedback ?? null },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <StatTile label={t.label} value={t.value} unit={t.unit} icon={t.icon} color={t.color} status={status} onRetry={reload} />
          </li>
        ))}
      </ul>
      {state.status === "error" && state.missing ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {MISSING_SCHEMA_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}

type RecentState = { status: "loading" } | { status: "error"; missing: boolean } | { status: "ready"; rows: MemberRow[] };

function RecentMembers() {
  const [state, setState] = useState<RecentState>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      return { status: "ready", rows: await fetchRecentMembers(5) } as const;
    } catch (e) {
      return { status: "error", missing: isMissingSchemaError(e) } as const;
    }
  }, []);

  useEffect(() => {
    let active = true;
    load().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function retry() {
    setState({ status: "loading" });
    setState(await load());
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="최근 가입 회원을 불러오는 중">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <ErrorState message={state.missing ? MISSING_SCHEMA_MESSAGE : "최근 가입 회원을 불러오지 못했습니다."} onRetry={retry} />
    );
  }
  if (!state.rows.length) return <EmptyState title="아직 가입한 회원이 없습니다" />;
  return (
    <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)}>
      {state.rows.map((m) => (
        <li key={m.id}>
          <Link
            href={`/admin/members/?id=${m.id}`}
            className="flex items-center gap-3 rounded-xl p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <MemberAvatar member={m} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{memberName(m)}</span>
              <span className="truncate text-xs text-muted-foreground">{accountLabel(m.email)}</span>
            </span>
            <span className="hidden sm:block">
              <ProviderBadges member={m} />
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(m.signed_up_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ShortcutLink({
  href,
  label,
  description,
  icon: Icon,
  color,
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: MenuColor;
}) {
  const colors = menuColorClasses[color];
  return (
    <Link
      href={href}
      className={cn(
        // Tailwind v4는 hover:-translate-y를 transform이 아니라 translate 속성으로 움직인다 →
        // transition에 translate를 적어야 떠오름이 부드럽다(예전 transition-[transform,…]은 뚝 끊겼다, 디자인 개편 1단계 보고).
        "group/shortcut flex h-full items-center gap-3 rounded-2xl border p-4 outline-none transition-[translate,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-md) focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:shadow-none",
        colors.softBg,
        colors.border,
        colors.hoverBorder,
        colors.focusRing,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-(--shadow-sm) dark:shadow-none" aria-hidden>
        <Icon className={cn("size-5", colors.strongText)} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-heading text-lg leading-tight">{label}</span>
        <span className="text-xs text-foreground/75">{description}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-foreground/60 transition-transform group-hover/shortcut:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** 관리자 개요(/admin/): 학습 통계 카드 · 최근 학습활동 · 최근 가입 회원 · 바로 가기(spec §3.1). */
export function AdminOverview() {
  const { profile } = useSession();
  const greeting = profile?.display_name ? `${profile.display_name} 선생님, 안녕하세요!` : "안녕하세요!";

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title="관리자 대시보드" description={`${greeting} 오늘의 반 현황을 확인하세요.`} />

      <LoginRequiredCard />

      <section aria-label="현황 숫자">
        <LearningStatTiles />
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
        <RecentActivitySection limit={5} compact />
        <section aria-labelledby="recent-members" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <UserPlusIcon className="size-5 text-games-strong" aria-hidden />
            <h2 id="recent-members" className="mr-auto font-heading text-xl font-normal">
              최근 가입 회원
            </h2>
            <Link
              href="/admin/members/"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              전체 보기
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <RecentMembers />
        </section>
        </div>

        <section aria-labelledby="admin-shortcuts" className="flex flex-col gap-3">
          <h2 id="admin-shortcuts" className="font-heading text-xl font-normal">
            바로 가기
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <li>
              <ShortcutLink href="/admin/members/" label="회원 관리" description="검색 · 비밀번호 초기화" icon={UsersIcon} color="games" />
            </li>
            <li>
              <ShortcutLink href="/admin/learning/" label="학습 현황" description="웹앱 결과 · 참여 · 피드백" icon={GraduationCapIcon} color="board" />
            </li>
            <li>
              <ShortcutLink
                href="/admin/learning/?tab=assignments"
                label="과제 관리"
                description="과제 만들기 · 제출 검토"
                icon={ClipboardListIcon}
                color="science"
              />
            </li>
            <li>
              <ShortcutLink href="/admin/posts/" label="글 관리" description="발행 · 수정 · 삭제" icon={FilePenLineIcon} color="science" />
            </li>
            <li>
              <ShortcutLink href="/admin/write/" label="새 글 작성" description="마크다운 에디터 열기" icon={PenSquareIcon} color="home" />
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
