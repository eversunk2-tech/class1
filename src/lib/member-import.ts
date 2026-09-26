/**
 * 회원 추가(한 명 / 엑셀 일괄)의 검사 규칙과 Edge Function 호출.
 * 설계: docs/admin/create-members/build-instructions.md
 *
 * ⚠ 검사 규칙은 `supabase/functions/admin-create-member/index.ts`와 **똑같이** 유지한다.
 *   화면 검사는 편의일 뿐이고, 진짜 보증은 Edge Function이 한다(관리자 확인도 그쪽에서).
 * ⚠ 비밀번호는 이 모듈의 메모리(입력 중인 값)에만 있고 localStorage·로그·응답에 남기지 않는다.
 */

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { AdminActionError } from "@/lib/admin";
import { loginIdToEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colIndex, type SheetTable } from "@/lib/spreadsheet";

export type DraftRole = "user" | "admin";

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_BYTES = 72; // bcrypt 한계
export const ID_MIN = 2;
export const ID_MAX = 30;
/** 한 번의 함수 호출에 보내는 행 수. Edge Function의 한도(100)보다 작게 잡아 시간 초과를 피한다. */
export const CHUNK_SIZE = 20;
/** 파일 한 개에서 한 번에 다룰 수 있는 행 수(학급 규모보다 넉넉히). */
export const MAX_IMPORT_ROWS = 200;

const ID_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export const ROLE_LABELS: Record<DraftRole, string> = { user: "학생", admin: "교사" };

export function roleLabel(role: DraftRole | null): string {
  return role ? ROLE_LABELS[role] : "—";
}

// ─────────────────────────────────────────────
// 행 검사 (Edge Function과 같은 규칙)
// ─────────────────────────────────────────────

