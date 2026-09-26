import { AdminActionError, isMissingSchemaError } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

/**
 * 학급별 '선생님 글'(class_notices) — docs/classes/spec.md 개정 2, SQL `20260927020000_class_notices.sql`.
 *
 * - 제목·본문만 있는 학급 공지. 쓰면 바로 보인다(공개 여부·태그·주소 없음). 읽음 기록·조회수·댓글 없음.
 * - 누가 어떤 글을 보는지는 **RLS가 정한다**(화면은 거르지 않는다):
 *   · 로그인한 학생 = 자기 학급 글만, 담임(총괄 포함) = 자기 학급 글만
 *   · 로그인하지 않은 방문자 = 총괄 선생님이 쓴 글만(로그인 잠금이 켜져 있으면 없음)
 * - 쓰기·고치기·지우기는 그 학급의 담임만(RLS). 작성자(author_id)는 DB 기본값(auth.uid())이라 보내지 않는다.
 * - 본문은 **글자 그대로** 보여 준다(마크다운·HTML 해석 안 함 — 화면은 whitespace-pre-wrap 텍스트로만 그린다).
 */

/** DB 제약과 같은 값: 제목 1~100자(앞뒤 공백 제외), 본문 1~5000자 */
export const NOTICE_TITLE_MAX = 100;
export const NOTICE_BODY_MAX = 5000;

/** 홈 목록 한 줄(날짜는 학생 화면에 보이지 않으므로 읽지 않는다) */
export type NoticeSummary = { id: string; title: string; body: string };

