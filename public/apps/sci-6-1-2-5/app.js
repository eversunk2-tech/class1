/*
 * app.js — sci-6-1-2-5 "물체의 빠르기를 속력으로 비교해 보자!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(태엽 자동차 4대, 출발선, 줄자, 100 cm 결승선, 초시계)
 *   ② 관찰 카드(줄자 확대 그림·초시계 + 계산기 + 값 확인)
 *   ③ 자동차 표·막대그래프, 교통수단 속력 표(계산해 둔 자료), 퀴즈 연결 만 만든다.
 * 2026-09-22 질문 축소판(7분 기준): 교통수단 계산기·순서 쓰기·비교해 쓰기·발전 질문·궁금한 점 단계를 뺐다(spec.md 개정 절).
 * 2026-09-22 slim-review 반영(v3): 학생은 파랑·초록 두 대만 실행하고, 계산기에 식을 직접 눌러 속력을 구한 뒤 반올림한 값을 직접 적는다
 *   (자동 채우기 없음, 한 번 틀린 뒤에만 도움). 빨강·노랑은 교과서 예시 값으로 표에 미리 채운다(실행은 선택).
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
  function isExample(id) {
    return C.exampleCars.indexOf(id) >= 0;
  }
  var MEASURE_CARS = P1.measureCars.concat(P2.measureCars); // 학생이 직접 실행·계산하는 자동차(파랑, 초록)
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

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(+ 궁금한 점 한 줄, 선택) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  // 궁금한 점: 선택 입력 한 줄(비워도 마칠 수 있음). 저장 키는 틀과 같은 "curiosity"
  var curInput = el("input", { type: "text", id: "ss-curiosity", class: "ss-input cur-line", maxlength: "200", placeholder: C.curiosity.placeholder, autocomplete: "off" });
  curInput.value = store.get("curiosity", "") || "";
  curInput.addEventListener("input", function () {
    store.set("curiosity", curInput.value); // 한 줄이라 곧바로 저장한다
  });
  $("curiosity-root").appendChild(el("label", { for: "ss-curiosity", class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "궁금한 점" }), C.curiosity.prompt]));
  $("curiosity-root").appendChild(curInput);

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
    var s = svg("svg", { viewBox: "0 0 " + W + " 178", class: "zoom-svg", role: "img", "aria-label": "줄자 확대 그림" });
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
  // 학생이 ① 읽은 값을 적고 ② 계산기에 '이동 거리 ÷ 걸린 시간'을 직접 눌러 계산한 뒤 ③ 반올림한 속력을 직접 적는다.
  // 앱은 식이나 속력을 자동으로 채우지 않는다. '확인하기'에서 한 번 틀린 뒤에만 도움(계산기에 식 넣어 주기)을 준다.
  function observeCard(sel) {
    var id = sel.car;
    var car = CAR[id];
    var t = truth(id);
    var sp = speedOf(id);
    var ph = phaseOf(id);
    var measureId = ph === 1 ? "distance" : "time";
    var measureVal = ph === 1 ? t.distance : t.time;
    var calcOk = false; // 계산기에 이 자동차의 '이동 거리 ÷ 걸린 시간'을 눌러 계산했는지
    var body = el("div", { class: "obs-body" });
    if (ph === 1) {
      body.appendChild(zoomRuler(id));
      body.appendChild(el("p", { class: "fixed-line", text: "⏱ 걸린 시간: 5초 (같게 한 조건)" }));
    } else {
      body.appendChild(stopwatchFace(t.time, "🏁 앞부분이 100 cm 결승선에 닿은 순간 멈춘 초시계예요."));
      body.appendChild(el("p", { class: "fixed-line", text: "📏 이동 거리: 100 cm (같게 한 조건)" }));
    }
    var msg = el("p", { class: "obs-msg", "aria-live": "polite" });
    var calc = makeCalc({
      label: car.name + " 속력 계산기",
      onIncomplete: function () {
        msg.textContent = "‘이동 거리 ÷ 걸린 시간’을 끝까지 누른 뒤 = 를 눌러요.";
      },
      onResult: function (r) {
        if (Math.abs(r.a - t.distance) < 1e-9 && Math.abs(r.b - t.time) < 1e-9) {
          calcOk = true;
          msg.textContent = "✅ 식이 맞아요. 반올림하여 소수 첫째 자리까지 속력 칸에 적어요.";
        } else if (Math.abs(r.a - t.time) < 1e-9 && Math.abs(r.b - t.distance) < 1e-9) {
          msg.textContent = "나누는 순서를 확인해요. 속력 = 이동 거리 ÷ 걸린 시간";
        } else {
          msg.textContent = "식에 넣은 이동 거리와 걸린 시간이 이 자동차의 값인지 확인해요.";
        }
      },
    });
    body.appendChild(calc.node);
    body.appendChild(msg);

    // 입력칸은 공통 틀이 만든 뒤에 순서를 바꾼다: 읽은 값 → 계산기 → 속력 → 확인하기
    setTimeout(function () {
      var mInp = document.getElementById("ss-num-" + measureId);
      var sInp = document.getElementById("ss-num-speed");
      if (!mInp || !sInp) return;
      var grid = mInp.closest(".ss-num-grid");
      var sField = sInp.closest("label");
      if (grid && sField) {
        var calcBox = el("div", { class: "calc-box" }, [calc.node, msg]);
        grid.parentNode.insertBefore(calcBox, grid.nextSibling);
        var sGrid = el("div", { class: "ss-num-grid" }, [sField]);
        calcBox.parentNode.insertBefore(sGrid, calcBox.nextSibling);
      }
      mInp.addEventListener("change", function () {
        var v = mInp.value === "" ? NaN : Number(mInp.value);
        if (!isFinite(v)) return;
        msg.textContent =
          Math.abs(v - measureVal) < 1e-9
            ? "✅ 바르게 읽었어요. 이제 계산기로 속력을 구해요."
            : ph === 1
            ? "🔎 앞부분이 가리키는 눈금을 다시 읽어 보세요. (작은 눈금 한 칸은 1 cm)"
            : "🔎 초시계에 멈춘 숫자를 다시 읽어 보세요.";
      });
    }, 0);

    function help(tries) {
      // 한 번 틀린 뒤에만: 계산기에 식을 넣어 준다(= 누르기와 반올림은 학생이 한다)
      if (tries < 1) return "";
      calc.setExpr(t.distance, t.time);
      return " 💡 계산기에 ‘" + t.distance + " ÷ " + t.time + "’를 넣어 두었어요. = 를 눌러 보세요.";
    }

    return {
      question:
        ph === 1
          ? "📏 " + car.name + ": 이동 거리 읽기 → 계산기로 속력 구하기"
          : "⏱ " + car.name + ": 걸린 시간 읽기 → 계산기로 속력 구하기",
      body: body,
      type: "numeric",
      fields: [
        ph === 1
          ? { id: "distance", label: "이동 거리", unit: "cm", step: 1, min: 0, max: C.trackMaxCm }
          : { id: "time", label: "걸린 시간", unit: "초", step: 0.1, min: 0, max: 60 },
        { id: "speed", label: "속력 (소수 첫째 자리)", unit: "cm/s", step: 0.1, min: 0, max: 1000 },
      ],
      check: function (v, ctx) {
        if (Math.abs(v[measureId] - measureVal) > 1e-9)
          return ph === 1 ? "🔎 줄자에서 앞부분이 가리키는 눈금을 다시 읽어 보세요." : "🔎 초시계에 멈춘 숫자를 다시 읽어 보세요.";
        if (!calcOk) return "🧮 계산기에 ‘이동 거리 ÷ 걸린 시간’을 누르고 = 로 계산해요." + help(ctx.tries);
        if (Math.abs(v.speed - sp) < 1e-9) return { ok: true, message: "⭕ 맞아요! " + sp.toFixed(1) + " cm/s예요. ‘📝 기록하기’를 눌러요." };
        var raw = t.distance / t.time;
        var tooLong = Math.abs(v.speed * 10 - Math.round(v.speed * 10)) > 1e-6; // 소수 둘째 자리 이하가 있다
        if (Math.abs(v.speed - raw) < 0.1 && tooLong) return "소수 첫째 자리까지만 나타내요(소수 둘째 자리에서 반올림)." + help(ctx.tries);
        if (Math.abs(v.speed - raw) < 0.1) return "반올림을 확인해요. 소수 둘째 자리 숫자가 5 이상이면 올려요.";
        return "계산기 결과를 다시 보고, 반올림하여 소수 첫째 자리까지 적어요." + help(ctx.tries);
      },
    };
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div");
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
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
        // 직접 할 자동차(파랑, 초록)를 먼저, 교과서 예시(빨강, 노랑)는 뒤에 '선택'으로 둔다
        options: MEASURE_CARS.concat(C.exampleCars).map(function (cid) {
          var c = CAR[cid];
          return {
            id: c.id,
            label: isExample(c.id) ? c.name + " (예시·선택)" : c.name,
            icon: function () {
              return carChip(c.id);
            },
          };
        }),
        note: function (sel) {
          if (!sel.car) return null;
          if (isExample(sel.car)) return "교과서 예시 자료예요. 표에 이미 들어 있으니 달려 보기는 선택이에요.";
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
        cells: P1.measureCars.map(function (id) {
          return { car: id };
        }),
      },
      {
        id: "P2",
        name: P2.name,
        title: P2.title,
        lead: P2.lead,
        cells: P2.measureCars.map(function (id) {
          return { car: id };
        }),
      },
    ],
    doneLead: "파랑·초록 자동차의 속력을 구했어요. ‘다음 단계’로 가서 네 자동차를 비교해요. (빨강·노랑 달려 보기는 선택)",
    cellKey: function (sel) {
      return sel.car;
    },
    runLabel: function (sel) {
      return phaseOf(sel.car) === 1 ? "▶ " + CAR[sel.car].name + " 출발! (5초 동안)" : "▶ " + CAR[sel.car].name + " 출발! (100 cm 결승선까지)";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향",
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
        return { id: c.id, label: isExample(c.id) ? c.short + "(예시)" : c.short };
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
  function trSpeed(t) {
    return round1(t.distanceKm / t.hours); // 반올림하여 소수 첫째 자리까지
  }
  // 교통수단(활동해요2): 주어진 자료를 계산해 둔 표(학생이 계산하지 않는다 — 7분 기준 축소)
  (function drawTransportTable() {
    T.renderTable($("transport-table"), {
      caption: "교통수단의 속력",
      columns: [
        { id: "name", label: "교통수단" },
        { id: "calc", label: "속력 = 이동 거리 ÷ 걸린 시간" },
        { id: "speed", label: "속력", unit: "km/h" },
      ],
      rows: C.transports.map(function (t) {
        return {
          name: t.icon + " " + t.name,
          calc: t.distanceKm.toLocaleString("ko-KR") + " km ÷ " + t.hours + " h",
          speed: fmtNum(trSpeed(t)),
        };
      }),
    });
  })();

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
    store.set("curiosity", curInput.value);
  }
  window.addEventListener("pagehide", flushTexts);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushTexts();
  });

  var nav; // 아래에서 만든다
  // 표에 쓸 값: 학생 기록이 있으면 그 기록, 없으면 교과서 예시(빨강·노랑만). 예시 값도 지도서 값(오차 없음)이다.
  function exampleRecord(id) {
    var t = truth(id);
    return { car: id, distance: t.distance, time: t.time, speed: speedOf(id), example: true };
  }
  function rowRecord(id) {
    var r = records.get(id);
    if (r) return r;
    return isExample(id) ? exampleRecord(id) : null;
  }
  function drawResults() {
    var recs = C.cars.map(function (c) {
      return rowRecord(c.id);
    });
    T.renderTable($("car-table"), {
      caption: "태엽 자동차의 이동 거리, 걸린 시간, 속력",
      columns: [
        { id: "name", label: "태엽 자동차" },
        { id: "distance", label: "이동 거리", unit: "cm" },
        { id: "time", label: "걸린 시간", unit: "초" },
        { id: "speed", label: "속력", unit: "cm/s", digits: 1 },
      ],
      rows: C.cars.map(function (c, i) {
        var r = recs[i];
        return { name: c.name + (r && r.example ? " (교과서 예시)" : ""), distance: r ? r.distance : null, time: r ? r.time : null, speed: r ? Number(r.speed) : null };
      }),
    });
    $("car-table").appendChild(el("p", { class: "ss-help", text: "속력은 그동안의 평균적인 빠르기예요. (파랑 24.4 cm/s는 5초 동안의 평균)" }));

    T.renderBar(
      $("car-chart"),
      Object.assign({}, C.chart.barCars, {
        categories: C.cars.map(function (c, i) {
          return c.short + (recs[i] && recs[i].example ? "(예시)" : "");
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
  }

  /* ───────── 4. 정리하기 안의 마치기(결과 저장) ───────── */
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
      predict: predict.values(),
      records: records.list().map(function (r) {
        return { car: r.car, distance: r.distance, time: r.time, speed: r.speed, recordedAt: r.recordedAt };
      }),
      examples: C.exampleCars.filter(function (id) {
        return !records.get(id);
      }), // 교과서 예시 값으로 표를 채운 자동차
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curInput.value.trim(),
    };
  }

  lesson.finish({
    stage: "conclude",
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    canFinish: function () {
      return conclude.isDone() || "결론을 적고 ‘제출하고 모범 답안 보기’를 먼저 눌러 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var correct = C.quiz.filter(function (qq) {
        return q[qq.id].correct;
      }).length;
      var mine = MEASURE_CARS.filter(function (id) {
        return !!records.get(id);
      }).length;
      return ["태엽 자동차 속력 직접 구하기: " + mine + "/" + MEASURE_CARS.length + "대", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "파란색(1단계)·초록색(2단계) 자동차의 속력을 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "대)";
      },
      conclude: function () {
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 보기를 고르고 ‘확인하기’를 눌러 주세요.";
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
