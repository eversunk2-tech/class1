"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isMissingSchemaError } from "@/lib/admin";
import { LOGIN_EMAIL_DOMAIN } from "@/lib/auth";
import { clearScienceLocalData } from "@/lib/local-data";
import { fetchMemberGate, type MemberGate } from "@/lib/privacy";
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
  /**
   * 개인정보 확인 창 상태(my_member_gate() — docs/privacy/spec.md 3절). null = 아직 모름(로그인 전·읽는 중·실패).
   * 함수가 없으면(SQL ① 전) `ready: false`인 ok. 창(`PrivacyGate`)은 안내일 뿐이고 실제 막기는 서버가 한다.
   */
  gate: MemberGate | null;
  /** 창 상태를 다시 읽는다. 성공하면 새 값, 실패하면 null(이전 값은 유지). */
  refreshGate: () => Promise<MemberGate | null>;
};

const SessionContext = createContext<SessionState | null>(null);

/**
 * 20260923000000_member_withdrawal.sql 실행 전에는 withdrawn_at 컬럼이 없다.
 * 그때 프로필 조회가 통째로 실패하면 관리자도 /admin/에 들어가지 못해 SQL을 고칠 방법이 막힌다(자물쇠).
 * → 컬럼이 없다는 오류면 그 컬럼만 빼고 한 번 더 읽는다.
 */
async function selectProfile(userId: string, columns: string) {
  const res = await supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();
  if (!res.error || !isMissingSchemaError(res.error) || !columns.includes("withdrawn_at")) return res;
  const legacy = columns
    .split(",")
    .filter((c) => c !== "withdrawn_at")
    .join(",");
  return supabase.from("profiles").select(legacy).eq("id", userId).maybeSingle();
}

/**
 * profiles(공개 컬럼) + must_change_password(본인만 조회 가능한 RPC).
 * profiles는 컬럼 권한 때문에 select("*")를 쓸 수 없다(20260922000000_admin_learning_fixes.sql).
 * 실패하면 throw한다(호출하는 쪽이 이전 값을 유지하도록).
 */
async function fetchProfile(userId: string): Promise<Profile | null> {
  const [profileRes, flagRes] = await Promise.all([
    selectProfile(userId, PROFILE_COLUMNS),
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
  // withdrawn_at 컬럼이 없던 경로(위 selectProfile 대비 코드)로 읽었으면 undefined다 → null로 맞춘다.
  return { ...row, withdrawn_at: row.withdrawn_at ?? null, must_change_password: must };
}

/** 실패 후 자동 재시도 간격(ms). 마지막 값을 계속 쓴다. 창 포커스 때도 다시 시도한다. */
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];

type ProfileState = { userId: string | null; profile: Profile | null; status: ProfileStatus };
type GateBox = { userId: string | null; gate: MemberGate | null; status: ProfileStatus };

const needsGate = (g: MemberGate | null | undefined) => g?.state === "need_code" || g?.state === "need_ack";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profileState, setProfileState] = useState<ProfileState>({ userId: null, profile: null, status: "idle" });
  const [retry, setRetry] = useState(0);
  const [gateBox, setGateBox] = useState<GateBox>({ userId: null, gate: null, status: "idle" });
  const [gateRetry, setGateRetry] = useState(0);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        // 확실히 로그인되지 않은 상태(세션 만료 포함)면 과학 앱 로컬 사본을 지운다.
        // 네트워크 문제로 확인하지 못한 경우(error)는 지우지 않는다.
        if (!data.session && !error) clearScienceLocalData();
        if (active) setSession(data.session);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // 로그아웃·세션 만료(토큰 갱신 실패) → 과학 앱 로컬 입력(sci6…)을 지운다.
      if (event === "SIGNED_OUT") clearScienceLocalData();
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
  if (gateBox.userId !== userId) {
    setGateBox({ userId, gate: null, status: userId ? "loading" : "idle" });
    setGateRetry(0);
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

  // 개인정보 확인 창 상태(my_member_gate). 실패하면 이전 값을 두고(처음이면 모름 = 창 없음) 잠시 뒤 다시 읽는다.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetchMemberGate().then(
      (gate) => {
        if (active) setGateBox({ userId, gate, status: "ready" });
      },
      () => {
        if (!active) return;
        setGateBox((s) => (s.userId === userId ? { ...s, status: "error" } : s));
        timer = setTimeout(
          () => setGateRetry((n) => n + 1),
          RETRY_DELAYS[Math.min(gateRetry, RETRY_DELAYS.length - 1)],
        );
      },
    );
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [userId, gateRetry]);

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

  // refreshGate가 "방금까지 창이 떠 있었는지"를 알 수 있게 마지막 값을 둔다.
  const gateRef = useRef<MemberGate | null>(null);
  useEffect(() => {
    gateRef.current = gateBox.userId === userId ? gateBox.gate : null;
  }, [gateBox, userId]);

  // 탭 복귀(visibilitychange)와 창 초점(focus)이 거의 함께 와도 한 번만 읽는다.
  const gateInflight = useRef<Promise<MemberGate | null> | null>(null);

  const refreshGate = useCallback((): Promise<MemberGate | null> => {
    if (!userId) return Promise.resolve(null);
    if (gateInflight.current) return gateInflight.current;
    const run = (async () => {
      try {
        const next = await fetchMemberGate();
        const wasPending = needsGate(gateRef.current);
        setGateBox((s) => (s.userId === userId ? { userId, gate: next, status: "ready" } : s));
        // 다른 탭에서 인증을 마쳐 창이 풀렸으면 역할(교사)도 바뀌었을 수 있다 → 프로필도 다시 읽는다.
        if (wasPending && !needsGate(next)) void refreshProfile();
        return next;
      } catch {
        return null;
      } finally {
        gateInflight.current = null;
      }
    })();
    gateInflight.current = run;
    return run;
  }, [userId, refreshProfile]);

  // 창이 떠 있어야 하는 동안(인증·확인 전), 탭이 다시 보이거나 창에 초점이 오면 서버 상태를 다시 읽는다(spec 3.5 —
  // 다른 탭에서 인증을 마쳤으면 이 탭의 창을 닫는다). 읽기에 실패한 상태에서도 같은 때 다시 시도한다.
  const gateWatch = needsGate(gateBox.gate) || gateBox.status === "error";
  useEffect(() => {
    if (!gateWatch) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshGate();
    };
    const onFocus = () => void refreshGate();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [gateWatch, refreshGate]);

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
      gate: gateBox.userId === userId ? gateBox.gate : null,
      refreshGate,
    };
  }, [loading, session, profileState, userId, refreshProfile, gateBox, refreshGate]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession은 SessionProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

/**
 * 표시용 이름: display_name → 아이디(사전 발급 계정의 이메일 앞부분) → '사용자'.
 * 구글 계정의 이메일은 화면에 쓰지 않는다(docs/privacy/spec.md 결정 12 — 공용 PC 화면에 보이지 않게).
 */
export function displayNameOf(profile: Profile | null, user: User | null): string {
  const email = user?.email ?? "";
  const loginId = email.toLowerCase().endsWith(`@${LOGIN_EMAIL_DOMAIN}`) ? email.split("@")[0] : "";
  return profile?.display_name || loginId || "사용자";
}
