import { isMissingSchemaError, profileDisplayName } from "@/lib/admin";
import { BASE_PATH } from "@/lib/base-path";
import { supabase } from "@/lib/supabase";
import { AUTHOR_PROFILE_COLUMNS, type Profile } from "@/lib/types";

/**
 * 자유게시판 · 학습게임 업로드 공용 데이터 계층 (docs/community/spec.md §5, §13).
 * 테이블: community_posts(kind='board'|'game') · community_comments · community_likes · community_reports
 * Storage: game-uploads 비공개 버킷 ({user_id}/{uuid}.html, text/plain으로만 저장, RLS로 가시성 연동)
 */

export type CommunityKind = "board" | "game";

export type CommunityPost = {
  id: string;
  kind: CommunityKind;
  title: string;
  body: string;
  game_path: string | null;
  game_size: number | null;
  author_id: string | null;
  hidden: boolean;
  created_at: string;
  updated_at: string;
  profiles: Pick<Profile, "display_name" | "avatar_url" | "withdrawn_at"> | null;
};

export type CommunityPostSummary = Pick<
  CommunityPost,
  "id" | "kind" | "title" | "body" | "author_id" | "hidden" | "created_at" | "profiles"
> & {
  community_comments: { count: number }[] | null;
  community_likes: { count: number }[] | null;
};

export type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  hidden: boolean;
  created_at: string;
  profiles: Pick<Profile, "display_name" | "avatar_url" | "withdrawn_at"> | null;
};

// 관계 이름(!fk)을 명시한다: community_likes/community_reports가 연결 테이블로도 인식되어
// profiles·community_comments embed가 모호(PGRST201)해지는 것을 막는다. 응답 키는 테이블 이름 그대로다.
const POST_AUTHOR = `profiles!community_posts_author_id_fkey(${AUTHOR_PROFILE_COLUMNS})`;
const COMMENT_AUTHOR = `profiles!community_comments_user_id_fkey(${AUTHOR_PROFILE_COLUMNS})`;

export const POST_COLUMNS =
  `id,kind,title,body,game_path,game_size,author_id,hidden,created_at,updated_at,${POST_AUTHOR}`;
export const POST_SUMMARY_COLUMNS =
  `id,kind,title,body,author_id,hidden,created_at,${POST_AUTHOR},` +
  "community_comments!community_comments_post_id_fkey(count),community_likes!community_likes_post_id_fkey(count)";
export const COMMENT_COLUMNS = `id,post_id,user_id,body,hidden,created_at,${COMMENT_AUTHOR}`;

/** 글자 수 제한(DB check 제약과 같은 값) */
export const LIMITS = {
  title: 100,
  boardBody: 5000,
  gameBody: 1000,
  comment: 1000,
  reportDetail: 500,
  /** 게임 파일 최대 크기(byte) — Storage 버킷 file_size_limit과 같다 */
  gameBytes: 2 * 1024 * 1024,
} as const;

export const GAME_BUCKET = "game-uploads";
/** 사용자당 게임 글 수(DB 트리거 community_posts_guard와 같은 값) */
export const GAME_POST_LIMIT = 30;
/** 연결되지 않은 파일을 정리할 때, 방금 올린(다른 탭에서 저장 중일 수 있는) 파일은 건드리지 않는 시간 */
const ORPHAN_GRACE_MS = 10 * 60 * 1000;

export const KIND_META: Record<
  CommunityKind,
  { label: string; noun: string; listHref: string; newHref: string; newLabel: string }
> = {
  board: { label: "자유게시판", noun: "글", listHref: "/board/", newHref: "/board/new/", newLabel: "글쓰기" },
  game: { label: "학습게임", noun: "게임", listHref: "/games/", newHref: "/games/new/", newLabel: "게임 올리기" },
};

export function communityPostHref(kind: CommunityKind, id: string): string {
  return `${kind === "board" ? "/board/post/" : "/games/post/"}?id=${encodeURIComponent(id)}`;
}

export function communityEditHref(kind: CommunityKind, id: string): string {
  return `${kind === "board" ? "/board/post/edit/" : "/games/post/edit/"}?id=${encodeURIComponent(id)}`;
}

export function loginHref(next: string): string {
  return `/login/?next=${encodeURIComponent(next)}`;
}

/** 지금 화면으로 돌아오는 로그인 경로(basePath를 뺀 경로 + 쿼리) */
export function loginHrefHere(): string {
  if (typeof window === "undefined") return "/login/";
  let path = window.location.pathname;
  if (BASE_PATH && path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length) || "/";
  return loginHref(path + window.location.search);
}

/** 글·댓글 작성자 이름. 탈퇴한 회원이면 "탈퇴한 학생"(profileDisplayName). */
export function authorName(p: { profiles: Pick<Profile, "display_name" | "withdrawn_at"> | null }): string {
  return profileDisplayName(p.profiles, "익명");
}

