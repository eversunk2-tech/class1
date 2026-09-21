"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isMissingSchemaError } from "@/lib/admin";
import { PROFILE_COLUMNS, type Profile } from "@/lib/types";

/**
 * 프로필 조회 상태(review #10).
 * - "idle": 로그인 전 / "loading": 조회 중 / "ready": 최신 값 / "error": 조회 실패(이전 값 유지, 자동 재시도 중)
 */
export type ProfileStatus = "idle" | "loading" | "ready" | "error";

type SessionState = {
  /** 최초 세션 확인이 끝나기 전에는 true */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** profiles 행. 로그인 전이거나 아직 한 번도 조회하지 못했으면 null(조회 실패 시에는 마지막으로 받은 값을 유지) */
  profile: Profile | null;
  profileStatus: ProfileStatus;
  /** profiles.role === 'admin'. UX용이며 실제 권한은 RLS가 결정한다. */
  isAdmin: boolean;
  /**
   * 강제 비밀번호 변경 대상인지. null = 아직 판단할 수 없음(조회 전/실패) → 게이트는 기다린다.
   */
  mustChangePassword: boolean | null;
  /** 프로필을 다시 읽는다. 성공하면 새 프로필, 실패하면 null(이전 값은 유지). */
  refreshProfile: () => Promise<Profile | null>;
};

const SessionContext = createContext<SessionState | null>(null);

/**
 * profiles(공개 컬럼) + must_change_password(본인만 조회 가능한 RPC).
 * profiles는 컬럼 권한 때문에 select("*")를 쓸 수 없다(20260922000000_admin_learning_fixes.sql).
 * 실패하면 throw한다(호출하는 쪽이 이전 값을 유지하도록).
 */
async function fetchProfile(userId: string): Promise<Profile | null> {
  const [profileRes, flagRes] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    supabase.rpc("my_must_change_password"),
  ]);
  if (profileRes.error) throw profileRes.error;
  const row = (profileRes.data as Profile | null) ?? null;
  if (!row) return null;
  let must: boolean | undefined;
  if (!flagRes.error) must = flagRes.data === true;
  else if (isMissingSchemaError(flagRes.error)) {
    // 20260922000000 마이그레이션 전: 아직 컬럼을 직접 읽을 수 있다.
    const legacy = await supabase.from("profiles").select("must_change_password").eq("id", userId).maybeSingle();
    if (legacy.error) {
      if (!isMissingSchemaError(legacy.error)) throw legacy.error;
      must = false; // 컬럼 자체가 없음(20260921020000 전) → 강제 변경 기능 없음
    } else {
      must = (legacy.data as { must_change_password?: boolean } | null)?.must_change_password === true;
    }
  } else throw flagRes.error;
  return { ...row, must_change_password: must };
}

/** 실패 후 자동 재시도 간격(ms). 마지막 값을 계속 쓴다. 창 포커스 때도 다시 시도한다. */
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];

type ProfileState = { userId: string | null; profile: Profile | null; status: ProfileStatus };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>({ userId: null, profile: null, status: "idle" });
  const [retry, setRetry] = useState(0);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // 사용자가 바뀌면 이전 사용자 프로필을 버린다(렌더 중 상태 보정).
  if (profileState.userId !== userId) {
    setProfileState({ userId, profile: null, status: userId ? "loading" : "idle" });
    setRetry(0);
  }

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetchProfile(userId).then(
      (next) => {
        if (active) setProfileState({ userId, profile: next, status: "ready" });
      },
      () => {
        if (!active) return;
        // 실패: 이전 값을 유지하고 잠시 뒤 다시 시도한다.
        setProfileState((s) => (s.userId === userId ? { ...s, status: "error" } : s));
        timer = setTimeout(() => setRetry((n) => n + 1), RETRY_DELAYS[Math.min(retry, RETRY_DELAYS.length - 1)]);
      },
    );
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [userId, retry]);

  // 실패 상태에서 창으로 돌아오면 바로 다시 시도한다.
  const failed = profileState.status === "error";
  useEffect(() => {
    if (!failed) return;
    const onFocus = () => setRetry((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [failed]);

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!userId) return null;
    try {
      const next = await fetchProfile(userId);
      setProfileState((s) => (s.userId === userId ? { userId, profile: next, status: "ready" } : s));
      return next;
    } catch {
      // 이전 값은 그대로 둔다(멀쩡한 프로필을 null로 덮지 않는다).
      return null;
    }
  }, [userId]);

  const value = useMemo<SessionState>(() => {
    const profile = profileState.userId === userId ? profileState.profile : null;
    const status: ProfileStatus = profileState.userId === userId ? profileState.status : userId ? "loading" : "idle";
    const must = profile?.must_change_password;
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      profileStatus: status,
      isAdmin: profile?.role === "admin",
      // 한 번이라도 성공적으로 읽은 값이 있으면 그 값, 아니면 판단 불가(null)
      mustChangePassword: !userId ? false : profile && typeof must === "boolean" ? must : status === "ready" ? false : null,
      refreshProfile,
    };
  }, [loading, session, profileState, userId, refreshProfile]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession은 SessionProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

/** 표시용 이름: display_name → 이메일 앞부분 → '사용자' */
export function displayNameOf(profile: Profile | null, user: User | null): string {
  return profile?.display_name || user?.email?.split("@")[0] || "사용자";
}
