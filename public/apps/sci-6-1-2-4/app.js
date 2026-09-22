/*
 * app.js — sci-6-1-2-4 "같은 거리를 이동한 물체의 빠르기를 비교해 보자!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(출발선·결승선 색 테이프, 태엽 자동차 2대, 초시계 화면)
 *   ② 관찰 카드(멈춘 초시계 값을 그대로 적기, 앱 전용 확인)
 *   ③ 분석 표·막대그래프, 내 기록으로 채점하는 분석 질문  만 만든다.
 *
 * 시간 모형(개정 3, 2026-09-22 측정 1회·소수 첫째 자리):
 *   초시계는 처음부터 소수 첫째 자리(1/10초)로 표시한다. 100 cm 걸린 시간 = 지도서 예시 값 그대로(초록 4.2초, 노랑 5.8초).
 *   무작위 차이·반올림 단계 없음. 자동차는 그 시간 동안 일정한 빠르기로 움직인다(애니메이션 = 실제 시간).
 * 이 차시는 다음 차시 용어("속력", 거리 ÷ 시간)를 화면에 쓰지 않는다.
 *
 * 2026-09-22 개정(질문 축소·7분 기준): 이동 거리는 100 cm 하나(D)만 쓰고 거리 고르기를 없앴다.
 * 자동차 2대 × 1번 측정(평균 없음), 분석은 표 + 막대그래프 + 보기 2개, 정리하기에 결론 1개와 선택 한 줄(궁금한 점)만 둔다.
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

  var CARS = {};
  C.cars.forEach(function (c) {
    CARS[c.id] = c;
  });
  var CAR_IDS = C.cars.map(function (c) {
    return c.id;
  });
  var D = C.baseDistance; // 이 앱이 쓰는 유일한 이동 거리(100 cm)

  /* ───────── 시간 계산(모형) ───────── */
  // 걸린 시간(1/10초 단위 정수): 100 cm에서 초록 4.2초 → 42, 노랑 5.8초 → 58. 잴 때마다 같다.
  function measureTs(carId) {
    return Math.round(CARS[carId].ref100 * 10);
  }
  function tsText(ts) {
    return (ts / 10).toFixed(1);
  }
  function round1(x) {
    return x == null ? null : Math.round(x * 10 + 1e-9) / 10;
  }
  function keyOf(car, dist) {
    return car + "|" + Number(dist);
  }
  function distLabel(d) {
    return Number(d).toFixed(1) + " cm"; // 화면의 수치는 소수 첫째 자리로 통일(100.0 cm)
  }
  function carLabel(id) {
    return CARS[id].mark + " " + CARS[id].name;
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.car, r.distance);
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  // 자동차마다 한 번 잰 걸린 시간(마지막 기록)
  function timeOf(car, dist) {
    var r = records.get(keyOf(car, dist));
    return r ? round1(r.time) : null;
  }
  // 한 거리에서 걸린 시간이 더 짧은(더 빠른) 자동차: "green" | "yellow" | "same" | null(기록 부족)
  function fasterAt(dist) {
    var g = timeOf("green", dist);
    var y = timeOf("yellow", dist);
    if (g == null || y == null) return null;
    return g < y ? "green" : y < g ? "yellow" : "same";
  }

  /* ───────── 분석 질문: 내 기록으로 채점 ───────── */
  C.quiz.forEach(function (q) {
    if (q.dataGraded === "shorterAt100") {
      q.grade = function (choice) {
        var ans = fasterAt(D) || q.answer[0];
        return choice.length === 1 && choice[0] === ans;
      };
    }
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(결론 + 선택 한 줄) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, function () {
    lesson.refresh();
    showFinish();
  });
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
  // 궁금한 점은 선택 입력 한 줄: 공통 틀의 여러 줄 입력칸을 한 줄로 쓰고, Enter로 줄을 바꾸지 않게 한다.
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
  // 결론을 제출한 뒤에 궁금한 점(선택)과 '학습 마치기'를 보여 준다.
  function showFinish() {
    $("finish-wrap").hidden = !conclude.isDone();
  }
  showFinish();

  /* ───────── 2. 실험하기 ───────── */
  function paragraphs(list) {
    var box = el("div");
    list.forEach(function (p) {
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

  function carIcon(id) {
    var i = el("span", { class: "car-icon car-" + id, "aria-hidden": "true", text: CARS[id].mark });
    return i;
  }

  // 방금 잰 초시계 값(관찰 카드에서 씀)과 칸마다 마지막 초시계 값(화면 복원용), 1/10초 단위
  var pending = null; // { key, ts }
  var lastTs = store.get("lastTs", {}) || {};
  function rememberTs(key, ts) {
    lastTs[key] = ts;
    store.set("lastTs", lastTs);
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: paragraphs(C.intro.paragraphs),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🚗 자동차를 출발선으로",
    clearMessage: "두 자동차를 출발선에 다시 놓았어요. 기록은 그대로 남아 있어요.",
    runTitle: "출발시키고 시간 재기",
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
              return carIcon(c.id);
            },
          };
        }),
      },
    ],
    phases: [
      {
        id: "M",
        name: "측정",
        lead: "자동차를 하나 골라 출발시키고, 두 자동차를 모두 기록해요.",
        trials: 1, // 자동차마다 한 번
        cells: C.cars.map(function (c) {
          return { car: c.id };
        }),
      },
    ],
    doneLead: "두 자동차를 모두 기록했어요. '다음 단계'로 가서 내 기록을 살펴봐요.",
    cellKey: function (sel) {
      return keyOf(sel.car, D);
    },
    runLabel: function (sel) {
      return "▶ 출발! " + CARS[sel.car].name + " · " + distLabel(D);
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 자동차를 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형, 위에서 본 모습)이에요. 자동차를 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, v) {
      var key = keyOf(sel.car, D);
      var ts = pending && pending.key === key ? pending.ts : lastTs[key];
      return { car: sel.car, distance: D, time: round1(v.time), reading: ts == null ? null : ts / 10 };
    },
    describeRecord: function (r) {
      return CARS[r.car].name + " " + distLabel(r.distance) + " → " + r.time.toFixed(1) + "초";
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.cars.map(function (c) {
        return { id: c.id, label: c.name };
      }),
      cols: [{ id: String(D), label: distLabel(D) }],
      sel: function (r) {
        return { car: r.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  /* ── 관찰·기록 카드: 멈춘 초시계 값(소수 첫째 자리)을 보고 그대로 적기 ── */
  var check = null; // { expect: 1/10초 정수, msg }
  function observeCard(sel) {
    var key = keyOf(sel.car, D);
    var ts = pending && pending.key === key ? pending.ts : null;
    if (ts == null) {
      // 애니메이션이 중간에 끝난 경우 등: 이번 측정값을 여기서 정한다
      ts = measureTs(sel.car);
      pending = { key: key, ts: ts };
      rememberTs(key, ts);
    }
    var body = el("div", { class: "obs-body" });
    body.appendChild(
      el("div", { class: "obs-watch", role: "img", "aria-label": "멈춘 초시계: " + tsText(ts) + "초" }, [
        el("span", { class: "obs-watch-icon", "aria-hidden": "true", text: "⏱" }),
        el("span", { class: "obs-watch-num", "aria-hidden": "true", text: tsText(ts) }),
        el("span", { class: "obs-watch-unit", "aria-hidden": "true", text: "초" }),
      ])
    );
    body.appendChild(el("p", { class: "ss-help", text: CARS[sel.car].name + "가 " + distLabel(D) + "를 이동하는 데 걸린 시간이에요." }));
    var msg = el("p", { class: "read-msg", "aria-live": "polite" });
    body.appendChild(msg);
    check = { expect: ts, msg: msg };
    return {
      question: "초시계에 나온 걸린 시간을 적어요.",
      body: body,
      type: "numeric",
      fields: [{ id: "time", label: "걸린 시간", unit: "초", step: C.measure.step, min: C.measure.min, max: C.measure.max }],
    };
  }
  // 공통 틀의 입력 확인(범위) 뒤에, 초시계 값과 같은지 앱이 한 번 더 확인한다(입력 이벤트가 위로 올라올 때).
  $("experiment-root").addEventListener("input", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("ss-num-input") || !check) return;
    var btn = document.querySelector("#experiment-root .ss-observe .ss-btn-primary");
    var raw = t.value.trim();
    var v = raw === "" ? NaN : Number(raw);
    var ok = false;
    var text = "";
    if (raw === "") text = "";
    else if (!isFinite(v)) text = "숫자로 적어 주세요.";
    else if (Math.abs(v * 10 - check.expect) < 1e-6) {
      ok = true;
      text = "✅ 잘 읽었어요. '기록하기'를 눌러요.";
    } else text = "초시계에 나온 숫자를 다시 확인해 보세요.";
    check.msg.textContent = text;
    check.msg.className = "read-msg" + (text ? (ok ? " is-ok" : " is-bad") : "");
    t.setAttribute("aria-invalid", String(!ok && raw !== ""));
    if (btn && !ok) btn.disabled = true;
  });

  // 공통 틀은 관찰 카드가 처음 뜰 때 빈 입력칸에도 aria-invalid="true"(빨간 테두리)를 붙인다(review m3).
  // 아직 아무것도 적지 않은 칸은 '틀림'으로 보이지 않게 앱에서 되돌린다(기록 버튼은 꺼진 채로 둔다).
  // 틀 반영 제안: science-sim/experiment.js checkNumeric에서 raw === ""이면 aria-invalid="false".
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var t = m.target;
        if (t.classList && t.classList.contains("ss-num-input") && t.value === "" && t.getAttribute("aria-invalid") === "true") t.setAttribute("aria-invalid", "false");
      });
    }).observe($("experiment-root"), { subtree: true, attributes: true, attributeFilter: ["aria-invalid"] });
  }

  /* ── 지금 고른 자동차·거리를 새로고침 뒤에도 되살린다(앱 전용, 공통 틀은 선택을 저장하지 않음) ── */
  function rememberSel(s) {
    if (!s || s.car == null) return;
    store.set("curSel", { car: s.car });
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (!saved) return;
    if (saved.car && CARS[saved.car]) exp.select({ car: saved.car });
  }

  /* ── 두 화면이 함께 쓰는 것: 초시계 화면, "출발!" 알림 ── */
  function makeStopwatch() {
    var num = el("span", { class: "sw-num", text: "0.0" });
    var state = el("span", { class: "sw-state", text: "준비" });
    var node = el("div", { class: "sw-hud is-ready", "aria-hidden": "true" }, [el("span", { class: "sw-icon", text: "⏱" }), num, el("span", { class: "sw-unit", text: "초" }), state]);
    var live = el("p", { class: "ss-sr", "aria-live": "polite" });
    var shout = el("div", { class: "sw-shout", "aria-hidden": "true", hidden: true });
    return {
      nodes: [node, live, shout],
      set: function (ts, st) {
        num.textContent = tsText(ts || 0);
        node.className = "sw-hud is-" + st;
        state.textContent = st === "run" ? "재는 중" : st === "stop" ? "멈춤" : "준비";
      },
      say: function (text) {
        live.textContent = text;
      },
      shout: function (text, ms) {
        shout.textContent = text;
        shout.hidden = false;
        shout.classList.remove("is-pop");
        void shout.offsetWidth;
        shout.classList.add("is-pop");
        clearTimeout(shout._t);
        shout._t = setTimeout(function () {
          shout.hidden = true;
        }, ms || 900);
      },
      remove: function () {
        [node, live, shout].forEach(function (n) {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
      },
    };
  }
  // 두 화면 공통 상태: 결승선 거리, 자동차별로 결승선을 지난 채 멈춰 있는 거리
  function sceneState() {
    return { finish: C.baseDistance, atFinish: {} };
  }
  function showSelReading(sw, s) {
    if (s && s.car && lastTs[keyOf(s.car, D)] != null) sw.set(lastTs[keyOf(s.car, D)], "stop");
    else sw.set(0, "ready");
  }

  /* ───────── 2D 대체 화면: 위에서 본 트랙 ───────── */
  var SPAN_MIN = -35; // cm (출발선 뒤)
  var SPAN_MAX = 175; // cm
  var CAR_LEN = 16; // cm(모형)
  var COAST = 6; // cm: 결승선을 지난 뒤 멈추는 거리(측정과 관계없음)
  function pct(cm) {
    return ((cm - SPAN_MIN) / (SPAN_MAX - SPAN_MIN)) * 100;
  }
  function build2D(root, ctx) {
    var st = sceneState();
    var disposed = false;
    var sw = makeStopwatch();
    var track = el("div", { class: "t2-track", role: "group", "aria-label": "위에서 본 트랙(2D 모형)" });
    var startLine = el("div", { class: "t2-line t2-start", "aria-hidden": "true" }, [el("span", { class: "t2-line-label", text: "출발선" })]);
    startLine.style.left = pct(0) + "%";
    var finishLabel = el("span", { class: "t2-line-label" });
    var finishLine = el("div", { class: "t2-line t2-finish", "aria-hidden": "true" }, [finishLabel]);
    track.appendChild(startLine);
    track.appendChild(finishLine);
    var cars = {};
    C.cars.forEach(function (c, i) {
      var lane = el("div", { class: "t2-lane t2-lane-" + (i + 1) });
      var b = el(
        "button",
        {
          type: "button",
          class: "t2-car car-" + c.id,
          "aria-label": c.name + " 고르기",
          onclick: function () {
            ctx.onPick({ car: c.id });
          },
        },
        [el("span", { class: "t2-car-mark", "aria-hidden": "true", text: c.mark }), el("span", { class: "t2-car-name", text: c.short })]
      );
      b.style.width = "max(44px, " + (CAR_LEN / (SPAN_MAX - SPAN_MIN)) * 100 + "%)";
      lane.appendChild(b);
      track.appendChild(lane);
      cars[c.id] = { btn: b, front: 0 };
    });
    var dim = el("div", { class: "t2-dim", "aria-hidden": "true" }, [el("span", { class: "t2-dim-text" })]);
    track.appendChild(dim);
    var caption = el("p", { class: "t2-caption", "aria-live": "polite" });
    var box = el("div", { class: "t2-wrap" }, [el("div", { class: "t2-head" }, sw.nodes.slice(0, 1)), track, caption, sw.nodes[1], sw.nodes[2]]);
    root.appendChild(box);

    function place(id, frontCm) {
      cars[id].front = frontCm;
      cars[id].btn.style.left = pct(frontCm) + "%"; // 버튼의 오른쪽 끝 = 자동차 앞부분(transform으로 맞춤)
    }
    function layout() {
      finishLine.style.left = pct(st.finish) + "%";
      finishLabel.textContent = "결승선";
      dim.style.left = pct(0) + "%";
      dim.style.width = pct(st.finish) - pct(0) + "%";
      dim.firstChild.textContent = "↔ " + distLabel(st.finish);
      CAR_IDS.forEach(function (id) {
        place(id, st.atFinish[id] === st.finish ? st.finish + COAST : 0);
      });
      caption.textContent = "출발선에서 결승선까지 " + distLabel(st.finish) + " (모형)";
    }
    var selNow = {};
    layout();

    function animate(ms, fn) {
      return new Promise(function (resolve) {
        var t0 = null;
        if (document.hidden || disposed) {
          fn(1);
          resolve();
          return;
        }
        (function tick(now) {
          if (disposed) {
            resolve();
            return;
          }
          if (t0 == null) t0 = now;
          var t = Math.min(1, (now - t0) / ms);
          fn(t);
          if (t >= 1) resolve();
          else requestAnimationFrame(tick);
        })(performance.now());
      });
    }
    function wait(ms) {
      return new Promise(function (r) {
        setTimeout(r, ms);
      });
    }

    return {
      highlight: function (s) {
        selNow = Object.assign({}, s);
        rememberSel(s);
        CAR_IDS.forEach(function (id) {
          cars[id].btn.classList.toggle("is-sel", s.car === id);
          cars[id].btn.setAttribute("aria-pressed", String(s.car === id));
        });
        layout();
        showSelReading(sw, s);
      },
      run: async function (sel) {
        var d = D;
        var key = keyOf(sel.car, d);
        pending = null; // 실행이 중간에 끊겨도 이전 초시계 값을 다시 쓰지 않게(review i3)
        var ts = measureTs(sel.car);
        st.finish = d;
        delete st.atFinish[sel.car];
        layout();
        sw.set(0, "ready");
        sw.say("준비");
        await wait(600);
        sw.shout("출발!", 800);
        sw.say("출발!");
        await animate(ts * 100, function (t) {
          place(sel.car, d * t);
          sw.set(Math.min(ts, Math.floor(ts * t)), "run");
        });
        sw.set(ts, "stop");
        finishLine.classList.add("is-flash");
        setTimeout(function () {
          finishLine.classList.remove("is-flash");
        }, 700);
        sw.say("앞부분이 결승선에 닿았어요. 초시계 " + tsText(ts) + "초에서 멈춤");
        await animate(350, function (t) {
          place(sel.car, d + COAST * (1 - (1 - t) * (1 - t)));
        });
        st.atFinish[sel.car] = d;
        pending = { key: key, ts: ts };
        rememberTs(key, ts);
      },
      showInstant: function (sel) {
        st.atFinish[sel.car] = D;
        layout();
      },
      clear: function () {
        st.atFinish = {};
        layout();
        sw.set(0, "ready");
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
        sw.remove();
      },
    };
  }

  /* ───────── 3D 화면 ───────── */
  var U = 10; // 1 단위 = 10 cm
  var START_X = -8;
  function fx(cm) {
    return START_X + cm / U;
  }
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 22, depth: 9, center: [-0.6, 0, 0.3] },
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var st = sceneState();
      var sw = makeStopwatch();
      sw.nodes.forEach(function (n) {
        container.appendChild(n);
      });

      // 교실 바닥(모형)
      var floor = M.table(32, 16, 0xd9c7a3);
      floor.position.x = -0.6;
      v.root.add(floor);
      v.onThemeChange(function (dark) {
        floor.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      var LANE_Z = { green: -1.5, yellow: 1.5 };
      // 색 테이프 출발선·결승선(바닥에 붙인 얇은 띠, 폭 약 2.5 cm)
      function tape(color) {
        return new T.Mesh(new T.BoxGeometry(0.25, 0.03, 6), M.material(color, { roughness: 0.6 }));
      }
      var startTape = tape(0x2f6fd6);
      startTape.position.set(START_X, 0.015, 0);
      v.root.add(startTape);
      var startLabel = M.label("출발선", { height: 1.0, bold: true, border: "#2f6fd6" });
      startLabel.position.set(START_X, 0.6, -3.9);
      v.root.add(startLabel);

      var finishGroup = new T.Group();
      var finishTape = tape(0xd8434f);
      finishTape.position.y = 0.015;
      finishGroup.add(finishTape);
      var finishLabel = M.label("결승선", { height: 1.0, bold: true, border: "#d8434f" });
      finishLabel.position.set(0, 0.6, -3.9);
      finishGroup.add(finishLabel);
      v.root.add(finishGroup);

      // 거리 표시(출발선 ↔ 결승선): 가는 선 + 거리 이름표(거리마다 하나씩 만들어 두고 보이기만 바꾼다)
      var dimMat = new T.MeshBasicMaterial({ color: 0x33404f });
      var dimBar = new T.Mesh(new T.BoxGeometry(1, 0.02, 0.05), dimMat);
      dimBar.position.set(0, 0.03, 3.1);
      v.root.add(dimBar);
      var dimLabels = {};
      [D].forEach(function (d) {
        var l = M.label("↔ " + distLabel(d), { height: 0.95, bold: true });
        l.position.set(fx(d / 2), 0.5, 3.75);
        l.visible = false;
        v.root.add(l);
        dimLabels[d] = l;
      });
      v.onThemeChange(function (dark) {
        dimMat.color.set(dark ? 0xdbe3ee : 0x33404f);
      });

      // 줄자는 결승선을 표시할 때만 쓰고 말아서 보관(215쪽) → 트랙 옆에 말린 줄자
      var tapeCase = new T.Group();
      var caseBody = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.28, 28), M.material(0x3a4250));
      caseBody.position.y = 0.14;
      var caseRing = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.3, 28), M.material(0xf2a93b));
      caseRing.position.y = 0.15;
      var tab = new T.Mesh(new T.BoxGeometry(0.25, 0.05, 0.14), M.material(0xf2a93b));
      tab.position.set(0.5, 0.05, 0);
      tapeCase.add(caseBody, caseRing, tab);
      tapeCase.position.set(fx(75), 0, -5.2);
      v.root.add(tapeCase);
      var tapeLabel = M.label("줄자(말아서 보관)", { height: 0.7 });
      tapeLabel.position.set(fx(75), 0.95, -5.2);
      v.root.add(tapeLabel);

      // 태엽 자동차(모형): 몸체 + 지붕 + 바퀴 4개 + 태엽 열쇠. 무리의 원점 = 자동차 앞부분
      var cars = {};
      var BODY_L = 1.5;
      C.cars.forEach(function (c) {
        var g = new T.Group();
        var bodyMat = M.material(c.color, { roughness: 0.45 });
        var body = new T.Mesh(new T.BoxGeometry(BODY_L, 0.42, 0.9), bodyMat);
        body.position.set(-BODY_L / 2, 0.42, 0);
        var roof = new T.Mesh(new T.BoxGeometry(0.75, 0.36, 0.78), M.material(c.color, { roughness: 0.35 }));
        roof.position.set(-BODY_L * 0.58, 0.8, 0);
        var win = new T.Mesh(new T.BoxGeometry(0.04, 0.24, 0.66), M.material(0x9fc6e8, { roughness: 0.1 }));
        win.position.set(-BODY_L * 0.58 + 0.39, 0.82, 0);
        g.add(body, roof, win);
        var wheelGeo = new T.CylinderGeometry(0.22, 0.22, 0.14, 18);
        var wheelMat = M.material(0x2a2f38, { roughness: 0.8 });
        var hubMat = M.material(0xdfe5ec);
        var wheels = [];
        [-0.3, -1.2].forEach(function (x) {
          [-0.49, 0.49].forEach(function (z) {
            var w = new T.Group();
            var tire = new T.Mesh(wheelGeo, wheelMat);
            tire.rotation.x = Math.PI / 2;
            var hub = new T.Mesh(new T.BoxGeometry(0.26, 0.06, 0.16), hubMat);
            w.add(tire, hub);
            w.position.set(x, 0.22, z);
            g.add(w);
            wheels.push(w);
          });
        });
        // 태엽 열쇠(뒤쪽 위)
        var keyStem = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.3, 8), M.material(0xb8c0c8, { metalness: 0.5, roughness: 0.3 }));
        keyStem.rotation.z = Math.PI / 2;
        keyStem.position.set(-BODY_L - 0.12, 0.5, 0);
        var keyWing = new T.Mesh(new T.BoxGeometry(0.05, 0.34, 0.14), M.material(0xb8c0c8, { metalness: 0.5, roughness: 0.3 }));
        keyWing.position.set(-BODY_L - 0.28, 0.5, 0);
        g.add(keyStem, keyWing);
        var tag = M.label(c.mark + " " + c.name, { height: 0.9, bold: true, border: c.color });
        tag.position.set(-BODY_L / 2, 1.75, 0);
        g.add(tag);
        // 고른 자동차 표시(바닥의 고리)
        var ring = new T.Mesh(new T.TorusGeometry(1, 0.05, 8, 40), new T.MeshBasicMaterial({ color: 0xf2a93b }));
        ring.rotation.x = -Math.PI / 2;
        ring.scale.set(1.15, 0.72, 1);
        ring.position.set(-BODY_L / 2, 0.03, 0);
        ring.visible = false;
        g.add(ring);
        g.position.set(START_X, 0, LANE_Z[c.id]);
        v.root.add(g);
        v.pickable(g, { car: c.id });
        cars[c.id] = { group: g, wheels: wheels, ring: ring, tag: tag, spin: 0 };
      });

      // 좁은 화면(휴대폰)에서는 이름표 글씨가 너무 작아지므로 이름표를 키우고, 줄자 이름표는 숨긴다
      // (줄자 보관은 '안전 수칙' 카드에서 설명한다). review m4
      var tags = [startLabel, finishLabel, tapeLabel].concat(
        [dimLabels[D]],
        CAR_IDS.map(function (id) {
          return cars[id].tag;
        })
      ).map(function (sp) {
        return { sp: sp, sx: sp.scale.x, sy: sp.scale.y, y: sp.position.y };
      });
      var labelK = 0;
      function fitLabels() {
        var narrow = (container.clientWidth || 1024) < 480; // 휴대폰(375 px 등). 태블릿 가로의 3D 칸(약 560 px)은 그대로
        var k = narrow ? 1.45 : 1;
        tapeLabel.visible = !narrow;
        if (k === labelK) return;
        labelK = k;
        tags.forEach(function (t) {
          t.sp.scale.set(t.sx * k, t.sy * k, 1);
          t.sp.position.y = t.y + (t.sy * (k - 1)) / 2; // 키운 만큼 위로 올려 바닥·자동차에 묻히지 않게
        });
        v.render();
      }
      fitLabels();
      var labelRO = window.ResizeObserver ? new ResizeObserver(fitLabels) : null;
      if (labelRO) labelRO.observe(container);

      function place(id, x) {
        var o = cars[id];
        var dx = x - o.group.position.x;
        o.group.position.x = x;
        o.spin -= dx / 0.22; // 바퀴가 굴러가는 모습
        o.wheels.forEach(function (w) {
          w.rotation.z = o.spin;
        });
      }
      var COAST_U = COAST / U;
      function layout() {
        var x = fx(st.finish);
        finishGroup.position.x = x;
        dimBar.scale.x = st.finish / U;
        dimBar.position.x = (START_X + x) / 2;
        dimLabels[D].visible = D === st.finish;
        CAR_IDS.forEach(function (id) {
          place(id, st.atFinish[id] === st.finish ? x + COAST_U : START_X);
        });
      }
      layout();

      function flash() {
        var base = new T.Color(0xd8434f);
        var hi = new T.Color(0xffd166);
        return v.tween(700, function (e, t) {
          var k = Math.sin(t * Math.PI * 3) * (1 - t);
          finishTape.material.color.copy(base).lerp(hi, Math.abs(k));
        });
      }

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          rememberSel(s);
          CAR_IDS.forEach(function (id) {
            cars[id].ring.visible = s.car === id;
          });
          layout();
          showSelReading(sw, s);
          v.render();
        },
        run: async function (sel) {
          var d = D;
          var key = keyOf(sel.car, d);
          pending = null; // 실행이 중간에 끊겨도 이전 초시계 값을 다시 쓰지 않게(review i3)
          var ts = measureTs(sel.car);
          var car = cars[sel.car];
          st.finish = d;
          await v.flyHome(300);
          // 이 자동차를 출발선에 다시 놓는다(다른 자동차는 그대로)
          var fromX = car.group.position.x;
          delete st.atFinish[sel.car];
          var keep = car.group.position.x;
          layout();
          if (Math.abs(fromX - START_X) > 0.01) {
            place(sel.car, keep);
            await v.tween(450, function (e) {
              place(sel.car, keep + (START_X - keep) * e);
            });
          }
          sw.set(0, "ready");
          sw.say("준비");
          await v.wait(600);
          sw.shout("출발!", 800);
          sw.say("출발!");
          var x1 = fx(d);
          // 실제 시간 그대로: 초시계 값(ts/10초) 동안 일정한 빠르기로 달린다
          await v.tween(ts * 100, function (e, t) {
            place(sel.car, START_X + (x1 - START_X) * t);
            sw.set(Math.min(ts, Math.floor(ts * t)), "run");
          });
          sw.set(ts, "stop");
          sw.say("앞부분이 결승선에 닿았어요. 초시계 " + tsText(ts) + "초에서 멈춤");
          var fl = flash();
          await v.tween(380, function (e, t) {
            place(sel.car, x1 + COAST_U * (1 - (1 - t) * (1 - t)));
          });
          await fl;
          st.atFinish[sel.car] = d;
          pending = { key: key, ts: ts };
          rememberTs(key, ts);
        },
        showInstant: function (sel) {
          st.atFinish[sel.car] = D;
          layout();
          v.render();
        },
        clear: function () {
          st.atFinish = {};
          layout();
          sw.set(0, "ready");
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          if (labelRO) labelRO.disconnect();
          sw.remove();
          v.dispose();
        },
      };
    });
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  function drawResults() {
    var T = S.TableChart;
    var rows = C.cars.map(function (c) {
      return { car: carLabel(c.id), time: timeOf(c.id, D) };
    });
    var cols = [
      { id: "car", label: "자동차" },
      { id: "time", label: "걸린 시간", unit: "초", digits: 1 },
    ];
    T.renderTable($("result-table"), { caption: "태엽 자동차가 " + distLabel(D) + "를 이동하는 데 걸린 시간 (내 기록)", columns: cols, rows: rows });

    var bar = $("bar-card");
    bar.textContent = "";
    var barRoot = el("div");
    bar.appendChild(barRoot);
    T.renderBar(
      barRoot,
      Object.assign({}, C.chart.bar, {
        categories: [distLabel(D)],
        series: C.cars.map(function (c) {
          return { name: c.name, values: [timeOf(c.id, D)] };
        }),
      })
    );
    bar.appendChild(el("p", { class: "trend-note", text: "막대가 짧을수록 결승선까지 걸린 시간이 짧아요." }));
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
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
    var times = { distanceCm: D };
    C.cars.forEach(function (c) {
      times[c.name] = timeOf(c.id, D);
    });
    return {
      predict: predict.values(),
      records: records.list().map(function (r) {
        return { car: CARS[r.car] ? CARS[r.car].name : r.car, distanceCm: r.distance, time: r.time, stopwatch: r.reading };
      }),
      times: [times],
      analysis: analysis,
      conclusion: cv.conclusion,
      curiosity: curiosity.value(),
    };
  }

  lesson.finish({
    stage: "conclude",
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    canFinish: function () {
      return conclude.isDone() || "결론을 먼저 적고 제출해 주세요.";
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
  lesson.nav({
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
        return exp.allDone() || "두 자동차를 모두 기록해야 넘어갈 수 있어요. (기록한 자동차: " + p.done + "/" + p.total + ")";
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
