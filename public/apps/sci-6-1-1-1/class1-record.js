/*
 * class1-record.js — 웹앱 학습 결과 기록 헬퍼 (정본 템플릿)
 * ─────────────────────────────────────────────────────────────
 * 이 파일은 저장소 안의 "정본"이다(브라우저에 서빙되지 않음). 새 웹앱을 만들 때
 * public/apps/{앱이름}/class1-record.js 로 그대로 복사해서 쓴다(CLAUDE.md 웹앱 규칙 — 앱은 폴더 안에서 자체 완결).
 * 헬퍼를 고치면 이 파일을 먼저 고치고, 이미 만든 앱 폴더에 다시 복사한다.
 *
 * ▶ 무엇을 하나
 *   로그인한 학생의 웹앱 결과(점수 · 완료 여부 · 소요 시간 · 자유 기록)를 Supabase `app_results` 테이블에 1건 저장한다.
 *   저장된 결과는 블로그의 "내 학습 활동"(학생)과 "학습 현황"(선생님)에서 볼 수 있다.
 *   점수는 브라우저가 보내는 값이라 조작될 수 있다 → 성적이 아니라 "참여 확인" 용도로만 쓴다.
 *
 * ▶ 로그인 공유
 *   웹앱(/class1/apps/{앱}/)은 블로그(/class1/)와 같은 출처라서, 블로그에서 로그인하면 여기서도 로그인 상태다.
 *   supabase-js는 세션을 localStorage의 `sb-{프로젝트ref}-auth-token` 키에 저장한다(블로그 src/lib/supabase.ts도 기본값 사용).
 *   → 반드시 블로그와 **같은 SUPABASE_URL**을 쓰고, createClient에 storageKey를 따로 지정하지 않는다.
 *   로그인하지 않았으면 저장하지 않고 { ok: false, reason: "not_logged_in" }을 돌려준다.
 *
 * ▶ ⚠ 보안 경고 — 같은 출처의 모든 스크립트가 로그인 토큰을 읽을 수 있다
 *   로그인 세션(access/refresh token)이 localStorage에 있으므로, /class1/apps/* 안의 모든 스크립트(CDN 스크립트 포함)와
 *   같은 출처(eversunk2-tech.github.io)의 다른 저장소 페이지도 이 토큰을 읽을 수 있다. 관리자로 로그인한 상태라면
 *   관리자 토큰이 노출된다. 그래서:
 *   - 신뢰할 수 있는 앱만 public/apps/에 넣는다(출처를 모르는 코드·광고·분석 스크립트를 붙이지 않는다).
 *   - 앱이 쓰는 CDN 스크립트는 모두 정확한 버전 고정 + SRI(integrity) + crossorigin="anonymous"로 불러온다.
 *   - 관리자 계정으로 로그인한 브라우저에서는 신뢰하지 않는 앱이나 같은 출처의 다른 페이지를 열지 않는다
 *     (확인이 필요하면 학생 테스트 계정이나 로그아웃 상태로 연다).
 *
 * ▶ index.html 에서 불러오는 순서 (supabase-js CDN → config.js → class1-record.js → 앱 코드)
 *
 *   <!-- supabase-js v2 UMD. 정확한 버전 고정 + SRI. 버전을 올리면 integrity도 다시 계산한다:
 *        curl -s <src> | openssl dgst -sha384 -binary | openssl base64 -A -->
 *   <script
 *     src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js"
 *     integrity="sha384-iLddHTLokph6Omwoyid4XKxHaWa6w41BnoEj0q5oOrzmYPpHIKt1wyjReA7s//pP"
 *     crossorigin="anonymous"
 *   ></script>
 *   <script src="./config.js"></script>          <!-- window.CLASS1_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY } -->
 *   <script src="./class1-record.js"></script>
 *   <script src="./app.js"></script>
 *
 *   ※ 파일 참조는 상대경로(./)만 쓴다. `/`로 시작하는 절대경로 금지.
 *
 * ▶ 사용 예시 (app.js)
 *
 *   Class1Record.init({
 *     url: window.CLASS1_CONFIG.SUPABASE_URL,
 *     anonKey: window.CLASS1_CONFIG.SUPABASE_ANON_KEY,
 *     appId: "multiplication-quiz", // public/apps/{앱이름}/ 폴더명과 똑같이. src/data/apps.ts의 id와도 같아야 한다.
 *   });
 *
 *   // 시작할 때: 로그인 안내 보여 주기
 *   Class1Record.getUser().then(function (user) {
 *     if (!user) Class1Record.renderLoginHint(document.getElementById("login-hint"));
 *   });
 *
 *   // 게임/퀴즈가 끝났을 때
 *   var startedAt = Date.now();
 *   // ... 문제 풀이 ...
 *   Class1Record.save({
 *     score: 8,                 // 점수(선택) — 점수 개념이 없으면 생략
 *     maxScore: 10,             // 만점(선택)
 *     completed: true,          // 끝까지 했는지(선택, 기본 false)
 *     durationSec: Math.round((Date.now() - startedAt) / 1000), // 걸린 시간(초, 선택)
 *     detail: { wrong: [2, 5], level: "쉬움" }, // 자유 기록(선택, JSON으로 바뀔 수 있는 값만, 약 16KB 이하)
 *   }).then(function (res) {
 *     if (res.ok) showMessage("결과를 저장했어요!");
 *     else if (res.reason === "not_logged_in") showMessage("로그인하면 결과가 저장돼요.");
 *     else showMessage("결과를 저장하지 못했어요.");
 *   });
 *
 * ▶ API
 *   Class1Record.init({ url, anonKey, appId })  → 한 번만 호출. 잘못된 값이면 오류를 던진다.
 *   Class1Record.getUser()                       → Promise<User | null> (로그인 사용자, 없으면 null)
 *   Class1Record.save(result)                    → Promise<{ ok: true, id } | { ok: false, reason, message }>
 *        reason: "not_initialized" | "not_logged_in" | "invalid" | "error"
 *   Class1Record.loginUrl()                      → "../../login/?next=/apps/{앱}/" (앱 폴더 기준 블로그 로그인 페이지,
 *                                                  로그인 후 이 앱(블로그 화면 안에서 열렸으면 그 화면)으로 돌아온다)
 *   Class1Record.renderLoginHint(element, text?) → element 안에 "로그인하면 결과가 저장돼요" 문구 + 로그인 링크를 넣는다.
 *
 * ▶ 로그인 확인 · 진행 상황(app_progress, 학생 × 앱 1행 — 20260922010000_app_progress.sql)
 *   과학 차시 앱은 공통 틀(science-sim|science-guide/persist.js의 SciSim.Sync)이 아래 함수를 대신 부른다.
 *   오류는 던지지 않고 결과 객체로 돌려준다.
 *   Class1Record.peekSession()        → { userId, accessToken, expiresAt, label } | null  (localStorage만 동기로 읽음, 검증 전 값)
 *   Class1Record.requireUser()        → Promise<{ ok: true, user } | { ok: false, reason: "not_initialized" | "not_logged_in" | "offline" }>
 *        "offline": 토큰 갱신을 네트워크 문제로 못 함(로그아웃된 것이 아님 — 로컬 사본을 지우면 안 된다)
 *   ※ 아래 세 함수는 opts.expectedUserId(페이지의 기록 주인)를 받는다. 요청에 실제로 쓰는 토큰의 사용자(JWT sub)가 이 값과
 *     다르면 요청하지 않고 reason "user_changed"를 돌려준다(학생 A의 화면이 학생 B의 행을 읽거나 덮어쓰지 않게).
 *   Class1Record.loadProgress({ expectedUserId })   → Promise<{ ok: true, row: { state, updated_at } | null } | { ok: false, reason, message }>
 *   Class1Record.saveProgress(state, { expectedUserId, keepalive, baseUpdatedAt, force })
 *        → Promise<{ ok: true, updatedAt } | { ok: false, reason, message }>
 *        baseUpdatedAt: 마지막으로 맞춘 DB updated_at(서버 시각) — 그 뒤 DB가 바뀌었으면 덮어쓰지 않고 "conflict".
 *        null이면 "DB에 행이 없을 때만", force: true면 무조건 덮어쓰기(upsert). 기기 시계는 쓰지 않는다.
 *   Class1Record.clearProgress({ expectedUserId })  → Promise<{ ok: true } | { ok: false, reason, message }>
 *        reason: "not_initialized" | "not_logged_in" | "user_changed" | "conflict" | "no_table"(마이그레이션 전) | "too_large" | "offline" | "error"
 *   Class1Record.onAuthChange(fn)     → fn("signed_out") — 이 탭·다른 탭(블로그)에서 로그아웃/세션 만료
 *                                       fn("user_changed", userId) — 다른 탭에서 다른 사용자로 로그인
 *   Class1Record.flushLocalProgress({ prefix, confirmConflict })  → 로그아웃 직전: 이 기기의 "아직 안 올린" 과학 앱 기록
 *        (<storageKey>:__meta 의 dirty/pendingClear)을 지금 사용자(= 기록 주인일 때만)로 올린다 → { ok, reason, problems }
 *   Class1Record.signOut()            → 로그아웃(오프라인이어도 이 기기의 세션은 지운다)
 *   Class1Record.save(result)의 result.expectedUserId → 지금 사용자와 다르면 저장하지 않고 "user_changed"
 *
 * ▶ Edge Function 호출
 *   Class1Record.callFunction(name, body, { timeoutMs, expectedUserId })
 *        → Promise<{ ok: true, status, data } | { ok: false, reason, message }>
 *        reason: "not_initialized" | "invalid" | "not_logged_in" | "offline" | "user_changed" | "timeout" | "rate_limited" | "error"
 *        로그인 토큰을 붙여 POST한다(Verify JWT를 켠 함수용). 본문은 JSON, 응답도 JSON으로 읽는다.
 *        지금은 답 되짚기·차단(science-sim/answer-check.js → check-answer)이 쓴다.
 *
 * 외부 라이브러리는 supabase-js(CDN) 하나만 쓴다.
 */
