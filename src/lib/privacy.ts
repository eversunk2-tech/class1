import { useEffect, useState } from "react";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { GATE_MESSAGES } from "@/data/privacy-policy";
import { isMissingSchemaError } from "@/lib/admin";
import { clearLocalUserData } from "@/lib/local-data";
import { supabase } from "@/lib/supabase";

/**
 * 개인정보 처리방침 · 구글 선생님 확인 창 · 회원 탈퇴 — 화면 쪽 데이터 계층(docs/privacy/spec.md 3·4.2·4.3·6절).
 *
 * 이름표(spec 4.2 — DB·함수와 같은 이름): RPC `my_member_gate`·`verify_google_teacher`·`acknowledge_privacy`,
 * Edge Function `member-self-delete`, `site_settings.contact_email`·`privacy_version`·`policy_effective_at`.
 *
 * SQL ① 전(RPC·열이 아직 없음)에는 모두 "할 일 없음"으로 떨어져 지금 사이트가 그대로 동작한다:
 * `my_member_gate` 없음 → 창 없음, `site_settings`의 새 열 없음 → 처리방침 "준비 중"·링크 숨김.
 * 실제 막기는 서버(RLS·RPC)가 한다 — 이 파일과 창은 안내일 뿐이다.
 *
 * 교사 인증 코드는 RPC 요청 본문(HTTPS)으로만 보내고 어디에도 저장·기록하지 않는다(주소·로그·저장소에 남기지 않음).
 */

/** 화면이 보여 주는 처리방침의 판 번호. DB `site_settings.privacy_version`과 같아야 한다(spec 3.7 — Review가 대조). */
export const POLICY_VERSION = 1;

/**
 * 3-2 창(처리방침이 바뀌었어요)의 "바뀐 점" 한 줄 — 판 번호를 올릴 때 여기에 그 판의 한 줄을 더한다.
 * 그 판의 줄이 없으면 창에서 "바뀐 점" 줄을 숨긴다(1판은 처음이라 없음).
 */
export const POLICY_CHANGE_SUMMARY: Readonly<Record<number, string>> = {};

/**
 * 원문(privacy-policy.md 1~7절)에 없는 화면 글 — 모두 여기 모은다(보고서 docs/privacy/build-3-report.md에 문장 그대로 적음).
 * 출처: spec 3.2·4.4·4.10, privacy-policy.md 5절 메모·9절 규칙, 그리고 묶음 3이 새로 쓴 문장(★).
 */
export const PRIVACY_EXTRA_TEXT = {
  /** 로그인 화면 구글 단추 아래 안내 한 줄(spec 3.2) */
  loginGoogleHint: "구글로 처음 오신 선생님은 교사 인증 코드가 필요해요.",
  /** 처리방침 링크 이름(5절 제목에서) */
  policyLinkLabel: "개인정보 처리방침",
  /** 쉬운 설명 링크 이름(6절 제목) */
  easyLinkLabel: "친구들을 위한 쉬운 설명",
  /** 처리방침 시행 전(policy_effective_at 없음) — 5절 메모·9절 규칙 */
  preparing: "개인정보 처리방침을 준비하고 있어요",
  /** 문의 이메일을 못 받았을 때 — 9절 규칙 */
  emailFailed: "문의 이메일을 불러오지 못했어요.",
  /** 다시 불러오기 단추 — 9절 규칙 */
  reload: "다시 불러오기",
  /** ★ 처리방침 설정 자체를 읽지 못했을 때(네트워크 오류 등) */
  policyLoadFailed: "개인정보 처리방침을 불러오지 못했어요.",
  /** ★ 인증·확인 RPC가 "판 번호가 다름(policy_changed)"을 돌려줬을 때 — 3-2 창 제목 + 4절 "화면을 새로 고쳐 주세요." */
  policyChanged: "개인정보 처리방침이 바뀌었어요. 화면을 새로 고쳐 주세요.",
  /** 프로필 수정 창: 구글 계정은 이메일 대신(spec 4.4) */
  googleAccountLabel: "구글 계정으로 로그인 중이에요.",
  /** 로그아웃 방문자에게 보이는 글쓴이 이름(spec 4.10) */
  memberFallbackName: "회원",
  /** ★ 회원 탈퇴를 마친 뒤 알림(4-1절 "가입하지 않았어요. 계정을 지웠어요."와 같은 모양) */
  withdrawDone: "탈퇴했어요. 계정을 지웠어요.",
} as const;

