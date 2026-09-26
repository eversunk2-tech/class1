// admin-create-member — 관리자가 새 계정(학생·교사)을 한 번에 여러 개 만든다.
// docs/admin/create-members/build-instructions.md + docs/classes/spec.md 개정 1(학급). 배포 방법은 같은 폴더의 README.md 참고.
//
// 요청:  POST { "rows": [{ "id": "60101", "password": "…", "role": "user" | "admin" }],
//                "source"?: "single" | "bulk", "classId"?: "<학급 uuid>" }
//        (Authorization: Bearer <호출자 access token> — supabase-js가 자동 첨부)
//        classId: 학생 줄(role "user")을 넣을 학급. 호출자가 담임인 학급만 된다(총괄도 자기 학급만 — 개정 1-1).
//                 보내지 않으면 호출자의 (보관 안 된) 학급이 하나일 때만 그 학급으로 넣고, 없거나 여럿이면 400.
// 응답:  200 { "results": [{ "index": 0, "id": "60101", "status": "created" | "exists" | "invalid" | "failed",
//                            "message"?: "…", "warning"?: "…" }],
//              "warning"?: "감사 로그를 남기지 못했습니다 …" }
//        401/403/400/405/413/500 { "error": "한국어 메시지" }
//        (학급 문제: 학급 없음·학급 고르기 필요·classId 형식 오류 = 400, 내 학급이 아님·보관된 학급 = 403)
//
// 보안 메모
// - 서비스 롤 키는 이 함수 안에서만 쓰고 응답에 포함하지 않는다.
// - **비밀번호는 응답·로그 어디에도 남기지 않는다.** console.error에도 아이디까지만 적는다(이메일·비밀번호 없음).
//   (createUser 실패 메시지는 GoTrue가 만든 문구라 비밀번호를 담지 않는다. 그래도 길이만 검사하고 값은 찍지 않는다.)
// - 호출자가 관리자인지 함수 안에서 확인한다(화면 가드를 믿지 않는다).
// - 학급 권한(개정 1-1·1-4): 학생 줄은 호출자가 담임인 학급(class_teachers)에만, 교사 줄(role "admin")은 총괄
//   (profiles.role 'admin' + is_super_admin)만 — 교사 계정에는 학급이 없다(class_id null).
//   총괄이 아닌 교사가 보낸 교사 줄은 그 줄만 "invalid"(사유 포함)로 돌려주고 나머지 줄은 만든다.
//   서비스 롤에는 auth.uid()가 없어 DB 함수 is_super_admin()/teaches_student()를 부를 수 없으므로,
//   서비스 롤로 profiles · class_teachers · classes 를 직접 읽어 같은 규칙으로 판단한다.
// - 계정 생성은 auth admin API, 역할·강제 변경 플래그·학급은 service_role의 profiles UPDATE로 처리한다
//   (20260921000000의 revoke는 anon/authenticated 대상이라 service_role에는 영향이 없다).
//   profiles.class_id 가 바뀌면 DB 트리거(20260927000000)가 member_directory.class_id 에도 복사한다.
// - 감사 로그(member_create_log)는 20260923030000_member_create_log.sql이 필요하다.
//   **그 SQL을 실행하지 않아도 계정 생성은 그대로 동작한다** — 로그만 못 남기고 응답에 warning을 붙인다(review M1).
// - 학급 SQL(20260927000000_classes_schema.sql)이 없으면 계정을 만들지 않고 "DB 설정 필요"로 거부한다(500).
//
// 동작
//   ① 호출자 확인(JWT) → ② 관리자·총괄 확인 → ③ 입력 검사(행별) → ③-2 교사 줄 권한 → ③-3 학생 줄 학급 확인 →
//   ④ 행마다 auth.admin.createUser({ email_confirm: true }) →
//   ⑤ 트리거(handle_new_user)가 만든 profiles 행에 role + must_change_password = true + class_id 반영 →
//   ⑥ 만들어진 계정 1개당 감사 로그 1행(admin_log_member_create RPC, 서비스 롤 전용).
//   부분 실패를 허용한다: 성공한 행은 그대로 두고 실패 행만 사유와 함께 돌려준다.

import { createClient } from "npm:@supabase/supabase-js@2";

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

