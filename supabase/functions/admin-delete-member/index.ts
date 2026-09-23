// admin-delete-member — 관리자가 학생 계정을 완전히 탈퇴(삭제)시킨다.
// docs/admin/admin-tools/spec.md §1 + "개정 1". 배포 방법은 같은 폴더의 README.md 참고.
//
// 요청:  POST { "userId": "<auth.users id>" }  (Authorization: Bearer <호출자 access token> — supabase-js가 자동 첨부)
// 응답:  200 { "ok": true, "withdrawnAt": "...", "alreadyDeleted"?: true, "warning"?: "..." }
//        401/403/400/404/405/500 { "error": "한국어 메시지" }
//
// 보안·동작 메모
// - 관리자 계정(자기 자신 포함)은 탈퇴시킬 수 없다. 다른 관리자를 지우려면 먼저 관리자 권한을 해제한다.
// - 되돌릴 수 없다: auth.users 행을 실제로 지운다(복구 기능 없음). 화면에서 이름 재입력으로 한 번 더 확인한다.
// - 학습 기록은 남는다: 20260923000000_member_withdrawal.sql 이 profiles ↛ auth.users 외래키를 끊고
//   app_progress 를 profiles 참조로 옮겨 두었다. 그 SQL을 실행하지 않고 이 함수를 쓰면
//   계정과 함께 기록이 지워지므로, 아래 ④에서 withdrawn_at 컬럼 존재를 먼저 확인하고 없으면 거부한다.
// - 순서: ④ 사전 점검 → ⑤ auth.users 삭제 → ⑥ admin_finalize_withdrawal RPC(플래그 + 감사 로그).
//   ⑥이 실패해도 계정은 이미 지워졌으므로 warning 을 돌려주고, 관리자가 다시 누르면 ⑤는
//   "이미 없음"으로 통과하고 ⑥만 다시 실행된다(멱등).
// - SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY는 Supabase가 자동으로 주입한다.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://eversunk2-tech.github.io", "http://localhost:3000"]);

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

const MISSING_SQL_MESSAGE =
  "탈퇴 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 " +
  "20260923000000_member_withdrawal.sql을 먼저 실행해 주세요. (그 전에 계정을 지우면 학습 기록까지 사라집니다.)";