// ─────────────────────────────────────────────
// 글 채우기
// ─────────────────────────────────────────────

/**
 * 원문 표기(`**굵게**`, `` `{자리}` ``)가 든 글을 알림·단추용 **보통 글자**로 바꾼다.
 * 자리(`{n}` 등)는 vars로 채우고, 남은 굵게·코드 표시는 지운다.
 */
export function plainText(text: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return text
    .replace(/`?\{([^{}`]+)\}`?/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole))
    .replace(/\*\*/g, "")
    .replace(/`/g, "");
}

// ─────────────────────────────────────────────
// 별명 검사 — 서버(verify_google_teacher·acknowledge_privacy)와 같은 규칙(spec 4.3-6)
// ─────────────────────────────────────────────

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/**
 * 정확히 같으면(대소문자 무시) 쓸 수 없는 별명 — SQL ①의 `privacy_nickname_error()`와 같은 목록(spec 4.3-6).
 * 서버가 최종 판단하고, 다르면 서버 문구를 보여 준다.
 */
export const RESERVED_NICKNAMES: readonly string[] = [
  "관리자",
  "총괄",
  "총괄 관리자",
  "총괄관리자",
  "운영자",
  "사이트 운영자",
  "psc",
  "admin",
  "administrator",
  "인증 전 회원",
  "탈퇴한 학생",
  "탈퇴한 회원",
  "회원",
  "익명",
  "선생님", // 별명을 정하기 전 구글 관리자의 이름(SQL ②)과 구별되게 — 검토 R1 N3
];

/** 글자 수(Postgres char_length와 같은 코드 포인트 기준) */
export function nicknameLength(raw: string): number {
  return Array.from(raw.trim()).length;
}

/**
 * 별명 문제(없으면 null). 서버(`privacy_nickname_error`)와 같은 순서: 비었을 때 → 쓸 수 없는 글자(제어문자·줄바꿈·`@`·`http`·`www.`,
 * 대소문자 무시) → 길이(2~20자) → 예약어.
 */
export function validateNickname(raw: string): string | null {
  const name = raw.trim();
  if (!name) return GATE_MESSAGES.nicknameEmpty;
  const lower = name.toLowerCase();
  if (/[\u0000-\u001f\u007f-\u009f]/.test(name) || name.includes("@") || lower.includes("http") || lower.includes("www.")) {
    return GATE_MESSAGES.nicknameForbidden;
  }
  const len = nicknameLength(name);
  if (len < NICKNAME_MIN || len > NICKNAME_MAX) return GATE_MESSAGES.nicknameLength;
  if (RESERVED_NICKNAMES.includes(lower)) return GATE_MESSAGES.nicknameReserved;
  return null;
}

/** 교사 인증 코드 칸: 숫자 6자리 */
export const CODE_LENGTH = 6;
export function isCompleteCode(code: string): boolean {
  return new RegExp(`^[0-9]{${CODE_LENGTH}}$`).test(code);
}

// ─────────────────────────────────────────────
// my_member_gate() — 창을 띄울지
// ─────────────────────────────────────────────

export type GateState = "ok" | "need_code" | "need_ack";

export type MemberGate = {
  /** ok = 창 없음, need_code = 구글 · 인증 전(1·2절 창), need_ack = 코드 없는 확인(3-1·3-2절 창) */
  state: GateState;
  /** 구글 계정의 가입 구분(새 가입 / 기존 회원). 아이디 계정·알 수 없음은 null */
  origin: "new" | "existing" | null;
  /** need_ack에서 처음 확인하는가(true → 3-1 별명 칸 있음, false → 3-2 판 번호가 오른 다시 확인) */
  firstTime: boolean;
  /** 틀린 시도가 많아 잠겨 있으면 남은 초 */
  lockedSeconds: number | null;
  /** 서버의 지금 처리방침 판 번호 */
  policyVersion: number | null;
  /** 개인정보 기능(SQL ①)이 서버에 있는가. false = RPC 없음 → 창·회원 탈퇴 메뉴 없음(지금 사이트 그대로) */
  ready: boolean;
};