// ─────────────────────────────────────────────
// 규격 (화면 쪽 src/lib/member-import.ts 와 반드시 같은 규칙)
// ─────────────────────────────────────────────
const LOGIN_EMAIL_DOMAIN = "class1.local"; // src/lib/auth.ts 의 LOGIN_EMAIL_DOMAIN 과 같아야 한다.
const MIN_PASSWORD_LENGTH = 6; // Supabase Auth 기본 최소 길이
const MAX_PASSWORD_BYTES = 72; // bcrypt 한계. 넘으면 GoTrue가 거부한다.
const MAX_ROWS = 100; // 한 번에 보낼 수 있는 행 수
const MAX_BODY_BYTES = 128 * 1024; // 본문 크기 제한(넉넉히 잡아도 100행이면 수 KB)
const ID_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/; // 소문자로 바꾼 뒤 검사
const ID_MIN = 2;
const ID_MAX = 30;

type Role = "user" | "admin";
type RowInput = { id: string; password: string; role: Role };
type RowResult = {
  index: number;
  id: string;
  status: "created" | "exists" | "invalid" | "failed";
  message?: string;
  warning?: string;
};

function toEmail(id: string): string {
  const trimmed = id.trim();
  return (trimmed.includes("@") ? trimmed : `${trimmed}@${LOGIN_EMAIL_DOMAIN}`).toLowerCase();
}

/** 한 행을 검사한다. 통과하면 null, 아니면 학생/교사가 무엇을 고쳐야 하는지 알려 주는 한국어 문구. */
function validateRow(raw: unknown): { row: RowInput; email: string } | string {
  if (!raw || typeof raw !== "object") return "행 형식이 올바르지 않습니다.";
  const r = raw as { id?: unknown; password?: unknown; role?: unknown };

  if (typeof r.id !== "string") return "아이디가 없습니다.";
  const id = r.id.trim().toLowerCase();
  if (!id) return "아이디가 비어 있습니다.";
  if (id.includes("@")) {
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(id)) return "이메일 형식이 올바르지 않습니다.";
  } else {
    if (id.length < ID_MIN || id.length > ID_MAX) return `아이디는 ${ID_MIN}~${ID_MAX}자로 적어 주세요.`;
    if (!ID_RE.test(id)) return "아이디에는 영문 소문자·숫자와 . _ - 만 쓸 수 있습니다(한글·공백 불가).";
  }

  if (typeof r.password !== "string") return "비밀번호가 없습니다.";
  const password = r.password;
  if (!password) return "비밀번호가 비어 있습니다.";
  if (password !== password.trim()) return "비밀번호 앞뒤에 공백이 있습니다.";
  if (password.length < MIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "비밀번호가 너무 깁니다(72바이트 이하).";

  const role = r.role;
  if (role !== "user" && role !== "admin") return "역할은 학생 또는 교사여야 합니다.";

  return { row: { id, password, role }, email: toEmail(id) };
}

/** 감사 로그용 SQL(20260923030000)이 아직 실행되지 않아 난 오류인지. */
function isMissingLogSql(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (["PGRST202", "42883", "PGRST205", "42P01"].includes(code)) return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("could not find the function") || m.includes("could not find the table") ||
    /(function|relation) .* does not exist/.test(m);
}

const MISSING_LOG_SQL_WARNING =
  "계정은 만들었지만 '누가 언제 만들었는지' 기록은 남지 않았습니다. " +
  "Supabase SQL Editor에서 20260923030000_member_create_log.sql을 실행하면 다음부터 기록됩니다.";

// ─────────────────────────────────────────────
// 학급(반) — docs/classes/spec.md 개정 1-1·1-4
// 화면(src/lib/member-import.ts)은 400·403·500 본문의 한국어 error 문구를 그대로 보여 준다.
// ─────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MISSING_CLASSES_SQL_MESSAGE =
  "학급 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20260927000000_classes_schema.sql을 먼저 실행해 주세요.";
