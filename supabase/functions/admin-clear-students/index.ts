// admin-clear-students — 담임(자기 학급)·총괄이 학생 계정과 그 기록을 **완전히** 지운다(되돌릴 수 없음).
//   ① 학급 정리: 학년도가 끝난 학급의 학생 모두(탈퇴 처리된 학생 포함) — 한 번에 20명씩, 화면이 remaining = 0 까지 반복 호출
//      (지울 수 없는 학생 — 구글·깃허브 전용 등 — 은 건너뛰고 그 뒤 학생으로 20명을 채운다: 고침 1 L7)
//   ② 학생 한 명 '기록까지 삭제': 보호자·학생이 삭제를 요구할 때(기존 '탈퇴 처리'와 달리 "탈퇴한 학생"으로도 남지 않음)
// 설계: docs/privacy/spec.md 4.7-3 · 4.11(개정 4) · 5절(머리말 개정 1~4와 1.1 결정표가 본문보다 우선). 배포·확인은 같은 폴더의 README.md.
//
// 요청:  POST { "classId": "<학급 uuid>", "confirmName": "<학급 이름>" }   ← 학급 정리
//        POST { "userId": "<학생 id>",   "confirmName": "<학생 이름>" }   ← 학생 한 명
//        (Authorization: Bearer <호출자 access token> — supabase-js가 자동 첨부)
// 응답:  200 { "ok": true, "deleted": n, "failed": n, "remaining": n, "warning"?: "..." }
//            deleted = 이번 호출에서 지운 학생 수, failed = 이번 호출에서 지우지 못한 학생 수(그대로 남아 다시 누르면 다시 시도),
//            remaining = 호출이 끝난 뒤 그 학급에 남은 학생 수(학생 한 명 모드는 그 학생이 남았으면 1).
//        400/401/403/404/405/500 { "error": "한국어 메시지", "code"?: "class_not_found" | "target_not_found" | "confirm_mismatch" }
//
// 누가 · 누구를
// - 호출자: profiles.role 'admin'. 학급 정리는 그 학급의 담임(class_teachers) 또는 총괄, 학생 한 명은 그 학생의 담임 또는 총괄.
//   서비스 롤에는 auth.uid()가 없어 DB 함수를 부를 수 없으므로 profiles · class_teachers 를 직접 읽어 같은 규칙으로 판단한다
//   (DB 함수 admin_purge_class_member 도 호출자 권한을 다시 확인한다).
// - 대상: role 'user' 이고 구글·깃허브 전용이 아닌 계정(아이디 로그인 학생). 구글·깃허브 전용 계정은 지우지 않는다
//   (총괄의 '완전 삭제'가 따로 있다). 회원 명단으로 가입 방식을 알 수 없으면(명단 줄 없음 등) 로그인 계정으로 한 번 더 보고,
//   구글·깃허브 전용이 아니면 학급 학생으로 보고 지운다 — DB 함수와 같은 규칙(학급 정리가 영영 끝나지 않는 일을 막는다).
//   교사 계정·자기 자신은 지우지 않는다.
// - 학급·선생님 글·과제(내용)·선생님 계정·칭찬 문구는 지우지 않는다(spec 4.7-3).
// - 학생 한 명의 confirmName(spec 4.11 개정 4): 호출자가 화면에서 보는 이름과 비교한다 — 그 학생의 담임·학급 없는 학생을 보는 총괄은
//   원래 이름(표시 이름 → 없으면 로그인 아이디), 담임이 아닌 총괄이 다른 학급 학생을 지울 때는 가린 이름(첫 글자 + "***" —
//   SQL ①의 mask_label(privacy_name_source(…))과 같은 규칙). 응답·로그·오류 문구에는 학생 이름·아이디를 넣지 않는다.
//
// 순서 — 다시 눌러도 안전(멱등). 학생마다:
//   게임 파일({학생 id}/ 폴더) 삭제·빈 것 확인 → 로그인 계정 하드 삭제(이미 없으면 통과 — 탈퇴한 학생) → RPC admin_purge_class_member
//   - 게임 파일을 못 지우면 그 학생은 건너뛴다(failed — 계정·기록 그대로, 다시 누르면 다시 시도). 계정을 먼저 지우면 남은 파일을
//     찾아 지울 방법이 없어서다. 로그인 계정 삭제가 실패해도 건너뛴다.
//   - RPC 가 실패하면 failed(로그인 계정은 이미 없음 — 다시 누르면 계정 단계는 통과하고 RPC 만 다시 한다).
//   학급 정리는 호출마다(1명 이상 지웠을 때) admin_finish_class_cleanup(학급, 호출자, 이번에 지운 수)을 부른다 — DB 함수가
//   같은 학급·같은 선생님의 1시간 안 기록에 더해 "한 번의 정리 = 한 줄"(인원수만, 이름·아이디 없음)로 남긴다.
// - 로그: 실패한 단계와 오류 문구만 남긴다(토큰·이메일·이름·id 는 남기지 않고, 오류 문구 안의 id·이메일 모양도 가린다).
// - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입한다. 서비스 롤 키는 응답·로그에 넣지 않는다.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// 허용 출처(CORS): GitHub Pages·로컬 개발 + Supabase Secrets `EXTRA_ALLOWED_ORIGINS`(쉼표로 구분한 추가 출처 — 예: Vercel 주소
// https://class1-xxxx.vercel.app). 주소가 바뀌어도 코드를 고치지 않고 Secrets만 바꾼다. https://로 시작하는 정확한 출처만 받는다("*" 등은 무시).
const ALLOWED_ORIGINS = new Set([
  "https://eversunk2-tech.github.io",
  "http://localhost:3000",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s)),
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    // supabase-js가 보내는 헤더 목록(@supabase/supabase-js/cors의 SUPABASE_HEADERS)과 맞춘다.
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 로그·응답에 넣는 오류 문구에서 id(uuid)·이메일 모양을 가린다(회원 정보를 남기지 않기 — spec 5절 공통). */
const UUID_ANY_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_ANY_RE = /[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+/g;
function scrub(text: unknown): string {
  return String(text ?? "").replace(UUID_ANY_RE, "<id>").replace(EMAIL_ANY_RE, "<email>").slice(0, 300);
}

/** 한 번에 처리할 학생 수(spec 4.7-3 — Edge Function 시간 제한 안에서 끝나게). */
const BATCH = 20;
/** 학급 정리 때 한 번에 살펴볼 학생 수의 한도(지울 수 없는 학생을 건너뛰며 BATCH 명을 채운다 — 고침 1 L7). */
const MAX_SCAN = 1000;
/** confirmName 길이 한도(학급 이름은 40자 이하, 학생 이름은 50자 안팎 — 넉넉히). */
const MAX_CONFIRM_LENGTH = 200;
/** 아이디 계정의 로그인 이메일 도메인 — src/lib/auth.ts 의 LOGIN_EMAIL_DOMAIN 과 같아야 한다. */
const LOGIN_EMAIL_DOMAIN = "class1.local";

/** 학습게임 업로드 버킷(20260922040000_community.sql). 파일 경로는 {회원 id}/{uuid}.html */
const GAME_BUCKET = "game-uploads";
const LIST_PAGE = 100;
/** 한 폴더에서 읽을 최대 쪽 수(100개씩) — 무한 반복을 막는 한도일 뿐이다(admin-purge-oauth-member 와 같음). */
const MAX_PAGES = 50;
/** 하위 폴더를 몇 단계까지 따라갈지(사이트는 {회원 id}/ 바로 아래에만 올린다 — 여유). */
const MAX_DEPTH = 2;

const MISSING_PRIVACY_SQL_MESSAGE =
  "학급 정리 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20261020000000_privacy_a_schema.sql을 먼저 실행해 주세요. (아무것도 지우지 않았습니다.)";
const MISSING_CLASSES_SQL_MESSAGE =
  "학급 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20260927000000_classes_schema.sql을 먼저 실행해 주세요.";
const NOT_HOMEROOM_CLASS_MESSAGE = "이 학급의 담임 선생님이나 총괄 관리자만 학급 정리를 할 수 있습니다.";
const NOT_HOMEROOM_STUDENT_MESSAGE = "이 학생의 담임 선생님이나 총괄 관리자만 기록까지 삭제할 수 있습니다.";
const CLASS_NAME_MISMATCH_MESSAGE = "학급 이름이 맞지 않습니다. 학급 이름을 그대로 입력해 주세요.";
const STUDENT_NAME_MISMATCH_MESSAGE = "이름이 맞지 않습니다. 학생 이름을 그대로 입력해 주세요.";
const TEACHER_TARGET_MESSAGE = "교사(관리자) 계정은 이 메뉴로 지울 수 없습니다.";
const OAUTH_TARGET_MESSAGE = "구글·깃허브로 로그인하는 계정은 '기록까지 삭제' 대신 총괄 관리자의 '완전 삭제'를 이용하세요.";

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** 표·열이 없어서 난 오류인지(해당 SQL 미실행). admin-delete-member·admin-purge-oauth-member 와 같은 판별. */
function isMissingSchema(error: ErrorLike): boolean {
  if (!error) return false;
  if (["42703", "PGRST204", "42P01", "PGRST205"].includes(error.code ?? "")) return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("could not find the table") ||
    (m.includes("could not find the") && m.includes("column")) ||
    /(column|relation) .* does not exist/.test(m);
}

/** RPC 함수가 없어서 난 오류인지(새 SQL 미실행). */
function isMissingFunction(error: ErrorLike): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const m = (error.message ?? "").toLowerCase();
  return code === "PGRST202" || code === "42883" || m.includes("could not find the function");
}