/** SQL ① 전: 함수가 없음 → 아무 창도 띄우지 않는다 */
export const GATE_NOT_READY: MemberGate = {
  state: "ok",
  origin: null,
  firstTime: false,
  lockedSeconds: null,
  policyVersion: null,
  ready: false,
};

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** jsonb 응답(객체·JSON 글자·한 줄 배열 모두)을 객체로 */
function asObject(raw: unknown): Record<string, unknown> {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      v = null;
    }
  }
  if (Array.isArray(v)) v = v[0];
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export function parseMemberGate(raw: unknown): MemberGate {
  const o = asObject(raw);
  const state: GateState = o.state === "need_code" || o.state === "need_ack" ? o.state : "ok";
  const origin = o.origin === "new" || o.origin === "existing" ? o.origin : null;
  const locked = toInt(o.locked_seconds);
  return {
    state,
    origin,
    firstTime: o.first_time === true,
    lockedSeconds: locked && locked > 0 ? locked : null,
    policyVersion: toInt(o.policy_version),
    ready: true,
  };
}

/** 로그인한 본인의 창 상태. 함수가 없으면(SQL ① 전) GATE_NOT_READY, 그 밖의 실패는 throw(부르는 쪽이 다시 시도). */
export async function fetchMemberGate(): Promise<MemberGate> {
  const { data, error } = await supabase.rpc("my_member_gate");
  if (error) {
    if (isMissingSchemaError(error)) return GATE_NOT_READY;
    throw error;
  }
  return parseMemberGate(data);
}

// ─────────────────────────────────────────────
// verify_google_teacher() · acknowledge_privacy()
// ─────────────────────────────────────────────

export type GateActionResult =
  /** 성공 — 프로필·창 상태를 다시 읽는다 */
  | { kind: "ok" }
  /** 이미 마침(다른 탭) — 창 상태를 다시 읽고 4절 문구를 알린다 */
  | { kind: "already"; message: string }
  /** 이 창이 맞지 않음(not_applicable — 예: 그사이 교사가 됨) — 창 상태만 다시 읽는다 */
  | { kind: "refresh" }
  /** 창 안에 보여 줄 오류. clearCode = 코드 칸을 비운다(틀린 코드) */
  | { kind: "error"; message: string; clearCode?: boolean };

function serverMessage(o: Record<string, unknown>): string | null {
  const m = typeof o.message === "string" ? o.message : typeof o.error === "string" ? o.error : null;
  return m && /[가-힣]/.test(m) ? m : null;
}

function lockedMessage(seconds: number | null): string {
  const minutes = Math.max(1, Math.ceil((seconds ?? 60) / 60));
  return plainText(GATE_MESSAGES.locked, { n: minutes });
}

/** RPC 결과(jsonb) → 화면 결과. 서버는 예외 대신 결과를 돌려준다(spec 4.3 — 틀린 횟수가 되돌려지지 않게). */
export function interpretGateResult(raw: unknown, nickname: string | null): GateActionResult {
  const o = asObject(raw);
  if (o.ok === true) return { kind: "ok" };
  const reason = typeof o.reason === "string" ? o.reason : "";
  const lockedSeconds = toInt(o.locked_seconds ?? o.seconds);
  switch (reason) {
    case "already":
      return { kind: "already", message: GATE_MESSAGES.already };
    case "not_applicable":
    // acknowledge_privacy: 아직 인증 전(코드가 필요한 창으로 바뀌어야 함)
    case "need_code":
      return { kind: "refresh" };
    case "policy_changed":
      return { kind: "error", message: PRIVACY_EXTRA_TEXT.policyChanged };
    case "not_configured":
      return { kind: "error", message: GATE_MESSAGES.notConfigured };
    case "locked":
      return { kind: "error", message: lockedMessage(lockedSeconds), clearCode: true };
    case "busy":
      return { kind: "error", message: GATE_MESSAGES.busy, clearCode: true };
    case "bad_nickname":
      return {
        kind: "error",
        message: serverMessage(o) ?? (nickname !== null ? validateNickname(nickname) : null) ?? GATE_MESSAGES.nicknameReserved,
      };
    case "wrong_code": {
      // 이번 틀림으로 잠겼으면(남은 초가 함께 오면) 잠금 문구
      if (lockedSeconds && lockedSeconds > 0) return { kind: "error", message: lockedMessage(lockedSeconds), clearCode: true };
      const left = toInt(o.attempts_left);
      const message =
        left !== null && left >= 0
          ? plainText(GATE_MESSAGES.wrongCode, { n: left })
          : plainText(GATE_MESSAGES.wrongCode.replace(/\s*\(남은 시도: `\{n\}`번\)$/, ""));
      return { kind: "error", message, clearCode: true };
    }
    default:
      return { kind: "error", message: serverMessage(o) ?? GATE_MESSAGES.network };
  }
}

