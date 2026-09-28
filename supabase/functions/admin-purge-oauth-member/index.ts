// admin-purge-oauth-member — 총괄이 구글·깃허브(OAuth)로만 로그인하는 계정을 '완전 삭제'한다(계정 + 기록 모두).
// 설계: docs/admin/oauth-delete/spec.md(끝 "개정 1 — 사용자 결정"이 우선). 배포·확인은 같은 폴더의 README.md.
//
// 요청:  POST { "userId": "<회원 id>" }  (Authorization: Bearer <호출자 access token> — supabase-js가 자동 첨부)
// 응답:  200 { "ok": true, "alreadyDeleted": boolean, "removedFiles": number, "warning"?: "..." }
//        400/401/403/404/405/500 { "error": "한국어 메시지", "code"?: "target_not_found" }
//
// 누가 · 누구를
// - 총괄(profiles.role 'admin' + is_super_admin)만 — 담임은 403(OAuth 가입 계정은 학급이 없어 원래 담임 대상이 아니다, spec §3.5).
// - 대상: role 'user' 이면서 아이디(이메일·비밀번호) 로그인이 없는 계정. member_directory.provider(s)(화면·SQL과 같은 규칙)와
//   Auth 계정의 identities·app_metadata 로 이중 확인한다. 아이디로 로그인할 수 있으면 400 — 지금처럼 '탈퇴 처리'(기록 보존)를 쓴다.
//   교사(role 'admin')는 400 — 총괄이 먼저 '담임 해제'(admin_set_role: 학생 있는 학급을 혼자 맡으면 거부)를 한다(개정 1 Q2).
//   예전에 '탈퇴 처리'한 OAuth 계정(Auth 계정은 이미 없음)도 같은 방법으로 남은 기록을 지울 수 있다(개정 1 Q7 — 하나씩).
// - 되돌릴 수 없다. 화면에서 이름을 다시 입력해 한 번 더 확인한다.
//
// 순서 — 같은 회원에게 다시 눌러도 안전하다(끝난 단계는 "이미 없음"으로 통과)
//   ① 호출자 JWT → ② 총괄 확인 → ③ 대상 확인(자기 자신·교사·아이디 계정 거부) → ④ 새 SQL(20260928000000_oauth_purge.sql) 확인
//   — 여기까지는 아무것도 지우지 않는다 —
//   → ⑤ Storage game-uploads 의 {회원 id}/ 폴더 파일을 모두 지우고 비었는지 다시 확인(실패하면 멈춤 — 계정·기록은 그대로)
//   → ⑥ auth.admin.deleteUser(하드 삭제 — 이미 없으면 통과) → ⑦ RPC admin_purge_oauth_member(남은 기록·글·관리 기록·프로필, 한 트랜잭션)
//   ⑦이 실패하면 warning 과 함께 200 — 다시 누르면 ⑤·⑥은 통과하고 ⑦만 다시 한다(admin-delete-member 의 ⑤→⑥과 같은 방식).
// - 로그: 실패한 단계와 오류 문구만 남긴다(토큰·이메일·이름 등 회원 정보는 남기지 않는다). 성공은 남기지 않는다
//   (삭제 사실 기록을 남기지 않기로 한 사용자 결정 — 개정 1 Q3).
// - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입한다. 서비스 롤 키는 응답에 넣지 않는다.

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

/** 학습게임 업로드 버킷(20260922040000_community.sql). 파일 경로는 {회원 id}/{uuid}.html */
const GAME_BUCKET = "game-uploads";
const LIST_PAGE = 100;
/** 한 폴더에서 읽을 최대 쪽 수(100개씩) — 사이트는 한 사람당 파일 35개까지만 올리게 한다. 무한 반복을 막는 한도일 뿐이다. */
const MAX_PAGES = 50;
/** 하위 폴더를 몇 단계까지 따라갈지(사이트는 {회원 id}/ 바로 아래에만 올린다 — 대시보드로 만든 폴더가 있어도 지우도록 여유) */
const MAX_DEPTH = 2;

const MISSING_PURGE_SQL_MESSAGE =
  "완전 삭제 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20260928000000_oauth_purge.sql을 먼저 실행해 주세요. (그 전에는 아무것도 지우지 않습니다.)";
const MISSING_CLASSES_SQL_MESSAGE =
  "학급 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20260927000000_classes_schema.sql을 먼저 실행해 주세요.";
