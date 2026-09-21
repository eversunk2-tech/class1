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
import type { Profile } from "@/lib/types";

type SessionState = {
  /** 최초 세션 확인이 끝나기 전에는 true */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** profiles 행. 로그인 전이거나 조회 실패 시 null */
  profile: Profile | null;
  /** profiles.role === 'admin'. UX용이며 실제 권한은 RLS가 결정한다. */
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as Profile | null) ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next = userId ? await fetchProfile(userId) : null;
      if (active) setProfile(next);
    };
    load();
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfile(await fetchProfile(userId));
  }, [userId]);

  const value = useMemo<SessionState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile: profile && profile.id === userId ? profile : null,
      isAdmin: profile?.id === userId && profile?.role === "admin",
      refreshProfile,
    }),
    [loading, session, profile, userId, refreshProfile],
  );

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
