/*
 * app.js — sci-6-2-3-2 "전기 회로에 전지 한 개를 더 연결하면 어떻게 될까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장·로그인/진행 저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(전지 한 개 회로 · 전지 두 개 직렬연결 회로 + 전구/전동기/버저)
 *   ② 관찰 카드  ③ 버저 소리(WebAudio, 학생이 버튼을 누른 뒤에만)  ④ '더 탐구해 보고 싶어요' 팝업
 *   ⑤ 분석 표·완료 저장  만 만든다.
 * 관찰 결과 문구는 모두 LessonConfig.results(교과서·실험관찰 예시)에서만 가져온다.
 *
 * 조건(factor) 2개: 부품(전구/전동기/버저) × 회로(전지 한 개 / 전지 두 개 직렬) = 6칸.
 * 두 회로는 실험대에 나란히 놓여 있어 언제든 비교할 수 있고, 고른 회로의 스위치만 닫는다.
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var S = window.SciSim;
  var el = S.el;
  var $ = function (id) {
    return document.getElementById(id);
  };

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
  function keyOf(partId, circuitId) {
    return partId + "|" + circuitId;
  }
  function phaseOf(partId) {
    return PART[partId] ? PART[partId].phase : "A";
  }
  function expected(partId, circuitId) {
    var r = C.results[partId];
    return r ? r[circuitId] || null : null;
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, document.hidden ? 0 : ms);
    });
  }

  /* ───────── 버저 소리(WebAudio) ─────────
   * · 학생이 버튼(스위치 닫기 / 소리 다시 듣기)을 누른 뒤에만 소리가 난다(자동 재생 없음).
   * · 전지 한 개 0.15, 전지 두 개 직렬 0.35 — 교실에서 시끄럽지 않게 작은 음량으로 크기 차이만 낸다.
   * · 끈 상태는 이 앱의 저장소(store)에 기억한다. 소리를 꺼도 화면의 파동·소리 크기 표시로 차이를 알 수 있다.
   */
  var sound = {
    on: store.get("sound", true) !== false,
    ctx: null,
    node: null,
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
  // 실험 화면 안에서 누르는 모든 버튼을 '학생의 조작'으로 보고 오디오를 깨운다(소리는 버저 실험에서만 난다)
  document.addEventListener(
    "pointerdown",
    function (e) {
      if (!sound.on) return;
      var t = e.target;
      if (t && t.closest && t.closest("#experiment-root")) audioCtx();
    },
    true
  );
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
  function playBuzzer(circuitId, ms) {
    if (!sound.on) return false;
    var ctx = audioCtx();
    if (!ctx || ctx.state !== "running") return false;
    stopBuzzer();
    var peak = circuitId === "series2" ? 0.35 : 0.15;
    var dur = (ms || 1200) / 1000;
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(circuitId === "series2" ? 700 : 660, t0);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1400, t0);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
    gain.gain.setValueAtTime(peak, t0 + dur - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    sound.node = { osc: osc, gain: gain };
    osc.onended = function () {
      if (sound.node && sound.node.osc === osc) sound.node = null;
    };
    return true;
  }
  function soundLabel() {
    return sound.on ? "🔈 소리 끄기" : "🔇 소리 켜기";
  }
  function soundHelp() {
    return sound.on
      ? "버저 실험에서 작은 소리가 나요. 교실에서 시끄러우면 소리를 꺼도 화면으로 크기 차이를 알 수 있어요."
      : "소리가 꺼져 있어요. 화면의 소리 파동과 '소리 크기' 표시로 차이를 알 수 있어요.";
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
    if (!sound.on) stopBuzzer();
    else audioCtx();
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

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.part, r.circuit);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);

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

  var PHASES = C.parts.map(function (p) {
    return {
      id: p.phase,
      name: C.phases[p.phase].name,
      title: p.name + " 비교하기",
      lead: C.phases[p.phase].lead,
      cells: C.circuits.map(function (c) {
        return { part: p.id, circuit: c.id };
      }),
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
      },
      {
        id: "circuit",
        title: "전기 회로 고르기",
        short: "전기 회로",
        options: C.circuits.map(function (c) {
          return {
            id: c.id,
            label: c.name,
            icon: function () {
              return el("span", { class: "opt-icon", "aria-hidden": "true", text: c.icon });
            },
          };
        }),
        phaseTag: false,
      },
    ],
    phases: PHASES,
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.part, sel.circuit);
    },
    runLabel: function (sel) {
      return "▶ 스위치 닫기 (" + CIR[sel.circuit].short + " · " + PART[sel.part].name + ")";
    },
    busyLabel: "스위치를 닫았어요… 잘 지켜보세요 👀",
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 회로판을 눌러 회로를 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 회로 그림을 눌러 회로를 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { part: sel.part, circuit: sel.circuit, result: observed };
    },
    describeRecord: function (r) {
      return PART[r.part].name + " · " + CIR[r.circuit].short + " → " + r.result;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.parts.map(function (p) {
        return { id: p.id, label: p.icon + " " + p.name };
      }),
      cols: C.circuits.map(function (c) {
        return { id: c.id, label: c.short };
      }),
      sel: function (r, c) {
        return { part: r.id, circuit: c.id };
      },
    },
    // 한 회로를 기록하면 같은 부품의 다른 회로를 이어서 고른다(바로 비교하게)
    onRecorded: function (info) {
      var r = info.record;
      if (!r || info.allDone) return;
      var other = C.circuits.filter(function (c) {
        return c.id !== r.circuit && !records.has(keyOf(r.part, c.id));
      })[0];
      if (other) exp.select({ part: r.part, circuit: other.id });
    },
    onChange: lesson.refresh,
  });

  /* 관찰·기록 카드: 본 모습(글) + 보기 고르기 → 확인하기(본 것과 같아야 기록) */
  function observeCard(sel) {
    var p = PART[sel.part];
    var c = CIR[sel.circuit];
    var seen = C.seen[sel.part][sel.circuit];
    var qWord = sel.part === "bulb" ? "전구의 밝기는" : sel.part === "motor" ? "전동기에 달린 날개는" : "버저의 소리는";
    var body = el("div", { class: "ob-body" }, [
      el("p", { class: "ob-where" }, [el("span", { class: "ob-chip", text: c.short }), el("span", { text: S.josa(p.name, "을", "를") + " 연결한 회로예요." })]),
      el("p", { class: "ob-seen" }, [el("span", { class: "ob-icon", "aria-hidden": "true", text: p.icon }), el("span", { text: "👀 " + seen })]),
    ]);
    if (sel.part === "buzzer") {
      var again = el("button", {
        type: "button",
        class: "ss-btn",
        text: "🔊 소리 다시 듣기",
        onclick: function () {
          if (!sound.on) {
            toast("지금은 소리가 꺼져 있어요. 아래 '🔇 소리 켜기'를 먼저 눌러 주세요.", 3200);
            return;
          }
          if (!playBuzzer(sel.circuit, 1100)) toast("이 기기에서는 소리를 낼 수 없어요. 화면의 소리 파동으로 크기를 비교해 보세요.", 3600);
        },
      });
      body.appendChild(el("div", { class: "ss-row ob-sound" }, [again, soundButton("ss-btn ss-btn-ghost")]));
    }
    return {
      question: c.name + "에서 " + qWord + " 어떠했나요?",
      body: body,
      type: "choice",
      choices: C.observeChoices[phaseOf(sel.part)],
      check: function (observed) {
        if (observed === expected(sel.part, sel.circuit)) return true;
        return "🔍 방금 본 모습과 다른 것 같아요. 장면을 다시 살펴보고, 본 것과 같은 보기를 골라 보세요.";
      },
      okMessage: "⭕ 본 것과 같아요! '기록하기'를 눌러 기록해요.",
      retryLabel: "🔁 다시 실험해 보기",
    };
  }

  // 실험대를 되돌린 뒤(공통 틀이 화면 상태 "scene"을 비운 다음) 실행 버튼 글자·도움말을 다시 그린다
  function refreshSoon() {
    setTimeout(function () {
      if (exp && exp.refresh) exp.refresh();
    }, 0);
  }

  /* ───────── 3D 장면 ─────────
   * 실험대 위에 회로판 2개(왼쪽: 전지 한 개, 오른쪽: 전지 두 개 직렬)를 나란히 놓고,
   * 두 회로에 같은 부품(전구·전동기·버저)을 하나씩 연결한 모습을 보여 준다.
   * 부품을 바꾸면 두 회로의 부품이 함께 바뀐다(실제 실험과 같게).
   */
  var BOARD = { w: 4.9, d: 3.5, h: 0.24, x: 3.0 }; // 회로판 크기·간격
  var WIRE_Y = 0.36;
  var SPEED = { motor: { single: 7, series2: 18 }, wave: { single: 1, series2: 2.1 } };

  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 11.6, depth: 6.4, center: [0, 0.8, 0] },
      viewDir: [0, 0.58, 0.81],
      minDistance: 3.2,
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var disposed = false;
      var currentPart = null;
      var done = {}; // cellKey → true (스위치를 닫아 결과가 남아 있는 칸)

      var tableMesh = M.table(15, 9.5, 0xd9c7a3);
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

      /* 세기 표시(색·움직임만으로 전달하지 않도록 칸 수로도 알려 준다). 부품 위에 띄운다. */
      function levelGauge(group, title, y) {
        var made = {
          1: M.label(title + " ▮▯▯", { height: 0.38, bold: true }),
          2: M.label(title + " ▮▮▮", { height: 0.38, bold: true }),
        };
        [1, 2].forEach(function (k) {
          made[k].position.set(0, y, 0);
          made[k].visible = false;
          group.add(made[k]);
        });
        return function (lv) {
          made[1].visible = lv === 1;
          made[2].visible = lv === 2;
        };
      }

      /* ── 부품(전구·전동기·버저) ── */
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
        var gauge = levelGauge(g, "밝기", BOARD.h + 1.7);
        return {
          group: g,
          set: function (level) {
            // level: 0(꺼짐) · 1(전지 한 개) · 2(전지 두 개 직렬)
            gauge(level);
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
        var gauge = levelGauge(g, "빠르기", BOARD.h + 1.6);
        var level = 0;
        return {
          group: g,
          set: function (lv) {
            level = lv;
            gauge(lv);
            blurMat.opacity = lv === 0 ? 0 : lv === 1 ? 0.18 : 0.5;
            if (lv && reduceMotion()) prop.rotation.y = lv === 1 ? 0.2 : 0.7;
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
        var rings = [];
        var ringMat = M.material(0x6ea0ff, { transparent: true, opacity: 0, roughness: 0.9, emissive: 0x3f7fe0, emissiveIntensity: 0.5, depthWrite: false });
        for (var i = 0; i < 3; i++) {
          var r = new T.Mesh(new T.TorusGeometry(1, 0.035, 8, 40), ringMat.clone());
          r.rotation.x = Math.PI / 2;
          r.position.y = BOARD.h + 0.34;
          r.visible = false;
          g.add(r);
          rings.push({ mesh: r, phase: i / 3 });
        }
        // 소리 크기 표시(소리를 끄거나 소리가 나지 않는 기기에서도 크기 차이를 알 수 있게)
        var gauge = levelGauge(g, "소리 크기", BOARD.h + 1.2);
        var level = 0;
        var t = 0;
        function placeRings(k0) {
          var maxR = level === 1 ? 0.95 : 1.85;
          var peak = level === 1 ? 0.35 : 0.7;
          rings.forEach(function (r) {
            var k = (k0 + r.phase) % 1;
            var rad = 0.45 + (maxR - 0.45) * k;
            r.mesh.scale.set(rad, rad, 1);
            r.mesh.material.opacity = peak * (1 - k);
          });
        }
        return {
          group: g,
          set: function (lv) {
            level = lv;
            gauge(lv);
            rings.forEach(function (r, i) {
              // 전지 한 개일 때는 고리를 2개만(작은 소리), 두 개 직렬일 때는 3개(큰 소리)
              r.mesh.visible = lv > 0 && (lv === 2 || i < 2);
              if (!lv) r.mesh.material.opacity = 0;
            });
            // 움직임 줄이기 설정에서도 고리가 보이게 한 장면을 고정해서 그린다
            if (lv && reduceMotion()) placeRings(0.25);
          },
          tickable: true,
          tick: function (dt) {
            if (!level) return;
            t += dt * (level === 1 ? SPEED.wave.single : SPEED.wave.series2);
            placeRings(t);
          },
        };
      }

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

        // 스위치(왼쪽 뒤)
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

        // 부품 자리(오른쪽 뒤)
        var partX = 1.35;
        var partZ = -1.0;
        var parts = {};
        var holder = new T.Group();
        holder.position.set(partX, 0, partZ);
        g.add(holder);
        parts.bulb = bulbPart();
        parts.motor = motorPart();
        parts.buzzer = buzzerPart();
        Object.keys(parts).forEach(function (k) {
          parts[k].group.visible = false;
          holder.add(parts[k].group);
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

        // 고른 회로 표시(테두리)
        var ringG = new T.Group();
        var edge = M.material(0x2f6fd6, { emissive: 0x2f6fd6, emissiveIntensity: 0.35, roughness: 0.6 });
        [
          [0, BOARD.d / 2 + 0.16, BOARD.w + 0.5, 0.12],
          [0, -BOARD.d / 2 - 0.16, BOARD.w + 0.5, 0.12],
        ].forEach(function (a) {
          var m = new T.Mesh(new T.BoxGeometry(a[2], 0.08, a[3]), edge);
          m.position.set(a[0], 0.04, a[1]);
          ringG.add(m);
        });
        [
          [-BOARD.w / 2 - 0.19, 0],
          [BOARD.w / 2 + 0.19, 0],
        ].forEach(function (a) {
          var m = new T.Mesh(new T.BoxGeometry(0.12, 0.08, BOARD.d + 0.5), edge);
          m.position.set(a[0], 0.04, a[1]);
          ringG.add(m);
        });
        ringG.visible = false;
        g.add(ringG);

        // 회로판을 눌러 회로를 고를 수 있게
        var pick = new T.Group();
        var pickBox = new T.Mesh(new T.BoxGeometry(BOARD.w, 0.05, BOARD.d), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
        pickBox.position.y = BOARD.h + 0.02;
        pick.add(pickBox);
        g.add(pick);
        v.pickable(pick, { circuit: cfg.id });

        return { id: cfg.id, x: g.position.x, group: g, lever: lever, parts: parts, ring: ringG, on: false };
      }

      var circuits = {};
      C.circuits.forEach(function (c, i) {
        circuits[c.id] = buildCircuit({ id: c.id, index: i, batteries: c.batteries, name: c.name });
      });

      /* ── 상태 ── */
      function levelOf(circuitId) {
        return circuitId === "series2" ? 2 : 1;
      }
      function setLever(c, closed) {
        c.lever.rotation.z = closed ? 0 : 0.6;
      }
      function applyState(c) {
        var part = currentPart;
        Object.keys(c.parts).forEach(function (k) {
          c.parts[k].group.visible = k === part;
        });
        var isOn = !!(part && done[keyOf(part, c.id)]);
        c.on = isOn;
        setLever(c, isOn);
        if (part) c.parts[part].set(isOn ? levelOf(c.id) : 0);
        Object.keys(c.parts).forEach(function (k) {
          if (k !== part) c.parts[k].set(0);
        });
      }
      function setPart(partId) {
        if (!partId || partId === currentPart) return;
        currentPart = partId;
        Object.keys(circuits).forEach(function (id) {
          applyState(circuits[id]);
        });
        startLoop();
      }

      /* ── 움직이는 부품(전동기 날개·소리 파동) 전용 루프 ── */
      var loopId = 0;
      var lastT = 0;
      function needsTick() {
        var any = false;
        Object.keys(circuits).forEach(function (id) {
          var c = circuits[id];
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
        Object.keys(circuits).forEach(function (id) {
          var c = circuits[id];
          if (c.on && currentPart && c.parts[currentPart].tick) c.parts[currentPart].tick(dt);
        });
        if (needsTick()) loopId = requestAnimationFrame(tick);
      }

      var runToken = 0;
      setPart(C.parts[0].id); // 부품을 고르기 전에도 회로가 비어 보이지 않게 첫 부품(전구)을 끼워 둔다
      v.render();

      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          if (s.part) setPart(s.part);
          Object.keys(circuits).forEach(function (id) {
            circuits[id].ring.visible = s.circuit === id;
          });
          v.render();
        },
        run: async function (sel) {
          var my = ++runToken;
          setPart(sel.part);
          var c = circuits[sel.circuit];
          var part = c.parts[sel.part];
          // 처음 상태로: 스위치 열고 부품 끄기
          done[keyOf(sel.part, sel.circuit)] = false;
          c.on = false;
          setLever(c, false);
          part.set(0);
          // 카메라는 움직이지 않는다: 두 회로가 언제나 함께 보여야 비교할 수 있다(고른 회로는 파란 테두리로 표시).
          say("① 스위치를 닫아요");
          await v.tween(250, function () {});
          if (my !== runToken) return;
          await v.tween(360, function (t) {
            c.lever.rotation.z = 0.6 * (1 - t);
          });
          if (my !== runToken) return;
          say("② 잘 지켜보세요");
          var lv = levelOf(sel.circuit);
          c.on = true;
          done[keyOf(sel.part, sel.circuit)] = true;
          part.set(lv);
          startLoop();
          if (sel.part === "buzzer") playBuzzer(sel.circuit, 1250);
          await v.tween(1350, function () {});
          if (my !== runToken) return;
          part.set(lv);
          say("");
          v.render();
        },
        showInstant: function (sel) {
          done[keyOf(sel.part, sel.circuit)] = true;
          if (!currentPart) setPart(sel.part);
          if (sel.part === currentPart) applyState(circuits[sel.circuit]);
          startLoop();
          v.render();
        },
        clear: function () {
          runToken++;
          stopBuzzer();
          say("");
          done = {};
          Object.keys(circuits).forEach(function (id) {
            applyState(circuits[id]);
          });
          v.flyHome(400);
          refreshSoon();
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          runToken++;
          disposed = true;
          stopBuzzer();
          if (loopId) cancelAnimationFrame(loopId);
          loopId = 0;
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          v.dispose();
        },
      };
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
    var done = {};
    var row = el("div", { class: "d2-row" });
    var caption = el("p", { class: "d2-caption", "aria-live": "polite" });

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
      // 스위치(왼쪽 위)
      var lever = svg("line", { x1: 60, y1: 60, x2: 92, y2: 44, class: "d2-lever" });
      var sw = svg("g", null, [
        svg("circle", { cx: 60, cy: 60, r: 4, class: "d2-post" }),
        svg("circle", { cx: 92, cy: 60, r: 4, class: "d2-post" }),
        lever,
        svgText(76, 86, "스위치", "d2-note"),
      ]);
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
      var propWrap = svg("g", { transform: "translate(122,60)" }, [prop]);
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
      // 세기 게이지(색 없이 칸 수와 글자로도 알 수 있게)
      var bars = [];
      for (var i = 0; i < 3; i++) {
        bars.push(svg("rect", { x: 62 + i * 27, y: 210, width: 22, height: 14, rx: 4, class: "d2-bar" }));
      }
      var gaugeText = svgText(100, 240, "스위치를 닫아 보세요", "d2-note");
      var gauge = svg("g", null, bars.concat([gaugeText]));

      var pic = svg("svg", { viewBox: "0 0 200 252", class: "d2-svg", "aria-hidden": "true" }, [wires, batt, sw, bulb, motor, buzzer, gauge]);
      var btn = el(
        "button",
        {
          type: "button",
          class: "d2-pick",
          "aria-pressed": "false",
          "aria-label": cfg.name + " (고르기)",
          onclick: function () {
            ctx.onPick({ circuit: cfg.id });
          },
        },
        [el("span", { class: "d2-name", text: cfg.name }), pic]
      );
      row.appendChild(btn);
      panels[cfg.id] = { id: cfg.id, btn: btn, lever: lever, partG: partG, prop: prop, waves: waves, glow: bulbGlow, bars: bars, gaugeText: gaugeText, on: false };
    });

    root.appendChild(el("div", { class: "d2-wrap" }, [row, caption]));
    caption.textContent = "부품과 회로를 고른 뒤 스위치를 닫아 보세요.";

    function levelOf(id) {
      return id === "series2" ? 2 : 1;
    }
    function gaugeWord(partId, lv) {
      if (partId === "bulb") return lv === 2 ? "밝기: 세게" : "밝기: 약하게";
      if (partId === "motor") return lv === 2 ? "회전: 빠르게" : "회전: 느리게";
      return lv === 2 ? "소리 크기: 크게" : "소리 크기: 작게";
    }
    function apply(p) {
      var part = currentPart;
      Object.keys(p.partG).forEach(function (k) {
        p.partG[k].style.display = k === part ? "" : "none";
      });
      var on = !!(part && done[keyOf(part, p.id)]);
      p.on = on;
      p.lever.setAttribute("x2", on ? "92" : "88");
      p.lever.setAttribute("y2", on ? "60" : "40");
      p.lever.classList.toggle("is-closed", on);
      var lv = on ? levelOf(p.id) : 0;
      p.glow.setAttribute("class", "d2-glow" + (lv ? " lv" + lv : ""));
      p.prop.setAttribute("class", "d2-prop" + (lv ? " spin" + lv : ""));
      p.waves.setAttribute("class", "d2-waves" + (lv ? " lv" + lv : ""));
      p.bars.forEach(function (b, i) {
        b.classList.toggle("is-on", lv === 1 ? i === 0 : lv === 2 ? true : false);
      });
      p.gaugeText.textContent = lv && part ? gaugeWord(part, lv) : "스위치를 닫아 보세요";
    }
    function applyAll() {
      Object.keys(panels).forEach(function (id) {
        apply(panels[id]);
      });
    }
    function setPart(partId) {
      if (!partId || partId === currentPart) return;
      currentPart = partId;
      applyAll();
    }
    setPart(C.parts[0].id); // 부품을 고르기 전에도 회로가 비어 보이지 않게 첫 부품(전구)을 끼워 둔다

    return {
      highlight: function (s) {
        if (s.part) setPart(s.part);
        Object.keys(panels).forEach(function (id) {
          panels[id].btn.classList.toggle("is-sel", s.circuit === id);
          panels[id].btn.setAttribute("aria-pressed", String(s.circuit === id));
        });
      },
      run: async function (sel) {
        var my = ++token;
        setPart(sel.part);
        var p = panels[sel.circuit];
        done[keyOf(sel.part, sel.circuit)] = false;
        apply(p);
        caption.textContent = "① 스위치를 닫아요…";
        await sleep(420);
        if (my !== token) return;
        done[keyOf(sel.part, sel.circuit)] = true;
        apply(p);
        caption.textContent = "② 잘 지켜보세요…";
        if (sel.part === "buzzer") playBuzzer(sel.circuit, 1250);
        await sleep(1100);
        if (my !== token) return;
        caption.textContent = CIR[sel.circuit].name + "에서 " + PART[sel.part].name + "의 모습을 살펴봐요.";
      },
      showInstant: function (sel) {
        done[keyOf(sel.part, sel.circuit)] = true;
        if (!currentPart) currentPart = sel.part;
        applyAll();
      },
      clear: function () {
        token++;
        stopBuzzer();
        done = {};
        applyAll();
        caption.textContent = "부품과 회로를 고른 뒤 스위치를 닫아 보세요.";
        refreshSoon();
      },
      resetView: function () {},
      dispose: function () {
        token++;
        stopBuzzer();
      },
    };
  }

  /* ───────── 3. 기록·분석하기: 관찰 결과 표 ───────── */
  var nav = null;
  function drawResultTable() {
    S.TableChart.renderMatrix($("result-table"), {
      caption: "전기 회로에 따른 부품의 모습 (내 기록)",
      rowHeader: "부품 \\ 전기 회로",
      rows: C.parts.map(function (p) {
        return { id: p.id, label: p.icon + " " + p.name };
      }),
      cols: C.circuits.map(function (c) {
        return { id: c.id, label: c.name };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        var rec = records.get(keyOf(r.id, c.id));
        if (!rec) return null;
        var wrong = rec.result !== expected(r.id, c.id);
        return {
          text: rec.result,
          icon: C.resultIcon[rec.result] || null,
          flag: wrong ? "다시 관찰해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ part: r.id, circuit: c.id });
          },
        };
      },
    });
  }

  /* ───────── 5. 마치기(결과 저장) ───────── */
  function recordRows() {
    return C.parts.map(function (p) {
      var a = records.get(keyOf(p.id, "single"));
      var b = records.get(keyOf(p.id, "series2"));
      return { part: p.name, single: a ? a.result : "", series2: b ? b.result : "" };
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
      records: records.list().map(function (r) {
        return { part: PART[r.part].name, circuit: CIR[r.circuit].name, result: r.result, recordedAt: r.recordedAt };
      }),
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosity.value(),
      // 질문-답 표준 목록(관리자 "학생 응답" 화면용, docs/admin/responses-spec.md §3.3)
      qa: [].concat(
        predict.qa("predict"),
        [
          {
            stage: "experiment",
            id: "records",
            label: "내 관찰 기록",
            question: "부품별 전기 회로(전지 한 개 / 전지 두 개 직렬)에서의 관찰 결과",
            kind: "table",
            answer: {
              columns: [
                { key: "part", label: "부품" },
                { key: "single", label: "전지 한 개" },
                { key: "series2", label: "전지 두 개 직렬" },
              ],
              rows: recordRows(),
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        curiosity.qa("curiosity")
      ),
    };
  }

  lesson.finish({
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    canFinish: function () {
      return conclude.isDone() || "정리하기에서 결론을 적고 '제출하고 모범 답안 보기'를 먼저 눌러 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var n = Object.keys(q).filter(function (k) {
        return q[k].correct;
      }).length;
      var p = exp.progress();
      return ["관찰하고 기록한 칸: " + p.done + "/" + p.total + "칸", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
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
        if (!exp.allDone()) return "먼저 실험하기에서 6칸을 모두 기록해 주세요.";
        return quiz.isDone() || "분석 질문 2개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "정리하기에서 결론을 적고 '제출하고 모범 답안 보기'를 눌러 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: function () {
        return quiz.isDone();
      },
      conclude: function () {
        return conclude.isDone();
      },
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: exp.activate,
      analyze: drawResultTable,
    },
  });

  // 실험 화면을 떠나거나 페이지를 닫을 때 소리를 멈춘다
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopBuzzer();
  });
  window.addEventListener("pagehide", stopBuzzer);
})();
