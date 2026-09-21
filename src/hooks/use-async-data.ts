"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isMissingSchemaError } from "@/lib/admin";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown; /** 마이그레이션 미실행(테이블/함수 없음) */ missing: boolean }
  | { status: "ready"; data: T };

/**
 * 비동기 조회 1건의 로딩/오류/완료 상태.
 * load는 호출하는 쪽에서 useCallback으로 고정한다(바뀌면 다시 불러온다).
 * - reload(): 로딩 상태로 바꾸고 다시 불러오기(재시도 버튼)
 * - refresh(): 화면을 유지한 채 조용히 다시 불러오기(포커스 복귀 등)
 * - setData(): 저장 후 목록을 낙관적으로 고칠 때
 */
export function useAsyncData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [prevLoad, setPrevLoad] = useState(() => load);
  // 진행 중인 요청의 세대 번호. setData로 화면을 고치면 세대를 올려, 그 전에 시작된 조회(포커스 refresh 등)가
  // 늦게 도착해 방금 고친 내용을 덮어쓰지 않게 한다(review #13).
  const generation = useRef(0);
  const readyRef = useRef(false);

  // load가 바뀌면(대상 id 변경 등) 렌더 중에 바로 로딩 상태로 되돌린다(이전 대상 데이터가 잠깐 보이지 않게).
  if (prevLoad !== load) {
    setPrevLoad(() => load);
    setState({ status: "loading" });
  }

  useEffect(() => {
    readyRef.current = state.status === "ready";
  }, [state.status]);

  useEffect(() => {
    let active = true;
    const my = ++generation.current;
    load().then(
      (data) => {
        if (!active) return;
        if (my !== generation.current && readyRef.current) return; // setData 이후 도착한 옛 응답은 버린다
        setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (!active) return;
        if (my !== generation.current && readyRef.current) return;
        setState({ status: "error", error, missing: isMissingSchemaError(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [load, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  const setData = useCallback((update: (prev: T) => T) => {
    generation.current += 1;
    setState((s) => (s.status === "ready" ? { ...s, data: update(s.data) } : s));
  }, []);

  return { state, reload, refresh, setData };
}
