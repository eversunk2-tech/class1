import { useCallback, useEffect, useState } from "react";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import type { AdminContextValue } from "@/hooks/use-admin-context";
import { AdminActionError, isMissingSchemaError, isOAuthOnlyMember, isWithdrawnMember } from "@/lib/admin";
import { chunk, fetchAllPages } from "@/lib/paging";
import { supabase } from "@/lib/supabase";
import type { MemberRow } from "@/lib/types";

/**
 * 개인정보 — 관리자(총괄·담임) 화면용 RPC·Edge Function 래퍼 (docs/privacy/spec.md 4.2·4.7·4.8, 이름표 = 계약).
 *
 * - 이름·인자는 spec 4.2 표 그대로다(묶음 1 SQL·묶음 2 Edge Function과 같은 이름). 바꾸지 않는다.
 * - SQL ① 전(함수·열이 아직 없음)이면 `PrivacyMissingError`(문구 = "준비 전" 한 줄)를 던지거나 null을 돌려준다 —
 *   화면은 깨지지 않고 그 한 줄만 보이거나 새 표시를 빼고 예전처럼 보인다.
 * - 실제 권한은 DB(RPC·RLS)와 Edge Function이 판단한다. 이 모듈과 화면의 검사는 편의일 뿐이다.
 * - 교사 인증 코드는 요청 본문으로만 보내고 어디에도(로그·저장소·주소) 남기지 않는다.
 */

export const PRIVACY_MISSING_MESSAGE = EXTRA.missing;

/** SQL ①(20261020000000_privacy_a_schema.sql) 전이라 함수·열이 없음 */
export class PrivacyMissingError extends AdminActionError {
  constructor() {
    super(PRIVACY_MISSING_MESSAGE);
  }
}

type ErrorLike = { code?: string; message?: string } | null | undefined;

/** RPC 오류 → 한국어 오류(서버가 raise exception으로 보낸 한국어 사유는 그대로). */
function toActionError(error: ErrorLike, fallback: string): AdminActionError {
  if (isMissingSchemaError(error)) return new PrivacyMissingError();
  const msg = error?.message ?? "";
  if (/[가-힣]/.test(msg)) return new AdminActionError(msg);
  return new AdminActionError(fallback);
}

/** jsonb 결과를 객체로(문자열·배열 한 겹으로 와도 읽는다). */
function parseJson(data: unknown): unknown {
  let raw: unknown = data;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return raw;
}

