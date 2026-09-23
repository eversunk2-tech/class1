"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { fetchLoginRequired } from "@/lib/admin";

/**
 * "로그인해야만 이용"(site_settings.login_required)이 켜져 있고, 지금 방문자가 로그인하지 않았는가?
 *
 * 실제 차단은 이 훅이 아니라 RLS(can_browse())가 한다 — 화면은 "왜 비었는지"를 설명할 뿐이다.
 * 설정을 아직 모르거나 읽지 못했으면 false(= 아무것도 막지 않는다). 잘못 잠그는 쪽보다 안전하다.
 *
 * 잠금 범위(2026-09-23 사용자 결정, docs/admin/admin-tools/scope-fix-instructions.md):
 *   막는 것  — 블로그 글·댓글, 자유게시판, 학습게임, 과학 시뮬레이션 앱
 *   안 막는 것 — 홈·메뉴·과학 차시 목록·로그인·비밀번호 재설정·사이트 설정 읽기
 */
export function useLoginLocked(): boolean {
  const { loading, user } = useSession();
  const [required, setRequired] = useState(false);

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

  return required && !loading && !user;
}
