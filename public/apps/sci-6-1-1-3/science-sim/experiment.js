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
 *     scenePanel: node,                                     // 선택(2026-09-25): 지금 값을 보여 주는 노드(예: 시각·측정값 패널). 전체 화면 모드일 때
 *                                                           //   장면 안 막대의 윗줄(넓은 화면) 또는 조작 칸 맨 위 카드(좁은 화면)로 틀이 자동으로 옮긴다. 안 주면 막대에는 실행·기록 버튼만 나온다.
 *     sceneBar: true,                                       // 선택(fix-A): false면 크게 보기에서도 실행·기록 버튼을 막대로 옮기지 않는다(앱이 자기 버튼으로
 *                                                           //   측정·기록하는 경우). factors가 []이면 자동으로 false처럼 동작한다. 이때 막대에는 scenePanel만, 없으면 막대를 숨긴다.
 *   });
 *   exp.activate()            → 실험하기 단계에 들어올 때 호출(처음 한 번 실험 화면을 만든다)
 *   exp.select(sel)           → 조건 고르기(분석 단계의 '다시 실험' 버튼 등)
 *   exp.phaseDone(id) / exp.allDone() / exp.progress() → { done, total }
 *   exp.skipInfo(sel)         → 관찰하지 않는 조합이면 skipCells의 그 항목, 아니면 null
 *   exp.runButton / exp.recordButton → 공통 실행·기록 버튼 엘리먼트(클래스 ss-run-btn / ss-record-btn). 앱이 기록 버튼을 찾을 때는
 *                               이것을 쓴다 — '관찰 카드 안' 선택자(.ss-observe .ss-btn-primary 등)로 찾지 않는다(크게 보기에서는 막대에 있다).
 *   exp.revealRecord()        → '기록하기'가 켜져 있고 화면에 안 보이면 최소로 스크롤해 보이게 한다(꺼져 있으면 아무것도 안 함,
 *                               크게 보기에서 막대에 있으면 늘 보이므로 아무것도 안 함, 막대가 없으면 조작 칸 안에서만). 앱의 '가리면 스크롤' 도우미는 이것을 부른다.
 *
 * 저장 키: "scene"(실험 화면에 남아 있는 결과), "view2d"(2D 보기 선택), "intro"(알아 두기 접힘)
 * 실행 버튼을 누르면 실험 화면이 보이도록 먼저 스크롤한 뒤(세로 화면·휴대폰) 애니메이션을 시작한다(크게 보기는 장면이 늘 보여 스크롤하지 않는다).
 *
 * ▶ 전체 화면 보기 = "한 화면 실험실"(2026-09-26 spec 개정 6, 모든 앱에 자동 적용 — 앱 코드를 바꿀 필요 없다):
 *   장면 왼쪽 위(모형 배지 바로 아래)에 "⛶ 전체 화면 보기" 토글 버튼이 늘 있다. 글자가 할 일을 말한다
 *   ("⛶ 전체 화면 보기" ↔ "↙ 기본 화면", 켜짐 모양은 클래스 is-on — aria-pressed는 쓰지 않는다). DOM에서 막대보다 앞(Tab 순서 = 보이는 순서).
 *   켜면: 실험 영역(.ss-exp-layout.is-full)이 머리말 아래 ~ 아래 이동 막대 위 화면 전체에 고정되고(페이지는 스크롤되지 않는다),
 *         그 안에 장면 + 조작 칸(기본 화면 오른쪽 패널 그대로 — 가로 화면은 오른쪽, 세로 화면은 아래)이 겹치지 않게 나란히 온다.
 *         조작 칸 내용이 길면 그 칸 안에서만 스크롤된다. 실행·기록 버튼과 scenePanel(있으면, 막대 윗줄)은 장면 안 아래쪽 막대로
 *         옮겨 가고(3D 칸은 막대 위에서 끝난다), '실험 방법 알아 두기'·안내 줄 등 장면 위에 있던 것은 조작 칸 맨 위로('알아 두기'는
 *         제목 줄만 — 첫 화면에 고르는 버튼이 보이게, 학생 선택으로 저장하지 않고 끄면 원래대로),
 *         모형 설명은 조작 칸 맨 끝으로 옮긴다(좁은/낮은 화면은 보기 도구 줄도 조작 칸 끝으로). 관찰 카드는 조작 칸 안 원래 순서
 *         (조건 카드 다음)에 있고, 실행 뒤에는 조작 칸 안에서만 관찰 카드가 보이게 스크롤한다.
 *   끄면: 지금까지와 같은 배치(가로 화면은 장면·패널 좌우 분할, 세로/좁은 화면은 위아래). 옮긴 것은 모두 원래 자리로.
 *   기본값: 세로 태블릿(portrait, 폭 600px 이상)은 켜짐, 그 밖(가로·휴대폰)은 꺼짐 — 방향이 바뀌면 그 방향에서
 *   학생이 직접 고른 적이 없을 때만 다시 기본값을 적용한다. 학생이 누른 선택은 방향별로 기억한다(localStorage,
 *   "sci6" 접두사 아님 — 로그아웃 정리 대상이 아닌 기기 UI 설정이라서). 켜져 있을 때 Esc 키를 누르면 기본 화면으로 돌아간다.
 *   앱이 .ss-exp-view 높이를 직접 재정의해 둔 스타일이 있어도(예: 가로 화면 전용 규칙) 전체 화면 모드의 템플릿
 *   규칙이 더 구체적인 선택자(#experiment-root 포함)로 이긴다 — 앱 코드를 고치지 않아도 된다.
 *   공통 create()를 안 쓰고 같은 .ss-exp-layout·.ss-exp-view 구조를 직접 만드는 앱은 SciSim.Experiment.enlarge(opts)로
 *   같은 기능(토글·기본값·기억·한 화면 배치·막대·scenePanel·알아 두기 옮기기)을 붙인다 — 아래 enlarge() 주석.
 *   SciSim.Experiment.scrollIntoView(node)도 크게 보기를 안다: 조작 칸 안의 노드는 그 칸만 스크롤하고, 장면 칼럼(늘 보임)은 움직이지 않는다.
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
    return scrollToY(target);
  }
  // 화면 띠: 고정 머리말 아래 ~ 아래 이동 막대 위(뷰포트 좌표)
  function bandOf() {
    var header = document.querySelector(".ss-header");
    var footer = document.querySelector(".ss-footer-nav");
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return { top: header ? header.getBoundingClientRect().height : 0, bottom: vh - (footer ? footer.getBoundingClientRect().height : 0) };
  }
  /* 뷰포트 좌표 [top, bottom] 범위를 화면 띠 안(위아래 8px 틈)에 **최소로** 움직여 넣는다(기본 화면 — 페이지 스크롤).
     이미 들어 있으면 가만히, 다 안 들어가면 위쪽부터 맞춘다. 크게 보기의 조작 칸은 revealInDock(아래)을 쓴다. */
  function revealRange(top, bottom) {
    var b = bandOf();
    var bt = b.top + 8;
    var bb = b.bottom - 8;
    if (top >= bt - 1 && bottom <= bb + 1) return Promise.resolve(false);
    var d;
    if (bottom - top <= bb - bt) d = bottom > bb ? bottom - bb : top - bt;
    else d = top - bt;
    if (Math.abs(d) < 1) return Promise.resolve(false);
    return scrollToY(window.scrollY + d);
  }
  function scrollToY(target) {
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

  // 노드의 원래 자리(부모·앞뒤 형제)를 기억했다가 그 자리로 되돌린다(앞 형제 기준 → 없으면 뒤 형제 → 없으면 부모 맨 끝)
  function homeOf(node) {
    return node && node.parentNode ? { parent: node.parentNode, prev: node.previousSibling, next: node.nextSibling } : null;
  }
  function goHome(node, home) {
    if (!node || !home) return;
    var p = home.parent;
    var ref = home.prev && home.prev.parentNode === p ? home.prev.nextSibling : home.next && home.next.parentNode === p ? home.next : null;
    if (ref === node || (node.parentNode === p && node.nextSibling === ref)) return; // 이미 제자리
    p.insertBefore(node, ref);
  }
  function listenMq(mq, fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else if (mq.addListener) mq.addListener(fn);
  }
  /* 프로그램이 <details>를 접거나 펼 때(학생 선택이 아님 — 크게 보기의 '알아 두기' 접기). 그때 오는 toggle 이벤트는
     isQuietToggle(d)이 true라 저장하지 않는다. 표시는 그 이벤트의 모든 리스너가 같은 답을 보도록 이벤트가 끝난 뒤(setTimeout 0) 지운다. */
  function setOpenQuietly(d, open) {
    if (!d || d.open === open) return;
    d.__ssQuiet = open;
    d.open = open;
  }
  function isQuietToggle(d) {
    if (!d || d.__ssQuiet === undefined || d.__ssQuiet === null || d.__ssQuiet !== d.open) return false;
    if (!d.__ssQuietClear) {
      d.__ssQuietClear = setTimeout(function () {
        d.__ssQuiet = null;
        d.__ssQuietClear = null;
      }, 0);
    }
    return true;
  }

  /* ── 크게 보기의 조작 칸 안에서만 스크롤하기(2026-09-26 spec 개정 6) ── 크게 보기는 실험 영역이 화면에 고정되어 페이지가 움직이지
     않는다. 조작 칸(.ss-exp-layout.is-full > .ss-exp-panel) 안의 노드는 그 칸의 scrollTop만 바꿔 보이게 한다(페이지·고정 영역은 그대로).
     element.scrollIntoView()는 쓰지 않는다 — 조상 스크롤(페이지)까지 움직일 수 있고, 페이지용 scroll-margin(머리말 높이)이 칸 안에도 적용된다. */
  function dockOf(node) {
    return node && node.closest ? node.closest(".ss-exp-layout.is-full > .ss-exp-panel") : null;
  }
  function scrollBoxTo(box, target) {
    target = Math.max(0, Math.min(target, box.scrollHeight - box.clientHeight));
    if (Math.abs(target - box.scrollTop) < 1) return Promise.resolve(false);
    try {
      box.scrollTo({ top: target, behavior: reduceMotion() ? "auto" : "smooth" });
    } catch (e) {
      box.scrollTop = target;
    }
    return new Promise(function (resolve) {
      if (document.hidden) {
        resolve(true);
        return;
      }
      var last = -1;
      var still = 0;
      var t0 = Date.now();
      (function tick() {
        var y = box.scrollTop;
        still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
        last = y;
        if (still >= 4 || Date.now() - t0 > 1200 || document.hidden) resolve(true);
        else setTimeout(tick, 16);
      })();
    });
  }
  // 조작 칸 안의 [top, bottom](뷰포트 좌표) 범위를 칸 안(위아래 8px 틈)에 **최소로** 넣는다. 이미 보이면 가만히, 다 안 들어가면 위쪽을 맞춘다.
  function revealInDock(dock, top, bottom) {
    if (!dock || !(bottom > top)) return Promise.resolve(false);
    var d = dock.getBoundingClientRect();
    if (!(d.height > 0)) return Promise.resolve(false);
    var bt = d.top + dock.clientTop + 8;
    var bb = d.top + dock.clientTop + dock.clientHeight - 8;
    if (top >= bt - 1 && bottom <= bb + 1) return Promise.resolve(false);
    var delta = bottom - top <= bb - bt && bottom > bb ? bottom - bb : top - bt;
    if (Math.abs(delta) < 1) return Promise.resolve(false);
    return scrollBoxTo(dock, dock.scrollTop + delta);
  }
  function revealNodeInDock(node) {
    var dock = dockOf(node);
    if (!dock) return Promise.resolve(false);
    var r = node.getBoundingClientRect();
    if (!(r.height > 0)) return Promise.resolve(false);
    return revealInDock(dock, r.top, r.bottom);
  }
  /* SciSim.Experiment.scrollIntoView(node, opts) — 크게 보기(화면에 고정된 한 화면 실험실) 안의 노드면 조작 칸만 움직이고
     (장면 칼럼은 늘 보이므로 가만히), 그 밖(기본 화면)은 예전처럼 페이지를 스크롤한다. 앱이 부르는 공개 함수라 규칙을 한 곳에 둔다. */
  function scrollIntoViewAware(node, opts) {
    if (node && node.closest && node.closest(".ss-exp-layout.is-full")) return revealNodeInDock(node);
    return scrollIntoViewSafe(node, opts);
  }

  /* ── 크게 보기(전체 화면 보기) 도우미 — create()가 이것을 쓰고, 공통 create()를 안 쓰고 같은 구조(.ss-exp-layout > .ss-exp-view-col >
   *    .ss-exp-view + .ss-exp-panel, #experiment-root 안)를 직접 만드는 앱도 부를 수 있다(fix-A F9, 예: sci-6-2-1-3·sci-6-2-1-4 단계 B).
   *   var enl = SciSim.Experiment.enlarge({
   *     layout: layoutEl,          // .ss-exp-layout — 켜면 .is-full(한 화면 실험실). #experiment-root 안에 있어야 템플릿 규칙이 적용된다
   *     viewBox: viewBoxEl,        // .ss-exp-view(장면 칸) — 토글 버튼과 막대가 이 안(맨 뒤)에 붙는다
   *     panel: panelEl,            // 선택: .ss-exp-panel — 켜면 조작 칸(가로 화면은 장면 오른쪽, 세로 화면은 장면 아래)이 된다
   *     run: btn, record: btn,     // 선택: 켜면 막대로 옮길 실행·기록 버튼(끄면 원래 자리로 — 복제가 아니라 같은 엘리먼트 이동)
   *     runCard: node,             // 선택: run을 막대로 옮긴 동안 숨길 카드
   *     scenePanel: node,          // 선택: 지금 값 노드 — 켜짐+넓은 화면은 막대 윗줄 전체, 켜짐+좁은/낮은 화면(폭 480px·높이 420px 이하)은
   *                                //   조작 칸 맨 위 카드, 끄면 원래 자리(넘기기 전에 어디에도 안 붙였으면 그 카드)
   *     onChange: function (on) {} // 선택: 켜고 끌 때마다(관찰 카드 번호 바꾸기 등)
   *   });
   *   → { isOn(), set(on)(앱이 켜고 끔 — 학생 선택으로 기억하지 않음), refresh()(자리 다시 맞춤), fit()(예전 API — 지금은 할 일 없음), bar, toggle }
   *   켜면(2026-09-26 spec 개정 6): 레이아웃이 머리말 아래 ~ 아래 이동 막대 위 화면에 고정되고(style-common.css — 페이지는 스크롤되지
   *   않는다), 장면 칼럼과 조작 칸(패널)이 겹치지 않게 나란히 온다. 조작 칸만 그 안에서 스크롤된다.
   *   장면 위에 있던 것(단계 섹션의 안내 카드 + 레이아웃 앞의 '실험 방법 알아 두기'·안내 줄)은 조작 칸 맨 위로('알아 두기'는 제목 줄만 —
   *   학생 선택으로 저장하지 않고, 학생이 크게 보기에서 직접 펴거나 접지 않았으면 끌 때 원래대로 편다),
   *   장면 칼럼의 모형 설명(.ss-model-note)은 조작 칸 맨 끝으로, 좁은/낮은 화면에서는 보기 도구 줄(.ss-view-tools)도 조작 칸 끝으로
   *   옮긴다(장면 칼럼이 장면으로 차게) — 끄면 모두 원래 자리로. 앱이 장면 칼럼에 넣은 카드(시간 바 등)는 옮기지 않는다(장면 아래 그대로).
   *   예전 observe 옵션(켜면 관찰 카드를 패널 맨 앞으로)은 받아도 무시한다 — 관찰 카드는 조작 칸 안 원래 순서(조건 카드 다음)에 둔다.
   *   막대에 넣을 것이 없으면(run·record 없고 scenePanel도 없거나 좁은 화면) 막대를 숨긴다(빈 막대 없음). 막대가 보이는 3D 장면은
   *   .ss-view3d가 막대 위에서 끝난다(.has-bar) — 3D 칸 안의 안내 글·이름표·카메라 맞춤이 막대에 가리지 않는다.
   *   켜져 있을 때 Esc 키 = 기본 화면(팝업이 떠 있거나 이미 처리된 Esc는 건드리지 않는다). */
  function enlarge(e) {
    var layout = e.layout;
    var viewBox = e.viewBox;
    var panel = e.panel || null;
    var run = e.run || null;
    var record = e.record || null;
    var runCard = e.runCard || null;
    var scenePanel = e.scenePanel || null;
    var on = false;
    var runHome = homeOf(run);
    var recordHome = homeOf(record);
    var panelHome = homeOf(scenePanel); // 앱이 넘기기 전에 이미 자기 DOM에 붙여 둔 자리(기본 화면에서 되돌아갈 곳)
    var viewCol = viewBox.parentNode; // .ss-exp-view-col
    var root = layout.parentNode; // #experiment-root
    var stage = layout.closest ? layout.closest("[data-stage]") : null; // 실험하기 단계 섹션
    var toolsRow = null; // 보기 도구 줄(좁은/낮은 화면의 크게 보기에서는 조작 칸 끝으로)
    if (viewCol) {
      for (var k = viewCol.firstElementChild; k; k = k.nextElementSibling) if (k.classList && k.classList.contains("ss-view-tools")) toolsRow = k;
    }
    var panelRole = panel ? panel.getAttribute("role") : null;
    var panelLabel = panel ? panel.getAttribute("aria-label") : null;

    var toggle = el("button", { type: "button", class: "ss-scene-toggle" });
    var bar = el("div", { class: "ss-exp-overlay", role: "group", "aria-label": run ? "실행하고 기록하기" : record ? "기록하기" : "지금 측정값", hidden: true });
    viewBox.appendChild(toggle); // 토글이 막대보다 앞 — Tab 순서 = 보이는 순서(왼쪽 위 토글 → 아래쪽 막대 → 조작 칸)
    viewBox.appendChild(bar);
    viewBox.classList.add("has-toggle"); // 2D 대체 화면의 위 여백을 토글 아래까지(style-common.css)
    var barPanel = null;
    var panelCard = null;
    if (scenePanel) {
      barPanel = el("div", { class: "ss-exp-overlay-panel", hidden: true }); // 막대 윗줄(켜짐 + 넓은 화면) — 막대의 첫 칸
      bar.appendChild(barPanel);
      panelCard = el("div", { class: "ss-card ss-scene-panel-card", hidden: true }); // 패널(조작 칸) 맨 위 카드
      if (panel) panel.insertBefore(panelCard, panel.firstChild);
      else viewBox.parentNode.insertBefore(panelCard, viewBox.nextSibling);
    }
    // 막대 실제 높이 → --ss-exp-overlay-h(3D 칸 아래 끝·드래그 안내 문구 자리)
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () {
        viewBox.style.setProperty("--ss-exp-overlay-h", Math.ceil(bar.getBoundingClientRect().height) + "px");
      }).observe(bar);
    }
    var mm = function (q) {
      return window.matchMedia ? window.matchMedia(q) : null;
    };
    var compactMq = mm("(max-width: 480px), (max-height: 420px)");
    var portraitMq = mm("(orientation: portrait)");

    function setToggleText() {
      toggle.textContent = "";
      toggle.appendChild(el("span", { "aria-hidden": "true", text: on ? "↙ " : "⛶ " }));
      toggle.appendChild(document.createTextNode(on ? "기본 화면" : "전체 화면 보기"));
      toggle.classList.toggle("is-on", on);
    }

    /* 조작 칸으로 옮겨 둔 노드와 원래 자리. 되돌릴 때는 옮긴 순서의 반대로(앞뒤 형제 기준 자리가 어긋나지 않게). */
    var parked = []; // [{ node, home }]
    var headsParked = []; // 조작 칸 맨 위에 옮긴 순서
    var notesParked = []; // 조작 칸 맨 끝에 옮긴 모형 설명
    var introsSeen = []; // 이번 크게 보기에서 다룬 '알아 두기'(details.ss-intro)
    /* 크게 보기에서는 '알아 두기'를 제목 줄만 남긴다(Review dock M1 — 펼쳐져 있으면 조작 칸 첫 화면이 그것으로 차서 고르는 버튼이
       안 보였다). 학생 선택으로 저장하지 않고, 학생이 크게 보기에서 직접 펴거나 접지 않았으면 끌 때 원래대로 편다.
       한 번 켠 동안 같은 카드는 한 번만 접는다(학생이 편 것을 화면 크기 변화 등으로 다시 접지 않게). */
    function foldIntro(n) {
      if (!n || n.tagName !== "DETAILS" || !n.classList.contains("ss-intro") || introsSeen.indexOf(n) >= 0) return;
      introsSeen.push(n);
      n.__ssDockFolded = n.open;
      if (!n.__ssDockWatch) {
        n.__ssDockWatch = true;
        n.addEventListener("toggle", function () {
          if (!isQuietToggle(n)) n.__ssDockFolded = false; // 학생이 직접 폄·접음 → 끌 때 그대로 둔다
        });
      }
      setOpenQuietly(n, false);
    }
    function unfoldIntros() {
      introsSeen.forEach(function (n) {
        if (n.__ssDockFolded) setOpenQuietly(n, true);
        n.__ssDockFolded = false;
      });
      introsSeen = [];
    }
    function isParked(node) {
      for (var i = 0; i < parked.length; i++) if (parked[i].node === node) return true;
      return false;
    }
    function park(node, parent, ref) {
      if (!isParked(node)) parked.push({ node: node, home: homeOf(node) });
      if (node.parentNode === parent && node.nextSibling === ref) return; // 이미 그 자리
      parent.insertBefore(node, ref);
    }
    function unpark(node) {
      for (var i = parked.length - 1; i >= 0; i--) {
        if (parked[i].node === node) {
          goHome(node, parked.splice(i, 1)[0].home);
          return;
        }
      }
    }
    // 장면 위에 있던 것: 단계 섹션에서 제목·실험 루트를 뺀 앞쪽 요소(안전 안내 등) + 루트 안에서 레이아웃 앞의 요소(알아 두기·안내 줄)
    function headNodes() {
      var out = [];
      var n;
      if (stage && root && root.parentNode === stage) {
        for (n = stage.firstElementChild; n && n !== root; n = n.nextElementSibling) if (!n.classList.contains("ss-stage-title")) out.push(n);
      }
      if (root) for (n = root.firstElementChild; n && n !== layout; n = n.nextElementSibling) if (!n.classList.contains("ss-stage-title")) out.push(n);
      return out;
    }
    function placeDock(compact) {
      if (!panel) return;
      // 1) 장면 위에 있던 것 → 조작 칸 맨 위(원래 순서대로). 앱이 나중에 더 붙인 것은 이미 옮긴 것 다음에.
      headNodes().forEach(function (n) {
        var last = headsParked.length ? headsParked[headsParked.length - 1] : null;
        park(n, panel, last && last.parentNode === panel ? last.nextSibling : panel.firstChild);
        headsParked.push(n);
      });
      headsParked.forEach(foldIntro); // '알아 두기'는 제목 줄만(위 foldIntro)
      // 2) 모형 설명 → 조작 칸 맨 끝
      if (viewCol) {
        for (var c = viewCol.firstElementChild; c; ) {
          var nx = c.nextElementSibling;
          if (c.classList && c.classList.contains("ss-model-note")) {
            park(c, panel, null);
            notesParked.push(c);
          }
          c = nx;
        }
      }
      // 3) 보기 도구 줄: 좁은/낮은 화면은 조작 칸 끝(모형 설명 앞) — 장면 칼럼이 장면만으로 차게. 넓은 화면은 장면 아래 제자리.
      if (toolsRow) {
        if (compact) {
          var firstNote = notesParked.length && notesParked[0].parentNode === panel ? notesParked[0] : null;
          park(toolsRow, panel, firstNote);
        } else unpark(toolsRow);
      }
      // 4) 접근성: 조작 칸 = 이름 있는 영역
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-label", "실험 조작");
    }
    function leaveDock() {
      unfoldIntros();
      while (parked.length) {
        var p = parked.pop();
        goHome(p.node, p.home);
      }
      headsParked = [];
      notesParked = [];
      if (!panel) return;
      if (panelRole === null) panel.removeAttribute("role");
      else panel.setAttribute("role", panelRole);
      if (panelLabel === null) panel.removeAttribute("aria-label");
      else panel.setAttribute("aria-label", panelLabel);
    }
    // 켜짐/꺼짐·화면 크기에 맞게 옮길 것을 옮긴다(복제 아님 — 이벤트·disabled 상태가 하나로 유지된다)
    function place() {
      var compact = !!(compactMq && compactMq.matches);
      layout.classList.toggle("is-full", on);
      setToggleText();
      if (on) {
        // 막대 순서(보이는 순서 = DOM·Tab 순서): 측정값(윗줄 전체, barPanel은 늘 첫 칸) → 실행 → 기록하기
        if (run && run.parentNode !== bar) bar.appendChild(run);
        if (record && record.parentNode !== bar) bar.appendChild(record);
      } else {
        goHome(run, runHome);
        goHome(record, recordHome);
      }
      if (runCard) runCard.hidden = on && !!run;
      if (scenePanel) {
        if (on && !compact) {
          if (scenePanel.parentNode !== barPanel) barPanel.appendChild(scenePanel);
          barPanel.hidden = false;
          panelCard.hidden = true;
        } else if (on || !panelHome) {
          if (scenePanel.parentNode !== panelCard) panelCard.appendChild(scenePanel);
          barPanel.hidden = true;
          panelCard.hidden = false;
        } else {
          goHome(scenePanel, panelHome);
          barPanel.hidden = true;
          panelCard.hidden = true;
        }
      }
      if (on) placeDock(compact);
      else leaveDock();
      bar.hidden = !(on && (run || record || (scenePanel && !compact)));
      viewBox.classList.toggle("has-bar", !bar.hidden);
    }
    listenMq(compactMq, function () {
      place();
    });
    // 앱이 나중에 장면 위(단계 섹션·루트)에 안내를 더 붙여도 켜져 있으면 조작 칸 맨 위로(우리 자신의 옮기기로는 새로 옮길 것이 없어 멈춘다)
    if (panel && "MutationObserver" in window) {
      var headMo = new MutationObserver(function () {
        if (on) placeDock(!!(compactMq && compactMq.matches));
      });
      if (stage) headMo.observe(stage, { childList: true });
      if (root && root !== stage) headMo.observe(root, { childList: true });
    }

    function prefKey() {
      return "sceneMode:" + (portraitMq && portraitMq.matches ? "portrait" : "landscape");
    }
    // 태블릿 세로(세로 방향·폭 600px 이상)는 켜짐이 기본 — 단 막대에 넣을 것(실행·기록 버튼이나 측정값)이 없는 앱은 끔이 기본
    // (Review A2 N1 — 예: 막대가 비는 앱). 학생이 누른 선택은 그대로 기억한다.
    function defaultOn() {
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      return !!(portraitMq && portraitMq.matches && w >= 600 && (run || record || scenePanel));
    }
    function set(v, opts) {
      on = !!v;
      place();
      if (!(opts && opts.silent) && SciSim.uiPref) SciSim.uiPref.set(prefKey(), on);
      if (e.onChange) e.onChange(on);
    }
    function applyForOrientation() {
      var pref = SciSim.uiPref ? SciSim.uiPref.get(prefKey()) : null;
      set(pref === null || pref === undefined ? defaultOn() : pref, { silent: true });
    }
    // 기본 화면으로 돌아오면 장면이 화면에 보이게 한다(크게 보기는 화면에 고정되어 따로 맞출 것이 없다)
    function turnOffByUser() {
      var hadFocus = layout.contains(document.activeElement);
      set(false);
      scrollIntoViewSafe(viewBox);
      // 조작 칸 맨 위로 옮겼던 것(알아 두기 등)에 초점이 있었으면 되돌리며 초점을 잃는다 → 토글로
      if (hadFocus && (!document.activeElement || document.activeElement === document.body)) {
        try {
          toggle.focus({ preventScroll: true });
        } catch (err) {
          toggle.focus();
        }
      }
    }
    toggle.addEventListener("click", function () {
      if (on) turnOffByUser();
      else set(true);
    });
    // 화면에 떠 있는 팝업(aria-modal — 숨겨 둔 로그인 안내 가림막 등은 빼고)
    function modalOpen() {
      var ms = document.querySelectorAll('[aria-modal="true"]');
      for (var i = 0; i < ms.length; i++) if (ms[i].getClientRects().length) return true;
      return false;
    }
    document.addEventListener("keydown", function (ev) {
      if (!on || ev.key !== "Escape" || ev.defaultPrevented || ev.isComposing) return;
      if (!layout.getClientRects().length) return; // 실험하기 단계가 안 보일 때
      if (modalOpen()) return; // 팝업이 떠 있으면 팝업 몫
      turnOffByUser();
    });
    listenMq(portraitMq, applyForOrientation);
    applyForOrientation();

    return {
      isOn: function () {
        return on;
      },
      set: function (v) {
        set(v, { silent: true });
      },
      refresh: function () {
        place();
      },
      // 예전 API(장면 높이 다시 재기) — 한 화면 실험실은 CSS가 크기를 정하므로 할 일이 없다(3D↔2D 뒤에 불러도 된다)
      fit: function () {},
      bar: bar,
      toggle: toggle,
    };
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
        if (isQuietToggle(det)) return; // 크게 보기가 잠시 접고 편 것(학생 선택 아님)
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
    // 크게 보기에서는 실행 카드가 숨고(실행 버튼은 장면 안 막대) 관찰 카드는 번호 대신 👀로 보인다(enlarge onChange)
    var nRunDefault = CIRCLED[o.factors.length];
    var nObsDefault = CIRCLED[o.factors.length + 1];
    // ss-run-btn / ss-record-btn: 앱이 버튼을 찾는 고정 훅(크게 보기에서는 관찰 카드가 아니라 장면 안 막대에 있다) — exp.runButton / exp.recordButton
    R.run = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide ss-run-btn", disabled: true });
    R.runStepN = el("span", { class: "ss-step-n", text: nRunDefault });
    R.runCard = el("div", { class: "ss-card ss-step-card ss-run-card" }, [el("h3", { class: "ss-step-h" }, [R.runStepN, " " + (o.runTitle || "실험하기")]), R.run]);
    panel.appendChild(R.runCard);
    R.skip = el("div", { class: "ss-card ss-skip-card", role: "note", "aria-live": "polite", hidden: true });
    panel.appendChild(R.skip);
    R.obsQ = el("p", { class: "ss-observe-q" });
    R.obsBody = el("div", { class: "ss-observe-body" });
    R.obsChoices = el("div", { class: "ss-obs-input" });
    R.record = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide ss-record-btn", text: "📝 기록하기", disabled: true }); // 진행 중인 관찰이 없으니 처음부터 꺼 둔다
    R.recordMsg = el("p", { class: "ss-help", "aria-live": "polite" });
    R.checkBtn = el("button", { type: "button", class: "ss-btn ss-check-btn", text: "✔️ 확인하기" });
    R.retryBtn = el("button", { type: "button", class: "ss-btn ss-btn-ghost", hidden: true });
    R.checkRow = el("div", { class: "ss-row ss-check-row", hidden: true }, [R.checkBtn, R.retryBtn]);
    R.checkFb = el("p", { class: "ss-feedback", "aria-live": "polite", hidden: true });
    R.checkNode = el("div", { class: "ss-check-node", hidden: true });
    R.obsStepN = el("span", { class: "ss-step-n", text: nObsDefault });
    var observeKids = [el("h3", { class: "ss-step-h" }, [R.obsStepN, " 관찰하고 기록하기"]), R.obsQ, R.obsBody, R.obsChoices, R.checkRow, R.checkFb, R.checkNode, R.record, R.recordMsg];
    R.observe = el("div", { class: "ss-card ss-step-card ss-observe", hidden: true }, observeKids);
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
    var layoutEl = el("div", { class: "ss-exp-layout" }, [viewCol, panel]);
    o.root.appendChild(layoutEl);

    /* ── 전체 화면 보기(모든 앱에 자동 — 토글, 옵트인 아님) ── 공통 도우미 enlarge()가 맡는다.
       기본 배치(꺼짐)는 지금까지와 같다. 켜면(2026-09-26 spec 개정 6 "한 화면 실험실"): 실험 영역이 머리말~아래 이동 막대 사이 화면에
       고정되고, 장면 + 조작 칸(이 패널 — 가로 화면은 오른쪽, 세로 화면은 아래)이 나란히 온다. 실행·기록 버튼(+scenePanel)은 장면 안
       아래쪽 막대로 옮겨 간다(복제 아님 — 이벤트·disabled 상태 유지). 관찰 카드는 조작 칸 안 원래 자리(조건 카드 다음)에 그대로 있다.
       조건이 없거나(factors: []) sceneBar:false면 실행·기록 버튼은 옮기지 않는다(앱이 자기 버튼으로 기록하는 경우 —
       앱이 숨겨 둔 실행 카드가 막대에 가짜 버튼으로 나오지 않게, fix-A F1). */
    var useBar = o.sceneBar !== false && o.factors.length > 0;
    R.enl = enlarge({
      layout: layoutEl,
      viewBox: R.viewBox,
      panel: panel,
      run: useBar ? R.run : null,
      record: useBar ? R.record : null,
      runCard: useBar ? R.runCard : null,
      scenePanel: o.scenePanel || null,
      onChange: function (on) {
        // 크게 보기에서는 실행 카드(번호 ③ 등)가 숨고 실행 버튼이 장면 안 막대에 있으므로, 관찰 카드는 번호 대신 👀로 표시한다
        // (조건 카드 ①② 다음에 바로 👀 — 번호가 건너뛰어 보이지 않게, Review A2 N6)
        R.obsStepN.textContent = on && useBar ? "👀" : nObsDefault;
      },
    });
    R.overlay = R.enl.bar;
    R.enlargeBtn = R.enl.toggle;
    // 실행·기록 버튼이 장면 안 막대에 있는 크게 보기인가(기록 버튼이 늘 보인다)
    function barMode() {
      return useBar && R.enl.isOn() && !R.overlay.hidden;
    }
    // 크게 보기의 조작 칸(켜져 있을 때만, 아니면 null) — 스크롤은 이 칸 안에서만 한다
    function dock() {
      return R.enl.isOn() ? dockOf(R.observe) : null;
    }
    // 방금 누른 곳(조건 버튼·미니 표 칸 등) — 크게 보기에서 관찰 카드를 숨길 때 그 자리가 튀지 않게 한다(afterSelect)
    var touched = null;
    o.root.addEventListener(
      "click",
      function (ev) {
        touched = ev.target;
        setTimeout(function () {
          touched = null;
        }, 0);
      },
      true
    );

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
      // 크게 보기: 관찰 카드를 숨기면 조작 칸 내용이 짧아져(칸 아래쪽을 보고 있었으면) 칸의 스크롤이 줄며 방금 누른 조건 버튼이
      // 튈 수 있다 → 숨기기 전·후 방금 누른 곳(의 카드)의 자리를 재서 차이만큼 **조작 칸만** 되돌린다(페이지는 움직이지 않는다).
      // 브라우저 스크롤 앵커링이 이미 맞췄으면 차이가 0이라 두 번 보정되지 않는다(iPad Safari는 앵커링이 없을 수 있다).
      // 장면·막대에서 고른 경우(3D 누르기 등)는 조작 칸 밖이라 그대로. 기본 화면은 예전처럼 보정하지 않는다.
      var anchor = null;
      var before = 0;
      var box = dock();
      if (box && !R.observe.hidden && touched && touched.isConnected && box.contains(touched) && !R.observe.contains(touched)) {
        anchor = (touched.closest && touched.closest(".ss-card")) || touched;
        before = anchor.getBoundingClientRect().top;
      }
      trial = null;
      R.observe.hidden = true;
      R.record.disabled = true; // 기록 버튼이 관찰 카드 밖(장면 안 막대)에 있어도 진행 중인 관찰이 없으면 늘 비활성
      draw();
      if (view) view.highlight(Object.assign({}, sel));
      if (anchor && anchor.isConnected && box.contains(anchor)) {
        var ar = anchor.getBoundingClientRect();
        var d = ar.top - before;
        if (ar.height > 0 && Math.abs(d) >= 1) box.scrollTop += d;
      }
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
      R.record.disabled = true;
      var v = view;
      try {
        // 세로 화면·휴대폰: 버튼이 실험 화면 아래에 있으므로 먼저 실험 화면을 보이게 한다(크게 보기는 장면이 화면에 고정되어 늘 보인다)
        if (!R.enl.isOn()) await scrollIntoViewSafe(R.viewBox);
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
            revealNext(); // 켜졌으면 '기록하기', 확인이 필요하면 '확인하기' 줄이 보이게(가리면만)
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
        if (R.observe.hidden) return;
        // 크게 보기: 관찰 카드는 조작 칸 안 원래 자리(조건 카드 다음) — **조작 칸 안에서만** 최소로 스크롤해 보인다
        // (칸보다 길면 카드 위쪽을 맞춘다). 장면·막대·페이지는 움직이지 않는다.
        if (dock()) revealNodeInDock(R.observe);
        else scrollIntoViewSafe(R.observe, { align: "nearest" });
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
      revealNext();
    }
    /* 보기를 고르거나 '확인하기'를 누른 뒤 다음에 누를 곳이 가려져 있을 때만 최소로 스크롤한다(이미 보이면 그대로 둔다).
       '기록하기'가 켜졌으면 revealRecord, 꺼져 있고 확인이 필요하면 '확인하기' 줄과 그 아래 피드백(revealCheck). */
    function revealNext() {
      revealRecord();
      revealCheck();
    }
    /* '기록하기'가 켜져 있고 안 보이면 보이게 한다(fix-A F4). 꺼져 있으면 아무것도 안 한다(확인 전에 막대까지 끌어올려
       '확인하기'를 화면 밖으로 밀어내지 않게). 크게 보기(2026-09-26): 기록 버튼이 장면 안 막대에 있으면 늘 보이므로 페이지·조작 칸을
       움직이지 않는다 — 다만 방금 나온 확인 피드백(⭕ 맞아요 등)이 조작 칸 밖에 있으면 **조작 칸 안에서만** 최소로 보인다.
       막대가 없는 앱(sceneBar:false·factors:[])은 관찰 카드 안의 기록 버튼을 조작 칸 안에서만 보이게 한다.
       기본 화면: 예전처럼 기록 버튼(관찰 카드 맨 아래)이 가리면 보이게. 앱의 '가리면 스크롤' 도우미도 exp.revealRecord()로 부른다(규칙을 한 곳에). */
    function revealRecord() {
      setTimeout(function () {
        if (R.observe.hidden || R.record.disabled) return;
        var box = dock();
        if (box) {
          if (barMode()) {
            var top = 0;
            var bottom = 0;
            [R.checkFb, R.checkNode].forEach(function (n) {
              if (n.hidden) return;
              var q = n.getBoundingClientRect();
              if (!(q.height > 0)) return;
              if (!top) top = q.top;
              bottom = Math.max(bottom, q.bottom);
            });
            if (bottom) revealInDock(box, top, bottom);
          } else revealNodeInDock(R.record);
          return;
        }
        var f = document.querySelector(".ss-footer-nav");
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var bottom = f ? f.getBoundingClientRect().height : 0;
        var r = R.record.getBoundingClientRect();
        if (r.bottom > vh - bottom + 1 || r.top < 0) scrollIntoViewSafe(R.record, { align: "nearest" });
      }, 60);
    }
    // '기록하기'가 꺼져 있고 '확인하기'가 필요할 때: '확인하기' 줄과 그 아래 피드백·덧붙인 노드가 가리면 최소로 보이게
    // (크게 보기는 조작 칸 안에서만 — 페이지는 움직이지 않는다)
    function revealCheck() {
      setTimeout(function () {
        if (R.observe.hidden || !R.record.disabled || R.checkRow.hidden) return;
        var r = R.checkRow.getBoundingClientRect();
        var top = r.top;
        var bottom = r.bottom;
        [R.checkFb, R.checkNode].forEach(function (n) {
          if (n.hidden) return;
          var q = n.getBoundingClientRect();
          if (q.height > 0) bottom = Math.max(bottom, q.bottom);
        });
        var box = dock();
        if (box) revealInDock(box, top, bottom);
        else revealRange(top, bottom);
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
      R.record.disabled = true;
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
      R.tip.textContent = kind === "3d" ? o.view.tip3D || "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향" : o.view.tip2D || "2D 화면(모형)이에요. 눌러서 고를 수 있어요.";
      // 좁은 화면 기본 화면용 덧붙임(페이지를 움직이는 법) — 크게 보기는 페이지가 움직이지 않으므로 CSS가 숨긴다(.ss-tip-page)
      if (kind === "3d" && narrow) R.tip.appendChild(el("span", { class: "ss-tip-page", text: " · 페이지를 위아래로 움직일 때는 3D 화면 바깥을 밀어요" }));
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
      // 앱이 공통 실행·기록 버튼을 찾는 고정 훅(fix-A F2) — 관찰 카드 안 선택자로 찾지 않는다(크게 보기에서는 막대에 있다)
      runButton: R.run,
      recordButton: R.record,
      revealRecord: revealRecord,
      isEnlarged: function () {
        return R.enl.isOn();
      },
    };
  }

  SciSim.Experiment = { create: create, enlarge: enlarge, scrollIntoView: scrollIntoViewAware, sleep: sleep, isQuietToggle: isQuietToggle };

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