function asObject(raw: unknown): Record<string, unknown> {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

// ─────────────────────────────────────────────
// 총괄: 교사 인증 코드 · 문의 이메일 · 현황 (spec 4.2, privacy-policy.md 8-7)
// ─────────────────────────────────────────────

/** 교사 인증 코드 = 숫자 6자리(서버 admin_set_teacher_code와 같은 규칙) */
export const TEACHER_CODE_LENGTH = 6;
export const TEACHER_CODE_RE = /^\d{6}$/;

/** 문의 이메일: 254자 이하, 공백·제어 문자 없음, `이름@도메인.끝` 모양(서버도 다시 본다). */
export const CONTACT_EMAIL_MAX = 254;
const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export function isValidContactEmail(raw: string): boolean {
  const email = raw.trim();
  return email.length > 0 && email.length <= CONTACT_EMAIL_MAX && !CONTROL_RE.test(email) && EMAIL_SHAPE_RE.test(email);
}

export type PrivacyOverview = {
  codeSet: boolean;
  codeSetAt: string | null;
  contactEmail: string | null;
  privacyVersion: number;
  pendingCount: number;
  pendingOver30d: number;
  wrongLastHour: number;
  lockedAccounts: number;
};

/** admin_privacy_overview() — 총괄만. SQL ① 전이면 PrivacyMissingError. */
export async function fetchPrivacyOverview(): Promise<PrivacyOverview> {
  const { data, error } = await supabase.rpc("admin_privacy_overview");
  if (error) throw toActionError(error, EXTRA.overviewError);
  const o = asObject(parseJson(data));
  return {
    codeSet: o.code_set === true,
    codeSetAt: str(o.code_set_at),
    contactEmail: str(o.contact_email),
    privacyVersion: num(o.privacy_version) || 1,
    pendingCount: num(o.pending_count),
    pendingOver30d: num(o.pending_over_30d),
    wrongLastHour: num(o.wrong_last_hour),
    lockedAccounts: num(o.locked_accounts),
  };
}

/** admin_set_teacher_code(p_code) — 총괄만. 숫자 6자리가 아니면 보내지 않는다. */
export async function setTeacherCode(code: string): Promise<void> {
  if (!TEACHER_CODE_RE.test(code)) throw new AdminActionError(T.settings.codeBad);
  const { error } = await supabase.rpc("admin_set_teacher_code", { p_code: code });
  if (error) throw toActionError(error, T.network);
}

/** admin_set_contact_email(p_email) — 총괄만. 모양이 아니면 보내지 않는다. */
export async function setContactEmail(email: string): Promise<void> {
  const value = email.trim();
  if (!isValidContactEmail(value)) throw new AdminActionError(T.settings.emailBad);
  const { error } = await supabase.rpc("admin_set_contact_email", { p_email: value });
  if (error) throw toActionError(error, T.network);
}

// ─────────────────────────────────────────────
// 회원 목록 표시: 구글 계정 인증 상태 · 교사 권한 범위 (8-3) — 총괄만
// ─────────────────────────────────────────────

export type TeacherScope = "full" | "class";

export function toTeacherScope(v: unknown): TeacherScope {
  return v === "class" ? "class" : "full";
}

export type MemberPrivacyFlag = {
  id: string;
  /** 인증 전 구글 계정(spec 3.1 pending) */
  pending: boolean;
  origin: "new" | "existing" | null;
  teacherScope: TeacherScope;
  verifiedAt: string | null;
  signedUpDays: number | null;
};

/** admin_member_privacy_flags() — 총괄만. 회원 id → 표시 정보. */
export async function fetchMemberPrivacyFlags(): Promise<Map<string, MemberPrivacyFlag>> {
  const { data, error } = await supabase.rpc("admin_member_privacy_flags");
  if (error) throw toActionError(error, EXTRA.overviewError);
  const raw = parseJson(data);
  const list = Array.isArray(raw) ? raw : [];
  const map = new Map<string, MemberPrivacyFlag>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    map.set(r.id, {
      id: r.id,
      pending: r.pending === true,
      origin: r.origin === "new" || r.origin === "existing" ? r.origin : null,
      teacherScope: toTeacherScope(r.teacher_scope),
      verifiedAt: str(r.verified_at),
      signedUpDays: numOrNull(r.signed_up_days),
    });
  }
  return map;
}