/** 새 구글 계정·기존 구글 회원의 교사 인증(1·2절 창). 코드는 이 요청 본문으로만 보낸다. */
export async function verifyGoogleTeacher(nickname: string, code: string): Promise<GateActionResult> {
  try {
    const { data, error } = await supabase.rpc("verify_google_teacher", {
      p_nickname: nickname.trim(),
      p_code: code,
      p_policy_version: POLICY_VERSION,
    });
    if (error) return { kind: "error", message: GATE_MESSAGES.network };
    return interpretGateResult(data, nickname);
  } catch {
    return { kind: "error", message: GATE_MESSAGES.network };
  }
}

/** 코드가 필요 없는 구글 관리자의 확인(3-1절 — 별명 필수) · 판 번호가 오른 다시 확인(3-2절 — 별명 없음). */
export async function acknowledgePrivacy(nickname: string | null): Promise<GateActionResult> {
  try {
    const { data, error } = await supabase.rpc("acknowledge_privacy", {
      p_nickname: nickname === null ? null : nickname.trim(),
      p_policy_version: POLICY_VERSION,
    });
    if (error) return { kind: "error", message: GATE_MESSAGES.network };
    return interpretGateResult(data, nickname);
  } catch {
    return { kind: "error", message: GATE_MESSAGES.network };
  }
}

// ─────────────────────────────────────────────
// Edge Function member-self-delete — [가입하지 않기](cancel) · 회원 탈퇴(withdraw)
// ─────────────────────────────────────────────

export class PrivacyActionError extends Error {}

export type SelfDeleteResult =
  | { ok: true; warning?: string }
  /** withdraw: 맡은 학급에 학생이 남아 있음(학급 이름 목록) */
  | { ok: false; blocked: string[] };

function blockedList(body: Record<string, unknown>): string[] | null {
  if (!Array.isArray(body.blocked)) return null;
  return body.blocked.map((x) => (typeof x === "string" ? x : String(x ?? ""))).filter(Boolean);
}

/**
 * 본인 계정 삭제. 서버가 조건(인증 전·구글 전용·총괄 아님 등)을 다시 확인한다(spec 4.7-2).
 * 성공하면 이 기기도 로그아웃해야 한다(localSignOut). 실패는 한국어 PrivacyActionError.
 */
export async function selfDeleteMember(mode: "cancel" | "withdraw"): Promise<SelfDeleteResult> {
  const { data, error } = await supabase.functions.invoke("member-self-delete", { body: { mode } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response | undefined;
      let body: Record<string, unknown> = {};
      try {
        body = asObject(await res?.clone().json());
      } catch {
        // 본문이 JSON이 아니면 아래 기본 문구
      }
      const blocked = blockedList(body);
      if (blocked && blocked.length) return { ok: false, blocked };
      const message = serverMessage(body);
      if (message) throw new PrivacyActionError(message);
      throw new PrivacyActionError(GATE_MESSAGES.network);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new PrivacyActionError(GATE_MESSAGES.network);
    }
    throw new PrivacyActionError(GATE_MESSAGES.network);
  }
  const body = asObject(data);
  const blocked = blockedList(body);
  if (blocked && blocked.length) return { ok: false, blocked };
  if (body.ok !== true) {
    throw new PrivacyActionError(serverMessage(body) ?? GATE_MESSAGES.network);
  }
  return { ok: true, warning: typeof body.warning === "string" ? body.warning : undefined };
}

