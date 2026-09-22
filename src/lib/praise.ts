import { isMissingSchemaError, MISSING_SCHEMA_MESSAGE } from "@/lib/admin";
import { FEEDBACK_BODY_MAX, getOrCreateFeedbackThread, notifyFeedbackChanged, sendFeedbackMessage } from "@/lib/learning";
import { chunk } from "@/lib/paging";
import { supabase } from "@/lib/supabase";

/**
 * 칭찬 문구(praise_presets) CRUD + 일괄 칭찬 보내기 (docs/admin/responses-spec.md §4.5, §5, §6, §12).
 * - 문구는 20260922020000_praise_presets.sql 실행 전에는 테이블이 없다 → 코드의 기본 문구로 계속 쓸 수 있게 한다(편집만 불가).
 * - 칭찬 메시지는 기존 피드백 대화(app_result 연결)로 보낸다: get_or_create_feedback_thread + feedback_messages insert.
 * - {이름}은 보내기 직전 학생 이름으로 바꿔 최종 문장을 저장한다(Q5).
 */

export type PraisePreset = { id: string; body: string; sort_order: number };

export const PRAISE_NAME_TOKEN = "{이름}";
export const PRAISE_BODY_MAX = 500;
/** 한 번에 보낼 수 있는 최대 인원(실수로 전체 회원에게 보내는 것 방지) */
export const PRAISE_MAX_RECIPIENTS = 50;
/** 동시에 보내는 요청 수 */
const PRAISE_CONCURRENCY = 5;

export const PRAISE_MISSING_MESSAGE =
  "칭찬 문구 저장용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20260922020000_praise_presets.sql을 실행해 주세요. 그 전에는 기본 문구로 칭찬을 보낼 수 있지만 문구를 추가·수정·삭제할 수는 없어요.";

/** 마이그레이션 시드와 같은 기본 문구(spec §6) — 테이블이 없을 때 쓴다 */
export const DEFAULT_PRAISE_PRESETS: PraisePreset[] = [
  "{이름} 학생, 오늘 활동을 끝까지 잘 마쳤어요! 실험 기록을 꼼꼼하게 남긴 점이 멋져요. 👏",
  "{이름} 학생, 예상한 내용과 실험 결과를 잘 비교해서 정리했어요. 계속 이렇게 해봐요!",
  "{이름} 학생, 분석 문제를 스스로 다시 생각해서 풀어낸 점이 훌륭해요. 최고예요! 🌟",
  "{이름} 학생, 궁금한 점을 적어낸 게 인상 깊어요. 다음 시간에 함께 알아볼까요?",
  "{이름} 학생, 오늘도 성실하게 끝까지 참여했어요. 수고 많았어요!",
  "{이름} 학생, 결론을 자신의 말로 잘 정리했어요. 과학자처럼 생각하고 있어요! 🔬",
].map((body, i) => ({ id: `default-${i + 1}`, body, sort_order: i + 1 }));

const COLUMNS = "id,body,sort_order";

function sortPresets(list: PraisePreset[]): PraisePreset[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.body.localeCompare(b.body, "ko"));
}

/** 칭찬 문구 목록. 테이블이 없으면 { presets: 기본 문구, missing: true } */
export async function fetchPraisePresets(): Promise<{ presets: PraisePreset[]; missing: boolean }> {
  const { data, error } = await supabase.from("praise_presets").select(COLUMNS).order("sort_order").order("created_at").limit(200);
  if (error) {
    if (isMissingSchemaError(error)) return { presets: DEFAULT_PRAISE_PRESETS, missing: true };
    throw error;
  }
  return { presets: sortPresets((data ?? []) as PraisePreset[]), missing: false };
}

/** 문구 검사: 문제가 있으면 한국어 안내, 없으면 null */
export function praiseBodyProblem(body: string): string | null {
  const t = body.trim();
  if (!t) return "문구를 입력해 주세요.";
  if (t.length > PRAISE_BODY_MAX) return `문구는 ${PRAISE_BODY_MAX}자까지 쓸 수 있어요.`;
  return null;
}

function toActionError(error: unknown, fallback: string): Error {
  if (isMissingSchemaError(error)) return new Error(PRAISE_MISSING_MESSAGE);
  const msg = (error as { message?: string } | null)?.message ?? "";
  return new Error(/[가-힣]/.test(msg) ? msg : fallback);
}

export async function createPraisePreset(body: string, sortOrder: number): Promise<PraisePreset> {
  const { data, error } = await supabase.from("praise_presets").insert({ body: body.trim(), sort_order: sortOrder }).select(COLUMNS).single();
  if (error) throw toActionError(error, "문구를 추가하지 못했습니다.");
  return data as PraisePreset;
}

export async function updatePraisePreset(id: string, patch: Partial<Pick<PraisePreset, "body" | "sort_order">>): Promise<PraisePreset> {
  const clean = patch.body != null ? { ...patch, body: patch.body.trim() } : patch;
  const { data, error } = await supabase.from("praise_presets").update(clean).eq("id", id).select(COLUMNS).maybeSingle();
  if (error) throw toActionError(error, "문구를 고치지 못했습니다.");
  if (!data) throw new Error("문구를 찾지 못했습니다. 다른 곳에서 지웠을 수 있어요.");
  return data as PraisePreset;
}

export async function deletePraisePreset(id: string): Promise<void> {
  const { data, error } = await supabase.from("praise_presets").delete().eq("id", id).select("id");
  if (error) throw toActionError(error, "문구를 지우지 못했습니다.");
  if (!data?.length) throw new Error("문구를 찾지 못했습니다. 이미 지워졌을 수 있어요.");
}

