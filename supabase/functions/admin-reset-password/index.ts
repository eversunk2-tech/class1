// admin-reset-password — 관리자가 이메일(아이디) 계정의 비밀번호를 임시 비밀번호로 초기화한다.
// docs/admin/spec.md §5. 배포 방법은 같은 폴더의 README.md 참고.
//
// 요청:  POST { "userId": "<auth.users id>" }  (Authorization: Bearer <호출자 access token> — supabase-js가 자동 첨부)
// 응답:  200 { "tempPassword": "..." }
//        401/403/400/404/405/500 { "error": "한국어 메시지" }
//
// 보안 메모
// - 관리자 계정(자기 자신 포함)은 초기화할 수 없다. 다른 관리자를 초기화하려면 먼저 관리자 해제를 한다(review #2).
// - 순서: ① 비밀번호 변경 → (DB 트리거 on_auth_user_password_changed가 must_change_password를 false로 만듦)
//         ② admin_finalize_password_reset RPC(서비스 롤 전용): must_change_password = true + 기존 세션 삭제 + 감사 로그.
//   ②가 ① 뒤에 오므로 초기화 직후 플래그는 항상 true다(20260922000000_admin_learning_fixes.sql 참고).
// - 임시 비밀번호는 응답 본문에만 담고 절대 로그로 남기지 않는다.
// - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입한다.
// - 서비스 롤 키는 이 함수 안에서만 쓰이고 응답에 포함되지 않는다.

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

// 혼동되는 글자(0/O/o, 1/l/I/i) 제외
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;
const TEMP_PASSWORD_LENGTH = 14;

/** 0 이상 max 미만의 균일한 난수(모듈로 편향 없이 거절 샘플링). */
function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  const buf = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** 대문자·소문자·숫자를 각각 1자 이상 포함한 임시 비밀번호. */
function randomTempPassword(): string {
  const chars = [UPPER, LOWER, DIGITS].map((set) => set[randomIndex(set.length)]);
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(ALL[randomIndex(ALL.length)]);
  // Fisher–Yates 셔플로 필수 글자의 위치를 섞는다.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("admin-reset-password: 환경변수가 설정되지 않았습니다.");
    return json({ error: "서버 설정 오류입니다. 관리자에게 문의하세요." }, 500, headers);
  }

  // ① 호출자 확인
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "로그인이 필요합니다." }, 401, headers);

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerErr } = await authClient.auth.getUser(jwt);
  if (callerErr || !callerData.user) return json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, 401, headers);
  const callerId = callerData.user.id;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ② 관리자 확인 (서비스 롤로 profiles.role 조회)
  const { data: callerProfile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  if (profileErr) {
    console.error("admin-reset-password: 관리자 확인 실패", profileErr.message);
    return json({ error: "관리자 권한을 확인하지 못했습니다." }, 500, headers);
  }
  if (callerProfile?.role !== "admin") return json({ error: "관리자만 사용할 수 있습니다." }, 403, headers);

  // ③ 대상 확인
  const body = await req.json().catch(() => null);
  const targetId = body && typeof body === "object" ? (body as { userId?: unknown }).userId : undefined;
  if (typeof targetId !== "string" || !UUID_RE.test(targetId)) {
    return json({ error: "초기화할 회원 정보(userId)가 올바르지 않습니다." }, 400, headers);
  }

  // 관리자 계정은 초기화 불가(관리자 간 계정 탈취 방지). 자기 자신도 관리자이므로 여기서 함께 막힌다.
  if (targetId === callerId) {
    return json({ error: "자기 자신의 비밀번호는 초기화할 수 없습니다. '비밀번호 변경' 메뉴를 이용하세요." }, 400, headers);
  }
  const { data: targetProfile, error: targetProfileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();
  if (targetProfileErr) {
    console.error("admin-reset-password: 대상 역할 확인 실패", targetProfileErr.message);
    return json({ error: "대상 계정 정보를 확인하지 못했습니다." }, 500, headers);
  }
  if (!targetProfile) return json({ error: "대상 계정을 찾을 수 없습니다." }, 404, headers);
  if (targetProfile.role === "admin") {
    return json(
      { error: "관리자 계정의 비밀번호는 초기화할 수 없습니다. 먼저 관리자 권한을 해제한 뒤 다시 시도하세요." },
      403,
      headers,
    );
  }

  const { data: target, error: targetErr } = await admin.auth.admin.getUserById(targetId);
  if (targetErr || !target?.user) return json({ error: "대상 계정을 찾을 수 없습니다." }, 404, headers);

  const appMeta = (target.user.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const providers = Array.isArray(appMeta.providers) ? appMeta.providers.filter((p): p is string => typeof p === "string") : [];
  const hasEmailLogin =
    providers.includes("email") ||
    appMeta.provider === "email" ||
    (target.user.identities ?? []).some((i) => i.provider === "email");
  if (!hasEmailLogin || !target.user.email) {
    return json({ error: "OAuth(GitHub·Google) 전용 계정은 비밀번호를 초기화할 수 없습니다." }, 400, headers);
  }

  // ④ 비밀번호 변경
  const tempPassword = randomTempPassword();
  const { error: updateErr } = await admin.auth.admin.updateUserById(targetId, { password: tempPassword });
  if (updateErr) {
    // 오류 메시지에는 비밀번호가 포함되지 않는다. 비밀번호 자체는 절대 로그로 남기지 않는다.
    console.error("admin-reset-password: 비밀번호 변경 실패", updateErr.message);
    return json({ error: "비밀번호를 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
  }

  // ⑤ 다음 로그인 때 새 비밀번호를 설정하도록 플래그를 켜고, 기존 세션을 끊고, 감사 로그를 남긴다(한 트랜잭션).
  //    반드시 ④ 뒤에 호출한다(④의 비밀번호 변경 트리거가 플래그를 false로 만들기 때문).
  const { data: revoked, error: finalizeErr } = await admin.rpc("admin_finalize_password_reset", {
    p_target: targetId,
    p_actor: callerId,
  });
  if (finalizeErr) {
    // 비밀번호는 이미 바뀌었으므로 임시 비밀번호는 돌려주되, 후속 처리가 되지 않았음을 알린다.
    console.error("admin-reset-password: 초기화 마무리(admin_finalize_password_reset) 실패", finalizeErr.message);
    return json(
      {
        tempPassword,
        warning:
          "비밀번호는 바뀌었지만 '다음 로그인 시 변경' 설정과 기존 로그인 해제에 실패했습니다. " +
          "20260922000000_admin_learning_fixes.sql이 실행됐는지 확인한 뒤 다시 초기화해 주세요.",
      },
      200,
      headers,
    );
  }
  if (revoked === -1) {
    console.error("admin-reset-password: 기존 세션 정리 실패(auth 스키마 권한 확인 필요)");
    return json(
      { tempPassword, warning: "비밀번호는 바뀌었지만 이미 로그인된 기기의 로그인을 해제하지 못했습니다." },
      200,
      headers,
    );
  }

  return json({ tempPassword }, 200, headers);
});
