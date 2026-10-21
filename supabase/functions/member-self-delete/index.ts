// member-self-delete — 구글로 로그인한 회원이 **자기 계정**을 스스로 지운다(계정 + 기록 모두, 되돌릴 수 없음).
// 설계: docs/privacy/spec.md 3.4 · 4.7-2 · 5절(머리말 개정 1·2와 1.1 결정표가 본문보다 우선). 배포·확인은 같은 폴더의 README.md.
//
// 요청:  POST { "mode": "cancel" | "withdraw" }  (Authorization: Bearer <호출자 access token> — supabase-js가 자동 첨부)
//        cancel   = [가입하지 않기] / [가입하지 않기(계정 삭제)] — 교사 인증 전 구글 계정(새 가입·기존 회원 모두, 결정 7·질문 5)
//        withdraw = [내 정보] → [회원 탈퇴] — 인증을 마친 구글 선생님 또는 구글 관리자(총괄 제외, 결정 11)
// 응답:  200 { "ok": true, "mode": "...", "alreadyDeleted": boolean, "removedFiles": number, "warning"?: "..." }
//        200 { "ok": false, "code": "blocked", "blocked": ["학급 이름", …], "error": "아직 학생이 있는 학급이 있어요: …" }
//            (withdraw 인데 맡은 학급에 학생이 남아 있음 — 아무것도 지우지 않았다. spec 5절 응답 { ok, blocked? })
//        400/401/403/404/405/500 { "error": "한국어 메시지", "code"?: "..." }
//
// 누가 · 무엇을 (spec 4.7-2 — DB 함수 self_purge_member 도 같은 조건을 다시 확인한다)
// - 본인만: 대상 = JWT 의 계정. 요청 본문으로 다른 계정을 고를 수 없다.
// - 구글 전용 계정만: member_directory.provider(s)와 로그인 계정의 identities·app_metadata 로 이중 확인(아이디 로그인이 있으면 400).
// - 총괄(is_super_admin)은 어느 모드도 불가(403).
// - cancel: member_verification 행이 있고 verified_at 이 비어 있고 role 'user' 이고 학급 없음(= 인증 전, origin 은 보지 않는다).
// - withdraw: 인증을 마쳤거나(verified_at) role 'admin' 인 구글 계정. 담임으로 맡은 학급 어디에든 학생(role 'user',
//   탈퇴한 학생 포함)이 남아 있으면 blocked(학급 이름 목록) — 먼저 '학급 정리'. 마지막 관리자(role 'admin' 이 하나뿐)도 불가.
//   혼자 맡은 빈 학급·함께 맡은 학급의 담임 연결 정리는 DB 함수가 한다.
//
// 순서 — 계정을 지우기(⑦) 전에 조건을 모두 확인한다(지운 뒤에는 본인이 다시 부를 수 없으므로)
//   ① 호출자 JWT → ② 본인 프로필·총괄 확인 → ③ 구글 전용 확인 → ④ 인증 상태·모드 조건(withdraw: 학급 학생·마지막 관리자)
//   → ⑤ 새 SQL(20261020000000_privacy_a_schema.sql) 확인 — 여기까지는 아무것도 지우지 않는다 —
//   → ⑥ Storage game-uploads 의 {회원 id}/ 폴더 파일을 지우고 비었는지 다시 확인(실패하면 멈춤 — 계정·기록은 그대로, 다시 누르면 됨)
//   → ⑦ auth.admin.deleteUser(하드 삭제 — 이미 없으면 통과) → ⑧ RPC self_purge_member(남은 기록·글·프로필, 한 트랜잭션)
//   ⑧이 실패하면 warning 과 함께 200 — 계정은 이미 없어 본인이 다시 부를 수 없으므로 운영자에게 알리게 안내한다
//   (총괄이 회원 관리의 '완전 삭제'로 남은 기록을 지울 수 있다 — 교사였던 계정은 먼저 '담임 해제').
// - 로그: 실패한 단계와 오류 문구만 남긴다(토큰·이메일·이름·id 는 남기지 않고, 오류 문구 안의 id·이메일 모양도 가린다).
//   성공은 남기지 않는다(admin-purge-oauth-member 와 같음).
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

