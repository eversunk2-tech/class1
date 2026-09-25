/*
 * app.js — sci-6-1-1-4 "산성 용액과 염기성 용액을 섞으면 어떻게 될까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(24홈판 첫째·넷째 줄, 점적병, 붉은 양배추 용액)  ② 관찰 카드(색 견본 + 색 구별 도우미 '색 띠')
 *   ③ 분석 표·색깔 변화표·퀴즈 연결  만 만든다.
 * 칸의 색은 모두 LessonConfig.phases[].pos(색깔 변화표 위의 자리, 지도서 144쪽 결과 예시를 본뜬 모형)에서만 가져온다.
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var S = window.SciSim;
  var el = S.el;
  var $ = function (id) {
    return document.getElementById(id);
  };

  // 간략화 전(예전 판) 저장 키의 이 기기 사본을 지운다(2026-09-26, review-C M1) — 남겨 두면 로그아웃할 때 사이트가 예전 판 사본을
  // 올리려다 "다른 기기에서 저장한 기록과 달라요" 창을 띄우고, '확인'을 누르면 새 판 진행 기록이 예전 것으로 덮인다.
  // 예전 판은 새 판에서 쓰지 않는다(저장 키 버전을 올림). 이 앱의 예전 키만 지운다(localStorage.clear() 금지).
  (function () {
    var OLD = ["sci6114sim:v1", "sci6114sim:v2"];
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
  var PH = C.phases;
  var PHASE_IDS = ["A", "B"];

  /* ───────── 색 계산(모형) ───────── */
  function rgb(hex) {
    var h = hex.replace("#", "");
    return [0, 2, 4].map(function (i) {
      return parseInt(h.substr(i, 2), 16);
    });
  }
  function hex(c) {
    return (
      "#" +
      c
        .map(function (v) {
          var x = Math.max(0, Math.min(255, Math.round(v))).toString(16);
          return x.length < 2 ? "0" + x : x;
        })
        .join("")
    );
  }
  function mix(a, b, t) {
    var pa = rgb(a);
    var pb = rgb(b);
    return hex(
      pa.map(function (v, i) {
        return v + (pb[i] - v) * t;
      })
    );
  }
  // 색깔 변화표 위의 자리(0 = 산성이 강함, 1 = 염기성이 강함) → 색
  function chartColor(pos) {
    var st = C.chart;
    pos = Math.max(0, Math.min(1, pos));
    for (var i = 1; i < st.length; i++) {
      if (pos <= st[i].at) {
        var a = st[i - 1];
        var b = st[i];
        return mix(a.color, b.color, (pos - a.at) / (b.at - a.at || 1));
      }
    }
    return st[st.length - 1].color;
  }
  // 넣은 방울 수(소수도 가능)에 따른 자리: 표의 0·5·10·…·25방울 칸 사이를 곧게 잇는다(모형)
  function posAt(ph, drops) {
    var D = C.drops;
    var P = PH[ph].pos;
    if (drops <= D[0]) return P[0];
    for (var i = 1; i < D.length; i++) {
      if (drops <= D[i]) return P[i - 1] + ((P[i] - P[i - 1]) * (drops - D[i - 1])) / (D[i] - D[i - 1]);
    }
    return P[P.length - 1];
  }
  function colorAt(ph, drops) {
    return chartColor(posAt(ph, drops));
  }
  function startColor(ph) {
    return colorAt(ph, 0);
  }
  function hexToRgba(h, a) {
    return "rgba(" + rgb(h).join(",") + "," + a + ")";
  }
  function keyOf(ph, drops) {
    return ph + "|" + drops;
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  // 표·흐름 칩에서는 보기 이름의 괄호 속 예시(빨간색·분홍색… )를 빼고 짧게 보여 준다
  function shortFamily(f) {
    return String(f).replace(/\s*\([^)]*\)\s*$/, "");
  }
  function dropLabel(d) {
    return Number(d) === 0 ? "0방울" : d + "방울";
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.phase, r.drops);
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
  // '더 탐구하고 싶은 점'은 한 줄 입력(2026-09-25 간략화, 새 기준 앱과 같게): 공통 틀의 여러 줄 입력칸을 한 줄로 쓰고, Enter로 줄을 바꾸지 않게 한다.
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
  // 결론을 제출한 뒤에 '더 탐구하고 싶은 점'과 '학습 마치기'가 보인다
  function showFinish() {
    $("finish-wrap").hidden = !conclude.isDone();
  }
  showFinish();

  /* ───────── 색깔 변화표(모형) — 표시 자리(▲)를 글자로도 보여 준다(색만으로 전달하지 않기) ─────────
   * o.ends === "color": 관찰 카드(기록하는 순간)의 '색 구별' 도우미용 — 양 끝과 자리를 **색 이름**(붉은색 쪽·노란색 쪽)으로만 말한다.
   *   산성·염기성 이름은 분석 단계의 색깔 변화표에서만 쓴다(CLAUDE.md "기록하는 순간에는 관찰 사실만" — 2026-09-25 간략화 때 고침,
   *   예전에는 관찰 카드에서 "넣은 뒤는 염기성이 강한 쪽"처럼 분석 질문의 답을 먼저 알려 주었다). 띠의 색·자리 값은 그대로다. */
  function chartNode(o) {
    o = o || {};
    var byColor = o.ends === "color";
    var endL = byColor ? "◀ 붉은색 쪽" : "◀ 산성이 강함";
    var endR = byColor ? "노란색 쪽 ▶" : "염기성이 강함 ▶";
    function where(pos) {
      if (byColor) return pos < 0.34 ? "붉은색 쪽" : pos > 0.66 ? "노란색 쪽" : "가운데쯤";
      return pos < 0.34 ? "산성이 강한 쪽" : pos > 0.66 ? "염기성이 강한 쪽" : "가운데쯤";
    }
    var grad =
      "linear-gradient(to right, " +
      C.chart
        .map(function (s) {
          return s.color + " " + Math.round(s.at * 100) + "%";
        })
        .join(", ") +
      ")";
    var bar = el("div", { class: "cc-bar", "aria-hidden": "true" });
    bar.style.background = grad;
    var marks = el("div", { class: "cc-marks" });
    (o.markers || []).forEach(function (m, i) {
      var mk = el("div", { class: "cc-mark cc-mark-" + (i % 2 ? "b" : "a") }, [el("span", { class: "cc-tri", "aria-hidden": "true", text: "▲" }), el("span", { class: "cc-mtext", text: m.label })]);
      mk.style.left = (m.pos * 100).toFixed(1) + "%";
      // 끝에 가까우면 글자가 밖으로 나가지 않게 정렬을 바꾼다
      if (m.pos < 0.15) mk.classList.add("is-left");
      else if (m.pos > 0.85) mk.classList.add("is-right");
      marks.appendChild(mk);
    });
    var box = el("figure", { class: "cc" + (o.markers && o.markers.length ? " has-marks" : "") }, [
      o.title === false ? null : el("figcaption", { class: "cc-title", text: o.title || "붉은 양배추 용액의 색깔 변화표 (모형)" }),
      el("div", { class: "cc-track" }, [bar, marks]),
      el("div", { class: "cc-ends" }, [el("span", { class: "cc-end cc-acid", text: endL }), el("span", { class: "cc-end cc-base", text: endR })]),
    ]);
    if (o.markers && o.markers.length) {
      box.setAttribute(
        "aria-label",
        (byColor ? "색 띠: " : "색깔 변화표: ") +
          o.markers
            .map(function (m) {
              return S.josa(m.label, "은", "는") + " " + where(m.pos);
            })
            .join(", ")
      );
    }
    return box;
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div");
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    return box;
  }
  var safety = el("details", { class: "ss-card safety" }, [
    el("summary", { text: "⚠️ 실제 실험할 때 안전 수칙" }),
    el(
      "ul",
      null,
      C.safety.map(function (t) {
        return el("li", { text: t });
      })
    ),
  ]);
  function phaseIcon(ph) {
    var i = el("span", { class: "start-icon", "aria-hidden": "true" });
    i.style.setProperty("--c", startColor(ph));
    return i;
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🧽 홈판 비우기",
    clearMessage: "홈판을 깨끗이 비웠어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "phase",
        title: "시작 용액 고르기",
        short: "시작 용액",
        options: PHASE_IDS.map(function (ph) {
          return {
            id: ph,
            label: PH[ph].row + " · " + PH[ph].start + " 10방울",
            icon: function () {
              return phaseIcon(ph);
            },
          };
        }),
        note: function (sel) {
          return sel.phase ? "💧 이 줄에 넣을 용액: " + PH[sel.phase].add : null;
        },
      },
      {
        id: "drops",
        title: "넣는 방울 수 고르기",
        short: "방울 수",
        columns: 3,
        options: C.drops.map(function (d) {
          return { id: String(d), label: d === 0 ? "0방울 (비교용)" : d + "방울" };
        }),
      },
    ],
    phases: PHASE_IDS.map(function (ph) {
      return {
        id: ph,
        name: PH[ph].name,
        title: PH[ph].title,
        lead: PH[ph].lead,
        cells: C.drops.map(function (d) {
          return { phase: ph, drops: String(d) };
        }),
      };
    }),
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.phase, sel.drops);
    },
    runLabel: function (sel) {
      var p = PH[sel.phase];
      return sel.drops === "0" ? "▶ 0방울: 아무것도 넣지 않고 관찰하기" : "▶ " + p.add + " " + sel.drops + "방울 넣기";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 홈을 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 홈이나 줄·방울 수 이름을 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { phase: sel.phase, drops: Number(sel.drops), colorFamily: observed };
    },
    describeRecord: function (r) {
      return PH[r.phase].name + " " + dropLabel(r.drops) + " → " + r.colorFamily;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: PHASE_IDS.map(function (ph) {
        return { id: ph, label: PH[ph].name };
      }),
      cols: C.drops.map(function (d) {
        return { id: String(d), label: String(d) };
      }),
      sel: function (r, c) {
        return { phase: r.id, drops: c.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  /* 관찰·기록 카드: 처음 색 → 넣은 뒤 색 견본 + (필요하면) 색깔 변화표 위 자리 */
  function swatch(label, color) {
    var chip = el("span", { class: "swatch-chip" });
    chip.style.backgroundColor = color;
    return el("div", { class: "swatch" }, [chip, el("span", { class: "swatch-label", text: label })]);
  }
  function observeCard(sel) {
    var ph = sel.phase;
    var p = PH[ph];
    var n = Number(sel.drops);
    var after = colorAt(ph, n);
    var body = el("div", { class: "swatches" });
    var row =
      n === 0
        ? [swatch("비교용 칸(아무것도 넣지 않음)", after)]
        : [
            swatch("처음 색 (" + p.start + " + 붉은 양배추 용액)", startColor(ph)),
            el("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
            swatch(p.add + " " + n + "방울을 넣은 뒤", after),
          ];
    body.appendChild(el("div", { class: "swatch-row" + (n === 0 ? "" : " has-arrow") }, row));
    var markers =
      n === 0
        ? [{ pos: posAt(ph, 0), label: "이 칸" }]
        : [
            { pos: posAt(ph, 0), label: "처음" },
            { pos: posAt(ph, n), label: "넣은 뒤" },
          ];
    // 기록하는 순간이라 색 이름으로만(산성·염기성 이름은 분석 단계의 색깔 변화표에서) — chartNode 주석
    var help = el("div", { class: "cc-help", hidden: true }, [chartNode({ markers: markers, ends: "color", title: "색 띠 (모형)" })]);
    var btn = el("button", { type: "button", class: "ss-btn ss-btn-ghost small-btn", text: "🎨 색 구별이 어려우면 눌러요", "aria-pressed": "false", "aria-expanded": "false" });
    btn.addEventListener("click", function () {
      var on = help.hidden;
      help.hidden = !on;
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-expanded", String(on));
      btn.textContent = on ? "🎨 색 띠 숨기기" : "🎨 색 구별이 어려우면 눌러요";
    });
    body.appendChild(el("div", { class: "swatch-tools" }, [btn]));
    body.appendChild(help);
    body.appendChild(el("p", { class: "ss-help", text: "✏️ 색연필로 칠하듯, 내 눈에 가장 가깝게 보이는 것을 골라요. 정확한 색 이름을 맞히는 것이 아니에요." }));
    return {
      question: p.name + " " + dropLabel(n) + " 칸: 홈 안 용액의 색깔은 어느 쪽에 가장 가까운가요?",
      body: body,
      type: "choice",
      choices: C.colorFamilies,
    };
  }

  /* ── 현재 고른 시작 용액·방울 수를 새로고침 뒤에도 되살린다(앱 전용, 공통 틀은 선택을 저장하지 않음) ── */
  function rememberSel(s) {
    if (!s || (s.phase == null && s.drops == null)) return;
    store.set("curSel", { phase: s.phase == null ? null : s.phase, drops: s.drops == null ? null : String(s.drops) });
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (!saved || (saved.phase == null && saved.drops == null)) return;
    // 실험 B는 실험 A를 모두 기록해야 열린다(잠긴 줄은 되살리지 않는다)
    if (saved.phase === "B" && exp.phaseCount("A") < exp.phaseTotal("A")) return;
    var s = {};
    if (saved.phase != null && PH[saved.phase]) s.phase = saved.phase;
    if (saved.drops != null && C.drops.indexOf(Number(saved.drops)) >= 0) s.drops = String(saved.drops);
    if (s.phase != null || s.drops != null) exp.select(s);
  }

  /* ── 두 화면이 함께 쓰는 홈 상태: 줄 준비 여부 + 결과가 있는 칸 ── */
  function plateState() {
    return { prepared: { A: false, B: false }, done: {} };
  }
  function counterEl() {
    return el("div", { class: "drop-counter", "aria-live": "polite", hidden: true });
  }
  function setCounter(c, text) {
    c.hidden = !text;
    c.textContent = text || "";
  }
  function dropTiming(n) {
    // 방울이 많으면 한 방울씩 그리지 않고 숫자로 센다(최대 약 2.2초)
    return { ms: n <= 5 ? 240 : Math.max(70, Math.round(2000 / n)), every: n <= 5 ? 1 : Math.ceil(n / 5) };
  }

  /* ── 2D 대체 화면: 24홈판을 위에서 본 모형 ── */
  var ROWS = [
    { idx: 0, name: "첫째 줄", phase: "A" },
    { idx: 1, name: "둘째 줄", phase: null },
    { idx: 2, name: "셋째 줄", phase: null },
    { idx: 3, name: "넷째 줄", phase: "B" },
  ];
  function build2D(root, ctx) {
    var st = plateState();
    var cells = {};
    var colHeads = {};
    var rowHeads = {};
    var grid = el("div", { class: "plate2d", role: "group", "aria-label": "24홈판(2D 모형)" });
    grid.appendChild(el("div", { class: "p2-corner", text: "넣는 방울 수 →" }));
    C.drops.forEach(function (d) {
      var h = el("button", {
        type: "button",
        class: "p2-col",
        text: dropLabel(d),
        onclick: function () {
          ctx.onPick({ drops: String(d) });
        },
      });
      colHeads[d] = h;
      grid.appendChild(h);
    });
    ROWS.forEach(function (r) {
      if (!r.phase) {
        grid.appendChild(el("div", { class: "p2-row is-unused", text: r.name + " (쓰지 않음)" }));
        C.drops.forEach(function () {
          grid.appendChild(el("span", { class: "p2-well is-unused", "aria-hidden": "true" }));
        });
        return;
      }
      var ph = r.phase;
      var rh = el(
        "button",
        {
          type: "button",
          class: "p2-row",
          onclick: function () {
            ctx.onPick({ phase: ph });
          },
        },
        [phaseIcon(ph), el("span", { text: r.name + " · " + PH[ph].name })]
      );
      rowHeads[ph] = rh;
      grid.appendChild(rh);
      C.drops.forEach(function (d) {
        var liquid = el("span", { class: "p2-liquid" });
        var w = el(
          "button",
          {
            type: "button",
            class: "p2-well",
            onclick: function () {
              ctx.onPick({ phase: ph, drops: String(d) });
            },
          },
          [liquid]
        );
        var c = { well: w, liquid: liquid, ph: ph, d: d };
        cells[keyOf(ph, d)] = c;
        label(c);
        grid.appendChild(w);
      });
    });
    var counter = counterEl();
    root.appendChild(
      el("div", { class: "plate2d-wrap" }, [
        el("div", { class: "plate2d-scroll" }, [grid]),
        counter,
        el("p", { class: "p2-caption", text: "24홈판 · 실험 도움판 ③ (위에서 본 모형) — 첫째 줄과 넷째 줄만 써요" }),
      ])
    );

    function label(c, state) {
      var base = PH[c.ph].row + " " + PH[c.ph].name + ", " + PH[c.ph].add + " " + dropLabel(c.d);
      c.well.setAttribute("aria-label", base + (state === "done" ? ", 실험함" : state === "ready" ? ", 준비됨(처음 색)" : ", 비어 있음"));
    }
    function setLiquid(c, color, clear) {
      c.well.classList.add("has-liquid");
      c.liquid.classList.toggle("is-clear", !!clear);
      c.liquid.style.background = clear ? "" : color;
    }
    function empty(c) {
      c.well.classList.remove("has-liquid");
      c.liquid.classList.remove("is-clear");
      c.liquid.style.background = "";
      label(c);
    }
    function dropInto(c, color, clear) {
      var dr = el("span", { class: "p2-drop" + (clear ? " is-clear" : "") });
      if (!clear) dr.style.background = color;
      c.well.appendChild(dr);
      setTimeout(function () {
        if (dr.parentNode) dr.parentNode.removeChild(dr);
      }, 600);
    }
    function rowCells(ph) {
      return C.drops.map(function (d) {
        return cells[keyOf(ph, d)];
      });
    }
    function prepareInstant(ph) {
      rowCells(ph).forEach(function (c) {
        if (!st.done[keyOf(ph, c.d)]) {
          setLiquid(c, startColor(ph));
          label(c, "ready");
        }
      });
      st.prepared[ph] = true;
    }
    async function prepareAnimated(ph) {
      var cs = rowCells(ph);
      setCounter(counter, "💧 " + PH[ph].start + " 10방울씩 넣기 (⏩ 빨리 감기)");
      for (var i = 0; i < cs.length; i++) {
        dropInto(cs[i], null, true);
        await sleep(160);
        setLiquid(cs[i], null, true);
      }
      await sleep(250);
      setCounter(counter, "🟣 붉은 양배추 용액 5~6방울씩 (⏩ 빨리 감기)");
      for (var j = 0; j < cs.length; j++) {
        dropInto(cs[j], C.color.cabbage);
        await sleep(200);
        setLiquid(cs[j], startColor(ph));
        label(cs[j], "ready");
      }
      await sleep(500);
      st.prepared[ph] = true;
    }
    return {
      highlight: function (s) {
        rememberSel(s);
        Object.keys(colHeads).forEach(function (d) {
          colHeads[d].classList.toggle("is-sel", s.drops === String(d));
        });
        Object.keys(rowHeads).forEach(function (ph) {
          rowHeads[ph].classList.toggle("is-sel", s.phase === ph);
        });
        Object.keys(cells).forEach(function (k) {
          cells[k].well.classList.toggle("is-target", k === keyOf(s.phase, s.drops));
        });
      },
      run: async function (sel) {
        var ph = sel.phase;
        var n = Number(sel.drops);
        var c = cells[keyOf(ph, n)];
        c.well.classList.add("is-busy");
        try {
          if (!st.prepared[ph]) await prepareAnimated(ph);
          else if (st.done[keyOf(ph, n)]) {
            setCounter(counter, "🔁 새로 준비한 홈으로 다시");
            setLiquid(c, startColor(ph));
            await sleep(600);
          }
          if (n === 0) {
            setCounter(counter, "0방울: 아무것도 넣지 않아요(비교용)");
            await sleep(1100);
          } else {
            var tm = dropTiming(n);
            for (var k = 1; k <= n; k++) {
              setCounter(counter, "💧 " + PH[ph].add + " " + k + "/" + n + "방울" + (tm.every > 1 ? " (⏩ 빨리 감기)" : ""));
              if (k % tm.every === 0 || k === 1) dropInto(c, null, true);
              await sleep(tm.ms);
              setLiquid(c, colorAt(ph, k));
            }
            await sleep(700);
          }
          st.done[keyOf(ph, n)] = true;
          label(c, "done");
        } finally {
          setCounter(counter, "");
          c.well.classList.remove("is-busy");
        }
      },
      showInstant: function (sel) {
        var ph = sel.phase;
        var n = Number(sel.drops);
        if (!st.prepared[ph]) prepareInstant(ph);
        var c = cells[keyOf(ph, n)];
        setLiquid(c, colorAt(ph, n));
        st.done[keyOf(ph, n)] = true;
        label(c, "done");
      },
      clear: function () {
        Object.keys(cells).forEach(function (k) {
          empty(cells[k]);
        });
        st = plateState();
      },
      resetView: function () {},
      dispose: function () {},
    };
  }

  /* ── 3D 화면 ── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 19.5, depth: 15, center: [0, 0.6, -0.6] },
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var st = plateState();
      var counter = counterEl();
      container.appendChild(counter);

      var tableMesh = M.table(24, 19, 0xd9c7a3);
      tableMesh.position.z = -0.8;
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      // 24홈판: 앞쪽부터 첫째·둘째·셋째·넷째 줄 (three.js 줄 번호 3 → 0)
      var plate = M.wellPlate({ rows: 4, cols: 6, spacing: 1.9 });
      v.root.add(plate.group);
      var TOP = plate.height;
      function prow(i) {
        return 3 - i; // 사람이 세는 줄(0 = 첫째 줄) → wellPlate 줄
      }
      var PROW = { A: prow(0), B: prow(3) };
      function colX(c) {
        return plate.wells[0][c].position[0];
      }
      function rowZ(i) {
        return plate.wells[prow(i)][0].position[2];
      }
      // 쓰지 않는 둘째·셋째 줄은 흐리게
      [1, 2].forEach(function (i) {
        plate.wells[prow(i)].forEach(function (w) {
          w.hole.material.color.set(0xeef1f5); // 흐리게: 쓰지 않는 홈
        });
      });
      var unused = M.label("둘째·셋째 줄: 이번 실험에서 쓰지 않음", { height: 0.62, bg: "rgba(255,255,255,0.8)", color: "#5b6676" });
      unused.position.set(0, TOP + 0.35, (rowZ(1) + rowZ(2)) / 2);
      v.root.add(unused);

      // 실험 도움판 ③: 열마다 방울 수(앞쪽)
      C.drops.forEach(function (d, c) {
        var l = M.label(d === 0 ? "0방울" : d + "방울", { height: 0.68 });
        l.position.set(colX(c), 0.3, plate.depth / 2 + 0.55);
        v.root.add(l);
      });
      var boardLabel = M.label("24홈판 · 실험 도움판 ③ (모형)", { height: 0.55 });
      boardLabel.position.set(0, 0.3, plate.depth / 2 + 1.45);
      v.root.add(boardLabel);

      // 줄 이름표(홈판 왼쪽)
      PHASE_IDS.forEach(function (ph) {
        var i = ph === "A" ? 0 : 3;
        var l = M.label(PH[ph].row + "\n" + PH[ph].name, { height: 1.25, border: hexToRgba(startColor(ph), 1) });
        l.position.set(-plate.width / 2 - 1.5, 0.85, rowZ(i));
        v.root.add(l);
      });

      function ring(radius, color) {
        var m = new T.Mesh(new T.TorusGeometry(radius, 0.07, 10, 40), new T.MeshBasicMaterial({ color: color }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        return m;
      }
      var targetRing = ring(0.8, 0xf2a93b);
      targetRing.position.y = TOP + 0.06;
      v.root.add(targetRing);
      var rowRing = new T.Mesh(
        new T.BoxGeometry(plate.width - 0.3, 0.04, 1.75),
        new T.MeshBasicMaterial({ color: 0x2f6fd6, transparent: true, opacity: 0.18 })
      );
      rowRing.visible = false;
      rowRing.position.y = TOP + 0.03;
      v.root.add(rowRing);

      // 점적병(왼쪽): 묽은 염산, 묽은 수산화 나트륨 용액 — 둘 다 색깔 없고 투명
      // 기구는 홈판 뒤쪽에 한 줄로 둔다(세로 화면에서도 화면 안에 들어오게)
      var BZ = -plate.depth / 2 - 1.7;
      var bottles = {};
      [
        { id: "묽은 염산", x: -5.2, text: "묽은 염산" },
        { id: "묽은 수산화 나트륨 용액", x: -1.7, text: "묽은 수산화\n나트륨 용액" },
      ].forEach(function (b) {
        var obj = M.bottle({ liquid: C.color.clear, liquidOpacity: 0.4 });
        var home = [b.x, 0, BZ];
        obj.position.fromArray(home);
        obj.userData.home = home;
        v.root.add(obj);
        var r = ring(0.65, 0x2f6fd6);
        r.position.set(home[0], 0.03, home[2]);
        v.root.add(r);
        var two = b.text.indexOf("\n") >= 0;
        var l = M.label(b.text, { height: two ? 1.3 : 0.72 });
        l.position.set(home[0], two ? 3.4 : 2.9, home[2]);
        v.root.add(l);
        bottles[b.id] = { obj: obj, ring: r };
      });
      // 붉은 양배추 용액(오른쪽)
      var CX = 1.9;
      var CZ = BZ;
      var cab = M.bottle({ liquid: C.color.cabbage, liquidOpacity: 0.9, radius: 0.5, height: 1.4, cap: 0x8a5a2b });
      cab.position.set(CX, 0, CZ);
      v.root.add(cab);
      var cabL = M.label("붉은 양배추\n용액", { height: 1.3 });
      cabL.position.set(CX, 3.4, CZ);
      v.root.add(cabL);
      // 색연필 통(장식, 12색) — 실험 결과를 색연필로 기록한다(지도서 144쪽)
      var cup = new T.Group();
      var cupBody = new T.Mesh(new T.CylinderGeometry(0.62, 0.55, 1.1, 20), M.material(0x6d7f95));
      cupBody.position.y = 0.55;
      cup.add(cupBody);
      var pencilColors = [0xd23a57, 0xf08a24, 0xe7c52c, 0x8cc63f, 0x3d9a6a, 0x2bb3c0, 0x3a5fbf, 0x1f2f7a, 0x7b3fa0, 0xe879b0, 0x8b5a2b, 0x222222];
      pencilColors.forEach(function (col, i) {
        var a = (i / pencilColors.length) * Math.PI * 2;
        var p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.5, 6), M.material(col));
        p.position.set(Math.cos(a) * 0.36, 1.2 + (i % 3) * 0.08, Math.sin(a) * 0.36);
        p.rotation.z = Math.cos(a) * 0.12;
        p.rotation.x = Math.sin(a) * 0.12;
        cup.add(p);
      });
      cup.position.set(5.4, 0, BZ);
      v.root.add(cup);
      var cupL = M.label("색연필", { height: 0.68 });
      cupL.position.set(5.4, 2.6, BZ);
      v.root.add(cupL);

      // 홈(첫째·넷째 줄만 탭으로 고르기)
      var wellObjs = {};
      PHASE_IDS.forEach(function (ph) {
        C.drops.forEach(function (d, c) {
          var w = plate.wells[PROW[ph]][c];
          v.pickable(w.hole, { phase: ph, drops: String(d) });
          v.pickable(w.liquid, { phase: ph, drops: String(d) });
          wellObjs[keyOf(ph, d)] = { w: w, ph: ph, d: d };
        });
      });
      function setLiquid(o, color, opacity) {
        o.w.liquid.visible = true;
        o.w.liquid.material.color.set(color);
        o.w.liquid.material.opacity = opacity == null ? 0.92 : opacity;
      }
      // 홈 안 액체 높이(모형): 홈에 든 전체 방울 수에 비례해 조금씩 높아진다.
      // 시작 용액 10방울 + 붉은 양배추 용액 5~6방울 = 약 15.5방울, 25방울을 넣으면 약 40.5방울.
      var BASE_DROPS = 15.5;
      function setAmount(o, total) {
        var sy = Math.max(0.4, total / 9);
        o.w.liquid.scale.y = sy;
        o.w.liquid.position.y = o.w.position[1] + 0.015 + 0.025 * sy;
      }
      function emptyWell(o) {
        o.w.liquid.visible = false;
        setAmount(o, BASE_DROPS);
      }
      function rowObjs(ph) {
        return C.drops.map(function (d) {
          return wellObjs[keyOf(ph, d)];
        });
      }
      function prepareInstant(ph) {
        rowObjs(ph).forEach(function (o) {
          if (!st.done[keyOf(ph, o.d)]) {
            setLiquid(o, startColor(ph));
            setAmount(o, BASE_DROPS);
          }
        });
        st.prepared[ph] = true;
      }
      async function fall(color, from, to, ms) {
        var dr = M.drop(color);
        dr.position.fromArray(from);
        v.root.add(dr);
        await v.moveTo(dr, to, ms);
        v.discard(dr);
      }
      // 줄 준비: 시작 용액 10방울씩 → 붉은 양배추 용액 5~6방울씩
      async function prepareAnimated(ph) {
        var os = rowObjs(ph);
        var b = bottles[PH[ph].start].obj;
        var home = b.userData.home;
        var H = b.userData.height;
        var z = os[0].w.position[2];
        setCounter(counter, "💧 " + PH[ph].start + " 10방울씩 넣기 (⏩ 빨리 감기)");
        await v.moveTo(b, [home[0], 1.4, home[2]], 180);
        await v.moveTo(b, [os[0].w.position[0], TOP + 0.7 + H, z], 380);
        await v.tween(200, function (t) {
          b.rotation.x = Math.PI * t;
        });
        for (var i = 0; i < os.length; i++) {
          var p = os[i].w.position;
          if (i > 0) await v.moveTo(b, [p[0], TOP + 0.7 + H, z], 150);
          await fall(C.color.clear, [p[0], TOP + 0.65, z], [p[0], TOP + 0.05, z], 150);
          setLiquid(os[i], C.color.clear, 0.45);
          setAmount(os[i], 10);
        }
        await v.tween(180, function (t) {
          b.rotation.x = Math.PI * (1 - t);
        });
        var back = v.moveTo(b, [home[0], 1.4, home[2]], 380).then(function () {
          return v.moveTo(b, home, 160);
        });
        setCounter(counter, "🟣 붉은 양배추 용액 5~6방울씩 (⏩ 빨리 감기)");
        var pip = M.pipette(C.color.cabbage);
        pip.position.set(CX, 1.6, CZ);
        v.root.add(pip);
        await v.moveTo(pip, [CX, 2.8, CZ], 160);
        for (var j = 0; j < os.length; j++) {
          var q = os[j].w.position;
          await v.moveTo(pip, [q[0], TOP + 0.9, z], j === 0 ? 380 : 150);
          await fall(C.color.cabbage, [q[0], TOP + 0.85, z], [q[0], TOP + 0.06, z], 140);
          v.fadeColor(os[j].w.liquid.material, startColor(ph), 380);
          os[j].w.liquid.material.opacity = 0.92;
          setAmount(os[j], BASE_DROPS);
        }
        await v.moveTo(pip, [CX, 2.8, CZ], 380);
        v.discard(pip);
        await back;
        await v.wait(250);
        st.prepared[ph] = true;
      }

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          rememberSel(s);
          var add = s.phase ? PH[s.phase].add : null;
          Object.keys(bottles).forEach(function (id) {
            bottles[id].ring.visible = add === id;
          });
          if (s.phase) {
            rowRing.position.z = plate.wells[PROW[s.phase]][0].position[2];
            rowRing.position.x = 0;
            rowRing.visible = true;
          } else rowRing.visible = false;
          if (s.phase && s.drops != null) {
            var p = wellObjs[keyOf(s.phase, s.drops)].w.position;
            targetRing.position.x = p[0];
            targetRing.position.z = p[2];
            targetRing.visible = true;
          } else targetRing.visible = false;
          v.render();
        },
        run: async function (sel) {
          var ph = sel.phase;
          var n = Number(sel.drops);
          var o = wellObjs[keyOf(ph, n)];
          var wp = o.w.position;
          try {
            await v.flyHome(350);
            if (!st.prepared[ph]) await prepareAnimated(ph);
            else if (st.done[keyOf(ph, n)]) {
              setCounter(counter, "🔁 새로 준비한 홈으로 다시");
              setAmount(o, BASE_DROPS);
              await v.fadeColor(o.w.liquid.material, startColor(ph), 400);
            }
            await v.focus([wp[0], TOP, wp[2]], 0.55, 550);
            if (n === 0) {
              setCounter(counter, "0방울: 아무것도 넣지 않아요(비교용)");
              await v.wait(1200);
            } else {
              var b = bottles[PH[ph].add].obj;
              var home = b.userData.home;
              var H = b.userData.height;
              await v.moveTo(b, [home[0], 1.4, home[2]], 160);
              await v.moveTo(b, [wp[0], TOP + 0.7 + H, wp[2]], 380);
              await v.tween(220, function (t) {
                b.rotation.x = Math.PI * t;
              });
              var tm = dropTiming(n);
              for (var k = 1; k <= n; k++) {
                setCounter(counter, "💧 " + PH[ph].add + " " + k + "/" + n + "방울" + (tm.every > 1 ? " (⏩ 빨리 감기)" : ""));
                if (k % tm.every === 0 || k === 1) await fall(C.color.clear, [wp[0], TOP + 0.65, wp[2]], [wp[0], TOP + 0.06, wp[2]], tm.ms);
                else await v.wait(tm.ms);
                o.w.liquid.material.color.set(colorAt(ph, k));
                setAmount(o, BASE_DROPS + k);
              }
              await v.tween(200, function (t) {
                b.rotation.x = Math.PI * (1 - t);
              });
              var backHome = v.moveTo(b, [home[0], 1.4, home[2]], 360).then(function () {
                return v.moveTo(b, home, 160);
              });
              await v.fadeColor(o.w.liquid.material, colorAt(ph, n), 600);
              await backHome;
            }
            st.done[keyOf(ph, n)] = true;
          } finally {
            setCounter(counter, "");
          }
        },
        showInstant: function (sel) {
          var ph = sel.phase;
          var n = Number(sel.drops);
          if (!st.prepared[ph]) prepareInstant(ph);
          setLiquid(wellObjs[keyOf(ph, n)], colorAt(ph, n));
          setAmount(wellObjs[keyOf(ph, n)], BASE_DROPS + n);
          st.done[keyOf(ph, n)] = true;
          v.render();
        },
        clear: function () {
          Object.keys(wellObjs).forEach(function (k) {
            emptyWell(wellObjs[k]);
          });
          st = plateState();
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          if (counter.parentNode) counter.parentNode.removeChild(counter);
          v.dispose();
        },
      };
    });
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  var nav; // 아래에서 만든다(표의 '다시 실험' 버튼이 쓴다)
  function drawResults() {
    var flagged = 0;
    S.TableChart.renderMatrix($("result-table"), {
      caption: "묽은 염산과 묽은 수산화 나트륨 용액을 섞을 때 붉은 양배추 용액의 색깔 변화 (내 기록)",
      rowHeader: "넣은 방울 수 →",
      rows: PHASE_IDS.map(function (ph) {
        return { id: ph, label: PH[ph].name + ": " + PH[ph].start + "에 " + PH[ph].add + "을 넣음" };
      }),
      cols: C.drops.map(function (d) {
        return { id: d, label: dropLabel(d) };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        var rec = records.get(keyOf(r.id, c.id));
        if (!rec) return null;
        var must = PH[r.id].must[c.id];
        var wrong = must && rec.colorFamily !== must;
        if (wrong) flagged++;
        return {
          text: shortFamily(rec.colorFamily),
          color: colorAt(r.id, c.id),
          flag: wrong ? "다시 실험해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ phase: r.id, drops: String(c.id) });
          },
        };
      },
    });
    var wrap = $("result-table");
    wrap.appendChild(el("p", { class: "trend-note", text: "➡️ 표의 왼쪽에서 오른쪽으로 갈수록 넣은 방울 수가 많아져요. 두 줄에서 색이 어떤 순서로 달라졌는지 살펴보세요." }));
    var note = $("recheck-note");
    note.hidden = flagged === 0;
    note.textContent = flagged ? "🔎 관찰을 다시 확인해 보면 좋은 칸이 " + flagged + "개 있어요. 🔁 버튼을 누르면 그 실험을 다시 해 볼 수 있어요." : "";

    var card = $("chart-card");
    card.textContent = "";
    card.appendChild(el("h3", { class: "sub-h first", text: "🌈 붉은 양배추 용액의 색깔 변화표와 비교하기" }));
    card.appendChild(S.rich("내 실험 결과를 아래 **색깔 변화표**와 비교해 보세요. 방울 수가 늘어날수록 색이 변화표의 어느 쪽에서 어느 쪽으로 옮겨 갔나요?", "p"));
    card.appendChild(chartNode());
    var mini = el("div", { class: "trend-rows" });
    PHASE_IDS.forEach(function (ph) {
      var chips = el("div", { class: "trend-chips", role: "list", "aria-label": PH[ph].name + "에서 방울 수에 따른 색(모형)" });
      C.drops.forEach(function (d, i) {
        var chip = el("span", { class: "trend-chip", "aria-hidden": "true" });
        chip.style.background = colorAt(ph, d);
        var rec = records.get(keyOf(ph, d));
        chips.appendChild(
          el("span", { class: "trend-item", role: "listitem", "aria-label": dropLabel(d) + ": " + (rec ? shortFamily(rec.colorFamily) : "기록 없음") }, [chip, el("small", { text: String(d) })])
        );
        if (i < C.drops.length - 1) chips.appendChild(el("span", { class: "trend-arrow", "aria-hidden": "true", text: "→" }));
      });
      mini.appendChild(el("div", { class: "trend-row" }, [el("span", { class: "trend-name", text: PH[ph].name + " (" + PH[ph].add + " 방울 수)" }), chips]));
    });
    card.appendChild(mini);
  }

  /* ───────── 4. 정리하기 — 마치기(결과 저장) ───────── */
  // detail(2026-09-25 간략화 뒤, questionSet: 2): predict{q2}, records, analysis{inferA,q1}, conclusion, curiosity.
  //   뺀 문항(predict.q1, analysis.readA·q2·q3, extension)의 키는 아예 만들지 않는다 — 관리자 "학생 응답" 매핑이
  //   questionSet으로 간략화 전·후 기록을 가른다(src/data/app-responses/sci-6-1-1-4.ts). detail.qa는 넣지 않는다(spec §1.3).
  function buildDetail() {
    var q = quiz.result();
    var analysis = {};
    C.quiz.forEach(function (qq) {
      var r = q[qq.id];
      analysis[qq.id] = {
        choice: r.choice.map(function (id) {
          var o = qq.options.filter(function (x) {
            return x.id === id;
          })[0];
          return o ? o.label : id;
        }),
        correct: r.correct,
        tries: r.tries,
      };
    });
    return {
      questionSet: 2,
      predict: predict.values(),
      records: records.list().map(function (r) {
        return { phase: r.phase, drops: r.drops, colorFamily: r.colorFamily, recordedAt: r.recordedAt };
      }),
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosity.value(),
    };
  }

  lesson.finish({
    stage: "conclude", // 마치기 카드가 정리하기 안에 있다(공통 틀 기본값은 "curiosity" 단계)
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    // '더 탐구하고 싶은 점'이 비었는지·무의미한지는 공통 틀(lesson.js)이 마칠 때 본다(필수, 느슨 판정)
    canFinish: function () {
      return conclude.isDone() || "결론을 먼저 적고 제출해 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var correct = C.quiz.filter(function (qq) {
        return q[qq.id].correct;
      }).length;
      return ["기록한 실험: " + records.count() + "칸", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return predict.isDone() || "예상하기 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "실험 A(6칸)와 실험 B(6칸)를 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)";
      },
      conclude: function () {
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: quiz.isDone,
      conclude: function () {
        return conclude.isDone() && !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: activateExperiment,
      analyze: drawResults,
    },
  });
})();