/** 계정이 이미 없을 때 나는 오류인지 — 상태 404 · 코드 user_not_found 만 본다(admin-purge-oauth-member review L2와 같음). */
function isUserNotFound(error: ErrorLike): boolean {
  if (!error) return false;
  return error.status === 404 || error.code === "user_not_found";
}

/** 회원 명단의 가입 방식 → "id"(아이디 로그인 있음) / "oauth"(구글·깃허브 전용) / "unknown". 화면·SQL 과 같은 규칙. */
function loginKind(directory: { provider?: unknown; providers?: unknown } | null | undefined): "id" | "oauth" | "unknown" {
  if (!directory) return "unknown";
  const provider = typeof directory.provider === "string" ? directory.provider : "";
  const providers = Array.isArray(directory.providers)
    ? (directory.providers as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  if (provider === "email" || providers.includes("email")) return "id";
  if (!provider && providers.length === 0) return "unknown";
  return "oauth";
}

/**
 * 지워도 되는 학급 학생인가: "ok" = 지움 / "oauth" = 구글·깃허브 전용(지우지 않음) / "error" = 확인 못 함(이번엔 건너뜀).
 * 회원 명단으로 알면 그대로, 모르면(명단 줄 없음·방식 비어 있음) 로그인 계정의 identities·app_metadata 로 한 번 더 본다.
 * 로그인 계정도 없으면(탈퇴한 학생) 지운다 — DB 함수 admin_purge_class_member 와 같은 규칙.
 */
async function purgeableKind(
  admin: SupabaseClient,
  studentId: string,
  kind: "id" | "oauth" | "unknown",
): Promise<"ok" | "oauth" | "error"> {
  if (kind === "id") return "ok";
  if (kind === "oauth") return "oauth";
  const { data, error } = await admin.auth.admin.getUserById(studentId);
  if (error) return isUserNotFound(error as ErrorLike) ? "ok" : "error";
  const user = data?.user;
  if (!user) return "ok";
  const appMeta = (user.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const providers = [
    ...(Array.isArray(appMeta.providers) ? appMeta.providers : []),
    appMeta.provider,
    ...(user.identities ?? []).map((i) => i.provider),
  ].filter((p): p is string => typeof p === "string" && p !== "");
  if (providers.includes("email")) return "ok";
  return providers.length > 0 ? "oauth" : "ok";
}

/** 화면의 memberRealName(src/lib/admin.ts)과 같은 규칙: 표시 이름 → 없으면 로그인 아이디 → "이름 없음". */
function studentName(displayName: unknown, email: unknown): string {
  const name = typeof displayName === "string" ? displayName.trim() : "";
  if (name) return name;
  const mail = typeof email === "string" ? email : "";
  const label = mail.endsWith(`@${LOGIN_EMAIL_DOMAIN}`) ? mail.slice(0, -(LOGIN_EMAIL_DOMAIN.length + 1)) : mail;
  return label.split("@")[0] || "이름 없음";
}

/**
 * 가린 이름(spec 4.11 개정 4) — SQL ①의 public.mask_label(public.privacy_name_source(display_name, email))과 같은 결과.
 * 원래 값 = 표시 이름(앞뒤 공백 뺌), 비었으면 로그인 아이디(이메일의 @ 앞) → 그 첫 글자(코드 포인트 하나 — Array.from) + "***", 비었으면 "***".
 * "공백"은 JS String.prototype.trim()이 빼는 글자 — SQL 의 privacy_btrim 이 같은 25자를 뺀다(SQL ① 11-1).
 * 총괄이 담임이 아닌 학생(회원 명단에 "2***"처럼 가려 보이는 줄)을 지울 때 확인 입력과 비교한다.
 */
function maskedStudentName(displayName: unknown, email: unknown): string {
  const name = typeof displayName === "string" ? displayName.trim() : "";
  const mail = typeof email === "string" ? email : "";
  const source = name || mail.split("@")[0].trim();
  const first = Array.from(source)[0];
  return first === undefined ? "***" : `${first}***`;
}

/**
 * prefix 폴더 아래 파일 경로를 모두 모은다(쪽 나눠 읽기, 하위 폴더는 MAX_DEPTH 단계까지).
 * list()는 prefix 바로 아래 이름만 돌려준다 — 파일은 id 가 있고, 폴더는 id 가 null 이다. (admin-purge-oauth-member 와 같은 코드)
 */
async function listFolderFiles(
  storage: SupabaseClient["storage"],
  prefix: string,
  depth = 0,
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await storage
      .from(GAME_BUCKET)
      .list(prefix, { limit: LIST_PAGE, offset: page * LIST_PAGE, sortBy: { column: "name", order: "asc" } });
    if (error) return { paths, error: error.message || "list failed" };
    const items = data ?? [];
    for (const item of items) {
      const path = `${prefix}/${item.name}`;
      if (item.id) {
        paths.push(path);
      } else if (depth < MAX_DEPTH) {
        const sub = await listFolderFiles(storage, path, depth + 1);
        if (sub.error) return { paths, error: sub.error };
        paths.push(...sub.paths);
      }
    }
    if (items.length < LIST_PAGE) return { paths, error: null };
  }
  return { paths, error: "too many files" };
}

/** {회원 id}/ 폴더의 게임 파일을 모두 지우고, 다시 읽어 비었는지 확인한다. 지운 개수를 돌려준다. */
async function removeGameFiles(
  storage: SupabaseClient["storage"],
  userId: string,
): Promise<{ removed: number; error: string | null }> {
  const found = await listFolderFiles(storage, userId);
  if (found.error) return { removed: 0, error: `list: ${found.error}` };
  let removed = 0;
  for (let i = 0; i < found.paths.length; i += LIST_PAGE) {
    const chunk = found.paths.slice(i, i + LIST_PAGE);
    const { data, error } = await storage.from(GAME_BUCKET).remove(chunk);
    if (error) return { removed, error: `remove: ${error.message || "failed"}` };
    removed += Array.isArray(data) ? data.length : 0;
  }
  const again = await listFolderFiles(storage, userId);
  if (again.error) return { removed, error: `verify: ${again.error}` };
  if (again.paths.length > 0) return { removed, error: `verify: ${again.paths.length} file(s) remain` };
  return { removed, error: null };
}

type PurgeStep = "files" | "account" | "records";
type PurgeOutcome = { ok: true; alreadyDeleted: boolean } | { ok: false; step: PurgeStep; message: string };

/**
 * 학생 한 명을 지운다: 게임 파일 → 로그인 계정 → 기록(RPC). 미리 권한·대상 확인을 마친 학생에게만 부른다.
 * 실패는 예외 대신 결과로 돌려준다(학급 정리에서 한 명이 실패해도 나머지를 계속하게).
 */
async function purgeStudent(admin: SupabaseClient, studentId: string, actorId: string): Promise<PurgeOutcome> {
  const files = await removeGameFiles(admin.storage, studentId);
  if (files.error) return { ok: false, step: "files", message: files.error };

  let alreadyDeleted = false;
  const { error: deleteErr } = await admin.auth.admin.deleteUser(studentId);
  if (deleteErr) {
    if (isUserNotFound(deleteErr as ErrorLike)) alreadyDeleted = true; // 탈퇴한 학생 · 다시 누름
    else return { ok: false, step: "account", message: deleteErr.message ?? "delete failed" };
  }

  const { data, error: purgeErr } = await admin.rpc("admin_purge_class_member", {
    p_target: studentId,
    p_actor: actorId,
  });
  if (purgeErr) return { ok: false, step: "records", message: purgeErr.message ?? "purge failed" };
  // 함수가 예외 대신 결과(jsonb)로 거부를 알려 주는 경우도 실패로 본다({ ok: false, … }).
  if (data !== null && typeof data === "object" && (data as { ok?: unknown }).ok === false) {
    return { ok: false, step: "records", message: JSON.stringify(data) };
  }
  return { ok: true, alreadyDeleted };
}

const STEP_LABEL: Record<PurgeStep, string> = { files: "게임 파일", account: "로그인 계정", records: "기록" };

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("admin-clear-students: 환경변수가 설정되지 않았습니다.");
    return json({ error: "서버 설정 오류입니다. 관리자에게 문의하세요." }, 500, headers);
  }

  // ① 호출자 확인
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "로그인이 필요합니다." }, 401, headers);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerErr } = await authClient.auth.getUser(jwt);
  if (callerErr || !callerData.user) {
    return json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, 401, headers);
  }
  const callerId = callerData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ② 관리자·총괄 확인 (서비스 롤로 profiles.role · is_super_admin 조회)
  const { data: callerProfile, error: callerProfileErr } = await admin
    .from("profiles")
    .select("role,is_super_admin")
    .eq("id", callerId)
    .maybeSingle();
  if (callerProfileErr) {
    if (isMissingSchema(callerProfileErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
    console.error("admin-clear-students: 관리자 확인 실패", scrub(callerProfileErr.message));
    return json({ error: "관리자 권한을 확인하지 못했습니다." }, 500, headers);
  }
  if (callerProfile?.role !== "admin") return json({ error: "관리자만 사용할 수 있습니다." }, 403, headers);
  // 총괄 = role 'admin' + is_super_admin (DB 함수 is_super_admin()과 같은 규칙)
  const callerIsSuper = callerProfile?.is_super_admin === true;

  // ③ 요청 확인 — classId 와 userId 중 정확히 하나 + confirmName
  const body = await req.json().catch(() => null);
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawClassId = input.classId;
  const rawUserId = input.userId;
  const hasClass = rawClassId !== undefined && rawClassId !== null && rawClassId !== "";
  const hasUser = rawUserId !== undefined && rawUserId !== null && rawUserId !== "";
  if (hasClass === hasUser) {
    return json({ error: "요청 형식이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요." }, 400, headers);
  }
  const confirmName = typeof input.confirmName === "string" ? input.confirmName.trim() : "";
  if (!confirmName || confirmName.length > MAX_CONFIRM_LENGTH) {
    return json(
      { error: hasClass ? CLASS_NAME_MISMATCH_MESSAGE : STUDENT_NAME_MISMATCH_MESSAGE, code: "confirm_mismatch" },
      400,
      headers,
    );
  }

  // 담임 확인용: 호출자가 담임인 학급 id 목록(총괄은 쓰지 않는다)
  async function homeroomClassIds(): Promise<{ ids: string[]; error: ErrorLike }> {
    const { data, error } = await admin.from("class_teachers").select("class_id").eq("teacher_id", callerId);
    if (error) return { ids: [], error: error as ErrorLike };
    const ids = ((data ?? []) as { class_id?: unknown }[])
      .map((l) => (typeof l.class_id === "string" ? l.class_id.toLowerCase() : ""))
      .filter((v) => v !== "");
    return { ids, error: null };
  }

  // 새 SQL 확인: 삭제 RPC 가 있어야 한다(없으면 파일·계정을 지운 뒤 기록을 못 지운다 → 아무것도 지우지 않고 거부).
  // 존재 확인용으로 일부러 빈 인자(null)를 넣어 "함수 없음"만 가려낸다(admin-purge-oauth-member 와 같은 방식 — 기대한
  // 대답 'missing arguments'일 때만 계속한다, review L1).
  async function probePurgeFunction(): Promise<Response | null> {
    const probe = await admin.rpc("admin_purge_class_member", { p_target: null, p_actor: null });
    if (probe.error && isMissingFunction(probe.error as ErrorLike)) {
      return json({ error: MISSING_PRIVACY_SQL_MESSAGE }, 400, headers);
    }
    if (!probe.error || !(probe.error.message ?? "").toLowerCase().includes("missing arguments")) {
      console.error("admin-clear-students: DB 설정 확인 실패", scrub(probe.error?.message ?? "unexpected success"));
      return json(
        { error: "DB 설정을 확인하지 못해 멈췄습니다. 아무것도 지우지 않았습니다. 잠시 후 다시 시도해 주세요." },
        500,
        headers,
      );
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // 학생 한 명 '기록까지 삭제'
  // ─────────────────────────────────────────────
  if (hasUser) {
    if (typeof rawUserId !== "string" || !UUID_RE.test(rawUserId.trim())) {
      return json({ error: "지울 학생 정보(userId)가 올바르지 않습니다." }, 400, headers);
    }
    const targetId = rawUserId.trim().toLowerCase();
    if (targetId === callerId.toLowerCase()) {
      return json({ error: "자기 자신의 계정은 지울 수 없습니다." }, 400, headers);
    }

    const { data: target, error: targetErr } = await admin
      .from("profiles")
      .select("role,class_id,display_name")
      .eq("id", targetId)
      .maybeSingle();
    if (targetErr) {
      if (isMissingSchema(targetErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
      console.error("admin-clear-students: 대상 확인 실패", scrub(targetErr.message));
      return json({ error: "대상 계정 정보를 확인하지 못했습니다." }, 500, headers);
    }
    if (!target) {
      // 이미 지워졌거나 없는 학생 — 화면은 이 코드를 보고 목록을 새로 불러온다.
      return json({ error: "대상 계정을 찾을 수 없습니다. 이미 지워졌을 수 있습니다.", code: "target_not_found" }, 404, headers);
    }
    if (target.role === "admin") return json({ error: TEACHER_TARGET_MESSAGE }, 400, headers);

    // 권한: 총괄은 모든 학생, 담임은 자기 학급 학생만(학급이 없는 학생은 총괄만).
    // 담임 여부(= DB 의 teaches_student)는 이름 확인에도 쓰므로 학급이 있는 학생이면 총괄도 확인한다(개정 4).
    const targetClassId = typeof target.class_id === "string" ? target.class_id.toLowerCase() : null;
    let isHomeroom = false;
    if (targetClassId) {
      const mine = await homeroomClassIds();
      if (mine.error) {
        if (isMissingSchema(mine.error)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
        console.error("admin-clear-students: 담임 확인 실패", scrub(mine.error.message));
        return json({ error: "담임 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
      }
      isHomeroom = mine.ids.includes(targetClassId);
    }
    if (!callerIsSuper && !isHomeroom) {
      return json({ error: NOT_HOMEROOM_STUDENT_MESSAGE }, 403, headers);
    }
    // 이름 확인(spec 4.11 개정 4): 호출자가 회원 명단에서 보는 이름과 비교한다. 그 학생의 담임(총괄이 담임을 겸하면 총괄도)과
    // 학급 없는 학생을 보는 총괄 = 원래 이름, 담임이 아닌 총괄이 다른 학급 학생을 지울 때 = 가린 이름("2***" — SQL mask_label 과 같은 규칙).
    const seesMaskedName = callerIsSuper && targetClassId !== null && !isHomeroom;

    // 아이디 계정인가(구글·깃허브 전용 계정은 총괄의 '완전 삭제'로) + 이름 확인용 로그인 아이디
    const { data: directory, error: directoryErr } = await admin
      .from("member_directory")
      .select("email,provider,providers")
      .eq("id", targetId)
      .maybeSingle();
    if (directoryErr) {
      console.error("admin-clear-students: 가입 방식 확인 실패", scrub(directoryErr.message));
      return json({ error: "대상 계정의 가입 방식을 확인하지 못했습니다." }, 500, headers);
    }
    const purgeable = await purgeableKind(admin, targetId, loginKind(directory));
    if (purgeable === "oauth") return json({ error: OAUTH_TARGET_MESSAGE }, 400, headers);
    if (purgeable === "error") {
      return json({ error: "대상 로그인 계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
    }

    const expectedName = seesMaskedName
      ? maskedStudentName(target.display_name, directory?.email)
      : studentName(target.display_name, directory?.email);
    if (confirmName !== expectedName) {
      return json({ error: STUDENT_NAME_MISMATCH_MESSAGE, code: "confirm_mismatch" }, 400, headers);
    }

    const probeFail = await probePurgeFunction();
    if (probeFail) return probeFail;

    const outcome = await purgeStudent(admin, targetId, callerId);
    if (!outcome.ok) {
      console.error("admin-clear-students: 학생 삭제 실패", STEP_LABEL[outcome.step], scrub(outcome.message));
      if (outcome.step === "records") {
        // 로그인 계정·게임 파일은 이미 지웠다 — 같은 학생에게 다시 하면 기록 단계만 다시 한다.
        return json(
          {
            ok: true,
            deleted: 0,
            failed: 1,
            remaining: 1,
            warning:
              "로그인 계정과 올린 게임 파일은 지웠지만 기록을 아직 지우지 못했습니다. " +
              "같은 학생에게 '기록까지 삭제'를 한 번 더 실행하면 남은 기록만 다시 지웁니다.",
          },
          200,
          headers,
        );
      }
      return json(
        {
          error: outcome.step === "files"
            ? "올린 게임 파일을 지우지 못해 멈췄습니다. 학생 계정과 기록은 그대로입니다. 잠시 후 다시 시도해 주세요."
            : "로그인 계정을 지우지 못해 멈췄습니다. 올린 게임 파일은 지웠고, 학생 계정과 나머지 기록은 그대로입니다. " +
              "잠시 후 다시 시도해 주세요.",
        },
        500,
        headers,
      );
    }
    return json({ ok: true, deleted: 1, failed: 0, remaining: 0 }, 200, headers);
  }

  // ─────────────────────────────────────────────
  // 학급 정리 (한 번에 BATCH 명)
  // ─────────────────────────────────────────────
  if (typeof rawClassId !== "string" || !UUID_RE.test(rawClassId.trim())) {
    return json({ error: "학급 정보(classId)가 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요." }, 400, headers);
  }
  const classId = rawClassId.trim().toLowerCase();

  // 권한: 그 학급의 담임 또는 총괄. (없는 학급과 남의 학급을 담임에게는 구분하지 않는다 — 다른 학급 id를 알아내는 데 쓰이지 않게)
  if (!callerIsSuper) {
    const mine = await homeroomClassIds();
    if (mine.error) {
      if (isMissingSchema(mine.error)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
      console.error("admin-clear-students: 담임 확인 실패", scrub(mine.error.message));
      return json({ error: "담임 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
    }
    if (!mine.ids.includes(classId)) return json({ error: NOT_HOMEROOM_CLASS_MESSAGE }, 403, headers);
  }

  const { data: classRow, error: classErr } = await admin
    .from("classes")
    .select("id,name")
    .eq("id", classId)
    .maybeSingle();
  if (classErr) {
    if (isMissingSchema(classErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
    console.error("admin-clear-students: 학급 확인 실패", scrub(classErr.message));
    return json({ error: "학급 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
  }
  if (!classRow) return json({ error: "학급을 찾을 수 없습니다.", code: "class_not_found" }, 404, headers);
  const className = typeof classRow.name === "string" ? classRow.name.trim() : "";
  if (!className || confirmName !== className) {
    return json({ error: CLASS_NAME_MISMATCH_MESSAGE, code: "confirm_mismatch" }, 400, headers);
  }

  // 이번에 살펴볼 학생(탈퇴 처리된 학생 포함 — profiles 행이 남아 있다): 그 학급 학생을 id 순으로 모두(최대 MAX_SCAN 명) 읽고,
  // 지울 수 없는 학생(구글·깃허브 전용 · 가입 방식 확인 실패)은 건너뛰며 지울 수 있는 학생을 BATCH 명까지 처리한다.
  // 고침 1(검토 R1 L7): 예전에는 id 순 앞 BATCH 명만 골라, 지울 수 없는 학생이 앞에 BATCH 명 이상 몰리면 같은 학생만 되풀이했다.
  const { data: classRows, error: listErr } = await admin
    .from("profiles")
    .select("id")
    .eq("class_id", classId)
    .eq("role", "user")
    .order("id", { ascending: true })
    .limit(MAX_SCAN);
  if (listErr) {
    console.error("admin-clear-students: 학생 목록 확인 실패", scrub(listErr.message));
    return json({ error: "학급 학생 목록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
  }
  const studentIds = ((classRows ?? []) as { id?: unknown }[])
    .map((r) => (typeof r.id === "string" ? r.id : ""))
    .filter((v) => v !== "" && v.toLowerCase() !== callerId.toLowerCase());
  if (studentIds.length === 0) {
    // 지울 학생이 없다(이미 끝났거나 처음부터 없음) — 기록도 남기지 않는다(다시 눌러도 기록이 늘지 않게).
    return json({ ok: true, deleted: 0, failed: 0, remaining: 0 }, 200, headers);
  }

  const probeFail = await probePurgeFunction();
  if (probeFail) return probeFail;

  // 가입 방식(구글·깃허브 전용 계정이 학급에 있으면 건너뛰고 failed 로 센다 — 명단으로 모르면 purgeableKind 가 로그인 계정으로 본다).
  // 주소 길이를 넘지 않게 LIST_PAGE 명씩 나눠 읽는다.
  const kindById = new Map<string, "id" | "oauth" | "unknown">();
  for (let i = 0; i < studentIds.length; i += LIST_PAGE) {
    const { data: dirRows, error: dirErr } = await admin
      .from("member_directory")
      .select("id,provider,providers")
      .in("id", studentIds.slice(i, i + LIST_PAGE));
    if (dirErr) {
      console.error("admin-clear-students: 가입 방식 확인 실패", scrub(dirErr.message));
      return json({ error: "학생들의 가입 방식을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
    }
    for (const row of (dirRows ?? []) as { id?: unknown; provider?: unknown; providers?: unknown }[]) {
      if (typeof row.id === "string") kindById.set(row.id.toLowerCase(), loginKind(row));
    }
  }

  let deleted = 0;
  let failed = 0;
  let attempted = 0;
  // 다시 눌러도 지워지지 않는 학생(구글·깃허브 전용) — 화면이 failed 만으로는 알 수 없어 warning 으로 알린다.
  let oauthSkipped = 0;
  for (const studentId of studentIds) {
    if (attempted >= BATCH) break;
    const purgeable = await purgeableKind(admin, studentId, kindById.get(studentId.toLowerCase()) ?? "unknown");
    if (purgeable !== "ok") {
      // 건너뛴 학생은 BATCH 에 세지 않는다 — 그 뒤 학생으로 넘어간다(L7).
      failed += 1;
      if (purgeable === "oauth") oauthSkipped += 1;
      else console.error("admin-clear-students: 학생 정리 실패", "가입 방식 확인");
      continue;
    }
    attempted += 1;
    const outcome = await purgeStudent(admin, studentId, callerId);
    if (outcome.ok) {
      deleted += 1;
    } else {
      failed += 1;
      console.error("admin-clear-students: 학생 정리 실패", STEP_LABEL[outcome.step], scrub(outcome.message));
    }
  }

  // 남은 학생 수(이번에 실패한 학생 포함)
  const { count: remainingCount, error: remainingErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("role", "user");
  let remaining: number;
  if (remainingErr || remainingCount === null) {
    console.error("admin-clear-students: 남은 학생 수 확인 실패", scrub(remainingErr?.message ?? "no count"));
    // 셀 수 없으면 "남아 있음"으로 알려 화면이 한 번 더 부르게 한다(다음 호출이 실제로 비었으면 0을 돌려준다).
    remaining = Math.max(failed, 1);
  } else {
    remaining = remainingCount;
  }

  // 일반 실패(failed)는 화면이 privacy-policy.md 8-4 "일부 실패" 문구로 알린다 — 여기서는 화면이 알 수 없는 것만 warning 으로.
  const warnings: string[] = [];
  if (oauthSkipped > 0) {
    warnings.push(
      `구글·깃허브로 로그인하는 계정 ${oauthSkipped}개는 학급 정리로 지울 수 없습니다. ` +
        "총괄 관리자가 회원 관리의 '완전 삭제'로 지워 주세요.",
    );
  }

  // 학급 정리 기록(인원수만 — 이름·아이디 없음). 1명 이상 지운 호출마다 부른다 — DB 함수가 같은 학급·같은 선생님의
  // 1시간 안 기록에 더해 한 줄로 남긴다(20명씩 여러 번 불러도 "한 번의 정리 = 한 줄"). 빈 학급에 다시 눌러도 늘지 않는다.
  if (deleted > 0) {
    const { error: logErr } = await admin.rpc("admin_finish_class_cleanup", {
      p_class_id: classId,
      p_actor: callerId,
      p_count: deleted,
    });
    if (logErr) {
      console.error("admin-clear-students: 학급 정리 기록 실패", scrub(logErr.message));
      warnings.push("학생 계정과 기록은 지웠지만 '학급 정리 기록'(지운 인원수)을 남기지 못했습니다.");
    }
  }

  return json(
    warnings.length > 0
      ? { ok: true, deleted, failed, remaining, warning: warnings.join(" ") }
      : { ok: true, deleted, failed, remaining },
    200,
    headers,
  );
});
