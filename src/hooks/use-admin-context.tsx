"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { isMissingSchemaError } from "@/lib/admin";
import {
  fetchAdminContext,
  fetchClassTeachers,
  fetchVisibleClasses,
  type AdminClass,
  type ClassInfo,
} from "@/lib/classes";

/**
 * 관리자 대시보드 공용 "나는 누구인가" 정보(docs/classes/spec.md 개정 1).
 * - my_admin_context(): 총괄 여부 + 내가 담임인 학급(학생 수)
 * - classes 표: 이름을 볼 수 있는 학급(총괄은 모든 학급 — 회원 명단의 학급 이름·필터용)
 * - class_teachers 표: 교사별 담임 학급(총괄만 — 회원 명단의 교사 행 표시용)
 *
 * status
 * - "loading": 아직 모름 → 권한이 필요한 버튼은 잠시 막는다
 * - "ready":   학급 기능 사용 중
 * - "missing": 학급 SQL 적용 전(함수 없음) → 화면은 예전과 똑같이 동작한다(거르지 않음, 역할 선택 보임)
 * - "error":   읽지 못함 → 다시 시도 안내. 권한은 없는 것으로 본다(버튼은 서버가 어차피 거부)
 *
 * 화면 표시는 UX용일 뿐이고, 실제 권한은 RLS·RPC·Edge Function이 판단한다.
 */

export type AdminContextStatus = "loading" | "ready" | "missing" | "error";

type Snapshot = {
  userId: string | null;
  status: AdminContextStatus;
  isSuperAdmin: boolean;
  /** 내가 담임인 학급(이름순) */
  classes: AdminClass[];
  /** 이름을 볼 수 있는 학급(총괄: 모든 학급, 담임: 자기 학급) */
  visibleClasses: ClassInfo[];
  /** 교사 id → 담임 학급 id 목록(총괄만, 못 읽으면 null) */
  teacherClasses: Map<string, string[]> | null;
};

export type AdminContextValue = Snapshot & {
  /** 화면을 유지한 채 다시 읽는다(학급 개설·학생 등록 뒤 학생 수 갱신 등). 실패하면 이전 값을 유지한다. */
  refresh: () => Promise<void>;
  /** 오류 상태에서 "다시 시도" */
  retry: () => void;
  /** 저장 직후 화면을 먼저 고친다(낙관적 갱신). */
  patchClasses: (update: (prev: AdminClass[]) => AdminClass[]) => void;
  /** 학급 id → 이름(볼 수 없는 학급·학급 없음이면 null) */
  classNameOf: (id: string | null | undefined) => string | null;
  /** 학습 현황의 학급 고르기(내 학급이 2개 이상일 때): null = 내 학급 모두 */
  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;
  /**
   * 학습 기록 화면이 쓸 학생 범위(학급 id 목록 — 학급을 골랐으면 그 학급만).
   * undefined = 아직 모름(로딩·오류) → 기다린다, null = 학급 기능 전(거르지 않음), 배열 = 이 학급들의 학생만.
   */
  scopeClassIds: string[] | null | undefined;
  /** 학급 고르기와 상관없는 "내 학급 전체" 범위(서버 집계와 나란히 쓰는 숫자용). 값의 뜻은 scopeClassIds와 같다. */
  allClassIds: string[] | null | undefined;
};

function empty(userId: string | null, status: AdminContextStatus): Snapshot {
  return { userId, status, isSuperAdmin: false, classes: [], visibleClasses: [], teacherClasses: null };
}

async function loadSnapshot(userId: string): Promise<Snapshot> {
  const [ctx, visible, teachers] = await Promise.all([
    fetchAdminContext().then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
    // 아래 둘은 보조 정보라 실패해도 학급 기능은 쓸 수 있다.
    fetchVisibleClasses().catch(() => null),
    fetchClassTeachers().catch(() => null),
  ]);
  if (!ctx.ok) return empty(userId, isMissingSchemaError(ctx.error) ? "missing" : "error");
  const { isSuperAdmin, classes } = ctx.value;
  // 내 학급 이름은 my_admin_context 값을 우선한다(방금 바꾼 이름). classes 표를 못 읽었으면 내 학급만이라도 보인다.
  const merged = new Map<string, ClassInfo>();
  for (const c of visible ?? []) merged.set(c.id, c);
  for (const c of classes) merged.set(c.id, { id: c.id, name: c.name, archivedAt: merged.get(c.id)?.archivedAt ?? null });
  return {
    userId,
    status: "ready",
    isSuperAdmin,
    classes,
    visibleClasses: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    teacherClasses: isSuperAdmin ? teachers : null,
  };
}