/** 로그·응답에 넣는 오류 문구에서 id(uuid)·이메일 모양을 가린다(회원 정보를 남기지 않기 — spec 5절 공통). */
const UUID_ANY_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_ANY_RE = /[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+/g;
function scrub(text: unknown): string {
  return String(text ?? "").replace(UUID_ANY_RE, "<id>").replace(EMAIL_ANY_RE, "<email>").slice(0, 300);
}

/** 학습게임 업로드 버킷(20260922040000_community.sql). 파일 경로는 {회원 id}/{uuid}.html */
const GAME_BUCKET = "game-uploads";
const LIST_PAGE = 100;
/** 한 폴더에서 읽을 최대 쪽 수(100개씩) — 무한 반복을 막는 한도일 뿐이다(admin-purge-oauth-member 와 같음). */
const MAX_PAGES = 50;
/** 하위 폴더를 몇 단계까지 따라갈지(사이트는 {회원 id}/ 바로 아래에만 올린다 — 여유). */
const MAX_DEPTH = 2;

const MISSING_PRIVACY_SQL_MESSAGE =
  "계정 삭제 기능용 DB 설정이 아직 적용되지 않았어요. 운영자가 Supabase SQL Editor에서 " +
  "20261020000000_privacy_a_schema.sql을 먼저 실행해야 해요. (아무것도 지우지 않았어요.)";
const MISSING_CLASSES_SQL_MESSAGE =
  "학급 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20260927000000_classes_schema.sql을 먼저 실행해 주세요.";
// privacy-policy.md 8-6 "총괄 선생님일 때" 원문 그대로.
const SUPER_MESSAGE = "총괄 선생님은 이 화면에서 탈퇴할 수 없어요.";
const ID_LOGIN_MESSAGE =
  "아이디로 로그인하는 계정은 여기서 지울 수 없어요. 담임 선생님이나 운영자에게 알려 주세요.";
const UNKNOWN_LOGIN_MESSAGE =
  "가입 방식을 확인할 수 없는 계정이라 여기서 지울 수 없어요. 운영자에게 알려 주세요.";
const NOT_PENDING_MESSAGE =
  "이 계정은 '가입하지 않기'를 할 수 없어요. 이미 교사 인증을 마쳤다면 [내 정보]의 [회원 탈퇴]를 이용해 주세요.";
const NOT_VERIFIED_MESSAGE =
  "교사 인증을 마치지 않은 계정은 [회원 탈퇴] 대신 [가입하지 않기]로 지울 수 있어요.";
const LAST_ADMIN_MESSAGE = "마지막 관리자 계정은 탈퇴할 수 없어요. 운영자에게 알려 주세요.";

/** privacy-policy.md 8-6 "막혔을 때" 원문({학급 이름들} 자리만 채움). */
function blockedMessage(names: string[]): string {
  return `아직 학생이 있는 학급이 있어요: ${names.join(", ")}. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 탈퇴해 주세요.`;
}

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

/** 아이디(이메일·비밀번호) 로그인이 붙어 있는 로그인 계정인지(app_metadata·identities). */
function authUserHasIdLogin(user: {
  app_metadata?: Record<string, unknown>;
  identities?: { provider?: string }[] | null;
}): boolean {
  const appMeta = (user.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const metaProviders = Array.isArray(appMeta.providers)
    ? appMeta.providers.filter((p): p is string => typeof p === "string")
    : [];
  return appMeta.provider === "email" ||
    metaProviders.includes("email") ||
    (user.identities ?? []).some((i) => i.provider === "email");
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

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("member-self-delete: 환경변수가 설정되지 않았습니다.");
    return json({ error: "서버 설정 오류입니다. 관리자에게 문의하세요." }, 500, headers);
  }

  // ① 호출자 확인 — 대상은 언제나 이 계정 자신이다.
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "로그인이 필요합니다." }, 401, headers);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerErr } = await authClient.auth.getUser(jwt);
  if (callerErr || !callerData.user) {
    return json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, 401, headers);
  }
  const callerUser = callerData.user;
  const callerId = callerUser.id;

  const body = await req.json().catch(() => null);
  const mode = body && typeof body === "object" ? (body as { mode?: unknown }).mode : undefined;
  if (mode !== "cancel" && mode !== "withdraw") {
    return json({ error: "요청 형식이 올바르지 않아요. 화면을 새로 고친 뒤 다시 해 주세요." }, 400, headers);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ② 본인 프로필 · 총괄 확인(서비스 롤 — RLS 와 무관하게 실제 값을 본다)
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role,is_super_admin,class_id")
    .eq("id", callerId)
    .maybeSingle();
  if (profileErr) {
    if (isMissingSchema(profileErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
    console.error("member-self-delete: 본인 확인 실패", scrub(profileErr.message));
    return json({ error: "계정 정보를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요." }, 500, headers);
  }
  if (!profile) {
    return json(
      { error: "계정 정보를 찾을 수 없어요. 이미 지워졌을 수 있어요. 로그아웃한 뒤 다시 확인해 주세요.", code: "self_not_found" },
      404,
      headers,
    );
  }
  if (profile.is_super_admin === true) return json({ error: SUPER_MESSAGE, code: "super_admin" }, 403, headers);
  const role = profile.role === "admin" ? "admin" : "user";

  // ③ 구글 전용인가(1): 회원 명단의 가입 방식 — 화면(isOAuthOnlyMember)·SQL 함수와 같은 규칙.
  const { data: directory, error: directoryErr } = await admin
    .from("member_directory")
    .select("provider,providers")
    .eq("id", callerId)
    .maybeSingle();
  if (directoryErr) {
    console.error("member-self-delete: 가입 방식 확인 실패", scrub(directoryErr.message));
    return json({ error: "가입 방식을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요." }, 500, headers);
  }
  if (!directory) return json({ error: UNKNOWN_LOGIN_MESSAGE, code: "unknown_login" }, 400, headers);
  const dirProvider = typeof directory.provider === "string" ? directory.provider : "";
  const dirProviders = Array.isArray(directory.providers)
    ? (directory.providers as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  if (dirProvider === "email" || dirProviders.includes("email")) {
    return json({ error: ID_LOGIN_MESSAGE, code: "id_login" }, 400, headers);
  }
  if (!dirProvider && dirProviders.length === 0) return json({ error: UNKNOWN_LOGIN_MESSAGE, code: "unknown_login" }, 400, headers);
  // ③-2 구글 전용인가(2): 지금 로그인한 계정의 로그인 수단(이중 확인).
  if (authUserHasIdLogin(callerUser)) return json({ error: ID_LOGIN_MESSAGE, code: "id_login" }, 400, headers);

  // ④ 인증 상태(member_verification — ①의 새 표). 표가 없으면 SQL ① 전이다.
  const { data: verification, error: verificationErr } = await admin
    .from("member_verification")
    .select("verified_at")
    .eq("user_id", callerId)
    .maybeSingle();
  if (verificationErr) {
    if (isMissingSchema(verificationErr)) return json({ error: MISSING_PRIVACY_SQL_MESSAGE }, 400, headers);
    console.error("member-self-delete: 인증 상태 확인 실패", scrub(verificationErr.message));
    return json({ error: "계정 상태를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요." }, 500, headers);
  }
  const verifiedAt = verification && verification.verified_at ? String(verification.verified_at) : null;

  if (mode === "cancel") {
    // 인증 전(pending) = 행이 있고 · 인증 안 함 · role user. 그리고 학급 없음(spec 4.7-2). origin 은 보지 않는다(질문 5).
    const pending = !!verification && !verifiedAt && role === "user";
    if (!pending || profile.class_id) return json({ error: NOT_PENDING_MESSAGE, code: "not_pending" }, 400, headers);
  } else {
    // withdraw: 인증을 마쳤거나 role admin 인 구글 계정.
    if (!verifiedAt && role !== "admin") return json({ error: NOT_VERIFIED_MESSAGE, code: "not_verified" }, 400, headers);

    // ④-2 담임으로 맡은 학급에 학생(탈퇴한 학생 포함)이 남아 있으면 막는다(결정 11). 함께 맡은 학급도 센다(spec 4.7-2).
    const { data: links, error: linkErr } = await admin
      .from("class_teachers")
      .select("class_id")
      .eq("teacher_id", callerId);
    if (linkErr) {
      if (isMissingSchema(linkErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
      console.error("member-self-delete: 담임 학급 확인 실패", scrub(linkErr.message));
      return json({ error: "맡은 학급을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요." }, 500, headers);
    }
    const classIds = [
      ...new Set(
        ((links ?? []) as { class_id?: unknown }[])
          .map((l) => (typeof l.class_id === "string" ? l.class_id : ""))
          .filter((v) => v !== ""),
      ),
    ];
    const blockedIds: string[] = [];
    for (const classId of classIds) {
      const { count, error: countErr } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .eq("role", "user");
      if (countErr || count === null) {
        console.error("member-self-delete: 학급 학생 수 확인 실패", scrub(countErr?.message ?? "no count"));
        return json({ error: "맡은 학급의 학생 수를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요." }, 500, headers);
      }
      if (count > 0) blockedIds.push(classId);
    }
    if (blockedIds.length > 0) {
      const { data: classRows, error: classErr } = await admin
        .from("classes")
        .select("id,name")
        .in("id", blockedIds);
      if (classErr) console.error("member-self-delete: 학급 이름 확인 실패", scrub(classErr.message));
      const names = ((classRows ?? []) as { name?: unknown }[])
        .map((c) => (typeof c.name === "string" ? c.name.trim() : ""))
        .filter((n) => n !== "")
        .sort((a, b) => a.localeCompare(b, "ko"));
      // 이름을 못 읽었어도 막는 것은 같다(학급 수만큼 "이름 없는 학급").
      const shown = names.length > 0 ? names : blockedIds.map(() => "이름 없는 학급");
      return json({ ok: false, code: "blocked", blocked: shown, error: blockedMessage(shown) }, 200, headers);
    }

    // ④-3 마지막 관리자는 탈퇴할 수 없다(spec 4.7-2 — role 'admin' 수 > 1).
    if (role === "admin") {
      const { count: adminCount, error: adminCountErr } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (adminCountErr || adminCount === null) {
        console.error("member-self-delete: 관리자 수 확인 실패", scrub(adminCountErr?.message ?? "no count"));
        return json({ error: "계정 상태를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요." }, 500, headers);
      }
      if (adminCount <= 1) return json({ error: LAST_ADMIN_MESSAGE, code: "last_admin" }, 400, headers);
    }
  }

  // ⑤ 새 SQL 확인: 삭제 RPC 가 있어야 한다(없으면 파일·계정을 지운 뒤 기록을 못 지운다 → 아무것도 지우지 않고 거부).
  //    존재 확인용으로 일부러 빈 인자(null)를 넣어 "함수 없음"만 가려낸다(함수는 'missing arguments'로 곧바로 끝난다 —
  //    admin-purge-oauth-member 와 같은 방식, review L1: 기대한 대답일 때만 계속한다).
  const probe = await admin.rpc("self_purge_member", { p_target: null, p_mode: null });
  if (probe.error && isMissingFunction(probe.error as ErrorLike)) {
    return json({ error: MISSING_PRIVACY_SQL_MESSAGE }, 400, headers);
  }
  if (!probe.error || !(probe.error.message ?? "").toLowerCase().includes("missing arguments")) {
    console.error("member-self-delete: DB 설정 확인 실패", scrub(probe.error?.message ?? "unexpected success"));
    return json(
      { error: "DB 설정을 확인하지 못해 멈췄어요. 아무것도 지우지 않았어요. 잠시 뒤에 다시 해 주세요." },
      500,
      headers,
    );
  }

  // ⑥ 올린 게임 파일 삭제(Storage API). 실패하면 여기서 멈춘다 — 계정이 남아 있어 본인이 다시 누를 수 있다.
  //    (계정을 먼저 지우면 남은 파일을 아무도 찾아 지울 수 없게 된다.)
  const files = await removeGameFiles(admin.storage, callerId);
  if (files.error) {
    console.error("member-self-delete: 게임 파일 삭제 실패", scrub(files.error));
    return json(
      {
        error:
          "올린 게임 파일을 지우지 못해 멈췄어요. 계정과 기록은 그대로예요. 잠시 뒤에 다시 해 주세요." +
          (files.removed > 0 ? ` (게임 파일 ${files.removed}개는 이미 지웠어요.)` : ""),
      },
      500,
      headers,
    );
  }

  // ⑦ 로그인 계정 삭제(하드 삭제 — 되돌릴 수 없음). 이미 없으면 그대로 진행해 ⑧만 한다(멱등).
  let alreadyDeleted = false;
  const { error: deleteErr } = await admin.auth.admin.deleteUser(callerId);
  if (deleteErr) {
    if (isUserNotFound(deleteErr as ErrorLike)) {
      alreadyDeleted = true;
    } else {
      console.error("member-self-delete: 로그인 계정 삭제 실패", scrub(deleteErr.message));
      return json(
        {
          error:
            "계정을 지우지 못했어요. " +
            (files.removed > 0 ? "올린 게임 파일은 이미 지웠고, " : "") +
            "계정과 나머지 기록은 그대로예요. 잠시 뒤에 다시 해 주세요.",
        },
        500,
        headers,
      );
    }
  }

  // ⑧ 남은 기록 삭제(서비스 롤 전용 RPC, 한 트랜잭션 — 조건도 다시 확인한다).
  const { data: purgeData, error: purgeErr } = await admin.rpc("self_purge_member", {
    p_target: callerId,
    p_mode: mode,
  });
  // 함수가 예외 대신 결과(jsonb)로 거부를 알려 주는 경우도 실패로 본다({ ok: false, … }).
  const purgeRefused = !purgeErr && purgeData !== null && typeof purgeData === "object" &&
    (purgeData as { ok?: unknown }).ok === false;
  if (purgeErr || purgeRefused) {
    console.error(
      "member-self-delete: 기록 삭제 실패",
      scrub(purgeErr?.message ?? JSON.stringify(purgeData)),
    );
    return json(
      {
        ok: true,
        mode,
        alreadyDeleted,
        removedFiles: files.removed,
        warning:
          "로그인 계정은 지웠지만 남은 기록을 아직 다 지우지 못했어요. " +
          "개인정보 처리방침의 문의 이메일로 운영자에게 알려 주시면 남은 기록을 지워 드려요.",
      },
      200,
      headers,
    );
  }

  return json({ ok: true, mode, alreadyDeleted, removedFiles: files.removed }, 200, headers);
});
