/*
 * app.js — sci-6-2-3-2 "전기 회로에 전지 한 개를 더 연결하면 어떻게 될까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장·로그인/진행 저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(전지 한 개 회로 · 전지 두 개 직렬연결 회로 + 전구/전동기/버저, 3D는 앞 가운데 부품 상자)
 *   ② 관찰 카드(두 회로 비교)  ③ 버저 소리(WebAudio, 학생이 버튼을 누른 뒤에만, 한 회로씩 차례로)
 *   ④ '더 탐구해 보고 싶어요' 팝업  ⑤ 분석 표·완료 저장  만 만든다.
 *
 * 2026-09-27 사용자 결정(spec.md 개정 2 — 단계 D): 조건(factor)은 부품(전구/전동기/버저) 1개 = 3칸.
 * 실행하면 두 회로의 스위치를 함께 닫아 나란히 비교하고, 관찰 카드는 부품마다 "더 ○○한 회로는 전지를 어떻게 연결했을 때인가요?"를
 * 묻는다(보기: 전지 1개 연결 / 전지 2개 직렬연결). 버저 소리는 섞이지 않게 한 회로씩 차례로 내고, 소리가 나는 회로를 표시한다.
 * 부품 위 세기 표시(▮▯▯)는 없앴다 — 전구 빛, 날개 빠르기, 버저 소리 파동으로 비교한다. 소리 파동(원형 고리, 모형)은 두 회로가
 * 크기·개수·간격·퍼지는 빠르기가 모두 같고 소리가 큰 쪽만 고리 선이 더 굵으며, 버저 소리는 높이가 같고 크기(음량)만 다르다
 * (2026-09-27 사용자 후속 결정 — 실제로도 소리가 커지면 세기만 커지고 퍼지는 빠르기·높이는 그대로다).
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var S = window.SciSim;
  var el = S.el;
  var $ = function (id) {
    return document.getElementById(id);
  };

  // 예전 판(6칸 기록·'궁금한 점' 단계, sci623sim2:v1)의 이 기기 사본을 지운다(2026-09-27 — sci-6-1-1-1과 같은 방식, 단계 C Review M1).
  // 남겨 두면 로그아웃할 때 사이트가 예전 판 사본을 올리려다 "다른 기기에서 저장한 기록과 달라요" 창을 띄우고, '확인'을 누르면
  // 새 판 진행 기록이 예전 것으로 덮일 수 있다. 예전 판은 새 판에서 쓰지 않는다(저장 키 버전을 올림). 이 앱의 예전 키만 지운다(localStorage.clear() 금지).
  (function () {
    var OLD = ["sci623sim2:v1"];
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        for (var j = 0; j < OLD.length; j++) if (k && (k === OLD[j] || k.indexOf(OLD[j] + ":") === 0)) drop.push(k);
      }
      drop.forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (e) {
      /* 저장소를 못 쓰면 지울 것도 없다 */
    }
  })();
  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;

  /* ───────── 차시 데이터 ───────── */
  var PART = {};
  C.parts.forEach(function (p, i) {
    PART[p.id] = Object.assign({ index: i }, p);
  });
  var CIR = {};
  C.circuits.forEach(function (c, i) {
    CIR[c.id] = Object.assign({ index: i }, c);
  });
  var CHOICES = C.circuits.map(function (c) {
    return c.choice;
  });
  function cmp(partId) {
    return C.compare.parts[partId];
  }
  // 보기(전지 1개 연결 / 전지 2개 직렬연결) → 전지 아이콘(분석 표에서 글자 앞에 — 색이 아니라 모양으로도 구분)
  function choiceIcon(choice) {
    for (var i = 0; i < C.circuits.length; i++) if (C.circuits[i].choice === choice) return C.circuits[i].icon;
    return null;
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, document.hidden ? 0 : ms);
    });
  }
  // 두 회로의 스위치를 닫아 결과가 보이는 부품(partId → true, 전구·전동기). 3D·2D가 함께 쓴다(한 번에 한 화면만 있다) — 관찰 카드 확인에도 쓴다.
  var lit = {};
  var activeView = null; // 지금 실험 화면(3D 또는 2D) — 버저 스위치 상태를 다시 그릴 때 부른다
  /* 버저 스위치(2026-09-27 사용자 — build-D 지침 D2-2 9·10번): 버저는 두 회로의 스위치를 하나씩 따로 여닫는다.
     closed = 지금 닫힌 회로(null | "single" | "series2" — 하나를 닫으면 다른 하나는 저절로 열린다),
     heard = 이번 버저 관찰에서 닫아 들어 본 회로(두 회로를 모두 들어 본 뒤에 관찰 카드 확인),
     pending = 버튼·손잡이로 누른 회로(공통 틀 run()이 view.run으로 넘길 때 읽고 비운다). 저장하지 않는다(새로 고침하면 모두 열림). */
  var buzz = { closed: null, heard: { single: false, series2: false }, pending: null };
  var selPart = null; // 공통 틀에서 지금 고른 부품(syncRunUI가 적어 둔다)

  /* ───────── 버저 소리(WebAudio) ─────────
   * · 학생이 버튼(스위치 닫기)이나 스위치 손잡이를 누른 뒤에만 소리가 난다(자동 재생 없음).
   * · 스위치가 닫혀 있는 동안 계속 울린다(사용자 "스위치 닫고 있는 동안 계속 울리는 것으로 해줘") — 열면 멈추고, 다른 쪽을 닫으면 그쪽 소리로 바뀐다.
   * · 전지 한 개 0.15, 전지 두 개 직렬 0.35 — 교실에서 시끄럽지 않게 작은 음량으로 크기 차이만 낸다. 소리의 높이는 두 회로가 같다
   *   (BUZZ_HZ — 2026-09-27 사용자 후속 결정: 전에는 660/700 Hz로 높이도 달라 "큰 소리 = 높은 소리"로 오해할 수 있었다).
   * · 끈 상태는 이 앱의 저장소(store)에 기억한다. 소리를 꺼도 화면의 소리 파동(고리 선의 굵기)으로 비교할 수 있다.
   * · 부품을 바꾸거나 실험하기를 떠나거나 화면이 숨으면 스위치를 열어 소리를 멈춘다(openBuzz).
   */
  var BUZZ_HZ = 660; // 버저 소리의 높이 — 두 회로가 같다(크기만 다르다)
  var sound = {
    on: store.get("sound", true) !== false,
    ctx: null,
    node: null, // { osc, gain, circuit } — 지금 울리는 소리
    buttons: [],
  };
  function audioCtx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!sound.ctx) {
      try {
        sound.ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (sound.ctx.state === "suspended" && sound.ctx.resume) {
      try {
        sound.ctx.resume();
      } catch (e) {
        /* 무시 */
      }
    }
    return sound.ctx;
  }
  // 실험 화면 안에서 누르는 모든 버튼을 '학생의 조작'으로 보고 오디오를 깨운다(소리는 버저 실험에서만 난다).
  // 키보드(Enter·Space)로 누를 때도 깨우도록 click·keydown도 본다.
  function wakeAudio(e) {
    if (!sound.on) return;
    var t = e.target;
    if (t && t.closest && t.closest("#experiment-root")) audioCtx();
  }
  ["pointerdown", "click", "keydown"].forEach(function (type) {
    document.addEventListener(type, wakeAudio, true);
  });
  function stopBuzzer() {
    if (!sound.node) return;
    var n = sound.node;
    sound.node = null;
    try {
      n.gain.gain.cancelScheduledValues(sound.ctx.currentTime);
      n.gain.gain.setTargetAtTime(0, sound.ctx.currentTime, 0.02);
      n.osc.stop(sound.ctx.currentTime + 0.12);
    } catch (e) {
      /* 무시 */
    }
  }
  // 닫힌 회로의 버저 소리를 멈출 때까지 계속 낸다(음량만 회로마다 다르다). 오디오가 아직 깨지 않았으면 깨운 뒤 다시 본다.
  function startTone(circuitId) {
    var ctx = audioCtx();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      if (ctx.resume) {
        try {
          ctx.resume().then(syncTone, function () {});
        } catch (e) {
          /* 무시 */
        }
      }
      return false;
    }
    stopBuzzer();
    var peak = circuitId === "series2" ? 0.35 : 0.15;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(BUZZ_HZ, t0);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1400, t0);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    sound.node = { osc: osc, gain: gain, circuit: circuitId };
    osc.onended = function () {
      if (sound.node && sound.node.osc === osc) sound.node = null;
    };
    return true;
  }
  // 버저 소리를 지금 상태에 맞춘다: 버저를 골랐고, 실험하기가 보이고, 스위치가 닫혀 있고, 소리가 켜져 있으면 그 회로 소리, 아니면 멈춤
  function buzzStageOn() {
    var sec = document.querySelector('[data-stage="experiment"]');
    return !!(sec && !sec.hidden) && !document.hidden;
  }
  function syncTone() {
    var want = selPart === "buzzer" && buzz.closed && sound.on && buzzStageOn() ? buzz.closed : null;
    if (!want) {
      stopBuzzer();
      return;
    }
    if (sound.node && sound.node.circuit === want) return;
    startTone(want);
  }
  // 두 스위치를 열고 소리를 멈춘다(부품 바꾸기·실험하기 떠나기·화면 숨김·되돌리기). resetHeard면 '들어 본 회로'도 비운다.
  function openBuzz(resetHeard) {
    buzz.closed = null;
    buzz.pending = null;
    if (resetHeard) buzz.heard = { single: false, series2: false };
    stopBuzzer();
    if (activeView && activeView.refreshBuzz) activeView.refreshBuzz();
    updateSwitchButtons();
  }
  function soundLabel() {
    return sound.on ? "🔈 소리 끄기" : "🔇 소리 켜기";
  }
  function soundHelp() {
    return sound.on
      ? "버저 실험에서는 스위치를 닫은 회로의 버저에서 작은 소리가 계속 나요(스위치를 열면 멈춰요). 교실에서 시끄러우면 소리를 꺼도 화면의 소리 파동(고리 선의 굵기)으로 비교할 수 있어요."
      : "소리가 꺼져 있어요. 화면의 소리 파동(고리 선의 굵기)으로 비교할 수 있어요.";
  }
  function refreshSoundButtons() {
    sound.buttons.forEach(function (b) {
      b.textContent = soundLabel();
      b.setAttribute("aria-pressed", String(!sound.on));
    });
  }
  function toggleSound() {
    sound.on = !sound.on;
    store.set("sound", sound.on);
    if (sound.on) audioCtx();
    syncTone(); // 끄면 멈추고, 켜면 닫혀 있는 회로의 소리를 다시 낸다(스위치는 그대로)
    refreshSoundButtons();
    var help = $("sound-help");
    if (help) help.textContent = soundHelp();
    toast(sound.on ? "소리를 켰어요." : "소리를 껐어요.");
  }
  function soundButton(cls) {
    var b = el("button", { type: "button", class: cls || "ss-btn", "aria-pressed": String(!sound.on), text: soundLabel(), onclick: toggleSound });
    sound.buttons.push(b);
    return b;
  }

  /* ───────── 버저 스위치 버튼 두 개(버저를 골랐을 때만 공통 실행 버튼 대신 — build-D 지침 D2-2 9·10번) ─────────
   * "스위치 닫기(전지 1개)"·"스위치 닫기(2개 직렬)"(사용자 문구) — 누르면 그 버튼이 "스위치 열기(○○)"로 바뀐다. 하나를 닫으면 다른 하나는
   * 저절로 열린다. 누름은 공통 틀의 실행 버튼(exp.runButton, 숨김)을 대신 눌러 틀의 run() 흐름(실행 중 잠금·관찰 카드 다시 준비)을 그대로 탄다
   * — 어느 회로인지는 buzz.pending으로 view.run에 넘긴다. 크게 보기에서는 장면 안 막대에 한 줄([스위치][스위치][기록하기]),
   * 기본 화면에서는 실행 카드 안에 좌우로(글자 두 줄: "스위치 닫기" / "(전지 1개)"). 글자가 할 일을 말하므로 aria-pressed는 쓰지 않는다. */
  function switchIcon() {
    var NS = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(NS, "svg");
    [["viewBox", "0 0 24 24"], ["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "2.2"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["class", "sw-ic"], ["aria-hidden", "true"], ["focusable", "false"]].forEach(function (a) {
      s.setAttribute(a[0], a[1]);
    });
    var p1 = document.createElementNS(NS, "path");
    p1.setAttribute("d", "M2 17h4.2M17.8 17H22");
    var c1 = document.createElementNS(NS, "circle");
    [["cx", "7"], ["cy", "17"], ["r", "1.9"], ["fill", "currentColor"], ["stroke", "none"]].forEach(function (a) {
      c1.setAttribute(a[0], a[1]);
    });
    var c2 = c1.cloneNode();
    c2.setAttribute("cx", "17");
    var p2 = document.createElementNS(NS, "path");
    p2.setAttribute("d", "M7 17 16.2 8.6");
    [p1, c1, c2, p2].forEach(function (n) {
      s.appendChild(n);
    });
    return s;
  }
  var swButtons = C.circuits.map(function (c) {
    var main = el("span", { class: "sw-main" });
    var btn = el("button", { type: "button", class: "ss-btn ss-btn-big sw-btn sw-" + c.id, "data-circuit": c.id }, [
      el("span", { class: "sw-l1" }, [switchIcon(), main]),
      el("span", { class: "sw-sub", text: "(" + c.sw + ")" }),
    ]);
    btn.addEventListener("click", function () {
      pressSwitch(c.id);
    });
    return { id: c.id, btn: btn, main: main };
  });
  var swPair = el(
    "div",
    { class: "sw-pair", role: "group", "aria-label": "버저 스위치", hidden: true },
    swButtons.map(function (b) {
      return b.btn;
    })
  );
  function updateSwitchButtons() {
    swButtons.forEach(function (b) {
      b.main.textContent = buzz.closed === b.id ? "스위치 열기" : "스위치 닫기";
    });
  }
  updateSwitchButtons();
  // 버저 스위치 누르기(버튼·3D/2D 손잡이): 실행 중이면 무시. 공통 틀 run()을 거쳐 view.run이 그 회로만 여닫는다.
  function pressSwitch(circuitId) {
    if (!exp || exp.isBusy() || selPart !== "buzzer") return;
    var b = exp.runButton;
    if (!b || b.disabled) return;
    buzz.pending = circuitId;
    b.click();
  }

  /* ───────── 기록(부품마다 1칸: 두 회로를 비교해 고른 답) ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.part;
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(결론 + '더 탐구하고 싶은 점' 한 줄) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, function () {
    lesson.refresh();
    showFinish();
  });
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
  // '더 탐구하고 싶은 점'은 정리하기 안의 한 줄 입력(2026-09-27 — 단계 C·새 기준 앱과 같은 모양):
  // 공통 틀의 여러 줄 입력칸을 한 줄로 쓰고, Enter로 줄을 바꾸지 않게 한다. 비우면 마칠 수 없다(공통 틀 lesson.js가 본다).
  (function () {
    var ta = $("ss-curiosity");
    if (!ta) return;
    ta.rows = 1;
    ta.maxLength = C.curiosity.maxLength || 200;
    ta.classList.add("one-line");
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter") e.preventDefault();
    });
  })();
  // 결론을 제출해야 '더 탐구하고 싶은 점'과 '학습 마치기'가 보인다
  function showFinish() {
    $("finish-wrap").hidden = !conclude.isDone();
  }
  showFinish();

  /* ───────── '더 탐구해 보고 싶어요' 팝업(교과서 밖 참고 · 기록·채점 없음) ───────── */
  var modal = null;
  function parallelPicture() {
    var SVGNS = "http://www.w3.org/2000/svg";
    function s(tag, attrs, kids) {
      var n = document.createElementNS(SVGNS, tag);
      Object.keys(attrs || {}).forEach(function (k) {
        n.setAttribute(k, String(attrs[k]));
      });
      (kids || []).forEach(function (c) {
        if (c) n.appendChild(c);
      });
      return n;
    }
    function txt(x, y, t, cls) {
      var n = s("text", { x: x, y: y, "text-anchor": "middle", class: cls || "px-t" });
      n.textContent = t;
      return n;
    }
    // 전지 2개를 같은 극끼리 이어(병렬) 전구에 연결한 그림
    var g = [
      s("rect", { x: 40, y: 40, width: 90, height: 34, rx: 8, class: "px-batt" }),
      txt(52, 63, "－", "px-pole"),
      txt(120, 63, "＋", "px-pole"),
      s("rect", { x: 40, y: 100, width: 90, height: 34, rx: 8, class: "px-batt" }),
      txt(52, 123, "－", "px-pole"),
      txt(120, 123, "＋", "px-pole"),
      // 같은 극끼리 잇는 전선
      s("path", { d: "M36,57 L20,57 L20,117 L36,117", class: "px-wire px-black" }),
      s("path", { d: "M134,57 L150,57 L150,117 L134,117", class: "px-wire px-red" }),
      // 전구로 가는 전선
      s("path", { d: "M20,87 L20,170 L120,170", class: "px-wire px-black" }),
      s("path", { d: "M150,87 L230,87 L230,170 L180,170", class: "px-wire px-red" }),
      s("circle", { cx: 150, cy: 170, r: 26, class: "px-bulb" }),
      s("path", { d: "M140,170 L146,160 L154,180 L160,170", class: "px-fil" }),
      txt(150, 214, "전구", "px-cap"),
      txt(130, 16, "전지 두 개를 같은 극끼리 연결(병렬연결)", "px-cap"),
    ];
    return s("svg", { viewBox: "0 0 260 226", class: "px-svg", role: "img", "aria-label": "전지 두 개의 같은 극끼리 연결해 전구에 이은 병렬연결 회로 그림(모형)" }, g);
  }
  function openExtraModal(opener) {
    if (modal) return;
    var closeBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary", text: C.extra.close, onclick: closeExtraModal });
    var title = el("h3", { id: "px-title", class: "px-title", tabindex: "-1", text: C.extra.title });
    var box = el("div", { class: "px-box", role: "dialog", "aria-modal": "true", "aria-labelledby": "px-title", tabindex: "-1" }, [
      title,
      el("p", { class: "px-notice", text: C.extra.notice }),
      parallelPicture(),
      el("p", { class: "px-model", text: "🏷 위 그림은 회로를 간단히 나타낸 모형이에요." }),
      el(
        "div",
        { class: "px-body" },
        C.extra.paragraphs.map(function (p) {
          return S.rich(p, "p");
        })
      ),
      el("p", { class: "px-close-row" }, [closeBtn]),
    ]);
    var back = el("div", { class: "px-back", onclick: function (e) { if (e.target === back) closeExtraModal(); } }, [box]);
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeExtraModal();
        return;
      }
      if (e.key !== "Tab") return;
      var f = box.querySelectorAll("button, [href]");
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(back);
    document.body.classList.add("px-open");
    // 팝업이 떠 있는 동안 뒤 화면은 읽기·조작 대상에서 뺀다(화면 읽기 프로그램 포함)
    var behind = [].slice.call(document.querySelectorAll(".ss-header, .ss-main, .ss-footer-nav"));
    behind.forEach(function (n) {
      try {
        n.inert = true;
      } catch (e) {
        /* 무시 */
      }
      n.setAttribute("aria-hidden", "true");
    });
    modal = { back: back, onKey: onKey, opener: opener || null, behind: behind };
    // 포커스는 팝업 제목으로(작은 화면에서 제목·안내가 화면 밖으로 밀리지 않게)
    title.focus();
    back.scrollTop = 0;
    box.scrollTop = 0;
  }
  function closeExtraModal() {
    if (!modal) return;
    document.removeEventListener("keydown", modal.onKey, true);
    if (modal.back.parentNode) modal.back.parentNode.removeChild(modal.back);
    document.body.classList.remove("px-open");
    (modal.behind || []).forEach(function (n) {
      try {
        n.inert = false;
      } catch (e) {
        /* 무시 */
      }
      n.removeAttribute("aria-hidden");
    });
    var op = modal.opener;
    modal = null;
    if (op && op.focus) op.focus();
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div", { class: "intro-body" });
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    box.appendChild(
      el("div", { class: "safety-box" }, [
        el("p", { class: "safety-title", text: "⚠️ 실제 실험에서 지킬 일" }),
        el(
          "ul",
          null,
          C.intro.safety.map(function (t) {
            return el("li", { text: t });
          })
        ),
      ])
    );
    return box;
  }
  function extrasNode() {
    var btn = el("button", {
      type: "button",
      class: "ss-btn ss-btn-ghost wide",
      text: C.extra.button,
      onclick: function () {
        openExtraModal(btn);
      },
    });
    return el("div", { class: "ss-card tools-card" }, [
      el("p", { class: "tools-title", text: "🔊 소리 · 더 탐구하기" }),
      el("div", { class: "ss-row" }, [soundButton("ss-btn")]),
      el("p", { class: "ss-help", id: "sound-help", text: soundHelp() }),
      btn,
    ]);
  }

  // 부품마다 한 단계·한 칸(전구 → 전동기 → 버저, 앞 부품을 기록해야 다음 부품이 열린다 — 교과서 순서 그대로)
  var PHASES = C.parts.map(function (p) {
    return {
      id: p.phase,
      name: C.phases[p.phase].name,
      title: p.name + " 비교하기",
      lead: C.phases[p.phase].lead,
      cells: [{ part: p.id }],
    };
  });

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    extras: [extrasNode()],
    clearLabel: "🧽 실험대 처음처럼 되돌리기",
    clearMessage: "두 회로의 스위치를 모두 열어 처음 상태로 되돌렸어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "part",
        title: "연결할 부품 고르기",
        short: "부품",
        columns: 3,
        options: C.parts.map(function (p) {
          return {
            id: p.id,
            label: p.name,
            icon: function () {
              return el("span", { class: "opt-icon", "aria-hidden": "true", text: p.icon });
            },
          };
        }),
        // 틀이 조건 칸을 다시 그릴 때마다(고르기·실행·기록) 불린다 — 버저면 실행 칸을 스위치 두 개로(도움말 글은 없음)
        note: function (sel) {
          syncRunUI(sel);
          return null;
        },
      },
    ],
    phases: PHASES,
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return sel.part;
    },
    runLabel: function (sel) {
      return "▶ 두 회로의 스위치 함께 닫기 (" + PART[sel.part].name + ")";
    },
    busyLabel: function (sel) {
      return "스위치를 닫았어요… 잘 지켜보세요 👀"; // 버저는 이 버튼이 숨고 스위치 버튼 두 개가 대신한다(syncRunUI)
    },
    // 실행하는 동안 버저 스위치 버튼도 잠근다(틀이 조건 버튼·실행 버튼을 잠그는 것과 같게)
    onBusy: function (on) {
      swButtons.forEach(function (b) {
        b.btn.disabled = on;
      });
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 부품이나 스위치를 눌러도 돼요",
      tip2D: "2D 화면(모형)이에요. 두 회로를 나란히 비교해요. 그림의 스위치를 눌러도 돼요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { part: sel.part, answer: observed };
    },
    describeRecord: function (r) {
      return cmp(r.part).short + " → " + r.answer;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.parts.map(function (p) {
        return { id: p.id, label: p.icon + " " + p.name };
      }),
      cols: [{ id: "both", label: "두 회로 비교" }],
      sel: function (r) {
        return { part: r.id };
      },
    },
    onChange: lesson.refresh,
  });
  syncRunUI({}); // 스위치 버튼 두 개를 실행 버튼 곁에 두고(숨김) 지금 고른 부품에 맞춘다

  /* 관찰·기록 카드: 두 회로 비교 질문 + 보기 두 개(전지 1개 연결 / 전지 2개 직렬연결) → 확인하기 → 기록하기.
     보기 바로 위에는 중립 안내만("두 회로의 ○○을 비교해 보세요."). 실제 모습 글은 맞는 보기로 '확인하기'를 누른 뒤에만 드러낸다
     (틀린 보기로 확인하면 계속 숨김 — review-A L8, sci-6-2-2-3 chipNode와 같은 방식). 장면의 대체 설명은 두 회로의 모습을 말한다(describe). */
  function observeCard(sel) {
    var p = PART[sel.part];
    var q = cmp(sel.part);
    var reveal = el("p", { class: "ob-reveal", hidden: true }, [el("span", { class: "ob-reveal-tag", text: "본 모습" }), el("span", { text: q.seen })]);
    var body = el("div", { class: "ob-body" }, [
      el("p", { class: "ob-where" }, [el("span", { class: "ob-chip", text: p.icon + " " + p.name }), el("span", { text: "두 회로에 같은 " + S.josa(p.name, "을", "를") + " 연결했어요." })]),
      el("p", { class: "ob-seen" }, [el("span", { class: "ob-icon", "aria-hidden": "true", text: "👀" }), el("span", { text: q.look })]),
      reveal,
    ]);
    var isBuzz = sel.part === "buzzer";
    // 버저: '소리 다시 듣기'는 없다(스위치를 닫아 두는 동안 계속 울림 — 2026-09-27 사용자). 소리 끄기/켜기만 곁에 둔다.
    if (isBuzz) body.appendChild(el("div", { class: "ss-row ob-sound" }, [soundButton("ss-btn ss-btn-ghost")]));
    return {
      question: q.question,
      body: body,
      type: "choice",
      choices: CHOICES,
      check: function (observed) {
        // 버저는 두 회로를 모두 한 번 이상 닫아 들어 본 뒤에 확인한다. 전구·전동기는 두 회로를 함께 닫은 뒤에(원래 실행 뒤에만 카드가 뜬다).
        if (isBuzz ? !(buzz.heard.single && buzz.heard.series2) : !lit[sel.part]) return isBuzz ? q.notBoth : C.compare.notYet;
        if (observed === C.compare.answer) {
          reveal.hidden = false;
          return true;
        }
        reveal.hidden = true; // 맞힌 뒤 틀린 보기로 다시 확인하면 다시 숨긴다(review-D2 L1)
        return q.wrong;
      },
      okMessage: C.compare.okMessage,
      // 버저는 '다시 실험해 보기'를 두지 않는다 — 스위치 버튼이 곧 다시 해 보는 버튼이다(sci-6-2-3-3 실험 1과 같게)
      retryLabel: isBuzz ? undefined : "🔁 다시 실험해 보기",
    };
  }
  // 3D·2D 장면의 스위치(손잡이)를 누르면: 버저는 그 회로만 여닫기(스위치 버튼과 같다), 전구·전동기는 실행 버튼과 같다
  // (공통 틀의 실행 버튼 훅 exp.runButton — 실행 중이면 무시)
  function tapSwitch(circuitId) {
    if (!exp || exp.isBusy()) return;
    if (selPart === "buzzer" && circuitId) {
      pressSwitch(circuitId);
      return;
    }
    var b = exp.runButton;
    if (b && !b.disabled) b.click();
    else toast("먼저 연결할 부품을 골라요.", 2600);
  }

  /* 실행 칸 맞추기(틀이 조건 칸을 다시 그릴 때마다 — factors[0].note): 버저를 고르면 공통 실행 버튼을 숨기고 그 자리에 스위치 버튼
     두 개를, 다른 부품이면 원래 실행 버튼을. 부품이 바뀌면 버저 스위치를 모두 열고 '들어 본 회로'를 비운다. */
  function syncRunUI(sel) {
    var part = sel && sel.part ? sel.part : null;
    if (part !== selPart) {
      var was = selPart;
      selPart = part;
      if (was === "buzzer" || part === "buzzer") openBuzz(true);
    }
    if (!exp) return; // 틀이 만들어지는 중(create 안의 첫 그리기)
    var isBuzz = selPart === "buzzer";
    swPair.hidden = !isBuzz;
    exp.runButton.classList.toggle("sw-hidden", isBuzz);
    placeSwitches();
  }
  // 스위치 버튼 두 개는 늘 공통 실행 버튼 바로 앞에 둔다 — 실행 버튼은 크게 보기를 켜고 끌 때 틀이 막대 ↔ 실행 카드로 옮긴다(ss:scenefull)
  function placeSwitches() {
    if (!exp) return;
    var run = exp.runButton;
    if (run.parentNode && (swPair.parentNode !== run.parentNode || swPair.nextSibling !== run)) run.parentNode.insertBefore(swPair, run);
    var bar = $("experiment-root").querySelector(".ss-exp-overlay");
    if (bar) bar.classList.toggle("has-sw", !swPair.hidden && swPair.parentNode === bar);
  }
  document.addEventListener("ss:scenefull", function () {
    setTimeout(placeSwitches, 0);
  });

  // 실험대를 되돌린 뒤(공통 틀이 화면 상태 "scene"을 비운 다음) 실행 버튼 글자·도움말을 다시 그린다
  function refreshSoon() {
    setTimeout(function () {
      if (exp && exp.refresh) exp.refresh();
    }, 0);
  }
  function noop() {}
  // 장면 대체 설명(화면 읽기 프로그램용 — 3D 캔버스 aria-label, 2D 숨은 설명). 장면을 "보는 것"과 같으므로 스위치를 닫은 뒤에는
  // 두 회로의 모습(어느 쪽이 더 밝은지 등)을 말한다. 관찰 카드의 글은 중립이다(observeCard).
  function sceneText(kind, partId) {
    var p = PART[partId] || PART[C.parts[0].id];
    var others = C.parts.filter(function (x) {
      return x.id !== p.id;
    });
    var t = kind + " 실험 장면(모형). 왼쪽은 " + C.circuits[0].name + ", 오른쪽은 " + C.circuits[1].name + "예요. 두 회로에 " + S.josa(p.name, "을", "를") + " 연결했어요. ";
    if (p.id === "buzzer") t += buzz.closed ? cmp("buzzer").altOne[buzz.closed] + " " : "두 회로의 스위치는 열려 있어요. 스위치를 하나씩 닫아 소리를 들어 볼 수 있어요. ";
    else t += lit[p.id] ? "두 회로의 스위치를 함께 닫았어요. " + cmp(p.id).alt + " " : "두 회로의 스위치는 열려 있어요. ";
    if (kind === "3D") t += "두 회로 앞 가운데의 부품 상자에 " + S.josa(others[0].name, "과", "와") + " " + S.josa(others[1].name, "이", "가") + " 있어요(눌러서 바꿔 끼울 수 있어요). 드래그하면 돌려 볼 수 있어요.";
    return t.trim();
  }

  /* ───────── 3D 장면 ─────────
   * 실험대 위에 회로판 2개(왼쪽: 전지 한 개, 오른쪽: 전지 두 개 직렬)를 나란히 놓고, 두 회로에 같은 부품(전구·전동기·버저)을
   * 하나씩 연결한 모습을 보여 준다. 부품을 바꾸면 두 회로의 부품이 함께 바뀐다(실제 실험과 같게). 두 회로 앞 가운데의
   * 부품 상자에는 지금 연결하지 않은 부품이 놓여 있고, 누르면 그 부품을 고른다. 스위치(손잡이)를 누르면 전구·전동기는 실행과 같고
   * (두 회로를 함께 닫기), 버저는 그 회로의 스위치 버튼과 같다(그 회로만 닫기/열기 — 후속 2).
   */
  var BOARD = { w: 4.9, d: 3.5, h: 0.24, x: 3.0 }; // 회로판 크기·간격
  var WIRE_Y = 0.36;
  var SPEED = { motor: { single: 7, series2: 18 } };
  // 버저 소리 파동(원형 고리, 모형 — 2026-09-27 사용자 결정 "고리의 크기, 개수, 간격은 모두 동일하게 하고, 선의 굵기를 조금 더 굵게 표현해줘"):
  // 두 회로 모두 고리 3개가 같은 크기(minR→maxR)·같은 간격(1/3)·같은 빠르기(speed, 초당 바퀴)·같은 진하기로 퍼지고,
  // 소리가 큰 쪽(전지 두 개 직렬)만 고리 선(토러스 굵기)이 더 굵다.
  var WAVE = { speed: 1.2, minR: 0.45, maxR: 1.4, peak: 0.6, tube: { 1: 0.035, 2: 0.08 } };
  var LEVER_OPEN = 0.6; // 열린 스위치 손잡이 각도(라디안)
  var TRAY = { z: 2.6, gap: 1.0, scale: 0.55, top: 0.1 }; // 부품 상자(두 회로판 앞 가운데 — 두 회로 이름표 사이)

  function build3D(container, ctx) {
    var live = { part: null }; // 지금 회로에 끼운 부품(setPart) — 누르기 가드용
    return S.Sim3D.create({
      container: container,
      // 화면 맞춤 범위: 앞 가운데 부품 상자(이름표 포함)까지 들어오게 가운데를 앞으로 0.7 옮겼다(2026-09-27 — 좁고 낮은 장면 칸에서
      // 상자가 아래 가장자리·드래그 안내 줄에 가리지 않게. 회로판 뒤쪽은 위 여백이 넉넉하다)
      frame: { width: 11.6, depth: 6.4, center: [0, 0.8, 0.7] },
      viewDir: [0, 0.58, 0.81],
      minDistance: 3.2,
      onPick: function (p) {
        if (!p) return;
        if (p.run) {
          tapSwitch(p.circuit); // 버저면 누른 회로만 여닫기, 전구·전동기면 실행과 같다
          return;
        }
        // 이미 끼운 부품을 다시 누르면 그대로 둔다(다시 고르면 공통 틀이 관찰 카드를 닫는다 — review-D2 M1, sci-6-2-3-1·-3과 같게)
        if (p.part && p.part !== live.part) ctx.onPick({ part: p.part });
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var disposed = false;
      var currentPart = null;

      var tableMesh = M.table(15, 11, 0xd9c7a3); // 앞쪽 부품 상자까지(화면 맞춤 가운데를 앞으로 옮긴 만큼 탁자도 앞으로 — 넓은 칸에서 탁자 앞 가장자리가 보이지 않게)
      tableMesh.position.z = 0.7;
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      // 화면 위에 겹쳐 보이는 안내 글(지금 하는 일)
      var ovText = el("span", { class: "ov-text", hidden: true });
      var overlay = el("div", { class: "ov3d", "aria-hidden": "true" }, [ovText]);
      container.appendChild(overlay);
      function say(text) {
        ovText.textContent = text || "";
        ovText.hidden = !text;
      }
      var canvasEl = v.renderer && v.renderer.domElement;
      function describe() {
        if (canvasEl) canvasEl.setAttribute("aria-label", sceneText("3D", currentPart));
      }

      // 누르기(탭) 대상: 보이지 않는 상자(누르는 곳)를 물체에 붙인다. three.js 레이는 숨긴 물체도 맞히므로
      // 조상 중 하나라도 숨어 있으면(연결하지 않은 부품 등) 맞지 않게 한다(sci-6-2-2-3과 같은 방식).
      var hitMat = new T.MeshBasicMaterial({ visible: false });
      function hitBox(parent, w, h, d, x, y, z, value) {
        var m = new T.Mesh(new T.BoxGeometry(w, h, d), hitMat);
        m.position.set(x || 0, y, z || 0);
        var orig = m.raycast;
        m.raycast = function (rc, hits) {
          for (var n = m; n; n = n.parent) if (!n.visible) return;
          return orig.call(this, rc, hits);
        };
        parent.add(m);
        v.pickable(m, value);
        return m;
      }

      /* ── 작은 부품 만들기 ── */
      var matWireRed = M.material(0xd23b3b, { roughness: 0.5 });
      var matWireBlack = M.material(0x2b2f36, { roughness: 0.5 });
      var matMetal = M.material(0xb9c2cc, { roughness: 0.35, metalness: 0.3 });
      var matDark = M.material(0x39414d, { roughness: 0.6 });

      function wire(g, x1, z1, x2, z2, mat) {
        var len = Math.hypot(x2 - x1, z2 - z1);
        var m = new T.Mesh(new T.BoxGeometry(len, 0.07, 0.07), mat);
        m.position.set((x1 + x2) / 2, WIRE_Y, (z1 + z2) / 2);
        m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        g.add(m);
        return m;
      }

      // 전지 끼우개 + 전지 1개 (+극이 오른쪽). 반환: 그룹
      function batteryHolder(cx) {
        var g = new T.Group();
        g.position.set(cx, 0, 1.05);
        var base = new T.Mesh(new T.BoxGeometry(1.9, 0.26, 0.85), M.material(0x8d949e, { roughness: 0.7 }));
        base.position.y = 0.13 + BOARD.h;
        g.add(base);
        var body = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 1.45, 20), M.material(0xe4d9b6, { roughness: 0.55 }));
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.42 + BOARD.h;
        g.add(body);
        var band = new T.Mesh(new T.CylinderGeometry(0.265, 0.265, 0.34, 20), M.material(0x3a4a63, { roughness: 0.5 }));
        band.rotation.z = Math.PI / 2;
        band.position.set(-0.25, 0.42 + BOARD.h, 0);
        g.add(band);
        var plus = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.16, 16), matMetal);
        plus.rotation.z = Math.PI / 2;
        plus.position.set(0.79, 0.42 + BOARD.h, 0);
        g.add(plus);
        var minus = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.06, 20), matMetal);
        minus.rotation.z = Math.PI / 2;
        minus.position.set(-0.75, 0.42 + BOARD.h, 0);
        g.add(minus);
        var lp = M.label("＋", { height: 0.36, bold: true, color: "#c23a3a" });
        lp.position.set(0.86, 0.95 + BOARD.h, 0);
        g.add(lp);
        var lm = M.label("－", { height: 0.36, bold: true, color: "#1f2937" });
        lm.position.set(-0.86, 0.95 + BOARD.h, 0);
        g.add(lm);
        return g;
      }

      /* ── 부품(전구·전동기·버저) ──  (2026-09-27: 부품 위 세기 표시 "밝기/빠르기/소리 크기 ▮▯▯"는 없앴다 — 사용자 결정) */
      function bulbPart() {
        var g = new T.Group();
        var socket = new T.Mesh(new T.CylinderGeometry(0.3, 0.32, 0.4, 20), M.material(0x9aa3ae, { roughness: 0.5 }));
        socket.position.y = BOARD.h + 0.2;
        g.add(socket);
        var glassMat = M.material(0xfff6d8, { transparent: true, opacity: 0.35, roughness: 0.1, emissive: 0xffc861, emissiveIntensity: 0 });
        var glass = new T.Mesh(new T.SphereGeometry(0.38, 24, 18), glassMat);
        glass.position.y = BOARD.h + 0.78;
        g.add(glass);
        var fil = new T.Mesh(new T.TorusGeometry(0.11, 0.025, 8, 16), M.material(0xffcf7a, { emissive: 0xffb347, emissiveIntensity: 0.2, roughness: 0.4 }));
        fil.position.y = BOARD.h + 0.74;
        fil.rotation.x = Math.PI / 2.4;
        g.add(fil);
        var haloMat = M.material(0xffe6a8, { transparent: true, opacity: 0, roughness: 1, emissive: 0xffd777, emissiveIntensity: 0.8, depthWrite: false });
        var halo = new T.Mesh(new T.SphereGeometry(0.62, 18, 14), haloMat);
        halo.position.y = BOARD.h + 0.78;
        halo.renderOrder = 5;
        g.add(halo);
        return {
          group: g,
          set: function (level) {
            // level: 0(꺼짐) · 1(전지 한 개) · 2(전지 두 개 직렬)
            var e = level === 0 ? 0 : level === 1 ? 0.5 : 1.6;
            glassMat.emissiveIntensity = e;
            glassMat.opacity = level === 0 ? 0.35 : 0.6 + 0.25 * (level - 1);
            fil.material.emissiveIntensity = level === 0 ? 0.2 : level === 1 ? 1.2 : 2.6;
            haloMat.opacity = level === 0 ? 0 : level === 1 ? 0.16 : 0.38;
            var s = level === 2 ? 1.5 : 1;
            halo.scale.set(s, s, s);
          },
          tickable: false,
        };
      }

      function motorPart() {
        var g = new T.Group();
        var base = new T.Mesh(new T.CylinderGeometry(0.36, 0.4, 0.18, 20), M.material(0x9aa3ae, { roughness: 0.5 }));
        base.position.y = BOARD.h + 0.09;
        g.add(base);
        var body = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.64, 20), matDark);
        body.position.y = BOARD.h + 0.5;
        g.add(body);
        var shaft = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.3, 10), matMetal);
        shaft.position.y = BOARD.h + 0.95;
        g.add(shaft);
        var prop = new T.Group();
        prop.position.y = BOARD.h + 1.08;
        var hub = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.08, 12), M.material(0xf2a93b, { roughness: 0.5 }));
        prop.add(hub);
        for (var i = 0; i < 3; i++) {
          var blade = new T.Mesh(new T.BoxGeometry(0.62, 0.035, 0.14), M.material(0x3f8ad8, { roughness: 0.4 }));
          blade.position.set(0.33, 0, 0);
          blade.rotation.z = 0.25;
          var arm = new T.Group();
          arm.rotation.y = (i * Math.PI * 2) / 3;
          arm.add(blade);
          prop.add(arm);
        }
        g.add(prop);
        var blurMat = M.material(0x7fb0e8, { transparent: true, opacity: 0, roughness: 0.8, depthWrite: false });
        var blur = new T.Mesh(new T.TorusGeometry(0.42, 0.035, 8, 32), blurMat);
        blur.rotation.x = Math.PI / 2;
        blur.position.y = BOARD.h + 1.08;
        g.add(blur);
        // 움직임 줄이기에서 날개가 멈출 때만 보이는 회전 흐림 원판(두 회로의 빠르기 차이를 멈춘 그림으로도 — 2D의 흐림 원과 같은 뜻)
        var discMat = M.material(0x7fb0e8, { transparent: true, opacity: 0, roughness: 0.8, depthWrite: false, side: T.DoubleSide });
        var disc = new T.Mesh(new T.CircleGeometry(0.44, 32), discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = BOARD.h + 1.07;
        disc.visible = false;
        g.add(disc);
        var level = 0;
        return {
          group: g,
          set: function (lv) {
            level = lv;
            blurMat.opacity = lv === 0 ? 0 : lv === 1 ? 0.18 : 0.5;
            var still = !!lv && reduceMotion();
            if (still) prop.rotation.y = lv === 1 ? 0.2 : 0.7;
            disc.visible = still;
            discMat.opacity = lv === 2 ? 0.55 : 0.2;
          },
          tickable: true,
          tick: function (dt) {
            if (!level) return;
            prop.rotation.y += (level === 1 ? SPEED.motor.single : SPEED.motor.series2) * dt;
          },
        };
      }

      function buzzerPart() {
        var g = new T.Group();
        var body = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.3, 24), matDark);
        body.position.y = BOARD.h + 0.15;
        g.add(body);
        var hole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.04, 12), M.material(0x11151c, { roughness: 0.9 }));
        hole.position.y = BOARD.h + 0.31;
        g.add(hole);
        // 빨간색 전선은 (＋)극 쪽, 검은색 전선은 (－)극 쪽
        var lead1 = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.05), matWireRed);
        lead1.position.set(0.55, BOARD.h + 0.2, 0.1);
        g.add(lead1);
        var lead2 = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.05), matWireBlack);
        lead2.position.set(-0.55, BOARD.h + 0.2, -0.1);
        g.add(lead2);
        // 소리 파동(원형 고리, 모형): 두 회로 모두 고리 3개·같은 크기·같은 간격·같은 빠르기(WAVE), 소리가 큰 쪽만 고리 선이 더 굵다.
        // 굵기별로 고리 한 벌씩(가는 선 = 전지 한 개, 굵은 선 = 전지 두 개 직렬) 만들어 두고 지금 세기의 한 벌만 보인다.
        var ringSets = {};
        [1, 2].forEach(function (lv) {
          var geo = new T.TorusGeometry(1, WAVE.tube[lv], 8, 48);
          ringSets[lv] = [0, 1, 2].map(function (i) {
            var m = new T.Mesh(geo, M.material(0x6ea0ff, { transparent: true, opacity: 0, roughness: 0.9, emissive: 0x3f7fe0, emissiveIntensity: 0.5, depthWrite: false }));
            m.rotation.x = Math.PI / 2;
            m.position.y = BOARD.h + 0.34;
            m.visible = false;
            g.add(m);
            return { mesh: m, phase: i / 3 };
          });
        });
        var level = 0;
        var t = 0;
        function placeRings(k0) {
          (ringSets[level] || []).forEach(function (r) {
            var k = (k0 + r.phase) % 1;
            var rad = WAVE.minR + (WAVE.maxR - WAVE.minR) * k;
            r.mesh.scale.set(rad, rad, 1);
            r.mesh.material.opacity = WAVE.peak * (1 - k);
          });
        }
        return {
          group: g,
          set: function (lv) {
            level = lv;
            [1, 2].forEach(function (k) {
              ringSets[k].forEach(function (r) {
                r.mesh.visible = lv === k;
                if (lv !== k) r.mesh.material.opacity = 0;
              });
            });
            // 바로 한 장면을 그려 둔다(움직임 줄이기에서는 이 장면에 멈춰 있어도 굵기로 구분된다)
            if (lv) placeRings(reduceMotion() ? 0.25 : t);
          },
          tickable: true,
          tick: function (dt) {
            if (!level) return;
            t += dt * WAVE.speed;
            placeRings(t);
          },
        };
      }
      var MAKE = { bulb: bulbPart, motor: motorPart, buzzer: buzzerPart };

      /* ── 회로 한 벌 만들기 ── */
      function buildCircuit(cfg) {
        var g = new T.Group();
        g.position.set(cfg.index === 0 ? -BOARD.x : BOARD.x, 0, 0);
        v.root.add(g);

        var board = new T.Mesh(new T.BoxGeometry(BOARD.w, BOARD.h, BOARD.d), M.material(0xe8e2d2, { roughness: 0.85 }));
        board.position.y = BOARD.h / 2;
        g.add(board);

        // 전지 끼우개(1개 또는 2개 직렬)
        var batt = new T.Group();
        g.add(batt);
        if (cfg.batteries === 1) {
          batt.add(batteryHolder(0));
        } else {
          batt.add(batteryHolder(-1.02));
          batt.add(batteryHolder(1.02));
          // (＋)극 ↔ (－)극을 잇는 짧은 전선(직렬연결)
          var link = new T.Mesh(new T.BoxGeometry(0.42, 0.08, 0.08), matWireRed);
          link.position.set(0, 0.42 + BOARD.h, 1.05);
          batt.add(link);
          var linkLabel = M.label("직렬연결", { height: 0.3, bold: true, color: "#1f56b0" });
          linkLabel.position.set(0, 1.35 + BOARD.h, 1.05);
          batt.add(linkLabel);
        }
        var battLeft = cfg.batteries === 1 ? -0.79 : -1.81; // (－)극 끝
        var battRight = cfg.batteries === 1 ? 0.83 : 1.85; // (＋)극 끝

        // 스위치(왼쪽 뒤) — 누르면 전구·전동기는 실행(두 회로의 스위치를 함께 닫기), 버저는 이 회로의 스위치만 닫기/열기(tapSwitch)
        var swX = -1.45;
        var swZ = -1.05;
        var swBase = new T.Mesh(new T.BoxGeometry(1.0, 0.12, 0.5), M.material(0xf2efe6, { roughness: 0.8 }));
        swBase.position.set(swX, BOARD.h + 0.06, swZ);
        g.add(swBase);
        var postL = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.2, 12), matMetal);
        postL.position.set(swX - 0.38, BOARD.h + 0.2, swZ);
        g.add(postL);
        var postR = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.2, 12), matMetal);
        postR.position.set(swX + 0.38, BOARD.h + 0.2, swZ);
        g.add(postR);
        var lever = new T.Group();
        lever.position.set(swX - 0.38, BOARD.h + 0.3, swZ);
        var leverBar = new T.Mesh(new T.BoxGeometry(0.8, 0.07, 0.14), M.material(0xc9723a, { roughness: 0.5 }));
        leverBar.position.x = 0.38;
        lever.add(leverBar);
        g.add(lever);
        var swLabel = M.label("스위치", { height: 0.28 });
        swLabel.position.set(swX, BOARD.h + 0.75, swZ - 0.45);
        g.add(swLabel);
        hitBox(g, 1.3, 0.9, 0.9, swX, BOARD.h + 0.35, swZ, { run: true, circuit: cfg.id });

        // 부품 자리(오른쪽 뒤) — 부품 3가지를 모두 만들어 두고 고른 것만 보인다. 보이는 부품을 누르면 그 부품을 고른다.
        var partX = 1.35;
        var partZ = -1.0;
        var parts = {};
        var holder = new T.Group();
        holder.position.set(partX, 0, partZ);
        g.add(holder);
        C.parts.forEach(function (p) {
          parts[p.id] = MAKE[p.id]();
          parts[p.id].group.visible = false;
          holder.add(parts[p.id].group);
          hitBox(parts[p.id].group, 1.1, 1.5, 1.1, 0, BOARD.h + 0.7, 0, { part: p.id });
        });

        // 전선 고리: 전지(＋) → 부품 → 스위치 → 전지(－)
        wire(g, battRight, 1.05, 2.25, 1.05, matWireRed);
        wire(g, 2.25, 1.05, 2.25, partZ, matWireRed);
        wire(g, 2.25, partZ, partX + 0.45, partZ, matWireRed);
        wire(g, partX - 0.45, partZ, swX + 0.38, swZ, matWireBlack);
        wire(g, swX - 0.38, swZ, -2.25, swZ, matWireBlack);
        wire(g, -2.25, swZ, -2.25, 1.05, matWireBlack);
        wire(g, -2.25, 1.05, battLeft, 1.05, matWireBlack);

        // 회로 이름표
        var nameLabel = M.label(cfg.name.replace("연결한 전기 회로", "연결한\n전기 회로"), { height: 0.72, bold: true });
        nameLabel.position.set(0, 0.55, 2.2);
        g.add(nameLabel);

        return { id: cfg.id, x: g.position.x, group: g, lever: lever, parts: parts, on: false };
      }

      var circuits = {};
      C.circuits.forEach(function (c, i) {
        circuits[c.id] = buildCircuit({ id: c.id, index: i, batteries: c.batteries, name: c.name });
      });
      function eachCircuit(fn) {
        Object.keys(circuits).forEach(function (id) {
          fn(circuits[id]);
        });
      }

      /* ── 부품 상자(두 회로판 앞 가운데, 두 회로 이름표 사이): 지금 연결하지 않은 부품이 놓여 있다(연결한 부품 자리는 빈칸).
         누르면 그 부품을 고른다(부품 버튼과 같다). 이름표는 안 바뀌는 부품 이름만 ── */
      var tray = new T.Group();
      tray.position.set(0, 0, TRAY.z);
      v.root.add(tray);
      var trayBase = new T.Mesh(new T.BoxGeometry(TRAY.gap * 3 + 0.2, TRAY.top, 1.0), M.material(0xc9d2dc, { roughness: 0.8 }));
      trayBase.position.y = TRAY.top / 2;
      tray.add(trayBase);
      var traySlots = {};
      C.parts.forEach(function (p, i) {
        var slot = new T.Group();
        slot.position.set((i - 1) * TRAY.gap, 0, 0);
        tray.add(slot);
        var model = MAKE[p.id]();
        model.set(0);
        model.group.scale.setScalar(TRAY.scale);
        model.group.position.y = TRAY.top - BOARD.h * TRAY.scale; // 부품 바닥이 상자 윗면에 닿게
        slot.add(model.group);
        hitBox(model.group, 1.2, 1.6, 1.2, 0, BOARD.h + 0.7, 0, { part: p.id });
        var lab = M.label(p.name, { height: 0.3, bold: true });
        lab.position.set(0, TRAY.top + 0.02, 0.62);
        slot.add(lab);
        traySlots[p.id] = model;
      });

      /* ── 상태 ── */
      function levelOf(circuitId) {
        return circuitId === "series2" ? 2 : 1;
      }
      function setLever(c, closed) {
        c.lever.rotation.z = closed ? 0 : LEVER_OPEN;
      }
      // 이 회로가 켜져 있나: 버저는 그 회로의 스위치만(buzz.closed), 전구·전동기는 두 회로를 함께 닫았을 때(lit)
      function isOnNow(c, part) {
        return part === "buzzer" ? buzz.closed === c.id : !!(part && lit[part]);
      }
      function applyState(c) {
        var part = currentPart;
        Object.keys(c.parts).forEach(function (k) {
          c.parts[k].group.visible = k === part;
        });
        var isOn = isOnNow(c, part);
        c.on = isOn;
        setLever(c, isOn);
        if (part) c.parts[part].set(isOn ? levelOf(c.id) : 0);
        Object.keys(c.parts).forEach(function (k) {
          if (k !== part) c.parts[k].set(0);
        });
      }
      function applyAll() {
        eachCircuit(applyState);
        Object.keys(traySlots).forEach(function (id) {
          traySlots[id].group.visible = id !== currentPart; // 연결한 부품은 상자에서 빠져 있다
        });
      }
      function setPart(partId) {
        if (!partId || partId === currentPart) return;
        currentPart = partId; // 버저 스위치·소리는 부품이 바뀔 때 앱이 연다(syncRunUI → openBuzz)
        live.part = partId;
        applyAll();
        describe();
        startLoop();
      }

      /* ── 움직이는 부품(전동기 날개·소리 파동) 전용 루프 ── */
      var loopId = 0;
      var lastT = 0;
      function needsTick() {
        var any = false;
        eachCircuit(function (c) {
          if (c.on && currentPart && c.parts[currentPart].tickable) any = true;
        });
        return any;
      }
      function startLoop() {
        if (loopId || disposed || reduceMotion() || !needsTick()) return;
        lastT = performance.now();
        loopId = requestAnimationFrame(tick);
      }
      function tick(now) {
        loopId = 0;
        if (disposed) return;
        var dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        eachCircuit(function (c) {
          if (c.on && currentPart && c.parts[currentPart].tick) c.parts[currentPart].tick(dt);
        });
        if (needsTick()) loopId = requestAnimationFrame(tick);
      }

      var runToken = 0;
      function wait(ms) {
        return v.tween(ms, noop);
      }
      setPart(C.parts[0].id); // 부품을 고르기 전에도 회로가 비어 보이지 않게 첫 부품(전구)을 끼워 둔다
      v.render();

      var api = {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          activeView = api; // 공통 틀이 실제로 쓰는 화면만 highlight를 받는다(늦게 끝나 버려진 3D 생성은 받지 않음)
          if (s.part) setPart(s.part);
          applyAll(); // 버저 스위치 상태(3D↔2D를 바꿔도 이어짐)
          describe();
          startLoop();
          syncTone();
          v.render();
        },
        run: async function (sel) {
          var my = ++runToken;
          setPart(sel.part);
          var part = sel.part;
          if (part === "buzzer") {
            // 버저(2026-09-27 사용자): 누른 회로의 스위치만 여닫는다. 닫으면 다른 회로는 저절로 열리고, 닫힌 동안 소리가 계속 난다.
            var cid = buzz.pending;
            buzz.pending = null;
            if (!cid) {
              applyAll();
              return;
            }
            var closing = buzz.closed !== cid;
            var from = {};
            eachCircuit(function (c) {
              from[c.id] = c.lever.rotation.z;
              c.on = false; // 움직이는 동안 두 버저 모두 조용히(고리도 끔) — 닫는 쪽은 손잡이가 닿은 뒤에 켠다
              c.parts.buzzer.set(0);
            });
            stopBuzzer();
            buzz.closed = null;
            await v.tween(230, function (t) {
              eachCircuit(function (c) {
                var to = closing && c.id === cid ? 0 : LEVER_OPEN;
                c.lever.rotation.z = from[c.id] + (to - from[c.id]) * t;
              });
            });
            if (my !== runToken) return;
            buzz.closed = closing ? cid : null;
            if (closing) buzz.heard[cid] = true;
            applyAll();
            startLoop();
            describe();
            updateSwitchButtons();
            syncTone();
            v.render();
            return;
          }
          // 처음 상태로: 두 회로의 스위치를 열고 부품 끄기
          lit[part] = false;
          applyAll();
          describe();
          // 카메라는 움직이지 않는다: 두 회로가 언제나 함께 보여야 비교할 수 있다.
          say("① 두 회로의 스위치를 함께 닫아요");
          await wait(250);
          if (my !== runToken) return;
          await v.tween(360, function (t) {
            eachCircuit(function (c) {
              c.lever.rotation.z = LEVER_OPEN * (1 - t);
            });
          });
          if (my !== runToken) return;
          lit[part] = true;
          applyAll();
          startLoop();
          describe();
          say("② 두 회로를 비교해 보세요");
          await wait(1350);
          if (my !== runToken) return;
          say("");
          v.render();
        },
        showInstant: function (sel) {
          if (sel.part !== "buzzer") lit[sel.part] = true; // 버저는 스위치 상태(buzz.closed)를 저장하지 않는다 — 다시 열면 열림
          if (sel.part === currentPart) applyAll();
          startLoop();
          describe();
          v.render();
        },
        clear: function () {
          runToken++;
          say("");
          lit = {};
          openBuzz(true); // 버저 스위치도 모두 열고 '들어 본 회로'를 비운다
          applyAll();
          describe();
          v.flyHome(400);
          refreshSoon();
          v.render();
        },
        // 버저 스위치 상태를 다시 그린다(앱이 스위치를 열 때 — openBuzz)
        refreshBuzz: function () {
          applyAll();
          describe();
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          runToken++;
          disposed = true;
          stopBuzzer(); // 스위치 상태는 그대로 두고 소리만 — 3D↔2D를 바꾸면 새 화면이 이어서 낸다(highlight → syncTone)
          if (activeView === api) activeView = null;
          if (loopId) cancelAnimationFrame(loopId);
          loopId = 0;
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          v.dispose();
        },
      };
      describe();
      return api;
    });
  }

  /* ───────── 2D 대체 화면(SVG, 모형) ───────── */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, String(attrs[k]));
    });
    (kids || []).forEach(function (c) {
      if (c) n.appendChild(c);
    });
    return n;
  }
  function svgText(x, y, t, cls) {
    var n = svg("text", { x: x, y: y, "text-anchor": "middle", class: cls || "d2-t" });
    n.textContent = t;
    return n;
  }

  function build2D(root, ctx) {
    var token = 0;
    var panels = {};
    var currentPart = null;
    var row = el("div", { class: "d2-row" });
    var caption = el("p", { class: "d2-caption", "aria-live": "polite" });
    var desc = el("p", { class: "ss-sr-only" }); // 그림 설명(화면 읽기 프로그램용)
    var IDLE = "부품을 고른 뒤 두 회로의 스위치를 함께 닫아 보세요.";

    C.circuits.forEach(function (cfg) {
      // 전지 1개 또는 2개(직렬)
      var batt = svg("g", null, []);
      if (cfg.batteries === 1) {
        batt.appendChild(svg("rect", { x: 55, y: 150, width: 90, height: 30, rx: 6, class: "d2-batt" }));
        batt.appendChild(svgText(66, 172, "－", "d2-pole"));
        batt.appendChild(svgText(135, 172, "＋", "d2-pole"));
      } else {
        batt.appendChild(svg("rect", { x: 20, y: 150, width: 75, height: 30, rx: 6, class: "d2-batt" }));
        batt.appendChild(svgText(30, 172, "－", "d2-pole"));
        batt.appendChild(svgText(85, 172, "＋", "d2-pole"));
        batt.appendChild(svg("rect", { x: 105, y: 150, width: 75, height: 30, rx: 6, class: "d2-batt" }));
        batt.appendChild(svgText(115, 172, "－", "d2-pole"));
        batt.appendChild(svgText(170, 172, "＋", "d2-pole"));
        batt.appendChild(svg("line", { x1: 95, y1: 165, x2: 105, y2: 165, class: "d2-wire d2-red" }));
        batt.appendChild(svgText(100, 196, "직렬연결", "d2-note"));
      }
      // 전선 고리
      var wires = svg("g", null, [
        svg("path", { d: (cfg.batteries === 1 ? "M145,165 L185,165" : "M180,165 L185,165") + " L185,60 L140,60", class: "d2-wire d2-red" }),
        svg("path", { d: "M60,60 L15,60 L15,165 " + (cfg.batteries === 1 ? "L55,165" : "L20,165"), class: "d2-wire d2-black" }),
      ]);
      // 스위치(왼쪽 위) — 누르면 3D 손잡이와 같다(버저면 이 회로만 여닫기, 전구·전동기면 실행). 누르는 곳은 손잡이·글자를 덮는 투명한 칸
      var lever = svg("line", { x1: 60, y1: 60, x2: 92, y2: 44, class: "d2-lever" });
      var swHit = svg("rect", { x: 46, y: 28, width: 60, height: 66, rx: 8, class: "d2-sw-hit" });
      var sw = svg("g", { class: "d2-sw" }, [
        swHit,
        svg("circle", { cx: 60, cy: 60, r: 4, class: "d2-post" }),
        svg("circle", { cx: 92, cy: 60, r: 4, class: "d2-post" }),
        lever,
        svgText(76, 86, "스위치", "d2-note"),
      ]);
      sw.addEventListener("click", function () {
        tapSwitch(cfg.id);
      });
      // 부품 자리(오른쪽 위)
      var bulbGlow = svg("circle", { cx: 122, cy: 60, r: 26, class: "d2-glow" });
      var bulb = svg("g", null, [
        bulbGlow,
        svg("circle", { cx: 122, cy: 60, r: 16, class: "d2-bulb" }),
        svg("path", { d: "M114,60 L119,52 L125,68 L130,60", class: "d2-fil" }),
      ]);
      var prop = svg("g", { class: "d2-prop" }, [
        svg("rect", { x: -18, y: -3, width: 36, height: 6, rx: 3, class: "d2-blade" }),
        svg("rect", { x: -3, y: -18, width: 6, height: 36, rx: 3, class: "d2-blade" }),
        svg("circle", { cx: 0, cy: 0, r: 4, class: "d2-hub" }),
      ]);
      // 날개가 도는 흐릿한 원(3D의 회전 흐림과 같은 뜻) — 움직임 줄이기에서 날개가 멈출 때만 보인다(두 회로의 빠르기 차이를 멈춘 그림으로도, style.css)
      var blur = svg("circle", { cx: 0, cy: 0, r: 19, class: "d2-blur" });
      var propWrap = svg("g", { transform: "translate(122,60)" }, [blur, prop]);
      var motor = svg("g", null, [svg("rect", { x: 106, y: 66, width: 32, height: 22, rx: 4, class: "d2-motor" }), propWrap]);
      var waves = svg("g", { class: "d2-waves" }, [
        svg("circle", { cx: 122, cy: 60, r: 20, class: "d2-wave" }),
        svg("circle", { cx: 122, cy: 60, r: 28, class: "d2-wave" }),
        svg("circle", { cx: 122, cy: 60, r: 36, class: "d2-wave" }),
      ]);
      var buzzer = svg("g", null, [waves, svg("circle", { cx: 122, cy: 60, r: 14, class: "d2-buzzer" }), svg("circle", { cx: 122, cy: 60, r: 4, class: "d2-hole" })]);
      var partG = { bulb: bulb, motor: motor, buzzer: buzzer };
      Object.keys(partG).forEach(function (k) {
        partG[k].setAttribute("class", "d2-part");
        partG[k].style.display = "none";
      });
      // (2026-09-27) 그림 아래 세기 표시(칸 막대·"밝기: 약하게" 글자)는 없앴다 — 사용자 결정. 그림 높이도 그만큼 줄였다(252 → 206).
      var pic = svg("svg", { viewBox: "0 0 200 206", class: "d2-svg", "aria-hidden": "true" }, [wires, batt, sw, bulb, motor, buzzer]);
      var box = el("div", { class: "d2-panel" }, [el("span", { class: "d2-name", text: cfg.name }), pic]);
      row.appendChild(box);
      panels[cfg.id] = { id: cfg.id, box: box, lever: lever, partG: partG, prop: prop, blur: blur, waves: waves, glow: bulbGlow, on: false };
    });

    root.appendChild(el("div", { class: "d2-wrap" }, [row, caption, desc]));
    caption.textContent = IDLE;

    function levelOf(id) {
      return id === "series2" ? 2 : 1;
    }
    function apply(p) {
      var part = currentPart;
      Object.keys(p.partG).forEach(function (k) {
        p.partG[k].style.display = k === part ? "" : "none";
      });
      var on = part === "buzzer" ? buzz.closed === p.id : !!(part && lit[part]); // 버저는 그 회로의 스위치만(buzz.closed)
      p.on = on;
      p.lever.setAttribute("x2", on ? "92" : "88");
      p.lever.setAttribute("y2", on ? "60" : "40");
      p.lever.classList.toggle("is-closed", on);
      var lv = on ? levelOf(p.id) : 0;
      p.glow.setAttribute("class", "d2-glow" + (lv ? " lv" + lv : ""));
      p.prop.setAttribute("class", "d2-prop" + (lv ? " spin" + lv : ""));
      p.blur.setAttribute("class", "d2-blur" + (lv ? " lv" + lv : ""));
      p.waves.setAttribute("class", "d2-waves" + (lv ? " lv" + lv : ""));
    }
    function applyAll() {
      Object.keys(panels).forEach(function (id) {
        apply(panels[id]);
      });
      desc.textContent = sceneText("2D", currentPart);
    }
    // 아래 글: 버저는 지금 닫힌 회로(소리 나는 회로)를, 전구·전동기는 스위치를 닫았는지에 따라
    function captionNow() {
      if (currentPart === "buzzer") return buzz.closed ? "🔊 " + CIR[buzz.closed].choice + " 회로의 스위치를 닫았어요." : cmp("buzzer").look;
      return currentPart && lit[currentPart] ? cmp(currentPart).look : IDLE;
    }
    function setPart(partId) {
      if (!partId || partId === currentPart) return;
      currentPart = partId; // 버저 스위치·소리는 부품이 바뀔 때 앱이 연다(syncRunUI → openBuzz)
      applyAll();
      caption.textContent = captionNow();
    }
    setPart(C.parts[0].id); // 부품을 고르기 전에도 회로가 비어 보이지 않게 첫 부품(전구)을 끼워 둔다

    var api = {
      highlight: function (s) {
        activeView = api;
        if (s.part) setPart(s.part);
        applyAll(); // 버저 스위치 상태(3D↔2D를 바꿔도 이어짐)
        caption.textContent = captionNow();
        syncTone();
      },
      run: async function (sel) {
        var my = ++token;
        setPart(sel.part);
        if (sel.part === "buzzer") {
          // 버저: 누른 회로의 스위치만 여닫는다(닫으면 다른 회로는 저절로 열림, 닫힌 동안 소리가 계속 남)
          var cid = buzz.pending;
          buzz.pending = null;
          if (cid) {
            var closing = buzz.closed !== cid;
            stopBuzzer();
            buzz.closed = null;
            applyAll();
            await sleep(200);
            if (my !== token) return;
            buzz.closed = closing ? cid : null;
            if (closing) buzz.heard[cid] = true;
          }
          applyAll();
          caption.textContent = captionNow();
          updateSwitchButtons();
          syncTone();
          return;
        }
        lit[sel.part] = false;
        applyAll();
        caption.textContent = "① 두 회로의 스위치를 함께 닫아요…";
        await sleep(420);
        if (my !== token) return;
        lit[sel.part] = true;
        applyAll();
        caption.textContent = "② 두 회로를 비교해 보세요…";
        await sleep(1100);
        if (my !== token) return;
        caption.textContent = cmp(sel.part).look;
      },
      showInstant: function (sel) {
        if (sel.part !== "buzzer") lit[sel.part] = true; // 버저는 스위치 상태(buzz.closed)를 저장하지 않는다
        if (!currentPart) currentPart = sel.part;
        applyAll();
        if (sel.part === currentPart) caption.textContent = captionNow();
      },
      clear: function () {
        token++;
        lit = {};
        openBuzz(true);
        applyAll();
        caption.textContent = IDLE;
        refreshSoon();
      },
      // 버저 스위치 상태를 다시 그린다(앱이 스위치를 열 때 — openBuzz)
      refreshBuzz: function () {
        applyAll();
        caption.textContent = captionNow();
      },
      resetView: function () {},
      dispose: function () {
        token++;
        stopBuzzer(); // 스위치 상태는 그대로 — 3D로 바꾸면 새 화면이 이어서 낸다
        if (activeView === api) activeView = null;
      },
    };
    return api;
  }

  /* ───────── 3. 기록·분석하기: 관찰 결과 표(부품마다 비교한 것 · 내가 고른 회로) ───────── */
  var nav = null;
  function drawResultTable() {
    S.TableChart.renderMatrix($("result-table"), {
      caption: "두 전기 회로를 비교한 결과 (내 기록)",
      rowHeader: "부품",
      rows: C.parts.map(function (p) {
        return { id: p.id, label: p.icon + " " + p.name };
      }),
      cols: [
        { id: "compare", label: "비교한 것" },
        { id: "answer", label: "내가 고른 회로" },
      ],
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        if (c.id === "compare") return { text: cmp(r.id).short };
        var rec = records.get(r.id);
        if (!rec) return null;
        var wrong = rec.answer !== C.compare.answer;
        return {
          text: rec.answer,
          icon: choiceIcon(rec.answer),
          flag: wrong ? "다시 관찰해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ part: r.id });
          },
        };
      },
    });
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  // 부품 순서(전구·전동기·버저)대로 — 다시 기록해도 순서가 바뀌지 않게
  function recordList() {
    return C.parts
      .map(function (p) {
        return records.get(p.id);
      })
      .filter(Boolean);
  }
  function recordRows() {
    return C.parts.map(function (p) {
      var r = records.get(p.id);
      return { part: p.name, compare: cmp(p.id).short, answer: r ? r.answer : "" };
    });
  }
  function buildDetail() {
    var q = quiz.result();
    var analysis = {};
    C.quiz.forEach(function (qq) {
      var res = q[qq.id] || { choice: [], correct: false, tries: 0 };
      analysis[qq.id] = {
        choice: res.choice.map(function (id) {
          var o = qq.options.filter(function (x) {
            return x.id === id;
          })[0];
          return o ? o.label : id;
        }),
        correct: res.correct,
        tries: res.tries,
      };
    });
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened(),
      // 2026-09-27(v2): 부품마다 두 회로를 비교한 기록 3칸 — 예전 판(v1)은 { part, circuit, result } 6칸
      records: recordList().map(function (r) {
        return { part: PART[r.part].name, question: cmp(r.part).question, answer: r.answer, recordedAt: r.recordedAt };
      }),
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosity.value(),
      // 질문-답 표준 목록(관리자 "학생 응답" 화면용, docs/admin/responses-spec.md §3.3). '더 탐구하고 싶은 점'은 정리하기 안(stage conclude)
      qa: [].concat(
        predict.qa("predict"),
        [
          {
            stage: "experiment",
            id: "records",
            label: "내 관찰 기록",
            question: "부품마다 두 전기 회로(전지 1개 연결 · 전지 2개 직렬연결)를 비교한 결과", // 버저는 하나씩 닫아 비교하므로 '함께 닫아'를 뺐다(review-D2 R2 — v2 배포 전)
            kind: "table",
            answer: {
              columns: [
                { key: "part", label: "부품" },
                { key: "compare", label: "비교한 것" },
                { key: "answer", label: "고른 답" },
              ],
              rows: recordRows(),
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        curiosity.qa("conclude")
      ),
    };
  }

  lesson.finish({
    stage: "conclude", // 마치기 칸이 정리하기 안에 있다(공통 틀 기본값 "curiosity"가 아니다)
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    canFinish: function () {
      // '더 탐구하고 싶은 점'이 비었는지·무의미한지는 공통 틀(lesson.js)이 마칠 때 본다(필수, 느슨한 판정)
      return conclude.isDone() || "정리하기에서 결론을 적고 '제출하고 모범 답안 보기'를 먼저 눌러 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var n = Object.keys(q).filter(function (k) {
        return q[k].correct;
      }).length;
      var p = exp.progress();
      return ["두 회로를 비교하고 기록한 부품: " + p.done + "/" + p.total + "가지", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
    },
  });
  lesson.restart($("btn-restart"));

  /* ───────── 단계 이동 ───────── */
  nav = lesson.nav({
    el: $("stage-nav"),
    stages: C.stages,
    prevBtn: $("btn-prev"),
    nextBtn: $("btn-next"),
    gates: {
      experiment: function () {
        return predict.isDone() || "예상하기 질문에 내 생각을 " + C.predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "관찰할 " + p.total + "칸을 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)";
      },
      conclude: function () {
        if (!exp.allDone()) return "먼저 실험하기에서 " + exp.progress().total + "칸을 모두 기록해 주세요.";
        return quiz.isDone() || "분석 질문 2개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: function () {
        return quiz.isDone();
      },
      conclude: function () {
        return conclude.isDone() && !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      predict: leaveBuzz,
      experiment: exp.activate,
      analyze: function () {
        leaveBuzz(); // 실험하기를 떠나면 버저 스위치를 열어 소리를 멈춘다
        drawResultTable();
      },
      conclude: leaveBuzz,
    },
  });

  // 실험하기를 떠나거나 화면이 숨거나 페이지를 닫으면 버저 스위치를 열어 소리를 멈춘다('들어 본 회로'는 그대로 — 돌아와서 확인할 수 있게)
  function leaveBuzz() {
    if (buzz.closed || sound.node) openBuzz(false);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) leaveBuzz();
  });
  window.addEventListener("pagehide", leaveBuzz);
})();