export function embeddedCount(list: { count: number }[] | null | undefined): number {
  return list?.[0]?.count ?? 0;
}

// ─────────────────────────────────────────────
// 오류 → 한국어 문구
// ─────────────────────────────────────────────

export const SETUP_REQUIRED_MESSAGE =
  "커뮤니티 기능이 아직 준비 중이에요. 선생님이 Supabase SQL Editor에서 20260922040000_community.sql과 " +
  "20260923000000_member_withdrawal.sql을 실행하면 열려요.";

type ErrorLike = { code?: string; message?: string; statusCode?: string | number; status?: number } | null | undefined;

/** 테이블/함수/버킷이 아직 없어서 난 오류(마이그레이션 미실행) */
export function isSetupMissing(error: unknown): boolean {
  if (isMissingSchemaError(error)) return true;
  const m = ((error as ErrorLike)?.message ?? "").toLowerCase();
  return m.includes("bucket not found");
}

/** 사용자에게 보여 줄 오류 문구 */
export function communityErrorMessage(error: unknown, fallback: string): string {
  if (isSetupMissing(error)) return SETUP_REQUIRED_MESSAGE;
  const e = error as ErrorLike;
  const m = (e?.message ?? "").toLowerCase();
  if (m.includes("too_fast")) return "조금 전에 올렸어요. 잠시 뒤에 다시 시도해 주세요.";
  if (m.includes("game_limit")) return `게임은 한 사람당 ${GAME_POST_LIMIT}개까지 올릴 수 있어요. 안 쓰는 게임을 지운 뒤 올려 주세요.`;
  if (m.includes("game_path_owner")) return "다른 사람의 게임 파일은 바꿀 수 없어요.";
  if (e?.code === "23505") return "이미 처리된 요청이에요.";
  if (m.includes("jwt") || m.includes("not authenticated") || e?.status === 401) return "로그인이 만료되었어요. 다시 로그인해 주세요.";
  if (m.includes("payload too large") || m.includes("maximum allowed size") || m.includes("exceeded")) {
    return "파일이 너무 커요. 2MB 이하 파일만 올릴 수 있어요.";
  }
  if (m.includes("mime") || m.includes("invalid_mime_type")) return "올릴 수 없는 파일 형식이에요.";
  if (m.includes("row-level security") || m.includes("permission denied") || e?.code === "42501") {
    return "권한이 없어요. 로그인 상태를 확인해 주세요.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) return "인터넷 연결을 확인해 주세요.";
  // 원인을 알 수 없는 오류는 선생님이 알려 줄 수 있도록 짧은 원인 정보를 덧붙인다(개인정보는 들어 있지 않다).
  console.error("[community]", error);
  const code = e?.code ?? e?.statusCode ?? e?.status;
  const detail = [code, (e?.message ?? "").slice(0, 120)].filter(Boolean).join(" ");
  return detail ? `${fallback} (원인: ${detail})` : fallback;
}

// ─────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────

export async function fetchCommunityPosts(kind: CommunityKind, offset: number, size: number) {
  const { data, error } = await supabase
    .from("community_posts")
    .select(POST_SUMMARY_COLUMNS)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + size - 1);
  if (error) throw error;
  return (data ?? []) as unknown as CommunityPostSummary[];
}