function scopeKeyOf(status: AdminContextStatus, ids: string[]): string {
  if (status === "ready") return `ids:${ids.join(",")}`;
  return status === "missing" ? "legacy" : "pending";
}

function scopeFromKey(key: string): string[] | null | undefined {
  if (key === "legacy") return null;
  if (key === "pending") return undefined;
  const ids = key.slice(4);
  return ids ? ids.split(",") : [];
}

/** 다시 읽기가 잠깐 실패했다고 잘 쓰던 정보를 지우지 않는다. */
function keepOnFailure(prev: Snapshot, next: Snapshot): Snapshot {
  if (next.status === "error" && prev.status === "ready" && prev.userId === next.userId) return prev;
  return next;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminContextProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [snap, setSnap] = useState<Snapshot>(() => empty(userId, "loading"));
  const [attempt, setAttempt] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // 다른 사용자로 바뀌면 이전 사용자의 정보를 버린다(렌더 중 상태 보정 — use-session과 같은 방식).
  if (snap.userId !== userId) {
    setSnap(empty(userId, "loading"));
    setSelectedClassId(null);
  }

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadSnapshot(userId).then((next) => {
      if (active) setSnap((prev) => (prev.userId === userId ? keepOnFailure(prev, next) : prev));
    });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const next = await loadSnapshot(userId);
    setSnap((prev) => (prev.userId === userId ? keepOnFailure(prev, next) : prev));
  }, [userId]);

  const retry = useCallback(() => {
    setSnap((s) => ({ ...s, status: "loading" }));
    setAttempt((n) => n + 1);
  }, []);

  const patchClasses = useCallback((update: (prev: AdminClass[]) => AdminClass[]) => {
    setSnap((s) => {
      if (s.status !== "ready") return s;
      const classes = update(s.classes).sort((a, b) => a.name.localeCompare(b.name, "ko"));
      const byId = new Map(classes.map((c) => [c.id, c]));
      const visible = s.visibleClasses.map((v) => {
        const mine = byId.get(v.id);
        return mine ? { ...v, name: mine.name } : v;
      });
      for (const c of classes) if (!visible.some((v) => v.id === c.id)) visible.push({ id: c.id, name: c.name, archivedAt: null });
      return { ...s, classes, visibleClasses: visible.sort((a, b) => a.name.localeCompare(b.name, "ko")) };
    });
  }, []);

  const nameMap = useMemo(() => new Map(snap.visibleClasses.map((c) => [c.id, c.name])), [snap.visibleClasses]);
  const classNameOf = useCallback((id: string | null | undefined) => (id ? (nameMap.get(id) ?? null) : null), [nameMap]);

  const validSelected =
    snap.status === "ready" && selectedClassId && snap.classes.some((c) => c.id === selectedClassId) ? selectedClassId : null;

  // 학생 범위는 문자열 열쇠로 고정해 둔다 — 학생 수만 바뀐 다시 읽기로 학습 화면이 매번 다시 불러오지 않게.
  const allKey = scopeKeyOf(snap.status, snap.classes.map((c) => c.id));
  const scopeKey = scopeKeyOf(snap.status, validSelected ? [validSelected] : snap.classes.map((c) => c.id));
  const allClassIds = useMemo(() => scopeFromKey(allKey), [allKey]);
  const scopeClassIds = useMemo(() => scopeFromKey(scopeKey), [scopeKey]);

  const value = useMemo<AdminContextValue>(
    () => ({
      ...snap,
      refresh,
      retry,
      patchClasses,
      classNameOf,
      selectedClassId: validSelected,
      setSelectedClassId,
      scopeClassIds,
      allClassIds,
    }),
    [snap, refresh, retry, patchClasses, classNameOf, validSelected, scopeClassIds, allClassIds],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminContext는 AdminContextProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

/**
 * 담임·총괄의 권한 판단(화면 표시용).
 * - canCreateTeacher: 교사 계정 만들기·담임 지정/해제(총괄만). 학급 기능 전("missing")에는 예전처럼 누구나.
 * - canToggleLogin: '로그인해야만 이용' 스위치(총괄만). 학급 기능 전에는 예전처럼 누구나.
 */
export function adminPermissions(ctx: Pick<AdminContextValue, "status" | "isSuperAdmin">) {
  const legacy = ctx.status === "missing";
  const superAdmin = ctx.status === "ready" && ctx.isSuperAdmin;
  return {
    legacy,
    superAdmin,
    canCreateTeacher: legacy || superAdmin,
    canChangeRole: legacy || superAdmin,
    canToggleLogin: legacy || superAdmin,
  };
}

/** 과제·블로그 글 권한 안내(20260927030000_content_owner_only.sql — 2026-09-26 사용자 결정 "쓴 선생님과 총괄만"). */
export const OWNER_ONLY_EDIT = "쓴 선생님과 총괄만 고칠 수 있어요.";
export const OWNER_ONLY_DELETE = "쓴 선생님과 총괄만 지울 수 있어요.";

/**
 * 과제·블로그 글을 고치고(공개 전환 포함) 지울 수 있는가 — 화면 표시용. 실제 판단은 RLS(쓴 사람 = 나 또는 총괄).
 * - 내가 쓴 것: 언제나 true(총괄 여부를 몰라도 된다).
 * - 남이 쓴 것(쓴 사람이 비어 있는 것 포함): 총괄로 확인된 뒤에만 true — "loading" 동안은 잠시 막고, "error"면 막는다.
 * - 학급 기능 전("missing"): 예전처럼 true(그때는 이 SQL도 적용할 수 없어 서버가 교사 누구나 허용한다).
 */
export function canModifyContent(
  ctx: Pick<AdminContextValue, "status" | "isSuperAdmin" | "userId">,
  ownerId: string | null | undefined,
): boolean {
  if (ctx.status === "missing") return true;
  if (ownerId && ctx.userId && ownerId === ctx.userId) return true;
  return ctx.status === "ready" && ctx.isSuperAdmin;
}

/** canModifyContent가 false일 때 버튼 옆에 보일 까닭(권한을 아직 모르면 그 사실을 말한다). */
export function contentLockReason(ctx: Pick<AdminContextValue, "status">): string {
  if (ctx.status === "loading") return "권한을 확인하는 중…";
  if (ctx.status === "error") return "권한을 확인하지 못해 지금은 고칠 수 없어요. 화면을 새로 고쳐 주세요.";
  return OWNER_ONLY_EDIT;
}

/**
 * 서버가 권한으로 거부했는가(과제·글 고치기·지우기). RLS는 남의 행을 오류 없이 0행으로 거르고
 * (src/lib/learning.ts의 "not-updated"·"not-deleted", 화면의 data 없음), with check·열 권한 위반은 42501로 알린다.
 * 0행은 그사이 이미 지워진 경우일 수도 있다.
 */
export function isPermissionRejection(error: unknown): boolean {
  if (error instanceof Error && (error.message === "not-updated" || error.message === "not-deleted")) return true;
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "42501";
}

/**
 * ClassScopeGate 안에서 쓰는 학생 범위.
 * - classIds: 학습 기록 화면의 학생 범위(학급을 골랐으면 그 학급만). null = 학급 기능 전(거르지 않음)
 * - allClassIds: 내 학급 전체(학급 고르기와 무관 — 서버 집계 숫자와 나란히 쓸 때)
 * - narrowed: 학급을 하나 골랐는지 → 명단 밖 기록(다른 학급)을 숨긴다
 */
export function useStudentScope() {
  const ctx = useAdminContext();
  return {
    classIds: ctx.scopeClassIds ?? null,
    allClassIds: ctx.allClassIds ?? null,
    narrowed: ctx.status === "ready" && !!ctx.selectedClassId,
    ready: ctx.status === "ready",
  };
}