/** 관리자 목록 한 줄 */
export type ClassNotice = {
  id: string;
  class_id: string;
  /** 쓴 선생님(총괄이 쓴 글은 비로그인 방문자에게도 보인다). 작성자 계정이 없어졌으면 null */
  author_id: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

const SUMMARY_COLUMNS = "id,title,body";
const ADMIN_COLUMNS = "id,class_id,author_id,title,body,created_at,updated_at";

export const NOTICES_MISSING_MESSAGE =
  "선생님 글용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20260927020000_class_notices.sql을 실행해 주세요.";

/** 글자 수(한글·이모지를 한 글자로 센다 — DB의 char_length와 같은 기준) */
export function charCount(text: string): number {
  return [...text].length;
}

/** 제목: 줄바꿈·탭 같은 제어 문자는 빈칸으로 바꾸고 앞뒤 공백을 뺀다(DB도 제어 문자를 거부한다). */
export function normalizeNoticeTitle(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

/** 본문: 줄바꿈을 \n으로 맞추고 앞뒤 빈칸·빈 줄을 뺀다. 가운데 줄바꿈·띄어쓰기는 그대로 둔다. */
export function normalizeNoticeBody(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim();
}

/** 제목 검사(서버와 같은 규칙). 문제가 없으면 null. */
export function noticeTitleProblem(raw: string): string | null {
  const len = charCount(normalizeNoticeTitle(raw));
  if (len === 0) return "제목을 적어 주세요.";
  if (len > NOTICE_TITLE_MAX) return `제목은 ${NOTICE_TITLE_MAX}자까지 쓸 수 있어요. (지금 ${len}자)`;
  return null;
}

/** 본문 검사(서버와 같은 규칙). 문제가 없으면 null. */
export function noticeBodyProblem(raw: string): string | null {
  const len = charCount(normalizeNoticeBody(raw));
  if (len === 0) return "본문을 적어 주세요.";
  if (len > NOTICE_BODY_MAX) return `본문은 ${NOTICE_BODY_MAX.toLocaleString("ko-KR")}자까지 쓸 수 있어요. (지금 ${len.toLocaleString("ko-KR")}자)`;
  return null;
}

// ─────────────────────────────────────────────
// 홈 '선생님 글' (학생·방문자·교사 모두 — RLS가 보이는 글을 정한다)
// ─────────────────────────────────────────────

/**
 * 지금 보이는 선생님 글(최신순). 표가 아직 없으면(SQL 전) 조용히 빈 목록 — 홈에 오류 화면을 띄우지 않는다.
 * 그 밖의 오류는 던진다(화면이 "다시 시도"를 보여 준다).
 */
export async function fetchVisibleNotices(offset: number, size: number): Promise<NoticeSummary[]> {
  const { data, error } = await supabase
    .from("class_notices")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + size - 1);
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as NoticeSummary[];
}

/** 지금 보이는 선생님 글 수(본문 없이 개수만). 표가 아직 없으면 0. */
export async function countVisibleNotices(): Promise<number> {
  const { count, error } = await supabase.from("class_notices").select("id", { count: "exact", head: true });
  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

// ─────────────────────────────────────────────
// 관리자 '선생님 글' (그 학급의 담임만 — RLS)
// ─────────────────────────────────────────────

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** 저장·삭제 오류 → 한국어 AdminActionError */
function toNoticeError(error: unknown, fallback: string): AdminActionError {
  if (isMissingSchemaError(error)) return new AdminActionError(NOTICES_MISSING_MESSAGE);
  const e = error as ErrorLike;
  const m = (e?.message ?? "").toLowerCase();
  if (e?.code === "42501" || m.includes("row-level security") || m.includes("permission denied")) {
    return new AdminActionError("이 학급의 담임 선생님만 글을 쓰고 고치고 지울 수 있어요. 학급 정보를 새로고침한 뒤 다시 시도해 주세요.");
  }
  if (e?.code === "23514") {
    return new AdminActionError(`제목(1~${NOTICE_TITLE_MAX}자)과 본문(1~${NOTICE_BODY_MAX}자)을 확인해 주세요.`);
  }
  if (e?.code === "23503") return new AdminActionError("학급을 찾을 수 없어요. 새로고침한 뒤 다시 시도해 주세요.");
  if (e?.code === "PGRST301" || e?.status === 401 || m.includes("jwt")) {
    return new AdminActionError("로그인이 만료되었어요. 다시 로그인한 뒤 저장해 주세요. 쓰던 내용은 이 화면에 그대로 있어요.");
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return new AdminActionError("인터넷 연결을 확인한 뒤 다시 시도해 주세요. 쓰던 내용은 이 화면에 그대로 있어요.");
  }
  return new AdminActionError(fallback);
}

/** 한 학급의 글(최신순, 페이지 단위). 읽지 못하면 throw(표가 없으면 isMissingSchemaError로 판별). */
export async function fetchClassNotices(classId: string, offset: number, size: number): Promise<ClassNotice[]> {
  const { data, error } = await supabase
    .from("class_notices")
    .select(ADMIN_COLUMNS)
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + size - 1);
  if (error) throw error;
  return (data ?? []) as ClassNotice[];
}

/** 새 글. 작성자는 DB가 채운다(author_id 기본값 auth.uid() — 보낼 권한도 없다). */
export async function createClassNotice(input: { classId: string; title: string; body: string }): Promise<ClassNotice> {
  const title = normalizeNoticeTitle(input.title);
  const body = normalizeNoticeBody(input.body);
  const problem = noticeTitleProblem(title) ?? noticeBodyProblem(body);
  if (problem) throw new AdminActionError(problem);
  const { data, error } = await supabase
    .from("class_notices")
    .insert({ class_id: input.classId, title, body })
    .select(ADMIN_COLUMNS)
    .single();
  if (error) throw toNoticeError(error, "글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
  return data as ClassNotice;
}

/** 제목·본문 고치기(학급·작성자·쓴 시각은 바꿀 수 없다 — DB 열 권한). */
export async function updateClassNotice(id: string, input: { title: string; body: string }): Promise<ClassNotice> {
  const title = normalizeNoticeTitle(input.title);
  const body = normalizeNoticeBody(input.body);
  const problem = noticeTitleProblem(title) ?? noticeBodyProblem(body);
  if (problem) throw new AdminActionError(problem);
  const { data, error } = await supabase
    .from("class_notices")
    .update({ title, body })
    .eq("id", id)
    .select(ADMIN_COLUMNS)
    .maybeSingle();
  if (error) throw toNoticeError(error, "글을 고치지 못했어요. 잠시 후 다시 시도해 주세요.");
  // RLS로 0행이 되면(다른 곳에서 지웠거나 담임이 아님) 오류 없이 null이 온다 → 실패로 알린다.
  if (!data) throw new AdminActionError("글을 찾지 못했어요. 다른 곳에서 지웠을 수 있어요. 새로고침해 주세요.");
  return data as ClassNotice;
}

/** 지우기. 실제로 지워진 행을 돌려받아 0건(이미 지워짐·권한 없음)도 실패로 알린다. */
export async function deleteClassNotice(id: string): Promise<void> {
  const { data, error } = await supabase.from("class_notices").delete().eq("id", id).select("id");
  if (error) throw toNoticeError(error, "글을 지우지 못했어요. 잠시 후 다시 시도해 주세요.");
  if (!data?.length) throw new AdminActionError("글을 찾지 못했어요. 이미 지워졌을 수 있어요. 새로고침해 주세요.");
}