export async function fetchCommunityPost(id: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase.from("community_posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as CommunityPost | null) ?? null;
}

export async function countCommunityPosts(kind: CommunityKind): Promise<number> {
  const { count, error } = await supabase
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("hidden", false);
  if (error) throw error;
  // HEAD 요청은 테이블이 없으면(404, 빈 본문) 오류 없이 count=null로 끝난다 → "SQL 실행 필요"로 본다.
  if (count == null) throw { code: "PGRST205", message: "Could not find the table 'public.community_posts'" };
  return count;
}

// ─────────────────────────────────────────────
// 게임 파일: 검증 · 업로드 · 내려받기
// ─────────────────────────────────────────────

export class GameFileError extends Error {}

const HTML_SIGNATURE = /<(!doctype\s+html|html|head|body|script|canvas|div|svg|main|style)[\s>/]/i;

/**
 * 업로드 전 클라이언트 검증(우회 가능 — 실제 경계는 버킷 크기·MIME 제한과 iframe sandbox).
 * .html 1개, 2MB 이하, UTF-8, HTML로 보이는 내용.
 */
export async function readGameFile(file: File): Promise<string> {
  if (!/\.html?$/i.test(file.name)) throw new GameFileError("이름이 .html이나 .htm으로 끝나는 파일만 올릴 수 있어요.");
  if (file.size === 0) throw new GameFileError("빈 파일이에요.");
  if (file.size > LIMITS.gameBytes) {
    throw new GameFileError(`파일이 너무 커요(${formatBytes(file.size)}). 2MB 이하만 올릴 수 있어요.`);
  }
  const buf = await file.arrayBuffer();
  return decodeGameHtml(buf);
}

/** 바이트 → HTML 문자열. UTF-8이 아니거나 HTML이 아니면 GameFileError. */
export function decodeGameHtml(buf: ArrayBuffer): string {
  if (buf.byteLength > LIMITS.gameBytes) throw new GameFileError("파일이 너무 커요. 2MB 이하만 올릴 수 있어요.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    throw new GameFileError("UTF-8 글자로 저장된 HTML 파일만 올릴 수 있어요.");
  }
  if (text.includes("\u0000")) throw new GameFileError("HTML 파일이 아닌 것 같아요.");
  if (!HTML_SIGNATURE.test(text.slice(0, 200_000))) throw new GameFileError("HTML 파일이 아닌 것 같아요.");
  return text;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  // 올림: 2MB를 조금 넘는 파일이 "2.00MB"로 보여 제한 안처럼 보이지 않게
  return `${(Math.ceil((n / (1024 * 1024)) * 100) / 100).toFixed(2)}MB`;
}

/**
 * Storage(비공개 버킷)에 게임 원문을 text/plain으로 올린다(새 경로, 덮어쓰기 없음).
 * text/plain이라 파일을 직접 열어도 브라우저가 HTML로 실행하지 않는다(버킷 allowed_mime_types도 text/plain만).
 * 올리기 전에 내 폴더의 "어느 글에도 연결되지 않은" 파일을 정리한다(쿼터를 영구히 차지하지 않게).
 */
export async function uploadGameHtml(userId: string, html: string): Promise<{ path: string; size: number }> {
  const blob = new Blob([html], { type: "text/plain" });
  if (blob.size > LIMITS.gameBytes) throw new GameFileError("파일이 너무 커요. 2MB 이하만 올릴 수 있어요.");
  await cleanupOrphanGameFiles(userId);
  const path = `${userId}/${crypto.randomUUID()}.html`;
  const { error } = await supabase.storage.from(GAME_BUCKET).upload(path, blob, {
    contentType: "text/plain",
    // 숨김 처리 뒤에 캐시된 사본이 남지 않도록 캐시하지 않는다(파일은 매번 권한 확인을 거쳐 받는다).
    cacheControl: "0",
    upsert: false,
  });
  if (error) {
    // 파일 수 제한(Storage insert 정책)에 걸리면 RLS 오류로 온다.
    const m = (error.message ?? "").toLowerCase();
    if (m.includes("row-level security") || m.includes("policy")) {
      throw new GameFileError(`올릴 수 있는 게임 파일 수(${GAME_POST_LIMIT}개)를 넘었어요. 안 쓰는 게임을 지운 뒤 다시 올려 주세요.`);
    }
    throw error;
  }
  return { path, size: blob.size };
}

/**
 * 내 폴더에서 어느 글에도 연결되지 않은 게임 파일(업로드 뒤 글 저장 실패, 옛 파일 삭제 실패 등)을 지운다.
 * 방금 올린 파일(다른 탭에서 저장 중일 수 있음)은 건드리지 않는다. 실패해도 업로드는 계속한다.
 */
export async function cleanupOrphanGameFiles(userId: string): Promise<number> {
  try {
    const { data: files, error } = await supabase.storage.from(GAME_BUCKET).list(userId, { limit: 100 });
    if (error || !files?.length) return 0;
    const { data: posts, error: postsError } = await supabase
      .from("community_posts")
      .select("game_path")
      .eq("author_id", userId)
      .not("game_path", "is", null);
    if (postsError) return 0;
    const linked = new Set((posts ?? []).map((p) => (p as { game_path: string }).game_path));
    const now = Date.now();
    const orphans = files
      .filter((f) => f.id && /\.html$/.test(f.name))
      .filter((f) => {
        const created = Date.parse(f.created_at ?? "");
        return Number.isFinite(created) && now - created > ORPHAN_GRACE_MS;
      })
      .map((f) => `${userId}/${f.name}`)
      .filter((path) => !linked.has(path));
    if (!orphans.length) return 0;
    const { error: removeError } = await supabase.storage.from(GAME_BUCKET).remove(orphans);
    return removeError ? 0 : orphans.length;
  } catch {
    return 0;
  }
}

/** 실패해도 무시(정리용). 권한은 Storage 정책이 판단한다. */
export async function removeGameFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(GAME_BUCKET).remove([path]);
  } catch {
    // 무시
  }
}

