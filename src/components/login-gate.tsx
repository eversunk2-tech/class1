"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2Icon, LockIcon, LogInIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { useSession } from "@/hooks/use-session";
import { loginHref } from "@/lib/community";
import { cn } from "@/lib/utils";

/**
 * 잠금이 걸리는 경로(basePath 제외, trailingSlash 기준의 접두사).
 * 2026-09-23 사용자 결정: 잠가야 하는 것은 **블로그 글 · 자유게시판 · 학습게임**뿐이다.
 * 홈("/"), 과학수업("/science/"), 로그인·비밀번호 재설정, 관리자 화면은 여기에 넣지 않는다.
 *  · 홈·과학수업은 화면 자체는 그대로 열리고, 데이터를 읽는 칸만 "로그인하면 볼 수 있어요" 안내로 바뀐다.
 *  · /me/learning/ 과 /admin/ 은 원래부터 로그인·관리자 전용이라 이 잠금과 무관하다.
 */
const LOCKED_PREFIXES = ["/post/", "/board/", "/games/", "/search/"];

/**
 * 스위치와 상관없이 **언제나** 로그인해야 볼 수 있는 경로 — 자유게시판(목록·글·글쓰기·고치기).
 * 2026-09-26 사용자 결정: "자유게시판은 로그인하지 않으면 완전히 안 보여야 해". 실제 차단은 RLS
 * (supabase/migrations/20260926000000_board_login_only.sql — 비로그인은 kind='board' 글·댓글·좋아요를 못 읽음)가 한다.
 */
const ALWAYS_LOGIN_PREFIXES = ["/board/"];

/**
 * "로그인해야만 이용" 토글이 켜져 있으면, 잠금 대상 경로에서 비로그인 방문자에게 본문 대신 로그인 안내를 보여 준다
 * (docs/admin/admin-tools/spec.md §2.4 + scope-fix-instructions.md §3). 자유게시판은 토글과 상관없이 늘 막는다.
 *
 * 실제 차단은 이 컴포넌트가 아니라 RLS(can_browse(), 자유게시판은 로그인 여부)가 한다 — 여기서는 "왜 비었는지" 설명할 뿐이다.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const locked = useLoginLocked();
  const { loading, user } = useSession();
  const pathname = usePathname();

  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (ALWAYS_LOGIN_PREFIXES.some((p) => path.startsWith(p))) {
    // 로그인 상태를 확인하는 동안에도 글을 먼저 그리지 않는다(잠깐이라도 보이지 않게)
    if (loading) {
      return (
        <div className="flex flex-1 items-center justify-center py-16" aria-busy="true">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="로그인 상태를 확인하는 중" />
        </div>
      );
    }
    if (!user) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10">
          <LockPanel
            size="lg"
            title="로그인이 필요해요"
            description="자유게시판은 로그인한 우리 반 친구들만 볼 수 있어요. 아이디와 비밀번호로 로그인한 뒤 다시 열어 주세요."
            href={loginHref(path)}
            headingLevel="h1"
          />
        </div>
      );
    }
    return <>{children}</>;
  }
  const blocked = locked && LOCKED_PREFIXES.some((p) => path.startsWith(p));
  if (!blocked) return <>{children}</>;

  // 1단계 홈 안내 카드(LoginNeededNotice)와 같은 모양을 크게: 옅은 보라 판 + 흰 자물쇠 칩 + 알약 버튼
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-10">
      <LockPanel
        size="lg"
        title="로그인이 필요해요"
        description="지금은 로그인한 우리 반 친구들만 글과 게시판을 볼 수 있어요. 아이디와 비밀번호로 로그인한 뒤 다시 열어 주세요."
        href={loginHref(path)}
        headingLevel="h1"
      />
    </div>
  );
}

/**
 * 잠금 안내 판(공용). 오류가 아니라 "지금은 로그인해야 볼 수 있다"는 설명이므로 경고색 대신
 * 옅은 브랜드 보라 판 + 흰 자물쇠 칩 + 알약 버튼을 쓴다(디자인 개편 1·2단계).
 */
function LockPanel({
  size,
  title,
  description,
  href,
  headingLevel,
  className,
}: {
  size: "sm" | "lg";
  title: string;
  description: string;
  href: string;
  headingLevel?: "h1" | "p";
  className?: string;
}) {
  const large = size === "lg";
  const Heading = headingLevel ?? "p";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 bg-primary/5 px-6 text-center ring-1 ring-primary/15 dark:bg-primary/10",
        large ? "gap-3 rounded-[2rem] py-12" : "rounded-2xl py-10",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center bg-card text-primary shadow-(--shadow-sm) ring-1 ring-primary/10 dark:shadow-none",
          large ? "size-16 rounded-3xl" : "size-12 rounded-2xl",
        )}
        aria-hidden
      >
        <LockIcon className={large ? "size-7" : "size-5"} />
      </span>
      <Heading className={cn("mt-1", large ? "font-heading text-2xl font-normal" : "font-semibold")}>{title}</Heading>
      <p className="max-w-sm text-sm break-keep text-muted-foreground">{description}</p>
      <Link
        href={href}
        className={cn(
          large
            ? "mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-grad-primary px-6 text-base font-semibold text-primary-foreground shadow-(--shadow-brand) outline-none transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            : cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 h-9 rounded-full bg-card px-4 text-sm shadow-(--shadow-sm) dark:shadow-none"),
        )}
      >
        {large ? <LogInIcon className="size-5" aria-hidden /> : null}
        로그인하기
      </Link>
    </div>
  );
}

/**
 * 홈·과학수업처럼 화면은 열어 두고 한 칸만 막을 때 쓰는 안내 카드.
 * 오류가 아니라 "지금은 로그인해야 볼 수 있다"는 설명이므로 경고색 대신 옅은 브랜드 보라 판 + 흰 자물쇠 칩 +
 * 흰 알약 버튼을 쓴다(디자인 개편 1단계, 동작은 그대로).
 */
export function LoginNeededNotice({ what, description, className }: { what: string; description?: string; className?: string }) {
  const pathname = usePathname();
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <LockPanel
      size="sm"
      title="로그인하면 볼 수 있어요"
      description={description ?? `지금은 로그인한 우리 반 친구들만 ${what}을 볼 수 있어요.`}
      href={loginHref(path)}
      className={className}
    />
  );
}