const TEACHER_ROW_SUPER_ONLY_MESSAGE = "교사 계정은 총괄 관리자만 만들 수 있습니다. 역할을 '학생'으로 바꿔 주세요.";
const NO_CLASS_MESSAGE = "먼저 학급을 개설해 주세요. 학급이 있어야 학생을 등록할 수 있습니다.";
const PICK_CLASS_MESSAGE = "학생을 등록할 학급을 골라 주세요.";
const BAD_CLASS_ID_MESSAGE = "학급 정보(classId)가 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.";
const NOT_MY_CLASS_MESSAGE = "선생님이 담임인 학급에만 학생을 등록할 수 있습니다.";
const ARCHIVED_CLASS_MESSAGE = "보관된 학급에는 학생을 등록할 수 없습니다. 다른 학급을 골라 주세요.";

/** 학급 SQL(20260927000000)이 아직 실행되지 않아 난 오류인지(열·표 없음). */
function isMissingClassesSql(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (["42703", "PGRST204", "42P01", "PGRST205"].includes(error.code ?? "")) return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("could not find the table") ||
    (m.includes("could not find the") && m.includes("column")) ||
    /(column|relation) .* does not exist/.test(m);
}

function isEmailExistsError(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists" || error.code === "user_already_exists") return true;
  const m = (error.message ?? "").toLowerCase();
  return /already (been )?registered|already exists|duplicate key/.test(m);
}