/**
 * 게임 원문을 "텍스트로" 내려받는다. 비공개 버킷이라 인증된 download()만 쓴다(Storage RLS가 숨긴 게임을 거른다).
 * 파일 URL을 iframe src에 쓰지 않는다(spec §4.1). 반환값은 GamePlayer가 sandbox srcdoc으로만 사용한다.
 */
export async function downloadGameHtml(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(GAME_BUCKET).download(path);
  if (error) throw error;
  if (!data) throw new GameFileError("게임 파일을 찾지 못했어요.");
  if (data.size > LIMITS.gameBytes) throw new GameFileError("게임 파일이 너무 커요.");
  return decodeGameHtml(await data.arrayBuffer());
}

// ─────────────────────────────────────────────
// sandbox 문서 준비 (spec §4.1-4)
// ─────────────────────────────────────────────

/**
 * 게임에 적용하는 방어용 CSP(심층 방어). 핵심 방어선은 iframe sandbox(allow-scripts만, allow-same-origin 없음)다.
 * CDN 스크립트·인라인 스크립트는 허용하고, URL 중첩 프레임·플러그인·폼 전송·base 변경은 막는다.
 * (about:srcdoc 중첩 프레임에는 frame-src가 적용되지 않지만, 그 프레임도 sandbox와 이 CSP를 물려받아 무해하다.)
 */
export const GAME_CSP =
  "default-src * data: blob: 'unsafe-inline'; " +
  "script-src * 'unsafe-inline' 'unsafe-eval' blob: data:; " +
  "style-src * 'unsafe-inline' data: blob:; " +
  "worker-src * blob: data:; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";

/** 게임 iframe에 주는 sandbox 권한. allow-same-origin 등 다른 권한은 절대 추가하지 않는다. */
export const GAME_SANDBOX = "allow-scripts";

/** 강력한 기기 기능은 명시적으로 모두 끈다(불투명 출처라 기본으로도 꺼져 있지만 이중 방어). */
export const GAME_PERMISSIONS =
  "camera 'none'; microphone 'none'; geolocation 'none'; display-capture 'none'; usb 'none'; payment 'none'; fullscreen 'none'";

/** 큰따옴표 속성값용 이스케이프. 속성값 안에서 특별한 문자는 &와 "뿐이고, <·>도 함께 바꿔 둔다(파서가 원문 그대로 되돌린다). */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 바깥 sandbox iframe의 srcdoc에 넣을 "고정 래퍼 문서".
 *
 * 예전 방식(업로드 HTML 앞에 CSP meta를 끼워 넣기)은 `<!-->`·`--!>` 같은 주석 파싱 차이로 meta가 body로 밀려나
 * CSP가 무력화될 수 있었다(review L1). 이제는 업로드 HTML을 전혀 파싱·수정하지 않는다:
 *   1) 래퍼 문서는 우리가 만든 고정 문자열이고, <head> 맨 앞에 CSP meta가 있다.
 *   2) 게임 HTML은 래퍼 안의 중첩 iframe `srcdoc` "속성값"으로만 들어간다(&, " 이스케이프 → 파서가 원문 그대로 복원).
 *      속성값은 문서 구조로 해석되지 않으므로 게임 HTML이 래퍼의 CSP meta 앞으로 끼어들 방법이 없다.
 *   3) about:srcdoc 문서는 부모(래퍼)의 CSP를 물려받는다 → 게임 문서가 무엇을 쓰든 래퍼 CSP가 항상 적용된다
 *      (게임이 자기 CSP meta를 넣어도 정책이 추가될 뿐, 더 느슨해지지 않는다).
 *   4) 안쪽 iframe도 sandbox="allow-scripts"만 준다(바깥 sandbox를 물려받으므로 어차피 더 넓어질 수 없다).
 * 게임 문서는 따로 파싱되므로 게임의 doctype(표준/쿼크 모드)도 그대로 유지된다.
 */
export function buildSandboxDocument(html: string, title = "게임"): string {
  const game = html.replace(/^\uFEFF/, "");
  return (
    "<!doctype html><html lang=\"ko\"><head>" +
    `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(GAME_CSP)}">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff}" +
    "iframe{display:block;border:0;width:100%;height:100%}</style>" +
    "</head><body>" +
    `<iframe id="game" title="${escapeAttr(title)}" sandbox="${GAME_SANDBOX}" allow="${escapeAttr(GAME_PERMISSIONS)}" ` +
    `referrerpolicy="no-referrer" srcdoc="${escapeAttr(game)}"></iframe>` +
    // 래퍼는 키 입력을 받을 곳이 없으므로, 포커스를 받으면 게임 iframe으로 넘겨 방향키 등이 바로 게임에 가게 한다.
    "<script>(function(){var f=document.getElementById('game');function g(){try{f.focus()}catch(e){}}" +
    "f.addEventListener('load',g);window.addEventListener('focus',g);g();})();</script>" +
    "</body></html>"
  );
}
