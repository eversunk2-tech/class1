/*
 * app.js — sci-6-1-2-5 "물체의 빠르기를 속력으로 비교해 보자!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(태엽 자동차 4대, 출발선, 줄자, 100 cm 결승선, 초시계)
 *   ② 관찰 카드(줄자 확대 그림·초시계 + 계산기 + 값 확인)
 *   ③ 교통수단 속력 계산 카드(활동해요2), 표·막대그래프, 퀴즈 연결 만 만든다.
 * 수치는 LessonConfig의 지도서 값만 쓴다(탐구 3·4의 예시 자료, 오차 없음). 자동차는 일정한 빠르기로 움직이는 모형이다.
 * 학생 입력은 모두 textContent/value로만 다룬다(innerHTML을 쓰지 않는다).
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

  /* ───────── 자료(지도서 값) ───────── */
  var CAR = {};
  C.cars.forEach(function (c) {
    CAR[c.id] = c;
  });
  var P1 = C.phase1;
  var P2 = C.phase2;
  function phaseOf(id) {
    return P1.cars.indexOf(id) >= 0 ? 1 : 2;
  }
  // 오차 없는 참값: 이동 거리(cm), 걸린 시간(s)
  function truth(id) {
    return phaseOf(id) === 1 ? { distance: P1.distance[id], time: P1.time } : { distance: P2.distance, time: P2.time[id] };
  }
  function round1(x) {
    return Math.round(x * 10 + 1e-9) / 10;
  }
  function speedOf(id) {
    var t = truth(id);
    return round1(t.distance / t.time); // 반올림하여 소수 첫째 자리까지
  }
  // 지도서 값과 어긋나면 개발 중에 바로 알 수 있게
  C.cars.forEach(function (c) {
    if (speedOf(c.id) !== C.expectedSpeeds[c.id]) console.error("[sci-6-1-2-5] 속력 값이 지도서와 다릅니다:", c.id, speedOf(c.id));
  });
  var EXTRA_S = 0.6; // 2단계: 결승선을 지난 뒤 조금 더 달리는 시간(초) — 초시계는 결승선에서 멈춘다
  function finalFront(id) {
    var t = truth(id);
    return phaseOf(id) === 1 ? t.distance : t.distance + (t.distance / t.time) * EXTRA_S;
  }
  function fmtNum(x) {
    // 계산기 표시(최대 10자리 유효숫자, 뒤의 0은 뺀다)
    if (!isFinite(x)) return "오류";
    var s = String(Number(x.toPrecision(10)));
    return s;
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.car;
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
  (function refs() {
    var box = $("curiosity-refs");
    box.appendChild(el("h3", { class: "sub-h first", text: "📚 더 알아보기" }));
    box.appendChild(
      el(
        "ul",
        { class: "refs-list" },
        C.curiosity.refs.map(function (t) {
          return el("li", { text: t });
        })
      )
    );
  })();

  /* ───────── 계산기(실험관찰 28쪽 계산기 애플리케이션을 본뜬 작은 화면) ───────── */
  // opts: { label, onResult({ a, b, raw, rounded }) }  → { node, setExpr(a, b), clear() }
  function makeCalc(opts) {
    var a = "";
    var op = false;
    var b = "";
    var shown = null; // = 뒤 결과
    var exprEl = el("div", { class: "calc-expr", "aria-hidden": "true" });
    var outEl = el("div", { class: "calc-out", "aria-hidden": "true" });
    var live = el("p", { class: "sr-only", "aria-live": "polite" });
    var screen = el("div", { class: "calc-screen" }, [exprEl, outEl]);
    function draw() {
      exprEl.textContent = (a || (op ? "" : "0")) + (op ? " ÷ " : "") + b;
      outEl.textContent = shown == null ? "" : "= " + shown;
      live.textContent = "계산기: " + (a || "0") + (op ? " 나누기 " + (b || "") : "") + (shown == null ? "" : ", 결과 " + shown);
    }
    function press(k) {
      if (shown != null && (/[0-9.]/.test(k) || k === "÷")) {
        // 결과가 나온 뒤에 숫자를 누르면 새 계산
        if (k === "÷") {
          a = String(shown);
          b = "";
          op = true;
          shown = null;
          draw();
          return;
        }
        a = "";
        b = "";
        op = false;
        shown = null;
      }
      if (/[0-9]/.test(k) || k === ".") {
        var cur = op ? b : a;
        if (k === "." && cur.indexOf(".") >= 0) return;
        if (cur.replace(".", "").length >= 8) return;
        if (k === "." && cur === "") cur = "0";
        cur = cur === "0" && k !== "." ? k : cur + k;
        if (op) b = cur;
        else a = cur;
      } else if (k === "÷") {
        if (!a) a = "0";
        op = true;
      } else if (k === "C") {
        a = "";
        b = "";
        op = false;
        shown = null;
      } else if (k === "⌫") {
        if (shown != null) shown = null;
        else if (op && b) b = b.slice(0, -1);
        else if (op) op = false;
        else a = a.slice(0, -1);
      } else if (k === "=") {
        if (!op || a === "" || b === "") {
          shown = null;
          draw();
          if (opts.onIncomplete) opts.onIncomplete();
          return;
        }
        var na = Number(a);
        var nb = Number(b);
        if (nb === 0) {
          shown = "0으로 나눌 수 없어요";
          draw();
          return;
        }
        var raw = na / nb;
        shown = fmtNum(raw);
        draw();
        if (opts.onResult) opts.onResult({ a: na, b: nb, raw: raw, rounded: round1(raw) });
        return;
      }
      draw();
    }
    var keys = ["7", "8", "9", "C", "4", "5", "6", "÷", "1", "2", "3", "⌫", "0", ".", "="];
    var names = { C: "모두 지우기 C", "÷": "나누기", "⌫": "한 글자 지우기", "=": "계산하기 =", ".": "소수점" };
    var pad = el(
      "div",
      { class: "calc-keys", role: "group", "aria-label": "계산기 단추" },
      keys.map(function (k) {
        return el("button", {
          type: "button",
          class: "calc-key" + (k === "=" ? " is-eq" : k === "÷" ? " is-op" : k === "C" || k === "⌫" ? " is-fn" : ""),
          "aria-label": names[k] || k,
          text: k,
          onclick: function () {
            press(k);
          },
        });
      })
    );
    var node = el("div", { class: "calc", role: "group", "aria-label": opts.label || "계산기" }, [el("div", { class: "calc-title", text: "🧮 계산기" }), screen, pad, live]);
    draw();
    return {
      node: node,
      setExpr: function (x, y) {
        a = String(x);
        b = String(y);
        op = true;
        shown = null;
        draw();
      },
      clear: function () {
        press("C");
      },
    };
  }

  /* ───────── 줄자 확대 그림(관찰 카드) ───────── */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function zoomRuler(id) {
    var d = truth(id).distance;
    var lo = d - 13; // 앞부분이 가운데보다 조금 오른쪽에 오게(10 cm 눈금이 두 개 이상 보인다)
    var hi = d + 9;
    var W = 620;
    var PX = W / (hi - lo);
    function x(cm) {
      return (cm - lo) * PX;
    }
    var s = svg("svg", { viewBox: "0 0 " + W + " 178", class: "zoom-svg", role: "img", "aria-label": "줄자 확대 그림: " + CAR[id].name + "의 앞부분은 " + d + " cm 눈금에 있어요." });
    // 자동차(앞부분까지)
    s.appendChild(svg("rect", { x: 0, y: 28, width: x(d), height: 56, rx: 8, fill: CAR[id].color, stroke: "#1f2733", "stroke-width": 2 }));
    s.appendChild(svg("text", { x: Math.max(70, x(d) - 90), y: 62, "text-anchor": "middle", class: "zoom-car-text", fill: S.TableChart.textOn(CAR[id].color) }, CAR[id].short + " 자동차"));
    // 줄자
    s.appendChild(svg("rect", { x: 0, y: 100, width: W, height: 70, fill: "#f7d44c", stroke: "#9a7a12", "stroke-width": 1.5 }));
    for (var cm = lo; cm <= hi; cm++) {
      var big = cm % 10 === 0;
      var mid = cm % 5 === 0;
      var h = big ? 34 : mid ? 24 : 14;
      s.appendChild(svg("line", { x1: x(cm), x2: x(cm), y1: 100, y2: 100 + h, stroke: "#1a1a1a", "stroke-width": big ? 3 : mid ? 2 : 1.4 }));
      if (big) s.appendChild(svg("text", { x: x(cm), y: 160, "text-anchor": "middle", class: "zoom-num" }, String(cm)));
    }
    // 앞부분 표시선
    s.appendChild(svg("line", { x1: x(d), x2: x(d), y1: 22, y2: 140, stroke: "#c2185b", "stroke-width": 3, "stroke-dasharray": "7 5" }));
    s.appendChild(svg("text", { x: x(d), y: 18, "text-anchor": "middle", class: "zoom-front" }, "▼ 앞부분"));
    return el("figure", { class: "zoom" }, [s, el("figcaption", { class: "ss-help", text: "🔍 줄자 확대(모형) — 긴 눈금 10 cm마다 숫자, 중간 눈금 5 cm, 작은 눈금 한 칸 1 cm" })]);
  }
  function stopwatchFace(sec, caption) {
    return el("div", { class: "sw-face" }, [
      el("div", { class: "sw-face-digits", "aria-label": "초시계 " + sec.toFixed(1) + "초" }, [el("span", { text: "⏱ " }), el("strong", { text: sec.toFixed(1) }), el("span", { text: " 초" })]),
      el("p", { class: "ss-help", text: caption }),
    ]);
  }

  /* ───────── 관찰·기록 카드 ───────── */
  function observeCard(sel) {
    var id = sel.car;
    var car = CAR[id];
    var t = truth(id);
    var sp = speedOf(id);
    var ph = phaseOf(id);
    var measureId = ph === 1 ? "distance" : "time";
    var measureVal = ph === 1 ? t.distance : t.time;
    var body = el("div", { class: "obs-body" });
    if (ph === 1) {
      body.appendChild(zoomRuler(id));
      body.appendChild(el("p", { class: "fixed-line", text: "⏱ 걸린 시간: 5초 (1단계에서 같게 한 조건)" }));
    } else {
      body.appendChild(stopwatchFace(t.time, "🏁 자동차 앞부분이 100 cm 결승선에 닿은 순간 멈춘 초시계예요."));
      body.appendChild(el("p", { class: "fixed-line", text: "📏 이동 거리: 100 cm (2단계에서 같게 한 조건)" }));
    }
    var msg = el("p", { class: "obs-msg", "aria-live": "polite" });
    var calc = makeCalc({
      label: car.name + " 속력 계산기",
      onIncomplete: function () {
        msg.textContent = "‘이동 거리 ÷ 걸린 시간’ 식을 끝까지 누른 뒤 = 단추를 눌러요.";
      },
      onResult: function (r) {
        if (Math.abs(r.a - t.distance) < 1e-9 && Math.abs(r.b - t.time) < 1e-9) {
          var inp = document.getElementById("ss-num-speed");
          if (inp) {
            inp.value = r.rounded.toFixed(1);
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          }
          msg.textContent =
            "반올림하여 소수 첫째 자리까지 나타내면 " + r.rounded.toFixed(1) + " cm/s예요. 속력 칸에 넣었어요. ‘📝 기록하기’를 눌러요.";
        } else if (Math.abs(r.a - t.time) < 1e-9 && Math.abs(r.b - t.distance) < 1e-9) {
          msg.textContent = "나누는 순서를 확인해 보세요. 속력은 ‘이동 거리 ÷ 걸린 시간’으로 구해요.";
        } else {
          msg.textContent = "식에 넣은 이동 거리(cm)와 걸린 시간(초)이 이 자동차의 값인지 다시 확인해 보세요.";
        }
      },
    });
    body.appendChild(calc.node);
    body.appendChild(msg);

    // 입력칸은 공통 틀이 만든 뒤에 연결한다(값 확인 → 계산기 식 채우기)
    setTimeout(function () {
      var mInp = document.getElementById("ss-num-" + measureId);
      var sInp = document.getElementById("ss-num-speed");
      if (!mInp || !sInp) return;
      // 순서: 읽은 값 입력 → 계산기 → 속력 입력 → 기록하기 (공통 틀이 만든 입력칸 사이에 계산기를 옮겨 넣는다)
      var grid = mInp.closest(".ss-num-grid");
      var sField = sInp.closest("label");
      if (grid && sField) {
        var calcBox = el("div", { class: "calc-box" }, [calc.node, msg]);
        grid.parentNode.insertBefore(calcBox, grid.nextSibling);
        var sGrid = el("div", { class: "ss-num-grid" }, [sField]);
        calcBox.parentNode.insertBefore(sGrid, calcBox.nextSibling);
      }
      mInp.addEventListener("input", function () {
        var v = mInp.value === "" ? NaN : Number(mInp.value);
        if (!isFinite(v)) {
          msg.textContent = "";
          return;
        }
        if (Math.abs(v - measureVal) < 1e-9) {
          calc.setExpr(t.distance, t.time);
          msg.textContent = "✅ 바르게 읽었어요. 계산기에 ‘" + t.distance + " ÷ " + t.time + "’ 식이 들어갔어요. = 단추를 눌러 속력을 구해요.";
        } else {
          msg.textContent =
            ph === 1
              ? "🔎 확대 그림에서 자동차 앞부분이 가리키는 눈금을 다시 읽어 보세요. (작은 눈금 한 칸은 1 cm)"
              : "🔎 초시계에 멈춘 숫자를 다시 읽어 보세요.";
        }
      });
      sInp.addEventListener("change", function () {
        var v = sInp.value === "" ? NaN : Number(sInp.value);
        if (isFinite(v) && Math.abs(v - sp) > 1e-9)
          msg.textContent = "속력 칸의 값을 다시 확인해 보세요. 계산기로 구한 값을 반올림하여 소수 첫째 자리까지 적어요.";
      });
    }, 0);

    return {
      question:
        ph === 1
          ? "📏 " + car.name + "가 5초 동안 이동한 거리를 줄자에서 읽어 적고, 계산기로 속력을 구해 기록해요."
          : "⏱ " + car.name + "가 100 cm를 이동하는 데 걸린 시간을 초시계에서 읽어 적고, 계산기로 속력을 구해 기록해요.",
      body: body,
      type: "numeric",
      fields: [
        ph === 1
          ? { id: "distance", label: "이동 거리", unit: "cm", step: 1, min: t.distance, max: t.distance }
          : { id: "time", label: "걸린 시간", unit: "초", step: 0.1, min: t.time, max: t.time },
        { id: "speed", label: "속력 (소수 첫째 자리)", unit: "cm/s", step: 0.1, min: sp, max: sp },
      ],
    };
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div");
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    box.appendChild(el("p", { class: "intro-sub", text: "🧮 계산기 사용법 (『실험관찰』 28쪽)" }));
    box.appendChild(
      el(
        "ol",
        { class: "calc-steps" },
        C.intro.calcSteps.map(function (t) {
          return el("li", { text: t.replace(/^[①②③④]\s*/, "") });
        })
      )
    );
    box.appendChild(S.rich("📂 " + C.intro.dataNote, "p"));
    return box;
  }
  function carChip(id) {
    var i = el("span", { class: "car-chip", "aria-hidden": "true" });
    i.style.setProperty("--c", CAR[id].color);
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
    clearLabel: "🧽 자동차 출발선으로",
    clearMessage: "자동차를 모두 출발선으로 옮겼어요. 기록은 그대로 남아 있어요.",
    runTitle: "출발하기",
    factors: [
      {
        id: "car",
        title: "자동차 고르기",
        short: "자동차",
        options: C.cars.map(function (c) {
          return {
            id: c.id,
            label: c.name,
            icon: function () {
              return carChip(c.id);
            },
          };
        }),
        note: function (sel) {
          if (!sel.car) return null;
          return phaseOf(sel.car) === 1
            ? "1단계 · 걸린 시간을 5초로 같게 하고, 이동 거리를 재요."
            : "2단계 · 이동 거리를 100 cm로 같게 하고, 걸린 시간을 재요.";
        },
      },
    ],
    phases: [
      {
        id: "P1",
        name: P1.name,
        title: P1.title,
        lead: P1.lead,
        cells: P1.cars.map(function (id) {
          return { car: id };
        }),
      },
      {
        id: "P2",
        name: P2.name,
        title: P2.title,
        lead: P2.lead,
        cells: P2.cars.map(function (id) {
          return { car: id };
        }),
      },
    ],
    doneLead: "네 자동차의 속력을 모두 기록했어요. 다시 해 보고 싶은 자동차는 자유롭게 다시 달려 보세요. 다 했으면 ‘다음 단계’로 가요.",
    cellKey: function (sel) {
      return sel.car;
    },
    runLabel: function (sel) {
      return phaseOf(sel.car) === 1 ? "▶ " + CAR[sel.car].name + " 출발! (5초 동안)" : "▶ " + CAR[sel.car].name + " 출발! (100 cm 결승선까지)";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 자동차를 눌러 고를 수도 있어요",
      tip2D: "2D 화면(위에서 본 모형)이에요. 자동차 이름을 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, v) {
      var t = truth(sel.car);
      return {
        car: sel.car,
        distance: phaseOf(sel.car) === 1 ? v.distance : t.distance,
        time: phaseOf(sel.car) === 1 ? t.time : v.time,
        speed: v.speed,
      };
    },
    describeRecord: function (r) {
      return CAR[r.car].name + " " + r.distance + " cm ÷ " + r.time + " s = " + Number(r.speed).toFixed(1) + " cm/s";
    },
    miniTable: {
      title: "기록한 자동차 한눈에 보기",
      rows: [{ id: "rec", label: "기록" }],
      cols: C.cars.map(function (c) {
        return { id: c.id, label: c.short };
      }),
      sel: function (r, c) {
        return { car: c.id };
      },
    },
    onChange: lesson.refresh,
  });

  /* ── 현재 고른 자동차를 새로고침 뒤에도 되살린다(앱 전용) ── */
  function rememberSel(s) {
    if (s && s.car) store.set("curSel", s.car);
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (!saved || !CAR[saved]) return;
    if (phaseOf(saved) === 2 && !exp.phaseDone("P1")) return; // 잠긴 단계는 되살리지 않는다
    exp.select({ car: saved });
  }

  /* ── 초시계·상태 표시(3D·2D 공통) ── */
  function makeHud() {
    var digits = el("strong", { class: "hud-digits", text: "0.0" });
    var status = el("span", { class: "hud-status" });
    var node = el("div", { class: "sw-hud", "aria-live": "polite", hidden: true }, [el("span", { class: "hud-sw" }, [el("span", { text: "⏱ ", "aria-hidden": "true" }), digits, el("span", { text: " 초" })]), status]);
    return {
      node: node,
      show: function (sec, text) {
        node.hidden = false;
        // 실제 초시계처럼 버림으로 표시한다(4.15초에 "4.2"가 먼저 뜨지 않게). 멈춘 값(stopAt)은 정확히 그 값.
        digits.textContent = (Math.floor(sec * 10 + 1e-6) / 10).toFixed(1);
        status.textContent = text || "";
        status.hidden = !text;
      },
      hide: function () {
        node.hidden = true;
      },
    };
  }
  function runPlan(id) {
    var t = truth(id);
    var v = t.distance / t.time; // cm/s (모형: 일정한 빠르기)
    var total = phaseOf(id) === 1 ? t.time : t.time + EXTRA_S;
    return { t: t, v: v, total: total, stopAt: t.time };
  }
  function doneText(id) {
    return phaseOf(id) === 1 ? "📸 5초가 된 순간의 모습이에요. 앞부분의 눈금을 읽어요." : "🏁 앞부분이 결승선에 닿은 순간 초시계가 멈췄어요.";
  }

  /* ── 2D 대체 화면: 위에서 본 경주로 ── */
  function build2D(root, ctx) {
    var hud = makeHud();
    var max = C.trackMaxCm;
    var lanes = {};
    var list = el("div", { class: "t2-lanes", role: "group", "aria-label": "경주로(2D 모형)" });
    C.cars.forEach(function (c) {
      var ph = phaseOf(c.id);
      var carEl = el("div", { class: "t2-car", "aria-hidden": "true" }, [el("span", { class: "t2-key" }), el("span", { class: "t2-car-text", text: c.short })]);
      carEl.style.setProperty("--c", c.color);
      var scale = el("div", { class: "t2-scale" });
      for (var cm = 0; cm <= max; cm += 10) {
        var tk = el("span", { class: "t2-tick" + (cm % 20 ? " is-odd" : "") }, [el("small", { text: String(cm) })]);
        tk.style.left = (cm / max) * 100 + "%";
        scale.appendChild(tk);
      }
      if (ph === 2) {
        var fin = el("span", { class: "t2-finish", title: "결승선 100 cm" });
        fin.style.left = (P2.distance / max) * 100 + "%";
        scale.appendChild(fin);
      }
      scale.appendChild(carEl);
      var btn = el(
        "button",
        {
          type: "button",
          class: "t2-name",
          onclick: function () {
            ctx.onPick({ car: c.id });
          },
        },
        [carChip(c.id), el("span", { text: c.name }), el("small", { class: "t2-phase", text: ph === 1 ? "1단계 · 5초" : "2단계 · 100 cm" })]
      );
      var lane = el("div", { class: "t2-lane" }, [btn, el("div", { class: "t2-track" }, [el("span", { class: "t2-start", "aria-hidden": "true" }), scale])]);
      lanes[c.id] = { lane: lane, car: carEl, btn: btn };
      list.appendChild(lane);
      setFront(c.id, 0);
    });
    function setFront(id, cm) {
      lanes[id].car.style.left = (cm / max) * 100 + "%";
      lanes[id].car.setAttribute("data-cm", String(Math.round(cm)));
    }
    root.appendChild(
      el("div", { class: "t2-wrap" }, [
        hud.node,
        list,
        el("p", { class: "t2-caption", text: "출발선(0 cm)과 줄자(cm) · 보라색 선: 100 cm 결승선(2단계) — 위에서 본 모형" }),
      ])
    );
    var runToken = 0;
    var lastRun = null;
    return {
      highlight: function (s) {
        rememberSel(s);
        if (s.car !== lastRun) hud.hide(); // 다른 자동차를 고르면 지난 초시계 값을 치운다
        Object.keys(lanes).forEach(function (id) {
          lanes[id].lane.classList.toggle("is-sel", s.car === id);
          lanes[id].btn.setAttribute("aria-pressed", String(s.car === id));
        });
      },
      run: async function (sel) {
        var id = sel.car;
        var plan = runPlan(id);
        var my = ++runToken;
        lastRun = id;
        setFront(id, 0);
        lanes[id].car.classList.add("is-running");
        hud.show(0, "준비… 출발!");
        await sleep(500);
        var t0 = performance.now();
        await new Promise(function (resolve) {
          (function tick() {
            if (my !== runToken) return resolve();
            var el2 = Math.min(plan.total, (performance.now() - t0) / 1000);
            if (document.hidden) el2 = plan.total;
            setFront(id, plan.v * el2);
            hud.show(Math.min(el2, plan.stopAt), el2 >= plan.stopAt && phaseOf(id) === 2 ? "🏁 결승선!" : "달리는 중…");
            if (el2 >= plan.total) return resolve();
            setTimeout(tick, 30);
          })();
        });
        lanes[id].car.classList.remove("is-running");
        setFront(id, finalFront(id));
        hud.show(plan.stopAt, doneText(id));
      },
      showInstant: function (sel) {
        setFront(sel.car, finalFront(sel.car));
      },
      clear: function () {
        runToken++;
        Object.keys(lanes).forEach(function (id) {
          lanes[id].car.classList.remove("is-running");
          setFront(id, 0);
        });
        hud.hide();
      },
      resetView: function () {},
      dispose: function () {
        runToken++;
      },
    };
  }

  /* ── 3D 화면 ── */
  var U = 0.1; // 1 cm = 0.1 (3D 단위)
  var X0 = -8; // 출발선(0 cm)의 x
  var LANE_Z = { red: -2.25, blue: -0.75, green: 0.75, yellow: 2.25 };
  var CAR_LEN = 1.3;
  function X(cm) {
    return X0 + cm * U;
  }
  function tapeTexture(T) {
    var max = C.trackMaxCm;
    var c = document.createElement("canvas");
    c.width = 4096;
    c.height = 80;
    var g = c.getContext("2d");
    var px = c.width / max;
    g.fillStyle = "#f7d44c";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#1a1a1a";
    g.font = "700 34px system-ui, -apple-system, sans-serif";
    g.textBaseline = "alphabetic";
    for (var cm = 0; cm <= max; cm++) {
      var x = Math.min(c.width - 2, Math.max(1, cm * px));
      var h = cm % 10 === 0 ? 40 : cm % 5 === 0 ? 26 : 14;
      g.fillRect(x - (cm % 10 === 0 ? 1.5 : 1), 0, cm % 10 === 0 ? 3 : 2, h);
      if (cm % 10 === 0) {
        g.textAlign = cm === 0 ? "left" : cm === max ? "right" : "center";
        g.fillText(String(cm), cm === 0 ? 4 : cm === max ? c.width - 4 : x, 74);
      }
    }
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 19.2, depth: 7.6, center: [-0.4, 0, 0.3] },
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var hud = makeHud();
      container.appendChild(hud.node);
      var max = C.trackMaxCm;
      var trackLen = max * U;

      var floor = M.table(22, 9.5, 0xd9c7a3);
      floor.position.x = -0.4;
      floor.position.z = 0.3;
      v.root.add(floor);
      v.onThemeChange(function (dark) {
        floor.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      // 경주로(차선) + 줄자
      var tex = tapeTexture(T);
      var laneMeshes = {};
      C.cars.forEach(function (c) {
        var z = LANE_Z[c.id];
        var lane = new T.Mesh(new T.BoxGeometry(trackLen + 2.6, 0.02, 1.25), M.material(0xeef1f5, { roughness: 0.9 }));
        lane.position.set(X0 + trackLen / 2 - 0.6, 0.01, z - 0.1);
        v.root.add(lane);
        v.pickable(lane, { car: c.id });
        laneMeshes[c.id] = lane;
        var tape = new T.Mesh(new T.PlaneGeometry(trackLen, trackLen / 51.2), new T.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
        tape.rotation.x = -Math.PI / 2;
        tape.position.set(X0 + trackLen / 2, 0.03, z + 0.52);
        v.root.add(tape);
      });
      // 출발선(색 테이프)
      var startLine = new T.Mesh(new T.BoxGeometry(0.12, 0.03, 6.1), M.material(0x2a2f38));
      startLine.position.set(X0, 0.03, 0.2);
      v.root.add(startLine);
      var startL = M.label("출발선 (0 cm)", { height: 0.42 });
      startL.position.set(X0, 0.35, 3.55);
      v.root.add(startL);
      // 100 cm 결승선(2단계 차선만)
      var finish = new T.Mesh(new T.BoxGeometry(0.12, 0.03, 2.9), M.material(0x7b3fa0));
      finish.position.set(X(P2.distance), 0.035, (LANE_Z.green + LANE_Z.yellow) / 2 + 0.05);
      v.root.add(finish);
      var finL = M.label("결승선 100 cm (2단계)", { height: 0.42, border: "#7b3fa0" });
      finL.position.set(X(P2.distance), 0.35, 3.55);
      v.root.add(finL);
      // 단계 이름(차선 끝)
      [
        { text: "1단계: 5초 동안", z: (LANE_Z.red + LANE_Z.blue) / 2 },
        { text: "2단계: 100 cm까지", z: (LANE_Z.green + LANE_Z.yellow) / 2 },
      ].forEach(function (g) {
        var l = M.label(g.text, { height: 0.42, bg: "rgba(255,255,255,0.85)", color: "#374151" });
        l.position.set(X(max) - 0.9, 0.6, g.z);
        v.root.add(l);
      });

      // 태엽 자동차(상자 모형) — 앞부분이 +x
      var cars = {};
      C.cars.forEach(function (c) {
        var g = new T.Group();
        var bodyM = M.material(c.color, { roughness: 0.45 });
        var body = new T.Mesh(new T.BoxGeometry(CAR_LEN, 0.36, 0.66), bodyM);
        body.position.y = 0.34;
        g.add(body);
        var cab = new T.Mesh(new T.BoxGeometry(0.6, 0.28, 0.56), M.material(0xdfe8f2, { roughness: 0.2 }));
        cab.position.set(-0.12, 0.66, 0);
        g.add(cab);
        var wheelGeo = new T.CylinderGeometry(0.16, 0.16, 0.1, 18);
        var wheelM = M.material(0x22262d);
        [
          [0.4, 0.37],
          [0.4, -0.37],
          [-0.4, 0.37],
          [-0.4, -0.37],
        ].forEach(function (p) {
          var w = new T.Mesh(wheelGeo, wheelM);
          w.rotation.x = Math.PI / 2;
          w.position.set(p[0], 0.16, p[1]);
          g.add(w);
        });
        // 태엽 열쇠(뒤쪽 위)
        var key = new T.Group();
        var shaft = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.28, 8), M.material(0xb8c0c8, { metalness: 0.6, roughness: 0.3 }));
        shaft.position.y = 0.14;
        key.add(shaft);
        var loop = new T.Mesh(new T.TorusGeometry(0.13, 0.035, 8, 20), M.material(0xb8c0c8, { metalness: 0.6, roughness: 0.3 }));
        loop.position.y = 0.36;
        key.add(loop);
        key.position.set(-0.45, 0.52, 0);
        g.add(key);
        var lbl = M.label(c.name, { height: 0.5, border: c.color });
        lbl.position.set(0, 1.3, 0);
        g.add(lbl);
        g.position.set(X(0) - CAR_LEN / 2, 0, LANE_Z[c.id] - 0.12);
        v.root.add(g);
        v.pickable(body, { car: c.id });
        v.pickable(cab, { car: c.id });
        cars[c.id] = { g: g, key: key };
      });
      function setFront(id, cm) {
        cars[id].g.position.x = X(cm) - CAR_LEN / 2;
      }
      function frontOf(id) {
        return (cars[id].g.position.x + CAR_LEN / 2 - X0) / U;
      }
      // 고른 차선 표시
      var selBox = new T.Mesh(new T.BoxGeometry(trackLen + 2.7, 0.015, 1.35), new T.MeshBasicMaterial({ color: 0xf2a93b, transparent: true, opacity: 0.35 }));
      selBox.position.y = 0.005;
      selBox.visible = false;
      v.root.add(selBox);
      // 앞부분 표시(마지막으로 달린 자동차)
      var frontMark = M.label("▼ 앞부분", { height: 0.36, bg: "rgba(255,255,255,0.95)", color: "#c2185b", border: "#c2185b" });
      frontMark.visible = false;
      v.root.add(frontMark);
      function showFrontMark(id) {
        if (phaseOf(id) !== 1) {
          frontMark.visible = false;
          return;
        }
        frontMark.position.set(X(truth(id).distance), 0.42, LANE_Z[id] + 0.52);
        frontMark.visible = true;
      }

      var lastRun = null;
      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          rememberSel(s);
          if (s.car !== lastRun) {
            hud.hide(); // 다른 자동차를 고르면 지난 초시계 값과 앞부분 표시를 치운다
            frontMark.visible = false;
          }
          if (s.car) {
            selBox.position.set(laneMeshes[s.car].position.x, 0.005, laneMeshes[s.car].position.z);
            selBox.visible = true;
          } else selBox.visible = false;
          v.render();
        },
        run: async function (sel) {
          var id = sel.car;
          var plan = runPlan(id);
          var z = LANE_Z[id];
          frontMark.visible = false;
          lastRun = id;
          hud.show(0, "");
          try {
            await v.flyHome(350);
            if (frontOf(id) > 0.5) {
              hud.show(0, "자동차를 출발선에 놓아요");
              var from = frontOf(id);
              await v.tween(450, function (e) {
                setFront(id, from * (1 - e));
              });
            }
            setFront(id, 0);
            hud.show(0, "준비… 출발!");
            await v.wait(500);
            await v.tween(plan.total * 1000, function (e, raw) {
              var sec = raw * plan.total; // 일정한 빠르기(모형): 실제 시간에 비례해 이동
              setFront(id, plan.v * sec);
              cars[id].key.rotation.y = -sec * 5;
              hud.show(Math.min(sec, plan.stopAt), sec >= plan.stopAt && phaseOf(id) === 2 ? "🏁 결승선!" : "달리는 중…");
            });
            setFront(id, finalFront(id));
            hud.show(plan.stopAt, doneText(id));
            showFrontMark(id);
            var fx = phaseOf(id) === 1 ? X(plan.t.distance) : X(P2.distance);
            await v.focus([fx, 0, z + 0.3], 0.42, 700);
          } finally {
            v.render();
          }
        },
        showInstant: function (sel) {
          setFront(sel.car, finalFront(sel.car));
          v.render();
        },
        clear: function () {
          C.cars.forEach(function (c) {
            setFront(c.id, 0);
            cars[c.id].key.rotation.y = 0;
          });
          frontMark.visible = false;
          lastRun = null;
          hud.hide();
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          if (hud.node.parentNode) hud.node.parentNode.removeChild(hud.node);
          v.dispose();
        },
      };
    });
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  var T = S.TableChart;
  // 활동해요2: 교통수단 카드(주어진 자료 + 계산기)
  var trState = store.get("transport", {}) || {};
  function trDone(id) {
    return !!(trState[id] && trState[id].done);
  }
  function allTransportsDone() {
    return C.transports.every(function (t) {
      return trDone(t.id);
    });
  }
  function trSpeed(t) {
    return t.distanceKm / t.hours;
  }
  (function renderTransports() {
    var root = $("transport-root");
    root.textContent = "";
    C.transports.forEach(function (t) {
      var st = trState[t.id] || (trState[t.id] = { done: false, tries: 0, speed: null });
      if (st.done) st.speed = round1(trSpeed(t)); // 예전 판(허용 오차 채점)에 남은 값도 참값으로 바로잡는다
      var fb = el("p", { class: "tr-feedback", "aria-live": "polite" });
      var result = el("p", { class: "tr-result" });
      var card = el("div", { class: "ss-card tr-card" });
      function drawDone() {
        card.classList.toggle("is-done", st.done);
        result.hidden = !st.done;
        result.textContent = st.done ? "✅ " + t.name + "의 속력: " + t.distanceKm.toLocaleString("ko-KR") + " km ÷ " + t.hours + " h = " + fmtNum(st.speed) + " km/h" : "";
      }
      var calc = makeCalc({
        label: t.name + " 속력 계산기",
        onIncomplete: function () {
          fb.textContent = "‘이동 거리 ÷ 걸린 시간’ 식을 끝까지 누른 뒤 = 단추를 눌러요.";
          fb.className = "tr-feedback";
        },
        onResult: function (r) {
          st.tries = (st.tries || 0) + 1;
          // 카드의 이동 거리 ÷ 걸린 시간을 그대로 넣었을 때만 정답(허용 오차 없음, 답만 넣는 식 900 ÷ 1 등은 틀림)
          var ok = Math.abs(r.a - t.distanceKm) < 1e-9 && Math.abs(r.b - t.hours) < 1e-9;
          var keep = st.done ? " (앞에서 구한 속력은 그대로 있어요.)" : "";
          if (ok) {
            st.done = true;
            st.speed = round1(trSpeed(t)); // 저장·표시는 참값(반올림하여 소수 첫째 자리)
            fb.textContent = "⭕ 맞았어요! " + S.josa(t.name, "은", "는") + " 1시간 동안 " + fmtNum(st.speed) + " km를 이동한 것과 같은 빠르기예요.";
            fb.className = "tr-feedback is-correct";
          } else if (Math.abs(r.a - t.hours) < 1e-9 && Math.abs(r.b - t.distanceKm) < 1e-9) {
            fb.textContent = "❌ 나누는 순서를 확인해 보세요. 속력은 ‘이동 거리 ÷ 걸린 시간’으로 구해요." + keep;
            fb.className = "tr-feedback is-wrong";
          } else {
            fb.textContent = "❌ 카드에 적힌 이동 거리(km)와 걸린 시간(시간)을 그대로 식에 넣었는지 다시 확인해 보세요." + keep;
            fb.className = "tr-feedback is-wrong";
          }
          store.set("transport", trState);
          drawDone();
          drawTransportResults();
          drawTransportOrderAndCompare();
          lesson.refresh();
        },
      });
      card.appendChild(el("div", { class: "tr-head" }, [el("span", { class: "tr-icon", "aria-hidden": "true", text: t.icon }), el("strong", { class: "tr-name", text: t.name })]));
      card.appendChild(el("p", { class: "tr-says", text: "“" + t.says + "”" }));
      card.appendChild(
        el("p", { class: "tr-facts" }, [
          el("span", { text: "이동 거리 " + t.distanceKm.toLocaleString("ko-KR") + " km" }),
          el("span", { text: "걸린 시간 " + t.hours + "시간" }),
        ])
      );
      card.appendChild(calc.node);
      card.appendChild(fb);
      card.appendChild(result);
      drawDone();
      root.appendChild(card);
    });
  })();

  function drawTransportResults() {
    var rows = C.transports.map(function (t) {
      var st = trState[t.id] || {};
      return {
        name: t.icon + " " + t.name,
        dist: t.distanceKm.toLocaleString("ko-KR"),
        hours: t.hours,
        speed: st.done ? st.speed : null,
      };
    });
    T.renderTable($("transport-table"), {
      caption: "교통수단의 이동 거리, 걸린 시간, 속력",
      columns: [
        { id: "name", label: "교통수단" },
        { id: "dist", label: "이동 거리", unit: "km" },
        { id: "hours", label: "걸린 시간", unit: "시간" },
        { id: "speed", label: "속력", unit: "km/h" },
      ],
      rows: rows,
    });
    var chartBox = $("transport-chart");
    if (!C.transports.some(function (t) { return trDone(t.id); })) {
      chartBox.textContent = "";
      chartBox.appendChild(el("p", { class: "ss-help", text: "📊 교통수단의 속력을 구하면 여기에 막대그래프가 그려져요." }));
    } else {
      T.renderBar(
        chartBox,
        Object.assign({}, C.chart.barTransports, {
          digits: null,
          categories: C.transports.map(function (t) {
            return t.name;
          }),
          series: [
            {
              name: "속력",
              values: C.transports.map(function (t) {
                return trDone(t.id) ? trState[t.id].speed : null;
              }),
            },
          ],
        })
      );
    }
  }

  /* ───────── 빠른 순서대로 쓰기(실험관찰 28·29쪽, 지도서 222·223쪽) ───────── */
  // 학생이 보기 단추를 빠른 것부터 차례로 눌러 순서를 직접 쓴다. 정답 순서는 속력 참값으로 정렬해 만든다.
  var orderState = store.get("order", {}) || {};
  function makeOrder(root, cfg, items, isOpen) {
    // items: [{ id, label, chip? }], 정답: 속력이 큰 것부터
    var byId = {};
    items.forEach(function (it) {
      byId[it.id] = it;
    });
    var answer = items
      .slice()
      .sort(function (a, b) {
        return b.speed - a.speed;
      })
      .map(function (it) {
        return it.id;
      });
    var st = orderState[cfg.id];
    if (!st || !Array.isArray(st.seq)) st = orderState[cfg.id] = { seq: [], checked: false, correct: false, tries: 0 };
    st.seq = st.seq.filter(function (id, i) {
      return byId[id] && st.seq.indexOf(id) === i;
    });
    var focusKey = null;
    function save() {
      store.set("order", orderState);
    }
    function labelOf(id, withChip) {
      var it = byId[id];
      return el("span", { class: "ord-label" }, [withChip && it.chip ? it.chip() : null, el("span", { text: it.label })]);
    }
    function feedbackText() {
      if (!st.checked) return "";
      if (st.correct) return cfg.correct;
      if (st.seq.slice().reverse().join("|") === answer.join("|")) return C.order.wrongReversed;
      var i = 0;
      while (i < answer.length && st.seq[i] === answer[i]) i++;
      return C.order.wrongAt.replace("{n}", String(i + 1));
    }
    function change(fn, key) {
      fn();
      st.checked = false;
      focusKey = key;
      save();
      draw();
      lesson.refresh();
    }
    function draw() {
      root.textContent = "";
      root.classList.remove("is-correct", "is-wrong");
      root.appendChild(el("p", { class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "빠른 순서" }), cfg.prompt]));
      if (!isOpen()) {
        root.appendChild(el("p", { class: "ss-help", text: cfg.lock || "" }));
        return;
      }
      root.classList.toggle("is-correct", st.checked && st.correct);
      root.classList.toggle("is-wrong", st.checked && !st.correct);
      var seqList = el("ol", { class: "ord-seq", "aria-label": "내가 쓴 빠른 순서" });
      answer.forEach(function (_, i) {
        var id = st.seq[i];
        seqList.appendChild(
          el("li", { class: "ord-slot" + (id ? " is-filled" : "") }, [
            el("span", { class: "ord-rank", text: i === 0 ? "가장 빠름" : i === answer.length - 1 ? "가장 느림" : i + 1 + "번째" }),
            id ? labelOf(id, true) : el("span", { class: "ord-empty", text: "?" }),
          ])
        );
      });
      root.appendChild(seqList);
      var full = st.seq.length === answer.length;
      root.appendChild(el("p", { class: "ss-help", text: full ? "모두 놓았어요. ‘확인하기’를 눌러요." : "아래 단추를 빠른 것부터 차례대로 눌러요. (" + (st.seq.length + 1) + "번째 자리를 고를 차례)" }));
      var pool = el("div", { class: "ord-pool", role: "group", "aria-label": "놓을 보기" });
      cfg.pool.forEach(function (id) {
        var used = st.seq.indexOf(id) >= 0;
        var b = el("button", { type: "button", class: "ss-btn ord-pick", "data-k": "p-" + id }, [labelOf(id, true)]);
        b.disabled = used || full;
        b.addEventListener("click", function () {
          change(function () {
            st.seq.push(id);
          }, "next");
        });
        pool.appendChild(b);
      });
      root.appendChild(pool);
      var undo = el("button", { type: "button", class: "ss-btn ss-btn-ghost", "data-k": "undo", text: "↶ 하나 빼기" });
      undo.disabled = st.seq.length === 0;
      undo.addEventListener("click", function () {
        change(function () {
          st.seq.pop();
        }, "undo");
      });
      var reset = el("button", { type: "button", class: "ss-btn ss-btn-ghost", "data-k": "reset", text: "다시 놓기" });
      reset.disabled = st.seq.length === 0;
      reset.addEventListener("click", function () {
        change(function () {
          st.seq = [];
        }, "next");
      });
      var check = el("button", { type: "button", class: "ss-btn ss-btn-primary", "data-k": "check", text: "확인하기" });
      check.disabled = !full;
      check.addEventListener("click", function () {
        st.checked = true;
        st.tries = (st.tries || 0) + 1;
        st.correct = st.seq.join("|") === answer.join("|");
        focusKey = "check";
        save();
        draw();
        lesson.refresh();
      });
      root.appendChild(el("div", { class: "ss-row ord-ctrl" }, [undo, reset, check]));
      var fb = feedbackText();
      root.appendChild(el("p", { class: "ss-feedback" + (st.checked ? (st.correct ? " is-correct" : " is-wrong") : ""), "aria-live": "polite", text: fb }));
      // 다시 그린 뒤 키보드 초점을 이어 준다
      if (focusKey) {
        var target = null;
        if (focusKey === "next") target = full ? check : pool.querySelector("button:not([disabled])");
        else target = root.querySelector('[data-k="' + focusKey + '"]');
        if (target && target.disabled) target = full ? check : pool.querySelector("button:not([disabled])") || undo;
        if (target && !target.disabled) target.focus();
        focusKey = null;
      }
    }
    draw();
    return {
      draw: draw,
      isDone: function () {
        return isOpen() && st.checked;
      },
      result: function () {
        return {
          order: st.seq.map(function (id) {
            return byId[id].label;
          }),
          correct: !!(st.checked && st.correct),
          tries: st.tries || 0,
        };
      },
    };
  }

  var carOrder = makeOrder(
    $("car-order"),
    C.order.cars,
    C.cars.map(function (c) {
      return {
        id: c.id,
        label: c.name,
        speed: speedOf(c.id),
        chip: function () {
          return carChip(c.id);
        },
      };
    }),
    function () {
      return exp.allDone();
    }
  );
  var trOrder = makeOrder(
    $("transport-order"),
    C.order.transports,
    C.transports.map(function (t) {
      return { id: t.id, label: t.icon + " " + t.name, speed: round1(trSpeed(t)) };
    }),
    allTransportsDone
  );

  /* ───────── 두 가지를 골라 속력으로 비교해 쓰기(지도서 223쪽 ②, 실험관찰 29쪽) ───────── */
  var cmpState = store.get("compare", null);
  if (!cmpState || typeof cmpState !== "object") cmpState = { text: "", submitted: false };
  function escRe(x) {
    return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  // 학생 문장을 가볍게 확인한다: 두 교통수단 이름, 두 속력(숫자+단위), 적은 속력이 표의 값인지, '더 빠르다/느리다' 방향이 맞는지
  function checkCompare(text) {
    var cfg = C.compare;
    if (text.length < cfg.minLength) return "조금 더 자세히 적어 보세요. (" + cfg.minLength + "글자 이상)";
    var named = C.transports.filter(function (t) {
      return text.indexOf(t.name) >= 0;
    });
    if (named.length < 2) return "비교할 교통수단 두 가지의 이름을 넣어 써 보세요.";
    var re = /(\d[\d,]*(?:\.\d+)?)\s*(?:km\s*\/\s*h|킬로미터\s*매\s*시)/gi;
    var nums = [];
    var m;
    while ((m = re.exec(text))) nums.push(m[1]);
    if (nums.length < 2) return "두 교통수단의 속력을 숫자와 단위(km/h)로 함께 써 보세요.";
    var valid = C.transports.map(function (t) {
      return round1(trSpeed(t));
    });
    for (var i = 0; i < nums.length; i++) {
      var v = Number(nums[i].replace(/,/g, ""));
      if (valid.indexOf(v) < 0) return "적은 속력 " + nums[i] + " km/h를 교통수단 표에서 다시 확인해 보세요.";
    }
    for (var a = 0; a < named.length; a++) {
      for (var b = 0; b < named.length; b++) {
        if (a === b) continue;
        var r = new RegExp(escRe(named[a].name) + "[이가은는]?\\s*" + escRe(named[b].name) + "보다\\s*(?:더\\s*|훨씬\\s*)?(빠|느)");
        var mm = r.exec(text);
        if (!mm) continue;
        var faster = trSpeed(named[a]) > trSpeed(named[b]);
        if ((mm[1] === "빠") !== faster) return "두 교통수단의 속력을 다시 비교해 보세요. 단위가 같을 때는 숫자가 클수록 빨라요.";
      }
    }
    return null;
  }
  var cmpBox = $("transport-compare");
  var cmpTa = el("textarea", { id: "cmp-text", class: "ss-textarea", rows: "3", maxlength: "1000", placeholder: C.compare.placeholder });
  cmpTa.value = cmpState.text || "";
  var cmpMsg = el("p", { class: "ss-help", "aria-live": "polite" });
  var cmpBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary" });
  var cmpOut = el("div", { class: "ss-compare", hidden: true });
  var cmpLock = el("p", { class: "ss-help", text: C.compare.lock });
  var cmpBody = el("div", null, [cmpTa, el("div", { class: "ss-row" }, [cmpBtn]), cmpMsg, cmpOut]);
  cmpBox.appendChild(el("label", { for: "cmp-text", class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "비교해 쓰기" }), C.compare.prompt]));
  cmpBox.appendChild(cmpLock);
  cmpBox.appendChild(cmpBody);
  function saveCmp() {
    store.set("compare", cmpState);
  }
  function drawCompare() {
    var open = allTransportsDone();
    cmpLock.hidden = open;
    cmpBody.hidden = !open;
    cmpBtn.textContent = cmpState.submitted ? "고친 내용 다시 제출하기" : "제출하고 예시 답안 보기";
    cmpOut.textContent = "";
    cmpOut.hidden = !cmpState.submitted;
    if (!cmpState.submitted) return;
    cmpOut.appendChild(
      el("div", { class: "ss-compare-grid" }, [
        el("div", { class: "ss-compare-mine" }, [el("h4", { text: "✏️ 내 문장" }), el("p", { class: "ss-mine-text", text: cmpState.text })]),
        el("div", { class: "ss-compare-model" }, [
          el("h4", { text: "📘 예시 답안" }),
          el(
            "ul",
            { class: "refs-list" },
            C.compare.models.map(function (t) {
              return el("li", { text: t });
            })
          ),
        ]),
      ])
    );
    cmpOut.appendChild(el("p", { class: "ss-help", text: C.compare.compareTip }));
  }
  cmpTa.addEventListener("input", function () {
    cmpState.text = cmpTa.value;
    saveCmp(); // 작은 글이라 곧바로 저장한다(새로고침 직전 입력도 남게)
    cmpMsg.textContent = "";
  });
  cmpBtn.addEventListener("click", function () {
    var t = cmpTa.value.trim();
    var problem = checkCompare(t);
    if (problem) {
      cmpMsg.textContent = problem;
      cmpTa.focus();
      return;
    }
    cmpState.text = t;
    cmpState.submitted = true;
    saveCmp();
    drawCompare();
    lesson.refresh();
  });
  drawCompare();
  function drawTransportOrderAndCompare() {
    trOrder.draw();
    drawCompare();
  }
  function analyzeActivitiesDone() {
    return allTransportsDone() && carOrder.isDone() && trOrder.isDone() && !!cmpState.submitted && quiz.isDone();
  }

  /* ── 글 입력 즉시 저장(틀의 250 ms 지연 저장이 새로고침·탭 닫기 직전 입력을 놓치지 않게) ── */
  store.set("alive", 1); // '처음부터 다시 하기'로 저장소를 지운 뒤에는 되살리지 않게 하는 표시
  function flushTexts() {
    if (!store.get("alive", null)) return;
    var pv = store.get("predict", {}) || {};
    C.predict.questions.forEach(function (q) {
      var ta = document.getElementById("ss-predict-" + q.id);
      if (ta) pv[q.id] = ta.value;
    });
    store.set("predict", pv);
    var cs = store.get("conclude", {}) || {};
    C.conclude.forEach(function (it) {
      var ta = document.getElementById("ss-conclude-" + it.id);
      if (!ta) return;
      cs[it.id] = cs[it.id] || { text: "", submitted: false };
      cs[it.id].text = ta.value;
    });
    store.set("conclude", cs);
    var cu = document.getElementById("ss-curiosity");
    if (cu) store.set("curiosity", cu.value);
  }
  window.addEventListener("pagehide", flushTexts);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushTexts();
  });

  var nav; // 아래에서 만든다
  function drawResults() {
    var recs = C.cars.map(function (c) {
      return records.get(c.id);
    });
    T.renderTable($("car-table"), {
      caption: "태엽 자동차의 이동 거리, 걸린 시간, 속력 (내 기록)",
      columns: [
        { id: "name", label: "태엽 자동차" },
        { id: "distance", label: "이동 거리", unit: "cm" },
        { id: "time", label: "걸린 시간", unit: "초" },
        { id: "speed", label: "속력", unit: "cm/s", digits: 1 },
      ],
      rows: C.cars.map(function (c, i) {
        var r = recs[i];
        return { name: c.name, distance: r ? r.distance : null, time: r ? r.time : null, speed: r ? Number(r.speed) : null };
      }),
    });
    var box = $("car-table");
    var ul = el("ul", { class: "formula-list", "aria-label": "속력 구하는 식" });
    C.cars.forEach(function (c, i) {
      var r = recs[i];
      if (!r) return;
      ul.appendChild(el("li", null, [carChip(c.id), el("span", { text: c.name + ": " + r.distance + " cm ÷ " + r.time + " s = " + Number(r.speed).toFixed(1) + " cm/s" })]));
    });
    box.appendChild(ul);
    box.appendChild(el("p", { class: "ss-help", text: "속력은 반올림하여 소수 첫째 자리까지 나타냈어요. (예: 100 ÷ 5.8 = 17.241… → 17.2)" }));

    T.renderBar(
      $("car-chart"),
      Object.assign({}, C.chart.barCars, {
        categories: C.cars.map(function (c) {
          return c.short;
        }),
        series: [
          {
            name: "속력",
            values: recs.map(function (r) {
              return r ? Number(r.speed) : null;
            }),
          },
        ],
      })
    );
    $("car-chart").appendChild(el("p", { class: "ss-help", text: "막대 위 숫자가 속력(cm/s)이에요. 네 자동차는 서로 다른 대상이라 선으로 잇지 않고 막대로 나타냈어요." }));
    drawTransportResults();
    carOrder.draw();
    drawTransportOrderAndCompare();
    $("unit-think").textContent = "🤔 생각해 보기: 태엽 자동차의 속력은 cm/s로, 교통수단의 속력은 km/h로 나타냈어요. 왜 서로 다른 단위를 썼을까요? 이동 거리와 걸린 시간의 단위를 살펴보세요.";
  }

  /* ───────── 5. 마치기(결과 저장) ───────── */
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
    var transports = {};
    C.transports.forEach(function (t) {
      var st = trState[t.id] || {};
      transports[t.id] = { speed: st.done ? st.speed : null, tries: st.tries || 0 };
    });
    var cv = conclude.values();
    return {
      predict: predict.values(),
      records: records.list().map(function (r) {
        return { car: r.car, distance: r.distance, time: r.time, speed: r.speed, recordedAt: r.recordedAt };
      }),
      transports: transports,
      analysis: analysis,
      conclusion: cv.conclusion,
      order: { cars: carOrder.result(), transports: trOrder.result() },
      compare: cmpState.submitted ? cmpState.text : "",
      extension: { q1: cv.ext1, q2: cv.ext2 },
      curiosity: curiosity.value(),
    };
  }

  lesson.finish({
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    canFinish: function () {
      return curiosity.isDone() || "더 탐구하고 싶은 점(또는 궁금한 점)을 " + (C.curiosity.minLength || 2) + "글자 이상 먼저 적어 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var correct = C.quiz.filter(function (qq) {
        return q[qq.id].correct;
      }).length;
      var trN = C.transports.filter(function (t) {
        return trDone(t.id);
      }).length;
      var ordN = [carOrder, trOrder].filter(function (o) {
        return o.result().correct;
      }).length;
      return ["태엽 자동차 속력: " + records.count() + "/4대", "교통수단 속력: " + trN + "/5가지", "빠른 순서 쓰기: " + ordN + "/2 맞힘", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "1단계(2대)와 2단계(2대) 자동차의 속력을 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "대)";
      },
      conclude: function () {
        if (!carOrder.isDone()) return "활동 1에서 태엽 자동차를 빠른 순서대로 놓고 ‘확인하기’를 눌러 주세요.";
        if (!allTransportsDone()) return "교통수단 5가지의 속력을 계산기로 모두 구해 주세요.";
        if (!trOrder.isDone()) return "교통수단을 빠른 순서대로 놓고 ‘확인하기’를 눌러 주세요.";
        if (!cmpState.submitted) return "교통수단 두 가지를 골라 속력으로 비교하는 문장을 써서 제출해 주세요.";
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 ‘확인하기’를 눌러 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "결론과 발전 질문 2개를 모두 제출해 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: analyzeActivitiesDone,
      conclude: conclude.isDone,
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: activateExperiment,
      analyze: drawResults,
    },
  });
})();