/** GoTrue 오류 메시지를 관리자가 알아볼 수 있는 한국어로. 비밀번호 값은 절대 넣지 않는다. */
function createErrorMessage(error: { code?: string; message?: string }): string {
  const code = error.code ?? "";
  const m = (error.message ?? "").toLowerCase();
  if (code === "weak_password" || m.includes("weak") || m.includes("pwned")) {
    return "비밀번호가 너무 쉬워 거부되었습니다. 다른 비밀번호로 바꿔 주세요.";
  }
  if (m.includes("password") && m.includes("at least")) return "비밀번호가 너무 짧습니다.";
  if (code === "validation_failed" || m.includes("invalid format") || m.includes("unable to validate email")) {
    return "아이디(이메일) 형식이 Supabase에서 거부되었습니다. 영문·숫자로 된 아이디를 사용해 주세요.";
  }
  if (code === "over_request_rate_limit" || m.includes("rate limit")) {
    return "요청이 너무 많습니다. 잠시 후 나머지를 다시 시도해 주세요.";
  }
  return `계정을 만들지 못했습니다. (${error.message ?? "알 수 없는 오류"})`;
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("admin-create-member: 환경변수가 설정되지 않았습니다.");
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
  const { data: callerProfile, error: profileErr } = await admin
    .from("profiles")
    .select("role,is_super_admin")
    .eq("id", callerId)
    .maybeSingle();
  if (profileErr) {
    if (isMissingClassesSql(profileErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 500, headers);
    console.error("admin-create-member: 관리자 확인 실패", profileErr.message);
    return json({ error: "관리자 권한을 확인하지 못했습니다." }, 500, headers);
  }
  if (callerProfile?.role !== "admin") return json({ error: "관리자만 사용할 수 있습니다." }, 403, headers);
  // 총괄 = role 'admin' + is_super_admin (DB 함수 is_super_admin()과 같은 규칙)
  const callerIsSuper = callerProfile?.is_super_admin === true;

  // ③ 입력 검사
  const bodyText = await req.text().catch(() => "");
  if (new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES) {
    return json({ error: "한 번에 보낸 내용이 너무 큽니다. 나눠서 만들어 주세요." }, 413, headers);
  }
  let body: unknown = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400, headers);
  }
  const rawSource = (body as { source?: unknown } | null)?.source;
  const source: "single" | "bulk" = rawSource === "single" || rawSource === "bulk" ? rawSource : "bulk";
  const rawClassId = (body as { classId?: unknown } | null)?.classId;
  const rawRows = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rawRows)) return json({ error: "만들 계정 목록(rows)이 없습니다." }, 400, headers);
  if (rawRows.length === 0) return json({ error: "만들 계정이 없습니다." }, 400, headers);
  if (rawRows.length > MAX_ROWS) {
    return json({ error: `한 번에 최대 ${MAX_ROWS}명까지 만들 수 있습니다. 나눠서 만들어 주세요.` }, 400, headers);
  }

  const results: RowResult[] = [];
  // 감사 로그 상태: 한 번 "SQL 미실행"이 확인되면 나머지 행에서는 시도하지 않는다(요청 낭비 방지).
  let logAvailable = true;
  let logWarning: string | null = null;
  const prepared: { index: number; row: RowInput; email: string }[] = [];
  const seen = new Set<string>();
  rawRows.forEach((raw, index) => {
    const checked = validateRow(raw);
    if (typeof checked === "string") {
      const rawId = typeof (raw as { id?: unknown })?.id === "string" ? String((raw as { id: string }).id).trim() : "";
      results.push({ index, id: rawId, status: "invalid", message: checked });
      return;
    }
    if (seen.has(checked.email)) {
      results.push({ index, id: checked.row.id, status: "invalid", message: "같은 아이디가 두 번 들어 있습니다." });
      return;
    }
    seen.add(checked.email);
    prepared.push({ index, row: checked.row, email: checked.email });
  });

  // ③-2 교사 줄(role "admin")은 총괄만 만든다(개정 1-4). 총괄이 아니면 그 줄만 거부하고 나머지는 계속 만든다.
  //      "invalid"로 돌려준다 — 다시 시도해도 같은 결과라 화면의 "다시 시도" 대상에서 빠진다.
  const allowed: typeof prepared = [];
  for (const p of prepared) {
    if (p.row.role === "admin" && !callerIsSuper) {
      results.push({ index: p.index, id: p.row.id, status: "invalid", message: TEACHER_ROW_SUPER_ONLY_MESSAGE });
    } else {
      allowed.push(p);
    }
  }

  // ③-3 학생 줄을 넣을 학급 확인(개정 1-1·1-4): 호출자가 담임인 학급만 — 총괄도 자기 학급만.
  //      계정을 하나라도 만들기 전에 확인한다(학급 문제면 아무 계정도 만들지 않는다).
  let classId: string | null = null;
  if (allowed.some((p) => p.row.role === "user")) {
    const { data: links, error: linkErr } = await admin
      .from("class_teachers")
      .select("class_id")
      .eq("teacher_id", callerId);
    if (linkErr) {
      if (isMissingClassesSql(linkErr)) return json({ error: MISSING_CLASSES_SQL_MESSAGE }, 500, headers);
      console.error("admin-create-member: 담임 학급 확인 실패", linkErr.message);
      return json({ error: "담임 학급을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
    }
    const myClassIds = ((links ?? []) as { class_id?: unknown }[])
      .map((l) => (typeof l.class_id === "string" ? l.class_id.toLowerCase() : ""))
      .filter((v) => v !== "");

    // 보관(archived_at)된 학급에는 새 학생을 넣지 않는다.
    let activeClassIds: string[] = [];
    if (myClassIds.length > 0) {
      const { data: classRows, error: classErr } = await admin
        .from("classes")
        .select("id,archived_at")
        .in("id", myClassIds);
      if (classErr) {
        console.error("admin-create-member: 학급 확인 실패", classErr.message);
        return json({ error: "학급 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
      }
      activeClassIds = ((classRows ?? []) as { id?: unknown; archived_at?: unknown }[])
        .filter((c) => typeof c.id === "string" && !c.archived_at)
        .map((c) => String(c.id).toLowerCase());
    }

    if (rawClassId === undefined || rawClassId === null || rawClassId === "") {
      // 화면이 학급을 보내지 않으면(학급 기능 전 화면 등) 학급이 하나일 때만 그 학급으로 넣는다(개정 1-2 "하나면 자동").
      if (activeClassIds.length === 1) classId = activeClassIds[0];
      else if (activeClassIds.length === 0) return json({ error: NO_CLASS_MESSAGE }, 400, headers);
      else return json({ error: PICK_CLASS_MESSAGE }, 400, headers);
    } else {
      if (typeof rawClassId !== "string" || !UUID_RE.test(rawClassId.trim())) {
        return json({ error: BAD_CLASS_ID_MESSAGE }, 400, headers);
      }
      const wanted = rawClassId.trim().toLowerCase();
      // 없는 학급과 남의 학급을 구분하지 않는다(다른 학급 id를 알아내는 데 쓰이지 않게).
      if (!myClassIds.includes(wanted)) return json({ error: NOT_MY_CLASS_MESSAGE }, 403, headers);
      if (!activeClassIds.includes(wanted)) return json({ error: ARCHIVED_CLASS_MESSAGE }, 403, headers);
      classId = wanted;
    }
  }

  // ④~⑤ 한 행씩 만든다(부분 실패 허용). 순서를 지켜야 진행 표시가 자연스럽고, GoTrue 부하도 적다.
  for (const { index, row, email } of allowed) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: row.password,
      email_confirm: true,
      user_metadata: { full_name: row.id },
    });

    if (createErr) {
      if (isEmailExistsError(createErr as { code?: string; message?: string; status?: number })) {
        results.push({ index, id: row.id, status: "exists", message: "이미 있는 아이디입니다." });
      } else {
        // 아이디까지만 남긴다(비밀번호는 절대 로그에 남기지 않는다).
        console.error(`admin-create-member: 생성 실패 [${row.id}]`, createErr.message);
        results.push({ index, id: row.id, status: "failed", message: createErrorMessage(createErr) });
      }
      continue;
    }

    const newId = created?.user?.id;
    if (!newId) {
      console.error(`admin-create-member: 생성 응답에 사용자 id가 없습니다 [${row.id}]`);
      results.push({ index, id: row.id, status: "failed", message: "계정을 만들었지만 응답을 확인하지 못했습니다." });
      continue;
    }

    // 트리거 handle_new_user 가 같은 트랜잭션에서 profiles 행을 만들어 두었다.
    // 여기서 역할 · "첫 로그인 때 비밀번호 변경" 플래그 · 학급을 덮어쓴다(service_role은 RLS·컬럼 권한 제한을 받지 않는다).
    // 학생은 ③-3에서 확인한 학급, 교사는 학급 없음(개정 1-4). class_id 는 DB 트리거가 member_directory 에도 복사한다.
    const profilePatch = {
      role: row.role,
      must_change_password: true,
      class_id: row.role === "user" ? classId : null,
    };
    let { error: profileUpdateErr } = await admin.from("profiles").update(profilePatch).eq("id", newId);
    if (profileUpdateErr) {
      // 한 번만 다시 시도한다 — 학생이 학급 없이 남으면 담임의 회원 명단에 보이지 않는다.
      ({ error: profileUpdateErr } = await admin.from("profiles").update(profilePatch).eq("id", newId));
    }

    // ⑥ 감사 로그(만들어진 계정 1개당 1행). 실패해도 **계정 생성은 그대로 둔다**(review M1).
    //    profiles UPDATE가 실패했다면 실제 역할은 기본값 'user'이므로 그대로 기록한다(있는 그대로 남긴다).
    if (logAvailable) {
      const loggedRole = profileUpdateErr ? "user" : row.role;
      const { error: logErr } = await admin.rpc("admin_log_member_create", {
        p_target: newId,
        p_actor: callerId,
        p_role: loggedRole,
        p_source: source,
      });
      if (logErr) {
        // 비밀번호는 로그에 남기지 않는다(아이디까지만).
        console.error(`admin-create-member: 감사 로그 실패 [${row.id}]`, logErr.message);
        if (isMissingLogSql(logErr)) {
          logAvailable = false;
          logWarning = MISSING_LOG_SQL_WARNING;
        } else if (!logWarning) {
          logWarning = `계정은 만들었지만 생성 기록(감사 로그)을 남기지 못했습니다. (${logErr.message})`;
        }
      }
    }

    if (profileUpdateErr) {
      console.error(`admin-create-member: 프로필 설정 실패 [${row.id}]`, profileUpdateErr.message);
      results.push({
        index,
        id: row.id,
        status: "created",
        warning:
          row.role === "admin"
            ? "계정은 만들었지만 교사(관리자) 지정과 '첫 로그인 시 비밀번호 변경' 설정에 실패했습니다. 회원 관리에서 직접 지정해 주세요."
            : "계정은 만들었지만 학급 배정과 '첫 로그인 시 비밀번호 변경' 설정에 실패했습니다. " +
              "이 학생이 회원 명단에 보이지 않으면 총괄 관리자에게 알려 주세요.",
      });
      continue;
    }

    results.push({ index, id: row.id, status: "created" });
  }

  results.sort((a, b) => a.index - b.index);
  return json(logWarning ? { results, warning: logWarning } : { results }, 200, headers);
});
