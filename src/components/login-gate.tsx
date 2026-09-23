"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { fetchLoginRequired } from "@/lib/admin";
import { loginHref } from "@/lib/community";

/** 잠겨 있어도 들어갈 수 있는 경로(basePath 제외, trailingSlash 기준) — 로그인 자체가 막히면 안 된다. */
const ALWAYS_OPEN = ["/login/", "/reset-password/"];

/**
 * "로그인해야만 이용" 토글이 켜져 있으면 비로그인 방문자에게 본문 대신 로그인 안내를 보여 준다
 * (docs/admin/admin-tools/spec.md §2.4).
 *
 * 실제 차단은 이 컴포넌트가 아니라 RLS(can_browse())가 한다 — 여기서는 "왜 비었는지" 설명할 뿐이다.
 * 설정을 아직 모르거나 읽지 못했으면 아무것도 막지 않는다(잘못 잠그는 쪽보다 안전).
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { loading, user } = useSession();
  const pathname = usePathname();
  const [required, setRequired] = useState<boolean | null>(null);

  // 로그인 상태가 바뀌면 다시 확인한다(로그아웃 직후 바로 안내가 뜨도록).
  useEffect(() => {
    let active = true;
    fetchLoginRequired().then((v) => {
      if (active) setRequired(v);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const blocked = required === true && !loading && !user && !ALWAYS_OPEN.includes(path);
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
