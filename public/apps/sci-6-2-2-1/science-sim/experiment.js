/*
 * science-sim/experiment.js — 실험하기 화면 공통 틀 (정본: scripts/templates/science-sim/)
 *
 * 화면 틀(3D/2D 실험 화면 + 조작 패널), 조건 고르기 버튼, 실험 단계(A→B) 잠금·진행률,
 * 실행 버튼, 관찰·기록 카드(보기 고르기 또는 수치 입력), 기록 한눈에 보기 표, 3D↔2D 전환을 맡는다.
 * 차시 앱은 "무엇을 그리고 어떤 결과가 나오는지"(view, observe, makeRecord)만 만든다.
 *
 *   var exp = SciSim.Experiment.create({
 *     root: document.getElementById("experiment-root"),
 *     store: store, records: records,                        // SciSim.createStore / SciSim.RecordStore
 *     intro: node | null,                                    // 선택: 실험 전에 알아 둘 내용(카드 안에 넣는다)
 *     factors: [                                             // 바꿀 조건(보통 1~3개). 순서대로 ①②… 카드가 된다.
 *       { id: "sol", title: "용액 고르기", columns: 2,
 *         options: [{ id: "식초", label: "식초", icon: function () { return node; } }] },
 *       { id: "ind", title: "지시약 고르기", options: [...],
 *         note: function (sel) { return "선택에 따른 도움말" | null; } },
 *       { id: "obj", title: "물체 고르기", options: [...],
 *         visible: function (optionId, sel) { return true | false; },   // 선택: 다른 조건에 따라 보기를 숨긴다(예: 고른 장면의 물체만).
 *         phaseTag: false },                                  //  숨겨진 보기가 골라져 있으면 선택이 풀린다. phaseTag: false면 보기 아래 단계 이름을 쓰지 않는다(잠김 안내는 그대로)
 *     ],
 *     phases: [                                              // 실험 단계. 앞 단계를 다 기록해야 다음 단계가 열린다.
 *       { id: "A", name: "실험 A", title: "…", lead: "안내 문장",
 *         cells: [{ sol: "식초", ind: "리트머스파랑" }, …],     // 이 단계에서 기록할 조건 조합
 *         trials: 1 },                                        // 선택: 같은 조건 반복 측정 횟수(수치 측정형은 보통 3)
 *     ],
 *     doneLead: "모든 실험을 기록했어요 …",
 *     cellKey: function (sel) { return sel.sol + "|" + sel.ind; },
 *     runLabel: function (sel) { return "▶ … 넣기"; },
 *     busyLabel: "실험하는 중… 잘 지켜보세요 👀",               // 선택: 실행 중 버튼 글자(문자열 또는 function (sel))
 *     view: {
 *       build3D: function (container, ctx) { return Promise<view|null>; },   // null이면 2D로 대신한다
 *       build2D: function (container, ctx) { return view; },
 *       //  ctx.onPick({ sel: {...부분 선택} })  ← 3D/2D에서 물체를 눌렀을 때 호출
 *       //  ctx.onLost()                       ← 3D 컨텍스트를 잃었을 때(자동으로 2D 전환)
 *       //  view = { highlight(sel), run(sel) → Promise, showInstant(sel), clear(), resetView(), dispose(),
 *       //           whenVisible?(ms) → Promise }
 *       tip3D: "…", tip2D: "…",
 *     },
 *     observe: function (sel) {                               // 실행이 끝난 뒤 관찰·기록 카드 내용
 *       return { question: "…", body: node|null,
 *                type: "choice", choices: ["붉은색으로 변함", …] }            // 색 관찰형
 *       // 또는 { question, body, type: "numeric",
 *       //        fields: [{ id: "time", label: "걸린 시간", unit: "초", step: 0.1, min: 0, max: 60, value: 2.4 }] }  // 수치 측정형
 *       //   fields에 글 칸도 섞을 수 있다: { id: "sentence", kind: "text", label: "…", placeholder: "…", minLength: 1, maxLength: 200 }
 *       //   (글 칸 값은 앞뒤 공백을 뺀 문자열. 비어 있거나 minLength보다 짧으면 기록할 수 없다)
 *       // ── 선택: 기록 전에 학생 입력 확인하기(공식 훅) ──
 *       //   check: function (observed, ctx) { return true | "틀렸을 때 피드백" | { ok, message, node }; },
 *       //     observed: 고른 보기 문자열 | { fieldId: 값 }. ctx = { sel, tries: 이번 관찰 카드에서 틀린 횟수(같은 답 반복은 세지 않음) }
 *       //     check가 있으면 관찰 카드에 '확인하기' 버튼이 생기고, 확인을 통과해야 '기록하기'가 켜진다.
 *       //     입력을 바꾸면 다시 확인해야 한다. 같은 답으로 다시 누르면 check를 부르지 않고 앞 피드백만 다시 보여 준다.
 *       //     check가 오류를 던지면 통과시키지 않는다(fail-closed). 글 칸·수치 칸에서 Enter = 확인하기.
 *       //   checkLabel: "✔️ 확인하기",  okMessage: "⭕ 맞아요! …",      // 선택: 버튼 글자, 통과 기본 문구
 *       //   retryLabel: "🔁 다시 실행해 보기",                          // 선택: 틀렸을 때 보이는 '다시 실행' 버튼(같은 조건으로 다시 실행)
 *     },
 *     check: function (observed, ctx) { … },                 // 선택: 모든 관찰 카드에 쓰는 확인 함수(observe가 돌려준 check가 먼저)
 *     beforeRecord: function (sel, observed) { return true | "막는 까닭"; },  // 선택: 기록 직전 마지막 검사(문자열이면 토스트로 알리고 기록하지 않음)
 *     canRun: function (sel) { return true | "먼저 할 일 안내"; },              // 선택: 실행 전 검사(문자열이면 토스트로 알리고 실행하지 않음)
 *     onRunBlocked: function (sel, message) {},             // 선택: canRun이 막았을 때(할 일 위치로 스크롤 등)
 *     makeRecord: function (sel, observed) { return { … }; },  // observed: 고른 보기 문자열 | { fieldId: 숫자 }
 *     describeRecord: function (rec) { return "식초 + 푸른색 리트머스 → 붉은색으로 변함"; },
 *     miniTable: { title: "…", rows: [{ id, label }], cols: [{ id, label }], sel: function (row, col) { return {...}; } },  // 선택
 *     skipCells: [                                          // 선택: 안전 등의 까닭으로 '관찰하지 않는' 조합
 *       { cell: { sol: "묽은 염산", method: "냄새" },            //  - phases[].cells에 있어도 자동으로 빠진다(진행률·잠금 계산에서 제외)
 *         title: "⚠️ 이 실험은 하지 않아요",                     //  - 이 조합을 고르면 실행 버튼 대신 안내 카드가 뜬다(애니메이션·기록 없음)
 *         text: "묽은 염산은 자극성이 강해 냄새를 맡지 않아요.",   //  - 미니 표에는 🚫로 표시한다
 *         why: "왜 그럴까요? …",                                 //  (선택) 한 번 더 생각해 볼 질문
 *         runLabel: "🚫 안전을 위해 하지 않는 실험이에요",          //  (선택) 실행 버튼 글자
 *         short: "관찰 안 함(안전)" },                            //  (선택) 미니 표·분석 표에 쓸 짧은 말
 *     ],
 *     extras: [node],                                       // 선택: 패널 맨 아래(안전 수칙 등)
 *     toast: function (msg, ms) {},
 *     onRecorded: function (info) {},                       // { record, replaced, phaseCompleted: "A"|null, allDone }
 *     onChange: function () {},                             // 진행 상황이 바뀔 때(단계 이동 막대 갱신 등)
 *     can3D: true,                                          // false면 처음부터 2D(주소에 ?no3d=1이면 자동 false)
 *   });
 *   exp.activate()            → 실험하기 단계에 들어올 때 호출(처음 한 번 실험 화면을 만든다)
 *   exp.select(sel)           → 조건 고르기(분석 단계의 '다시 실험' 버튼 등)
 *   exp.phaseDone(id) / exp.allDone() / exp.progress() → { done, total }
 *   exp.skipInfo(sel)         → 관찰하지 않는 조합이면 skipCells의 그 항목, 아니면 null
 *
 * 저장 키: "scene"(실험 화면에 남아 있는 결과), "view2d"(2D 보기 선택), "intro"(알아 두기 접힘)
 * 실행 버튼을 누르면 실험 화면이 보이도록 먼저 스크롤한 뒤(세로 화면·휴대폰) 애니메이션을 시작한다.
 *
 * ▶ 실제 시간 카운트다운(초시계) — view.run 안에서 쓴다(예: 5초 간격으로 두 번 사진 찍기)
 *   await SciSim.Countdown.run(container, 5, {
 *     label: "초 뒤에 다시 찍어요",       // 숫자 옆 글자
 *     note: "실제 시간 5초",              // 선택: 작은 글자(빨리 감기가 아님을 밝힐 때 등)
 *     onTick: function (remainSec) {},   // 선택: 0.1초마다
 *   });
 *   - 화면 오른쪽 위에 ⏱ 아이콘 + 큰 숫자(5, 4, 3, 2, 1) + 진행 고리를 띄우고, 끝나면 지운다.
 *   - 벽시계(Date.now) 기준이라 탭이 숨겨져도 실제 시간대로 끝난다. 시작·끝은 화면 읽기 프로그램에 알린다.
 *   - container는 position이 relative/absolute인 요소(3D 화면 칸 등). 반환 Promise에 .cancel()이 있다.
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;
  var CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function sameSel(a, b, ids) {
    return ids.every(function (k) {
      return a[k] === b[k];
    });
  }

  // 요소를 고정 머리말 아래로 보이게 스크롤하고, 스크롤이 멈출 때까지 기다린다.
  function scrollIntoViewSafe(node, opts) {
    opts = opts || {};
    var header = document.querySelector(".ss-header");
    var footer = document.querySelector(".ss-footer-nav");
    var top = header ? header.getBoundingClientRect().height : 0;
    var bottom = footer ? footer.getBoundingClientRect().height : 0;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var r = node.getBoundingClientRect();
    var room = vh - top - bottom;
    var fits = r.top >= top - 1 && r.bottom <= vh - bottom + 1;
    if (fits) return Promise.resolve(false);
    // 다 들어가지 않으면 위쪽을 머리말 바로 아래에 맞춘다
    var target = window.scrollY + r.top - top - 8;
    if (opts.align === "nearest" && r.height <= room && r.bottom > vh - bottom) target = window.scrollY + r.bottom - (vh - bottom) + 8;
    target = Math.max(0, target);
    try {
      window.scrollTo({ top: target, behavior: reduceMotion() ? "auto" : "smooth" });
    } catch (e) {
      window.scrollTo(0, target);
    }
    // 스크롤이 멈출 때까지(최대 1.2초). 탭이 숨겨지면 requestAnimationFrame이 멈추므로 타이머로 확인한다.
    return new Promise(function (resolve) {
      if (document.hidden) {
        resolve(true);
        return;
      }
      var last = -1;
      var still = 0;
      var t0 = Date.now();
      (function tick() {
        var y = window.scrollY;
        still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
        last = y;
        if (still >= 4 || Date.now() - t0 > 1200 || document.hidden) resolve(true);
        else setTimeout(tick, 16);
      })();
    });
  }

  function create(o) {
    var store = o.store;
    var records = o.records;
    var factorIds = o.factors.map(function (f) {
      return f.id;
    });
    var toast = o.toast || function () {};
    var sel = {};
    var trial = null; // { sel, observed }
    var busy = false;
    var scene = store.get("scene", {}) || {}; // cellKey → sel (실험 화면에 남아 있는 결과)
    var view = null;
    var viewKind = null;
    var mountToken = 0;
    var mounting = false;
    var can3D = o.can3D !== false && SciSim.Sim3D && SciSim.Sim3D.isWebGLAvailable() && !/[?&]no3d=1/.test(location.search);

    /* ── 관찰하지 않는 조합(skipCells) ── */
    var skips = (o.skipCells || []).filter(function (x) {
      return x && x.cell;
    });
    function skipOf(s) {
      if (!s) return null;
      for (var i = 0; i < skips.length; i++) {
        var c = skips[i].cell;
        if (
          Object.keys(c).every(function (k) {
            return s[k] === c[k];
          })
        )
          return skips[i];
      }
      return null;
    }

    /* ── 단계(phase) ── */
    var phaseById = {};
    o.phases.forEach(function (p, i) {
      p.index = i;
      p.trials = p.trials || 1;
      p.cells = p.cells.filter(function (c) {
        return !skipOf(c); // 관찰하지 않는 조합은 채울 칸이 아니다
      });
      phaseById[p.id] = p;
    });
    function cellPhase(s) {
      for (var i = 0; i < o.phases.length; i++) {
        if (
          o.phases[i].cells.some(function (c) {
            return sameSel(c, s, factorIds);
          })
        )
          return o.phases[i];
      }
      return null;
    }
    function cellDone(c, p) {
      return records.countOf(o.cellKey(c)) >= (p || cellPhase(c) || { trials: 1 }).trials;
    }
    function phaseCount(p) {
      return p.cells.filter(function (c) {
        return cellDone(c, p);
      }).length;
    }
    function phaseDone(id) {
      var p = phaseById[id];
      return phaseCount(p) >= p.cells.length;
    }
    function phaseUnlocked(p) {
      for (var i = 0; i < p.index; i++) if (!phaseDone(o.phases[i].id)) return false;
      return true;
    }
    function allDone() {
      return o.phases.every(function (p) {
        return phaseDone(p.id);
      });
    }
    function currentPhase() {
      for (var i = 0; i < o.phases.length; i++) if (!phaseDone(o.phases[i].id)) return o.phases[i];
      return null;
    }
    // 이 조건 값(factor=option)이 들어 있는 단계들
    function phasesOfOption(fid, oid) {
      return o.phases.filter(function (p) {
        return p.cells.some(function (c) {
          return c[fid] === oid;
        });
      });
    }
    function optionLock(fid, oid) {
      var ps = phasesOfOption(fid, oid);
      if (!ps.length) return null;
      var open = ps.some(phaseUnlocked);
      if (open) return null;
      return ps[0];
    }
    function lockMessage(p) {
      var prev = o.phases[p.index - 1];
      return prev
        ? prev.name + "(" + prev.cells.length + "칸)을 모두 기록하면 " + SciSim.josa(p.name, "이", "가") + " 열려요."
        : SciSim.josa(p.name, "은", "는") + " 아직 열리지 않았어요.";
    }

    /* ── 화면 틀 ── */
    var R = {};
    o.root.textContent = "";
    R.lead = el("p", { class: "ss-lead", "aria-live": "polite" });
    if (o.intro) {
      var introOpen = store.get("intro", true) !== false;
      var det = el("details", { class: "ss-card ss-intro" }, [el("summary", { text: o.introTitle || "🔎 실험 전에 알아 두기" }), o.intro]);
      det.open = introOpen;
      det.addEventListener("toggle", function () {
        store.set("intro", det.open);
      });
      o.root.appendChild(det);
      R.intro = det;
    }
    o.root.appendChild(R.lead);
    R.view3d = el("div", { class: "ss-view3d" });
    R.view2d = el("div", { class: "ss-view2d", hidden: true });
    R.tip = el("p", { class: "ss-view-tip" });
    R.loading = el("p", { class: "ss-view-loading", text: o.loadingText || "3D 실험실을 준비하고 있어요…" });
    R.viewBox = el("div", { class: "ss-exp-view" }, [R.view3d, R.view2d, el("div", { class: "ss-view-badge", "aria-hidden": "true", text: "모형" }), R.tip, R.loading]);
    R.btnReset = el("button", { type: "button", class: "ss-btn", text: "🎥 처음 방향으로" });
    R.btnClear = el("button", { type: "button", class: "ss-btn", text: o.clearLabel || "🧽 실험 화면 비우기" });
    R.btnToggle = el("button", { type: "button", class: "ss-btn", text: "2D로 보기" });
    var viewCol = el("div", { class: "ss-exp-view-col" }, [
      R.viewBox,
      el("div", { class: "ss-row ss-view-tools" }, [R.btnReset, R.btnClear, R.btnToggle]),
      o.modelNote ? SciSim.rich(o.modelNote, "p") : null,
    ]);
    if (o.modelNote) viewCol.lastChild.className = "ss-help ss-model-note";

    R.progress = el("div", { class: "ss-progress" });
    var panel = el("div", { class: "ss-exp-panel" }, [R.progress]);
    R.factorBtns = {};
    R.factorNotes = {};
    o.factors.forEach(function (f, fi) {
      var grid = el("div", { class: "ss-choice-grid" + (f.columns === 3 ? " cols-3" : ""), role: "group", "aria-label": f.title });
      R.factorBtns[f.id] = {};
      f.options.forEach(function (op) {
        var kids = [];
        if (op.icon) kids.push(op.icon());
        kids.push(el("span", { class: "ss-choice-text" }, [el("span", { text: op.label }), el("small", { class: "ss-lock-note" })]));
        var b = el("button", {
          type: "button",
          class: "ss-choice",
          "aria-pressed": "false",
          onclick: function () {
            pick(f.id, op.id);
          },
        }, kids);
        R.factorBtns[f.id][op.id] = b;
        grid.appendChild(b);
      });
      var note = el("p", { class: "ss-help", hidden: true });
      R.factorNotes[f.id] = note;
      panel.appendChild(el("div", { class: "ss-card ss-step-card" }, [el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: CIRCLED[fi] }), " " + f.title]), grid, note]));
    });
    var nRun = CIRCLED[o.factors.length];
    var nObs = CIRCLED[o.factors.length + 1];
    R.run = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide", disabled: true });
    panel.appendChild(el("div", { class: "ss-card ss-step-card ss-run-card" }, [el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: nRun }), " " + (o.runTitle || "실험하기")]), R.run]));
    R.skip = el("div", { class: "ss-card ss-skip-card", role: "note", "aria-live": "polite", hidden: true });
    panel.appendChild(R.skip);
    R.obsQ = el("p", { class: "ss-observe-q" });
    R.obsBody = el("div", { class: "ss-observe-body" });
    R.obsChoices = el("div", { class: "ss-obs-input" });
    R.record = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide", text: "📝 기록하기", disabled: true });
    R.recordMsg = el("p", { class: "ss-help", "aria-live": "polite" });
    R.checkBtn = el("button", { type: "button", class: "ss-btn ss-check-btn", text: "✔️ 확인하기" });
    R.retryBtn = el("button", { type: "button", class: "ss-btn ss-btn-ghost", hidden: true });
    R.checkRow = el("div", { class: "ss-row ss-check-row", hidden: true }, [R.checkBtn, R.retryBtn]);
    R.checkFb = el("p", { class: "ss-feedback", "aria-live": "polite", hidden: true });
    R.checkNode = el("div", { class: "ss-check-node", hidden: true });
    R.observe = el("div", { class: "ss-card ss-step-card ss-observe", hidden: true }, [
      el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: nObs }), " 관찰하고 기록하기"]),
      R.obsQ,
      R.obsBody,
      R.obsChoices,
      R.checkRow,
      R.checkFb,
      R.checkNode,
      R.record,
      R.recordMsg,
    ]);
    panel.appendChild(R.observe);
    if (o.miniTable) {
      R.mini = el("div");
      var miniBox = el("details", { class: "ss-card ss-mini-box" }, [
        el("summary", null, [o.miniTable.title || "기록한 칸 한눈에 보기", el("span", { class: "ss-help", text: " (칸을 누르면 그 실험을 골라요)" })]),
        R.mini,
      ]);
      miniBox.open = true;
      panel.appendChild(miniBox);
    }
    (o.extras || []).forEach(function (x) {
      panel.appendChild(x);
    });
    o.root.appendChild(el("div", { class: "ss-exp-layout" }, [viewCol, panel]));

    /* ── 고르기 ── */
    // 조건 보기 숨기기(factor.visible): 다른 조건에 따라 보기를 숨기고, 숨겨진 보기를 골라 두었으면 선택을 푼다
    function optionVisible(f, oid) {
      return typeof f.visible !== "function" || f.visible(oid, Object.assign({}, sel)) !== false;
    }
    function pruneHidden() {
      o.factors.forEach(function (f) {
        if (sel[f.id] != null && !optionVisible(f, sel[f.id])) delete sel[f.id];
      });
    }
    function pick(fid, oid) {
      if (busy) return;
      var lock = optionLock(fid, oid);
      if (lock) {
        toast(lockMessage(lock), 3400);
        return;
      }
      sel[fid] = oid;
      pruneHidden();
      afterSelect();
    }
    function select(s) {
      if (busy) return false;
      var p = cellPhase(s);
      if (p && !phaseUnlocked(p)) {
        toast(lockMessage(p), 3400);
        return false;
      }
      factorIds.forEach(function (k) {
        if (s[k] != null) sel[k] = s[k];
      });
      pruneHidden();
      afterSelect();
      return true;
    }
    function complete() {
      return factorIds.every(function (k) {
        return sel[k] != null;
      });
    }
    function afterSelect() {
      trial = null;
      R.observe.hidden = true;
      draw();
      if (view) view.highlight(Object.assign({}, sel));
    }

    function draw() {
      o.factors.forEach(function (f) {
        f.options.forEach(function (op) {
          var b = R.factorBtns[f.id][op.id];
          b.hidden = !optionVisible(f, op.id);
          var lock = optionLock(f.id, op.id);
          b.setAttribute("aria-pressed", String(sel[f.id] === op.id));
          b.classList.toggle("is-locked", !!lock);
          var ps = phasesOfOption(f.id, op.id);
          var tag = lock ? "🔒 " + SciSim.josa(o.phases[lock.index - 1].name, "을", "를") + " 마치면 열려요" : ps.length === 1 && o.phases.length > 1 && f.phaseTag !== false ? ps[0].name : "";
          b.querySelector(".ss-lock-note").textContent = tag;
        });
        var note = f.note ? f.note(Object.assign({}, sel)) : null;
        R.factorNotes[f.id].hidden = !note;
        R.factorNotes[f.id].textContent = note || "";
      });
      if (!complete()) {
        var missing = o.factors.filter(function (f) {
          return sel[f.id] == null;
        });
        var names = missing.map(function (f) {
          return f.short || f.title.replace(/ ?고르기$/, "");
        });
        var phrase = names.reduce(function (acc, nm, i) {
          return i === 0 ? nm : SciSim.josa(acc, "과", "와") + " " + nm;
        }, "");
        R.run.textContent = SciSim.josa(phrase, "을", "를") + " 골라요";
        R.run.disabled = true;
      } else if (skipOf(sel)) {
        R.run.textContent = skipOf(sel).runLabel || "🚫 안전을 위해 하지 않는 실험이에요";
        R.run.disabled = true;
      } else {
        R.run.textContent = o.runLabel(Object.assign({}, sel));
        R.run.disabled = busy;
      }
      drawSkip();
      var cp = currentPhase();
      R.lead.textContent = cp ? cp.lead : o.doneLead || "모든 실험을 기록했어요. 다시 해 보고 싶은 실험은 자유롭게 해 보세요.";
      drawProgress();
      drawMini();
    }

    function drawSkip() {
      var sk = complete() ? skipOf(sel) : null;
      R.skip.hidden = !sk;
      R.skip.textContent = "";
      if (!sk) return;
      R.skip.appendChild(el("h3", { class: "ss-skip-title", text: sk.title || "⚠️ 이 실험은 하지 않아요" }));
      if (sk.text) R.skip.appendChild(SciSim.rich(sk.text, "p"));
      if (sk.why) R.skip.appendChild(el("p", { class: "ss-skip-why" }, [SciSim.rich(sk.why, "span")]));
    }

    function drawProgress() {
      R.progress.textContent = "";
      o.phases.forEach(function (p) {
        var n = phaseCount(p);
        var total = p.cells.length;
        var locked = !phaseUnlocked(p);
        var bar = el("div", { class: "ss-pbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(n), "aria-label": p.name + " 기록" }, [el("span")]);
        bar.firstChild.style.width = (100 * n) / total + "%";
        R.progress.appendChild(
          el("div", { class: "ss-prow" + (locked ? " is-locked" : "") + (n >= total ? " is-done" : "") }, [
            el("span", { class: "ss-plabel", text: (n >= total ? "✅ " : locked ? "🔒 " : "") + p.name }),
            bar,
            el("span", { class: "ss-pnum", text: n + "/" + total }),
          ])
        );
      });
    }

    function drawMini() {
      if (!o.miniTable) return;
      var mt = o.miniTable;
      R.mini.textContent = "";
      var t = el("table", { class: "ss-mini" });
      var head = el("tr", null, [el("th", { text: "" })]);
      mt.cols.forEach(function (c) {
        head.appendChild(el("th", { scope: "col", text: c.label }));
      });
      t.appendChild(el("thead", null, [head]));
      var tb = el("tbody");
      mt.rows.forEach(function (r) {
        var tr = el("tr", null, [el("th", { scope: "row", text: r.label })]);
        mt.cols.forEach(function (c) {
          var s = mt.sel(r, c);
          var sk = skipOf(s);
          if (sk) {
            var isSelSk = sameSel(s, sel, factorIds);
            tr.appendChild(
              el("td", null, [
                el("button", {
                  type: "button",
                  class: "ss-mini-cell is-skip" + (isSelSk ? " is-sel" : ""),
                  "aria-label": r.label + ", " + c.label + ", " + (sk.short || "관찰하지 않음(안전)"),
                  "aria-pressed": String(isSelSk),
                  title: sk.short || "관찰하지 않음(안전)",
                  text: "🚫",
                  onclick: function () {
                    select(s);
                  },
                }),
              ])
            );
            return;
          }
          var p = cellPhase(s);
          var n = records.countOf(o.cellKey(s));
          var need = p ? p.trials : 1;
          var locked = p && !phaseUnlocked(p);
          var isSel = sameSel(s, sel, factorIds);
          var b = el("button", {
            type: "button",
            class: "ss-mini-cell" + (n >= need ? " is-rec" : n ? " is-part" : "") + (locked ? " is-locked" : "") + (isSel ? " is-sel" : ""),
            "aria-label": r.label + ", " + c.label + (n >= need ? ", 기록함" : n ? ", " + n + "/" + need + "회 기록" : locked ? ", 잠김" : ", 아직 기록 안 함"),
            "aria-pressed": String(isSel),
            text: n >= need ? "✓" : n ? n + "/" + need : locked ? "🔒" : "",
            onclick: function () {
              select(s);
            },
          });
          tr.appendChild(el("td", null, [b]));
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      R.mini.appendChild(el("div", { class: "ss-mini-wrap" }, [t]));
    }

    /* ── 실행 ── */
    R.run.addEventListener("click", run);
    async function run() {
      if (busy || !complete()) return;
      if (!view) {
        toast(mounting ? "실험 화면을 준비하고 있어요. 잠시 뒤에 다시 눌러 주세요." : "실험 화면을 준비하지 못했어요.");
        return;
      }
      var s = Object.assign({}, sel);
      if (skipOf(s)) return; // 관찰하지 않는 조합은 실행하지 않는다
      var p = cellPhase(s);
      if (p && !phaseUnlocked(p)) return;
      if (o.canRun) {
        var cr;
        try {
          cr = o.canRun(Object.assign({}, s));
        } catch (e) {
          console.warn("[science-sim] canRun 오류", e);
          cr = "지금은 실험을 시작할 수 없어요.";
        }
        if (cr !== true && cr !== undefined) {
          var msg = typeof cr === "string" ? cr : "먼저 해야 할 일이 있어요.";
          toast(msg, 3600);
          if (o.onRunBlocked) o.onRunBlocked(Object.assign({}, s), msg);
          return;
        }
      }
      setBusy(true);
      R.observe.hidden = true;
      var v = view;
      try {
        // 세로 화면·휴대폰: 버튼이 실험 화면 아래에 있으므로 먼저 실험 화면을 보이게 한다
        await scrollIntoViewSafe(R.viewBox);
        if (v.whenVisible) await v.whenVisible(900);
        await v.run(s);
      } catch (e) {
        console.warn("[science-sim] 실험 애니메이션 오류(결과만 바로 보여 줘요)", e);
        if (view === v) v.showInstant(s);
      }
      scene[o.cellKey(s)] = s;
      store.set("scene", scene);
      setBusy(false);
      trial = { sel: s, observed: null };
      showObserve();
    }
    function setBusy(on) {
      busy = on;
      o.root.querySelectorAll(".ss-choice, .ss-mini-cell").forEach(function (b) {
        b.disabled = on;
      });
      R.btnClear.disabled = on;
      R.btnToggle.disabled = on || mounting || (viewKind === "2d" && !can3D);
      if (on) {
        R.run.disabled = true;
        var bl = typeof o.busyLabel === "function" ? o.busyLabel(Object.assign({}, sel)) : o.busyLabel;
        R.run.textContent = bl || "실험하는 중… 잘 지켜보세요 👀";
      } else draw();
      if (o.onBusy) o.onBusy(on);
    }

    function showObserve() {
      var s = trial.sel;
      var ob = o.observe(s);
      R.obsQ.textContent = ob.question;
      R.obsBody.textContent = "";
      if (ob.body) R.obsBody.appendChild(ob.body);
      R.obsChoices.textContent = "";
      var p = cellPhase(s) || { trials: 1 };
      var key = o.cellKey(s);
      trial.type = ob.type || "choice";
      trial.check = typeof ob.check === "function" ? ob.check : typeof o.check === "function" ? o.check : null;
      trial.checked = false;
      trial.tries = 0;
      trial.lastKey = null;
      trial.lastRes = null;
      trial.ob = ob;
      if (trial.type === "numeric") {
        trial.trialNo = p.trials > 1 ? records.nextTrial(key, p.trials) : null;
        trial.inputs = {};
        var grid = el("div", { class: "ss-num-grid" });
        ob.fields.forEach(function (f) {
          var id = "ss-num-" + f.id;
          var isText = f.kind === "text";
          var inp = isText
            ? el("input", {
                id: id,
                type: "text",
                class: "ss-num-input ss-text-input",
                autocomplete: "off",
                placeholder: f.placeholder || null,
                maxlength: f.maxLength != null ? String(f.maxLength) : "300",
              })
            : el("input", {
                id: id,
                type: "number",
                inputmode: "decimal",
                class: "ss-num-input",
                step: f.step != null ? String(f.step) : "any",
                min: f.min != null ? String(f.min) : null,
                max: f.max != null ? String(f.max) : null,
              });
          if (f.value != null) inp.value = String(f.value);
          inp.addEventListener("input", checkNumeric);
          inp.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && trial && trial.check) {
              e.preventDefault();
              runCheck();
            }
          });
          trial.inputs[f.id] = { input: inp, field: f };
          grid.appendChild(
            el("label", { for: id, class: "ss-num-field" + (isText ? " is-text" : "") }, [
              el("span", { class: "ss-num-label", text: f.label }),
              el("span", { class: "ss-num-row" }, [inp, f.unit ? el("span", { class: "ss-num-unit", text: f.unit }) : null]),
            ])
          );
        });
        R.obsChoices.appendChild(grid);
        if (trial.trialNo) R.obsChoices.appendChild(el("p", { class: "ss-help", text: "같은 조건 " + p.trials + "번 중 " + trial.trialNo + "번째 측정이에요." }));
        checkNumeric();
      } else {
        var box = el("div", { class: "ss-choice-grid ss-obs-grid", role: "group", "aria-label": "관찰 결과" });
        ob.choices.forEach(function (text) {
          var b = el("button", { type: "button", class: "ss-choice ss-obs", "aria-pressed": "false", text: text });
          b.addEventListener("click", function () {
            trial.observed = text;
            box.querySelectorAll(".ss-obs").forEach(function (x) {
              x.setAttribute("aria-pressed", String(x === b));
            });
            resetCheck();
            R.record.disabled = !!trial.check;
            revealRecord();
          });
          box.appendChild(b);
        });
        R.obsChoices.appendChild(box);
        R.record.disabled = true;
      }
      // 확인하기(check 훅)
      R.checkBtn.textContent = ob.checkLabel || "✔️ 확인하기";
      R.retryBtn.textContent = ob.retryLabel || "";
      R.checkRow.hidden = !trial.check;
      R.retryBtn.hidden = true;
      R.checkFb.hidden = true;
      R.checkFb.textContent = "";
      R.checkNode.textContent = "";
      R.checkNode.hidden = true;
      var n = records.countOf(key);
      R.recordMsg.textContent =
        trial.type === "numeric" && p.trials > 1
          ? n >= p.trials
            ? "이 조건은 " + p.trials + "번 모두 쟀어요. 다시 기록하면 가장 먼저 잰 기록이 바뀌어요."
            : ""
          : n
          ? "이 칸은 이미 기록했어요. 다시 기록하면 마지막 기록으로 바뀌어요."
          : "";
      R.observe.hidden = false;
      setTimeout(function () {
        scrollIntoViewSafe(R.observe, { align: "nearest" });
      }, 60);
    }
    function checkNumeric() {
      var ok = true;
      var vals = {};
      Object.keys(trial.inputs).forEach(function (k) {
        var t = trial.inputs[k];
        var raw = t.input.value;
        var f = t.field;
        var v, bad;
        if (f.kind === "text") {
          v = String(raw).replace(/\s+/g, " ").trim();
          bad = v.length < (f.minLength != null ? f.minLength : 1);
        } else {
          v = raw === "" ? NaN : Number(raw);
          bad = !isFinite(v) || (f.min != null && v < f.min) || (f.max != null && v > f.max);
        }
        // 아직 비어 있는 칸은 빨간 테두리로 보이지 않게(기록은 여전히 막힘)
        t.input.setAttribute("aria-invalid", String(bad && String(raw).trim() !== ""));
        if (bad) ok = false;
        else vals[k] = v;
      });
      trial.observed = ok ? vals : null;
      resetCheck();
      R.record.disabled = !ok || !!trial.check;
    }
    // 입력이 바뀌면 확인 결과를 지운다(다시 확인해야 기록할 수 있다)
    function resetCheck() {
      if (!trial || !trial.check) return;
      trial.checked = false;
      R.checkFb.hidden = true;
      R.checkFb.textContent = "";
      R.checkFb.className = "ss-feedback";
      R.checkNode.textContent = "";
      R.checkNode.hidden = true;
    }
    function obsKey(v) {
      try {
        return JSON.stringify(v);
      } catch (e) {
        return String(v);
      }
    }
    function showCheck(res) {
      R.checkFb.hidden = false;
      R.checkFb.className = "ss-feedback " + (res.ok ? "is-correct" : "is-wrong");
      R.checkFb.textContent = res.message || "";
      R.checkNode.textContent = "";
      R.checkNode.hidden = !res.node;
      if (res.node) R.checkNode.appendChild(res.node);
      R.retryBtn.hidden = res.ok || !(trial && trial.ob && trial.ob.retryLabel);
      revealRecord();
    }
    /* 보기를 고르거나 '확인하기'를 누르면 카드가 길어져 '기록하기'가 아래 이동 막대에 가릴 수 있다.
       가려져 있을 때만 막대 위로 보이게 스크롤한다(이미 보이면 그대로 둔다). */
    function revealRecord() {
      setTimeout(function () {
        if (R.observe.hidden) return;
        var f = document.querySelector(".ss-footer-nav");
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var bottom = f ? f.getBoundingClientRect().height : 0;
        var r = R.record.getBoundingClientRect();
        if (r.bottom > vh - bottom + 1 || r.top < 0) scrollIntoViewSafe(R.record, { align: "nearest" });
      }, 60);
    }
    function runCheck() {
      if (!trial || !trial.check) return;
      if (trial.type === "numeric") checkNumeric();
      if (!trial.observed) {
        showCheck({ ok: false, message: trial.type === "numeric" ? "빈칸을 알맞게 모두 채운 뒤 확인해요." : "먼저 보기를 골라요." });
        R.record.disabled = true;
        return;
      }
      var key = obsKey(trial.observed);
      if (trial.lastRes && trial.lastKey === key) {
        // 같은 답으로 다시 확인: 세지 않고 앞 결과를 다시 보여 준다
        trial.checked = trial.lastRes.ok;
        R.record.disabled = !trial.checked;
        showCheck(trial.lastRes.ok ? trial.lastRes : { ok: false, message: trial.lastRes.message + " (고친 곳이 없어요.)", node: trial.lastRes.node });
        return;
      }
      var raw;
      try {
        raw = trial.check(typeof trial.observed === "object" ? Object.assign({}, trial.observed) : trial.observed, { sel: Object.assign({}, trial.sel), tries: trial.tries });
      } catch (e) {
        console.warn("[science-sim] check 오류(기록하지 않아요)", e);
        raw = "확인하는 중 문제가 생겼어요. 다시 눌러 보세요.";
        key = null;
      }
      var res;
      if (raw === true) res = { ok: true, message: trial.ob.okMessage || "⭕ 맞아요! '기록하기'를 눌러 기록해요." };
      else if (raw && typeof raw === "object") res = { ok: raw.ok === true, message: raw.message || (raw.ok === true ? trial.ob.okMessage || "⭕ 맞아요! '기록하기'를 눌러 기록해요." : "다시 확인해 보세요."), node: raw.node || null };
      else res = { ok: false, message: typeof raw === "string" && raw ? raw : "다시 확인해 보세요." };
      if (!res.ok) trial.tries++;
      trial.lastKey = key;
      trial.lastRes = res;
      trial.checked = res.ok;
      R.record.disabled = !res.ok;
      showCheck(res);
    }

    R.checkBtn.addEventListener("click", runCheck);
    R.retryBtn.addEventListener("click", function () {
      if (!busy) run();
    });

    R.record.addEventListener("click", function () {
      if (!trial || !trial.observed) return;
      if (trial.check && !trial.checked) {
        // fail-closed: 확인을 통과하지 않은 값은 기록하지 않는다
        R.record.disabled = true;
        showCheck({ ok: false, message: "먼저 '확인하기'를 눌러 확인해요." });
        return;
      }
      if (o.beforeRecord) {
        var br;
        try {
          br = o.beforeRecord(Object.assign({}, trial.sel), typeof trial.observed === "object" ? Object.assign({}, trial.observed) : trial.observed);
        } catch (e) {
          console.warn("[science-sim] beforeRecord 오류(기록하지 않아요)", e);
          br = "기록하는 중 문제가 생겼어요.";
        }
        if (br !== true && br !== undefined) {
          toast(typeof br === "string" ? br : "지금은 기록할 수 없어요.", 3400);
          return;
        }
      }
      var s = trial.sel;
      var p = cellPhase(s);
      var before = o.phases.map(function (ph) {
        return phaseDone(ph.id);
      });
      var rec = o.makeRecord(Object.assign({}, s), trial.observed);
      if (p && rec.phase == null) rec.phase = p.id;
      if (trial.trialNo) rec.trial = trial.trialNo;
      var r = records.upsert(rec);
      trial = null;
      R.observe.hidden = true;
      var completed = null;
      o.phases.forEach(function (ph, i) {
        if (!before[i] && phaseDone(ph.id)) completed = ph;
      });
      var desc = o.describeRecord ? o.describeRecord(r.record) : "";
      if (completed && allDone()) toast("🎉 모든 실험을 기록했어요! '다음 단계'로 가서 결과를 분석해 보세요.", 3800);
      else if (completed) {
        var next = o.phases[completed.index + 1];
        toast("🎉 " + SciSim.josa(completed.name, "을", "를") + " 모두 기록했어요!" + (next ? " 이제 " + SciSim.josa(next.name, "이", "가") + " 열렸어요." : ""), 3800);
        if (next) {
          var first = next.cells.filter(function (c) {
            return !cellDone(c, next);
          })[0];
          if (first) factorIds.forEach(function (k) { sel[k] = first[k]; });
        }
      } else {
        toast((r.replaced ? "🔁 다시 기록했어요" : "📝 기록했어요") + (desc ? ": " + desc : ""));
        advance(s, p);
      }
      pruneHidden();
      afterSelect();
      if (o.onRecorded) o.onRecorded({ record: r.record, replaced: r.replaced, phaseCompleted: completed ? completed.id : null, allDone: allDone() });
      if (o.onChange) o.onChange();
    });

    // 다음 빈칸 고르기: 첫 번째 조건만 바꾼 칸 → 같은 단계의 다른 빈칸
    function advance(s, p) {
      if (!p) return;
      var cur = records.countOf(o.cellKey(s));
      if (cur < p.trials) return; // 같은 조건을 더 재야 하면 그대로 둔다
      var rest = factorIds.slice(1);
      var cells = p.cells;
      var idx = -1;
      cells.forEach(function (c, i) {
        if (sameSel(c, s, factorIds)) idx = i;
      });
      for (var k = 1; k <= cells.length; k++) {
        var c = cells[(idx + k) % cells.length];
        if (sameSel(c, s, rest) && !cellDone(c, p)) {
          Object.assign(sel, c);
          return;
        }
      }
      for (var j = 0; j < cells.length; j++) {
        if (!cellDone(cells[j], p)) {
          factorIds.forEach(function (key) { sel[key] = cells[j][key]; });
          return;
        }
      }
    }

    /* ── 실험 화면(3D 또는 2D) ── */
    R.btnReset.addEventListener("click", function () {
      if (view) view.resetView();
    });
    R.btnClear.addEventListener("click", function () {
      if (busy) return;
      scene = {};
      store.set("scene", scene);
      if (view) view.clear();
      trial = null;
      R.observe.hidden = true;
      toast(o.clearMessage || "실험 화면을 비웠어요. 기록은 그대로 남아 있어요.");
    });
    R.btnToggle.addEventListener("click", function () {
      if (busy || mounting) return;
      var to2d = viewKind === "3d";
      store.set("view2d", to2d);
      mount(to2d ? "2d" : "3d");
    });

    var ctx = {
      onPick: function (pk) {
        if (busy) return;
        var p = pk.sel || pk;
        var full = factorIds.every(function (k) {
          return p[k] != null;
        });
        if (full) select(p);
        else
          Object.keys(p).forEach(function (k) {
            pick(k, p[k]);
          });
      },
    };

    function mount(kind, notice) {
      var my = ++mountToken; // 늦게 끝난 3D 생성은 버린다(겹쳐 생성 방지)
      if (view && view.dispose) view.dispose();
      view = null;
      viewKind = null;
      R.view3d.textContent = "";
      R.view2d.textContent = "";
      if (kind === "3d") {
        mounting = true;
        R.btnToggle.disabled = true;
        R.loading.hidden = false;
        R.view2d.hidden = true;
        R.view3d.hidden = false;
        R.viewBox.classList.remove("is-2d");
        var c3 = Object.assign({}, ctx, {
          onLost: function () {
            if (my !== mountToken) return; // 이미 바꾼 화면의 일이면 무시
            can3D = false;
            mount("2d", "3D 화면에 문제가 생겨 2D 화면으로 바꿨어요. 기록은 그대로예요.");
          },
        });
        Promise.resolve()
          .then(function () {
            return o.view.build3D(R.view3d, c3);
          })
          .catch(function (e) {
            console.warn("[science-sim] 3D 화면을 만들지 못했어요.", e);
            return null;
          })
          .then(function (v) {
            if (my !== mountToken) {
              if (v && v.dispose) v.dispose();
              return;
            }
            mounting = false;
            if (!v) {
              can3D = false;
              mount("2d", "이 기기에서는 3D 화면을 쓸 수 없어서 2D 화면으로 실험해요.");
              return;
            }
            finish(v, "3d");
          });
      } else {
        mounting = false;
        R.loading.hidden = true;
        R.view3d.hidden = true;
        R.view2d.hidden = false;
        finish(o.view.build2D(R.view2d, ctx), "2d");
        if (notice) toast(notice, 3600);
      }
      drawToggle();
    }
    function drawToggle() {
      var k = viewKind || (mounting ? "3d" : "2d");
      R.btnToggle.textContent = k === "3d" ? "2D로 보기" : can3D ? "3D로 보기" : "3D를 쓸 수 없는 기기예요";
      R.btnToggle.disabled = busy || mounting || (k === "2d" && !can3D);
      R.btnToggle.setAttribute("aria-busy", String(mounting));
    }
    function finish(v, kind) {
      view = v;
      viewKind = kind;
      R.loading.hidden = true;
      R.viewBox.classList.toggle("is-2d", kind === "2d");
      var narrow = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
      R.tip.textContent =
        kind === "3d"
          ? (o.view.tip3D || "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향") +
            (narrow ? " · 페이지를 위아래로 움직일 때는 3D 화면 바깥을 밀어요" : "")
          : o.view.tip2D || "2D 화면(모형)이에요. 눌러서 고를 수 있어요.";
      R.btnReset.hidden = kind !== "3d";
      Object.keys(scene).forEach(function (k) {
        var s = scene[k];
        if (s && cellPhase(s) && !skipOf(s)) v.showInstant(s);
      });
      v.highlight(Object.assign({}, sel));
      drawToggle();
    }

    var activated = false;
    // 저장된 결과가 없으면 첫 단계의 첫 빈칸을 미리 고르지 않는다(학생이 직접 고르게)
    draw();

    return {
      activate: function () {
        if (!activated) {
          activated = true;
          mount(can3D && !store.get("view2d", false) ? "3d" : "2d");
        }
        draw();
      },
      select: select,
      refresh: draw,
      phaseDone: phaseDone,
      allDone: allDone,
      skipInfo: function (s) {
        return skipOf(s);
      },
      isBusy: function () {
        return busy;
      },
      progress: function () {
        var d = 0,
          t = 0;
        o.phases.forEach(function (p) {
          d += phaseCount(p);
          t += p.cells.length;
        });
        return { done: d, total: t };
      },
      phaseCount: function (id) {
        return phaseCount(phaseById[id]);
      },
      phaseTotal: function (id) {
        return phaseById[id].cells.length;
      },
      viewKind: function () {
        return viewKind;
      },
      can3D: function () {
        return can3D;
      },
    };
  }

  SciSim.Experiment = { create: create, scrollIntoView: scrollIntoViewSafe, sleep: sleep };

  /* ── 실제 시간 카운트다운(초시계) ── */
  function countdown(container, seconds, opts) {
    opts = opts || {};
    var total = Math.max(0.1, Number(seconds) || 1) * 1000;
    var R0 = 22;
    var CIRC = 2 * Math.PI * R0;
    var NS = "http://www.w3.org/2000/svg";
    var ring = document.createElementNS(NS, "svg");
    ring.setAttribute("viewBox", "0 0 52 52");
    ring.setAttribute("class", "ss-cd-ring");
    ring.setAttribute("aria-hidden", "true");
    var bg = document.createElementNS(NS, "circle");
    var fg = document.createElementNS(NS, "circle");
    [bg, fg].forEach(function (c) {
      c.setAttribute("cx", "26");
      c.setAttribute("cy", "26");
      c.setAttribute("r", String(R0));
      ring.appendChild(c);
    });
    bg.setAttribute("class", "ss-cd-bg");
    fg.setAttribute("class", "ss-cd-fg");
    fg.setAttribute("stroke-dasharray", String(CIRC));
    var num = el("span", { class: "ss-cd-num", text: String(Math.ceil(total / 1000)) });
    var live = el("span", { class: "ss-sr-only", "aria-live": "polite" });
    var box = el("div", { class: "ss-countdown", role: "timer" }, [
      el("span", { class: "ss-cd-dial" }, [ring, el("span", { class: "ss-cd-icon", "aria-hidden": "true", text: "⏱" })]),
      el("span", { class: "ss-cd-body" }, [
        el("span", { class: "ss-cd-main" }, [num, el("span", { class: "ss-cd-label", text: opts.label || "초 남았어요" })]),
        opts.note ? el("span", { class: "ss-cd-note", text: opts.note }) : null,
      ]),
      live,
    ]);
    container.appendChild(box);
    live.textContent = "초시계 시작: " + Math.round(total / 1000) + "초";
    var t0 = Date.now();
    var timer = null;
    var done = false;
    var resolveFn;
    var p = new Promise(function (resolve) {
      resolveFn = resolve;
    });
    function end() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (box.parentNode) box.parentNode.removeChild(box);
      resolveFn();
    }
    function tick() {
      if (done) return;
      var elapsed = Date.now() - t0;
      var remain = Math.max(0, total - elapsed);
      num.textContent = String(Math.ceil(remain / 1000));
      fg.setAttribute("stroke-dashoffset", String((CIRC * elapsed) / total));
      if (opts.onTick) {
        try {
          opts.onTick(remain / 1000);
        } catch (e) {
          /* 무시 */
        }
      }
      if (remain <= 0) {
        live.textContent = opts.doneText || "시간이 다 되었어요";
        end();
        return;
      }
      timer = setTimeout(tick, 100);
    }
    tick();
    p.cancel = end;
    return p;
  }
  SciSim.Countdown = { run: countdown };
})();
