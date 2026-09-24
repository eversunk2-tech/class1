"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { AlarmClockIcon } from "lucide-react";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminDisplayName, isWithdrawnProfile } from "@/lib/admin";
import type { AsyncState } from "@/hooks/use-async-data";
import { errorMessage, SUBMISSION_STATUS_LABELS } from "@/lib/learning";
import type { SubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 목록 로딩 스켈레톤 */
export function ListSkeleton({ rows = 3, label = "불러오는 중" }: { rows?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * AsyncState 하나를 로딩/오류/빈/완료로 나눠 그린다.
 * 오류가 마이그레이션 미실행 때문이면 audience에 맞는 안내 문구를 보여 준다.
 */
export function AsyncView<T>({
  state,
  onRetry,
  errorText,
  audience = "admin",
  isEmpty,
  empty,
  loadingRows,
  children,
}: {
  state: AsyncState<T>;
  onRetry: () => void;
  errorText: string;
  audience?: "admin" | "student";
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loadingRows?: number;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") return <ListSkeleton rows={loadingRows} />;
  if (state.status === "error") {
    return <ErrorState message={errorMessage(state.missing, errorText, audience)} onRetry={onRetry} />;
  }
  if (isEmpty?.(state.data)) {
    return <>{empty ?? <EmptyState title="아직 기록이 없어요" illustration={audience === "student" ? <EmptyOwl /> : undefined} />}</>;
  }
  return <>{children(state.data)}</>;
}

const STATUS_VARIANTS: Record<SubmissionStatus | "none", ComponentProps<typeof Badge>["variant"]> = {
  none: "outline",
  submitted: "secondary",
  reviewed: "default",
  needs_revision: "destructive",
};

/**
 * "수정 요청"(옅은 빨강 배지) 글자색: 사이트 기본 빨강은 옅은 빨강 바탕 위 3.99:1로 AA(4.5) 미달이라
 * 관리자 영역(admin-theme.css)과 같은 진한 빨강을 쓴다 — 밝음 oklch(0.5 0.2 25) 5.58:1, 어두움 oklch(0.74 0.17 22) 5.26:1
 * (디자인 개편 4단계 개정 1). 관리자 화면은 원래 이 값이라 변화 없음. 문구·빨강 계열은 그대로.
 */
const NEEDS_REVISION_TEXT = "text-[color:oklch(0.5_0.2_25)] dark:text-[color:oklch(0.74_0.17_22)]";

/** 제출 상태 배지(미제출/제출/검토 완료/수정 요청) */
export function SubmissionStatusBadge({ status }: { status: SubmissionStatus | null }) {
  return (
    <Badge variant={STATUS_VARIANTS[status ?? "none"]} className={status === "needs_revision" ? NEEDS_REVISION_TEXT : undefined}>
      {status ? SUBMISSION_STATUS_LABELS[status] : "미제출"}
    </Badge>
  );
}

/**
 * §14 Q1 지각 배지(학생·관리자 공용). 글자는 board-ink(board-strong 70% + 글자색 30%):
 * 예전 board-strong 12px 글자는 흰 바탕 위 4.06:1로 AA(4.5) 미달이었다(디자인 개편 4단계 개정 1). 색 계열·아이콘·문구는 그대로.
 */
export function LateBadge() {
  return (
    <Badge variant="outline" className="border-board-strong/40 text-board-ink" title="마감 시각 이후에 처음 제출했어요">
      <AlarmClockIcon aria-hidden />
      지각
    </Badge>
  );
}

/** 안 읽은 수 배지(0이면 그리지 않음) */
export function UnreadCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        // 다크모드의 --destructive는 밝은 빨강이라 흰 숫자 대비가 2.9:1 → 다크에서만 진한 빨강(흰 숫자 5.4:1)
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[0.7rem] leading-none font-semibold text-white dark:bg-[oklch(0.55_0.22_25)]",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only">개 안 읽음</span>
    </span>
  );
}

/** shadcn Select가 설치되어 있지 않아 Input과 같은 모양의 네이티브 select를 쓴다(모바일에서도 기본 선택기). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

/** 탭 내부 섹션 제목 */
export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-heading text-xl font-normal">{children}</h2>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** 간단한 표 래퍼(가로 스크롤). 관리자 화면 전용 — 디자인 개편 4단계에서 흰 판 + 작은 그림자(adminSurfaceClass)를 깔았다. */
export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className={cn("relative overflow-x-auto rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", adminSurfaceClass)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="w-full min-w-[36rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export const thClass = "border-b bg-muted/50 px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground";
export const tdClass = "border-b px-3 py-2.5 align-middle last:border-r-0 [tr:last-child_&]:border-b-0";

/** 관리자 화면의 학생 이름(아바타 + 회원 상세 링크).
 *  관리자 전용이라 탈퇴 학생은 "탈퇴한 학생(원래 이름)"으로 구분해 보여 준다(review U2). */
export function StudentLink({
  id,
  profile,
  fallback = "이름 없음",
  tab,
}: {
  id: string;
  profile: { display_name: string | null; avatar_url: string | null; withdrawn_at: string | null } | null;
  fallback?: string;
  /** 회원 상세에서 열 탭 */
  tab?: string;
}) {
  const name = adminDisplayName(profile, fallback);
  const withdrawn = isWithdrawnProfile(profile);
  return (
    <Link
      href={`/admin/members/?id=${id}${tab ? `&tab=${tab}` : ""}`}
      className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-md font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Avatar size="sm">
        {profile?.avatar_url && !withdrawn ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </Link>
  );
}
