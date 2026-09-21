import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError, type User } from "@supabase/supabase-js";
import { LOGIN_EMAIL_DOMAIN } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/paging";
import { MEMBER_ROW_COLUMNS, type MemberRow, type Role } from "@/lib/types";

/**
 * 관리자 화면 공용 쿼리/표시 헬퍼 (docs/admin/spec.md §3.4~3.5).
 * 새 테이블(member_directory 등)은 20260921020000_admin_learning.sql 실행 전에는 없으므로,
 * 호출하는 화면은 isMissingSchemaError로 "DB 설정 필요" 안내를 따로 보여 준다.
 */

type ErrorLike = { code?: string; message?: string } | null | undefined;

/** 테이블/함수/컬럼이 아직 없어서 난 오류인지(마이그레이션 미실행) 판별한다. */
export function isMissingSchemaError(error: unknown): boolean {
  const e = error as ErrorLike;
  if (!e) return false;
  // PGRST200(관계 없음)/PGRST201(관계가 여러 개)는 embed 문법 문제라 "SQL 실행" 안내가 아니라 일반 오류로 다룬다(review #18).
  if (e.code === "PGRST200" || e.code === "PGRST201") {
    console.error("PostgREST embed 관계 오류(코드 수정 필요):", e.code, e.message);
    return false;
  }
  // PGRST205: 테이블 없음, PGRST202: 함수 없음, PGRST204/42703: 컬럼 없음, 42P01: relation 없음, 42883: function 없음
  if (e.code && ["PGRST205", "PGRST202", "PGRST204", "42P01", "42703", "42883"].includes(e.code)) return true;
  const m = (e.message ?? "").toLowerCase();
  return (
    m.includes("could not find the table") ||
    m.includes("could not find the function") ||
    /(relation|column|function) .* does not exist/.test(m)
  );
}

export const MISSING_SCHEMA_MESSAGE =
  "관리자 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20260921020000_admin_learning.sql을 실행해 주세요.";

/**
 * must_change_password는 본인·관리자만 볼 수 있어(review #17) profiles embed로 읽지 않고
 * admin_must_change_password_ids() RPC로 받아 합친다. 함수가 아직 없으면(마이그레이션 전) 표시만 빠진다.
 */
async function fetchMustChangeIds(): Promise<Set<string> | null> {
  const { data, error } = await supabase.rpc("admin_must_change_password_ids");
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
  return new Set(Array.isArray(data) ? (data as string[]) : []);
}

function withFlags(rows: MemberRow[], ids: Set<string> | null): MemberRow[] {
  if (!ids) return rows;
  return rows.map((r) => (r.profiles ? { ...r, profiles: { ...r.profiles, must_change_password: ids.has(r.id) } } : r));
}

/** 전체 회원(한 번에 전부 가져와 클라이언트에서 검색/정렬). 1000명이 넘어도 페이지로 나눠 모두 받는다. */
export async function fetchMembers(): Promise<MemberRow[]> {
  const [rows, ids] = await Promise.all([
    fetchAllPages<MemberRow>(
      (from, to) =>
        supabase
          .from("member_directory")
          .select(MEMBER_ROW_COLUMNS, { count: "exact" })
          .order("signed_up_at", { ascending: false })
          .order("id")
          .range(from, to),
    ),
    fetchMustChangeIds(),
  ]);
  return withFlags(rows, ids);
}

/** 최근 가입 회원 n명 */
export async function fetchRecentMembers(limit: number): Promise<MemberRow[]> {
  const [res, ids] = await Promise.all([
    supabase.from("member_directory").select(MEMBER_ROW_COLUMNS).order("signed_up_at", { ascending: false }).limit(limit),
    fetchMustChangeIds(),
  ]);
  if (res.error) throw res.error;
  return withFlags((res.data ?? []) as unknown as MemberRow[], ids);
}

