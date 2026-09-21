"use client";

import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { recordPostRead } from "@/lib/learning";

const readKey = (postId: string, userId: string) => `read:${userId}:${postId}`;

/**
 * 로그인 사용자가 공개 글을 열면 읽기 기록(record_post_read RPC)을 남긴다(docs/admin/spec.md §4.4).
 * 세션(탭)당 글 1개에 1번만 — view-counter.tsx와 같은 sessionStorage 중복 방지.
 * 화면을 그리지 않으며, 실패해도(마이그레이션 전 등) 조용히 넘어간다.
 */
export function PostReadRecorder({ postId, published }: { postId: string; published: boolean }) {
  const { loading, user } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading || !userId || !published) return;
    const key = readKey(postId, userId);
    try {
      if (sessionStorage.getItem(key)) return;
      // 먼저 표시해 두어 StrictMode 이중 실행 시에도 한 번만 기록한다.
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    recordPostRead(postId)
      .then((ok) => {
        if (!ok) {
          try {
            sessionStorage.removeItem(key);
          } catch {}
        }
      })
      .catch(() => {});
  }, [loading, userId, postId, published]);

  return null;
}