/** 아이디 정규화: 앞뒤 공백 제거 + 소문자(이메일은 항상 소문자로 저장된다). */
export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateLoginId(rawId: string): string | null {
  const id = normalizeLoginId(rawId);
  if (!id) return "아이디가 비어 있습니다.";
  if (/\s/.test(id)) return "아이디에 공백을 넣을 수 없습니다.";
  if (id.includes("@")) {
    return EMAIL_RE.test(id) ? null : "이메일 형식이 올바르지 않습니다.";
  }
  if (id.length < ID_MIN || id.length > ID_MAX) return `아이디는 ${ID_MIN}~${ID_MAX}자로 적어 주세요.`;
  if (!ID_RE.test(id)) return "아이디에는 영문·숫자와 . _ - 만 쓸 수 있습니다(한글·공백 불가).";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "비밀번호가 비어 있습니다.";
  if (password !== password.trim()) return "비밀번호 앞뒤에 공백이 있습니다.";
  if (password.length < MIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "비밀번호가 너무 깁니다(72바이트 이하).";
  return null;
}

const ROLE_ALIASES: Record<string, DraftRole> = {
  학생: "user",
  학생용: "user",
  일반: "user",
  user: "user",
  student: "user",
  교사: "admin",
  선생: "admin",
  선생님: "admin",
  관리자: "admin",
  admin: "admin",
  teacher: "admin",
};

export function parseRole(raw: string): DraftRole | null {
  return ROLE_ALIASES[raw.replace(/\s+/g, "").toLowerCase()] ?? null;
}

/** 교사 계정 만들기는 총괄만(docs/classes/spec.md 개정 1-1). Edge Function도 같은 규칙으로 거부한다. */
export const TEACHER_SUPER_ONLY_MESSAGE = "교사 계정은 총괄 선생님만 만들 수 있어요. 역할을 학생으로 적어 주세요.";

/**
 * 역할 권한을 목록에 반영한다: 교사를 만들 수 없는 사람(담임)이면 "교사" 줄을 고쳐야 할 줄로 표시한다.
 * 파일을 읽은 뒤 권한 정보가 늦게 와도 맞게 보이도록 화면이 그릴 때마다 적용한다(원본 목록은 그대로 둔다).
 */
export function applyRolePolicy(drafts: MemberDraft[], allowTeacher: boolean): MemberDraft[] {
  if (allowTeacher) return drafts;
  return drafts.map((d) =>
    !d.error && d.role === "admin" ? { ...d, error: TEACHER_SUPER_ONLY_MESSAGE, warning: null } : d,
  );
}

// ─────────────────────────────────────────────
// 엑셀/CSV → 만들 목록
// ─────────────────────────────────────────────

export type MemberDraft = {
  /** React key 겸 재시도 식별자 */
  key: string;
  /** 파일에서의 줄 번호(제목 줄 = 1) */
  line: number;
  /** 정규화된 아이디 */
  id: string;
  /** 파일에 적혀 있던 그대로(정규화로 달라졌는지 보여 줄 때만 쓴다) */
  rawId: string;
  /** ⚠ 화면에 표시하지 않는다. 길이만 보여 준다. */
  password: string;
  role: DraftRole | null;
  rawRole: string;
  /** 만들 수 없는 이유(한국어). null이면 만들 수 있다. */
  error: string | null;
  /** 만들 수는 있지만 확인이 필요한 점(앞자리 0 등) */
  warning: string | null;
};

const HEADER_ALIASES: Record<"id" | "password" | "role", string[]> = {
  id: ["아이디", "id", "학번", "loginid", "로그인아이디", "계정"],
  password: ["비밀번호", "password", "초기비밀번호", "초기비번", "비번", "pw"],
  role: ["역할", "role", "구분", "권한"],
};

function findColumn(header: string[], key: "id" | "password" | "role"): number {
  for (const alias of HEADER_ALIASES[key]) {
    const i = header.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

export type DraftBuildResult =
  | { ok: true; drafts: MemberDraft[]; notice: string | null }
  | { ok: false; message: string };

/** 읽어 들인 표를 "만들 목록"으로 바꾼다. 제목 줄 이름은 흔들림을 허용한다. */
export function buildDrafts(table: SheetTable): DraftBuildResult {
  const { rows, numericRefs, unsafeNumberRefs } = table;
  if (rows.length === 0) return { ok: false, message: "파일이 비어 있습니다." };
  if (rows.length < 2) return { ok: false, message: "제목 줄 아래에 만들 회원이 한 명도 없습니다." };

  const header = rows[0].map((h) => String(h).replace(/\s+/g, "").toLowerCase());
  const idIdx = findColumn(header, "id");
  const pwIdx = findColumn(header, "password");
  const roleIdx = findColumn(header, "role");
  const missing = [
    idIdx < 0 ? "아이디" : null,
    pwIdx < 0 ? "비밀번호" : null,
    roleIdx < 0 ? "역할" : null,
  ].filter((v): v is string => v !== null);
  if (missing.length) {
    return {
      ok: false,
      message: `첫 줄에서 ${missing.join("·")} 칸을 찾지 못했습니다. 첫 줄을 “아이디, 비밀번호, 역할”로 적어 주세요. (읽은 첫 줄: ${rows[0].join(", ") || "빈 줄"})`,
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      message: `한 번에 최대 ${MAX_IMPORT_ROWS}명까지 만들 수 있습니다. 파일을 나눠 주세요. (지금 ${dataRows.length}줄)`,
    };
  }

  // 숫자 서식으로 저장된 아이디·비밀번호 칸은 엑셀이 앞자리 0을 지웠을 수 있다.
  const linesOf = (refs: string[]) =>
    new Set(
      refs
        .filter((ref) => [idIdx, pwIdx].includes(colIndex(ref)))
        .map((ref) => Number(ref.replace(/\D/g, "")))
        .filter((line) => line >= 2),
    );
  const numericLines = linesOf(numericRefs);
  // 2^53을 넘는 숫자는 "앞자리 0"이 아니라 **끝자리**가 바뀐다 — 다른 문구로 알린다(review L1).
  const unsafeLines = linesOf(unsafeNumberRefs);

  const seen = new Map<string, number>();
  const drafts: MemberDraft[] = dataRows.map((cells, i) => {
    const line = i + 2; // 제목 줄이 1행
    const rawId = String(cells[idIdx] ?? "");
    const password = String(cells[pwIdx] ?? "");
    const rawRole = String(cells[roleIdx] ?? "").trim();
    const id = normalizeLoginId(rawId);
    const role = parseRole(rawRole);

    let error = validateLoginId(rawId);
    if (!error) {
      // 서버와 같은 기준(최종 이메일)으로 중복을 본다 — `60101`과 `60101@class1.local`은 같은 계정이다(review L2).
      const key = loginIdToEmail(id);
      const firstLine = seen.get(key);
      if (firstLine !== undefined) error = `${firstLine}줄과 아이디가 같습니다.`;
      else seen.set(key, line);
    }
    if (!error) error = validatePassword(password);
    if (!error && !rawRole) error = "역할이 비어 있습니다. 학생 또는 교사로 적어 주세요.";
    if (!error && !role) error = `역할 “${rawRole}”을(를) 알 수 없습니다. 학생 또는 교사로 적어 주세요.`;

    const warning = error
      ? null
      : unsafeLines.has(line)
        ? "숫자가 너무 커서 끝자리가 바뀌었을 수 있습니다. 원본과 비교해 주세요."
        : numericLines.has(line)
          ? "숫자 칸으로 저장되어 앞자리 0이 빠졌을 수 있습니다. 원본과 비교해 주세요."
          : null;

    return { key: `${line}:${id || rawId}`, line, id, rawId: rawId.trim(), password, role, rawRole, error, warning };
  });

  const numericNotice = drafts.some((d) => d.warning)
    ? "일부 칸이 숫자 서식으로 저장되어 앞자리 0이 빠졌을 수 있습니다. 엑셀에서 해당 칸을 '텍스트' 서식으로 바꾸면 사라지지 않습니다."
    : null;

  return { ok: true, drafts, notice: numericNotice };
}

// ─────────────────────────────────────────────
// Edge Function 호출
// ─────────────────────────────────────────────

export type CreateStatus = "created" | "exists" | "invalid" | "failed";

/** 감사 로그(member_create_log)에 남길 "한 명 만들기 / 엑셀 일괄" 구분. */
export type CreateSource = "single" | "bulk";

export type CreateOutcome = {
  key: string;
  line: number;
  id: string;
  status: CreateStatus;
  message?: string;
  warning?: string;
};

export type CreateRunResult = {
  outcomes: CreateOutcome[];
  /** 행과 상관없는 서버 안내(예: 감사 로그용 SQL 미실행). 같은 문구는 한 번만 담긴다. */
  notices: string[];
};

const NOT_DEPLOYED_MESSAGE =
  "회원 추가 기능이 아직 준비되지 않았습니다. Supabase에 Edge Function(admin-create-member)을 " +
  "이름 그대로 배포했는지 확인해 주세요. (배포 방법: supabase/functions/admin-create-member/README.md)";
const NOT_DEPLOYED_HINT = "계속 같은 오류가 나면 Edge Function(admin-create-member)이 배포되어 있는지 확인해 주세요.";
const NOT_DEPLOYED_OR_NETWORK_MESSAGE =
  "회원 추가 기능에 연결하지 못했습니다. 인터넷 연결을 확인하고, Supabase에 Edge Function(admin-create-member)이 배포되어 있는지 확인해 주세요.";

type InvokeResult = {
  results: { index: number; id: string; status: CreateStatus; message?: string; warning?: string }[];
  /** 계정은 만들었지만 감사 로그를 남기지 못했을 때 서버가 붙여 보내는 안내(한 번만). */
  warning?: string;
};

async function invokeCreate(
  rows: { id: string; password: string; role: DraftRole }[],
  source: CreateSource,
  classId: string | null,
): Promise<InvokeResult> {
  // classId: 학생 줄을 넣을 학급(호출자가 담임인 학급만 — Edge Function이 확인한다). 교사 줄에는 쓰이지 않는다.
  const requestBody = classId ? { rows, source, classId } : { rows, source };
  const { data, error } = await supabase.functions.invoke("admin-create-member", { body: requestBody });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response | undefined;
      const status = res?.status;

      // 우리 함수가 담아 보낸 사유(본문의 error 문자열)
      let message: string | null = null;
      try {
        const payload = (await res?.clone().json()) as { error?: unknown } | undefined;
        if (typeof payload?.error === "string" && payload.error.trim()) message = payload.error;
      } catch {
        // 본문이 JSON이 아니면 아래 기본 문구를 쓴다.
      }

      // ① 상태 코드가 원인을 분명히 알려 주는 경우에는 **본문보다 상태 코드를 먼저** 본다(review M2).
      //    함수가 배포되지 않았을 때 Supabase 게이트웨이가 {"error": "..."} 모양의 영어 본문을 내려주면,
      //    본문을 우선하던 이전 코드는 "함수를 배포하세요" 안내 대신 뜻 모를 영어 문구를 보여 줬다.
      //    아래 세 가지는 우리 함수가 내는 문구와도 뜻이 같아서 잃는 정보가 없다.
      if (status === 404) throw new AdminActionError(NOT_DEPLOYED_MESSAGE);
      if (status === 401) throw new AdminActionError("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      if (status === 413) throw new AdminActionError("한 번에 보낸 내용이 너무 큽니다. 파일을 나눠서 만들어 주세요.");
      // 403: 학급 권한 사유("내 학급에만 등록할 수 있어요" 등)는 우리 함수만 한국어로 보낸다 → 한국어면 그대로 보여 준다.
      if (status === 403) {
        throw new AdminActionError(
          message && /[가-힣]/.test(message) ? message : "관리자만 사용할 수 있습니다. 관리자 계정으로 로그인해 주세요.",
        );
      }

      // ② 그 밖의 상태(400·500 등)는 우리 함수가 담아 보낸 한국어 사유가 가장 정확하다.
      if (message) throw new AdminActionError(message);
      throw new AdminActionError(`회원을 만들지 못했습니다. (HTTP ${status ?? "오류"}) ${NOT_DEPLOYED_HINT}`);
    }
    if (error instanceof FunctionsFetchError) throw new AdminActionError(NOT_DEPLOYED_OR_NETWORK_MESSAGE);
    if (error instanceof FunctionsRelayError) {
      throw new AdminActionError("Supabase 서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new AdminActionError("회원을 만들지 못했습니다.");
  }

  const body = data as { results?: unknown; warning?: unknown } | null;
  if (!Array.isArray(body?.results)) {
    throw new AdminActionError("서버 응답이 올바르지 않습니다. Edge Function 코드가 최신인지 확인해 주세요.");
  }
  return {
    results: body.results as InvokeResult["results"],
    warning: typeof body.warning === "string" && body.warning.trim() ? body.warning : undefined,
  };
}

/**
 * 만들 목록을 CHUNK_SIZE씩 나눠 Edge Function에 보낸다.
 * 부분 실패를 허용한다: 한 덩어리가 통째로 실패해도 나머지는 계속 시도하고, 실패 사유를 행마다 남긴다.
 * `onProgress(done, total)`로 진행 상황을 알리고, 서버가 보낸 안내(감사 로그 실패 등)는 `notices`로 모아 돌려준다.
 */
export async function createMembers(
  drafts: MemberDraft[],
  options: {
    source: CreateSource;
    /** 학생 줄을 넣을 학급 id(docs/classes/spec.md 개정 1-4 요청 필드 classId). 학급 기능 전이거나 교사만 만들 때는 비움. */
    classId?: string | null;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<CreateRunResult> {
  const { source, onProgress } = options;
  const classId = options.classId ?? null;
  const targets = drafts.filter((d) => !d.error && d.role);
  const outcomes: CreateOutcome[] = [];
  const notices = new Set<string>();
  let done = 0;
  onProgress?.(0, targets.length);

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);
    try {
      const { results, warning } = await invokeCreate(
        chunk.map((d) => ({ id: d.id, password: d.password, role: d.role as DraftRole })),
        source,
        classId,
      );
      if (warning) notices.add(warning);
      const byIndex = new Map(results.map((r) => [r.index, r]));
      chunk.forEach((draft, n) => {
        const r = byIndex.get(n);
        outcomes.push({
          key: draft.key,
          line: draft.line,
          id: draft.id,
          status: r?.status ?? "failed",
          message: r?.message ?? (r ? undefined : "서버가 이 줄의 결과를 알려 주지 않았습니다."),
          warning: r?.warning,
        });
      });
    } catch (e) {
      const message = e instanceof AdminActionError ? e.message : "회원을 만들지 못했습니다.";
      for (const draft of chunk) {
        outcomes.push({ key: draft.key, line: draft.line, id: draft.id, status: "failed", message });
      }
    }
    done += chunk.length;
    onProgress?.(done, targets.length);
  }
  return { outcomes, notices: [...notices] };
}

/** 요약 문구용 집계 */
export function summarize(outcomes: CreateOutcome[]): { created: number; failed: number } {
  const created = outcomes.filter((o) => o.status === "created").length;
  return { created, failed: outcomes.length - created };
}
