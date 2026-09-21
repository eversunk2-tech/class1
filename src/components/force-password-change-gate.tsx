"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

/** 강제 비밀번호 변경 중에도 머무를 수 있는 경로(basePath 제외, trailingSlash 기준) */
const ALLOWED_PATHS = ["/reset-password/", "/login/"];

/**
 * 관리자가 비밀번호를 초기화한 계정(profiles.must_change_password = true)은
 * 어느 화면에 있든 /reset-password/로 보낸다(docs/admin/spec.md §7).
 * 화면을 그리지 않는 컴포넌트이며, 실제 보호가 아니라 안내용이다.
 * 프로필 조회가 실패해 판단할 수 없으면(mustChangePassword === null) 이동하지 않고 기다린다.
 * SessionProvider가 자동으로 다시 조회하며, 값이 확인되는 즉시 이 효과가 다시 실행된다(review #10).
 */
export function ForcePasswordChangeGate() {
  const { loading, mustChangePassword } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const mustChange = mustChangePassword === true;

  useEffect(() => {
    if (loading || !mustChange) return;
    const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (ALLOWED_PATHS.includes(path)) return;
    router.replace("/reset-password/");
  }, [loading, mustChange, pathname, router]);

  return null;
}
