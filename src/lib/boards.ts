import { isMissingSchemaError } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

/**
 * 담임교사별 자유게시판(docs/community/teacher-boards/spec.md 끝 "개정 2"·"개정 1" 순으로 우선,
 * SQL `supabase/migrations/20260928010000_teacher_boards.sql`).
 *
 * - 게시판 = 담임 한 명마다 하나. 글의 `community_posts.board_owner` = 그 담임(profiles.id).
 * - 학생: 자기 학급의 **먼저 맡은 담임** 게시판 하나(학급이 없으면 없음). 학생 화면에는 게시판 고르기가 없다.
 * - 교사: 자기가 담임(보조 담임 포함)인 학급의 게시판(그 학급의 먼저 맡은 담임 것). 자기가 먼저 맡은(개설한) 학급이 있으면
 *   그 게시판이 "내 게시판". 학급이 없는 교사는 게시판 없음(개정 2). 둘 이상이면 **교사 화면에만** 고르기.
 * - 총괄: 관리자 '커뮤니티 관리'에서 관리용으로 모든 게시판을 본다. 자유게시판 화면·홈·검색은 쓸 수 있는 게시판만.
 * - 학습게임(kind='game')은 게시판을 나누지 않는다 — 이 모듈을 쓰지 않는다.
 *
 * 실제 권한은 RLS(can_use_board · can_manage_board)가 판단한다. 이 모듈은 화면 편의다.
 * SQL 적용 전(my_boards() 없음)에는 "legacy" — 화면은 예전처럼 하나의 게시판으로 동작한다(게시판 주인을 보내지 않는다).
 */

export type Board = {
  /** 게시판 주인(담임) profiles.id */
  ownerId: string;
  /** 담임 이름(profiles.display_name — 이미 공개된 이름). 없으면 null */
  teacherName: string | null;
  /** 내 게시판(내가 주인)인가 — 자기가 먼저 맡은(개설한) 학급이 있는 교사만 true가 될 수 있다 */
  mine: boolean;
};

export type BoardAccess =
  /** 20260928010000 적용 전: 게시판을 나누지 않는다(예전 동작) */
  | { mode: "legacy" }
  /** 내가 참여할 수 있는 게시판(학생 0~1개, 교사 0개 이상 — 내 게시판 먼저) */
  | { mode: "boards"; boards: Board[] };

/** 학급이 없는 계정(게시판 없음) 안내 — 목록·글쓰기·홈 미리보기·검색 공용 */
export const NO_BOARD_TITLE = "아직 배정된 담임 선생님이 없어요";
export const NO_BOARD_DESCRIPTION = "선생님께 학급 등록을 부탁해 주세요.";

/** 학급이 없는 교사(게시판 없음) 안내 — 학급을 개설하면 그 학급의 게시판이 "내 게시판"이 된다(개정 2) */
export const NO_BOARD_TEACHER_TITLE = "아직 맡은 학급이 없어요";
export const NO_BOARD_TEACHER_DESCRIPTION =
  "관리자 개요나 회원 관리 맨 위의 ‘내 학급’에서 학급을 개설하면 그 학급 학생들과 함께 쓰는 게시판이 생겨요.";

/** 쓸 수 있는 자유게시판이 없을 때의 안내 — 교사와 학생의 문구가 다르다 */
export function noBoardNotice(isAdmin: boolean): { title: string; description: string } {
  return isAdmin
    ? { title: NO_BOARD_TEACHER_TITLE, description: NO_BOARD_TEACHER_DESCRIPTION }
    : { title: NO_BOARD_TITLE, description: NO_BOARD_DESCRIPTION };
}

/** my_boards() jsonb 결과를 안전하게 읽는다(문자열로 올 수도 있다). 순서는 서버가 정한 그대로(내 게시판 먼저). */
export function parseBoards(data: unknown): Board[] {
  let raw: unknown = data;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const boards: Board[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { owner_id?: unknown; teacher_name?: unknown; mine?: unknown };
    if (typeof o.owner_id !== "string" || !o.owner_id || seen.has(o.owner_id)) continue;
    seen.add(o.owner_id);
    const name = typeof o.teacher_name === "string" ? o.teacher_name.trim() : "";
    boards.push({ ownerId: o.owner_id, teacherName: name || null, mine: o.mine === true });
  }
  return boards;
}

async function loadBoardAccess(): Promise<BoardAccess> {
  const { data, error } = await supabase.rpc("my_boards");
  if (error) {
    if (isMissingSchemaError(error)) return { mode: "legacy" };
    throw error;
  }
  return { mode: "boards", boards: parseBoards(data) };
}

/** 같은 화면의 여러 칸(홈 미리보기·글 수 등)이 한 번만 부르도록 사용자별로 잠깐(30초) 기억한다. */
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<BoardAccess> }>();

/**
 * 지금 로그인한 사용자가 참여할 수 있는 게시판. 로그인한 사용자만 부른다(userId = 캐시 열쇠).
 * `fresh`면 기억한 값을 버리고 다시 읽는다(다시 시도 · 저장이 권한으로 거부된 뒤).
 */
export function fetchBoardAccess(userId: string, { fresh = false }: { fresh?: boolean } = {}): Promise<BoardAccess> {
  const hit = cache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = loadBoardAccess();
  cache.set(userId, { at: Date.now(), promise });
  promise.catch(() => {
    if (cache.get(userId)?.promise === promise) cache.delete(userId);
  });
  return promise;
}

/** 게시판 목록을 다시 읽게 한다(학급이 바뀌었을 수 있을 때). */
export function forgetBoardAccess(): void {
  cache.clear();
}

/** "○○ 선생님" — 이름이 이미 "선생님"·"선생"으로 끝나면 겹쳐 붙이지 않는다. 이름이 없으면 "담임 선생님". */
export function teacherTitle(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "담임 선생님";
  if (n.endsWith("선생님")) return n;
  if (n.endsWith("선생")) return `${n}님`;
  return `${n} 선생님`;
}

/** 게시판 이름(교사 화면의 고르기·관리 화면 표시용): 내 게시판이면 "내 게시판", 아니면 "○○ 선생님 게시판" */
export function boardLabel(board: Pick<Board, "teacherName" | "mine">): string {
  return board.mine ? "내 게시판" : `${teacherTitle(board.teacherName)} 게시판`;
}

/** 자유게시판 목록 주소. 교사가 게시판을 골랐으면 `?board=<주인 id>`(뒤로 가기·글쓰기에서 같은 게시판으로 돌아오게). */
export function boardListHref(boardOwner?: string | null): string {
  return boardOwner ? `/board/?board=${encodeURIComponent(boardOwner)}` : "/board/";
}

/** 자유게시판 글쓰기 주소. 교사가 게시판을 골랐으면 `?board=<주인 id>`로 그 게시판을 미리 고른다. */
export function boardNewHref(boardOwner?: string | null): string {
  return boardOwner ? `/board/new/?board=${encodeURIComponent(boardOwner)}` : "/board/new/";
}
