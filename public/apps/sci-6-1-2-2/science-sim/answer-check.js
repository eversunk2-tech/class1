/*
 * science-sim/answer-check.js — 학생 답 되짚기·차단 (정본: scripts/templates/science-sim/)
 * 설계: docs/science/answer-check/spec.md (판정 3단계 ok / rethink / block)
 *
 * ▶ 무엇을 하나
 *   예상하기·정리하기에서 학생이 적은 글을 넘어가기 직전에 한 번 살펴본다.
 *     ok      … 그대로 통과(학생은 아무것도 보지 못한다)
 *     rethink … "다시 한번 생각해서 써 볼까요?" 카드. **그대로 제출도 할 수 있다.** 질문당 평생 1번만 뜬다.
 *     block   … "아직 이 질문과 어울리는 답이 아니에요" 카드. 다시 쓰기 전에는 못 넘어간다.
 *
 * ▶ 느슨한 단계(stage: "curiosity") — '더 탐구하고 싶은 점'
 *   정답이 없는 질문이라 **무의미한 글·완전히 딴 이야기만** 막는다(ok / block만 쓴다).
 *   내용이 아쉽다는 이유로는 절대 되짚지 않는다(rethink 없음). Edge Function도 이 단계는 같은 기준으로 본다.
 *
 * ▶ 체험 모드(비로그인 · 사이트 잠금 꺼짐) — 2026-09-26 사용자 결정: **체험 모드도 Gemini 판정을 받는다.**
 *   로그인 토큰 대신 공개 키로 check-answer를 부른다(Class1Record.callFunction의 allowAnon). 서버는 비로그인 호출에
 *   허용 출처·IP별 한도를 걸고, Secret CHECK_ANSWER_ALLOW_ANON=off면 받지 않는다 → 그때는 "응답 못 받음"과 같게(막지 않음).
 *   판정 기록(되짚음·차단 횟수)은 이 기기에만 남는다(체험 모드는 서버에 학습 기록을 올리지 않는다).
 *
 * ▶ 차단은 좁게(중요)
 *   - 로컬 규칙(Rules.block)은 **누가 봐도 확실한 무의미**만 막는다(자모만·같은 글자 반복·숫자만·질문 그대로 복사·자판 뭉개기).
 *   - "질문과 관련이 없다(off-topic)"는 판단은 **오직 Gemini(check-answer Edge Function)만** 내린다.
 *   - Gemini가 응답하지 못하면(오프라인·시간 초과·오류·한도 초과) **절대 막지 않는다** — rethink 수준으로 낮춰 권하고 통과시킨다.
 *     이때는 이 질문을 "되짚음"으로 기록하지 않는다(고쳐 쓰면 다시 확인 — 2026-09-26). 대기 한도는 9초(서버의 Gemini 대기 7초).
 *   - 틀렸지만 질문과 관련 있는 답은 막지 않는다(rethink까지만).
 *   - 같은 질문에서 3번째로 막히면 "🙋 선생님과 확인했어요 · 계속하기" 버튼이 나타난다(학생이 갇히지 않게).
 *
 * ▶ 저장 (저장 키 버전을 올리지 않는다 — 기존 기록이 그대로 이어진다)
 *   store의 새 키 "answerCheck": { "<질문 키>": { nudged, blockCount, teacherOverride, okFp } }
 *   predict.qa()/conclude.qa()가 이 값을 읽어 detail.qa 항목에 nudged/blockCount/teacherOverride를 **값이 있을 때만** 덧붙인다.
 *
 * ▶ 앱이 할 일 — 없다
 *   index.html에 <script src="./science-sim/answer-check.js"></script> 한 줄만 있으면,
 *   predict.js가 자기 화면(data-stage)을 찾아 스스로 등록하고 lesson.js가 단계 이동 직전에 불러 준다.
 *   이 파일을 불러오지 않은 앱은 지금까지와 똑같이 동작한다(모든 훅이 SciSim.AnswerCheck 없으면 그냥 통과).
 *
 *   SciSim.AnswerCheck.configure({ appId, store })   // lesson.js(Lesson.create)가 호출
 *   SciSim.AnswerCheck.register(stageId, fn)         // predict.js가 호출. fn: () → true | Promise<bool>
 *   SciSim.AnswerCheck.checkStage(stageId)           // lesson.js가 단계 이동 직전에 호출 → true | Promise<bool>
 *   SciSim.AnswerCheck.verify({ key, stage, question, answer, model, hint, mount, focus })  → Promise<bool>
 *   SciSim.AnswerCheck.passedFor(key, text, question) → 이 글이 검사를 통과한 그 글인지(화면의 "✔ 잘 적었어요"는 이때만 보여 준다)
 *   SciSim.AnswerCheck.settled(key, text, question, o) → verify()가 아무것도 보여 주지 않고 통과시킬 글인지(마치기 검사에서 헛걸음하지 않으려고)
 *   SciSim.AnswerCheck.registerFinish(mount, fn)     // conclude.js가 호출. fn(reveal): '학습 마치기'를 누를 때 한 번 더 본다
 *   SciSim.AnswerCheck.checkFinish({ goTo })         // lesson.js가 '학습 마치기'에서 호출 → Promise<bool>
 *   SciSim.AnswerCheck.qaFields(key)                 → {} | { nudged, blockCount, teacherOverride }
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  var STORE_KEY = "answerCheck"; /* store의 새 키 — 저장 구조·버전은 그대로 */
  var TIMEOUT_MS = 9000; /* 클라이언트 전체 대기 한도 — 서버의 Gemini 대기(7초) + 함수가 처음 켜지는 시간. 2026-09-26: 3.5초로는 Gemini가 조금만 늦어도 판단을 놓쳤다(로그 "Gemini 호출 실패 timeout") */
  var TEACHER_AT = 3; /* 같은 질문에서 이 횟수째 block부터 교사 확인 버튼 */
  var MAX_QUESTION = 300;
  var MAX_ANSWER = 500;
  var APP_ID_RE = /^sci-[0-9]{1,2}-[0-9]-[0-9]{1,2}-[0-9]{1,2}$/;

  var LENIENT_STAGE = "curiosity"; /* 정답이 없는 질문 — ok / block만 쓴다(rethink 없음) */

  var cfg = { appId: null, store: null };
  var stageChecks = {}; /* { "<data-stage>": [fn, …] } */
  var finishChecks = []; /* [{ mount, fn }] — '학습 마치기'를 누를 때 한 번 더 보는 검사 */

  /** 체험 모드(비로그인 · 사이트 잠금 꺼짐)인지. 이때는 로그인 주인 확인 없이 공개 키로 묻는다(ask). */
  function isTrial() {
    try {
      return !!(SciSim.Sync && SciSim.Sync.isTrial && SciSim.Sync.isTrial());
    } catch (e) {
      return false;
    }
  }

  /* ───────── 저장 ───────── */

  function all() {
    if (!cfg.store) return {};
    var v = cfg.store.get(STORE_KEY, {});
    return v && typeof v === "object" ? v : {};
  }
  function get(key) {
    var m = all();
    var s = m[key];
    if (!s || typeof s !== "object") s = {};
    return {
      nudged: !!s.nudged,
      blockCount: typeof s.blockCount === "number" && s.blockCount > 0 ? s.blockCount : 0,
      teacherOverride: !!s.teacherOverride,
      okFp: typeof s.okFp === "string" ? s.okFp : null,
    };
  }
  function put(key, st) {
    if (!cfg.store) return;
    var m = all();
    m[key] = { nudged: !!st.nudged, blockCount: st.blockCount || 0, teacherOverride: !!st.teacherOverride, okFp: st.okFp || null };
    cfg.store.set(STORE_KEY, m);
  }

  /* 같은 글을 다시 검사하지 않기 위한 짧은 지문(djb2). 글 내용은 저장하지 않는다. */
  function fp(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return String(h) + ":" + text.length;
  }

  /* ───────── 1안 — 로컬 규칙(확실한 무의미만) ───────── */

  function normalize(s) {
    /* 공백·문장부호 제거(질문 복사 비교용) */
    return String(s || "")
      .replace(/\s+/g, "")
      .replace(/[.,!?~·:;'"“”‘’()\[\]{}<>\-–—/\\|^*_+=%]/g, "");
  }

  var Rules = {
    /** 확실한 무의미면 막는 까닭(문구)을, 아니면 null을 돌려준다. 정답은 절대 알려 주지 않는다. */
    block: function (text, question) {
      var t = String(text || "").trim();
      if (!t) return null;
      var nospace = t.replace(/\s+/g, "");

      /* ① 자음·모음만 (완성형 글자 없이 낱자만) */
      if (/^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(t)) return "자음이나 모음만 적었어요. 완성된 문장으로 다시 써 볼까요?";

      /* ② 같은 글자 반복 — 글자 종류가 2가지 이하이거나 같은 글자가 5번 이상 잇달아 나옴
       *    (6자 이상일 때만 본다: "길어길어"·"네네네네" 같은 짧은 답까지 막지 않으려고 — review L6) */
      var kinds = 0;
      var seen = Object.create(null);
      for (var i = 0; i < nospace.length; i++) {
        var ch = nospace.charAt(i);
        if (!seen[ch]) {
          seen[ch] = 1;
          kinds++;
        }
      }
      if (nospace.length >= 6 && (kinds <= 2 || /(.)\1{4,}/.test(nospace)))
        return "같은 글자를 반복해서 적었어요. 내 생각을 문장으로 써 볼까요?";

      /* ③ 숫자만 */
      if (/^[\d\s.,%]+$/.test(t)) return "숫자만 적었어요. 그렇게 생각한 까닭을 문장으로 써 볼까요?";

      /* ④ 질문을 그대로 옮겨 적음
       *    질문의 90% 이상이 **연달아** 답 안에 들어 있고, 답이 질문보다 거의 길지 않을 때만 막는다.
       *    (설계 §1.1은 60%였지만, "산성화된 호수에 …을 뿌리면 산성이 약해지기 때문입니다"처럼
       *     질문 문장을 자연스럽게 되받아 쓴 좋은 답까지 걸려서 90%로 좁혔다 — 오차단 방지) */
      var q = normalize(question);
      var a = normalize(t);
      if (q.length >= 10 && a.length >= 6) {
        var need = Math.ceil(q.length * 0.9);
        if (a.length >= need && a.length <= q.length * 1.15 + 4) {
          for (var s = 0; s + need <= q.length; s++) {
            if (a.indexOf(q.substr(s, need)) >= 0) return "질문을 그대로 옮겨 적었어요. 내 생각을 나만의 말로 써 볼까요?";
          }
        }
      }

      /* ⑤ 자판 뭉개기 — 완성형 한글이 하나도 없고 영문이 70% 이상 */
      if (!/[가-힣]/.test(t)) {
        var letters = (nospace.match(/[a-zA-Z]/g) || []).length;
        if (nospace.length >= 4 && letters / nospace.length >= 0.7) return "알아볼 수 있는 말로 다시 써 볼까요?";
      }
      return null;
    },
  };

  /* 정리하기 통과 지름길: 모범 답안의 낱말이 답에 이미 들어 있으면 굳이 물어보지 않는다(막는 판정이 아니다). */
  function modelWordHit(answer, model) {
    var text = Array.isArray(model) ? model.join(" ") : String(model || "");
    if (!text) return false;
    var a = normalize(answer);
    if (!a) return false;
    var words = text.split(/[\s.,!?~·:;'"“”‘’()\[\]{}<>\-–—/\\|]+/);
    for (var i = 0; i < words.length; i++) {
      var w = normalize(words[i]);
      if (w.length >= 3 && a.indexOf(w) >= 0) return true;
    }
    return false;
  }

  /* ───────── 2안 — check-answer Edge Function 호출 ───────── */

  /** → Promise<{ verdict, message } | null>. null이면 "판단하지 못했다"(절대 막지 않는다). */
  function ask(payload) {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(null);
      var rec = window.Class1Record;
      if (!rec || typeof rec.callFunction !== "function") return Promise.resolve(null);
      var trial = isTrial();
      var call = rec
        .callFunction("check-answer", payload, {
          timeoutMs: TIMEOUT_MS,
          expectedUserId: !trial && SciSim.Sync && SciSim.Sync.owner ? SciSim.Sync.owner() : undefined,
          allowAnon: true, // 체험 모드(비로그인)도 판정을 받는다(2026-09-26) — 로그인 세션이 없으면 공개 키로
        })
        .then(function (res) {
          if (!res || !res.ok || !res.data || res.data.ok !== true) return null;
          var v = res.data.verdict;
          if (v !== "ok" && v !== "rethink" && v !== "block") return null;
          return { verdict: v, message: typeof res.data.message === "string" ? res.data.message.slice(0, 300) : "" };
        })
        .catch(function () {
          return null;
        });
      /* 함수 호출이 아무 대답도 못 하는 경우까지 포함한 전체 대기 한도 */
      return Promise.race([
        call,
        new Promise(function (resolve) {
          setTimeout(function () {
            resolve(null);
          }, TIMEOUT_MS);
        }),
      ]);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* ───────── 카드·스피너 ───────── */

  /* 카드가 떠 있는 동안에는 같은 칸의 글자 수 안내("✔ 잘 적었어요")를 감춘다(문구가 서로 엇갈리지 않게). */
  function markOpen(mount, open) {
    var card = mount && mount.parentNode;
    if (card && card.classList) card.classList.toggle("ss-ac-open", !!open);
  }

  function clearCard(mount) {
    if (!mount) return;
    var old = mount.querySelector(".ss-ac-card, .ss-ac-wait");
    while (old) {
      old.parentNode.removeChild(old);
      old = mount.querySelector(".ss-ac-card, .ss-ac-wait");
    }
    markOpen(mount, false);
  }

  function showWait(mount) {
    if (!mount) return;
    clearCard(mount);
    mount.appendChild(
      el("p", { class: "ss-ac-wait", role: "status", "aria-live": "polite" }, [el("span", { class: "ss-ac-spin", "aria-hidden": "true" }), "답을 다시 확인하고 있어요…"])
    );
  }

  function scrollIntoView(node) {
    try {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (e) {
      /* 무시 */
    }
  }

  /**
   * 카드를 띄우고 학생이 버튼을 누를 때까지 기다린다.
   * kind: "rethink"(그대로 제출 가능) | "block"(다시 쓰기만, 3번째부터 교사 확인)
   * → Promise<"again" | "submit" | "teacher">
   * 학생이 입력칸의 글을 고치면 카드를 "again"으로 닫는다 — 그래야 '다음 단계'를 누를 때
   * 아무 일도 안 일어나지 않고 **고친 글로 다시 검사**된다(review M2).
   */
  function showCard(o) {
    return new Promise(function (resolve) {
      var mount = o.mount;
      clearCard(mount);
      var done = false;
      var onEdit = null;
      function finish(how) {
        if (done) return;
        done = true;
        if (onEdit && o.focus) o.focus.removeEventListener("input", onEdit);
        clearCard(mount);
        if (o.focus && how !== "edited") {
          try {
            o.focus.focus();
          } catch (e) {
            /* 무시 */
          }
        }
        resolve(how === "edited" ? "again" : how);
      }
      if (o.focus) {
        onEdit = function () {
          finish("edited"); /* 글을 고치는 순간 카드를 닫는다(포커스는 입력칸에 그대로 둔다) */
        };
        o.focus.addEventListener("input", onEdit);
      }

      var buttons = [el("button", { type: "button", class: "ss-btn ss-btn-primary", text: "✏️ 다시 써 볼게요", onclick: function () { finish("again"); } })];
      if (o.kind === "rethink")
        buttons.push(el("button", { type: "button", class: "ss-btn ss-btn-ghost", text: o.submitLabel || "그대로 제출할게요", onclick: function () { finish("submit"); } }));

      var children = [
        el("p", { class: "ss-ac-title", text: o.kind === "block" ? "🚫 아직 이 질문과 어울리는 답이 아니에요" : "🤔 다시 한번 생각해서 써 볼까요?" }),
        el("p", { class: "ss-ac-msg", text: o.message }),
        el("div", { class: "ss-ac-actions" }, buttons),
      ];
      if (o.kind === "block" && o.teacher) {
        children.push(
          el("div", { class: "ss-ac-teacher" }, [
            el("button", { type: "button", class: "ss-btn ss-btn-ghost", text: "🙋 선생님과 확인했어요 · 계속하기", onclick: function () { finish("teacher"); } }),
          ])
        );
      }
      var card = el("div", { class: "ss-ac-card ss-ac-" + o.kind, role: "status", "aria-live": "polite" }, children);
      mount.appendChild(card);
      markOpen(mount, true);
      scrollIntoView(card);
    });
  }

  /* ───────── 검사 ───────── */

  function payloadFor(o, priorBlocks) {
    var p = {
      appId: cfg.appId,
      stage: o.stage === "conclude" || o.stage === LENIENT_STAGE ? o.stage : "predict",
      question: String(o.question || "").slice(0, MAX_QUESTION),
      answer: String(o.answer || "").slice(0, MAX_ANSWER),
      priorBlocks: Math.max(0, Math.min(2, priorBlocks || 0)),
    };
    var model = Array.isArray(o.model) ? o.model.join(" ") : o.model;
    if (model) p.model = String(model).slice(0, 600);
    if (o.hint) p.hint = String(o.hint).slice(0, 300);
    return p;
  }

  /**
   * 이 글이 "검사를 통과한 글"인지(= 화면에 칭찬 문구를 보여도 되는지).
   * 통과한 그 글자 그대로일 때만 true. 글을 고치면 다시 false가 된다.
   * 확실한 무의미(로컬 규칙)는 어떤 경우에도 칭찬하지 않는다.
   */
  function passedFor(key, text, question) {
    var t = String(text || "").trim();
    if (!t) return false;
    var st = get(key);
    if (!st.okFp || st.okFp !== fp(t)) return false;
    return !Rules.block(t, question);
  }

  /**
   * verify()가 카드도 스피너도 보여 주지 않고 그대로 통과시킬 글인지.
   * '학습 마치기' 검사에서 헛되이 단계를 옮기거나 서버를 부르지 않으려고 미리 본다.
   * (true면 "이미 정리된 글" — 다시 묻지 않는다. false면 verify()를 불러 봐야 안다.)
   */
  function settled(key, text, question, o) {
    var t = String(text || "").trim();
    if (!t) return true; /* 빈 글은 글자 수 조건이 따로 본다 */
    var st = get(key);
    if (st.teacherOverride) return true;
    if (Rules.block(t, question)) return false; /* 확실한 무의미는 언제든 다시 막는다 */
    if (st.nudged) return true;
    if (st.okFp && st.okFp === fp(t)) return true;
    if (o && o.stage === "conclude" && modelWordHit(t, o.model)) return true;
    return false;
  }

  /** 답 하나를 검사한다. → Promise<bool>(true면 넘어가도 된다) */
  function verify(o) {
    var key = o.key;
    var text = String(o.answer || "").trim();
    var lenient = o.stage === LENIENT_STAGE; /* 정답이 없는 질문 — 되짚지 않고 ok/block만 쓴다 */
    var st = get(key);
    /* 통과한 글을 기억해 둔다 → 같은 글은 다시 묻지 않고, 화면의 "잘 적었어요"도 이 값으로만 켠다 */
    function pass() {
      st.okFp = fp(text);
      put(key, st);
      return true;
    }

    /* 선생님이 확인해 준 질문은 늘 통과 */
    if (st.teacherOverride) return Promise.resolve(pass());

    /* ① 로컬 규칙 — 확실한 무의미(되짚기 1회 제한 없이 매번 검사한다) */
    var why = Rules.block(text, o.question);
    if (why) {
      st.blockCount += 1;
      put(key, st);
      return showCard({
        kind: "block",
        message: why,
        mount: o.mount,
        focus: o.focus,
        teacher: st.blockCount >= TEACHER_AT,
      }).then(function (how) {
        if (how === "teacher") {
          st.teacherOverride = true;
          return pass();
        }
        return false;
      });
    }

    /* ② 이미 한 번 되짚어 준 질문은 늘 통과 */
    if (st.nudged) return Promise.resolve(pass());

    /* ③ 방금 통과시킨 것과 같은 글이면 다시 묻지 않는다 */
    if (st.okFp && st.okFp === fp(text)) return Promise.resolve(true);

    /* ④ 정리하기 통과 지름길(모범 답안 낱말이 이미 들어 있음) */
    if (o.stage === "conclude" && modelWordHit(text, o.model)) return Promise.resolve(pass());

    /* ⑤ 체험 모드도 아래에서 Gemini에게 묻는다(2026-09-26 사용자 결정 — 전에는 로컬 규칙만으로 통과시켰다). */

    /* ⑥ Gemini에게 묻는다(응답하지 못하면 절대 막지 않는다) */
    if (cfg.appId && !APP_ID_RE.test(cfg.appId)) return Promise.resolve(true);
    showWait(o.mount);
    return ask(payloadFor(o, st.blockCount)).then(function (r) {
      clearCard(o.mount);
      /* 응답 못 받음 → 되짚기 수준으로 낮춘다. 느슨한 단계는 되짚지 않으므로 그냥 통과. */
      var verdict = r ? r.verdict : lenient ? "ok" : "rethink";
      if (lenient && verdict === "rethink") verdict = "ok"; /* 느슨한 단계는 ok/block만 쓴다 */
      var message = r && r.message ? r.message : "적은 내용을 한 번 더 읽어 보고, 빠진 부분이 없는지 살펴볼까요?";

      if (verdict === "ok") return pass();
      if (verdict === "block") {
        st.blockCount += 1;
        put(key, st);
        return showCard({
          kind: "block",
          message: message,
          mount: o.mount,
          focus: o.focus,
          teacher: st.blockCount >= TEACHER_AT,
        }).then(function (how) {
          if (how === "teacher") {
            st.teacherOverride = true;
            return pass();
          }
          return false;
        });
      }
      /* rethink — Gemini가 실제로 되짚은 경우에만 이 질문을 "되짚음"으로 기록한다(평생 1회).
       * 대답을 못 받아 되짚기로 낮춘 경우(r 없음)는 기록하지 않는다 — 한 번 늦은 대답 때문에 이 기기에서 이 질문의 검사가
       * 계속 꺼지던 문제(2026-09-26). 이때 "그대로 제출"한 글은 pass()가 okFp로 기억하므로 같은 글은 다시 묻지 않는다. */
      if (r) st.nudged = true;
      put(key, st);
      return showCard({
        kind: "rethink",
        message: message,
        mount: o.mount,
        focus: o.focus,
        submitLabel: o.submitLabel,
      }).then(function (how) {
        /* "그대로 제출"을 고른 글만 통과로 기록한다(고쳐 쓰기를 고르면 아직 통과가 아니다) */
        return how === "again" ? false : pass();
      });
    });
  }

  /* ───────── 단계 훅(predict.js가 등록, lesson.js가 호출) ───────── */

  function checkStage(stageId) {
    var list = stageId ? stageChecks[stageId] : null;
    if (!list || !list.length) return true;
    var i = 0;
    function step() {
      if (i >= list.length) return Promise.resolve(true);
      var r;
      try {
        r = list[i++]();
      } catch (e) {
        return Promise.resolve(true); /* 검사 자체가 실패하면 막지 않는다 */
      }
      return Promise.resolve(r).then(
        function (okv) {
          return okv === false ? false : step();
        },
        function () {
          return true;
        }
      );
    }
    return step();
  }

  /* ───────── 마치기 훅(conclude.js가 등록, lesson.js가 '학습 마치기'에서 호출) ───────── */

  /** 이 화면이 들어 있는 단계 id(카드를 보이지 않는 곳에 띄우지 않으려고 쓴다). */
  function stageOf(node) {
    var n = node;
    while (n && typeof n.getAttribute === "function") {
      var id = n.getAttribute("data-stage");
      if (id) return id;
      n = n.parentNode;
    }
    return null;
  }

  /**
   * '학습 마치기'를 누를 때 한 번 더 보는 검사를 등록한다.
   * mount: 카드가 뜨는 자리(그 단계를 찾는 데 쓴다) · fn(reveal): → bool | Promise<bool>
   * fn은 **카드를 띄우기 직전에만** reveal()을 불러 그 단계를 열어 준다(통과할 답이면 화면이 움직이지 않게).
   */
  function registerFinish(mount, fn) {
    if (typeof fn !== "function") return;
    finishChecks.push({ mount: mount || null, fn: fn });
  }

  /** 등록된 마치기 검사를 차례로 본다. o.goTo(stageId): 그 단계를 열어 주는 함수(선택). → Promise<bool> */
  function checkFinish(o) {
    var list = finishChecks.slice();
    var goTo = o && typeof o.goTo === "function" ? o.goTo : null;
    var i = 0;
    function step() {
      if (i >= list.length) return Promise.resolve(true);
      var item = list[i++];
      var reveal = function () {
        if (!goTo) return;
        var sid = stageOf(item.mount);
        if (sid) goTo(sid);
      };
      var r;
      try {
        r = item.fn(reveal);
      } catch (e) {
        return step(); /* 검사 자체가 실패하면 막지 않는다 */
      }
      return Promise.resolve(r).then(
        function (okv) {
          return okv === false ? false : step();
        },
        function () {
          return step();
        }
      );
    }
    return step();
  }

  SciSim.AnswerCheck = {
    configure: function (o) {
      cfg.appId = o && o.appId ? String(o.appId) : null;
      cfg.store = o ? o.store : null;
    },
    register: function (stageId, fn) {
      if (!stageId || typeof fn !== "function") return;
      (stageChecks[stageId] = stageChecks[stageId] || []).push(fn);
    },
    checkStage: checkStage,
    registerFinish: registerFinish,
    checkFinish: checkFinish,
    verify: verify,
    passedFor: passedFor,
    settled: settled,
    isTrial: isTrial,
    /** detail.qa 항목에 덧붙일 값(값이 있을 때만). 기존 항목 모양은 바꾸지 않는다. */
    qaFields: function (key) {
      var st = get(key);
      var out = {};
      if (st.nudged) out.nudged = true;
      if (st.blockCount) out.blockCount = st.blockCount;
      if (st.teacherOverride) out.teacherOverride = true;
      return out;
    },
    /* 시험·점검용(내부) */
    _rules: Rules,
    _timeoutMs: TIMEOUT_MS,
    _teacherAt: TEACHER_AT,
    _lenientStage: LENIENT_STAGE,
  };
})();
