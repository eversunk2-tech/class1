"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { FEEDBACK_CHANGED_EVENT, fetchUnreadFeedbackCount } from "@/lib/learning";

/**
 * 안 읽은 피드백 메시지 수(unread_feedback_count RPC).
 * 실시간 구독은 하지 않고(spec §14 Q6) 마운트 · 창 포커스 · 탭 복귀 · 스레드 읽음/전송 시 다시 센다.
 * 로그인하지 않았거나 DB 설정 전(함수 없음)이면 0.
 */
export function useUnreadFeedback(): number {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; count: number }>({ userId: null, count: 0 });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let seq = 0;
    const run = () => {
      const my = ++seq;
      fetchUnreadFeedbackCount()
        .then((count) => {
          if (active && my === seq) setState({ userId, count });
        })
        .catch(() => {
          if (active && my === seq) setState({ userId, count: 0 });
        });
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    window.addEventListener(FEEDBACK_CHANGED_EVENT, run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", run);
      window.removeEventListener(FEEDBACK_CHANGED_EVENT, run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return userId && state.userId === userId ? state.count : 0;
}