(function () {
  "use strict";

  var LOGIN_PATH = "../../login/"; // /class1/apps/{앱}/ → /class1/login/
  var PROGRESS_MAX_BYTES = 262144; // app_progress_state_size 제약과 같게
  var KEEPALIVE_MAX_BYTES = 60000; // fetch keepalive 본문 한도(64KB)보다 작게
  var DETAIL_MAX_CHARS = 16000;
  var SHRINK_MARK = "…(길어서 줄임)";

  /** detail 사본에서 가장 긴 문자열을 반씩 줄여 JSON 길이를 한도 아래로 맞춘다. */
  function shrinkDetail(detail) {
    var copy = JSON.parse(JSON.stringify(detail));
    for (var guard = 0; guard < 200 && JSON.stringify(copy).length > DETAIL_MAX_CHARS; guard++) {
      var best = null;
      (function walk(node) {
        if (!node || typeof node !== "object") return;
        Object.keys(node).forEach(function (k) {
          var v = node[k];
          if (typeof v === "string") {
            if (!best || v.length > best.len) best = { obj: node, key: k, len: v.length };
          } else walk(v);
        });
      })(copy);
      if (!best || best.len <= 40) break;
      var s = best.obj[best.key].replace(SHRINK_MARK, "");
      best.obj[best.key] = s.slice(0, Math.floor(s.length / 2)) + SHRINK_MARK;
    }
    return copy;
  }

  var state = { client: null, appId: null, url: null, anonKey: null };

  function isFiniteNumber(v) {
    return typeof v === "number" && isFinite(v);
  }

  function fail(reason, message) {
    return { ok: false, reason: reason, message: message };
  }

  function init(options) {
    var o = options || {};
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("[class1-record] supabase-js를 먼저 불러와야 합니다(index.html의 script 순서 확인).");
    }
    if (!o.url || !o.anonKey) {
      throw new Error("[class1-record] url과 anonKey가 필요합니다(config.js 확인).");
    }
    if (typeof o.appId !== "string" || o.appId.length < 1 || o.appId.length > 100) {
      throw new Error("[class1-record] appId는 1~100자 문자열이어야 합니다(앱 폴더명과 같게).");
    }
    // storageKey를 지정하지 않는다 → 블로그와 같은 localStorage 세션(sb-{ref}-auth-token)을 읽는다.
    state.client = window.supabase.createClient(o.url, o.anonKey);
    state.appId = o.appId;
    state.url = String(o.url).replace(/\/$/, "");
    state.anonKey = o.anonKey;
    return window.Class1Record;
  }

  async function getUser() {
    if (!state.client) return null;
    try {
      // getSession은 localStorage만 읽어 빠르다. 저장 직전에는 서버가 토큰을 다시 검증한다(RLS).
      var res = await state.client.auth.getSession();
      var session = res && res.data ? res.data.session : null;
      return session ? session.user : null;
    } catch {
      return null;
    }
  }

  async function save(result) {
    if (!state.client) return fail("not_initialized", "Class1Record.init()을 먼저 호출하세요.");
    var r = result || {};

    var score = r.score == null ? null : r.score;
    var maxScore = r.maxScore == null ? null : r.maxScore;
    if (score !== null && !isFiniteNumber(score)) return fail("invalid", "score는 숫자여야 합니다.");
    if (maxScore !== null && !isFiniteNumber(maxScore)) return fail("invalid", "maxScore는 숫자여야 합니다.");

    var duration = r.durationSec == null ? null : r.durationSec;
    if (duration !== null) {
      if (!isFiniteNumber(duration) || duration < 0) return fail("invalid", "durationSec는 0 이상의 숫자여야 합니다.");
      duration = Math.round(duration);
    }

    var detail = r.detail == null ? {} : r.detail;
    var detailJson;
    try {
      detailJson = JSON.stringify(detail);
    } catch {
      return fail("invalid", "detail을 JSON으로 바꿀 수 없습니다.");
    }
    if (typeof detail !== "object" || Array.isArray(detail)) return fail("invalid", "detail은 객체여야 합니다.");
    if (detailJson.length > DETAIL_MAX_CHARS) {
      // 학생 글이 길어 한도를 넘으면 가장 긴 문자열부터 줄여서라도 저장한다(기록을 통째로 잃지 않게).
      detail = shrinkDetail(detail);
      detailJson = JSON.stringify(detail);
      if (detailJson.length > DETAIL_MAX_CHARS) return fail("invalid", "detail이 너무 큽니다.");
    }

    var user = await getUser();
    if (!user) return fail("not_logged_in", "로그인하면 결과가 저장돼요.");
    // 페이지의 기록 주인과 지금 로그인한 사람이 다르면 저장하지 않는다(다른 학생 이름으로 결과가 올라가지 않게).
    if (r.expectedUserId && user.id !== r.expectedUserId) return fail("user_changed", "다른 사람으로 로그인되어 있어요.");

    try {
      var res = await state.client
        .from("app_results")
        .insert({
          app_id: state.appId,
          user_id: user.id,
          score: score,
          max_score: maxScore,
          completed: !!r.completed,
          duration_seconds: duration,
          details: JSON.parse(detailJson),
        })
        .select("id")
        .single();
      if (res.error) {
        // 세션이 만료됐거나(401/42501) 테이블이 아직 없을 때 등
        var code = res.error.code || "";
        if (code === "42501" || code === "PGRST301") return fail("not_logged_in", "로그인이 만료됐어요. 다시 로그인해 주세요.");
        return fail("error", res.error.message || "저장하지 못했습니다.");
      }
      return { ok: true, id: res.data ? res.data.id : null };
    } catch (e) {
      return fail("error", (e && e.message) || "네트워크 오류로 저장하지 못했습니다.");
    }
  }

  /* ───────── 로그인 확인 · 진행 상황(app_progress) ───────── */

  /** supabase-js 기본 세션 키: sb-{프로젝트ref}-auth-token (블로그와 같음) */
  function tokenKey() {
    var url = state.url || (window.CLASS1_CONFIG && window.CLASS1_CONFIG.SUPABASE_URL);
    try {
      return "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token";
    } catch {
      return null;
    }
  }

  /** access token(JWT)의 sub = 서버(RLS)가 이 요청을 누구로 볼지. 읽지 못하면 null */
  function jwtSub(token) {
    try {
      var part = String(token).split(".")[1];
      var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = decodeURIComponent(
        Array.prototype.map
          .call(window.atob(b64), function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      var p = JSON.parse(json);
      return p && typeof p.sub === "string" ? p.sub : null;
    } catch {
      return null;
    }
  }

  /** 화면에 보여 줄 이름: 발급 계정(아이디@class1.local)은 아이디, 그 밖은 이메일·이름 */
  function userLabel(user) {
    if (!user) return "";
    var email = typeof user.email === "string" ? user.email : "";
    if (/@class1\.local$/i.test(email)) return email.replace(/@class1\.local$/i, "");
    var md = user.user_metadata || {};
    return email || md.name || md.full_name || md.user_name || "";
  }

  function parseSession(raw) {
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (s && s.currentSession) s = s.currentSession; // 옛 형식
      if (!s || !s.user || typeof s.user.id !== "string") return null;
      return { userId: s.user.id, accessToken: s.access_token || null, expiresAt: s.expires_at || 0, label: userLabel(s.user) };
    } catch {
      return null;
    }
  }

  /** localStorage의 세션을 동기로 읽는다(검증 전 값). 앱 화면을 그리기 전에 "기록 주인"을 판단할 때만 쓴다. */
  function peekSession() {
    var k = tokenKey();
    if (!k) return null;
    try {
      return parseSession(window.localStorage.getItem(k));
    } catch {
      return null;
    }
  }

  function isRetryable(err) {
    if (!err) return false;
    var n = err.name || "";
    var m = String(err.message || "").toLowerCase();
    return n === "AuthRetryableFetchError" || err.status === 0 || m.indexOf("failed to fetch") >= 0 || m.indexOf("network") >= 0;
  }

  async function requireUser() {
    if (!state.client) return fail("not_initialized", "Class1Record.init()을 먼저 호출하세요.");
    try {
      var res = await state.client.auth.getSession();
      var session = res && res.data ? res.data.session : null;
      if (session && session.user) return { ok: true, user: session.user };
      // 토큰 갱신을 네트워크 문제로 못 했고 세션이 아직 저장돼 있으면 "로그아웃"이 아니라 "오프라인"
      if (res && res.error && isRetryable(res.error) && peekSession()) return fail("offline", "인터넷에 연결할 수 없어요.");
      return fail("not_logged_in", "로그인이 필요해요.");
    } catch (e) {
      if (peekSession()) return fail("offline", (e && e.message) || "인터넷에 연결할 수 없어요.");
      return fail("not_logged_in", "로그인이 필요해요.");
    }
  }

  /**
   * 진행 상황 요청에 쓸 세션을 정한다. 요청에는 **여기서 확인한 이 토큰만** 쓴다(supabase-js가 요청 순간 다른 세션을 집어 가지 않게).
   * expectedUserId(페이지의 기록 주인)가 있으면 토큰의 sub가 같을 때만 통과 → 다르면 "user_changed"(다른 학생 행에 쓰지 않는다).
   */
  async function authFor(expectedUserId) {
    var u;
    try {
      var res = await state.client.auth.getSession();
      var session = res && res.data ? res.data.session : null;
      if (!session || !session.user || !session.access_token) {
        if (res && res.error && isRetryable(res.error) && peekSession()) return fail("offline", "인터넷에 연결할 수 없어요.");
        return fail("not_logged_in", "로그인이 필요해요.");
      }
      u = { token: session.access_token, userId: jwtSub(session.access_token) || session.user.id, user: session.user };
      if (u.userId !== session.user.id) return fail("user_changed", "로그인 정보가 맞지 않아요.");
    } catch (e) {
      if (peekSession()) return fail("offline", (e && e.message) || "인터넷에 연결할 수 없어요.");
      return fail("not_logged_in", "로그인이 필요해요.");
    }
    if (expectedUserId && u.userId !== expectedUserId) return fail("user_changed", "다른 사람으로 로그인되어 있어요.");
    u.ok = true;
    return u;
  }

  /** 페이지를 떠날 때(keepalive): 세션을 동기로 읽는다. 주인과 다르면 "user_changed", 쓸 수 없으면 null(일반 경로로) */
  function authSync(expectedUserId) {
    var peek = peekSession();
    if (!peek) return fail("not_logged_in", "로그인이 필요해요.");
    var sub = peek.accessToken ? jwtSub(peek.accessToken) : null;
    if (expectedUserId && (peek.userId !== expectedUserId || (sub && sub !== expectedUserId)))
      return fail("user_changed", "다른 사람으로 로그인되어 있어요.");
    if (!peek.accessToken || !sub || sub !== peek.userId || (peek.expiresAt && peek.expiresAt * 1000 < Date.now() + 5000)) return null;
    return { ok: true, token: peek.accessToken, userId: sub };
  }

  /**
   * Edge Function 호출(로그인 토큰 첨부). 실패는 던지지 않고 결과 객체로 돌려준다.
   * 개인정보는 body에 넣지 않는다(호출하는 쪽 책임).
   */
  async function callFunction(name, body, opts) {
    if (!state.client) return fail("not_initialized", "Class1Record.init()을 먼저 호출하세요.");
    if (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(name)) return fail("invalid", "함수 이름이 올바르지 않습니다.");
    var o = opts || {};
    var auth = await authFor(o.expectedUserId);
    if (!auth.ok) return auth;
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = o.timeoutMs && ctrl ? setTimeout(function () { ctrl.abort(); }, o.timeoutMs) : null;
    try {
      var r = await fetch(state.url + "/functions/v1/" + name, {
        method: "POST",
        headers: {
          apikey: state.anonKey,
          Authorization: "Bearer " + auth.token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body == null ? {} : body),
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined,
      });
      var text = await r.text();
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!r.ok) {
        if (r.status === 429) return fail("rate_limited", "잠시 뒤에 다시 시도해 주세요.");
        if (r.status === 401 || r.status === 403) return fail("not_logged_in", "로그인이 만료됐어요. 다시 로그인해 주세요.");
        return fail("error", (data && data.error) || "요청이 실패했어요(" + r.status + ").");
      }
      return { ok: true, status: r.status, data: data };
    } catch (e) {
      if (e && e.name === "AbortError") return fail("timeout", "응답이 늦어요.");
      return fail("offline", (e && e.message) || "인터넷에 연결할 수 없어요.");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** PostgREST/네트워크 오류 → reason */
  function progressError(err, status) {
    var code = (err && err.code) || "";
    var msg = (err && err.message) || "";
    if (code === "PGRST205" || code === "42P01" || status === 404 || /could not find the table|does not exist/i.test(msg))
      return fail("no_table", "진행 상황 저장 테이블(app_progress)이 아직 없어요.");
    if (code === "42501" || code === "PGRST301" || code === "PGRST303" || status === 401 || status === 403)
      return fail("not_logged_in", "로그인이 만료됐어요. 다시 로그인해 주세요.");
    if (code === "23514") return fail("too_large", "기록이 너무 커서 저장하지 못했어요.");
    if (code === "23505" || status === 409) return fail("conflict", "다른 기기에서 먼저 저장한 기록이 있어요.");
    if (isRetryable(err) || status === 0) return fail("offline", msg || "인터넷에 연결할 수 없어요.");
    return fail("error", msg || "저장하지 못했습니다.");
  }

  /** app_progress REST 요청(토큰을 직접 붙인다). → { ok, status, data } | 오류 결과 */
  function rest(method, query, token, opts) {
    var o = opts || {};
    var headers = { apikey: state.anonKey, Authorization: "Bearer " + token, Accept: "application/json" };
    if (o.body != null) headers["Content-Type"] = "application/json";
    if (o.prefer) headers.Prefer = o.prefer;
    var init = { method: method, headers: headers, cache: "no-store" };
    if (o.body != null) init.body = o.body;
    if (o.keepalive) init.keepalive = true;
    return fetch(state.url + "/rest/v1/app_progress?" + query, init)
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch {
            j = null;
          }
          if (!r.ok) return progressError(j, r.status);
          return { ok: true, status: r.status, data: j };
        });
      })
      .catch(function (e) {
        return progressError(e, 0);
      });
  }

  function eqq(v) {
    return "eq." + encodeURIComponent(v);
  }
  function rowFilter(userId, appId) {
    return "user_id=" + eqq(userId) + "&app_id=" + eqq(appId);
  }

  function byteLength(text) {
    try {
      return new Blob([text]).size;
    } catch {
      return text.length * 3;
    }
  }

  /** 키 순서와 상관없이 같은 값인지(jsonb는 객체 키 순서를 바꿔 저장한다) */
  function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object")
      return (
        "{" +
        Object.keys(v)
          .sort()
          .map(function (k) {
            return JSON.stringify(k) + ":" + canon(v[k]);
          })
          .join(",") +
        "}"
      );
    return JSON.stringify(v === undefined ? null : v);
  }
  function sameKeys(a, b) {
    return canon(a || {}) === canon(b || {});
  }

  async function loadFor(appId, auth) {
    var r = await rest("GET", "select=state,updated_at&" + rowFilter(auth.userId, appId), auth.token);
    if (!r.ok) return r;
    var row = Array.isArray(r.data) ? r.data[0] || null : r.data || null;
    return { ok: true, row: row };
  }

  /**
   * 저장(서버 시각 updated_at 기준 낙관적 잠금 — 기기 시계를 쓰지 않는다).
   *   force: 무조건 덮어쓰기(upsert) / baseUpdatedAt: 문자열이면 "DB가 그 뒤 안 바뀌었을 때만", null이면 "행이 없을 때만"
   *   → DB가 그 사이 바뀌었으면 { ok:false, reason:"conflict" } (조용히 덮어쓰지 않는다)
   */
  async function saveFor(appId, progressState, auth, opts) {
    var o = opts || {};
    var ka = !!o.keepalive;
    if (o.force || o.baseUpdatedAt === undefined) {
      var up = await rest("POST", "on_conflict=user_id,app_id&select=updated_at", auth.token, {
        body: JSON.stringify({ user_id: auth.userId, app_id: appId, state: progressState }),
        prefer: "resolution=merge-duplicates,return=representation",
        keepalive: ka,
      });
      if (!up.ok) return up;
      var d = Array.isArray(up.data) ? up.data[0] : up.data;
      return { ok: true, updatedAt: d && d.updated_at ? d.updated_at : null };
    }
    if (typeof o.baseUpdatedAt === "string" && o.baseUpdatedAt) {
      var pr = await rest("PATCH", rowFilter(auth.userId, appId) + "&updated_at=" + eqq(o.baseUpdatedAt) + "&select=updated_at", auth.token, {
        body: JSON.stringify({ state: progressState }),
        prefer: "return=representation",
        keepalive: ka,
      });
      if (!pr.ok) return pr;
      if (Array.isArray(pr.data) && pr.data.length) return { ok: true, updatedAt: pr.data[0].updated_at || null };
      if (ka) return fail("conflict", "다른 기기에서 먼저 저장한 기록이 있어요.");
      // 바뀐 행이 없음: DB 행이 사라졌거나(다른 기기에서 처음부터 다시) 다른 기기에서 바꿨다
      var cur = await loadFor(appId, auth);
      if (!cur.ok) return cur;
      if (cur.row) {
        if (cur.row.state && sameKeys(cur.row.state.keys, progressState.keys)) return { ok: true, updatedAt: cur.row.updated_at };
        return { ok: false, reason: "conflict", message: "다른 기기에서 먼저 저장한 기록이 있어요.", row: cur.row };
      }
    }
    var ins = await rest("POST", "select=updated_at", auth.token, {
      body: JSON.stringify({ user_id: auth.userId, app_id: appId, state: progressState }),
      prefer: "return=representation",
      keepalive: ka,
    });
    if (!ins.ok) return ins;
    var di = Array.isArray(ins.data) ? ins.data[0] : ins.data;
    return { ok: true, updatedAt: di && di.updated_at ? di.updated_at : null };
  }

  function checkState(progressState) {
    if (!progressState || typeof progressState !== "object" || Array.isArray(progressState))
      return { err: fail("invalid", "state는 객체여야 합니다.") };
    var json;
    try {
      json = JSON.stringify(progressState);
    } catch {
      return { err: fail("invalid", "state를 JSON으로 바꿀 수 없습니다.") };
    }
    if (byteLength(json) > PROGRESS_MAX_BYTES) return { err: fail("too_large", "기록이 너무 커서 저장하지 못했어요.") };
    return { json: json };
  }

  /** opts.expectedUserId: 페이지의 기록 주인. 지금 세션이 다른 사람이면 요청하지 않고 "user_changed" */
  async function loadProgress(opts) {
    if (!state.client) return fail("not_initialized", "Class1Record.init()을 먼저 호출하세요.");
    var auth = await authFor(opts && opts.expectedUserId);
    if (!auth.ok) return auth;
    return loadFor(state.appId, auth);
  }

  async function saveProgress(progressState, opts) {
    if (!state.client) return fail("not_initialized", "Class1Record.init()을 먼저 호출하세요.");
    var o = opts || {};
    var chk = checkState(progressState);
    if (chk.err) return chk.err;
    if (o.keepalive) {
      var sync = authSync(o.expectedUserId);
      if (sync && !sync.ok) {
        if (sync.reason === "user_changed") return sync;
      } else if (sync && byteLength(chk.json) + 200 <= KEEPALIVE_MAX_BYTES) {
        return saveFor(state.appId, progressState, sync, o);
      }
    }
    var auth = await authFor(o.expectedUserId);
    if (!auth.ok) return auth;
    return saveFor(state.appId, progressState, auth, { force: o.force, baseUpdatedAt: o.baseUpdatedAt });
  }

  async function clearProgress(opts) {
    if (!state.client) return fail("not_initialized", "Class1Record.init()을 먼저 호출하세요.");
    var auth = await authFor(opts && opts.expectedUserId);
    if (!auth.ok) return auth;
    var r = await rest("DELETE", rowFilter(auth.userId, state.appId), auth.token);
    return r.ok ? { ok: true } : r;
  }

  /* ───────── 로그아웃(블로그 src/lib/science-progress.ts · auth.ts signOut과 같은 절차) ───────── */

  var META_SUFFIX = ":__meta";
  function readJson(k) {
    try {
      return JSON.parse(window.localStorage.getItem(k) || "null");
    } catch {
      return null;
    }
  }
  /** 과학 앱 로컬 기록 목록: [{ root, metaKey, meta }] */
  function localApps(prefix) {
    var out = [];
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (!k || k.indexOf(prefix) !== 0 || k.slice(-META_SUFFIX.length) !== META_SUFFIX) continue;
        var m = readJson(k);
        if (m && typeof m === "object") out.push({ root: k.slice(0, -META_SUFFIX.length), metaKey: k, meta: m });
      }
    } catch {
      /* 무시 */
    }
    return out;
  }
  function localSnapshot(root) {
    var keys = {};
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (!k || k.indexOf(root + ":") !== 0) continue;
        var sub = k.slice(root.length + 1);
        if (sub === "__meta" || sub === "__sync") continue;
        var raw = window.localStorage.getItem(k);
        var v;
        try {
          v = JSON.parse(raw);
        } catch {
          v = raw;
        }
        keys[sub] = v;
      }
    } catch {
      /* 무시 */
    }
    return { v: 1, prefix: root, keys: keys, savedAt: new Date().toISOString() };
  }

  /**
   * 로그아웃 직전: 이 기기에 남은 "아직 DB에 안 올린" 과학 앱 기록(meta.dirty)과 못 지운 "처음부터 다시"(meta.pendingClear)를
   * 지금 로그인한 사용자(= 기록 주인일 때만)로 올린다.
   *   opts.prefix(기본 "sci6"), opts.confirmConflict(info) → true = 이 기기 기록으로 덮어쓰기, false = 저장된 기록 유지
   * → { ok: true } | { ok: false, reason, problems: [{ appId, title, reason }] }
   */
  async function flushLocalProgress(opts) {
    var o = opts || {};
    var prefix = o.prefix || "sci6";
    var apps = localApps(prefix).filter(function (a) {
      return a.meta.dirty || a.meta.pendingClear;
    });
    if (!apps.length) return { ok: true, problems: [] };
    if (!state.client) return { ok: false, reason: "not_initialized", problems: apps.map(problemOf("not_initialized")) };
    var auth = await authFor(null);
    if (!auth.ok) {
      var mine = apps.filter(function (a) {
        var p = peekSession();
        return p && a.meta.owner === p.userId;
      });
      return { ok: mine.length === 0, reason: auth.reason, problems: mine.map(problemOf(auth.reason)) };
    }
    var problems = [];
    for (var i = 0; i < apps.length; i++) {
      var a = apps[i];
      var m = a.meta;
      // 기록 주인이 아닌 사람의 세션으로는 절대 올리지 않는다(다른 학생 행을 덮지 않게).
      if (m.owner !== auth.userId) continue;
      if (!m.appId) {
        problems.push(problemOf("error")(a));
        continue;
      }
      if (!m.dirty && m.pendingClear) {
        var del = await rest("DELETE", rowFilter(auth.userId, m.appId), auth.token);
        if (del.ok || del.reason === "no_table") {
          m.pendingClear = false;
          writeJson(a.metaKey, m);
        } else problems.push(problemOf(del.reason === "no_table" ? "no_table" : "clear_failed")(a));
        continue;
      }
      var snap = localSnapshot(a.root);
      var chk = checkState(snap);
      if (chk.err) {
        problems.push(problemOf(chk.err.reason)(a));
        continue;
      }
      var stamp = m.localAt;
      var res = await saveFor(m.appId, snap, auth, m.pendingClear ? { force: true } : { baseUpdatedAt: m.syncedAt || null });
      if (!res.ok && res.reason === "conflict") {
        var row = res.row;
        if (!row) {
          var cur = await loadFor(m.appId, auth);
          row = cur.ok ? cur.row : null;
        }
        if (row && row.state && sameKeys(row.state.keys, snap.keys)) res = { ok: true, updatedAt: row.updated_at };
        else {
          var useLocal = o.confirmConflict
            ? await o.confirmConflict({ appId: m.appId, title: m.title || m.appId, localAt: m.localAt || 0, serverAt: row ? row.updated_at : null })
            : false;
          if (useLocal) res = await saveFor(m.appId, snap, auth, { force: true });
          else continue; // 학생이 "저장된 기록 유지"를 골랐다
        }
      }
      if (res.ok) {
        var m2 = readJson(a.metaKey) || m;
        if (m2.owner === auth.userId) {
          if (res.updatedAt) m2.syncedAt = res.updatedAt;
          if (m2.localAt === stamp) m2.dirty = false;
          m2.pendingClear = false;
          writeJson(a.metaKey, m2);
        }
      } else problems.push(problemOf(res.reason)(a));
    }
    return { ok: problems.length === 0, reason: problems.length ? problems[0].reason : null, problems: problems };
  }
  function problemOf(reason) {
    return function (a) {
      return { appId: a.meta.appId || a.root, title: a.meta.title || a.meta.appId || a.root, reason: reason };
    };
  }
  function writeJson(k, v) {
    try {
      window.localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* 무시 */
    }
  }

  /** 로그아웃. 서버에 알리지 못해도(오프라인) 이 기기의 세션은 반드시 지운다. */
  async function signOut() {
    if (!state.client) return { ok: false };
    try {
      var r = await state.client.auth.signOut();
      if (r && r.error) await state.client.auth.signOut({ scope: "local" });
    } catch {
      try {
        await state.client.auth.signOut({ scope: "local" });
      } catch {
        /* 무시 */
      }
    }
    // supabase가 못 지웠으면 직접 지운다(이 기기에 로그인이 남지 않게)
    var k = tokenKey();
    try {
      if (k && window.localStorage.getItem(k)) window.localStorage.removeItem(k);
    } catch {
      /* 무시 */
    }
    return { ok: true };
  }

  /** 로그아웃·사용자 바뀜 알림. supabase onAuthStateChange(이 탭) + storage 이벤트(다른 탭의 블로그 로그아웃) 둘 다 본다. */
  function onAuthChange(fn) {
    var fired = false;
    function signedOut() {
      if (fired) return;
      fired = true;
      fn("signed_out");
    }
    if (state.client) {
      try {
        state.client.auth.onAuthStateChange(function (event) {
          if (event === "SIGNED_OUT") setTimeout(signedOut, 0);
        });
      } catch {
        /* 무시 */
      }
    }
    var k = tokenKey();
    var startUser = peekSession();
    window.addEventListener("storage", function (e) {
      if (!k || (e.key !== k && e.key !== null)) return;
      if (e.key === null) {
        // 다른 탭에서 localStorage.clear()
        if (!peekSession()) signedOut();
        return;
      }
      var next = parseSession(e.newValue);
      if (!next) signedOut();
      else if (startUser && next.userId !== startUser.userId && !fired) {
        fired = true;
        fn("user_changed", next.userId);
      }
    });
  }

  /** 로그인 후 돌아올 경로(basePath를 뺀 사이트 경로). 블로그 화면(iframe) 안이면 그 화면으로 돌아간다. */
  function returnPath() {
    var own = window.location.pathname;
    var i = own.indexOf("/apps/");
    var base = i >= 0 ? own.slice(0, i) : "";
    var target = own + window.location.search;
    try {
      if (window.top && window.top !== window && window.top.location.origin === window.location.origin) {
        target = window.top.location.pathname + window.top.location.search;
      }
    } catch {
      /* 다른 출처의 부모 창 → 앱 자신으로 */
    }
    if (base && target.indexOf(base + "/") === 0) target = target.slice(base.length);
    if (target.charAt(0) !== "/" || target.charAt(1) === "/" || target.charAt(1) === "\\") return null;
    return target;
  }

  function loginUrl() {
    var next = returnPath();
    return next ? LOGIN_PATH + "?next=" + encodeURIComponent(next) : LOGIN_PATH;
  }

  function renderLoginHint(element, text) {
    if (!element) return;
    element.textContent = "";
    element.appendChild(document.createTextNode((text || "로그인하면 결과가 저장돼요.") + " "));
    var a = document.createElement("a");
    a.href = loginUrl();
    // 블로그 화면 안(iframe)에서 열려 있어도 로그인은 전체 창에서 한다.
    a.target = "_top";
    a.textContent = "로그인하기";
    element.appendChild(a);
    element.hidden = false;
  }

  window.Class1Record = {
    init: init,
    getUser: getUser,
    save: save,
    loginUrl: loginUrl,
    renderLoginHint: renderLoginHint,
    peekSession: peekSession,
    requireUser: requireUser,
    callFunction: callFunction,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    clearProgress: clearProgress,
    onAuthChange: onAuthChange,
    flushLocalProgress: flushLocalProgress,
    signOut: signOut,
    userLabel: userLabel,
  };
})();