/** 대상이 이미 없을 때 나는 오류인지(재시도를 멱등하게 만들기 위해). */
function isUserNotFound(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.status === 404) return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("user not found") || m.includes("not_found") || m.includes("does not exist");
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("admin-delete-member: 환경변수가 설정되지 않았습니다.");
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

  // ② 관리자 확인 (서비스 롤로 profiles.role 조회)
  const { data: callerProfile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();
  if (profileErr) {
    console.error("admin-delete-member: 관리자 확인 실패", profileErr.message);
    return json({ error: "관리자 권한을 확인하지 못했습니다." }, 500, headers);
  }
  if (callerProfile?.role !== "admin") return json({ error: "관리자만 사용할 수 있습니다." }, 403, headers);

  // ③ 대상 확인
  const body = await req.json().catch(() => null);
  const targetId = body && typeof body === "object" ? (body as { userId?: unknown }).userId : undefined;
  if (typeof targetId !== "string" || !UUID_RE.test(targetId)) {
    return json({ error: "탈퇴 처리할 회원 정보(userId)가 올바르지 않습니다." }, 400, headers);
  }
  if (targetId === callerId) {
    return json({ error: "자기 자신의 계정은 탈퇴 처리할 수 없습니다." }, 400, headers);
  }

  // withdrawn_at 컬럼까지 함께 읽어, 마이그레이션이 실행됐는지도 여기서 확인한다.
  const { data: targetProfile, error: targetProfileErr } = await admin
    .from("profiles")
    .select("role,withdrawn_at")
    .eq("id", targetId)
    .maybeSingle();
  if (targetProfileErr) {
    // 42703 / PGRST204: withdrawn_at 컬럼 없음 = 마이그레이션 미실행 → 절대 계정을 지우지 않는다.
    const code = (targetProfileErr as { code?: string }).code ?? "";
    const msg = (targetProfileErr.message ?? "").toLowerCase();
    if (code === "42703" || code === "PGRST204" || msg.includes("withdrawn_at")) {
      return json({ error: MISSING_SQL_MESSAGE }, 400, headers);
    }
    console.error("admin-delete-member: 대상 확인 실패", targetProfileErr.message);
    return json({ error: "대상 계정 정보를 확인하지 못했습니다." }, 500, headers);
  }
  if (!targetProfile) return json({ error: "대상 계정을 찾을 수 없습니다." }, 404, headers);
  if (targetProfile.role === "admin") {
    return json(
      { error: "관리자 계정은 탈퇴 처리할 수 없습니다. 먼저 관리자 권한을 해제한 뒤 다시 시도하세요." },
      403,
      headers,
    );
  }

  // ④ 마이그레이션 확인: 탈퇴 마무리 RPC가 있어야 한다(없으면 기록만 남기지 못한 채 계정이 사라진다).
  //    존재 확인용으로 일부러 잘못된 인자(null)를 넣어 "함수 없음"만 가려낸다.
  const probe = await admin.rpc("admin_finalize_withdrawal", { p_target: null, p_actor: null });
  if (probe.error) {
    const code = (probe.error as { code?: string }).code ?? "";
    const msg = (probe.error.message ?? "").toLowerCase();
    if (code === "PGRST202" || code === "42883" || msg.includes("could not find the function")) {
      return json({ error: MISSING_SQL_MESSAGE }, 400, headers);
    }
    // 그 밖의 오류(missing arguments 등)는 함수가 있다는 뜻이므로 계속 진행한다.
  }

  // ④-2 안전장치: 계정을 지우면 기록이 사라지거나 삭제가 막히는 외래키가 남아 있는지 확인한다(review S3).
  //     확인하지 못하면 "안전하다"고 가정하지 않고 거부한다(fail closed) — 기록을 잃는 것보다 못 지우는 편이 낫다.
  const guard = await admin.rpc("withdrawal_blocking_fks");
  if (guard.error) {
    const gcode = (guard.error as { code?: string }).code ?? "";
    const gmsg = (guard.error.message ?? "").toLowerCase();
    if (gcode === "PGRST202" || gcode === "42883" || gmsg.includes("could not find the function")) {
      return json({ error: MISSING_SQL_MESSAGE }, 400, headers);
    }
    console.error("admin-delete-member: 안전장치 확인 실패", guard.error.message);
    return json({ error: "안전 점검을 하지 못해 탈퇴를 중단했습니다. 잠시 후 다시 시도해 주세요." }, 500, headers);
  }
  const blocking = Array.isArray(guard.data) ? (guard.data as unknown[]).filter((v): v is string => typeof v === "string") : [];
  if (blocking.length > 0) {
    console.error("admin-delete-member: 위험한 외래키가 남아 탈퇴를 거부했습니다", blocking.join(" / "));
    return json(
      {
        error:
          "지금 계정을 지우면 학생이 올린 파일·기록이 함께 사라지거나 삭제가 거부됩니다. " +
          "20260923000000_member_withdrawal.sql을 다시 실행한 뒤 실행 로그(Notices)를 확인해 주세요. " +
          `(문제되는 외래키: ${blocking.join(" / ")})`,
      },
      400,
      headers,
    );
  }

  // ⑤ 계정 삭제(되돌릴 수 없음). 이미 지워진 계정이면 그대로 진행해 ⑥만 다시 실행한다.
  let alreadyDeleted = false;
  const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId);
  if (deleteErr) {
    if (isUserNotFound(deleteErr as { message?: string; status?: number })) {
      alreadyDeleted = true;
    } else {
      console.error("admin-delete-member: 계정 삭제 실패", deleteErr.message);
      return json(
        {
          error:
            "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요. " +
            "계속 실패하면 20260923000000_member_withdrawal.sql이 실행됐는지 확인해 주세요. " +
            `(원인: ${deleteErr.message})`,
        },
        500,
        headers,
      );
    }
  }

  // ⑥ 탈퇴 표시 + 감사 로그(서비스 롤 전용 RPC). 같은 회원을 다시 호출해도 안전하다.
  const { data: withdrawnAt, error: finalizeErr } = await admin.rpc("admin_finalize_withdrawal", {
    p_target: targetId,
    p_actor: callerId,
  });
  if (finalizeErr) {
    console.error("admin-delete-member: 탈퇴 마무리 실패", finalizeErr.message);
    return json(
      {
        ok: true,
        alreadyDeleted,
        warning:
          "계정은 삭제했지만 '탈퇴한 학생' 표시와 탈퇴 기록을 남기지 못했습니다. " +
          "목록에는 아직 정상 회원으로 보일 수 있습니다. " +
          "같은 학생에게 '탈퇴 처리'를 한 번 더 실행하면 표시만 다시 시도합니다.",
      },
      200,
      headers,
    );
  }

  return json({ ok: true, withdrawnAt: withdrawnAt ?? null, alreadyDeleted }, 200, headers);
});
