import { supabase } from "@/lib/supabase";
import { withBasePath } from "@/lib/base-path";
import { clearLocalUserData } from "@/lib/local-data";
import { conflictQuestion, flushScienceProgress, unsavedQuestion } from "@/lib/science-progress";

/** 사전 발급 계정의 아이디 → 이메일 매핑 규칙 (spec §12 Q2) */
export const LOGIN_EMAIL_DOMAIN = "class1.local";

export function loginIdToEmail(id: string): string {
  const trimmed = id.trim();
  // import-users 스크립트와 같은 규칙: 이메일은 항상 소문자(Supabase도 소문자로 저장한다).
  return (trimmed.includes("@") ? trimmed : `${trimmed}@${LOGIN_EMAIL_DOMAIN}`).toLowerCase();
}

export type OAuthProvider = "github" | "google";

export async function signInWithId(id: string, password: string) {
  return supabase.auth.signInWithPassword({ email: loginIdToEmail(id), password });
}

/**
 * Supabase Auth 공개 설정(/auth/v1/settings)에서 OAuth 공급자 활성화 여부를 확인한다.
 * 비활성 공급자로 바로 리다이렉트하면 Supabase의 JSON 오류 화면으로 이동해 버리므로 먼저 확인한다.
 */
export async function isOAuthProviderEnabled(provider: OAuthProvider): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Failed to fetch");
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`settings ${res.status}`);
  const json = (await res.json()) as { external?: Record<string, boolean> };
  return json.external?.[provider] === true;
}

/**
 * OAuth 로그인. 공급자가 설정되지 않았으면 리다이렉트하지 않고 오류를 반환한다.
 * 성공 시 브라우저가 공급자 로그인 화면으로 이동하고, 돌아오면 /login/에서 세션을 감지한다.
 */
export async function signInWithOAuth(provider: OAuthProvider): Promise<{ error: { message: string } | null }> {
  let enabled: boolean;
  try {
    enabled = await isOAuthProviderEnabled(provider);
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "Failed to fetch" } };
  }
  if (!enabled) return { error: { message: "provider is not enabled" } };

  const redirectTo = window.location.origin + withBasePath("/login/");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { error };
  if (!data.url) return { error: { message: "OAuth URL을 받지 못했습니다." } };
  window.location.assign(data.url);
  return { error: null };
}

/**
 * 로그아웃.
 * 1) 과학 앱이 이 기기에 남긴 "아직 DB에 올리지 못한" 기록을 지금 세션(= 기록 주인일 때만)으로 올린다.
 *    다른 기기 기록과 부딪히면 학생에게 묻고, 올리지 못하면 "그래도 로그아웃할까요?"를 묻는다(취소하면 로그아웃하지 않음).
 * 2) 이 브라우저에 남은 사용자 입력(과학 앱 `sci6…` 로컬 사본, 에디터 임시 글)을 앞뒤로 지운다
 *    (로그아웃 요청이 실패하거나 도중에 다른 탭이 다시 쓰더라도 남지 않게 두 번 지운다).
 * 3) 서버에 알리지 못해도(오프라인) 이 기기의 세션은 지운다(scope: "local").
 */
export async function signOut(
  options: { confirm?: (message: string) => boolean } = {},
): Promise<{ cancelled: boolean }> {
  const ask = options.confirm ?? ((message: string) => window.confirm(message));
  const flushed = await flushScienceProgress({ confirmConflict: (info) => ask(conflictQuestion(info)) });
  if (!flushed.ok && !ask(unsavedQuestion(flushed))) return { cancelled: true };
  clearLocalUserData();
  try {
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" });
  } catch {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  } finally {
    clearLocalUserData();
  }
  return { cancelled: false };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Supabase 인증 오류 메시지를 한국어로 바꾼다. */
export function authErrorMessage(message: string | undefined | null): string {
  if (!message) return "로그인 중 오류가 발생했습니다.";
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("email not confirmed")) return "아직 활성화되지 않은 계정입니다. 관리자에게 문의하세요.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "이 로그인 방식은 아직 설정되지 않았습니다. 다른 방법을 이용해 주세요.";
  if (m.includes("access_denied") || m.includes("access denied")) return "로그인이 취소되었습니다.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  if (m.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  return `로그인 중 오류가 발생했습니다. (${message})`;
}

/** 새 비밀번호 저장(supabase.auth.updateUser) 오류를 한국어로 바꾼다. */
export function passwordUpdateErrorMessage(message: string | undefined | null, code?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (code === "same_password" || m.includes("different from the old password"))
    return "지금 쓰고 있는 비밀번호와 같아요. 다른 비밀번호를 입력해 주세요.";
  if (code === "weak_password" || m.includes("weak") || m.includes("should be at least") || m.includes("pwned"))
    return "비밀번호가 너무 짧거나 쉬워요. 영문·숫자를 섞어 더 길게 만들어 주세요.";
  if (code === "reauthentication_needed" || m.includes("reauthenticat"))
    return "보안을 위해 다시 로그인한 뒤 비밀번호를 바꿔 주세요.";
  if (m.includes("session") && (m.includes("missing") || m.includes("expired")))
    return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  if (m.includes("failed to fetch") || m.includes("network")) return "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  if (m.includes("rate limit")) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  return message ? `비밀번호를 바꾸지 못했습니다. (${message})` : "비밀번호를 바꾸지 못했습니다.";
}
