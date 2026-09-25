/*
 * science-guide/persist.js — localStorage 임시 저장 공통 유틸 (정본: scripts/templates/science-guide/, science-sim에서 복사)
 * 모든 접근은 try/catch로 감싼다(사생활 보호 모드·저장 공간 부족·차단 시에도 앱이 멈추지 않게).
 *
 *   var store = SciSim.createStore("sci611sim2:v1");
 *   store.get("predict", {});      // 없거나 읽기 실패 → 기본값
 *   store.set("predict", { q1: "..." });
 *   store.remove("predict");
 *   store.clearAll();               // 이 접두사로 시작하는 키만 지운다
 *   store.available                 // localStorage를 쓸 수 있는지(false면 새로고침 시 사라진다는 안내에 사용)
 *
 * ▶ 로그인 필수 · 진행 상황 DB 동기화(SciSim.Sync) — 앱 코드(app.js)는 바꿀 필요 없다
 *   처음 만든 store의 접두사(= config의 storageKey, 반드시 "sci6…")가 이 앱의 "뿌리"다. 뿌리 + ":" 로 시작하는
 *   store(예: storageKey + ":fill")도 같은 앱 기록으로 함께 저장된다. 내부 표시 키: "<뿌리>:__meta"(앞 판 "__sync"는 옮김)
 *     { appId, title, owner: 기록 주인 user id, syncedAt: 마지막으로 맞춘 DB updated_at(서버 시각), dirty: DB에 아직 안 올린 변경이 있음,
 *       localAt: 마지막 변경 시각(이 기기 시계 — 화면 표시용, 비교에는 쓰지 않음), pendingClear: "처음부터 다시"의 DB 삭제가 아직 안 됨 }
 *     블로그 로그아웃(src/lib/science-progress.ts)과 앱의 로그아웃 버튼이 이 표시를 보고 못 올린 기록을 올린 뒤 지운다.
 *   ① createStore(뿌리) 때(동기, app.js가 기록을 읽기 전):
 *      - 로그인 세션 없음 → 주인이 "체험"이 아닌 sci6… 로컬 기록(앞 학생 것)을 모두 삭제하고 "확인 중" 가림막.
 *        이어서 site_settings.login_required 를 읽어(공개 읽기, 실패하면 꺼짐으로 봄) 갈 길을 정한다 — 아래 ⑦.
 *      - 기록 주인 표시가 없거나 다른 사람 → 이 앱 로컬 키 모두 삭제 후 주인 = 지금 사용자. "불러오는 중" 가림막.
 *   ② Lesson.create → Sync.start(): 서버로 세션 확인 → app_progress 불러와 비교(충돌 규칙, 기기 시계를 쓰지 않는다)
 *      - DB 행 updated_at == syncedAt(서버 변경 없음): 로컬 우선. dirty면 바로 올림.
 *      - DB가 바뀜 + 로컬 변경 없음: DB로 복원 → 새로고침.
 *      - 둘 다 바뀜: 내용이 같으면 맞춘 것으로 보고, 다르면 학생에게 고르게 한다("이 기기의 기록" / "저장된 기록", 각 마지막 시각).
 *      - DB 행 없음: syncedAt이 있고 dirty가 아니면(다른 기기에서 처음부터 다시) 로컬도 비움, 아니면 로컬을 올림.
 *      - 테이블 없음(마이그레이션 전): 로컬 사본으로 계속, "저장 안 됨" 표시.
 *      - 네트워크 오류: 믿을 수 있는 로컬 사본(같은 주인, 이미 한 번 맞춤)이 있으면 그걸로 계속하며 다시 시도
 *        (로그인이 만료됐는데 확인할 수 없으면 먼저 "○○ 학생이 맞나요?"), 없으면 "불러오지 못함 · 다시 시도" 가림막.
 *   ③ 이후 store 변경마다 약 1초 디바운스(최대 8초, 학습 시간만 바뀌면 20초)로 전체 스냅샷을 saveProgress.
 *      저장은 "DB가 syncedAt 뒤로 안 바뀌었을 때만"(baseUpdatedAt) — 그 사이 다른 기기가 저장했으면 덮지 않고 ②로 다시 맞춘다.
 *      pagehide·visibilitychange(hidden) 때 즉시 보냄(keepalive). 실패하면 상태 표시 + 점점 길게 다시 시도.
 *   ④ 기록 주인 확인: 모든 불러오기·저장·삭제는 기록 주인(owner)을 expectedUserId로 넘기고, 실제 요청 토큰의 사용자가 다르면
 *      class1-record.js가 요청하지 않는다("user_changed") → 요청 중단, 앞 사람 로컬 삭제, 새 사용자로 다시 연다.
 *      pagehide·hidden 때 "확인 중" 가림막을 씌우고, pageshow(뒤로 가기 캐시)·visible·focus·storage 때 세션을 다시 봐서
 *      주인이 같을 때만 걷는다(로그아웃이면 로그인 안내, 다른 사람이면 삭제 후 다시 열기).
 *   ⑤ 로그아웃(이 탭 SIGNED_OUT 또는 다른 탭/블로그에서 세션 키 삭제) → sci6… 로컬 삭제 후 로그인 안내(화면·메모리를 비우려 새로고침).
 *      머리말에 "○○ 계정으로 로그인 중 · 내가 아니면 [로그아웃]" — 버튼은 블로그 로그아웃과 같은 절차(못 올린 기록 올리기 →
 *      실패하면 "저장되지 않은 활동이 있어요 — 그래도 로그아웃할까요?" → 로그아웃 → 로컬 삭제).
 *   ⑥ SciSim.Sync.reset(store) — "처음부터 다시 하기": 로컬 삭제 + clearProgress() (실패하면 다음에/로그아웃 때 다시 시도).
 *   ⑦ 비로그인일 때(2026-09-23 사용자 결정 — docs/admin/admin-tools/scope-fix-instructions.md §2)
 *      - 잠금 켜짐(login_required = true) → 지금까지처럼 로그인 안내 가림막. sci6… 로컬 키를 모두 지운다.
 *      - 잠금 꺼짐(기본) → **체험 모드**(phase "trial"): 모든 단계를 그대로 쓸 수 있고, 입력은 이 기기(localStorage)에만
 *        남는다. app_progress·app_results 를 한 번도 부르지 않는다. 머리말에 "로그인하면 기록이 저장돼요" 한 줄 + 로그인 링크.
 *        체험 기록의 주인 표시는 "__guest__"다. 로그인한 학생이 열면 주인이 달라 그 즉시 지워진다
 *        (체험 기록은 누가 썼는지 확인할 수 없으므로 학생 기록으로 이어받지 않는다 — 주인 확인 규칙 ④를 깨지 않기 위해).
 *        체험 중 다른 탭에서 로그인하면 화면을 새로 불러와 평소(로그인) 흐름으로 들어간다.
 *   스냅샷 형식(app_progress.state): { v: 1, prefix: 뿌리, keys: { "<접두사 뒤 키>": 값, … }, savedAt: ISO 시각 }
 */