/** 가입 후 일수(서버 값이 있으면 그 값, 없으면 가입 시각으로 센다). */
export function signedUpDaysOf(flag: MemberPrivacyFlag | undefined, signedUpAt: string | null | undefined): number | null {
  if (flag?.signedUpDays != null) return flag.signedUpDays;
  if (!signedUpAt) return null;
  const t = Date.parse(signedUpAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

/** '30일 넘음' 표시 기준(spec 3.5 — 가입 후 30일이 넘으면 붉은 표시) */
export const PENDING_OVERDUE_DAYS = 30;

/** admin_set_teacher_scope(p_user, p_scope) — 총괄만, 교사 계정, 자기 자신 불가(서버가 다시 본다). */
export async function setTeacherScope(userId: string, scope: TeacherScope): Promise<void> {
  const { error } = await supabase.rpc("admin_set_teacher_scope", { p_user: userId, p_scope: scope });
  if (error) throw toActionError(error, EXTRA.saveFailed);
}

// ─────────────────────────────────────────────
// 보호자 동의 기록 (spec 4.8, 8-2)
// ─────────────────────────────────────────────

export type GuardianConsent = {
  at: string;
  by: string | null;
  /** 표시한 선생님 이름(못 읽으면 null) */
  byName: string | null;
};

/**
 * 보호자 동의를 표시한 학생(member_directory.guardian_consent_at/by — 관리자 표, 담임은 자기 학급 학생만 읽힌다).
 * 열이 없으면(SQL ① 전) PrivacyMissingError. 표시한 선생님 이름은 profiles에서 따로 읽는다(외래키 이름에 기대지 않게).
 */
export async function fetchGuardianConsents(): Promise<Map<string, GuardianConsent>> {
  type Row = { id: string; guardian_consent_at: string | null; guardian_consent_by: string | null };
  let rows: Row[];
  try {
    rows = await fetchAllPages<Row>((from, to) =>
      supabase
        .from("member_directory")
        .select("id,guardian_consent_at,guardian_consent_by", { count: "exact" })
        .not("guardian_consent_at", "is", null)
        .order("id")
        .range(from, to),
    );
  } catch (e) {
    throw toActionError(e as ErrorLike, EXTRA.overviewError);
  }
  const names = new Map<string, string | null>();
  const ids = [...new Set(rows.map((r) => r.guardian_consent_by).filter((v): v is string => !!v))];
  for (const part of chunk(ids, 100)) {
    const { data } = await supabase.from("profiles").select("id,display_name").in("id", part);
    for (const p of (data ?? []) as { id: string; display_name: string | null }[]) names.set(p.id, p.display_name);
  }
  const map = new Map<string, GuardianConsent>();
  for (const r of rows) {
    if (!r.guardian_consent_at) continue;
    map.set(r.id, {
      at: r.guardian_consent_at,
      by: r.guardian_consent_by,
      byName: r.guardian_consent_by ? (names.get(r.guardian_consent_by)?.trim() || null) : null,
    });
  }
  return map;
}

/** admin_set_guardian_consent(p_student, p_value) — 그 학생의 담임만(총괄도 다른 학급 학생은 못 함). */
export async function setGuardianConsent(studentId: string, value = true): Promise<void> {
  const { error } = await supabase.rpc("admin_set_guardian_consent", { p_student: studentId, p_value: value });
  if (error) throw toActionError(error, EXTRA.saveFailed);
}

/** admin_set_guardian_consent_class(p_class_id) — 담임. 기록 없는 학생을 모두 표시하고 바뀐 수를 돌려준다. */
export async function setGuardianConsentForClass(classId: string): Promise<number> {
  const { data, error } = await supabase.rpc("admin_set_guardian_consent_class", { p_class_id: classId });
  if (error) throw toActionError(error, EXTRA.saveFailed);
  return num(parseJson(data));
}

// ─────────────────────────────────────────────
// 학급 정리 · 기한 (spec 4.7-3, 8-4)
// ─────────────────────────────────────────────

export type CleanupPreview = {
  className: string;
  /** 지울 학생 계정 수(탈퇴 처리된 학생 포함) */
  students: number;
  /** 그중 탈퇴 처리된 학생 수 */
  withdrawn: number;
};

/** admin_class_cleanup_preview(p_class_id) — 그 학급 담임 또는 총괄. */
export async function fetchClassCleanupPreview(classId: string): Promise<CleanupPreview> {
  const { data, error } = await supabase.rpc("admin_class_cleanup_preview", { p_class_id: classId });
  if (error) throw toActionError(error, EXTRA.previewError);
  const o = asObject(parseJson(data));
  const withdrawn = num(o.withdrawn);
  return {
    className: str(o.class_name) ?? "",
    // students는 탈퇴 처리된 학생을 포함한 수(8-4 "학생 계정 {n}명(탈퇴 처리된 학생 {m}명 포함)")
    students: Math.max(num(o.students), withdrawn),
    withdrawn,
  };
}

export type RetentionClass = { classId: string; className: string; students: number };

export type RetentionStatus = {
  /** 기한(종업식 뒤 그 학년도의 2월 28일)이 지났는데 남은 학생 수(내가 볼 수 있는 학급 합계) */
  overdueStudents: number;
  /** 기한이 지난 학생이 남은 학급(학생 수가 많은 순) */
  classes: RetentionClass[];
  /** 2월 알림(개정 3): 2월 한 달 동안 이번 학년도 학생 수 — 2월이 아니거나 없으면 0 */
  februaryStudents: number;
  /** 2월 알림에 보일 학급(이번 학년도 학생이 남은 학급) */
  februaryClasses: RetentionClass[];
};

/**
 * admin_class_retention_status() — 담임(자기 학급)·총괄(전체). 자동으로 지우지 않는다(결정 9 — 표시만).
 * SQL ① 전이면 PrivacyMissingError.
 */
export async function fetchClassRetentionStatus(): Promise<RetentionStatus> {
  const { data, error } = await supabase.rpc("admin_class_retention_status");
  if (error) throw toActionError(error, EXTRA.overviewError);
  return parseRetention(parseJson(data));
}

function classIdOf(c: Record<string, unknown>): string | null {
  return typeof c.class_id === "string" ? c.class_id : typeof c.id === "string" ? c.id : null;
}

function sortClasses(list: RetentionClass[]): RetentionClass[] {
  return list.sort((a, b) => b.students - a.students || a.className.localeCompare(b.className, "ko"));
}

/** 한국 시간 기준 오늘의 달(1~12) — 서버가 `today`를 주지 않을 때만 쓴다. */
function seoulMonthNow(): number {
  const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric" }).format(new Date());
  return Number(m);
}

/** 서버 `today`("2027-02-10")의 달. 없거나 모양이 다르면 null. */
function monthOf(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(v);
  return m ? Number(m[1]) : null;
}

/**
 * admin_class_retention_status() 결과를 읽는다(개정 3 — 보유 기한 "종업식 뒤 그 학년도의 2월 28일"). 화면이 읽는 이름:
 * - 바탕은 SQL ①의 모양 `{ today, past_deadline, due_total, overdue_total, classes:[{ class_id, class_name, old_students, students }] }`.
 *   개정 3 규칙(메인 에이전트가 SQL을 고침): 지난 학년도 학생은 3월 1일부터 기한 지남, 2월에는 이번 학년도 학생이 "2월 28일까지 정리할 학생".
 * - 기한 지남(학급마다): `overdue_students`가 있으면 그 값, 없으면 `past_deadline`이 참일 때 `old_students`.
 * - 2월 알림(학급마다, 2월일 때만): `february_students`·`due_students`·`current_students` 중 있는 값, 없으면
 *   `past_deadline`이 거짓일 때 `old_students`(그 학급의 기한 지남 수는 뺌). 2월인지는 `february`·`in_february`·`february_notice`
 *   또는 `today`의 달로 본다(둘 다 없으면 기기의 한국 시간).
 * - 합계는 학급 값의 합(학급이 있어야 [학급 정리 열기]를 보일 수 있다). `overdue_total`이 더 크면 그 값을 쓴다.
 */
function parseRetention(raw: unknown): RetentionStatus {
  const obj = Array.isArray(raw) ? { classes: raw } : asObject(raw);
  const past = obj.past_deadline === true;
  const todayMonth = monthOf(obj.today);
  const february =
    obj.february === true ||
    obj.in_february === true ||
    obj.february_notice === true ||
    (todayMonth != null ? todayMonth === 2 : seoulMonthNow() === 2);
  const list = Array.isArray(obj.classes) ? obj.classes : [];
  const overdue: RetentionClass[] = [];
  const feb: RetentionClass[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const classId = classIdOf(c);
    if (!classId) continue;
    const className = str(c.class_name) ?? str(c.name) ?? "이름 없는 학급";
    const overdueN = c.overdue_students !== undefined ? num(c.overdue_students) : past ? num(c.old_students) : 0;
    if (overdueN > 0) overdue.push({ classId, className, students: overdueN });
    const explicitFeb = c.february_students ?? c.due_students ?? c.current_students;
    const febN = !february
      ? 0
      : explicitFeb !== undefined
        ? num(explicitFeb)
        : !past
          ? Math.max(0, num(c.old_students) - (c.overdue_students !== undefined ? num(c.overdue_students) : 0))
          : 0;
    if (febN > 0) feb.push({ classId, className, students: febN });
  }
  const sum = (l: RetentionClass[]) => l.reduce((s, c) => s + c.students, 0);
  const total = numOrNull(obj.overdue_total);
  const overdueStudents = Math.max(sum(overdue), overdue.length && total != null ? total : 0);
  const febTotal = numOrNull(obj.february_total);
  const februaryStudents = Math.max(sum(feb), feb.length && febTotal != null ? febTotal : 0);
  return { overdueStudents, classes: sortClasses(overdue), februaryStudents, februaryClasses: sortClasses(feb) };
}

// ─────────────────────────────────────────────
// Edge Function admin-clear-students — 학급 정리(20명씩) · 학생 한 명 '기록까지 삭제' (spec 4.7-3, 5절)
// ─────────────────────────────────────────────

export type ClearBatch = { deleted: number; failed: number; remaining: number; warning?: string };

async function invokeClear(body: { classId: string; confirmName: string } | { userId: string; confirmName: string }): Promise<ClearBatch> {
  const { data, error } = await supabase.functions.invoke("admin-clear-students", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response | undefined;
      let message: string | null = null;
      try {
        const payload = (await res?.clone().json()) as { error?: unknown } | undefined;
        if (typeof payload?.error === "string" && payload.error.trim()) message = payload.error;
      } catch {
        // 본문이 JSON이 아니면 아래 기본 문구를 쓴다.
      }
      if (res?.status === 404 && !(message && /[가-힣]/.test(message))) throw new AdminActionError(EXTRA.clearNotDeployed);
      if (res?.status === 401) throw new AdminActionError(EXTRA.sessionExpired);
      if (message && /[가-힣]/.test(message)) throw new AdminActionError(message);
      throw new AdminActionError(`${EXTRA.clearFailed} (HTTP ${res?.status ?? "오류"})`);
    }
    if (error instanceof FunctionsFetchError) throw new AdminActionError(EXTRA.clearNetwork);
    if (error instanceof FunctionsRelayError) throw new AdminActionError(T.network);
    throw new AdminActionError(EXTRA.clearFailed);
  }
  const b = (data ?? {}) as Record<string, unknown>;
  if (b.ok !== true && b.deleted === undefined) {
    throw new AdminActionError("서버 응답이 올바르지 않습니다. Edge Function 코드가 최신인지 확인해 주세요.");
  }
  return {
    deleted: num(b.deleted),
    failed: num(b.failed),
    remaining: num(b.remaining),
    warning: typeof b.warning === "string" && b.warning.trim() ? b.warning : undefined,
  };
}

/** 한 학급을 다 지울 때까지 되풀이할 최대 횟수(20명씩 — 1,200명 넉넉히) */
const MAX_CLEAR_ROUNDS = 60;

/**
 * 학급 정리: 함수가 한 번에 20명씩 지우므로 `remaining = 0`이 될 때까지 되풀이한다(멱등 — 다시 눌러도 안전).
 * - 한 번 불러 아무도 지우지 못하고 남은 학생이 있으면 멈춘다(같은 학생이 계속 실패하는 경우) → `remaining`이 남는다.
 * - 도중에 오류가 나면 그대로 던진다(그때까지 지운 수는 onProgress로 이미 알렸다).
 */
export async function clearClassStudents(
  classId: string,
  confirmName: string,
  onProgress?: (deleted: number) => void,
): Promise<{ deleted: number; remaining: number; warning?: string }> {
  let deleted = 0;
  let remaining = 0;
  let warning: string | undefined;
  for (let round = 0; round < MAX_CLEAR_ROUNDS; round++) {
    const r = await invokeClear({ classId, confirmName });
    deleted += r.deleted;
    remaining = r.remaining;
    warning = r.warning ?? warning;
    onProgress?.(deleted);
    if (remaining <= 0 || r.deleted <= 0) break;
  }
  return { deleted, remaining: Math.max(0, remaining), warning };
}

/** 학생 한 명 '기록까지 삭제'(8-5). 대상: 아이디 계정 학생, 호출자 = 그 학생의 담임 또는 총괄(함수가 확인). */
export async function eraseStudent(userId: string, confirmName: string): Promise<ClearBatch> {
  return invokeClear({ userId, confirmName });
}

// ─────────────────────────────────────────────
// 회원 목록·상세가 함께 쓰는 "개인정보 표시 정보" 훅
// ─────────────────────────────────────────────

export type MemberPrivacyInfo = {
  /** 총괄만: 회원 id → 인증 상태·권한 범위. null = 읽지 않음(총괄 아님)·SQL ① 전·못 읽음 */
  flags: Map<string, MemberPrivacyFlag> | null;
  /** 보호자 동의 기록. null = 아직 모름(읽는 중·SQL ① 전·못 읽음) → 열을 그리지 않는다 */
  consents: Map<string, GuardianConsent> | null;
  /** SQL ① 전 */
  missing: boolean;
  reload: () => void;
  patchFlag: (id: string, patch: Partial<MemberPrivacyFlag>) => void;
  patchConsent: (ids: string[], consent: GuardianConsent | null) => void;
};

/**
 * 회원 목록·상세에서 개인정보 표시(인증 전 배지·권한 범위·보호자 동의 열)를 읽는다.
 * - wantFlags: 총괄일 때만 true(admin_member_privacy_flags는 총괄만).
 * - wantConsents: 학급 기능이 켜진 뒤(담임·총괄).
 * 못 읽어도 화면을 막지 않는다(표시만 빠짐).
 */
export function useMemberPrivacyInfo(wantFlags: boolean, wantConsents: boolean): MemberPrivacyInfo {
  const [flags, setFlags] = useState<Map<string, MemberPrivacyFlag> | null>(null);
  const [consents, setConsents] = useState<Map<string, GuardianConsent> | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (wantFlags) {
      fetchMemberPrivacyFlags().then(
        (m) => {
          if (active) setFlags(m);
        },
        (e: unknown) => {
          if (!active) return;
          setFlags(null);
          if (e instanceof PrivacyMissingError) setMissing(true);
        },
      );
    }
    if (wantConsents) {
      fetchGuardianConsents().then(
        (m) => {
          if (active) setConsents(m);
        },
        (e: unknown) => {
          if (!active) return;
          setConsents(null);
          if (e instanceof PrivacyMissingError) setMissing(true);
        },
      );
    }
    return () => {
      active = false;
    };
  }, [wantFlags, wantConsents, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const patchFlag = useCallback((id: string, patch: Partial<MemberPrivacyFlag>) => {
    setFlags((prev) => {
      if (!prev) return prev;
      const next = new Map(prev);
      const cur = next.get(id) ?? {
        id,
        pending: false,
        origin: null,
        teacherScope: "full" as TeacherScope,
        verifiedAt: null,
        signedUpDays: null,
      };
      next.set(id, { ...cur, ...patch });
      return next;
    });
  }, []);
  const patchConsent = useCallback((ids: string[], consent: GuardianConsent | null) => {
    setConsents((prev) => {
      if (!prev) return prev;
      const next = new Map(prev);
      for (const id of ids) {
        if (consent) next.set(id, consent);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  return {
    flags: wantFlags ? flags : null,
    consents: wantConsents ? consents : null,
    missing,
    reload,
    patchFlag,
    patchConsent,
  };
}

/** 동의 표시 날짜(짧게: 2026. 10. 20.) */
const consentDateFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

export function consentDateLabel(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? consentDateFormatter.format(new Date(t)) : "";
}

/** "동의서 확인 {날짜}" / "{선생님 이름} 선생님이 표시했어요." */
export function consentTexts(consent: GuardianConsent): { label: string; hint: string } {
  return {
    label: fillText(T.consentColumn.done, { 날짜: consentDateLabel(consent.at) }),
    // 표시한 선생님 계정이 지워져 이름을 모르면 "선생님이 표시했어요."만 보인다.
    hint: fillText(T.consentColumn.doneHint, { "선생님 이름": consent.byName ?? "" }).trim(),
  };
}

// ─────────────────────────────────────────────
// 개인정보 표시·메뉴(docs/privacy/spec.md 4.7·4.8·6절, 문구 privacy-policy.md 8-2·8-3·8-5)
// ─────────────────────────────────────────────

/** 보호자 동의 열의 대상(아이디로 로그인하는 학생 계정). 교사·구글 계정은 해당 없음. */
export function isConsentSubject(row: MemberRow): boolean {
  return row.profiles?.role !== "admin" && !isOAuthOnlyMember(row);
}

/** 이 학생의 담임인가(내 학급 학생) — 동의 표시는 그 학생의 담임만(총괄도 다른 학급 학생은 못 함). */
export function isMyStudent(row: MemberRow, ctx: AdminContextValue): boolean {
  return ctx.status === "ready" && !!row.class_id && ctx.classes.some((c) => c.id === row.class_id);
}

/** 개인정보 메뉴 항목을 정한다(할 수 없으면 null — 메뉴에 넣지 않음). 실제 판단은 서버가 다시 한다. */
export function privacyMenuOf(
  row: MemberRow,
  ctx: AdminContextValue,
  info: Pick<MemberPrivacyInfo, "flags" | "consents">,
  myId: string | null,
): { consent: boolean; erase: boolean; scope: TeacherScope | null } {
  const ready = ctx.status === "ready";
  const superAdmin = ready && ctx.isSuperAdmin;
  const withdrawn = isWithdrawnMember(row);
  const subject = isConsentSubject(row);
  // [동의서 받음으로 기록]: 기록 없는 내 학급 학생(탈퇴하지 않음)
  const consent = ready && subject && !withdrawn && !!info.consents && !info.consents.has(row.id) && isMyStudent(row, ctx);
  // [기록까지 삭제]: 아이디 계정 학생(탈퇴 처리된 학생 포함) — 그 학생의 담임 또는 총괄
  const erase = ready && subject && row.id !== myId && (superAdmin || isMyStudent(row, ctx));
  // [모든 권한 주기]/[내 학급 일만으로 줄이기]: 총괄, 교사 계정, 자기 자신 제외, 지금 범위를 알 때
  const flag = info.flags?.get(row.id);
  const scope =
    superAdmin && row.profiles?.role === "admin" && row.id !== myId && info.flags ? (flag?.teacherScope ?? "full") : null;
  return { consent, erase, scope };
}

/** 지금 사용자로 "방금 표시함" 기록을 만든다(서버 값으로 다시 읽기 전 화면용). */
export function consentByMe(myId: string | null, myName: string | null | undefined): GuardianConsent {
  return { at: new Date().toISOString(), by: myId, byName: myName?.trim() || null };
}
