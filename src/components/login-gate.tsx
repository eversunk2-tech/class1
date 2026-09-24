"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLoginLocked } from "@/hooks/use-login-lock";
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
 * "로그인해야만 이용" 토글이 켜져 있으면, 잠금 대상 경로에서 비로그인 방문자에게 본문 대신 로그인 안내를 보여 준다
 * (docs/admin/admin-tools/spec.md §2.4 + scope-fix-instructions.md §3).
 *
 * 실제 차단은 이 컴포넌트가 아니라 RLS(can_browse())가 한다 — 여기서는 "왜 비었는지" 설명할 뿐이다.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const locked = useLoginLocked();
  const pathname = usePathname();

  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const blocked = locked && LOCKED_PREFIXES.some((p) => path.startsWith(p));
  if (!blocked) return <>{children}</>;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
        <LockIcon className="size-7" />
      </span>
      <h1 className="font-heading text-2xl font-normal">로그인이 필요해요</h1>
      <p className="text-sm text-muted-foreground">
        지금은 로그인한 우리 반 친구들만 글과 게시판을 볼 수 있어요. 아이디와 비밀번호로 로그인한 뒤 다시 열어 주세요.
      </p>
      <Button render={<Link href={loginHref(path)} />} nativeButton={false}>
        로그인하기
      </Button>
    </div>
  );
}

/**
 * 홈·과학수업처럼 화면은 열어 두고 한 칸만 막을 때 쓰는 안내 카드.
 * 오류가 아니라 "지금은 로그인해야 볼 수 있다"는 설명이므로 경고색 대신 옅은 브랜드 보라 판 + 흰 자물쇠 칩 +
 * 흰 알약 버튼을 쓴다(디자인 개편 1단계, 동작은 그대로).
 */
export function LoginNeededNotice({ what, className }: { what: string; className?: string }) {
  const pathname = usePathname();
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary/5 px-6 py-10 text-center ring-1 ring-primary/15 dark:bg-primary/10",
        className,
      )}
    >
      <span
        className="flex size-12 items-center justify-center rounded-2xl bg-card text-primary shadow-(--shadow-sm) ring-1 ring-primary/10 dark:shadow-none"
        aria-hidden
      >
        <LockIcon className="size-5" />
      </span>
      <p className="mt-1 font-semibold">로그인하면 볼 수 있어요</p>
      <p className="text-sm text-muted-foreground">지금은 로그인한 우리 반 친구들만 {what}을 볼 수 있어요.</p>
      <Link
        href={loginHref(path)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-2 h-9 rounded-full bg-card px-4 text-sm shadow-(--shadow-sm) dark:shadow-none",
        )}
      >
        로그인하기
      </Link>
    </div>
  );
}