/** 회원 1명. 없으면 null */
export async function fetchMember(id: string): Promise<MemberRow | null> {
  const [res, ids] = await Promise.all([
    supabase.from("member_directory").select(MEMBER_ROW_COLUMNS).eq("id", id).maybeSingle(),
    fetchMustChangeIds(),
  ]);
  if (res.error) throw res.error;
  const row = (res.data as unknown as MemberRow | null) ?? null;
  return row ? withFlags([row], ids)[0] : null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 사전 발급 계정({아이디}@class1.local)은 아이디만, 그 밖에는 이메일 전체를 보여 준다. */
export function accountLabel(email: string | null | undefined): string {
  if (!email) return "—";
  return email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`) ? email.slice(0, -(LOGIN_EMAIL_DOMAIN.length + 1)) : email;
}

/** 표시 이름: display_name → 아이디/이메일 앞부분 */
export function memberName(member: Pick<MemberRow, "email" | "profiles">): string {
  return member.profiles?.display_name || accountLabel(member.email).split("@")[0] || "이름 없음";
}

const PROVIDER_LABELS: Record<string, string> = { email: "아이디", github: "GitHub", google: "Google" };

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** 연결된 가입 방식 목록(대표 방식이 앞). 비어 있으면 대표 방식 하나. */
export function memberProviders(member: Pick<MemberRow, "provider" | "providers">): string[] {
  const list = member.providers?.length ? [...member.providers] : member.provider ? [member.provider] : [];
  if (member.provider && list.includes(member.provider)) {
    list.splice(list.indexOf(member.provider), 1);
    list.unshift(member.provider);
  }
  return list;
}

/** 비밀번호(아이디/이메일) 로그인이 가능한 계정인지. OAuth 전용 계정은 초기화할 수 없다. */
export function canResetPassword(member: Pick<MemberRow, "provider" | "providers">): boolean {
  return memberProviders(member).includes("email");
}

/**
 * 비밀번호 초기화를 막는 이유(가능하면 null). Edge Function도 같은 규칙으로 거부한다(review #2).
 * - OAuth 전용 계정: 비밀번호가 없다.
 * - 관리자 계정(자기 자신 포함): 관리자 간 계정 탈취를 막기 위해 초기화 불가. 먼저 관리자 해제가 필요하다.
 */
export function passwordResetBlockReason(
  member: Pick<MemberRow, "id" | "provider" | "providers" | "profiles">,
  myId: string | null | undefined,
): { short: string; long: string } | null {
  if (member.id === myId) {
    return { short: "본인 계정", long: "자기 자신의 비밀번호는 여기서 초기화할 수 없습니다. 사용자 메뉴의 '비밀번호 변경'을 이용하세요." };
  }
  if (member.profiles?.role === "admin") {
    return {
      short: "관리자 계정",
      long: "관리자 계정의 비밀번호는 초기화할 수 없습니다. 꼭 필요하면 먼저 관리자 권한을 해제한 뒤 초기화하세요.",
    };
  }
  if (!canResetPassword(member)) {
    return { short: "OAuth 계정", long: "GitHub·Google로만 가입한 계정은 비밀번호가 없어 초기화할 수 없습니다." };
  }
  return null;
}

/** 로그인한 사용자가 비밀번호 로그인 계정인지(Auth User 기준) */
export function userHasPasswordLogin(user: User | null): boolean {
  if (!user) return false;
  const meta = user.app_metadata ?? {};
  const providers: unknown = meta.providers;
  if (Array.isArray(providers) && providers.includes("email")) return true;
  if (meta.provider === "email") return true;
  return (user.identities ?? []).some((i) => i.provider === "email");
}

export class AdminActionError extends Error {}

/**
 * Edge Function(admin-reset-password)으로 비밀번호를 초기화한다.
 * 성공 시 임시 비밀번호를 돌려준다(화면에 한 번만 보여 주고 어디에도 저장하지 않는다).
 * 실패 시 한국어 메시지를 담은 AdminActionError를 던진다.
 */
export async function resetMemberPassword(userId: string): Promise<{ tempPassword: string; warning?: string }> {
  const { data, error } = await supabase.functions.invoke("admin-reset-password", { body: { userId } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response | undefined;
      let message: string | null = null;
      try {
        const body = (await res?.clone().json()) as { error?: unknown } | undefined;
        if (typeof body?.error === "string") message = body.error;
      } catch {
        // 본문이 JSON이 아니면 아래 기본 문구를 쓴다.
      }
      if (message) throw new AdminActionError(message);
      if (res?.status === 404) throw new AdminActionError(NOT_DEPLOYED_MESSAGE);
      if (res?.status === 401) throw new AdminActionError("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      throw new AdminActionError(`비밀번호를 초기화하지 못했습니다. (HTTP ${res?.status ?? "오류"})`);
    }
    if (error instanceof FunctionsFetchError) {
      // 함수가 배포되지 않았거나(게이트웨이 404에는 CORS 헤더가 없어 네트워크 오류로 보인다) 연결이 끊긴 경우
      throw new AdminActionError(NOT_DEPLOYED_OR_NETWORK_MESSAGE);
    }
    if (error instanceof FunctionsRelayError) {
      throw new AdminActionError("Supabase 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new AdminActionError("비밀번호를 초기화하지 못했습니다.");
  }
  const body = data as { tempPassword?: unknown; warning?: unknown } | null;
  if (!body || typeof body.tempPassword !== "string" || !body.tempPassword) {
    throw new AdminActionError("서버 응답이 올바르지 않습니다. Edge Function 코드가 최신인지 확인해 주세요.");
  }
  return { tempPassword: body.tempPassword, warning: typeof body.warning === "string" ? body.warning : undefined };
}

const NOT_DEPLOYED_MESSAGE =
  "비밀번호 초기화 기능이 아직 준비되지 않았습니다. Supabase에 Edge Function(admin-reset-password)을 배포해 주세요.";
const NOT_DEPLOYED_OR_NETWORK_MESSAGE =
  "비밀번호 초기화 기능에 연결하지 못했습니다. 인터넷 연결을 확인하고, Supabase에 Edge Function(admin-reset-password)이 배포되어 있는지 확인해 주세요.";

/** 관리자 지정/해제 (admin_set_role RPC). 실패 시 한국어 메시지를 담은 AdminActionError. */
export async function setMemberRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc("admin_set_role", { p_user: userId, p_role: role });
  if (!error) return;
  if (isMissingSchemaError(error)) throw new AdminActionError(MISSING_SCHEMA_MESSAGE);
  // RPC가 raise exception으로 보낸 한국어 문구(자기 자신 해제 불가 등)는 그대로 보여 준다.
  const msg = error.message ?? "";
  if (/[가-힣]/.test(msg)) throw new AdminActionError(msg);
  throw new AdminActionError("역할을 바꾸지 못했습니다.");
}