/* ───── 글꼴(디자인 개편 5단계, 2026-09-24): 본문 Pretendard · 제목 G마켓 산스 Bold ─────
 * style-common.css의 @import는 글꼴 CDN이 응답 없이 걸려 있으면 첫 화면을 그만큼 늦췄다(6초 걸림 → 6초 빈 화면).
 * 스크립트가 붙인 <link rel="stylesheet">는 화면 그리기를 막지 않는다 → 먼저 기기 글꼴로 그리고, 글꼴이 오면 바뀐다
 * (두 CSS 모두 font-display: swap). 글꼴 이름 목록(--ss-font, --ss-font-heading)은 style-common.css에 있다.
 * 한 번만 붙이고(같은 id가 있으면 건너뜀) 어떤 오류도 밖으로 던지지 않는다. 저장·동작과는 관계없다.
 *   - Pretendard 1.3.9(jsDelivr, 사이트가 쓰는 npm 패키지와 같은 파일) — 버전 고정 + SRI
 *   - G마켓 산스 Bold: Jua(Google Fonts)를 대신해 사이트와 같은 파일(public/fonts/gmarket-sans/gmarket-sans.css)을
 *     상대경로(../../fonts/gmarket-sans/gmarket-sans.css, 같은 출처)로 붙인다 — 앱은 public/apps/{앱}/index.html에서
 *     열리므로 두 단계 위가 public/다. 사이트와 파일이 같아 한 번 받으면 브라우저 캐시를 함께 쓴다. SRI 없음(로컬 파일이라
 *     불필요), gstatic preconnect도 더 안 쓰므로 뺐다.
 */
