/*
 * app.js — sci-6-2-1-5 "계절 변화의 원인을 찾아라!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(전등, 공전 궤도와 가·나·다·라, 자전축을 수직/기울임으로 둔 지구본, 우리나라의 태양 고도 측정기와 그림자)
 *   ② 관찰 카드(값 패널: 그림자 길이 + 확대 눈금, 타이핑 없이 '기록하기')
 *   ③ 분석 표·막대그래프, 정리하기의 오개념 카드·선택 읽을거리  만 만든다.
 *
 * 과학 규칙(spec.md 1.4절·개정 1):
 *   - 자전축 방향은 공전 내내 같은 방향(우주 기준)을 향한다. 지구본의 '자리'와 '기울기'를 다른 트랜스폼으로 나눠
 *     궤도를 따라 자리만 옮기고 기울기 그룹은 절대 돌리지 않는다.
 *   - 공전은 위에서 볼 때 시계 반대 방향(서→동): 가 → 나 → 다 → 라.
 *   - 기울임일 때 나에서는 북반구가 전등 쪽으로 기울고(여름, 그림자 0.8 cm), 라에서는 반대쪽으로 기운다(겨울, 3.5 cm).
 *   - 각 위치에서 측정기가 전등을 정면으로 향하도록(태양이 남중할 때) 지구본을 자전시킨 뒤 그림자를 보여 준다.
 *   - 빛은 평행광(DirectionalLight: 전등 → 지구본). 그림자의 '방향'은 이 빛으로 계산하고, '길이'는 교과서 예시 값을 그대로 쓴다.
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

  var TILTS = {};
  C.tilts.forEach(function (t) {
    TILTS[t.id] = t;
  });
  var POS = {};
  C.positions.forEach(function (p) {
    POS[p.id] = p;
  });
  var POS_IDS = C.positions.map(function (p) {
    return p.id;
  });
  var LAT = 37.5; // 우리나라 위도(°, 모형에서 측정기를 붙인 곳)

  function f1(x) {
    return x == null ? "" : Number(x).toFixed(1);
  }
  function keyOf(tilt, pos) {
    return tilt + "|" + pos;
  }
  function shadowOf(tilt, pos) {
    return C.shadows[tilt][pos];
  }
  function cellName(tilt, pos) {
    return POS[pos].name + " 위치 · " + TILTS[tilt].name;
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.tilt, r.pos);
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  function recOf(tilt, pos) {
    var r = records.get(keyOf(tilt, pos));
    return r ? Math.round(r.shadow * 10) / 10 : null;
  }

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(오개념 카드 + 결론 + 선택 한 줄) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);

  (function () {
    var card = $("misc-card");
    card.appendChild(el("h3", { class: "misc-title", text: C.misconceptionCard.title }));
    card.appendChild(el("p", { text: C.misconceptionCard.text }));
  })();
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
  $("south-note-text").textContent = C.curiosity.note;
  function showFinish() {
    $("finish-wrap").hidden = !conclude.isDone();
  }
  showFinish();

  /* ───────── 2. 실험하기 ───────── */
  function paragraphs(list) {
    var box = el("div", { class: "intro-body" });
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

  // 장면에서 지구본이 마지막으로 있던 칸(새로고침·화면 전환 뒤 그 자리로 되돌림)
  var globeAt = store.get("globeAt", null);
  function setGlobeAt(s) {
    globeAt = s ? { tilt: s.tilt, pos: s.pos } : null;
    store.set("globeAt", globeAt);
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: paragraphs(C.intro.paragraphs),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🌍 지구본을 가 위치로",
    clearMessage: "지구본을 가 위치로 옮겼어요. 기록은 그대로 남아 있어요.",
    runTitle: "지구본 옮기고 그림자 재기",
    busyLabel: "⏩ 지구본이 공전하는 중… 잘 지켜보세요",
    factors: [
      {
        id: "tilt",
        title: "자전축 조건 고르기",
        short: "자전축 조건",
        phaseTag: false,
        options: C.tilts.map(function (t) {
          return { id: t.id, label: t.name, icon: tiltIcon(t.id) };
        }),
      },
      {
        id: "pos",
        title: "위치 고르기",
        short: "위치",
        phaseTag: false,
        columns: 3,
        options: C.positions.map(function (p) {
          return { id: p.id, label: p.name + " 위치" };
        }),
      },
    ],
    phases: C.phases.map(function (ph) {
      return {
        id: ph.id,
        name: ph.name,
        lead: ph.lead,
        cells: POS_IDS.map(function (pid) {
          return { tilt: ph.tilt, pos: pid };
        }),
      };
    }),
    doneLead: "8칸을 모두 기록했어요. '다음 단계'로 가서 내 기록을 살펴봐요. 다시 재 보고 싶은 칸은 언제든 다시 해도 돼요.",
    cellKey: function (sel) {
      return keyOf(sel.tilt, sel.pos);
    },
    runLabel: function (sel) {
      return "▶ " + POS[sel.pos].name + " 위치로 옮겨 그림자 재기";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 가~라 글자를 눌러 위치를 고를 수도 있어요",
      tip2D: "2D 화면(모형, 비스듬히 위에서 본 모습)이에요. 가~라를 눌러 위치를 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel) {
      return { tilt: sel.tilt, pos: sel.pos, shadow: shadowOf(sel.tilt, sel.pos) };
    },
    describeRecord: function (r) {
      return cellName(r.tilt, r.pos) + " → " + f1(r.shadow) + " cm";
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.tilts.map(function (t) {
        return { id: t.id, label: t.name };
      }),
      cols: C.positions.map(function (p) {
        return { id: p.id, label: p.name };
      }),
      sel: function (r, c) {
        return { tilt: r.id, pos: c.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  // 자전축 조건 아이콘(모양으로도 구분: 곧은 막대 / 기운 막대)
  function tiltIcon(id) {
    return function () {
      var deg = TILTS[id].angleDeg;
      var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("viewBox", "0 0 28 28");
      s.setAttribute("class", "tilt-icon");
      s.setAttribute("aria-hidden", "true");
      var NS = "http://www.w3.org/2000/svg";
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", "14");
      c.setAttribute("cy", "14");
      c.setAttribute("r", "8");
      c.setAttribute("class", "ti-globe");
      var ln = document.createElementNS(NS, "line");
      [["x1", 14], ["y1", 2], ["x2", 14], ["y2", 26]].forEach(function (a) {
        ln.setAttribute(a[0], String(a[1]));
      });
      ln.setAttribute("class", "ti-axis");
      ln.setAttribute("transform", "rotate(" + deg + " 14 14)");
      s.appendChild(c);
      s.appendChild(ln);
      return s;
    };
  }

  /* ── 관찰·기록 카드: 값 패널(그림자 길이) + 확대 눈금 ── */
  function rulerSVG(value) {
    var NS = "http://www.w3.org/2000/svg";
    function n(tag, a, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(a).forEach(function (k) {
        e.setAttribute(k, a[k]);
      });
      if (text != null) e.textContent = text;
      return e;
    }
    var L = 34;
    var PX = 112; // 1 cm = 112 (확대)
    var MAXCM = 4;
    var W = L + MAXCM * PX + 56; // 끝 숫자 "4"와 단위 "cm"가 겹치지 않게 여유
    var svg = n("svg", { viewBox: "0 0 " + W + " 118", class: "ruler-svg", role: "img", "aria-label": "확대 눈금(모형): 그림자 길이 " + f1(value) + " cm" });
    // 측정기 판(흰 바탕) + 그림자 + 막대
    svg.appendChild(n("rect", { x: 6, y: 8, width: W - 12, height: 50, rx: 10, class: "rl-plate" }));
    svg.appendChild(n("rect", { x: L, y: 24, width: Math.max(2, value * PX), height: 18, rx: 4, class: "rl-shadow" }));
    svg.appendChild(n("circle", { cx: L, cy: 33, r: 9, class: "rl-stick" }));
    svg.appendChild(n("text", { x: L + value * PX + 8, y: 38, class: "rl-tag" }, "그림자 끝"));
    // 눈금(0.1 cm마다, 0.5 cm는 길게, 1 cm마다 숫자)
    svg.appendChild(n("line", { x1: L, y1: 64, x2: L + MAXCM * PX, y2: 64, class: "rl-base" }));
    for (var i = 0; i <= MAXCM * 10; i++) {
      var x = L + (i * PX) / 10;
      var h = i % 10 === 0 ? 20 : i % 5 === 0 ? 14 : 8;
      svg.appendChild(n("line", { x1: x, y1: 64, x2: x, y2: 64 + h, class: i % 10 === 0 ? "rl-tick rl-major" : "rl-tick" }));
      if (i % 10 === 0) svg.appendChild(n("text", { x: x, y: 104, "text-anchor": "middle", class: "rl-num" }, String(i / 10)));
    }
    svg.appendChild(n("text", { x: L + MAXCM * PX + 18, y: 104, class: "rl-unit" }, "cm"));
    // 그림자 끝 표시선
    svg.appendChild(n("line", { x1: L + value * PX, y1: 20, x2: L + value * PX, y2: 86, class: "rl-end" }));
    return svg;
  }
  function observeCard(sel) {
    var v = shadowOf(sel.tilt, sel.pos);
    var body = el("div", { class: "obs-body" }, [
      el("div", { class: "val-panel", role: "group", "aria-label": "값 패널" }, [
        el("span", { class: "val-cond", text: "📍 " + cellName(sel.tilt, sel.pos) + " · 태양이 남중할 때" }),
        el("span", { class: "val-main" }, [
          el("span", { class: "val-label", text: "그림자 길이" }),
          el("strong", { class: "val-num", text: f1(v) }),
          el("span", { class: "val-unit", text: "cm" }),
        ]),
      ]),
      el("figure", { class: "ruler-fig" }, [rulerSVG(v), el("figcaption", { class: "ss-help", text: "🔍 태양 고도 측정기를 확대한 눈금(모형) — 0.1 cm마다 눈금이 있어요." })]),
    ]);
    return {
      question: "값 패널의 그림자 길이를 확인하고 '기록하기'를 눌러요.",
      body: body,
      type: "numeric",
      fields: [], // 타이핑 없음: 값이 바로 보이고 기록하기가 켜진다
    };
  }

  /* ── 지금 고른 조건을 새로고침 뒤에도 되살린다(앱 전용, 공통 틀은 선택을 저장하지 않음) ── */
  function rememberSel(s) {
    if (!s || s.tilt == null || s.pos == null) return;
    store.set("curSel", { tilt: s.tilt, pos: s.pos });
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (saved && TILTS[saved.tilt] && POS[saved.pos]) exp.select(saved);
  }

  /* ── 두 화면이 함께 쓰는 것: 상태 표시(HUD) ── */
  // HUD는 '지구본이 지금 있는 곳'을 "🌍 지구본:"으로 밝히고, 고른 위치가 다르면 "▶를 누르면 옮겨 가요"를 따로 보여 준다(review 낮음 5).
  function makeHud() {
    var cond = el("span", { class: "hud-cond" });
    var val = el("span", { class: "hud-val" });
    var next = el("span", { class: "hud-next", hidden: true });
    var node = el("div", { class: "hud", "aria-hidden": "true" }, [cond, val, next]);
    var ff = el("div", { class: "hud-ff", "aria-hidden": "true", hidden: true, text: "⏩ 빨리 감기(모형) · 공전하는 중" });
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    var now = { tilt: null, pos: null, shadow: null };
    var selPos = null;
    function render() {
      cond.textContent =
        (now.pos ? "🌍 지구본: " + POS[now.pos].name + " 위치 · " : "") +
        (now.tilt ? TILTS[now.tilt].name + (TILTS[now.tilt].angleDeg ? " (23.5°)" : "") : "");
      val.textContent = now.shadow != null ? "그림자 " + f1(now.shadow) + " cm" : "";
      val.hidden = now.shadow == null;
      var diff = selPos && now.pos && selPos !== now.pos;
      next.textContent = diff ? "➡ 고른 위치: " + POS[selPos].name + " (▶를 누르면 옮겨 가요)" : "";
      next.hidden = !diff;
    }
    return {
      nodes: [node, ff, live],
      set: function (tilt, pos, shadow) {
        now = { tilt: tilt, pos: pos, shadow: shadow };
        render();
      },
      select: function (pos) {
        selPos = pos || null;
        render();
      },
      ff: function (on) {
        ff.hidden = !on;
      },
      say: function (t) {
        live.textContent = t;
      },
      remove: function () {
        [node, ff, live].forEach(function (x) {
          if (x.parentNode) x.parentNode.removeChild(x);
        });
      },
    };
  }

  // 공전 각도(°, 위에서 볼 때 시계 반대 방향) — 다음 목표까지 늘 앞으로(서→동) 돈다
  function forwardAngle(from, to) {
    var d = (((to - from) % 360) + 360) % 360;
    return from + d;
  }

  /* ───────── 2D 대체 화면: 비스듬히 위에서 본 궤도(교과서 그림처럼) ───────── */
  function build2D(root, ctx) {
    var NS = "http://www.w3.org/2000/svg";
    function n(tag, a, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(a || {}).forEach(function (k) {
        e.setAttribute(k, a[k]);
      });
      if (text != null) e.textContent = text;
      return e;
    }
    var disposed = false;
    var hud = makeHud();
    var CX = 300, CY = 206, RX = 215, RY = 104, GR2 = 30;
    function xy(angle) {
      var a = (angle * Math.PI) / 180;
      return { x: CX + RX * Math.cos(a), y: CY - RY * Math.sin(a) };
    }
    var svg = n("svg", { viewBox: "0 0 600 420", class: "orbit-svg", role: "img", "aria-label": "전등 둘레를 공전하는 지구본(2D 모형)" });
    svg.appendChild(n("ellipse", { cx: CX, cy: CY, rx: RX, ry: RY, class: "o2-orbit" }));
    // 공전 방향 화살표(시계 반대 방향: 서→동)
    [45, 135, 225, 315].forEach(function (ang) {
      var p = xy(ang);
      var a = (ang * Math.PI) / 180;
      var tx = -RX * Math.sin(a), ty = -RY * Math.cos(a); // d/da
      var deg = (Math.atan2(ty, tx) * 180) / Math.PI;
      svg.appendChild(n("path", { d: "M -9 -7 L 9 0 L -9 7 Z", class: "o2-arrow", transform: "translate(" + p.x + " " + p.y + ") rotate(" + deg + ")" }));
    });
    var dirLbl = xy(315);
    svg.appendChild(n("text", { x: dirLbl.x + 14, y: dirLbl.y + 30, class: "o2-small" }, "공전 방향"));
    // 전등
    svg.appendChild(n("circle", { cx: CX, cy: CY, r: 40, class: "o2-glow" }));
    svg.appendChild(n("circle", { cx: CX, cy: CY, r: 22, class: "o2-lamp" }));
    svg.appendChild(n("text", { x: CX, y: CY + 52, "text-anchor": "middle", class: "o2-lbl" }, "전등(태양)"));
    // 위치 가~라
    var marks = {};
    C.positions.forEach(function (p) {
      var q = xy(p.angle);
      var ox = (q.x - CX) / RX, oy = (q.y - CY) / RY;
      // 이름표: 가·다는 궤도 바깥 위·아래, 나·라는 궤도 바깥 비스듬히 위(지구본과 겹치지 않게)
      var lx = Math.abs(ox) > 0.5 ? q.x + ox * 34 : q.x;
      var ly = Math.abs(ox) > 0.5 ? q.y - 62 : q.y + oy * 74;
      var g = n("g", { class: "o2-pos", "data-pos": p.id });
      g.appendChild(n("circle", { cx: q.x, cy: q.y, r: 7, class: "o2-dot" }));
      g.appendChild(n("circle", { cx: lx, cy: ly, r: 22, class: "o2-tag" }));
      g.appendChild(n("text", { x: lx, y: ly + 7, "text-anchor": "middle", class: "o2-tag-t" }, p.name));
      g.addEventListener("click", function () {
        ctx.onPick({ pos: p.id });
      });
      svg.appendChild(g);
      marks[p.id] = g;
    });
    // 지구본(자리 그룹 → 기울기 그룹): 기울기 그룹은 공전하는 동안 절대 돌리지 않는다
    var globe = n("g", { class: "o2-globe" });
    var tiltG = n("g", {});
    var nightClip = "o2clip" + Math.random().toString(36).slice(2, 7);
    var defs = n("defs");
    var cp = n("clipPath", { id: nightClip });
    cp.appendChild(n("circle", { cx: 0, cy: 0, r: GR2 }));
    defs.appendChild(cp);
    svg.appendChild(defs);
    globe.appendChild(n("circle", { cx: 0, cy: 0, r: GR2, class: "o2-earth" }));
    var night = n("rect", { x: 0, y: -GR2, width: GR2, height: GR2 * 2, class: "o2-night", "clip-path": "url(#" + nightClip + ")" });
    globe.appendChild(night);
    tiltG.appendChild(n("line", { x1: 0, y1: -GR2 - 16, x2: 0, y2: GR2 + 16, class: "o2-axis" }));
    tiltG.appendChild(n("line", { x1: -GR2, y1: 0, x2: GR2, y2: 0, class: "o2-eq" }));
    var dev = n("circle", { cx: 0, cy: 0, r: 5, class: "o2-dev" });
    tiltG.appendChild(dev);
    globe.appendChild(tiltG);
    var vref = n("line", { x1: 0, y1: -GR2 - 20, x2: 0, y2: GR2 + 20, class: "o2-vref" });
    globe.insertBefore(vref, globe.firstChild);
    svg.appendChild(globe);
    var caption = el("p", { class: "o2-caption", "aria-live": "polite" });
    var head = el("div", { class: "o2-head" }, [hud.nodes[0], hud.nodes[1]]);
    var box = el("div", { class: "o2-wrap" }, [head, svg, caption, hud.nodes[2]]);
    root.appendChild(box);

    var st = { angle: POS.ga.angle, tilt: "vertical", pos: "ga", shown: false };
    function draw() {
      var q = xy(st.angle);
      globe.setAttribute("transform", "translate(" + q.x.toFixed(1) + " " + q.y.toFixed(1) + ")");
      var deg = st.tiltDeg != null ? st.tiltDeg : TILTS[st.tilt].angleDeg;
      tiltG.setAttribute("transform", "rotate(" + deg + ")");
      // 밤 쪽(전등 반대편)을 어둡게: 화면에서 전등 반대 방향으로 반원
      var ang = (Math.atan2(q.y - CY, q.x - CX) * 180) / Math.PI;
      night.setAttribute("transform", "rotate(" + ang + ")");
      // 측정기(우리나라): 전등을 바라보는 쪽, 북위 37.5°
      var toLampX = CX - q.x;
      var side = Math.abs(toLampX) < 30 ? 0 : toLampX > 0 ? 1 : -1;
      var rad = (LAT * Math.PI) / 180;
      dev.setAttribute("cx", (side * Math.cos(rad) * GR2).toFixed(1));
      dev.setAttribute("cy", (-Math.sin(rad) * GR2).toFixed(1));
    }
    function drawMarks(selPos) {
      POS_IDS.forEach(function (id) {
        marks[id].classList.toggle("is-sel", id === selPos);
      });
    }
    function updateHud(sel) {
      var shown = st.shown ? shadowOf(st.tilt, st.pos) : null;
      hud.set(st.tilt, st.pos, shown);
      caption.textContent = st.shown
        ? "지구본이 " + POS[st.pos].name + " 위치에 있고, 측정기가 전등을 정면으로 향해요(남중). 그림자 " + f1(shown) + " cm (모형)"
        : "지구본이 " + POS[st.pos].name + " 위치에 있어요. " + TILTS[st.tilt].name + " (모형)";
    }
    draw();
    updateHud();

    function animate(ms, fn) {
      return new Promise(function (resolve) {
        if (document.hidden || disposed) {
          fn(1);
          resolve();
          return;
        }
        var t0 = null;
        (function tick(now) {
          if (disposed) {
            resolve();
            return;
          }
          if (t0 == null) t0 = now;
          var t = Math.min(1, (now - t0) / ms);
          var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          fn(e);
          if (t >= 1) resolve();
          else requestAnimationFrame(tick);
        })(performance.now());
      });
    }
    async function setTilt(tilt) {
      if (st.tilt === tilt) return;
      var from = TILTS[st.tilt].angleDeg, to = TILTS[tilt].angleDeg;
      st.tilt = tilt;
      st.shown = false;
      await animate(400, function (e) {
        st.tiltDeg = from + (to - from) * e;
        draw();
      });
      st.tiltDeg = null;
      draw();
    }

    return {
      highlight: function (s) {
        rememberSel(s);
        drawMarks(s.pos);
        hud.select(s.pos);
        if (s.tilt && s.tilt !== st.tilt) {
          setTilt(s.tilt).then(function () {
            updateHud();
          });
        }
        updateHud();
      },
      run: async function (sel) {
        st.shown = false;
        await setTilt(sel.tilt);
        updateHud();
        var from = st.angle % 360;
        var to = forwardAngle(from, POS[sel.pos].angle);
        hud.ff(true);
        hud.say(POS[sel.pos].name + " 위치로 공전하는 중(빨리 감기)");
        await animate(to === from ? 500 : 1500, function (e) {
          st.angle = from + (to - from) * e;
          draw();
        });
        hud.ff(false);
        st.angle = POS[sel.pos].angle;
        st.pos = sel.pos;
        st.shown = true;
        draw();
        updateHud();
        setGlobeAt(sel);
        hud.say(cellName(sel.tilt, sel.pos) + ": 그림자 " + f1(shadowOf(sel.tilt, sel.pos)) + " cm");
      },
      showInstant: function (sel) {
        if (globeAt && (globeAt.tilt !== sel.tilt || globeAt.pos !== sel.pos)) return;
        st.tilt = sel.tilt;
        st.pos = sel.pos;
        st.angle = POS[sel.pos].angle;
        st.shown = true;
        draw();
        updateHud();
      },
      clear: function () {
        st.pos = "ga";
        st.angle = POS.ga.angle;
        st.shown = false;
        setGlobeAt(null);
        draw();
        updateHud();
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
        hud.remove();
      },
    };
  }

  /* ───────── 3D 화면 ───────── */
  var R_ORB = 5.2; // 공전 궤도 반지름(모형)
  var GY = 1.9; // 전등·지구본 중심 높이(같게)
  var GR = 1.0; // 지구본 반지름
  var SC = 0.125; // 그림자 1 cm → 장면 길이(모형, 측정기와 함께 크게 그림)

  function globeTexture(T) {
    var c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    var g = c.getContext("2d");
    g.fillStyle = "#2f6fb3";
    g.fillRect(0, 0, 512, 256);
    // 대륙(아주 단순한 모양, 모형)
    g.fillStyle = "#5aa05a";
    function blob(pts) {
      g.beginPath();
      pts.forEach(function (p, i) {
        var x = ((p[0] + 180) / 360) * 512;
        var y = ((90 - p[1]) / 180) * 256;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      });
      g.closePath();
      g.fill();
    }
    blob([[-10, 36], [30, 45], [60, 55], [100, 70], [140, 65], [145, 45], [128, 35], [120, 22], [105, 10], [80, 8], [60, 25], [35, 30], [10, 38]]); // 유라시아
    blob([[-17, 15], [10, 35], [35, 30], [50, 10], [40, -15], [30, -34], [18, -34], [10, -5], [-10, 5]]); // 아프리카
    blob([[-165, 65], [-100, 70], [-60, 55], [-75, 40], [-80, 25], [-97, 18], [-105, 25], [-125, 45], [-150, 58]]); // 북아메리카
    blob([[-80, 10], [-50, 0], [-38, -10], [-55, -35], [-70, -52], [-75, -20]]); // 남아메리카
    blob([[115, -22], [130, -12], [150, -15], [152, -30], [140, -38], [117, -34]]); // 오스트레일리아
    // 위선·경선
    g.strokeStyle = "rgba(255,255,255,0.28)";
    g.lineWidth = 1;
    for (var la = -60; la <= 60; la += 30) {
      var y = ((90 - la) / 180) * 256;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
    }
    for (var lo = 0; lo < 512; lo += 512 / 12) {
      g.beginPath();
      g.moveTo(lo, 0);
      g.lineTo(lo, 256);
      g.stroke();
    }
    g.strokeStyle = "rgba(255,230,120,0.9)"; // 적도
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, 128);
    g.lineTo(512, 128);
    g.stroke();
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 2 * (R_ORB + 1.7), depth: 2 * (R_ORB + 2.4), center: [0, 1.0, 0.7] },
      viewDir: [0, 0.76, 0.65],
      minDistance: 2.6,
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var hud = makeHud();
      hud.nodes.forEach(function (x) {
        container.appendChild(x);
      });

      // 조명: 기본 조명을 낮추고, 전등 → 지구본 방향의 평행광(태양 빛은 평행하게 들어온다)을 쓴다
      var sun = null;
      v.scene.traverse(function (o) {
        if (o.isHemisphereLight) o.intensity = 0.75;
        if (o.isDirectionalLight && !sun) sun = o;
      });
      if (sun) {
        sun.intensity = 2.4;
        v.scene.add(sun.target);
      }

      // 탁자(모형)
      // 탁자는 조명(수평 평행광)의 영향을 받지 않게 MeshBasicMaterial로 칠한다(밝은 모드에서 어둡게 보이지 않게)
      var table = M.table(2 * R_ORB + 5, 2 * R_ORB + 5, 0xd9c7a3);
      table.material.dispose();
      table.material = new T.MeshBasicMaterial({ color: 0xd9c7a3 });
      v.root.add(table);
      v.onThemeChange(function (dark) {
        table.material.color.set(dark ? 0x4d4436 : 0xe3d4b4);
      });

      // 전등(갓 없는 전등, 지구본 중심과 같은 높이)
      var lampPos = new T.Vector3(0, GY, 0);
      var bulb = new T.Mesh(new T.SphereGeometry(0.55, 32, 20), new T.MeshBasicMaterial({ color: 0xfff1b8 }));
      bulb.position.copy(lampPos);
      var glow = new T.Mesh(new T.SphereGeometry(0.85, 32, 20), new T.MeshBasicMaterial({ color: 0xffd966, transparent: true, opacity: 0.28, depthWrite: false }));
      glow.position.copy(lampPos);
      var pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, GY - 0.5, 12), M.material(0x55606e, { metalness: 0.4 }));
      pole.position.set(0, (GY - 0.5) / 2, 0);
      var base = new T.Mesh(new T.CylinderGeometry(0.6, 0.7, 0.14, 24), M.material(0x3a4250));
      base.position.y = 0.07;
      v.root.add(bulb, glow, pole, base);
      var lampLabel = M.label("전등(태양)", { height: 0.62, bold: true, border: "#e0a100" });
      lampLabel.position.set(0, GY - 1.15, 0.9);
      v.root.add(lampLabel);

      function orbitPoint(angle, y) {
        var a = (angle * Math.PI) / 180;
        return new T.Vector3(R_ORB * Math.cos(a), y == null ? GY : y, -R_ORB * Math.sin(a));
      }

      // 공전 궤도(지구본 중심 높이) + 공전 방향 화살표(위에서 볼 때 시계 반대 방향)
      var orbit = new T.Mesh(new T.TorusGeometry(R_ORB, 0.022, 8, 160), new T.MeshBasicMaterial({ color: 0x6b7a90 }));
      orbit.rotation.x = Math.PI / 2;
      orbit.position.y = GY;
      v.root.add(orbit);
      v.onThemeChange(function (dark) {
        orbit.material.color.set(dark ? 0xa6b1c2 : 0x6b7a90);
      });
      var arrowMat = new T.MeshBasicMaterial({ color: 0x2f6fd6 });
      [45, 135, 225, 315].forEach(function (ang) {
        var cone = new T.Mesh(new T.ConeGeometry(0.13, 0.36, 14), arrowMat);
        var a = (ang * Math.PI) / 180;
        var tan = new T.Vector3(-Math.sin(a), 0, -Math.cos(a)).normalize();
        cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tan);
        cone.position.copy(orbitPoint(ang));
        v.root.add(cone);
      });
      var dirLabel = M.label("공전 방향 ↺", { height: 0.5 });
      dirLabel.position.copy(orbitPoint(315, GY + 0.55));
      dirLabel.position.multiplyScalar(1).add(new T.Vector3(0.5, 0, 0.5));
      v.root.add(dirLabel);

      // 위치 가~라: 탁자 위 표시 + 이름표(누르면 그 위치를 고른다)
      var marks = {};
      C.positions.forEach(function (p) {
        var ring = new T.Mesh(new T.RingGeometry(0.62, 0.8, 40), new T.MeshBasicMaterial({ color: 0x7c8797, side: T.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(orbitPoint(p.angle, 0.02));
        v.root.add(ring);
        var tag = M.label(p.name, { height: 0.72, bold: true, border: "#2f6fd6" });
        // 나·라는 궤도 바깥, 가·다는 표시 고리 오른쪽 옆(지구본에 가리지 않게)
        var side = Math.abs(Math.cos((p.angle * Math.PI) / 180)) > 0.5;
        var out = side ? orbitPoint(p.angle, 0.55).multiplyScalar((R_ORB + 1.45) / R_ORB) : orbitPoint(p.angle, 0.55).add(new T.Vector3(1.55, 0, 0));
        out.y = 0.55;
        tag.position.copy(out);
        v.root.add(tag);
        v.pickable(tag, { pos: p.id });
        v.pickable(ring, { pos: p.id });
        marks[p.id] = { ring: ring, tag: tag };
      });

      // 지구본: place(자리, 궤도를 따라 이동) → tiltG(자전축 기울기, 우주 기준으로 고정) → spinG(자전)
      var place = new T.Group();
      var tiltG = new T.Group();
      var spinG = new T.Group();
      place.add(tiltG);
      tiltG.add(spinG);
      v.root.add(place);
      var earthTex = globeTexture(T);
      var earth = new T.Mesh(new T.SphereGeometry(GR, 48, 32), new T.MeshStandardMaterial({ map: earthTex, roughness: 0.75, metalness: 0 }));
      spinG.add(earth);
      // 자전축(지구본을 꿰는 막대) — 기울기 그룹에 붙어 자전해도 돌지 않는다
      var axis = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, GR * 2.9, 10), M.material(0x9aa4b1, { metalness: 0.6, roughness: 0.3 }));
      tiltG.add(axis);
      var nCap = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), M.material(0xd8434f));
      nCap.position.y = GR * 1.45;
      tiltG.add(nCap);
      var axisLabel = M.label("자전축", { height: 0.3 });
      axisLabel.position.y = GR * 1.45 + 0.28;
      tiltG.add(axisLabel);
      // 수직 기준선(점선): 기울기를 눈으로 비교
      var vrefGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(0, -GR * 1.55, 0), new T.Vector3(0, GR * 1.55, 0)]);
      var vref = new T.Line(vrefGeo, new T.LineDashedMaterial({ color: 0x5b6676, dashSize: 0.1, gapSize: 0.08 }));
      vref.computeLineDistances();
      place.add(vref);
      // 지구본 받침(모형)
      var gStand = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, GY - GR, 10), M.material(0x55606e));
      gStand.position.y = -(GY - GR) / 2 - GR;
      var gBase = new T.Mesh(new T.CylinderGeometry(0.42, 0.5, 0.1, 20), M.material(0x3a4250));
      gBase.position.y = -GY + 0.05;
      place.add(gStand, gBase);

      // 태양 고도 측정기(우리나라, 북위 37.5°): 동그란 판 + 가운데 막대 + 그림자
      var latR = (LAT * Math.PI) / 180;
      var kDir = new T.Vector3(Math.cos(latR), Math.sin(latR), 0);
      var dev = new T.Group();
      dev.position.copy(kDir).multiplyScalar(GR);
      dev.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), kDir);
      var plate = new T.Mesh(new T.CylinderGeometry(0.46, 0.46, 0.035, 36), M.material(0xfafafa, { roughness: 0.9 }));
      plate.position.y = 0.02;
      var stick = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.22, 10), M.material(0xd8434f));
      stick.position.y = 0.035 + 0.11;
      var shadowPivot = new T.Group();
      shadowPivot.position.y = 0.04;
      var shadow = new T.Mesh(new T.BoxGeometry(1, 0.006, 0.075), new T.MeshBasicMaterial({ color: 0x1b1f27 }));
      shadow.position.x = 0.5;
      shadowPivot.add(shadow);
      shadowPivot.visible = false;
      dev.add(plate, stick, shadowPivot);
      spinG.add(dev);
      var devLabel = M.label("우리나라", { height: 0.24 });
      devLabel.position.set(0, 0.62, 0);
      dev.add(devLabel);

      var st = { angle: POS.ga.angle, tilt: "vertical", pos: "ga", spin: 0, shown: false };
      var tmpQ = new T.Quaternion();
      var zAxis = new T.Vector3(0, 0, 1);
      function tiltQuat(deg, out) {
        // 자전축이 늘 +x 쪽(오른쪽)으로 기운다: z축 둘레로 -deg 회전
        return (out || new T.Quaternion()).setFromAxisAngle(zAxis, (-deg * Math.PI) / 180);
      }
      // 이 자리·기울기에서 측정기(우리나라 경선)가 전등을 정면으로 향하는(남중) 자전 각도
      function noonSpin(angle, deg) {
        var gp = orbitPoint(angle);
        var d = lampPos.clone().sub(gp).normalize();
        d.applyQuaternion(tiltQuat(deg, tmpQ).invert());
        return Math.atan2(-d.z, d.x);
      }
      function apply(tiltDeg) {
        place.position.copy(orbitPoint(st.angle));
        tiltQuat(tiltDeg != null ? tiltDeg : TILTS[st.tilt].angleDeg, tiltG.quaternion);
        spinG.rotation.y = st.spin;
        if (sun) {
          sun.position.copy(lampPos);
          sun.target.position.copy(place.position);
          sun.target.updateMatrixWorld();
        }
        drawShadow();
      }
      function drawShadow() {
        shadowPivot.visible = st.shown;
        if (!st.shown) return;
        // 평행광 방향(전등 → 지구본)을 측정기 좌표로 바꿔 판 위에 투영 → 그림자 방향. 길이는 교과서 예시 값.
        v.root.updateMatrixWorld(true);
        var L = place.position.clone().sub(lampPos).normalize();
        var q = new T.Quaternion();
        dev.getWorldQuaternion(q);
        L.applyQuaternion(q.invert());
        var dx = L.x, dz = L.z;
        var len = Math.hypot(dx, dz) || 1;
        shadowPivot.rotation.y = Math.atan2(-dz / len, dx / len);
        shadowPivot.scale.x = shadowOf(st.tilt, st.pos) * SC;
      }
      function drawMarks(selPos) {
        POS_IDS.forEach(function (id) {
          var on = id === selPos;
          marks[id].ring.material.color.set(on ? 0xf2a93b : 0x7c8797);
          marks[id].ring.scale.setScalar(on ? 1.15 : 1);
        });
      }
      function updateHud() {
        hud.set(st.tilt, st.pos, st.shown ? shadowOf(st.tilt, st.pos) : null);
      }
      st.spin = noonSpin(st.angle, 0);
      apply();
      updateHud();

      // 좁은 화면(휴대폰)에서는 이름표를 키운다
      var tags = [lampLabel, dirLabel].concat(
        POS_IDS.map(function (id) {
          return marks[id].tag;
        })
      ).map(function (sp) {
        return { sp: sp, sx: sp.scale.x, sy: sp.scale.y };
      });
      var labelK = 0;
      function fitLabels() {
        var narrow = (container.clientWidth || 1024) < 480;
        var k = narrow ? 1.35 : 1;
        dirLabel.visible = !narrow;
        if (k === labelK) return;
        labelK = k;
        tags.forEach(function (t) {
          t.sp.scale.set(t.sx * k, t.sy * k, 1);
        });
        v.render();
      }
      fitLabels();
      var labelRO = window.ResizeObserver ? new ResizeObserver(fitLabels) : null;
      if (labelRO) labelRO.observe(container);

      // 측정기가 잘 보이도록 전등 쪽 비스듬한 곳에서 지구본을 바라본다
      function closeUp(ms) {
        var gp = place.position.clone();
        var toLamp = lampPos.clone().sub(gp).setY(0).normalize();
        var side = new T.Vector3(-toLamp.z, 0, toLamp.x); // 옆 방향
        var dir = toLamp.multiplyScalar(0.85).add(new T.Vector3(0, 0.5, 0)).add(side.multiplyScalar(0.4)).normalize();
        var toP = gp.clone().add(new T.Vector3(0, 0.35, 0)).addScaledVector(dir, 6.2);
        var toT = gp.clone().add(new T.Vector3(0, 0.35, 0));
        var fromP = v.camera.position.clone();
        var fromT = v.controls.target.clone();
        return v.tween(ms, function (e) {
          v.controls.target.lerpVectors(fromT, toT, e);
          v.camera.position.lerpVectors(fromP, toP, e);
        });
      }

      var tiltAnim = null;
      function animateTilt(to) {
        var fromDeg = TILTS[st.tilt].angleDeg;
        var toDeg = TILTS[to].angleDeg;
        var fromSpin = st.spin;
        var toSpin = noonSpin(st.angle, toDeg);
        st.tilt = to;
        st.shown = false;
        updateHud();
        tiltAnim = v.tween(450, function (e) {
          st.spin = fromSpin + (toSpin - fromSpin) * e;
          apply(fromDeg + (toDeg - fromDeg) * e);
        });
        return tiltAnim;
      }

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          rememberSel(s);
          drawMarks(s.pos);
          hud.select(s.pos);
          if (s.tilt && s.tilt !== st.tilt) animateTilt(s.tilt);
          else updateHud();
          v.render();
        },
        run: async function (sel) {
          st.shown = false;
          apply();
          updateHud();
          await v.flyHome(350);
          if (sel.tilt !== st.tilt) await animateTilt(sel.tilt);
          else if (tiltAnim) await tiltAnim;
          var from = st.angle % 360;
          if (from <= 0) from += 360;
          var to = forwardAngle(from, POS[sel.pos].angle);
          var deg = TILTS[sel.tilt].angleDeg;
          var spinEnd = noonSpin(POS[sel.pos].angle, deg);
          var turns = to === from ? 1 : 3; // 옮겨 가는 동안 자전(빨리 감기)
          var spinFrom = spinEnd - turns * 2 * Math.PI;
          hud.ff(true);
          hud.say(POS[sel.pos].name + " 위치로 공전하는 중(빨리 감기)");
          var startSpin = st.spin;
          await v.tween(to === from ? 700 : 1500, function (e) {
            st.angle = from + (to - from) * e;
            // 처음 한순간은 지금 자전 각도에서 이어지게
            st.spin = spinFrom + (spinEnd - spinFrom) * e + (startSpin - spinFrom) * Math.max(0, 1 - e * 6);
            apply();
          });
          st.angle = POS[sel.pos].angle;
          st.pos = sel.pos;
          st.spin = spinEnd;
          hud.ff(false);
          st.shown = true;
          apply();
          updateHud();
          await closeUp(600);
          setGlobeAt(sel);
          hud.say(cellName(sel.tilt, sel.pos) + ": 측정기가 전등을 정면으로 향해요. 그림자 " + f1(shadowOf(sel.tilt, sel.pos)) + " cm");
        },
        showInstant: function (sel) {
          if (globeAt && (globeAt.tilt !== sel.tilt || globeAt.pos !== sel.pos)) return;
          st.tilt = sel.tilt;
          st.pos = sel.pos;
          st.angle = POS[sel.pos].angle;
          st.spin = noonSpin(st.angle, TILTS[sel.tilt].angleDeg);
          st.shown = true;
          apply();
          updateHud();
          v.render();
        },
        clear: function () {
          st.pos = "ga";
          st.angle = POS.ga.angle;
          st.spin = noonSpin(st.angle, TILTS[st.tilt].angleDeg);
          st.shown = false;
          setGlobeAt(null);
          apply();
          updateHud();
          v.flyHome(400);
        },
        resetView: v.resetView,
        dispose: function () {
          if (labelRO) labelRO.disconnect();
          hud.remove();
          v.dispose();
        },
      };
    });
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  // 막대그래프 무늬: '자전축 기울임' 계열은 빗금, '자전축 수직'은 민무늬(색만으로 구분하지 않게, review 낮음 4).
  // 공통 틀은 고치지 않고, 앱이 문서에 무늬 정의를 한 번 넣고 style.css에서 그 계열 막대·범례에 채운다.
  function ensureHatch() {
    if (document.getElementById("s6215-hatch")) return;
    var NS = "http://www.w3.org/2000/svg";
    var host = document.createElementNS(NS, "svg");
    host.setAttribute("width", "0");
    host.setAttribute("height", "0");
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("focusable", "false");
    host.style.position = "absolute";
    var defs = document.createElementNS(NS, "defs");
    var pat = document.createElementNS(NS, "pattern");
    pat.setAttribute("id", "s6215-hatch");
    pat.setAttribute("patternUnits", "userSpaceOnUse");
    pat.setAttribute("width", "8");
    pat.setAttribute("height", "8");
    pat.setAttribute("patternTransform", "rotate(45)");
    var bg = document.createElementNS(NS, "rect");
    bg.setAttribute("width", "8");
    bg.setAttribute("height", "8");
    bg.setAttribute("class", "hatch-bg");
    var ln = document.createElementNS(NS, "rect");
    ln.setAttribute("width", "3");
    ln.setAttribute("height", "8");
    ln.setAttribute("class", "hatch-line");
    pat.appendChild(bg);
    pat.appendChild(ln);
    defs.appendChild(pat);
    host.appendChild(defs);
    document.body.appendChild(host);
  }
  function drawResults() {
    var T = S.TableChart;
    ensureHatch();
    var tn = $("toast");
    if (tn) tn.hidden = true; // 실험 단계의 완료 알림이 표·그래프를 가리지 않게
    T.renderTable($("result-table"), {
      caption: "태양이 남중할 때 그림자 길이 (내 기록)",
      columns: [{ id: "pos", label: "위치" }].concat(
        C.tilts.map(function (t) {
          return { id: t.id, label: t.name, unit: "cm", digits: 1 };
        })
      ),
      rows: C.positions.map(function (p) {
        var row = { pos: p.name };
        C.tilts.forEach(function (t) {
          row[t.id] = recOf(t.id, p.id);
        });
        return row;
      }),
    });
    var bar = $("bar-card");
    bar.textContent = "";
    var barRoot = el("div", { class: "bar-box" });
    bar.appendChild(barRoot);
    T.renderBar(
      barRoot,
      Object.assign({}, C.chart.bar, {
        categories: C.positions.map(function (p) {
          return p.name;
        }),
        series: C.tilts.map(function (t) {
          return {
            name: t.name + (t.angleDeg ? " (빗금)" : " (민무늬)"),
            values: C.positions.map(function (p) {
              return recOf(t.id, p.id);
            }),
          };
        }),
      })
    );
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
    var shadows = {};
    C.tilts.forEach(function (t) {
      shadows[t.name] = {};
      C.positions.forEach(function (p) {
        shadows[t.name][p.name] = recOf(t.id, p.id);
      });
    });
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened ? predict.hintsOpened() : undefined,
      records: records.list().map(function (r) {
        return { tilt: TILTS[r.tilt] ? TILTS[r.tilt].name : r.tilt, position: POS[r.pos] ? POS[r.pos].name : r.pos, shadowCm: r.shadow };
      }),
      shadows: shadows,
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
            label: "내 기록",
            question: "태양이 남중할 때 그림자 길이(cm) — 자전축 수직·기울임 × 가·나·다·라",
            kind: "table",
            answer: {
              columns: [{ key: "pos", label: "위치" }].concat(
                C.tilts.map(function (t) {
                  return { key: t.id, label: t.name + "(cm)" };
                })
              ),
              rows: C.positions.map(function (p) {
                var row = { pos: p.name };
                C.tilts.forEach(function (t) {
                  var v = recOf(t.id, p.id);
                  row[t.id] = v == null ? "" : f1(v);
                });
                return row;
              }),
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
      return ["기록한 칸: " + records.count() + "/8", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "자전축 수직·기울임에서 네 위치를 모두 기록해야 넘어갈 수 있어요. (기록한 칸: " + p.done + "/" + p.total + ")";
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
