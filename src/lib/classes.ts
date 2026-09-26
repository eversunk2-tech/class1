import { AdminActionError, isMissingSchemaError } from "@/lib/admin";
import { fetchAllPages } from "@/lib/paging";
import { supabase } from "@/lib/supabase";

/**
 * 학급(반) — 관리자 화면 전용 (docs/classes/spec.md 개정 1, 이름표 1-4).
 *
 * - 담임교사는 자기 학급을 직접 개설하고(이름은 스스로 정함) 그 학급에 학생을 등록한다.
 * - 총괄은 모든 회원·모든 학급 이름을 보지만, 학습 기록은 자기 학급 학생 것만 본다(RLS가 거른다).
 * - 학급 이름·소속은 **관리자 화면에서만** 보인다. 학생 화면(`/me/…`)·과학 앱·공개 화면에서는 이 모듈을 쓰지 않는다.
 *
 * 실제 권한은 DB(RLS·RPC)와 Edge Function이 판단한다. 이 모듈과 화면의 검사는 편의일 뿐이다.
 */

/** DB 제약과 같은 값: char_length(btrim(name)) between 1 and 40 */
export const CLASS_NAME_MAX = 40;
/** 화면 안내용 권장 길이(개정 1-2 "1~20자 권장") */
export const CLASS_NAME_RECOMMENDED = 20;

/** my_admin_context()가 돌려주는 "내가 담임인 학급" 한 개 */
export type AdminClass = { id: string; name: string; studentCount: number };

/** my_admin_context() 결과 */
export type AdminContextData = { isSuperAdmin: boolean; classes: AdminClass[] };

/** classes 표에서 읽을 수 있는 학급(총괄: 모든 학급, 담임: 자기 학급 — RLS) */
export type ClassInfo = { id: string; name: string; archivedAt: string | null };

export const CLASSES_MISSING_MESSAGE =
  "학급 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20260927000000_classes_schema.sql을 실행해 주세요.";

/** 앞뒤 공백을 뺀 글자 수(한글·이모지를 한 글자로 센다 — DB의 char_length와 같은 기준). */
export function classNameLength(raw: string): number {
  return [...raw.trim()].length;
}

/** 줄바꿈·탭 같은 제어 문자(서버 create_class/rename_class도 거부한다) */
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;

/** 학급 이름 검사(서버와 같은 규칙). 문제가 없으면 null. */
export function validateClassName(raw: string): string | null {
  const len = classNameLength(raw);
  if (len === 0) return "학급 이름을 적어 주세요.";
  if (len > CLASS_NAME_MAX) return `학급 이름은 ${CLASS_NAME_MAX}자까지 적을 수 있어요. (지금 ${len}자)`;
  if (CONTROL_CHAR_RE.test(raw.trim())) return "학급 이름에는 줄바꿈이나 탭을 쓸 수 없어요.";
  return null;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** my_admin_context()의 jsonb 결과를 안전하게 읽는다(문자열로 올 수도 있다). */
function parseAdminContext(data: unknown): AdminContextData {
  let raw: unknown = data;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (Array.isArray(raw)) raw = raw[0];
  const obj = (raw && typeof raw === "object" ? raw : {}) as { is_super_admin?: unknown; classes?: unknown };
  const list = Array.isArray(obj.classes) ? obj.classes : [];
  const classes: AdminClass[] = list
    .map((c) => (c && typeof c === "object" ? (c as { id?: unknown; name?: unknown; student_count?: unknown }) : null))
    .filter((c): c is { id: unknown; name: unknown; student_count?: unknown } => !!c && typeof c.id === "string")
    .map((c) => ({
      id: String(c.id),
      name: typeof c.name === "string" && c.name.trim() ? c.name : "이름 없는 학급",
      studentCount: toNumber(c.student_count),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { isSuperAdmin: obj.is_super_admin === true, classes };
}

/**
 * 총괄 여부와 내가 담임인 학급 목록(학생 수 포함). 관리자가 아니면 오류.
 * 함수가 아직 없으면(학급 SQL 적용 전) 오류를 그대로 던진다 — 호출하는 쪽이 isMissingSchemaError로 "예전 방식"으로 돌아간다.
 */
export async function fetchAdminContext(): Promise<AdminContextData> {
  const { data, error } = await supabase.rpc("my_admin_context");
  if (error) throw error;
  return parseAdminContext(data);
}

/** RPC 오류 → 한국어 AdminActionError(RPC가 raise exception으로 보낸 한국어 사유는 그대로). */
function toActionError(error: { code?: string; message?: string }, fallback: string): AdminActionError {
  if (isMissingSchemaError(error)) return new AdminActionError(CLASSES_MISSING_MESSAGE);
  const msg = error.message ?? "";
  if (/[가-힣]/.test(msg)) return new AdminActionError(msg);
  return new AdminActionError(fallback);
}

/** 학급 개설(create_class). 만든 사람이 그 학급의 담임이 된다. 새 학급 id를 돌려준다. */
export async function createClass(name: string): Promise<string> {
  const problem = validateClassName(name);
  if (problem) throw new AdminActionError(problem);
  const { data, error } = await supabase.rpc("create_class", { p_name: name.trim() });
  if (error) throw toActionError(error, "학급을 개설하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  if (typeof data !== "string" || !data) {
    throw new AdminActionError("서버 응답이 올바르지 않습니다. 학급 SQL이 최신인지 확인해 주세요.");
  }
  return data;
}

/** 학급 이름 바꾸기(rename_class). 그 학급의 담임만 바꿀 수 있다. */
export async function renameClass(classId: string, name: string): Promise<void> {
  const problem = validateClassName(name);
  if (problem) throw new AdminActionError(problem);
  const { error } = await supabase.rpc("rename_class", { p_class_id: classId, p_name: name.trim() });
  if (error) throw toActionError(error, "학급 이름을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.");
}

/** 이름을 볼 수 있는 학급 전체(총괄: 모든 학급, 담임: 자기 학급). 읽지 못하면 throw. */
export async function fetchVisibleClasses(): Promise<ClassInfo[]> {
  const rows = await fetchAllPages<{ id: string; name: string | null; archived_at: string | null }>((from, to) =>
    supabase.from("classes").select("id,name,archived_at", { count: "exact" }).order("name").order("id").range(from, to),
  );
  return rows.map((r) => ({ id: r.id, name: r.name?.trim() || "이름 없는 학급", archivedAt: r.archived_at ?? null }));
}

/**
 * 교사별 담임 학급(class_teachers). 총괄은 모든 줄, 담임은 자기 줄만 읽힌다(RLS).
 * 돌려주는 Map: 교사 id → 학급 id 목록. 회원 명단에서 교사 행에 "담임: ○○반"을 보여 주는 보조 정보다.
 */
export async function fetchClassTeachers(): Promise<Map<string, string[]>> {
  const rows = await fetchAllPages<{ class_id: string; teacher_id: string }>((from, to) =>
    supabase
      .from("class_teachers")
      .select("class_id,teacher_id", { count: "exact" })
      .order("teacher_id")
      .order("class_id")
      .range(from, to),
  );
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.teacher_id) ?? [];
    list.push(r.class_id);
    map.set(r.teacher_id, list);
  }
  return map;
}