(function () {
  "use strict";
  try {
    var d = document;
    var head = d && (d.head || d.getElementsByTagName("head")[0]);
    if (!head || d.getElementById("ss-font-pretendard")) return;
    var add = function (attrs) {
      var l = d.createElement("link");
      for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) l.setAttribute(k, attrs[k]);
      head.appendChild(l);
    };
    add({
      id: "ss-font-pretendard",
      rel: "stylesheet",
      href: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css",
      integrity: "sha384-uR1wgObmx89ZQ4VVXHdzjbDJZ1PvBK01K+E3GebmaBKdZ87qRJvBWPoPbzWeEd5T",
      crossorigin: "anonymous",
    });
    add({ id: "ss-font-heading", rel: "stylesheet", href: "../../fonts/gmarket-sans/gmarket-sans.css" });
  } catch (e) {
    /* 글꼴을 못 붙여도 기기 글꼴로 그대로 동작한다 */
  }
})();
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});

  function testStorage() {
    try {
      var k = "__scisim_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }


  /* 조건에 맞는 localStorage 키를 모두 지우고 지운 개수를 돌려준다. */
  function removeLocalKeys(match) {
    var n = 0;
    try {
      var keys = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && match(k)) keys.push(k);
      }
      keys.forEach(function (k) {
        window.localStorage.removeItem(k);
        n++;
      });
    } catch (e) {
      /* 무시 */
    }
    return n;
  }

  /* ═════════ 로그인 필수 · 진행 상황 동기화(SciSim.Sync) — 설계는 맨 위 주석 ═════════ */
  var Sync = (function () {
    var SCI_PREFIX = "sci6"; // 과학 앱 로컬 키 공통 머리(블로그 로그아웃 때도 이 머리로 지운다)
    var GUEST = "__guest__"; // 체험 모드 기록의 주인 표시(실제 사용자 id와 절대 겹치지 않는 값)
    var root = null; // 이 앱의 뿌리 접두사
    var available = false; // localStorage 사용 가능
    // idle | checking | trial | login | loading | ready | offline | local-only | conflict | confirm-id | error | stopped
    var phase = "idle";
    var owner = null; // 기록 주인(user id) — 이 페이지는 이 사람의 기록만 읽고 쓴다
    var ownerLabel = "";
    var appId = null;
    var appTitle = "";
    var gateEl = null;
    var statusEl = null;
    var whoEl = null;
    var trialEl = null; // 체험 모드 안내 줄
    var timer = null;
    var pendingSince = 0;
    var saving = false;
    var again = false;
    var retryMs = 0;
    var retryTimer = null;
    var lastCheck = 0;
    var started = false;
    var suspended = false; // 처음부터 다시 하는 중
    var covered = false; // 화면을 떠날 때 씌운 가림막(돌아와서 주인을 다시 확인한 뒤 걷는다)
    var loggingOut = false;
    var forceOverwrite = false; // DB에 다른 판(storageKey 버전)의 행이 있음 → 덮어쓴다
    var identityOk = false; // 오프라인 + 만료 토큰일 때 "○○ 맞나요?"에 예라고 답함

    function R() {
      return window.Class1Record || null;
    }
    function peek() {
      var r = R();
      return r && r.peekSession ? r.peekSession() : null;
    }
    function metaKey() {
      return root ? root + ":__meta" : "__scisync_none__";
    }
    function readMeta() {
      try {
        var raw = window.localStorage.getItem(metaKey());
        if (raw == null && root) {
          // 앞 판의 표시 키(<뿌리>:__sync)를 옮긴다
          var old = window.localStorage.getItem(root + ":__sync");
          if (old != null) {
            window.localStorage.setItem(metaKey(), old);
            window.localStorage.removeItem(root + ":__sync");
            raw = old;
          }
        }
        var m = JSON.parse(raw || "null");
        return m && typeof m === "object" ? m : null;
      } catch (e) {
        return null;
      }
    }
    function writeMeta(m) {
      if (appId) m.appId = appId;
      if (appTitle) m.title = appTitle;
      try {
        window.localStorage.setItem(metaKey(), JSON.stringify(m));
      } catch (e) {
        /* 무시 */
      }
    }
    function freshMeta() {
      return { appId: appId, owner: owner, syncedAt: null, dirty: false, localAt: 0, pendingClear: false };
    }
    function clearAppLocal() {
      if (!root) return;
      removeLocalKeys(function (k) {
        return k.indexOf(root + ":") === 0;
      });
    }
    function clearAllSciLocal() {
      removeLocalKeys(function (k) {
        return k.indexOf(SCI_PREFIX) === 0;
      });
    }
    /* 주인이 uid가 아닌(또는 주인 표시가 없는) 과학 앱 로컬 기록을 지운다 */
    function clearForeignSciLocal(uid) {
      var roots = [];
      var all = [];
      try {
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (!k || k.indexOf(SCI_PREFIX) !== 0) continue;
          all.push(k);
          if (/:__(meta|sync)$/.test(k)) {
            var m = null;
            try {
              m = JSON.parse(window.localStorage.getItem(k) || "null");
            } catch (e) {
              m = null;
            }
            if (!m || m.owner !== uid) roots.push(k.replace(/:__(meta|sync)$/, ""));
          }
        }
      } catch (e) {
        /* 무시 */
      }
      removeLocalKeys(function (k) {
        return roots.some(function (r) {
          return k.indexOf(r + ":") === 0;
        });
      });
    }

    /* 스냅샷: 뿌리 + ":" 로 시작하는 키(내부 표시 키 제외) → { 접두사 뒤 키: 값 } */
    function snapshot() {
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
          } catch (e) {
            v = raw;
          }
          keys[sub] = v;
        }
      } catch (e) {
        /* 무시 */
      }
      return { v: 1, prefix: root, keys: keys, savedAt: new Date().toISOString() };
    }
    function hasLocalData() {
      var snap = snapshot();
      return Object.keys(snap.keys).length > 0;
    }
    /* 키 순서와 상관없이 같은 값인지(jsonb는 객체 키 순서를 바꿔 저장한다) */
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
    function fmtTime(t) {
      var d = typeof t === "number" ? new Date(t) : new Date(Date.parse(t));
      if (!t || isNaN(d.getTime())) return "알 수 없음";
      try {
        return d.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
      } catch (e) {
        return d.toLocaleString();
      }
    }

    /* ───── 화면: 가림막(로그인 안내·불러오는 중·오류·기록 고르기)과 저장 상태 표시, 로그인한 사람 표시 ───── */
    function injectStyle() {
      if (document.getElementById("ss-sync-style")) return;
      var st = document.createElement("style");
      st.id = "ss-sync-style";
      st.textContent =
        ".ss-gate{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;" +
        "background:var(--ss-bg,#f6f7fb);color:var(--ss-text,#1b1f2a);overflow:auto}" +
        ".ss-gate-card{max-width:440px;width:100%;text-align:center;background:var(--ss-surface,#fff);border:1px solid var(--ss-border,#d8dce6);" +
        "border-radius:var(--ss-radius,16px);box-shadow:var(--ss-shadow,none);padding:24px 20px}" +
        ".ss-gate-card h2{margin:0 0 10px;font-size:1.25rem}.ss-gate-card p{margin:0 0 14px;line-height:1.6}" +
        ".ss-gate-actions{display:flex;flex-direction:column;gap:10px;align-items:stretch;margin-top:6px}" +
        ".ss-gate-actions a,.ss-gate-actions button{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;text-decoration:none}" +
        ".ss-gate-actions small{display:block;font-weight:500;font-size:0.82rem;opacity:0.85}" +
        ".ss-gate-spin{width:36px;height:36px;margin:4px auto 14px;border-radius:50%;border:4px solid var(--ss-border,#d8dce6);" +
        "border-top-color:var(--ss-primary,#3b5bdb);animation:ss-gate-rot 0.9s linear infinite}" +
        "@keyframes ss-gate-rot{to{transform:rotate(360deg)}}" +
        "@media (prefers-reduced-motion:reduce){.ss-gate-spin{animation:none}}" +
        ".ss-sync{display:inline-flex;align-items:center;min-height:28px;padding:2px 10px;border-radius:999px;font-size:0.8rem;font-weight:600;" +
        "background:var(--ss-surface-2,#eef1f6);color:var(--ss-muted,#5b6475);white-space:normal}" +
        ".ss-sync[data-kind=bad]{background:var(--ss-bad-bg,#fdecec);color:var(--ss-bad,#b42318)}" +
        ".ss-sync[data-kind=warn]{background:var(--ss-warn-bg,#fff4d6);color:var(--ss-text,#1b1f2a)}" +
        ".ss-sync[data-kind=good]{background:var(--ss-good-bg,#e6f6ec);color:var(--ss-good,#1a7f37)}" +
        ".ss-sync-float{position:fixed;left:10px;bottom:10px;z-index:1500}" +
        ".ss-who{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;max-width:1180px;margin:6px auto 0;font-size:0.85rem;color:var(--ss-muted,#5b6475)}" +
        ".ss-who strong{color:var(--ss-text,#1b1f2a)}" +
        ".ss-who-out{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--ss-border,#d8dce6);background:var(--ss-surface,#fff);" +
        "color:var(--ss-text,#1b1f2a);font-weight:700;cursor:pointer;touch-action:manipulation}" +
        ".ss-who-out:disabled{opacity:0.5}" +
        ".ss-who-float{position:fixed;right:10px;bottom:10px;z-index:1500;margin:0;padding:4px 4px 4px 12px;border-radius:999px;" +
        "background:var(--ss-surface,#fff);border:1px solid var(--ss-border,#d8dce6)}" +
        ".ss-trial-link{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:999px;" +
        "border:1px solid var(--ss-border,#d8dce6);background:var(--ss-surface,#fff);color:var(--ss-text,#1b1f2a);" +
        "font-weight:700;text-decoration:none;touch-action:manipulation}";
      (document.head || document.documentElement).appendChild(st);
    }
    function setInert(on) {
      var kids = document.body ? document.body.children : [];
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n === gateEl || n.tagName === "SCRIPT" || n.tagName === "STYLE") continue;
        if (on) {
          n.setAttribute("inert", "");
          n.setAttribute("aria-hidden", "true");
        } else {
          n.removeAttribute("inert");
          n.removeAttribute("aria-hidden");
        }
      }
    }
    function mk(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }
    function btn(cls, text, sub, onClick) {
      var b = mk("button", cls, null);
      b.type = "button";
      b.appendChild(mk("span", null, text));
      if (sub) b.appendChild(mk("small", null, sub));
      b.addEventListener("click", onClick);
      return b;
    }
    function backLink() {
      var b = document.querySelector(".ss-back");
      if (!b || !b.getAttribute("href")) return null;
      var a = mk("a", "ss-btn", b.textContent || "← 차시로");
      a.href = b.getAttribute("href");
      a.target = "_top";
      return a;
    }
    function showGate(kind, message, o) {
      if (!document.body) return;
      injectStyle();
      if (!gateEl) {
        gateEl = mk("div", "ss-gate");
        gateEl.setAttribute("role", "dialog");
        gateEl.setAttribute("aria-modal", "true");
        gateEl.setAttribute("aria-labelledby", "ss-gate-title");
        document.body.appendChild(gateEl);
      }
      covered = kind === "cover";
      o = o || {};
      gateEl.textContent = "";
      gateEl.setAttribute("data-kind", kind);
      var card = mk("div", "ss-gate-card");
      var actions = mk("div", "ss-gate-actions");
      var withBack = true;
      if (kind === "login") {
        card.appendChild(mk("h2", null, "🔒 로그인이 필요해요")).id = "ss-gate-title";
        card.appendChild(
          mk("p", null, message || "이 활동은 로그인한 학생만 할 수 있어요. 로그인하면 적은 내용이 저장되고, 다른 기기에서도 이어서 할 수 있어요.")
        );
        var a = mk("a", "ss-btn ss-btn-primary ss-btn-big", "로그인하러 가기");
        a.href = R() && R().loginUrl ? R().loginUrl() : "../../login/";
        a.target = "_top"; // 블로그 화면(iframe) 안에서도 로그인은 전체 창에서
        actions.appendChild(a);
      } else if (kind === "loading" || kind === "cover" || kind === "checking") {
        card.appendChild(mk("div", "ss-gate-spin")).setAttribute("aria-hidden", "true");
        var title = "내 기록을 불러오고 있어요…";
        if (kind === "cover") title = "로그인을 확인하고 있어요…";
        else if (kind === "checking") title = "활동을 여는 중이에요…";
        card.appendChild(mk("h2", null, title)).id = "ss-gate-title";
        card.appendChild(mk("p", null, message || "잠깐만 기다려 주세요."));
        withBack = kind !== "cover";
      } else if (kind === "conflict") {
        card.appendChild(mk("h2", null, "⚠️ 기록이 두 가지예요")).id = "ss-gate-title";
        card.appendChild(
          mk(
            "p",
            null,
            "이 기기에서 아직 저장하지 못한 기록과, 다른 기기(또는 다른 창)에서 저장한 기록이 서로 달라요. 어느 기록으로 이어서 할까요? 고르지 않은 기록은 지워져요."
          )
        );
        actions.appendChild(btn("ss-btn ss-btn-primary ss-btn-big", "📱 이 기기의 기록으로 계속하기", "마지막으로 고친 때: " + fmtTime(o.localAt), o.onLocal));
        actions.appendChild(btn("ss-btn ss-btn-big", "☁️ 저장된 기록 불러오기", "마지막으로 저장된 때: " + fmtTime(o.serverAt), o.onServer));
        withBack = false;
      } else if (kind === "confirm-id") {
        card.appendChild(mk("h2", null, "👤 " + (ownerLabel || "이 계정") + " 학생이 맞나요?")).id = "ss-gate-title";
        card.appendChild(
          mk(
            "p",
            null,
            "인터넷에 연결되지 않아 로그인을 확인할 수 없어요. 이 기기에는 " +
              (ownerLabel || "이 계정") +
              "의 기록이 있어요. 본인이 아니면 로그아웃해 주세요."
          )
        );
        actions.appendChild(btn("ss-btn ss-btn-primary ss-btn-big", "네, 제가 " + (ownerLabel || "이 계정의 주인") + "이에요", null, o.onYes));
        actions.appendChild(btn("ss-btn ss-btn-big", "아니에요 · 로그아웃", null, o.onNo));
        withBack = false;
      } else {
        card.appendChild(mk("h2", null, "⚠️ 기록을 불러오지 못했어요")).id = "ss-gate-title";
        card.appendChild(mk("p", null, message || "인터넷 연결을 확인한 뒤 다시 시도해 주세요. 잠시 뒤 저절로 다시 시도해요."));
        var retry = mk("button", "ss-btn ss-btn-primary ss-btn-big", "다시 시도");
        retry.type = "button";
        retry.addEventListener("click", function () {
          showGate("loading");
          reconcile();
        });
        actions.appendChild(retry);
      }
      var back = withBack ? backLink() : null;
      if (back) actions.appendChild(back);
      card.appendChild(actions);
      gateEl.appendChild(card);
      gateEl.hidden = false;
      setInert(true);
    }
    function hideGate() {
      covered = false;
      if (gateEl) {
        gateEl.hidden = true;
        gateEl.textContent = "";
      }
      setInert(false);
    }
    function setStatus(kind, text) {
      if (!document.body) return;
      injectStyle();
      if (!statusEl) {
        statusEl = mk("span", "ss-sync");
        statusEl.setAttribute("role", "status");
        statusEl.setAttribute("aria-live", "polite");
        var host = document.querySelector(".ss-topline");
        if (host) host.appendChild(statusEl);
        else {
          statusEl.className += " ss-sync-float";
          document.body.appendChild(statusEl);
        }
      }
      statusEl.setAttribute("data-kind", kind);
      statusEl.textContent = text;
      statusEl.hidden = !text;
    }
    /* "○○ 계정으로 로그인 중 · 내가 아니면 [로그아웃]" — 로그아웃하지 않고 태블릿을 넘겨받은 학생이 알아채게 */
    function renderWho() {
      if (!document.body || !owner || whoEl) return;
      injectStyle();
      whoEl = mk("div", "ss-who");
      var t = mk("span", "ss-who-text");
      t.appendChild(document.createTextNode("👤 "));
      t.appendChild(mk("strong", null, ownerLabel || "알 수 없는 사용자"));
      t.appendChild(document.createTextNode(" 계정으로 로그인 중 · 내가 아니면"));
      whoEl.appendChild(t);
      var b = mk("button", "ss-who-out", "로그아웃");
      b.type = "button";
      b.addEventListener("click", function () {
        logout(b);
      });
      whoEl.appendChild(b);
      mountLine(whoEl);
    }
    function removeWho() {
      if (whoEl && whoEl.parentNode) whoEl.parentNode.removeChild(whoEl);
      whoEl = null;
    }
    /* 머리말(또는 화면 구석)에 붙이는 한 줄. renderWho와 renderTrialNote가 같은 자리를 쓴다. */
    function mountLine(node) {
      var header = document.querySelector(".ss-header");
      var top = header ? header.querySelector(".ss-topline") : null;
      if (top && top.parentNode) top.parentNode.insertBefore(node, top.nextSibling);
      else if (header) header.insertBefore(node, header.firstChild);
      else {
        node.className += " ss-who-float";
        document.body.appendChild(node);
      }
    }
    /* 체험 모드 안내: "적은 내용은 이 기기에만 남아요 · 로그인하면 기록이 저장돼요" */
    function renderTrialNote() {
      if (!document.body || trialEl) return;
      injectStyle();
      trialEl = mk("div", "ss-who ss-trial");
      trialEl.appendChild(mk("span", null, "💡 체험 모드예요 — 적은 내용은 이 기기에만 남아요."));
      var a = mk("a", "ss-trial-link", "로그인하면 기록이 저장돼요");
      a.href = R() && R().loginUrl ? R().loginUrl() : "../../login/";
      a.target = "_top"; // 블로그 화면(iframe) 안에서도 로그인은 전체 창에서
      trialEl.appendChild(a);
      mountLine(trialEl);
    }

    /* 새로고침 무한 반복 방지(앞 새로고침에서 5초 안에 또 새로고침하는 일이 3번 넘게 이어지면 멈춘다) */
    function safeReload() {
      try {
        var k = "sciSync:reloads";
        var now = Date.now();
        var r = JSON.parse(window.sessionStorage.getItem(k) || "null") || { t: now, n: 0 };
        if (now - r.t > 5000) r = { t: now, n: 0 };
        r.t = now;
        r.n++;
        window.sessionStorage.setItem(k, JSON.stringify(r));
        if (r.n > 3) {
          phase = "error";
          showGate("error", "기록을 맞추는 중에 문제가 생겼어요. 잠시 뒤 새로고침해 주세요.");
          return;
        }
      } catch (e) {
        /* sessionStorage를 못 쓰면 그냥 새로고침 */
      }
      window.location.reload();
    }

    function withTimeout(p, ms) {
      return Promise.race([
        p,
        new Promise(function (resolve) {
          setTimeout(function () {
            resolve({ ok: false, reason: "offline", message: "응답이 늦어요." });
          }, ms);
        }),
      ]).catch(function (e) {
        return { ok: false, reason: "offline", message: (e && e.message) || "" };
      });
    }
    function stopTimers() {
      clearTimeout(timer);
      clearTimeout(retryTimer);
      timer = retryTimer = null;
    }

    /* ───── 비로그인: 잠금 설정을 보고 "로그인 안내"인지 "체험 모드"인지 정한다(맨 위 주석 ⑦) ───── */
    function checkLock() {
      var rec = R();
      var p = rec && rec.fetchLoginRequired ? rec.fetchLoginRequired() : Promise.resolve(false);
      Promise.resolve(p).then(decide, function () {
        decide(false); // 읽지 못하면 잠그지 않는다
      });
    }
    function decide(locked) {
      if (phase !== "checking") return;
      if (peek()) {
        // 확인하는 사이에 로그인했다 → 평소(로그인) 흐름으로 다시 연다
        phase = "stopped";
        safeReload();
        return;
      }
      if (locked) {
        phase = "login";
        if (available) clearAllSciLocal();
        showGate("login");
        return;
      }
      startTrial();
    }
    /* 체험 모드: 모든 단계를 쓸 수 있고, 입력은 이 기기에만 남는다(DB 호출 없음) */
    function startTrial() {
      phase = "trial";
      if (available) {
        var m = readMeta();
        if (!m || m.owner !== GUEST) {
          var g = freshMeta();
          g.owner = GUEST;
          writeMeta(g);
        }
      }
      hideGate();
      renderTrialNote();
      setStatus("warn", "체험 모드 · 기록이 저장되지 않아요");
    }

    /* ───── 로그아웃됨 / 다른 사람으로 바뀜 ───── */
    function toLogin(message) {
      var wasActive = phase !== "idle" && phase !== "login";
      phase = "login";
      stopTimers();
      clearAllSciLocal();
      setStatus("", "");
      removeWho();
      showGate("login", message);
      // 이미 그려진 화면(DOM)과 메모리에 앞 사람의 입력이 남지 않게 새로 불러온다(세션이 없으니 로그인 안내만 다시 뜬다).
      if (wasActive && !peek()) {
        try {
          if (message) window.sessionStorage.setItem("sciSync:loginMsg", message);
        } catch (e) {
          /* 무시 */
        }
        safeReload();
      }
    }
    /* 이 페이지의 기록 주인과 다른 사람의 세션이 보이면: 요청을 멈추고, 앞 사람 기록을 지우고, 새 사람 기준으로 다시 연다 */
    function onUserChanged() {
      var p = peek();
      if (!p) return toLogin();
      phase = "stopped";
      stopTimers();
      showGate("loading", "다른 사람으로 로그인되어 있어요. 그 사람의 기록으로 바꾸는 중이에요…");
      removeWho();
      clearAppLocal();
      clearForeignSciLocal(p.userId);
      safeReload();
    }
    /* 로컬 세션을 동기로 다시 보고 주인이 그대로인지 확인한다. 그대로면 true */
    function recheckOwner() {
      if (!root || !R() || phase === "idle" || phase === "stopped") return phase !== "stopped";
      var p = peek();
      if (phase === "login" || phase === "trial" || phase === "checking") {
        // 로그인하면(다른 탭 포함) 평소 흐름으로 다시 연다. 체험 기록은 주인이 달라 그때 지워진다.
        if (p) {
          phase = "stopped";
          safeReload();
        }
        return false;
      }
      if (!owner) return true;
      if (!p) {
        toLogin();
        return false;
      }
      if (p.userId !== owner) {
        onUserChanged();
        return false;
      }
      return true;
    }
    /* 화면을 떠날 때 가림막을 씌운다(뒤로 가기 캐시에서 되살아나도 확인 전에는 기록이 보이지 않게) */
    function cover() {
      if ((phase === "ready" || phase === "offline" || phase === "local-only") && !loggingOut && !covered) showGate("cover");
    }
    function onReturn(persisted) {
      if (!recheckOwner()) return;
      if (covered) hideGate();
      if ((phase === "ready" || phase === "offline") && !saving) {
        var m = readMeta();
        if (persisted || (Date.now() - lastCheck > 30000 && m && !m.dirty)) reconcile(); // 다른 기기에서 한 내용이 있으면 불러온다
      }
    }

    /* ───── 로그아웃(블로그 로그아웃과 같은 절차: 못 올린 기록 올리기 → 실패하면 물어보기 → 로그아웃 → 로컬 삭제) ───── */
    function problemText(r) {
      var list = (r && r.problems) || [];
      var names = list
        .map(function (p) {
          return p.title;
        })
        .filter(function (v, i, a) {
          return v && a.indexOf(v) === i;
        });
      var head;
      if (r && r.reason === "no_table")
        head = "진행 상황을 저장할 서버가 아직 준비되지 않아, 이 기기에 적은 과학 활동이 저장되지 않았어요.";
      else if (
        list.some(function (p) {
          return p.reason === "too_large";
        })
      )
        head = "저장되지 않은 활동이 있어요 — 기록이 너무 커서 저장하지 못했어요(선생님께 알려 주세요).";
      else if (
        list.some(function (p) {
          return p.reason === "clear_failed";
        })
      )
        head = "저장되지 않은 활동이 있어요 — '처음부터 다시 하기'를 서버에 알리지 못해, 다음에 로그인하면 예전 기록이 다시 나타날 수 있어요.";
      else head = "저장되지 않은 활동이 있어요(인터넷 연결을 확인해 주세요).";
      return head + (names.length ? "\n(" + names.join(", ") + ")" : "") + "\n\n로그아웃하면 이 기기에서 사라져요. 그래도 로그아웃할까요?";
    }
    function confirmConflict(info) {
      return window.confirm(
        "'" +
          info.title +
          "' 기록이 다른 기기에서 저장한 기록과 달라요.\n" +
          "· 이 기기의 기록: " +
          fmtTime(info.localAt) +
          "\n· 저장된 기록: " +
          fmtTime(info.serverAt) +
          "\n\n[확인] 이 기기의 기록으로 저장하기\n[취소] 저장된 기록 그대로 두기(이 기기의 기록은 지워져요)"
      );
    }
    function sleep(ms) {
      return new Promise(function (r) {
        setTimeout(r, ms);
      });
    }
    async function logout(button) {
      if (loggingOut) return;
      loggingOut = true;
      if (button) button.disabled = true;
      clearTimeout(timer);
      timer = null;
      try {
        flushAllPending(); // 미뤄 둔 입력부터 로컬에 쓴다(dirty 표시)
      } catch (e) {
        /* 무시 */
      }
      setStatus("", "☁️ 저장하는 중…");
      for (var i = 0; saving && i < 50; i++) await sleep(100); // 진행 중인 저장이 끝나기를 잠깐 기다린다
      var rec = R();
      var r =
        rec && rec.flushLocalProgress
          ? await withTimeout(rec.flushLocalProgress({ prefix: SCI_PREFIX, confirmConflict: confirmConflict }), 20000)
          : { ok: false, reason: "not_initialized" };
      if (!r.ok && !window.confirm(problemText(r))) {
        loggingOut = false;
        if (button) button.disabled = false;
        setStatus("bad", "⚠️ 저장되지 않은 기록이 있어요");
        if (phase === "ready" || phase === "offline") saveNow();
        return;
      }
      phase = "stopped";
      stopTimers();
      removeWho();
      setStatus("", "");
      showGate("loading", "로그아웃하고 있어요…");
      if (rec && rec.signOut) await withTimeout(rec.signOut(), 6000);
      clearAllSciLocal();
      try {
        // 블로그 로그아웃과 같게: 에디터 임시 글도 지운다
        for (var j = window.sessionStorage.length - 1; j >= 0; j--) {
          var k = window.sessionStorage.key(j);
          if (k && k.indexOf("class1:post-draft:") === 0) window.sessionStorage.removeItem(k);
        }
      } catch (e) {
        /* 무시 */
      }
      phase = "ready"; // toLogin이 "쓰던 화면"으로 보고 새로 불러오게
      toLogin();
    }

    /* ───── DB에서 복원 ───── */
    function restore(row) {
      clearAppLocal();
      var keys = (row.state && row.state.keys) || {};
      try {
        Object.keys(keys).forEach(function (k) {
          window.localStorage.setItem(root + ":" + k, JSON.stringify(keys[k]));
        });
      } catch (e) {
        /* 저장 공간 부족 등 */
      }
      var m = freshMeta();
      m.syncedAt = row.updated_at || null;
      m.localAt = Date.now();
      writeMeta(m);
      phase = "stopped";
      showGate("loading", "다른 기기나 지난번에 한 내용을 불러왔어요.");
      safeReload();
    }

    function usable(row) {
      return row && row.state && typeof row.state === "object" && row.state.prefix === root && row.state.keys && typeof row.state.keys === "object";
    }

    /* 둘 다 바뀜: 학생에게 고르게 한다(조용히 버리지 않는다) */
    function askConflict(row, m) {
      phase = "conflict";
      clearTimeout(timer);
      timer = null;
      showGate("conflict", null, {
        localAt: m.localAt,
        serverAt: row.updated_at,
        onLocal: function () {
          if (!window.confirm("저장된 기록(" + fmtTime(row.updated_at) + ")은 지워지고 이 기기의 기록으로 바뀌어요. 계속할까요?")) return;
          if (!recheckOwner()) return;
          var m2 = readMeta() || freshMeta();
          m2.syncedAt = row.updated_at; // 저장된 기록을 보고 고른 것 → 그 위에 덮어쓴다
          m2.dirty = true;
          m2.localAt = m2.localAt || Date.now();
          writeMeta(m2);
          phase = "loading";
          goReady();
          saveNow();
        },
        onServer: function () {
          if (!window.confirm("이 기기에서 저장하지 못한 기록은 지워지고 저장된 기록으로 바뀌어요. 계속할까요?")) return;
          if (!recheckOwner()) return;
          restore(row);
        },
      });
    }

    /* ───── 불러와 비교하기(충돌 규칙 — 서버 시각 updated_at과 로컬 dirty만 본다. 기기 시계는 쓰지 않는다) ───── */
    var reconciling = false;
    async function reconcile() {
      if (reconciling || suspended || loggingOut) return;
      if (phase === "login" || phase === "stopped" || phase === "conflict" || phase === "confirm-id") return;
      if (phase === "trial" || phase === "checking") return; // 체험 모드는 DB를 부르지 않는다
      reconciling = true;
      try {
        await reconcileInner();
      } finally {
        reconciling = false;
      }
    }
    function offlineContinue() {
      phase = "offline";
      goReadyGateOnly();
      setStatus("warn", "⚠️ 인터넷 연결 안 됨 · 이 기기에 임시 저장 중");
      scheduleRetry(reconcile);
    }
    async function reconcileInner() {
      if (!recheckOwner()) return;
      var m = readMeta() || freshMeta();
      var wasTrusted = phase === "ready" || phase === "offline" || !!m.syncedAt || m.dirty;
      if (m.pendingClear) {
        var c = await withTimeout(R().clearProgress({ expectedUserId: owner }), 8000);
        if (c.reason === "user_changed") return onUserChanged();
        if (c.ok || c.reason === "no_table") {
          m = readMeta() || m;
          m.pendingClear = false;
          writeMeta(m);
        }
      }
      var res = await withTimeout(R().loadProgress({ expectedUserId: owner }), 8000);
      lastCheck = Date.now();
      if (phase === "login" || phase === "stopped" || loggingOut) return;
      if (!res.ok) {
        if (res.reason === "user_changed") return onUserChanged();
        if (res.reason === "not_logged_in") return toLogin();
        if (res.reason === "no_table") {
          phase = "local-only";
          goReadyGateOnly();
          setStatus("warn", "⚠️ 저장 안 됨(서버 준비 중) · 이 기기에만 임시 저장");
          return;
        }
        if (wasTrusted) {
          // 같은 주인의 로컬 사본으로 계속하고 나중에 다시 맞춘다.
          // 단, 로그인이 만료됐는데 확인할 수 없으면(오프라인) 먼저 본인인지 묻는다(로그아웃 없이 넘겨받은 태블릿).
          var pk = peek();
          if (!identityOk && pk && pk.expiresAt && pk.expiresAt * 1000 < Date.now()) {
            phase = "confirm-id";
            showGate("confirm-id", null, {
              onYes: function () {
                if (!recheckOwner()) return;
                identityOk = true;
                offlineContinue();
              },
              onNo: function () {
                logout(null);
              },
            });
            return;
          }
          return offlineContinue();
        }
        phase = "error";
        showGate("error");
        scheduleRetry(function () {
          showGate("loading");
          reconcile();
        });
        return;
      }
      clearTimeout(retryTimer);
      retryTimer = null;
      retryMs = 0;
      m = readMeta() || freshMeta();
      var row = m.pendingClear ? null : res.row;
      if (row && !usable(row)) {
        forceOverwrite = true; // 다른 판(storageKey 버전)의 기록은 쓰지 않고, 저장할 때 덮어쓴다
        row = null;
      }
      if (!row) {
        if (res.row == null && m.syncedAt && !m.dirty && !m.pendingClear) {
          // 한 번 맞춘 뒤 DB 기록이 사라짐 = 다른 기기에서 처음부터 다시 → 이 기기도 비운다(이 기기에 안 올린 변경은 없음)
          clearAppLocal();
          writeMeta(freshMeta());
          phase = "stopped";
          safeReload();
          return;
        }
        goReady();
        if (hasLocalData() && (m.dirty || m.pendingClear)) markDirtyAndSave();
        else setStatus("good", hasLocalData() ? "✅ 저장됨" : "");
        return;
      }
      if (row.updated_at && row.updated_at === m.syncedAt) {
        // 서버는 그대로 → 이 기기 기록 우선(올리지 못한 변경이 있으면 올린다)
        goReady();
        if (m.dirty) saveNow();
        else setStatus("good", "✅ 저장됨");
        return;
      }
      // 서버가 바뀜(다른 기기에서 했거나 이 기기에서 처음 연다)
      if (!m.dirty || !hasLocalData()) return restore(row); // 이 기기에 안 올린 변경이 없음 → 서버 기록
      if (canon(row.state.keys) === canon(snapshot().keys)) {
        // 내용이 같다(저장 응답만 못 받음) → 맞춘 것으로 본다
        m.syncedAt = row.updated_at;
        m.dirty = false;
        writeMeta(m);
        goReady();
        setStatus("good", "✅ 저장됨");
        return;
      }
      askConflict(row, m); // 둘 다 바뀜 → 학생이 고른다
    }
    function goReadyGateOnly() {
      // 가림막만 걷는다(화면을 떠나 있으면 "확인 중" 가림막으로 둔다)
      if (document.visibilityState === "hidden") showGate("cover");
      else hideGate();
      try {
        window.sessionStorage.removeItem("sciSync:reloads"); // 새로고침 연쇄가 정상으로 끝남
      } catch (e) {
        /* 무시 */
      }
    }
    function goReady() {
      var wasGate = phase !== "ready" && phase !== "offline";
      phase = "ready";
      if (wasGate || covered) goReadyGateOnly();
    }
    function markDirtyAndSave() {
      var m = readMeta() || freshMeta();
      m.dirty = true;
      m.localAt = m.localAt || Date.now();
      writeMeta(m);
      saveNow();
    }
    function scheduleRetry(fn) {
      clearTimeout(retryTimer);
      retryMs = Math.min(retryMs ? retryMs * 2 : 3000, 60000);
      retryTimer = setTimeout(fn, retryMs);
    }

    /* ───── 저장 ───── */
    function schedule(key) {
      if (phase !== "ready" && phase !== "offline") return;
      var now = Date.now();
      if (!pendingSince) pendingSince = now;
      if (key === "meta" && timer) return; // 학습 시간만 바뀜 → 이미 잡힌 저장을 기다린다
      var due = key === "meta" ? now + 20000 : Math.min(now + 1000, pendingSince + 8000);
      clearTimeout(timer);
      timer = setTimeout(saveNow, Math.max(0, due - now));
    }
    async function saveNow(opts) {
      clearTimeout(timer);
      timer = null;
      var ka = !!(opts && opts.keepalive);
      if (loggingOut) return;
      if (phase === "offline" && !ka) {
        // 오프라인: 먼저 DB와 다시 맞춘다(그 안에서 올린다)
        return reconcile();
      }
      if (phase !== "ready" && phase !== "offline") return;
      if (saving) {
        again = true;
        return;
      }
      var m = readMeta();
      if (!m || !m.dirty || m.owner !== owner) return;
      // 요청 전에 로컬 세션이 이 페이지의 주인인지 확인(class1-record.js도 실제 요청 토큰으로 다시 확인한다)
      var p = peek();
      if (!p || p.userId !== owner) {
        if (!ka) recheckOwner();
        return;
      }
      pendingSince = 0;
      var stamp = m.localAt;
      var snap = snapshot();
      var sopts = { expectedUserId: owner, keepalive: ka, force: !!(m.pendingClear || forceOverwrite) };
      if (!sopts.force) sopts.baseUpdatedAt = m.syncedAt || null;
      saving = true;
      if (!ka) setStatus("", "☁️ 저장 중…");
      var res;
      try {
        res = await R().saveProgress(snap, sopts);
      } catch (e) {
        res = { ok: false, reason: "error" };
      }
      saving = false;
      if (phase === "login" || phase === "stopped" || suspended || loggingOut) return;
      if (res && res.ok) {
        var m2 = readMeta() || freshMeta();
        if (m2.owner === owner) {
          if (res.updatedAt) m2.syncedAt = res.updatedAt;
          if (m2.localAt === stamp) m2.dirty = false;
          m2.pendingClear = false; // 새 기록으로 덮어썼으니 지울 필요가 없다
          writeMeta(m2);
        }
        forceOverwrite = false;
        retryMs = 0;
        clearTimeout(retryTimer);
        retryTimer = null;
        if (phase === "offline") phase = "ready";
        setStatus("good", "✅ 저장됨");
      } else {
        var reason = res ? res.reason : "error";
        if (reason === "user_changed") return onUserChanged();
        if (reason === "conflict") {
          // 다른 기기에서 그 사이 저장함 → 덮어쓰지 않고 다시 맞춘다(둘 다 바뀌었으면 학생이 고른다)
          again = false;
          if (!ka) reconcile();
          return;
        }
        if (reason === "no_table") {
          phase = "local-only";
          setStatus("warn", "⚠️ 저장 안 됨(서버 준비 중) · 이 기기에만 임시 저장");
          return;
        }
        if (reason === "not_logged_in") {
          var u = await R().requireUser();
          if (!u.ok && u.reason === "not_logged_in") return toLogin("로그인이 풀렸어요. 다시 로그인하면 이어서 할 수 있어요.");
        }
        if (reason === "too_large") {
          // 다시 시도해도 같다 → 다음 변경 때 다시 시도. 로그아웃할 때도 경고한다(dirty 유지).
          setStatus("bad", "⚠️ 기록이 너무 커서 저장하지 못했어요 · 선생님께 알려 주세요");
        } else {
          setStatus("bad", "⚠️ 저장 실패 · 다시 시도 중");
          scheduleRetry(function () {
            saveNow();
          });
        }
      }
      if (again) {
        again = false;
        saveNow();
      }
    }
    function flushNow() {
      if (phase !== "ready" && phase !== "offline") return;
      flushAllPending(); // 미뤄 둔 입력 저장부터 로컬에 쓴다
      var m = readMeta();
      if (m && m.dirty) saveNow({ keepalive: true });
    }

    return {
      /* createStore가 부른다(동기). 이 앱 기록 store면 true */
      _register: function (prefix, ok) {
        if (root) return prefix.indexOf(root + ":") === 0;
        root = prefix;
        available = ok;
        if (prefix.indexOf(SCI_PREFIX) !== 0) console.warn("[science-sim] storageKey는 'sci6'으로 시작해야 로그아웃 때 지워집니다:", prefix);
        if (!document.body) return true;
        if (!R() || !window.CLASS1_CONFIG) {
          phase = "error";
          showGate("error", "로그인 기능을 불러오지 못했어요. 새로고침해 주세요.");
          return true;
        }
        var p = peek();
        if (!p) {
          var msg = null;
          try {
            msg = window.sessionStorage.getItem("sciSync:loginMsg");
            window.sessionStorage.removeItem("sciSync:loginMsg");
          } catch (e) {
            msg = null;
          }
          if (msg) {
            // 방금 로그아웃했거나 세션이 끊겨 돌아온 경우 → 곧바로 로그인 안내(체험 모드로 흘려보내지 않는다)
            phase = "login";
            if (ok) clearAllSciLocal();
            showGate("login", msg);
            return true;
          }
          // 주인이 "체험"이 아닌 과학 앱 로컬 기록(앞 학생 것)은 먼저 지운다.
          // 체험 기록(owner = "__guest__")만 남겨 새로고침해도 이어서 할 수 있게 한다.
          if (ok) clearForeignSciLocal(GUEST);
          phase = "checking";
          showGate("checking");
          checkLock(); // 잠금 켜짐 → 로그인 안내 / 꺼짐 → 체험 모드
          return true;
        }
        owner = p.userId;
        ownerLabel = p.label || "";
        if (ok) {
          var m = readMeta();
          if (!m || m.owner !== owner) {
            clearAppLocal(); // 다른 사람(또는 주인 모름)의 기록 → 즉시 삭제
            writeMeta(freshMeta());
          }
        }
        phase = "loading";
        showGate("loading");
        return true;
      },
      _localWritesAllowed: function () {
        return phase !== "login" && phase !== "stopped" && phase !== "error" && !suspended;
      },
      _metaKey: metaKey,
      _changed: function (key) {
        if (suspended || !root) return;
        if (phase !== "ready" && phase !== "offline" && phase !== "local-only") return; // 불러오기 전 초기화 쓰기는 변경으로 치지 않는다
        var m = readMeta() || freshMeta();
        m.dirty = true;
        m.localAt = Date.now();
        writeMeta(m);
        schedule(key);
      },
      /* Lesson.create가 Class1Record.init 뒤에 부른다 */
      start: function (o) {
        if (started || !root) return;
        started = true;
        appId = (o && o.appId) || null;
        appTitle = document.title || "";
        if (phase === "error") return;
        var rec = R();
        if (!rec || !rec.requireUser || (o && o.recordReady === false)) {
          phase = "error";
          showGate("error", "로그인 기능을 불러오지 못했어요. 새로고침해 주세요.");
          return;
        }
        if (owner && available) {
          var m0 = readMeta();
          if (m0 && m0.owner === owner) writeMeta(m0); // appId·제목 기록(블로그 로그아웃 때 올릴 수 있게)
        }
        rec.onAuthChange(function (kind) {
          if (phase === "trial" || phase === "checking") return; // 체험 모드에는 끊길 세션이 없다
          if (kind === "user_changed") onUserChanged();
          else toLogin();
        });
        // 어떤 저장소 변경이든(다른 탭 로그인·로그아웃) 주인을 다시 확인한다. 로그인 안내 중이면 로그인되는 즉시 이어서 한다.
        window.addEventListener("storage", function () {
          recheckOwner();
        });
        window.addEventListener("pagehide", function () {
          flushNow();
          cover();
        });
        window.addEventListener("pageshow", function (e) {
          if (e.persisted) onReturn(true); // 뒤로 가기 캐시(bfcache)에서 되살아남 → 얼어 있던 동안의 로그아웃·사용자 변경 확인
        });
        window.addEventListener("focus", function () {
          onReturn(false);
        });
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "hidden") {
            flushNow();
            cover();
          } else onReturn(false);
        });
        try {
          // 블로그에서 로그아웃하기 직전 "미뤄 둔 입력을 로컬에 써 달라"는 요청(블로그가 올린 뒤 지운다)
          if ("BroadcastChannel" in window) {
            var bc = new BroadcastChannel("sci6-sync");
            bc.onmessage = function (e) {
              if (e && e.data && e.data.type === "flush") flushAllPending();
            };
          }
        } catch (e) {
          /* 무시 */
        }
        // 로그인 안내 중이거나 체험 모드면 DB와 맞출 것이 없다(app_progress·app_results를 부르지 않는다).
        if (phase === "login" || phase === "checking" || phase === "trial") return;
        renderWho();
        if (!available) {
          // 이 브라우저는 로컬 사본을 못 씀 → DB와 맞출 수 없음(빈 기록으로 덮어쓰지 않게 동기화하지 않는다)
          phase = "local-only";
          hideGate();
          setStatus("warn", "⚠️ 이 브라우저에서는 저장되지 않아요");
          return;
        }
        // 오프라인 + 만료 토큰이면 supabase가 토큰 갱신을 오래(최대 30초) 다시 시도한다 → 기다리지 않고 맞추기로 넘어간다
        withTimeout(rec.requireUser(), 6000).then(function (u) {
          if (!u.ok && u.reason === "not_logged_in") return toLogin();
          if (u.ok && u.user && u.user.id !== owner) return onUserChanged();
          return reconcile();
        });
      },
      /* "처음부터 다시 하기" */
      reset: function (store) {
        suspended = true;
        stopTimers();
        if (store) store.clearAll();
        if (!root || !available || !owner || phase === "login" || phase === "error") {
          clearAppLocal();
          return Promise.resolve();
        }
        if (!recheckOwner()) return Promise.resolve();
        clearAppLocal();
        var m = freshMeta();
        m.pendingClear = true;
        writeMeta(m);
        if (phase === "local-only" || !R()) return Promise.resolve();
        return withTimeout(R().clearProgress({ expectedUserId: owner }), 6000).then(function (res) {
          if (res.ok || res.reason === "no_table") {
            m.pendingClear = false;
            writeMeta(m);
          }
        });
      },
      phase: function () {
        return phase;
      },
      owner: function () {
        return owner;
      },
      /* 체험 모드(비로그인 + 잠금 꺼짐)인가 — 결과 저장·Edge Function 호출을 건너뛸 때 쓴다 */
      isTrial: function () {
        return phase === "trial";
      },
      logout: function () {
        return logout(null);
      },
      clearAllLocal: clearAllSciLocal,
    };
  })();
  SciSim.Sync = Sync;

  SciSim.createStore = function (prefix) {
    if (!prefix || typeof prefix !== "string") throw new Error("[science-sim] storageKey가 필요합니다.");
    var memory = {}; // localStorage를 못 쓸 때의 대체(이번 화면에서만 유지)
    var ok = testStorage();
    var tracked = Sync._register(prefix, ok); // 로그인·기록 주인 확인(동기). 이 앱 기록이면 변경을 DB 동기화에 알린다.
    function canWrite() {
      return ok && Sync._localWritesAllowed();
    }
    function changed(key) {
      if (tracked) Sync._changed(key);
    }

    function full(key) {
      return prefix + ":" + key;
    }

    return {
      available: ok,
      get: function (key, def) {
        var raw = null;
        try {
          raw = canWrite() ? window.localStorage.getItem(full(key)) : memory[full(key)] || null;
        } catch (e) {
          raw = null;
        }
        if (raw == null) return def;
        try {
          return JSON.parse(raw);
        } catch (e) {
          return def;
        }
      },
      set: function (key, value) {
        var raw;
        try {
          raw = JSON.stringify(value);
        } catch (e) {
          return false;
        }
        memory[full(key)] = raw;
        if (!canWrite()) return false;
        try {
          var before = window.localStorage.getItem(full(key));
          window.localStorage.setItem(full(key), raw);
          if (before !== raw) changed(key);
          return true;
        } catch (e) {
          return false;
        }
      },
      remove: function (key) {
        delete memory[full(key)];
        try {
          if (canWrite() && window.localStorage.getItem(full(key)) != null) {
            window.localStorage.removeItem(full(key));
            changed(key);
          }
        } catch (e) {
          /* 무시 */
        }
      },
      clearAll: function () {
        Object.keys(memory).forEach(function (k) {
          if (k.indexOf(prefix + ":") === 0) delete memory[k];
        });
        if (!ok) return;
        var removed = removeLocalKeys(function (k) {
          return k.indexOf(prefix + ":") === 0 && k !== Sync._metaKey();
        });
        if (removed && canWrite()) changed("*");
      },
    };
  };

  /* 작은 DOM 도우미(다른 science-sim 파일이 함께 쓴다) */
  SciSim.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  /* "**굵게**" 표시만 지원하는 안전한 글 → DOM(innerHTML을 쓰지 않는다)
   *   SciSim.rich("지시약은 **색깔**이 변해요") → <span>지시약은 <strong>색깔</strong>이 변해요</span> */
  SciSim.rich = function (text, tag) {
    var node = document.createElement(tag || "span");
    String(text == null ? "" : text)
      .split("**")
      .forEach(function (part, i) {
        if (!part) return;
        if (i % 2) {
          var b = document.createElement("strong");
          b.textContent = part;
          node.appendChild(b);
        } else node.appendChild(document.createTextNode(part));
      });
    return node;
  };

  /* 받침에 따라 조사 붙이기: SciSim.josa("식초", "을", "를") → "식초를"
   * 한글이 아닌 글자(A, B 등)로 끝나면 받침 없는 쪽을 쓴다("실험 A를"). */
  SciSim.josa = function (word, a, b) {
    word = String(word);
    var ch = word.charCodeAt(word.length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return word + b;
    return word + ((ch - 0xac00) % 28 ? a : b);
  };

  /* 입력이 멈춘 뒤 저장(너무 자주 쓰지 않게)
   *   var save = SciSim.debounce(fn, 250);  save(...) → 250ms 동안 입력이 없으면 fn 실행
   *   save.flush()  → 기다리는 저장이 있으면 지금 바로 실행
   * 기다리는 저장은 페이지를 떠나거나(pagehide) 탭이 숨겨질 때(visibilitychange → hidden)
   * 모두 바로 실행된다(새로고침·탭 닫기 직전에 적은 마지막 글자가 사라지지 않게). */
  var pendingSaves = [];
  function flushAllPending() {
    pendingSaves.splice(0).forEach(function (f) {
      try {
        f();
      } catch (e) {
        /* 무시 */
      }
    });
  }
  if (!SciSim.__flushHooked) {
    SciSim.__flushHooked = true;
    window.addEventListener("pagehide", flushAllPending);
    window.addEventListener("beforeunload", flushAllPending);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushAllPending();
    });
  }
  SciSim.flushPendingSaves = flushAllPending;

  SciSim.debounce = function (fn, ms) {
    var t = null;
    var pending = null; // { self, args }
    function runNow() {
      clearTimeout(t);
      t = null;
      var i = pendingSaves.indexOf(runNow);
      if (i >= 0) pendingSaves.splice(i, 1);
      if (!pending) return;
      var p = pending;
      pending = null;
      fn.apply(p.self, p.args);
    }
    function debounced() {
      pending = { self: this, args: arguments };
      clearTimeout(t);
      if (pendingSaves.indexOf(runNow) < 0) pendingSaves.push(runNow);
      t = setTimeout(runNow, ms || 300);
    }
    debounced.flush = runNow;
    return debounced;
  };

  /* 기기 UI 설정(2026-09-25) — 전체 화면 보기·머리말 접기처럼 "이 기기에서 학생이 고른 화면 모양" 기억용.
   * sci6 접두사를 일부러 안 쓴다: 로그아웃 때 지우는 학습 기록이 아니라 기기 UI 취향이라 로그인·로그아웃과 무관하게 남아야 한다. */
  SciSim.uiPref = {
    get: function (key) {
      try {
        var v = localStorage.getItem("ssUiPref:" + key);
        if (v === "1") return true;
        if (v === "0") return false;
        return null;
      } catch (e) {
        return null;
      }
    },
    set: function (key, val) {
      try {
        localStorage.setItem("ssUiPref:" + key, val ? "1" : "0");
      } catch (e) {
        /* 저장 안 돼도 화면은 그대로 동작(기본값으로) */
      }
    },
  };
})();
