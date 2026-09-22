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
 *   Class1Record.loginUrl()                      → "../../login/" (앱 폴더 기준 블로그 로그인 페이지)
 *   Class1Record.renderLoginHint(element, text?) → element 안에 "로그인하면 결과가 저장돼요" 문구 + 로그인 링크를 넣는다.
 *
 * 외부 라이브러리는 supabase-js(CDN) 하나만 쓴다.
 */
(function () {
  "use strict";

  var LOGIN_PATH = "../../login/"; // /class1/apps/{앱}/ → /class1/login/
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

  var state = { client: null, appId: null };

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

  function loginUrl() {
    return LOGIN_PATH;
  }

  function renderLoginHint(element, text) {
    if (!element) return;
    element.textContent = "";
    element.appendChild(document.createTextNode((text || "로그인하면 결과가 저장돼요.") + " "));
    var a = document.createElement("a");
    a.href = LOGIN_PATH;
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
  };
})();
