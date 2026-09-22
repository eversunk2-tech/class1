/*
 * app.js — sci-6-1-2-3 "같은 시간 동안 이동한 물체의 빠르기를 비교해 보자!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 경주로 장면(출발선 색 테이프, 줄자, 태엽 자동차 2대, 삼각대+스마트 기기)
 *   ② 관찰 카드(찍은 사진 + '사진 확대해서 보기' 줄자 확대 화면, 이동 거리 직접 입력)
 *   ③ 분석 표·막대그래프·퀴즈 그림(㉠~㉣), 발전 질문 1 참고 표   만 만든다.
 *
 * 과학 원칙
 *  - 두 자동차는 동시에 출발해 정한 시간(3·5·8초) 동안 '실제 시간'대로 달리고, 그 시간이 된 '순간' 사진을 찍는다.
 *    자동차는 사진을 찍은 뒤에도 계속 달린다(지도서 206~207쪽: 달리는 도중 5초 뒤의 위치를 사진으로 비교).
 *    그래서 장면에서는 사진 뒤에도 OVERRUN초 더 달리게 하고, 사진 순간의 위치를 📸 표시로 남긴다.
 *  - 이동 거리 참값 = 모형 계산값(5초에서 지도서 값 135 cm·122 cm와 정확히 일치). 잴 때마다 ±1 cm 이내 오차.
 *  - 화면 어디에도 '속력', 거리÷시간, m/s 등을 쓰지 않는다(탐구 5에서 배움). 서로 다른 시간끼리 비교하게 하지 않는다.
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var S = window.SciSim;
  var el = S.el;
  var $ = function (id) {
    return document.getElementById(id);
  };
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;
  var CAR = {};
  C.cars.forEach(function (c) {
    CAR[c.id] = c;
  });
  var CAR_IDS = C.cars.map(function (c) {
    return c.id;
  });

  /* ───────── 모형 계산 ───────── */
  // 오차 없는 참값(cm). 5초: 135 / 122 (지도서 207, 211쪽)
  function trueDistance(carId, t) {
    return Math.round(CAR[carId].speed * Number(t) * 10) / 10;
  }
  // 한 번 달릴 때의 실제 위치(0.1 cm 단위). 참값 ±noise 이내. x.5처럼 반올림이 애매한 값은 피한다.
  function makeRun(t) {
    var dist = {};
    CAR_IDS.forEach(function (id) {
      var v = trueDistance(id, t) + (Math.random() * 2 - 1) * C.noise;
      v = Math.round(v * 10) / 10;
      var frac = Math.round((v - Math.floor(v)) * 10);
      if (frac === 5) v = Math.round((v - 0.1) * 10) / 10;
      dist[id] = Math.max(0, v);
    });
    return { time: Number(t), dist: dist, at: Date.now() };
  }
  // 사진을 찍은 뒤에도 자동차가 계속 달리는 모습을 보여 주는 시간(초). 멈춘 곳을 재는 실험으로 오해하지 않게 한다.
  var OVERRUN = 0.8;
  function afterCm(id, run) {
    return Math.min(C.trackMax - 4, run.dist[id] + CAR[id].speed * OVERRUN);
  }
  var lastRun = store.get("lastRun", null);
  if (!lastRun || !lastRun.dist) lastRun = null;
  function setLastRun(r) {
    lastRun = r;
    store.set("lastRun", r);
  }

  /* ───────── 기록 ───────── */
  function cellKey(car, time) {
    return car + "|" + time;
  }
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return cellKey(r.car, r.time);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  // 사진 눈금과 차이가 큰(다시 확인할) 기록인지
  function isOff(r) {
    return r && r.actual != null && Math.abs(r.distance - r.actual) >= 2.5;
  }
  // 실험 틀에 넘기는 기록 저장소: 세 번 모두 잰 칸을 다시 재면 '다시 확인할 회차'를 먼저 바꾼다(없으면 가장 먼저 잰 회차).
  // (공통 틀 record-store.js는 수정하지 않고 이 앱에서만 감싼다 — fix-1-report의 '틀 반영 제안' 참고)
  var expRecords = Object.assign({}, records, {
    nextTrial: function (k, max) {
      var t = records.trials(k);
      if (max && t.length >= max) {
        var off = t.filter(isOff).sort(function (a, b) {
          return (a.recordedAt || 0) - (b.recordedAt || 0);
        })[0];
        if (off) return off.trial;
      }
      return records.nextTrial(k, max);
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quizItems = C.quiz.map(function (q) {
    if (q.fig !== "dots") return q;
    return Object.assign({}, q, { text: el("span", { class: "q-with-fig" }, [el("span", { class: "q-text", text: q.text }), dotsFigure()]) });
  });
  var quiz = S.Quiz.render($("quiz-root"), quizItems, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
  insertRefTable();

  /* 분석 2·3 그림: ㉠~㉣이 같은 출발선에서 동시에 출발해 10초 동안 이동한 곳.
   * 지도서 209쪽 원본은 좌표값 없이 그림으로만 제시한다. 여기서는 ㉣ > ㉢ > ㉡ > ㉠ 순서(정답 ㉣ 가장 빠름, ㉠ 가장 느림)만 지킨
   * 임의의 칸 수를 쓴다. */
  function dotsFigure() {
    var rows = [
      { name: "㉠", cells: 3 },
      { name: "㉡", cells: 5 },
      { name: "㉢", cells: 7 },
      { name: "㉣", cells: 9 },
    ];
    var W = 520;
    var L = 56;
    var step = 44;
    var rowH = 38;
    var H = 30 + rows.length * rowH + 14;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "dots-svg", role: "img", "aria-label": "㉠~㉣이 10초 동안 이동한 곳을 나타낸 그림. 출발선에서 ㉠은 3칸, ㉡은 5칸, ㉢은 7칸, ㉣은 9칸 떨어진 곳에 점이 있어요." });
    for (var k = 0; k <= 10; k++) {
      var x = L + k * step;
      s.appendChild(svg("line", { x1: x, x2: x, y1: 22, y2: H - 10, class: k === 0 ? "dots-start" : "dots-grid" }));
    }
    s.appendChild(svg("text", { x: L, y: 15, "text-anchor": "middle", class: "dots-lbl" }, "출발선"));
    rows.forEach(function (r, i) {
      var y = 30 + i * rowH + rowH / 2;
      s.appendChild(svg("text", { x: 22, y: y + 6, "text-anchor": "middle", class: "dots-name" }, r.name));
      s.appendChild(svg("line", { x1: L, x2: L + r.cells * step, y1: y, y2: y, class: "dots-path" }));
      s.appendChild(svg("circle", { cx: L + r.cells * step, cy: y, r: 8, class: "dots-dot" }));
    });
    return el("span", { class: "dots-fig" }, [s, el("span", { class: "ss-help dots-cap", text: "모두 같은 출발선에서 동시에 출발했어요. 세로줄 간격은 모두 같아요. (● = 10초 뒤 있던 곳)" })]);
  }

  // 발전 질문 1 카드 안(입력칸 앞)에 참고 표를 넣는다(『과학』 43쪽, 지도서 208·210쪽)
  function insertRefTable() {
    var ta = $("ss-conclude-ext1");
    if (!ta) return;
    var R = C.refTable;
    var table = el("table", { class: "ss-matrix ss-numtable ref-table" }, [
      el("caption", { text: R.title }),
      el("thead", null, [el("tr", null, [el("th", { scope: "col", text: "물체" }), el("th", { scope: "col", text: "1초 동안 이동할 수 있는 거리(m)" })])]),
      el(
        "tbody",
        null,
        R.rows.map(function (r) {
          return el("tr", null, [el("th", { scope: "row", text: r.name }), el("td", { text: r.distance })]);
        })
      ),
    ]);
    var box = el("div", { class: "ref-box" }, [el("div", { class: "ss-table-wrap", tabindex: "0", role: "region", "aria-label": R.title }, [table]), el("p", { class: "ss-help ref-note", text: "⚠️ " + R.note })]);
    ta.parentNode.insertBefore(box, ta);
  }

  /* ───────── 경주로 그림(2D 화면·찍은 사진 공통, 위에서 본 모형) ───────── */
  var TRACK = { x0: 112, x1: 968, w: 1000, h: 214 };
  function X(cm) {
    return TRACK.x0 + ((TRACK.x1 - TRACK.x0) * cm) / C.trackMax;
  }
  var LANE_Y = { red: 34, blue: 150 }; // 자동차 윗변 y
  var CAR_H = 32;
  function trackSVG(opts) {
    opts = opts || {};
    var s = svg("svg", { viewBox: "0 0 " + TRACK.w + " " + TRACK.h, class: "track-svg", "aria-hidden": "true" });
    s.appendChild(svg("rect", { x: 0, y: 0, width: TRACK.w, height: TRACK.h, rx: 12, class: "tk-floor" }));
    // 줄자(두 경주로 사이)
    s.appendChild(svg("rect", { x: X(0) - 6, y: 90, width: X(C.trackMax) - X(0) + 12, height: 40, class: "tk-tape" }));
    for (var cm = 0; cm <= C.trackMax; cm += 5) {
      var big = cm % 50 === 0;
      var mid = cm % 10 === 0;
      s.appendChild(svg("line", { x1: X(cm), x2: X(cm), y1: 90, y2: 90 + (big ? 20 : mid ? 13 : 7), class: "tk-tick" }));
      if (big) s.appendChild(svg("text", { x: X(cm), y: 125, "text-anchor": "middle", class: "tk-num" }, String(cm)));
    }
    s.appendChild(svg("text", { x: X(0) - 12, y: 116, "text-anchor": "end", class: "tk-unit" }, "(cm)"));
    // 출발선(색 테이프)
    s.appendChild(svg("rect", { x: X(0) - 5, y: 12, width: 10, height: TRACK.h - 34, class: "tk-start" }));
    s.appendChild(svg("text", { x: X(0), y: 208, "text-anchor": "middle", class: "tk-lbl" }, "출발선"));
    var cars = {};
    var marks = {};
    if (opts.marks) {
      // 📸 사진을 찍은 순간 자동차 앞부분이 있던 곳(자동차는 그 뒤에도 계속 달린다)
      CAR_IDS.forEach(function (id) {
        var m = svg("g", { class: "tk-mark-photo" });
        m.appendChild(svg("line", { x1: 0, x2: 0, y1: LANE_Y[id] - 8, y2: LANE_Y[id] + CAR_H + 8, class: "tk-photo-line" }));
        m.appendChild(svg("text", { x: 0, y: id === "red" ? LANE_Y[id] - 10 : LANE_Y[id] + CAR_H + 30, "text-anchor": "middle", class: "tk-photo-lbl" }, "📸"));
        m.style.display = "none";
        s.appendChild(m);
        marks[id] = m;
      });
    }
    CAR_IDS.forEach(function (id) {
      var c = CAR[id];
      var g = svg("g", { class: "tk-car tk-car-" + id });
      var body = svg("rect", { x: -44, y: LANE_Y[id], width: 44, height: CAR_H, rx: 7, class: "tk-body" });
      body.setAttribute("fill", c.color);
      g.appendChild(body);
      g.appendChild(svg("rect", { x: -8, y: LANE_Y[id] + 4, width: 5, height: CAR_H - 8, rx: 2, class: "tk-bumper" }));
      g.appendChild(svg("text", { x: -24, y: LANE_Y[id] + CAR_H / 2 + 6, "text-anchor": "middle", class: "tk-mark" }, c.mark));
      var sel = svg("rect", { x: -50, y: LANE_Y[id] - 6, width: 56, height: CAR_H + 12, rx: 10, class: "tk-sel" });
      sel.style.display = "none";
      g.insertBefore(sel, g.firstChild);
      s.appendChild(g);
      // 경주로 이름(왼쪽)
      s.appendChild(svg("text", { x: 8, y: LANE_Y[id] + CAR_H / 2 + 5, class: "tk-lane" }, c.short));
      cars[id] = { g: g, sel: sel, cm: 0 };
    });
    function setCar(id, cm) {
      cars[id].cm = cm;
      cars[id].g.setAttribute("transform", "translate(" + X(cm).toFixed(2) + ",0)");
    }
    CAR_IDS.forEach(function (id) {
      setCar(id, 0);
    });
    function setMark(id, cm) {
      var m = marks[id];
      if (!m) return;
      m.style.display = cm == null ? "none" : "";
      if (cm != null) m.setAttribute("transform", "translate(" + X(cm).toFixed(2) + ",0)");
    }
    return {
      node: s,
      setCar: setCar,
      setMark: setMark,
      select: function (carId) {
        CAR_IDS.forEach(function (id) {
          cars[id].sel.style.display = id === carId ? "" : "none";
        });
      },
    };
  }

  /* ───────── 관찰 카드: 찍은 사진 + 확대 ───────── */
  var obsRun = null; // 지금 관찰 카드가 보여 주는 달리기(기록할 때 참값 확인에 씀)
  function photoNode(sel) {
    var run = lastRun;
    var car = CAR[sel.car];
    var tr = trackSVG();
    CAR_IDS.forEach(function (id) {
      tr.setCar(id, run.dist[id]);
    });
    tr.select(sel.car);
    var photo = el("figure", { class: "photo" }, [
      el("div", { class: "photo-frame", role: "img", "aria-label": "출발하고 " + run.time + "초가 된 순간 두 자동차의 위치를 찍은 경주로 사진(모형, 위에서 본 그림)이에요. 두 자동차는 이 순간에도 달리고 있었어요." }, [tr.node]),
      el("figcaption", { class: "photo-cap", text: "📸 출발하고 " + run.time + "초가 된 순간에 찍은 사진 (모형, 보기 쉽게 위에서 본 그림) — 자동차는 이 순간에도 달리고 있었어요" }),
    ]);
    var zoomBox = el("div", { class: "zoom-box", hidden: true }, [zoomSVG(run.dist[sel.car], sel.car)]);
    var btn = el("button", { type: "button", class: "ss-btn zoom-btn", "aria-expanded": "false", text: "🔍 사진 확대해서 보기 (" + car.name + " 앞부분)" });
    btn.addEventListener("click", function () {
      zoomBox.hidden = !zoomBox.hidden;
      btn.setAttribute("aria-expanded", String(!zoomBox.hidden));
      btn.textContent = zoomBox.hidden ? "🔍 사진 확대해서 보기 (" + car.name + " 앞부분)" : "↩ 확대 닫기";
    });
    var check = el("p", { class: "ss-help read-check", id: "read-check", "aria-live": "polite" });
    return el("div", { class: "obs-photo" }, [
      photo,
      btn,
      zoomBox,
      S.rich("자동차 **앞부분**이 가리키는 줄자 눈금을 읽고, **반올림해 일의 자리까지**(정수 cm) 적어요.", "p"),
      check,
    ]);
  }
  // 자동차 앞부분 근처 15 cm를 확대한 줄자(1 mm 눈금). 창의 시작은 5 cm 단위라 가운데 눈금이 답을 알려 주지 않는다.
  function zoomSVG(cm, carId) {
    var c = CAR[carId];
    var W0 = Math.floor(cm / 5) * 5 - 5;
    if (W0 < 0) W0 = 0;
    var span = 15;
    var PX = 40;
    var L = 20;
    var zx = function (v) {
      return L + (v - W0) * PX;
    };
    var s = svg("svg", { viewBox: "0 0 640 214", class: "zoom-svg" });
    var fl = Math.floor(cm);
    s.setAttribute("role", "img");
    s.setAttribute(
      "aria-label",
      "확대한 사진: " + c.name + " 앞부분이 줄자의 " + fl + " cm와 " + (fl + 1) + " cm 사이에서, " + (cm - fl < 0.5 ? fl : fl + 1) + " cm 쪽에 더 가까운 곳에 있어요."
    );
    s.appendChild(svg("rect", { x: 0, y: 0, width: 640, height: 214, rx: 12, class: "tk-floor" }));
    var clip = svg("clipPath", { id: "zclip-" + carId });
    clip.appendChild(svg("rect", { x: 0, y: 0, width: 640, height: 214 }));
    s.appendChild(clip);
    var g = svg("g", { "clip-path": "url(#zclip-" + carId + ")" });
    s.appendChild(g);
    // 자동차(길이 12 cm 모형) — 앞부분이 cm에 있다
    var body = svg("rect", { x: zx(cm - 12), y: 18, width: 12 * PX, height: 70, rx: 16, class: "tk-body" });
    body.setAttribute("fill", c.color);
    g.appendChild(body);
    g.appendChild(svg("rect", { x: zx(cm) - 16, y: 26, width: 10, height: 54, rx: 4, class: "tk-bumper" }));
    g.appendChild(svg("text", { x: zx(cm) - 60, y: 62, "text-anchor": "end", class: "zm-carname" }, c.mark + " " + c.short));
    // 줄자
    g.appendChild(svg("rect", { x: 0, y: 118, width: 640, height: 70, class: "tk-tape" }));
    for (var mm = -5; mm <= span * 10 + 5; mm++) {
      var v = W0 + mm / 10;
      if (v < 0) continue;
      var x = zx(v);
      var isCm = mm % 10 === 0;
      var half = mm % 5 === 0;
      g.appendChild(svg("line", { x1: x, x2: x, y1: 118, y2: 118 + (isCm ? (Math.round(v) % 5 === 0 ? 30 : 24) : half ? 15 : 9), class: isCm ? "tk-tick" : "tk-tick-mm" }));
      if (isCm) g.appendChild(svg("text", { x: x, y: 170, "text-anchor": "middle", class: "zm-num" + (Math.round(v) % 5 === 0 ? " is-5" : "") }, String(Math.round(v))));
    }
    // 앞부분 표시선
    g.appendChild(svg("line", { x1: zx(cm), x2: zx(cm), y1: 10, y2: 190, class: "zm-front" }));
    s.appendChild(svg("text", { x: 630, y: 206, "text-anchor": "end", class: "zm-unit" }, "단위: cm (작은 눈금 1칸 = 1 mm)"));
    return s;
  }
  // 학생이 입력한 값 확인(답을 알려 주지 않고, 차이가 클 때만 다시 보라고 한다)
  $("experiment-root").addEventListener("input", function (e) {
    if (!e.target || e.target.id !== "ss-num-distance") return;
    var msg = $("read-check");
    if (!msg || !obsRun) return;
    var raw = e.target.value;
    var v = Number(raw);
    if (raw === "" || !isFinite(v)) {
      msg.textContent = "";
      return;
    }
    if (Math.round(v) !== v) msg.textContent = "✏️ 반올림해서 일의 자리(정수)까지 적어요. 기록하면 반올림한 값으로 저장돼요.";
    else if (Math.abs(v - obsRun.actual) >= 2.5) msg.textContent = "🔎 사진의 눈금과 차이가 커 보여요. 사진을 확대해서 자동차 앞부분이 가리키는 눈금을 다시 확인해 보세요.";
    else msg.textContent = "";
  });

  /* ───────── 3D·2D 공통: 달리기 표시(타이머, 셔터) ───────── */
  function overlayEls(host) {
    var timer = el("div", { class: "run-timer", "aria-live": "polite", hidden: true });
    var flash = el("div", { class: "photo-flash", "aria-hidden": "true" });
    host.appendChild(timer);
    host.appendChild(flash);
    return {
      timer: timer,
      flash: flash,
      setTimer: function (text) {
        timer.hidden = !text;
        timer.textContent = text || "";
      },
      shutter: function () {
        if (reduceMotion() || document.hidden) return;
        flash.classList.remove("is-on");
        void flash.offsetWidth;
        flash.classList.add("is-on");
      },
      remove: function () {
        if (timer.parentNode) timer.parentNode.removeChild(timer);
        if (flash.parentNode) flash.parentNode.removeChild(flash);
      },
    };
  }
  function timeText(sec, total) {
    return "⏱ " + sec.toFixed(1) + "초 / " + total + "초 (실제 시간)";
  }

  /* ───────── 2D 화면 ───────── */
  function build2D(container, ctx) {
    container.textContent = "";
    var tr = trackSVG({ marks: true });
    var wrap = el("div", { class: "track2d" }, [tr.node]);
    var ov = overlayEls(wrap);
    container.appendChild(wrap);
    CAR_IDS.forEach(function (id) {
      tr.node.querySelector(".tk-car-" + id).addEventListener("click", function () {
        ctx.onPick({ car: id });
      });
    });
    tr.node.removeAttribute("aria-hidden");
    tr.node.setAttribute("role", "img");
    function label() {
      tr.node.setAttribute(
        "aria-label",
        "경주로 모형: " +
          (lastRunShown
            ? "사진을 찍은 순간 두 자동차 앞부분이 있던 곳에 📸 표시가 있고, 두 자동차는 사진을 찍은 뒤에도 조금 더 달려 나갔어요."
            : CAR_IDS.map(function (id) {
                return CAR[id].name + " 출발선에 있음";
              }).join(", "))
      );
    }
    var lastRunShown = false;
    var raf = 0;
    var disposed = false;
    label();
    return {
      highlight: function (s) {
        tr.select(s.car);
      },
      run: function (sel) {
        var t = Number(sel.time);
        var run = makeRun(t);
        setLastRun(run);
        CAR_IDS.forEach(function (id) {
          tr.setCar(id, 0);
          tr.setMark(id, null);
        });
        lastRunShown = false;
        label();
        // 0 → t초(사진 순간) → t + OVERRUN초(사진 뒤에도 계속 달림)를 한 번의 실제 시간 흐름으로 그린다
        function animate(fromSec, toSec, onFrame) {
          return new Promise(function (resolve) {
            var start = null;
            function frame(now) {
              if (disposed) return resolve();
              if (start == null) start = now;
              var sec = Math.min(toSec, fromSec + (now - start) / 1000);
              if (document.hidden) sec = toSec;
              CAR_IDS.forEach(function (id) {
                var cm = sec <= t ? (run.dist[id] * sec) / t : Math.min(afterCm(id, run), run.dist[id] + CAR[id].speed * (sec - t));
                tr.setCar(id, cm);
              });
              if (onFrame) onFrame(sec);
              if (sec >= toSec) resolve();
              else raf = requestAnimationFrame(frame);
            }
            if (document.hidden) frame(0);
            else raf = requestAnimationFrame(frame);
          });
        }
        return (async function () {
          ov.setTimer("준비… 🏁");
          await sleep(document.hidden ? 0 : 700);
          ov.setTimer("출발!");
          await animate(0, t, function (sec) {
            ov.setTimer(timeText(sec, t));
          });
          if (disposed) return;
          ov.shutter();
          CAR_IDS.forEach(function (id) {
            tr.setMark(id, run.dist[id]);
          });
          ov.setTimer("📸 찰칵! " + t + "초가 된 순간을 찍었어요 (자동차는 계속 달려요)");
          lastRunShown = true;
          label();
          await animate(t, t + OVERRUN);
          await sleep(document.hidden ? 0 : 900);
          ov.setTimer("");
        })();
      },
      showInstant: function () {
        if (!lastRun) return;
        CAR_IDS.forEach(function (id) {
          tr.setCar(id, afterCm(id, lastRun));
          tr.setMark(id, lastRun.dist[id]);
        });
        lastRunShown = true;
        label();
      },
      clear: function () {
        CAR_IDS.forEach(function (id) {
          tr.setCar(id, 0);
          tr.setMark(id, null);
        });
        setLastRun(null);
        lastRunShown = false;
        label();
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
        cancelAnimationFrame(raf);
        ov.remove();
      },
    };
  }

  /* ───────── 3D 화면 ─────────
   * 1 단위 = 10 cm. 경주로는 +x 방향. 자동차 그룹의 원점 = 자동차 앞부분(줄자로 재는 곳). */
  function build3D(container, ctx) {
    var U = 0.1; // cm → 장면 단위
    return S.Sim3D.create({
      container: container,
      frame: { width: 28.5, depth: 9, center: [12.4, 0, -0.6] },
      minDistance: 3,
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var root = v.root;

      // 바닥
      var floorMat = M.material(0xd7dbe0, { roughness: 0.9 });
      var floor = new T.Mesh(new T.BoxGeometry(32, 0.2, 13), floorMat);
      floor.position.set(12.5, -0.1, -0.8);
      root.add(floor);
      v.onThemeChange(function (dark) {
        floorMat.color.set(dark ? 0x8a929c : 0xd7dbe0);
      });

      // 줄자(캔버스 눈금: 1 cm 작은 눈금, 5 cm, 10 cm 숫자)
      var PXC = 12;
      var cv = document.createElement("canvas");
      cv.width = (C.trackMax + 6) * PXC;
      cv.height = 72;
      var g2 = cv.getContext("2d");
      g2.fillStyle = "#f6d34a";
      g2.fillRect(0, 0, cv.width, cv.height);
      g2.fillStyle = "#1f2733";
      g2.textAlign = "center";
      g2.font = "700 22px system-ui, sans-serif";
      for (var cmk = 0; cmk <= C.trackMax; cmk++) {
        var px = (cmk + 3) * PXC;
        var hh = cmk % 10 === 0 ? 30 : cmk % 5 === 0 ? 20 : 11;
        g2.fillRect(px - 1, 0, 2, hh);
        if (cmk % 10 === 0) g2.fillText(String(cmk), px, 58);
      }
      var tapeTex = new T.CanvasTexture(cv);
      tapeTex.colorSpace = T.SRGBColorSpace;
      tapeTex.anisotropy = 8;
      var tapeW = 0.5;
      var tape = new T.Mesh(new T.PlaneGeometry((C.trackMax + 6) * U, tapeW), new T.MeshStandardMaterial({ map: tapeTex, roughness: 0.6 }));
      tape.rotation.x = -Math.PI / 2;
      tape.position.set((C.trackMax / 2) * U, 0.012, 0);
      root.add(tape);
      // 줄자 통(0 cm 쪽 뒤)
      var reel = new T.Mesh(new T.BoxGeometry(0.8, 0.6, 0.8), M.material(0x3a4452));
      reel.position.set(-0.9, 0.3, 0);
      root.add(reel);
      for (var lb = 0; lb <= C.trackMax; lb += 50) {
        var sp = M.label(lb + " cm", { height: 0.5, bg: "rgba(255,244,190,0.95)" });
        sp.position.set(lb * U, 0.45, -0.05);
        root.add(sp);
      }

      // 출발선(색 테이프)
      var start = new T.Mesh(new T.BoxGeometry(0.25, 0.02, 4.6), M.material(0x23a26a));
      start.position.set(0, 0.015, 0);
      root.add(start);
      var startLbl = M.label("출발선", { height: 0.5 });
      startLbl.position.set(-0.2, 0.55, 2.7);
      root.add(startLbl);

      // 태엽 자동차
      var LANE_Z = { red: -1.2, blue: 1.2 };
      var cars = {};
      CAR_IDS.forEach(function (id) {
        var c = CAR[id];
        var g = new T.Group();
        var bodyMat = M.material(new T.Color(c.color).getHex(), { roughness: 0.4 });
        var body = new T.Mesh(new T.BoxGeometry(1.2, 0.34, 0.72), bodyMat);
        body.position.set(-0.6, 0.27, 0);
        g.add(body);
        var cabin = new T.Mesh(new T.BoxGeometry(0.55, 0.26, 0.6), M.material(0xeaf2fb, { roughness: 0.2 }));
        cabin.position.set(-0.7, 0.57, 0);
        g.add(cabin);
        var bumper = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.74), M.material(0x2a2f36));
        bumper.position.set(-0.03, 0.22, 0);
        g.add(bumper);
        var wheels = [];
        var wGeo = new T.CylinderGeometry(0.14, 0.14, 0.1, 16);
        var wMat = M.material(0x22262c);
        [
          [-0.25, 0.39],
          [-0.25, -0.39],
          [-0.95, 0.39],
          [-0.95, -0.39],
        ].forEach(function (p) {
          var w = new T.Mesh(wGeo, wMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(p[0], 0.14, p[1]);
          g.add(w);
          wheels.push(w);
        });
        // 태엽 열쇠(뒤쪽 위)
        var key = new T.Group();
        var stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.22, 8), M.material(0xc9a227, { metalness: 0.5 }));
        stem.rotation.z = Math.PI / 2;
        stem.position.x = -0.11;
        var grip = new T.Mesh(new T.BoxGeometry(0.04, 0.3, 0.14), M.material(0xc9a227, { metalness: 0.5 }));
        grip.position.x = -0.23;
        key.add(stem, grip);
        key.position.set(-1.2, 0.3, 0);
        g.add(key);
        var name = M.label(c.mark + " " + c.short, { height: 0.46, border: c.color });
        name.position.set(-0.6, 1.1, 0);
        g.add(name);
        var measure = M.label("📏 잴 자동차", { height: 0.42, bg: "rgba(255,236,170,0.96)", border: "#b7791f" });
        measure.position.set(-0.6, 1.62, 0);
        measure.visible = false;
        g.add(measure);
        g.position.set(0, 0, LANE_Z[id]);
        root.add(g);
        [body, cabin].forEach(function (m) {
          v.pickable(m, { car: id });
        });
        cars[id] = { g: g, wheels: wheels, key: key, measure: measure, cm: 0 };
      });
      // 📸 사진을 찍은 순간 자동차 앞부분이 있던 곳 표시(자동차는 사진 뒤에도 계속 달린다)
      var photoMarks = {};
      CAR_IDS.forEach(function (id) {
        var c = CAR[id];
        var mg = new T.Group();
        var markMat = M.material(0x111827);
        var line = new T.Mesh(new T.BoxGeometry(0.06, 0.03, 1.1), markMat);
        line.position.set(0, 0.03, 0);
        var side = id === "red" ? -1 : 1;
        var post = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.8, 8), markMat);
        post.position.set(0, 0.4, side * 0.55);
        var lbl = M.label("📸 사진 속 위치", { height: 0.38, border: c.color });
        lbl.position.set(0, 1.0, side * 0.55);
        mg.add(line, post, lbl);
        mg.position.set(0, 0, LANE_Z[id]);
        mg.visible = false;
        root.add(mg);
        photoMarks[id] = mg;
      });
      function setMarks(dist) {
        CAR_IDS.forEach(function (id) {
          photoMarks[id].visible = !!dist;
          if (dist) photoMarks[id].position.x = dist[id] * U;
        });
      }
      function setCar(id, cm) {
        var c = cars[id];
        var d = cm - c.cm;
        c.cm = cm;
        c.g.position.x = cm * U;
        c.wheels.forEach(function (w) {
          w.rotation.y -= (d * U) / 0.14;
        });
      }

      // 삼각대 + 스마트 기기(경주로 옆, 경주로 전체가 나란히 보이도록)
      var tripod = new T.Group();
      var legMat = M.material(0x2f3640, { metalness: 0.3 });
      for (var i = 0; i < 3; i++) {
        var leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.3, 8), legMat);
        var a = (i / 3) * Math.PI * 2;
        leg.position.set(Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55);
        leg.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
        tripod.add(leg);
      }
      var head = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.3, 12), legMat);
      head.position.y = 3.2;
      tripod.add(head);
      var phone = new T.Group();
      var phoneBody = new T.Mesh(new T.BoxGeometry(1.7, 0.85, 0.1), M.material(0x1c1f24));
      var screenMat = M.material(0x6f8fb3, { emissive: 0x000000, roughness: 0.2 });
      var screen = new T.Mesh(new T.PlaneGeometry(1.55, 0.72), screenMat);
      screen.position.z = 0.055;
      phone.add(phoneBody, screen);
      phone.position.y = 3.75;
      phone.rotation.x = -0.25; // 화면이 경주로 쪽(앞)을 향하게 기울임
      tripod.add(phone);
      tripod.position.set(12.5, 0, -4.6);
      root.add(tripod);
      var phoneLbl = M.label("스마트 기기(삼각대)", { height: 0.45 });
      phoneLbl.position.set(12.5, 4.8, -4.6);
      root.add(phoneLbl);

      // 좁은 화면(휴대폰·세로)에서는 더 가까이 다가가 자동차가 작게 보이지 않게 한다
      function near() {
        return container.clientWidth < 520 ? 0.3 : 0.42;
      }
      var host = container.parentNode;
      var ov = overlayEls(host);
      var selCar = null;

      function place(dist) {
        CAR_IDS.forEach(function (id) {
          setCar(id, dist ? dist[id] : 0);
        });
      }
      function flashPhone() {
        screenMat.emissive.set(0xffffff);
        return v.wait(180).then(function () {
          screenMat.emissive.set(0x000000);
        });
      }

      return {
        highlight: function (s) {
          selCar = s.car || null;
          CAR_IDS.forEach(function (id) {
            cars[id].measure.visible = id === selCar;
          });
          v.render();
        },
        run: async function (sel) {
          var t = Number(sel.time);
          var run = makeRun(t);
          setLastRun(run);
          await v.flyHome(300);
          place(null);
          setMarks(null);
          ov.setTimer("준비… 🏁");
          // 출발선 쪽으로 다가간 뒤, 달리는 동안 카메라가 두 자동차를 따라간다(자동차가 작게 보이지 않게)
          await v.focus([0.2, 0, 0], near(), 700);
          ov.setTimer("출발!");
          var spinning = true;
          await v.tween(t * 1000, function (e, lin) {
            CAR_IDS.forEach(function (id) {
              setCar(id, run.dist[id] * lin);
              if (spinning) cars[id].key.rotation.x += 0.12;
            });
            var want = ((run.dist.red + run.dist.blue) / 2) * U * lin + 0.2 - 0.4 * lin;
            var dx = want - v.controls.target.x;
            v.controls.target.x += dx;
            v.camera.position.x += dx;
            ov.setTimer(timeText(lin * t, t));
          });
          // 정한 시간이 된 '순간' 사진을 찍는다. 자동차는 멈추지 않고 계속 달린다.
          ov.shutter();
          flashPhone();
          setMarks(run.dist);
          ov.setTimer("📸 찰칵! " + t + "초가 된 순간을 찍었어요 (자동차는 계속 달려요)");
          await v.tween(OVERRUN * 1000, function (e, lin) {
            var mids = 0;
            CAR_IDS.forEach(function (id) {
              var cm = run.dist[id] + (afterCm(id, run) - run.dist[id]) * lin;
              setCar(id, cm);
              mids += cm / CAR_IDS.length;
              if (spinning) cars[id].key.rotation.x += 0.12;
            });
            var want = mids * U - 0.2;
            var dx = want - v.controls.target.x;
            v.controls.target.x += dx;
            v.camera.position.x += dx;
          });
          spinning = false;
          // 📸 표시(사진 속 위치)와 줄자 눈금이 함께 보이도록 다가간다
          var mid = ((run.dist.red + run.dist.blue) / 2) * U;
          await v.focus([mid - 0.4, 0, 0], near(), 500);
          await v.wait(500);
          ov.setTimer("");
        },
        showInstant: function () {
          if (!lastRun) return;
          var after = {};
          CAR_IDS.forEach(function (id) {
            after[id] = afterCm(id, lastRun);
          });
          place(after);
          setMarks(lastRun.dist);
          v.render();
        },
        clear: function () {
          place(null);
          setMarks(null);
          setLastRun(null);
          v.flyHome(400);
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          ov.remove();
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2. 실험하기 ───────── */
  function carIcon(id) {
    var c = CAR[id];
    var s = el("span", { class: "car-icon", "aria-hidden": "true", text: c.mark });
    s.style.background = c.color;
    return s;
  }
  function introNode() {
    var box = el("div", { class: "intro-body" });
    C.intro.forEach(function (line) {
      box.appendChild(S.rich(line, "p"));
    });
    return box;
  }
  var safety = el("details", { class: "ss-card safety" }, [
    el("summary", { text: "⚠️ 안전하게 실험해요" }),
    el(
      "ul",
      null,
      C.safety.map(function (t) {
        return el("li", { text: t });
      })
    ),
  ]);
  safety.open = true;

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: expRecords,
    toast: toast,
    intro: introNode(),
    introTitle: "🔎 실험 방법 알아 두기",
    modelNote: C.modelNote,
    clearLabel: "🧽 자동차를 출발선으로",
    clearMessage: "자동차를 출발선으로 옮겼어요. 기록은 그대로 남아 있어요.",
    runTitle: "동시에 출발시키고 사진 찍기",
    factors: [
      {
        id: "car",
        title: "거리를 잴 자동차 고르기",
        short: "잴 자동차",
        options: C.cars.map(function (c) {
          return {
            id: c.id,
            label: c.name,
            icon: function () {
              return carIcon(c.id);
            },
          };
        }),
        note: function () {
          return "두 자동차는 언제나 함께 동시에 출발해요. 고른 자동차의 이동 거리를 사진에서 읽어 기록해요.";
        },
      },
      {
        id: "time",
        title: "관찰 시간 고르기 (몇 초 뒤에 사진을 찍을까요?)",
        short: "관찰 시간",
        columns: 3,
        options: C.times.map(function (t) {
          return { id: String(t), label: t + "초" + (t === 5 ? " (교과서)" : "") };
        }),
      },
    ],
    phases: [
      {
        id: "M",
        name: "측정",
        lead: "자동차와 관찰 시간을 골라 두 자동차를 동시에 출발시키고, 사진을 확대해 이동 거리를 읽어 기록해요. 같은 조건을 3번씩 재요.",
        trials: C.trials,
        cells: (function () {
          var out = [];
          C.cars.forEach(function (c) {
            C.times.forEach(function (t) {
              out.push({ car: c.id, time: String(t) });
            });
          });
          return out;
        })(),
      },
    ],
    doneLead: "모든 조건을 3번씩 기록했어요. 더 재 보고 싶으면 자유롭게 다시 해 보세요. 다시 재면 사진 눈금과 차이가 커 보이는 회차가 먼저, 그런 회차가 없으면 가장 먼저 잰 회차가 바뀌어요.",
    cellKey: function (sel) {
      return cellKey(sel.car, sel.time);
    },
    runLabel: function (sel) {
      return "▶ 두 자동차 동시에 출발! (" + sel.time + "초 뒤 사진 찍기)";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 자동차를 눌러 고를 수도 있어요",
      tip2D: "2D 화면(경주로를 위에서 본 모형)이에요. 줄자 숫자는 50 cm마다 있어요. 📸 표시는 사진을 찍은 순간 자동차 앞부분이 있던 곳이에요. 자동차를 눌러 고를 수 있어요.",
    },
    observe: function (sel) {
      if (!lastRun) setLastRun(makeRun(sel.time));
      obsRun = { car: sel.car, time: Number(sel.time), actual: lastRun.dist[sel.car] };
      // 세 번 모두 잰 칸: 틀이 붙이는 두 문구("N번째 측정" + "가장 먼저 잰 기록이 바뀜")를 바뀔 회차 하나로 알려 준다.
      var key = cellKey(sel.car, sel.time);
      if (records.countOf(key) >= C.trials) {
        var no = expRecords.nextTrial(key, C.trials);
        var off = isOff(records.trials(key).filter(function (r) {
          return r.trial === no;
        })[0]);
        Promise.resolve().then(function () {
          var box = document.querySelector("#experiment-root .ss-observe");
          if (!box) return;
          box.querySelectorAll(".ss-obs-input > .ss-help").forEach(function (p) {
            if (/번째 측정이에요/.test(p.textContent)) p.parentNode.removeChild(p);
          });
          var msg = box.lastElementChild;
          if (msg && msg.classList.contains("ss-help"))
            msg.textContent = "이 조건은 3번 모두 쟀어요. 이번에 기록하면 " + no + "회 기록이 새 기록으로 바뀌어요" + (off ? "(사진 눈금과 차이가 커 보였던 회차예요)." : "(가장 먼저 잰 회차예요).");
        });
      }
      return {
        question: "📸 사진을 확대해 " + CAR[sel.car].name + " 앞부분이 줄자의 몇 cm에 있는지 확인하고, 반올림해 기록해요.",
        body: photoNode(sel),
        type: "numeric",
        fields: [{ id: "distance", label: CAR[sel.car].name + "의 이동 거리 (" + sel.time + "초 동안)", unit: "cm", step: 1, min: C.measure.min, max: C.measure.max }],
      };
    },
    makeRecord: function (sel, v) {
      return {
        car: sel.car,
        time: Number(sel.time),
        distance: Math.round(v.distance),
        actual: obsRun && obsRun.car === sel.car && obsRun.time === Number(sel.time) ? obsRun.actual : null,
      };
    },
    describeRecord: function (r) {
      return CAR[r.car].name + " " + r.time + "초 동안 " + r.distance + " cm (" + r.trial + "회)";
    },
    miniTable: {
      title: "기록한 조건 한눈에 보기",
      rows: C.cars.map(function (c) {
        return { id: c.id, label: c.mark + " " + c.short };
      }),
      cols: C.times.map(function (t) {
        return { id: String(t), label: t + "초" };
      }),
      sel: function (r, c) {
        return { car: r.id, time: c.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  /* ───────── 3. 기록·분석하기 ───────── */
  var nav;
  function mean(car, t) {
    return records.mean(cellKey(car, t), "distance");
  }
  function drawResults() {
    var rows = [];
    var flagged = [];
    C.cars.forEach(function (c) {
      C.times.forEach(function (t) {
        var tr = records.trials(cellKey(c.id, t));
        var row = { car: c.mark + " " + c.name, time: t + "초" };
        for (var i = 1; i <= C.trials; i++) {
          var r = tr.filter(function (x) {
            return x.trial === i;
          })[0];
          row["t" + i] = r ? r.distance : null;
          if (r && r.actual != null && Math.abs(r.distance - r.actual) >= 2.5) flagged.push(c.name + " " + t + "초 " + i + "회(" + r.distance + " cm)");
        }
        var m = mean(c.id, t);
        row.avg = m == null ? null : Math.round(m * 10) / 10;
        rows.push(row);
      });
    });
    S.TableChart.renderTable($("result-table"), {
      caption: "관찰 시간별 두 태엽 자동차의 이동 거리 (내 기록)",
      columns: [
        { id: "car", label: "자동차" },
        { id: "time", label: "관찰 시간" },
        { id: "t1", label: "1회", unit: "cm" },
        { id: "t2", label: "2회", unit: "cm" },
        { id: "t3", label: "3회", unit: "cm" },
        { id: "avg", label: "평균", unit: "cm", digits: 1 },
      ],
      rows: rows,
    });
    $("result-table").appendChild(el("p", { class: "ss-help", text: "평균은 세 번 잰 값을 더해 3으로 나눈 뒤 소수 첫째 자리까지 나타냈어요." }));
    var note = $("recheck-note");
    note.hidden = !flagged.length;
    note.textContent = flagged.length
      ? "🔎 사진의 눈금과 차이가 커 보이는 기록이 있어요: " + flagged.join(", ") + ". 실험하기에서 같은 조건을 다시 재면 이런 회차가 먼저 새 기록으로 바뀌어요."
      : "";

    var card = $("chart-card");
    card.textContent = "";
    card.appendChild(el("h3", { class: "sub-h first", text: "📊 막대그래프로 비교하기" }));
    var chartBox = el("div", { class: "bar-box" });
    card.appendChild(chartBox);
    S.TableChart.renderBar(
      chartBox,
      Object.assign({}, C.chart.bar, {
        categories: C.times.map(function (t) {
          return t + "초";
        }),
        series: C.cars.map(function (c) {
          return {
            name: c.mark + " " + c.name,
            values: C.times.map(function (t) {
              var m = mean(c.id, t);
              return m == null ? null : Math.round(m);
            }),
          };
        }),
      })
    );
    card.appendChild(
      S.rich("나란히 붙은 두 막대는 **같은 관찰 시간** 동안 두 자동차가 이동한 거리(평균, 반올림한 cm)예요. 묶음마다 왼쪽 막대가 ● 빨간색 자동차, 오른쪽 테두리 막대가 ■ 파란색 자동차예요. 같은 시간 안에서 두 막대의 길이를 비교해 보세요.", "p")
    );
    card.lastChild.className = "ss-help";
    drawMine();
  }

  /* 내 기록으로 더 빠른 자동차와 까닭 쓰기(실험 절차 ⑤, 지도서 211쪽). 학생이 직접 쓰고, 제출 뒤 내 평균값을 넣은 예시를 본다. */
  var mineStore = {
    get: function (k, d) {
      return store.get("mine-" + k, d);
    },
    set: function (k, v) {
      return store.set("mine-" + k, v);
    },
  };
  var mine = null;
  function drawMine() {
    var M = C.myCompare;
    var avg = {};
    CAR_IDS.forEach(function (id) {
      var m = mean(id, 5);
      avg[id] = m == null ? null : Math.round(m * 10) / 10;
    });
    var fast = avg.red != null && avg.blue != null ? (avg.red >= avg.blue ? "red" : "blue") : "red";
    var slow = fast === "red" ? "blue" : "red";
    var fmt = function (id) {
      return avg[id] == null ? "○" : String(avg[id]);
    };
    var model =
      "예: 더 빠른 태엽 자동차는 " + CAR[fast].name + "예요. 5초 동안 " + CAR[fast].name + "는 평균 " + fmt(fast) + " cm, " + CAR[slow].name + "는 평균 " + fmt(slow) +
      " cm를 이동했어요. 같은 5초 동안 " + CAR[fast].name + "가 이동한 거리가 더 길기 때문이에요.";
    mine = S.Conclude.render($("mine-root"), [{ id: M.id, kind: M.kind, prompt: M.prompt, model: model, compareTip: "내 답에 '같은 5초 동안'과 '이동한 거리가 더 길다'는 내용이 들어 있는지 비교해 보세요." }], mineStore, lesson.refresh, { minLength: M.minLength });
  }

  function mineDone() {
    var st = store.get("mine-conclude", {}) || {};
    return !!(st.mine && st.mine.submitted);
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
    var cv = conclude.values();
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened(),
      records: records.list().map(function (r) {
        return { car: r.car, time: r.time, trial: r.trial, distance: r.distance, photo: r.actual };
      }),
      analysis: analysis,
      myCompare: mine ? mine.values().mine : (store.get("mine-conclude", {}).mine || {}).text || "",
      conclusion: cv.conclusion,
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
      return ["기록한 측정: " + records.count() + "번", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return predict.isDone() || "예상하기의 두 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "자동차 2대 × 관찰 시간 3가지 = 6가지 조건을 3번씩 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "가지 완료)";
      },
      conclude: function () {
        if (!mineDone()) return "'내 기록으로 빠르기 비교하기'에 더 빠른 자동차와 까닭을 " + C.myCompare.minLength + "글자 이상 쓰고 제출해 주세요.";
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "결론과 발전 질문 2개를 모두 제출해 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: function () {
        return mineDone() && quiz.isDone();
      },
      conclude: conclude.isDone,
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: exp.activate,
      analyze: drawResults,
    },
  });
})();