/**
 * 칭찬 문장에 넣어도 되는 "사람 이름"인지. 표시 이름이 없거나 이메일·아이디 모양이면 null(review M1).
 * 예: "김하늘" → "김하늘", "" · "s2024001" · "stu3@class1.local" · "이름 없음" → null
 */
export function praiseNameOf(displayName: string | null | undefined): string | null {
  const t = (displayName ?? "").trim();
  if (!t || t === "이름 없음") return null;
  if (t.includes("@")) return null;
  // 영문·숫자·기호로만 된 이름에 숫자가 섞여 있으면 학번·아이디로 본다(예: s2024001, user_12)
  if (/^[A-Za-z0-9._\-]+$/.test(t) && /\d/.test(t)) return null;
  return t;
}

/** 이름이 없을 때 문장 가운데의 {이름} 자리에 넣는 말(받침 있는 말이라 뒤의 조사 "이/은/을"이 어색해지지 않는다) */
const NO_NAME_STUDENT = "우리 반 학생";

/**
 * {이름}을 학생 이름으로 바꾼다(모든 자리).
 * name이 null(이름 없음)이면 이름 없이도 자연스럽게 읽히도록 고친다:
 *  - 문장 맨 앞의 부름말("{이름} 학생, " · "{이름}, " · "{이름} 학생! ")은 통째로 뺀다 → "오늘 활동을 …"
 *  - 그 밖의 "{이름} 학생"·"{이름}"은 "우리 반 학생"으로 바꾼다.
 */
export function fillPraise(template: string, name: string | null): string {
  if (name != null) return template.split(PRAISE_NAME_TOKEN).join(name).trim();
  const t = template
    .replace(/(^|\n|[.!?。！？]\s+)\s*\{이름\}\s*(?:학생|님|친구)?\s*[,，!！]\s*/gu, "$1")
    .split(`${PRAISE_NAME_TOKEN} 학생`)
    .join(NO_NAME_STUDENT)
    .split(PRAISE_NAME_TOKEN)
    .join(NO_NAME_STUDENT);
  return t.replace(/[ \t]{2,}/g, " ").trim();
}

export type PraiseTarget = {
  studentId: string;
  resultId: string;
  /** 화면에 보이는 이름(이메일 앞부분일 수 있음) */
  name: string;
  /** 칭찬 문장에 넣을 이름. 없으면 null → 이름 없이 보낸다(fillPraise) */
  praiseName: string | null;
};
export type PraiseFailure = PraiseTarget & { reason: string };

function sendErrorReason(err: unknown): string {
  if (isMissingSchemaError(err)) return MISSING_SCHEMA_MESSAGE;
  const msg = (err as { message?: string } | null)?.message ?? "";
  if (/[가-힣]/.test(msg)) return msg;
  if (/fetch|network/i.test(msg)) return "네트워크 오류";
  return "보내지 못했어요";
}

/** 같은 문장을 이미 받았는지 볼 기간: 응답을 못 받아 다시 보낸 경우 · 다른 탭에서 함께 보낸 경우(review L7) */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 이 대화에 학생이 아닌 사람(선생님)이 같은 문장을 최근에 보냈는지 */
async function alreadyHasSameMessage(threadId: string, studentId: string, body: string): Promise<boolean> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("feedback_messages")
    .select("id")
    .eq("thread_id", threadId)
    .neq("sender_id", studentId)
    .eq("body", body)
    .gte("created_at", since)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * 학생마다 그 학생의 최신 완료 결과(app_result)에 연결된 피드백 대화로 칭찬을 보낸다.
 * 동시에 PRAISE_CONCURRENCY개씩 보내고, 실패한 학생은 따로 모아 돌려준다(부분 실패 보고 · 재시도용).
 * 보내기 전에 그 대화를 다시 조회해 24시간 안에 같은 문장이 이미 있으면 보내지 않고 skipped로 돌려준다
 * (저장은 됐는데 응답만 유실돼 "다시 보내기"를 누른 경우 · 다른 탭에서 동시에 보낸 경우의 중복 방지).
 */
export async function sendPraise(
  targets: PraiseTarget[],
  template: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ sent: PraiseTarget[]; skipped: PraiseTarget[]; failed: PraiseFailure[] }> {
  if (targets.length > PRAISE_MAX_RECIPIENTS) throw new Error(`한 번에 ${PRAISE_MAX_RECIPIENTS}명까지 보낼 수 있어요.`);
  const sent: PraiseTarget[] = [];
  const skipped: PraiseTarget[] = [];
  const failed: PraiseFailure[] = [];
  let done = 0;
  for (const group of chunk(targets, PRAISE_CONCURRENCY)) {
    const results = await Promise.allSettled(
      group.map(async (t): Promise<"sent" | "skipped"> => {
        const body = fillPraise(template, t.praiseName);
        if (!body) throw new Error("보낼 문구가 비어 있어요");
        if (body.length > FEEDBACK_BODY_MAX) throw new Error(`이름을 넣은 문구가 ${FEEDBACK_BODY_MAX}자를 넘어요`);
        const threadId = await getOrCreateFeedbackThread(t.studentId, { type: "app_result", id: t.resultId });
        if (await alreadyHasSameMessage(threadId, t.studentId, body)) return "skipped";
        await sendFeedbackMessage(threadId, body);
        return "sent";
      }),
    );
    results.forEach((r, i) => {
      const t = group[i];
      if (r.status === "fulfilled") (r.value === "sent" ? sent : skipped).push(t);
      else failed.push({ ...t, reason: sendErrorReason(r.reason) });
    });
    done += group.length;
    onProgress?.(done, targets.length);
  }
  if (sent.length) notifyFeedbackChanged();
  return { sent, skipped, failed };
}
