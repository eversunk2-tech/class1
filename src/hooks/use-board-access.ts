"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { fetchBoardAccess, type BoardAccess } from "@/lib/boards";

export type BoardAccessState =
  /** 로그인하지 않았거나 쓰지 않음(게시판은 로그인 전용) */
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; access: BoardAccess };

/**
 * 지금 로그인한 사용자가 참여할 수 있는 자유게시판(src/lib/boards.ts — my_boards()).
 * 같은 사용자의 결과는 잠깐 기억해 여러 칸이 한 번만 부른다. `retry()`는 기억한 값을 버리고 다시 읽는다.
 * `enabled`가 false면 부르지 않는다(학습게임 목록 등).
 */
export function useBoardAccess(enabled = true): BoardAccessState & { retry: () => void } {
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const key = `${userId ?? ""}|${attempt}`;
  const [state, setState] = useState<{ key: string; value: BoardAccessState }>({ key: "", value: { status: "loading" } });

  useEffect(() => {
    if (!enabled || sessionLoading || !userId) return;
    let active = true;
    fetchBoardAccess(userId, { fresh: attempt > 0 }).then(
      (access) => {
        if (active) setState({ key, value: { status: "ready", access } });
      },
      () => {
        if (active) setState({ key, value: { status: "error" } });
      },
    );
    return () => {
      active = false;
    };
  }, [enabled, sessionLoading, userId, attempt, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  let value: BoardAccessState;
  if (!enabled) value = { status: "idle" };
  else if (sessionLoading) value = { status: "loading" };
  else if (!userId) value = { status: "idle" };
  else value = state.key === key ? state.value : { status: "loading" };
  return { ...value, retry };
}

/** 게시판 목록 조회에 쓸 주인 목록: legacy면 null(거르지 않음 — 예전 동작), 아니면 게시판 주인 id들(비어 있을 수 있음) */
export function boardOwnersOf(access: BoardAccess): string[] | null {
  return access.mode === "legacy" ? null : access.boards.map((b) => b.ownerId);
}