/**
 * 계정을 지운 뒤 이 기기만 로그아웃한다(서버의 계정은 이미 없다).
 * 과학 앱 로컬 사본·임시 글을 지우고 세션을 지운다 — 올릴 기록을 묻는 보통 로그아웃(signOut)과 달리 묻지 않는다.
 */
export async function localSignOut(): Promise<void> {
  clearLocalUserData();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // 세션 지우기가 실패해도 계속(다음 접속 때 서버가 세션을 거부한다)
  }
  clearLocalUserData();
}

/** 총괄인지(회원 탈퇴 메뉴를 숨기려고). 관리자가 아니거나 함수가 없거나 실패하면 null = 모름. */
export async function fetchIsSuperAdmin(): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc("my_admin_context");
    if (error) return null;
    const o = asObject(data);
    return typeof o.is_super_admin === "boolean" ? o.is_super_admin : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// site_settings — 처리방침 시행 여부·문의 이메일·판 번호(공개 읽기)
// ─────────────────────────────────────────────

export type PrivacySettings = {
  /** 처리방침 시행 시각(SQL ③ 실행 때). null = 아직 시행 전 → "준비 중", 링크 숨김 */
  effectiveAt: string | null;
  /** 총괄이 넣은 문의 이메일. null = 없음 → "문의 이메일을 불러오지 못했어요." */
  contactEmail: string | null;
  /** DB 판 번호(없으면 null) */
  version: number | null;
};

const NOT_EFFECTIVE: PrivacySettings = { effectiveAt: null, contactEmail: null, version: null };

/**
 * 처리방침 설정 읽기. 열·표가 아직 없으면(SQL ① 전) 시행 전으로 본다. 그 밖의 실패는 throw.
 * 문의 이메일은 이메일 모양일 때만 쓴다(관리자 화면이 검사하지만 한 번 더).
 */
export async function fetchPrivacySettings(): Promise<PrivacySettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("contact_email,privacy_version,policy_effective_at")
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return NOT_EFFECTIVE;
    throw error;
  }
  const row = (data ?? null) as {
    contact_email?: unknown;
    privacy_version?: unknown;
    policy_effective_at?: unknown;
  } | null;
  if (!row) return NOT_EFFECTIVE;
  const email = typeof row.contact_email === "string" ? row.contact_email.trim() : "";
  const effective =
    typeof row.policy_effective_at === "string" && !Number.isNaN(Date.parse(row.policy_effective_at))
      ? row.policy_effective_at
      : null;
  return {
    effectiveAt: effective,
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    version: toInt(row.privacy_version),
  };
}

/** 시행일(DB 시각) → 한국 날짜 "YYYY년 M월 D일"(privacy-policy.md 9절) */
export function formatEffectiveDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return `${get("year")}년 ${get("month")}월 ${get("day")}일`;
}

// 바닥·로그인 화면이 함께 쓰는 한 번 읽기(페이지를 새로 열 때마다 한 번). 실패하면 다음 화면에서 다시 읽는다.
let effectivePromise: Promise<boolean> | null = null;

function loadPolicyEffective(): Promise<boolean> {
  if (!effectivePromise) {
    effectivePromise = fetchPrivacySettings().then(
      (s) => s.effectiveAt !== null,
      () => {
        effectivePromise = null;
        return false;
      },
    );
  }
  return effectivePromise;
}

/**
 * 처리방침이 시행 중인가(바닥·로그인 화면의 링크를 보일지). 모르는 동안·읽지 못하면 false(링크 숨김).
 * 기존 use-login-lock.ts처럼 site_settings를 공개 키로 읽는다.
 */
export function usePolicyEffective(): boolean {
  const [effective, setEffective] = useState(false);
  useEffect(() => {
    let active = true;
    loadPolicyEffective().then((v) => {
      if (active) setEffective(v);
    });
    return () => {
      active = false;
    };
  }, []);
  return effective;
}