const NOT_SUPER_MESSAGE = "구글·깃허브 계정의 완전 삭제는 총괄 관리자만 할 수 있습니다.";
const TEACHER_MESSAGE = "교사(관리자) 계정은 먼저 담임 해제를 해 주세요. 해제한 뒤에 완전 삭제할 수 있습니다.";
const ID_LOGIN_MESSAGE = "아이디로 로그인하는 계정은 완전 삭제 대신 '탈퇴 처리'를 이용하세요.";
const UNKNOWN_LOGIN_MESSAGE =
  "가입 방식(구글·깃허브)을 확인할 수 없는 계정이라 완전 삭제할 수 없습니다. '탈퇴 처리'를 이용하세요.";

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** 학급 SQL(20260927000000)이 아직 실행되지 않아 난 오류인지(열·표 없음). admin-delete-member 와 같은 판별. */
function isMissingClassesSql(error: ErrorLike): boolean {
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

/** 대상 계정이 이미 없을 때 나는 오류인지(재시도를 멱등하게 만들기 위해).
 *  상태 404 · 코드 user_not_found 만 본다(review L2 — 메시지 글자로 판단하면 다른 오류를 "계정 없음"으로 잘못 보고
 *  이중 확인과 계정 삭제를 건너뛸 수 있었다). */
function isUserNotFound(error: ErrorLike): boolean {
  if (!error) return false;
  return error.status === 404 || error.code === "user_not_found";
}

/**
 * prefix 폴더 아래 파일 경로를 모두 모은다(쪽 나눠 읽기, 하위 폴더는 MAX_DEPTH 단계까지).
 * list()는 prefix 바로 아래 이름만 돌려준다 — 파일은 id 가 있고, 폴더는 id 가 null 이다.
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
    console.error("admin-purge-oauth-member: 환경변수가 설정되지 않았습니다.");
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

  // ② 총괄 확인(서비스 롤로 profiles.role · is_super_admin 조회 — DB 함수 is_super_admin()과 같은 규칙). 담임·학생은 403.
  const { data: callerProfile, error: callerProfileErr } = await admin
    .from("profiles")
    .select("role,is_super_admin")
    .eq("id", callerId)
    .maybeSingle();
  if (callerProfileErr) {
    if (isMissingClassesSql(callerProfileErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 400, headers);
    console.error("admin-purge-oauth-member: 총괄 확인 실패", callerProfileErr.message);
    return json({ error: "관리자 권한을 확인하지 못했습니다." }, 500, headers);
  }
  if (callerProfile?.role !== "admin" || callerProfile?.is_super_admin !== true) {
    return json({ error: NOT_SUPER_MESSAGE }, 403, headers);
  }

  // ③ 대상 확인 — 여기까지 아무것도 지우지 않는다.
  const body = await req.json().catch(() => null);
  const targetId = body && typeof body === "object" ? (body as { userId?: unknown }).userId : undefined;
  if (typeof targetId !== "string" || !UUID_RE.test(targetId)) {
    return json({ error: "완전 삭제할 회원 정보(userId)가 올바르지 않습니다." }, 400, headers);
  }
  if (targetId === callerId) {
    return json({ error: "자기 자신의 계정은 완전 삭제할 수 없습니다." }, 400, headers);
  }

  const { data: targetProfile, error: targetProfileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();
  if (targetProfileErr) {
    console.error("admin-purge-oauth-member: 대상 확인 실패", targetProfileErr.message);
    return json({ error: "대상 계정 정보를 확인하지 못했습니다." }, 500, headers);
  }
  if (!targetProfile) {
    // 이미 완전 삭제됐거나 없는 회원 — 화면은 이 코드를 보고 목록을 새로 불러온다.
    return json({ error: "대상 계정을 찾을 수 없습니다. 이미 지워졌을 수 있습니다.", code: "target_not_found" }, 404, headers);
  }
  if (targetProfile.role === "admin") return json({ error: TEACHER_MESSAGE }, 400, headers);

  // ③-2 OAuth 전용인가(1): 회원 명단의 가입 방식 — 화면(isOAuthOnlyMember)·SQL 함수와 같은 규칙.
  const { data: directory, error: directoryErr } = await admin
    .from("member_directory")
    .select("provider,providers")
    .eq("id", targetId)
    .maybeSingle();
  if (directoryErr) {
    console.error("admin-purge-oauth-member: 가입 방식 확인 실패", directoryErr.message);
    return json({ error: "대상 계정의 가입 방식을 확인하지 못했습니다." }, 500, headers);
  }
  if (!directory) return json({ error: UNKNOWN_LOGIN_MESSAGE }, 400, headers);
  const dirProvider = typeof directory.provider === "string" ? directory.provider : "";
  const dirProviders = Array.isArray(directory.providers)
    ? (directory.providers as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  if (dirProvider === "email" || dirProviders.includes("email")) return json({ error: ID_LOGIN_MESSAGE }, 400, headers);
  if (!dirProvider && dirProviders.length === 0) return json({ error: UNKNOWN_LOGIN_MESSAGE }, 400, headers);

  // ③-3 OAuth 전용인가(2): Auth 계정이 아직 있으면 그 계정의 로그인 수단도 본다(이중 확인).
  //      이미 없으면(예전에 탈퇴 처리한 계정 · 재시도) 회원 명단 확인만으로 진행한다.
  const { data: authTarget, error: authTargetErr } = await admin.auth.admin.getUserById(targetId);
  if (authTargetErr && !isUserNotFound(authTargetErr as ErrorLike)) {
    console.error("admin-purge-oauth-member: 로그인 계정 확인 실패", authTargetErr.message);
    return json({ error: "대상 로그인 계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
  }
  const authUser = authTargetErr ? null : authTarget?.user ?? null;
  if (authUser) {
    const appMeta = (authUser.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
    const metaProviders = Array.isArray(appMeta.providers)
      ? appMeta.providers.filter((p): p is string => typeof p === "string")
      : [];
    const hasIdLogin =
      appMeta.provider === "email" ||
      metaProviders.includes("email") ||
      (authUser.identities ?? []).some((i) => i.provider === "email");
    if (hasIdLogin) return json({ error: ID_LOGIN_MESSAGE }, 400, headers);
  }

  // ④ 새 SQL 확인: 완전 삭제 RPC 가 있어야 한다(없으면 파일·계정을 지운 뒤 기록을 못 지운다 → 아무것도 지우지 않고 거부).
  //    존재 확인용으로 일부러 빈 인자(null)를 넣어 "함수 없음"만 가려낸다(함수는 'missing arguments'로 곧바로 끝난다).
  const probe = await admin.rpc("admin_purge_oauth_member", { p_target: null, p_actor: null });
  if (probe.error && isMissingFunction(probe.error as ErrorLike)) {
    return json({ error: MISSING_PURGE_SQL_MESSAGE }, 400, headers);
  }
  // 기대한 대답('missing arguments')일 때만 함수가 있다고 보고 계속한다(review L1 — 권한·연결 오류 등을 "있음"으로 보고
  // 파일·계정을 지우러 가지 않게). 그 밖이면 아무것도 지우지 않고 멈춘다.
  if (!probe.error || !(probe.error.message ?? "").toLowerCase().includes("missing arguments")) {
    console.error("admin-purge-oauth-member: DB 설정 확인 실패", probe.error?.message ?? "unexpected success");
    return json(
      { error: "DB 설정을 확인하지 못해 완전 삭제를 멈췄습니다. 아무것도 지우지 않았습니다. 잠시 후 다시 시도해 주세요." },
      500,
      headers,
    );
  }

  // ⑤ 올린 게임 파일 삭제(Storage API — SQL 로 storage.objects 를 지우지 않는다). 실패하면 여기서 멈춘다(계정·기록은 그대로).
  const files = await removeGameFiles(admin.storage, targetId);
  if (files.error) {
    console.error("admin-purge-oauth-member: 게임 파일 삭제 실패", files.error);
    return json(
      {
        error:
          "올린 게임 파일을 지우지 못해 완전 삭제를 멈췄습니다. 로그인 계정과 기록은 그대로입니다. " +
          "잠시 후 다시 시도해 주세요." +
          (files.removed > 0 ? ` (게임 파일 ${files.removed}개는 이미 지웠습니다.)` : ""),
      },
      500,
      headers,
    );
  }

  // ⑥ 로그인 계정 삭제(하드 삭제 — 되돌릴 수 없음). 이미 없으면 그대로 진행해 ⑦만 한다.
  let alreadyDeleted = !authUser;
  if (authUser) {
    const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId);
    if (deleteErr) {
      if (isUserNotFound(deleteErr as ErrorLike)) {
        alreadyDeleted = true;
      } else {
        console.error("admin-purge-oauth-member: 로그인 계정 삭제 실패", deleteErr.message);
        return json(
          {
            error:
              "로그인 계정을 삭제하지 못했습니다. " +
              (files.removed > 0 ? "올린 게임 파일은 이미 지웠고, " : "") +
              "로그인 계정과 나머지 기록은 그대로입니다. 잠시 후 다시 시도해 주세요. " +
              `(원인: ${deleteErr.message})`,
          },
          500,
          headers,
        );
      }
    }
  }

  // ⑦ 남은 기록 삭제(서비스 롤 전용 RPC, 한 트랜잭션). 같은 회원을 다시 호출해도 안전하다.
  const { error: purgeErr } = await admin.rpc("admin_purge_oauth_member", {
    p_target: targetId,
    p_actor: callerId,
  });
  if (purgeErr) {
    console.error("admin-purge-oauth-member: 기록 삭제 실패", purgeErr.message);
    return json(
      {
        ok: true,
        alreadyDeleted,
        removedFiles: files.removed,
        warning:
          "로그인 계정과 올린 게임 파일은 지웠지만 학습 기록·글·관리 기록을 아직 지우지 못했습니다. " +
          "목록에 아직 보일 수 있어요. 같은 회원에게 '완전 삭제'를 한 번 더 실행하면 남은 기록만 다시 지웁니다.",
      },
      200,
      headers,
    );
  }

  return json({ ok: true, alreadyDeleted, removedFiles: files.removed }, 200, headers);
});
