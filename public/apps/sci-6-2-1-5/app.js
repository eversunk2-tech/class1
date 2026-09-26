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
 *
 * 개편 단계 B(2026-09-25, spec.md "개정 2"):
 *   - 확대(closeUp)는 지금 보던 쪽(카메라 방위)에서 다가가며 조금 위에서 내려다본다 — 전등 쪽으로 돌아가지 않아 전체 화면과
 *     좌우(전등이 화면 어느 쪽인지)가 같다(예전: 전등 쪽에서 바라봐 거울처럼 뒤집힘, 사용자 지적).
 *   - 빛이 나아가는 방향 벡터 하나(lightDir, 전등 → 지구본)로 전등 빛·빛 화살표·그림자 방향·확대 칸의 💡 방향을 함께 정한다.
 *   - 측정기 확대 칸(장면 오른쪽 위): 그림자 길이를 교과서 값에 비례해 크게 그린다(방향은 3D에서 계산한 빛의 방향).
 *   - 바뀌는 값(지구본 자리·자전축·그림자 길이)은 장면 위에 띄우지 않고 측정값 패널(vp)에만 — 기본 화면은 장면 바로 아래,
 *     크게 보기는 장면 안 막대 윗줄(공통 틀 scenePanel).
 *   - 지구본을 궤도 위로 끌면 가장 가까운 자리(가~라)에 붙고 그 위치가 골라진다(버튼·글자 누르기는 그대로).
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
  // 각도 차이를 -180°~180°로
  function wrap180(d) {
    return ((((d + 180) % 360) + 360) % 360) - 180;
  }
  // 궤도 위 각도(°)에서 가장 가까운 자리(가~라)
  function nearestPos(angle) {
    var best = POS_IDS[0];
    var bestD = 999;
    POS_IDS.forEach(function (id) {
      var d = Math.abs(wrap180(angle - POS[id].angle));
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    });
    return best;
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

  // 장면에서 지구본이 마지막으로 있던 칸(새로고침·화면 전환 뒤 그 자리로 되돌림). 끌어서 옮겨 놓은 자리도 여기에 남긴다.
  var globeAt = store.get("globeAt", null);
  function setGlobeAt(s) {
    globeAt = s ? { tilt: s.tilt, pos: s.pos } : null;
    store.set("globeAt", globeAt);
  }

  /* ── 측정값 패널(vp) — 바뀌는 값(지구본 자리·자전축·그림자 길이)은 장면 위에 띄우지 않고 여기에만 쓴다 ──
     기본 화면: vpHome(좌우 두 칸이면 조작 패널 맨 위, 위아래 한 칸이면 장면 바로 아래 — 아래 placeHome) / 크게 보기: 공통 틀이
     장면 안 막대 윗줄(좁은·낮은 화면은 장면 아래 카드)로 옮긴다(scenePanel). 3D·2D 화면이 status로 함께 고친다. */
  var vpCond = el("span", { class: "vp-cond" });
  var vpVal = el("span", { class: "vp-val" });
  var vpNext = el("span", { class: "vp-next", hidden: true });
  var vp = el("div", { class: "vp", role: "group", "aria-label": "지금 값(측정값 패널)" }, [vpCond, vpVal, vpNext]);
  var vpHome = el("div", { class: "vp-home" }, [vp]);
  var status = (function () {
    var now = { tilt: "vertical", pos: "ga", shadow: null };
    var mode = ""; // "" | "orbit"(▶ 공전 중) | "drag"(끌어 옮기는 중)
    var modePos = null; // 공전해 갈 자리 / 끌어서 가까워진 자리
    var selPos = null;
    function render() {
      var t = TILTS[now.tilt] || TILTS.vertical;
      var tiltText = t.name + (t.angleDeg ? "(" + t.angleDeg + "°)" : "");
      var where =
        mode === "orbit" && modePos
          ? POS[modePos].name + " 위치로 공전하는 중"
          : mode === "drag"
          ? (modePos ? POS[modePos].name + " 위치 쪽으로 " : "") + "옮기는 중"
          : POS[now.pos].name + " 위치";
      vpCond.textContent = "🌍 지구본: " + where + " · " + tiltText + (now.shadow != null && !mode ? " · 태양이 남중할 때" : "");
      vpVal.textContent = "";
      if (now.shadow != null && !mode) {
        vpVal.appendChild(document.createTextNode("📏 그림자 길이 "));
        vpVal.appendChild(el("strong", { class: "vp-num", text: f1(now.shadow) }));
        vpVal.appendChild(document.createTextNode(" cm"));
      } else vpVal.textContent = "📏 그림자 길이: " + (mode === "orbit" ? "재는 중…" : "아직 안 쟀어요");
      var diff = !mode && selPos && selPos !== now.pos;
      vpNext.textContent = diff ? "➡ 고른 위치: " + POS[selPos].name + " (▶를 누르면 옮겨 가요)" : "";
      vpNext.hidden = !diff;
    }
    render();
    return {
      set: function (tilt, pos, shadow) {
        now = { tilt: tilt, pos: pos, shadow: shadow };
        mode = "";
        modePos = null;
        render();
      },
      select: function (pos) {
        selPos = pos || null;
        render();
      },
      mode: function (m, pos) {
        mode = m || "";
        modePos = pos || null;
        render();
      },
    };
  })();
  // 3D 화면이 기록 뒤에 할 일(확대해 있었으면 전체 화면으로 돌아가 다음 자리를 보이게) — 화면을 만들 때 걸고, 없앨 때 푼다
  var sceneHooks = { afterRecord: null };

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
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 🌍 지구본을 끌거나 가~라를 눌러 위치 고르기",
      tip2D: "2D 화면(모형, 비스듬히 위에서 본 모습)이에요. 가~라를 눌러 위치를 고를 수 있어요.",
    },
    scenePanel: vp,
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
    onRecorded: function () {
      if (sceneHooks.afterRecord) sceneHooks.afterRecord();
    },
  });
  /* 측정값 패널의 기본 화면 자리(vpHome) — 크게 보기에서는 공통 틀이 vp를 막대(좁은 화면은 장면 아래 카드)로 옮겼다가 끄면 vpHome으로 되돌린다.
     기본 화면이 좌우 두 칸(가로 901px 이상)이면 조작 패널 맨 위(장면 칼럼은 sticky라 장면 아래에 두면 화면 밖으로 밀린다),
     위아래 한 칸이면 장면 바로 아래. vp가 아니라 빈 자리(vpHome)만 옮기므로 공통 틀의 scenePanel 옮기기와 부딪히지 않는다. */
  (function () {
    var root = $("experiment-root");
    var box = root.querySelector(".ss-exp-view");
    var panel = root.querySelector(".ss-exp-panel");
    var prog = root.querySelector(".ss-progress");
    var twoCol = window.matchMedia ? window.matchMedia("(min-width: 901px) and (orientation: landscape)") : null;
    function placeHome() {
      if (twoCol && twoCol.matches && panel) {
        var ref = prog && prog.parentNode === panel ? prog : panel.firstChild;
        if (vpHome.parentNode !== panel || vpHome.nextSibling !== ref) panel.insertBefore(vpHome, ref);
      } else if (box && box.parentNode && box.nextSibling !== vpHome) box.parentNode.insertBefore(vpHome, box.nextSibling);
      vpHome.classList.toggle("is-panel", vpHome.parentNode === panel);
    }
    placeHome();
    if (twoCol) {
      if (twoCol.addEventListener) twoCol.addEventListener("change", placeHome);
      else if (twoCol.addListener) twoCol.addListener(placeHome);
    }
  })();

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

  /* ── 측정기 확대 칸(모형) ── 장면 오른쪽 위에 우리나라 태양 고도 측정기를 판 위에서 크게 본 그림.
     가운데 점 = 막대, 동심원 = 1 cm 간격. 그림자 길이는 교과서·실험관찰 값 × 같은 배율(INSET_K)이라 "짧다·길다"가 표 값 순서와
     같게 보인다(3D의 그림자도 같은 값에 비례). 방향은 3D(또는 2D)에서 계산한 빛의 방향을 지금 보는 화면에 투영해서 정한다:
     💡(전등 쪽) = 빛이 오는 쪽, 그림자 = 그 반대쪽(빛이 나아가는 쪽). 숫자 값은 넣지 않는다(값은 측정값 패널에만). */
  var INSET_K = 14; // 확대 칸에서 1 cm의 길이(판 반지름 55 ≈ 3.9 cm — 가장 긴 3.5 cm도 판 안에 들어간다)
  function makeInset() {
    var NS = "http://www.w3.org/2000/svg";
    function n(tag, a) {
      var e = document.createElementNS(NS, tag);
      Object.keys(a || {}).forEach(function (k) {
        e.setAttribute(k, a[k]);
      });
      return e;
    }
    var CX = 84;
    var CY = 84;
    var RP = 55;
    var svg = n("svg", { viewBox: "0 0 168 168", class: "inset-svg", "aria-hidden": "true", focusable: "false" });
    svg.appendChild(n("circle", { cx: CX, cy: CY, r: RP, class: "in-plate" }));
    for (var k = 1; k <= 3; k++) svg.appendChild(n("circle", { cx: CX, cy: CY, r: k * INSET_K, class: "in-ring" }));
    var nums = [1, 2, 3].map(function (k) {
      var t = n("text", { class: "in-num", "text-anchor": "middle", "dominant-baseline": "central" });
      t.textContent = String(k);
      svg.appendChild(t);
      return t;
    });
    var shadow = n("line", { class: "in-shadow", x1: CX, y1: CY, x2: CX, y2: CY });
    var tip = n("line", { class: "in-tip" });
    svg.appendChild(shadow);
    svg.appendChild(tip);
    svg.appendChild(n("circle", { cx: CX, cy: CY, r: 3.4, class: "in-stick" }));
    var beam = n("line", { class: "in-beam" });
    var head = n("path", { class: "in-beam-head" });
    var bulb = n("text", { class: "in-bulb", "text-anchor": "middle", "dominant-baseline": "central" });
    bulb.textContent = "💡";
    svg.appendChild(beam);
    svg.appendChild(head);
    svg.appendChild(bulb);
    var node = el(
      "figure",
      {
        class: "inset",
        hidden: true,
        role: "img",
        "aria-label": "우리나라 태양 고도 측정기를 위에서 크게 본 그림(모형). 가운데 점이 막대, 원 사이 간격은 1 cm, 💡는 전등 쪽이에요.",
      },
      [
        svg,
        // 좁은 장면(.is-small)에서는 짧은 글만(괄호 속 말은 숨긴다)
        el("figcaption", { class: "inset-cap", "aria-hidden": "true" }, [
          el("span", null, ["🔍 우리나라 측정기", el("span", { class: "cap-x", text: "(확대·모형)" })]),
          el("span", null, ["💡 전등 쪽", el("span", { class: "cap-x", text: " · 원 간격 1 cm" })]),
        ]),
      ]
    );
    var cur = { value: 0, ux: 1, uy: 0 }; // (ux, uy): 화면에서 전등 쪽(오른쪽 +, 위쪽 +)
    function set(e, a) {
      Object.keys(a).forEach(function (k) {
        e.setAttribute(k, typeof a[k] === "number" ? a[k].toFixed(2) : a[k]);
      });
    }
    function draw() {
      var ux = cur.ux;
      var uy = -cur.uy; // SVG 좌표(아래쪽 +)
      var px = -uy; // 그림자에 수직인 방향
      var py = ux;
      var L = cur.value * INSET_K;
      var tx = CX - ux * L; // 그림자 끝: 전등 반대쪽
      var ty = CY - uy * L;
      set(shadow, { x2: tx, y2: ty });
      set(tip, { x1: tx + px * 7, y1: ty + py * 7, x2: tx - px * 7, y2: ty - py * 7 });
      // 원 눈금 숫자: 그림자·전등과 겹치지 않게 수직 방향(위쪽, 수평이면 오른쪽)에
      var qx = px;
      var qy = py;
      if (qy > 0.01 || (Math.abs(qy) <= 0.01 && qx < 0)) {
        qx = -qx;
        qy = -qy;
      }
      nums.forEach(function (t, i) {
        set(t, { x: CX + qx * (i + 1) * INSET_K, y: CY + qy * (i + 1) * INSET_K });
      });
      // 💡와 빛 화살표(판 바깥 → 판 가장자리)
      set(bulb, { x: CX + ux * (RP + 13), y: CY + uy * (RP + 13) });
      var s0 = RP + 5;
      var s1 = RP - 4;
      var hT = RP - 11;
      set(beam, { x1: CX + ux * s0, y1: CY + uy * s0, x2: CX + ux * s1, y2: CY + uy * s1 });
      head.setAttribute(
        "d",
        "M " + (CX + ux * hT).toFixed(2) + " " + (CY + uy * hT).toFixed(2) +
          " L " + (CX + ux * s1 + px * 4.5).toFixed(2) + " " + (CY + uy * s1 + py * 4.5).toFixed(2) +
          " L " + (CX + ux * s1 - px * 4.5).toFixed(2) + " " + (CY + uy * s1 - py * 4.5).toFixed(2) + " Z"
      );
    }
    draw();
    return {
      node: node,
      // 그림자 길이(cm, 교과서 값)
      set: function (value) {
        cur.value = value || 0;
        draw();
      },
      // 화면에서 전등 쪽 방향(오른쪽 +, 위쪽 +). 거의 화면을 똑바로 향하면(길이 0.15 미만) 앞 방향을 그대로 둔다
      aim: function (dx, dy) {
        var l = Math.hypot(dx, dy);
        if (!(l >= 0.15)) return;
        cur.ux = dx / l;
        cur.uy = dy / l;
        draw();
      },
      show: function (on) {
        node.hidden = !on;
      },
    };
  }

  // 두 화면(3D·2D)이 장면 안에 함께 두는 것: 빨리 감기 표시(모형), 화면 읽기용 알림, 측정기 확대 칸
  function makeSceneBits(host) {
    var ff = el("div", { class: "hud-ff", "aria-hidden": "true", hidden: true, text: "⏩ 빨리 감기(모형) · 공전하는 중" });
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    var inset = makeInset();
    [ff, live, inset.node].forEach(function (x) {
      host.appendChild(x);
    });
    return {
      inset: inset,
      ff: function (on) {
        ff.hidden = !on;
      },
      say: function (t) {
        live.textContent = t;
      },
      remove: function () {
        [ff, live, inset.node].forEach(function (x) {
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
    var box = el("div", { class: "o2-wrap" }, [svg, caption]);
    var bits = makeSceneBits(box); // 빨리 감기 표시·화면 읽기 알림·측정기 확대 칸(값은 장면 밖 측정값 패널)
    root.appendChild(box);

    // 끌어 옮겨 둔 자리·마지막으로 잰 자리에서 시작(새로고침·3D↔2D 전환 뒤)
    var start = globeAt && POS[globeAt.pos] && TILTS[globeAt.tilt] ? globeAt : null;
    var st = { angle: start ? POS[start.pos].angle : POS.ga.angle, tilt: start ? start.tilt : "vertical", pos: start ? start.pos : "ga", shown: false };
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
    // 측정값 패널(장면 밖)·설명 글·확대 칸을 지금 상태로. 확대 칸의 💡는 이 2D 그림에서 지구본 → 전등 방향
    function updateHud() {
      var shown = st.shown ? shadowOf(st.tilt, st.pos) : null;
      status.set(st.tilt, st.pos, shown);
      caption.textContent = st.shown
        ? "지구본이 " + POS[st.pos].name + " 위치에 있고, 측정기가 전등을 정면으로 향해요(남중). (모형)"
        : "지구본이 " + POS[st.pos].name + " 위치에 있어요. " + TILTS[st.tilt].name + " (모형)";
      if (st.shown) {
        var q = xy(st.angle);
        bits.inset.set(shown);
        bits.inset.aim(CX - q.x, q.y - CY); // 화면 위쪽이 +
      }
      bits.inset.show(st.shown);
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
        status.select(s.pos);
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
        bits.ff(true);
        status.mode("orbit", sel.pos);
        bits.say(POS[sel.pos].name + " 위치로 공전하는 중(빨리 감기)");
        await animate(to === from ? 500 : 1500, function (e) {
          st.angle = from + (to - from) * e;
          draw();
        });
        bits.ff(false);
        st.angle = POS[sel.pos].angle;
        st.pos = sel.pos;
        st.shown = true;
        draw();
        updateHud();
        setGlobeAt(sel);
        bits.say(cellName(sel.tilt, sel.pos) + ": 그림자 " + f1(shadowOf(sel.tilt, sel.pos)) + " cm");
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
        bits.remove();
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
      // 장면 안 부속(빨리 감기 표시·화면 읽기 알림·측정기 확대 칸). 3D 칸(.ss-view3d) 안이라 크게 보기의 막대에 가리지 않는다.
      var bits = makeSceneBits(container);

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
      // "자전축" 이름표는 축 끝(빨간 점) 오른쪽 옆에 붙인다(이름표 왼쪽 끝이 기준점) — 지구본 위쪽의 "우리나라" 이름표와 겹치지 않게.
      // 기울기 그룹에 붙어 자전해도 돌지 않는다.
      var axisLabel = M.label("자전축", { height: 0.3 });
      axisLabel.center.set(0, 0.5);
      axisLabel.position.set(0.13, GR * 1.45, 0);
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
      // "우리나라" 이름표: 측정기에 붙이면 자전할 때 함께 빙빙 돌고, 확대 화면에서 판을 가렸다(예전). → 장면에 따로 두고
      // 측정기 바로 위(이름표 아래 끝이 기준점)에 놓는다. 공전(빨리 감기)하는 동안과 확대 화면에서는 숨긴다(확대 칸이 이름을 대신한다).
      var devLabel = M.label("우리나라", { height: 0.26 });
      devLabel.center.set(0.5, 0);
      v.root.add(devLabel);

      // 빛의 방향 화살표(평행광 모형): 전등 쪽에서 지구본으로 오는 평행한 화살표 3개(지구본 중심 높이). apply()가 lightDir로 놓는다.
      var RAY_TAIL = 2.75; // 지구본 중심에서 화살표 꼬리까지
      var RAY_LEN = 1.08;
      var RAY_HEAD = 0.26;
      var rays = new T.Group();
      var rayMat = new T.MeshBasicMaterial({ color: 0xf08c00 });
      [-0.5, 0, 0.5].forEach(function (off) {
        var shaft = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, RAY_LEN, 10), rayMat);
        shaft.rotation.z = -Math.PI / 2; // 원기둥(+y) → +x
        shaft.position.set(RAY_LEN / 2, 0, off);
        var head = new T.Mesh(new T.ConeGeometry(0.09, RAY_HEAD, 14), rayMat);
        head.rotation.z = -Math.PI / 2;
        head.position.set(RAY_LEN + RAY_HEAD / 2, 0, off);
        rays.add(shaft, head);
      });
      v.root.add(rays);
      v.onThemeChange(function (dark) {
        rayMat.color.set(dark ? 0xffb347 : 0xf08c00);
      });

      // 지구본 끌기 손잡이: 지구본보다 조금 큰 보이지 않는 공(그려지지 않지만 끌기 판정에는 쓰인다). 받침·탁자 위 표시는 포함하지 않는다.
      var grab = new T.Mesh(new T.SphereGeometry(GR * 1.3, 16, 12), new T.MeshBasicMaterial({ visible: false }));
      place.add(grab);

      // 새로고침·3D↔2D 전환 뒤: 끌어 옮겨 둔 자리·마지막으로 잰 자리에서 시작
      var start = globeAt && POS[globeAt.pos] && TILTS[globeAt.tilt] ? globeAt : null;
      var st = { angle: start ? POS[start.pos].angle : POS.ga.angle, tilt: start ? start.tilt : "vertical", pos: start ? start.pos : "ga", spin: 0, shown: false };
      var orbiting = false; // ▶ 공전(빨리 감기) 중
      var closeNow = false; // 카메라가 지구본 가까이(확대 화면)
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
      // 빛이 나아가는 방향(전등 → 지구본, 수평 단위 벡터). 전등 빛(DirectionalLight)·빛 화살표·그림자 방향·확대 칸의 💡 방향이
      // 모두 이 한 벡터에서 나온다(따로 계산하지 않는다).
      var lightDir = new T.Vector3(1, 0, 0);
      var tmpV = new T.Vector3();
      function apply(tiltDeg) {
        place.position.copy(orbitPoint(st.angle));
        tiltQuat(tiltDeg != null ? tiltDeg : TILTS[st.tilt].angleDeg, tiltG.quaternion);
        spinG.rotation.y = st.spin;
        lightDir.copy(place.position).sub(lampPos).normalize();
        if (sun) {
          sun.position.copy(lampPos);
          sun.target.position.copy(place.position);
          sun.target.updateMatrixWorld();
        }
        rays.position.copy(place.position).addScaledVector(lightDir, -RAY_TAIL);
        rays.rotation.y = Math.atan2(-lightDir.z, lightDir.x); // 화살표(+x)가 빛이 나아가는 쪽
        v.root.updateMatrixWorld(true);
        drawShadow();
        placeDevLabel();
        if (st.shown) {
          bits.inset.set(shadowOf(st.tilt, st.pos));
          aimInset();
        }
        // fix-B2 L1(review-B): 확대 칸은 확대 화면일 때만 보인다 — st.shown만 보면 처음 방향(전체 화면)으로
        // 돌아온 뒤에도 남아 지구본(특히 '라' 자리)을 가렸다. closeNow는 onCam()이 실제 카메라 거리로 갱신한다.
        bits.inset.show(st.shown && closeNow);
      }
      function drawShadow() {
        shadowPivot.visible = st.shown;
        if (!st.shown) return;
        // 평행광 방향(lightDir)을 측정기 좌표로 바꿔 판 위에 투영 → 그림자 방향. 길이는 교과서 예시 값(× SC).
        var L = lightDir.clone();
        var q = new T.Quaternion();
        dev.getWorldQuaternion(q);
        L.applyQuaternion(q.invert());
        var dx = L.x, dz = L.z;
        var len = Math.hypot(dx, dz) || 1;
        shadowPivot.rotation.y = Math.atan2(-dz / len, dx / len);
        shadowPivot.scale.x = shadowOf(st.tilt, st.pos) * SC;
      }
      // "우리나라" 이름표는 측정기 위(막대 끝보다 높게), "자전축" 이름표는 화면에서 측정기 반대쪽 옆 — 두 이름표·측정기가 서로 겹치지 않게
      var capV = new T.Vector3();
      var camRx = new T.Vector3();
      function placeDevLabel() {
        dev.getWorldPosition(tmpV);
        devLabel.position.set(tmpV.x, tmpV.y + 0.6, tmpV.z);
        devLabel.visible = !orbiting && !closeNow;
        nCap.getWorldPosition(capV);
        camRx.set(1, 0, 0).applyQuaternion(v.camera.quaternion);
        // "우리나라" 이름표가 보이고 측정기가 화면에서 축 끝보다 오른쪽이면 "자전축"은 왼쪽에(두 이름표가 겹치지 않게).
        // 확대 화면에서는 "우리나라" 이름표가 없으므로 늘 오른쪽(왼쪽 위의 전체 화면 보기 버튼 쪽으로 가지 않게)
        var left = devLabel.visible && tmpV.sub(capV).dot(camRx) > 0.05;
        axisLabel.center.set(left ? 1 : 0, 0.5);
        axisLabel.position.x = left ? -0.13 : 0.13;
        // 휴대폰처럼 좁은 장면의 확대 화면에서는 자리가 모자라 확대 칸·전체 화면 보기 버튼과 겹치므로 "자전축" 이름표를 쉰다(막대·빨간 끝은 그대로)
        axisLabel.visible = !(closeNow && (container.clientWidth || 1024) < 480);
      }
      // 확대 칸의 💡 방향 = 지금 카메라 화면에서 전등 쪽(빛이 오는 쪽 = -lightDir)을 화면 가로·세로 축에 투영한 방향
      var camR = new T.Vector3();
      var camU = new T.Vector3();
      function aimInset() {
        v.camera.updateMatrixWorld();
        camR.set(1, 0, 0).applyQuaternion(v.camera.quaternion);
        camU.set(0, 1, 0).applyQuaternion(v.camera.quaternion);
        tmpV.copy(lightDir).negate();
        bits.inset.aim(tmpV.dot(camR), tmpV.dot(camU));
      }
      function drawMarks(selPos) {
        POS_IDS.forEach(function (id) {
          var on = id === selPos;
          marks[id].ring.material.color.set(on ? 0xf2a93b : 0x7c8797);
          marks[id].ring.scale.setScalar(on ? 1.15 : 1);
        });
      }
      // 측정값 패널(장면 밖)을 지금 상태로
      function updateHud() {
        status.set(st.tilt, st.pos, st.shown ? shadowOf(st.tilt, st.pos) : null);
      }
      st.spin = noonSpin(st.angle, TILTS[st.tilt].angleDeg);
      apply();
      updateHud();

      // 좁은 화면(휴대폰)에서는 이름표를 키운다
      var tags = [lampLabel, dirLabel, devLabel].concat(
        POS_IDS.map(function (id) {
          return marks[id].tag;
        })
      ).map(function (sp) {
        return { sp: sp, sx: sp.scale.x, sy: sp.scale.y };
      });
      var labelK = 0;
      function insetFits() {
        return (container.clientHeight || 400) >= 250;
      }
      function fitLabels() {
        // 3D 칸이 낮으면(휴대폰 + 크게 보기 등) 확대 칸이 장면을 거의 다 덮으므로 빼 둔다(관찰 카드의 눈금 그림이 대신한다).
        // 좁으면 확대 칸 글을 짧게
        bits.inset.node.classList.toggle("is-tiny", !insetFits());
        bits.inset.node.classList.toggle("is-small", (container.clientWidth || 1024) < 480);
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

      /* ── 확대(closeUp): 방향을 뒤집지 않는다 ──
         예전에는 카메라를 전등 쪽으로 돌려 지구본을 바라봐서 전체 화면과 좌우가 거울처럼 뒤집혔다(사용자 지적 — 예: 라에서 전체 화면은
         전등·측정기가 왼쪽인데 확대 화면은 오른쪽). 이제는 지금 카메라가 있는 쪽(방위)을 그대로 두고 지구본으로 다가가며 조금 위에서
         내려다본다 → 전등이 화면의 어느 쪽인지(가: 아래·앞, 나: 오른쪽, 다: 위·뒤, 라: 왼쪽)가 전체 화면과 같다.
         높이각만 자리·기울기에 맞춰 고른다(36°~78°, 50°에 가까울수록 좋음): ① 측정기 판이 카메라 쪽을 보고(가려지지 않게),
         ② 화면에 그림자가 충분히 길게 보이고, ③ 화면에서 그림자가 전등 반대쪽으로 뻗어 보이는 각. */
      var CLOSE_DIST = 6.6; // 확대 화면에서 카메라 ~ 바라보는 점
      var CLOSE_NEAR = 9.5; // 카메라가 지구본에서 이보다 가까우면 확대 화면으로 본다(처음 방향은 늘 13 이상)
      var UPV = new T.Vector3(0, 1, 0);
      function closeUpPose() {
        v.root.updateMatrixWorld(true);
        var gp = place.position.clone();
        var dp = dev.getWorldPosition(new T.Vector3());
        var nrm = new T.Vector3(0, 1, 0).applyQuaternion(dev.getWorldQuaternion(new T.Quaternion())); // 판이 향하는 쪽(막대 방향)
        var sdir = new T.Vector3(1, 0, 0).applyQuaternion(shadowPivot.getWorldQuaternion(new T.Quaternion())); // 그림자가 뻗는 쪽
        var tl = lightDir.clone().negate(); // 지구본 → 전등
        var az = v.camera.position.clone().sub(v.controls.target);
        az.y = 0;
        if (az.lengthSq() < 1e-6) az.set(0, 0, 1);
        az.normalize();
        var best = null;
        for (var e = 36; e <= 78; e += 2) {
          var er = (e * Math.PI) / 180;
          var c = new T.Vector3(az.x * Math.cos(er), Math.sin(er), az.z * Math.cos(er)); // 바라보는 점 → 카메라
          var fwd = c.clone().negate();
          var right = new T.Vector3().crossVectors(fwd, UPV).normalize();
          var up = new T.Vector3().crossVectors(right, fwd).normalize();
          var face = nrm.dot(c);
          var lx = tl.dot(right);
          var ly = tl.dot(up);
          var sx = sdir.dot(right);
          var sy = sdir.dot(up);
          var sl = Math.hypot(sx, sy) || 1e-6;
          var opp = (lx * sx + ly * sy) / ((Math.hypot(lx, ly) || 1) * sl); // -1이면 화면에서 정반대
          var ok = face >= 0.2 && sl >= 0.3 && opp <= -0.2;
          var score = (ok ? 0 : 100 - 10 * face - 10 * sl + 10 * opp) + Math.abs(e - 50) / 10;
          if (!best || score < best.score) best = { score: score, c: c, e: e };
        }
        var target = gp.clone().lerp(dp, 0.45);
        // 화면 오른쪽 위의 확대 칸과 겹치지 않게 장면을 왼쪽으로 옮긴다(바라보는 점을 화면 오른쪽으로 — 확대 칸 폭의 절반만큼,
        // 화면 폭의 8~20%, 폭 480px 미만은 10%까지). 확대 칸을 뺀 낮은 장면에서는 옮기지 않는다(왼쪽 위 전체 화면 보기 버튼에 측정기가 가리지 않게)
        if (insetFits()) {
          var cw = container.clientWidth || 1;
          var frac = Math.min(cw < 480 ? 0.1 : 0.2, Math.max(0.08, (0.5 * (bits.inset.node.getBoundingClientRect().width || 0)) / cw)); // 좁은 화면은 덜 옮긴다(왼쪽 위 버튼)
          var bRight = new T.Vector3().crossVectors(best.c.clone().negate(), UPV).normalize();
          var halfW = CLOSE_DIST * Math.tan((v.camera.fov * Math.PI) / 360) * (v.camera.aspect || 1);
          target.addScaledVector(bRight, 2 * frac * halfW);
        }
        return { position: target.clone().addScaledVector(best.c, CLOSE_DIST), target: target, elev: best.e };
      }
      function closeUp(ms) {
        var pose = closeUpPose();
        var fromP = v.camera.position.clone();
        var fromT = v.controls.target.clone();
        return v.tween(ms, function (e) {
          v.controls.target.lerpVectors(fromT, pose.target, e);
          v.camera.position.lerpVectors(fromP, pose.position, e);
        });
      }
      // 카메라가 움직일 때마다(끌어 돌리기·확대·처음 방향): 확대 화면이면 "우리나라" 이름표를 숨기고 지구본 끌기를 끈다
      // (확대 화면에서 끌면 카메라 돌려 보기), 확대 칸의 💡 방향은 지금 화면에 맞춘다(학생이 돌려 보아도 화면과 같게).
      function onCam() {
        var near = v.camera.position.distanceTo(place.position) < CLOSE_NEAR;
        if (near !== closeNow) {
          closeNow = near;
          grab.visible = !near;
          // fix-B2 L1(review-B): closeUp()·flyHome() 트윈은 apply()를 다시 부르지 않으므로, 카메라가 실제로
          // 가깝다/멀다 경계를 넘는 이 순간에 확대 칸을 직접 다시 보이거나 숨긴다(전체 화면으로 돌아왔는데
          // 확대 칸이 남아 있던 문제).
          bits.inset.show(st.shown && closeNow);
          // fix-B2 L6(review-B): 확대 화면에서는 자리 이름표(가~라)가 왼쪽 위 "⛶ 전체 화면 보기" 토글과 겹칠 수
          // 있어 잠시 숨긴다 — 위치를 고르는 다른 길(버튼·지구본 끌기)은 그대로 있다.
          POS_IDS.forEach(function (id) {
            marks[id].tag.visible = !closeNow;
          });
        }
        placeDevLabel(); // 이름표 숨김·"자전축" 이름표 쪽을 지금 화면에 맞게
        if (st.shown) aimInset();
      }
      v.controls.addEventListener("change", onCam);
      onCam();
      // 기록한 뒤: 확대 화면이었으면 처음 방향(전체 화면)으로 돌아가 궤도와 다음에 고른 자리가 보이게 한다(다음 ▶도 여기서 시작한다)
      function afterRecord() {
        if (closeNow && !orbiting) v.flyHome(450);
      }
      sceneHooks.afterRecord = afterRecord;

      /* ── 지구본 끌기: 궤도를 따라 끌면 따라오고, 놓으면 가장 가까운 자리(가~라)에 붙어 그 위치가 골라진다 ──
         끄는 동안 카메라는 돌지 않는다(공통 틀 v.draggable). 손가락이 궤도 중심(전등) 둘레로 돈 각도만큼 지구본을 옮긴다(상대 각도 —
         잡은 자리에서 튀지 않게). 자전축은 늘 같은 방향(기울기 그룹을 돌리지 않음). 버튼·가~라 글자 누르기는 그대로. */
      var drag = null;
      var snapAnim = null;
      function pointerAngle(p) {
        return (Math.atan2(-p.z, p.x) * 180) / Math.PI; // orbitPoint와 같은 각도(위에서 볼 때 시계 반대 방향)
      }
      v.draggable(grab, {
        plane: { normal: [0, 1, 0], point: [0, GY, 0] }, // 궤도 면
        onStart: function () {
          drag = exp.isBusy() || orbiting || snapAnim ? null : { start: st.angle, acc: 0, last: null, moved: false, near: null };
        },
        onDrag: function (info) {
          if (drag && exp.isBusy()) drag = null; // 실험(▶)이 시작되면 끌기를 그만둔다
          if (!drag || !info.point || Math.hypot(info.point.x, info.point.z) < 1.2) return; // 전등 바로 옆은 각도가 흔들린다
          var a = pointerAngle(info.point);
          if (drag.last == null) {
            drag.last = a;
            return;
          }
          drag.acc += wrap180(a - drag.last);
          drag.last = a;
          if (!drag.moved) {
            if (Math.abs(drag.acc) < 3) return; // 살짝 누른 것은 끌기가 아니다
            drag.moved = true;
            st.shown = false; // 잰 자리를 떠나면 그림자는 없다
          }
          st.angle = drag.start + drag.acc;
          apply();
          var np = nearestPos(st.angle);
          if (np !== drag.near) {
            drag.near = np;
            drawMarks(np);
          }
          status.mode("drag", np);
        },
        onEnd: function () {
          var d = drag;
          drag = null;
          if (!d || !d.moved) return;
          var pid = nearestPos(st.angle);
          var from = st.angle;
          var delta = wrap180(POS[pid].angle - from);
          snapAnim = v
            .tween(220, function (e) {
              st.angle = from + delta * e;
              apply();
            })
            .then(function () {
              snapAnim = null;
              st.angle = POS[pid].angle;
              st.pos = pid;
              apply();
              updateHud();
              setGlobeAt({ tilt: st.tilt, pos: pid });
              ctx.onPick({ pos: pid }); // 버튼을 누른 것과 같다(선택·잠금 규칙·저장 모두 공통 틀 그대로)
              bits.say("지구본을 " + POS[pid].name + " 위치에 놓았어요.");
            });
        },
      });

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
          status.select(s.pos);
          if (s.tilt && s.tilt !== st.tilt) animateTilt(s.tilt);
          else updateHud();
          v.render();
        },
        run: async function (sel) {
          drag = null; // 끄는 중이었으면 그만둔다
          st.shown = false;
          apply();
          updateHud();
          await v.flyHome(350);
          if (sel.tilt !== st.tilt) await animateTilt(sel.tilt);
          else if (tiltAnim) await tiltAnim;
          if (snapAnim) await snapAnim; // 끌어 놓은 지구본이 자리에 붙는 중이면 끝난 뒤에
          var from = st.angle % 360;
          if (from <= 0) from += 360;
          var to = forwardAngle(from, POS[sel.pos].angle);
          var deg = TILTS[sel.tilt].angleDeg;
          var spinEnd = noonSpin(POS[sel.pos].angle, deg);
          var turns = to === from ? 1 : 3; // 옮겨 가는 동안 자전(빨리 감기)
          orbiting = true;
          placeDevLabel(); // 자전하는 동안 "우리나라" 이름표는 숨긴다(빙빙 돌지 않게)
          bits.ff(true);
          status.mode("orbit", sel.pos);
          bits.say(POS[sel.pos].name + " 위치로 공전하는 중(빨리 감기)");
          var startSpin = st.spin;
          // 자전은 처음부터 끝까지 늘 서→동(북극 위에서 볼 때 시계 반대 방향 = spin 이 커지는 쪽)으로만 돈다(2026-09-26 사용자 지적 —
          // 전에는 지금 각도에 잇는 보정이 처음 1/6 동안 빠르게 줄어 잠깐 동→서로 돌았다). 지금 각도에서 목표(남중) 각도까지
          // 앞으로 가는 몫 + 빨리 감기 바퀴 수만큼, 지금 각도에서 곧장 이어서 돈다.
          var TAU = 2 * Math.PI;
          var spinAhead = (((spinEnd - startSpin) % TAU) + TAU) % TAU;
          var spinTotal = spinAhead + turns * TAU;
          await v.tween(to === from ? 700 : 1500, function (e) {
            st.angle = from + (to - from) * e;
            st.spin = startSpin + spinTotal * e;
            apply();
          });
          orbiting = false;
          st.angle = POS[sel.pos].angle;
          st.pos = sel.pos;
          st.spin = spinEnd;
          bits.ff(false);
          st.shown = true;
          apply();
          updateHud();
          await closeUp(600);
          setGlobeAt(sel);
          bits.say(cellName(sel.tilt, sel.pos) + ": 측정기가 전등을 정면으로 향해요. 그림자 " + f1(shadowOf(sel.tilt, sel.pos)) + " cm");
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
          v.controls.removeEventListener("change", onCam);
          if (sceneHooks.afterRecord === afterRecord) sceneHooks.afterRecord = null;
          drag = null;
          bits.remove();
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
