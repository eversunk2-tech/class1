/*
 * app.js — sci-6-2-1-3 "계절별 태양의 남중 고도와 낮의 길이의 관계는?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·저장·로그인·예상/분석/정리 모듈을 맡고, 이 파일은
 *   ① 실험하기 화면(앱 전용): 달 바(3월 → 2월, 계절별 묶음) · 값 패널 · 3D/2D 하늘 모형 · 궤적 보기(이번 달만·계절 대표 3개)
 *   ② 분석 표·꺾은선그래프 2개(남중 고도, 낮의 길이), 보기 고르기 2개, 결론 1개, 궁금한 점 한 줄(선택)   을 만든다.
 *
 * spec "개정 1": 12달 모두 측정. 달을 누르면 그 달 21일 태양의 하루 길을 약 1.2초 빨리 감기(모형)로 보여 주고,
 *   fix-1: 기록하기를 누르면 아직 기록하지 않은 다음 달을 자동으로 골라 재생한다(한 달 = 재생 → 기록 한 번). 다른 달은 언제든 직접 고를 수 있다.
 *   태양이 남중할 때 남중 고도, 질 때 낮의 길이가 값 패널에 나타난다 → '📝 기록하기'. 학생은 값을 타이핑하지 않는다.
 *   공통 틀의 Experiment(조건 고르기 → 실행 → 관찰 카드 → 확인 → 기록)는 이 흐름과 맞지 않아 쓰지 않고,
 *   같은 CSS 틀(.ss-exp-layout 등)과 Sim3D·RecordStore만 쓴다(공통 틀은 고치지 않음).
 *
 * 과학 원칙
 *  - 값은 실험관찰 예시표(서울특별시, 2024년 매월 21일)만 쓴다. 남중 고도는 소수 첫째 자리, 낮의 길이는 "○시간 ○분".
 *  - 태양의 길은 서울에서 본 하루 길(천구에서 적위가 일정한 원)로 그린다. 길의 가장 높은 곳 = 그 달의 남중 고도(정확히 일치).
 *    뜨고 지는 지점은 같은 식에서 나온다(낮이 긴 달일수록 길이 넓고 길다). 화면에는 "모형"으로 밝힌다.
 *  - 계절 변화의 원인(자전축 기울기 등)은 탐구 5에서 배운다 — 화면 어디에도 쓰지 않는다.
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
      if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;

  /* ───────── 자료 ───────── */
  var SEASON = {};
  C.seasons.forEach(function (s) {
    SEASON[s.id] = s;
  });
  var MONTHS = C.months; // 실험관찰 순서: 3월 → 2월
  var BY = {};
  MONTHS.forEach(function (m) {
    BY[m.month] = m;
  });
  function f1(v) {
    return Number(v).toFixed(1);
  }
  function dayLabel(min) {
    return Math.floor(min / 60) + "시간 " + (min % 60) + "분";
  }
  function seasonOf(month) {
    return SEASON[BY[month].season];
  }
  function monthTitle(month) {
    var s = seasonOf(month);
    return month + "월 21일 · " + s.icon + " " + s.name;
  }

  /* ───────── 태양의 하루 길(모형) ─────────
   * 위도 φ, 적위 δ, 시간각 H(오전 음수)일 때 지평 좌표:
   *   위 = sinφ sinδ + cosφ cosδ cosH,  동 = −cosδ sinH,  북 = cosφ sinδ − sinφ cosδ cosH
   * δ는 남중 고도에서 거꾸로 구한다: 남중 고도 = 90° − φ + δ → H = 0에서 고도가 표의 값과 정확히 같다. */
  var RAD = Math.PI / 180;
  var PHI = C.latitude * RAD;
  function geo(month) {
    var a = BY[month].altitude;
    var dec = (a - (90 - C.latitude)) * RAD;
    var H0 = Math.acos(clamp(-Math.tan(PHI) * Math.tan(dec), -1, 1)); // 해가 뜨고 지는 시간각
    return { alt: a, dec: dec, H0: H0 };
  }
  function sunDir(dec, H) {
    return {
      up: Math.sin(PHI) * Math.sin(dec) + Math.cos(PHI) * Math.cos(dec) * Math.cos(H),
      east: -Math.cos(dec) * Math.sin(H),
      north: Math.cos(PHI) * Math.sin(dec) - Math.sin(PHI) * Math.cos(dec) * Math.cos(H),
    };
  }
  // 그 달 남중(H = 0)의 태양 방향 — 3D(태양·그림자·빛줄기·호)와 '옆에서 본 모습' 칸이 모두 이 값 하나를 쓴다(따로 계산하지 않는다, spec 개정 4)
  var NOON = {};
  function noonSun(month) {
    return NOON[month] || (NOON[month] = sunDir(geo(month).dec, 0));
  }

  /* 태양 고도 측정기(받침판 + 막대기, 모형) 치수 — 3D와 '옆에서 본 모습' 칸이 같이 쓴다(spec 개정 4, 하늘 반구 반지름 RS = 8 기준).
   *  - 막대기 DEV.stick: 예전(1)에는 처음 시점에서 여름 그림자(막대기 길이의 약 1/4)와 호가 몇 px뿐이라 3배로 키웠다.
   *  - 받침판: 12달 남중 그림자가 모두 판 위에 오게 남북으로 길게, 막대기는 판의 남쪽 끝 가까이(남중 그림자는 북쪽으로 생긴다).
   *  - 햇빛은 평행하다 → 막대기 끝을 지나는 빛줄기는 태양 방향과 평행하다. 하늘 반구의 중심(원점)이 막대기 끝이 아니므로 그 빛줄기는
   *    모형 속 태양 중심에서 |끝 높이 × cos(고도) + 막대기 z × sin(고도)|만큼 비껴간다. 막대기를 정남쪽으로 옮겨 가장 낮은·가장 높은
   *    남중 고도에서 이 거리가 같아지게 해(DEV.z = −끝 높이 ÷ tan(두 고도의 가운데)) 12달 중 가장 큰 값을 줄였다(지금 치수로 원점에
   *    둘 때 2.67 → 1.52, 3·9월은 0.02 이하). 태양 원반·빛무리를 조금 키워 빛줄기가 빛무리 안에서 나오게 했다(build3D). */
  var DEV = (function () {
    var alts = MONTHS.map(function (m) {
      return m.altitude;
    });
    var lo = Math.min.apply(null, alts);
    var hi = Math.max.apply(null, alts);
    var d = { stick: 3.0, r: 0.08, top: 0.05, halfW: 1.25, marginS: 0.55, marginN: 0.6 };
    d.tipY = d.top + d.stick; // 막대기 끝의 높이(땅 = 0)
    d.z = -d.tipY / Math.tan(((lo + hi) / 2) * RAD); // 막대기 자리(정남쪽이 −z)
    d.z0 = d.z - d.marginS; // 받침판 남쪽 끝
    d.z1 = d.z + d.stick / Math.tan(lo * RAD) + d.marginN; // 북쪽 끝(가장 긴 남중 그림자 + 여유)
    return d;
  })();
  // 3D 처음 시점의 방향(장면 가운데 → 카메라) — Sim3D의 viewDir, '옆에서 본 모습' 칸의 좌우(VIEW_RIGHT)가 같이 쓴다
  var VIEW_DIR = [-0.34, 0.5, 0.8];
  /* ───────── 저장 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return String(r.month);
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  function recOf(month) {
    return records.get(String(month)) || null;
  }
  function recordedMonths() {
    return MONTHS.filter(function (m) {
      return !!recOf(m.month);
    }).map(function (m) {
      return m.month;
    });
  }
  function allRecorded() {
    return recordedMonths().length >= MONTHS.length;
  }
  var seen = store.get("seen", {}) || {}; // 하루 길을 끝까지 본 달(기록하기를 켜는 조건)
  var selMonth = Number(store.get("month", 0)) || null;
  if (selMonth && !BY[selMonth]) selMonth = null;
  /* 궤적 보기(개편 2026-09-25): "이번 달만"(기본) · "계절 대표 3개"(기록 여부와 무관하게 3·6·12월 값으로 계산해 그린다,
   * 봄·가을은 3월 기준 한 선). 예전의 "지난 경로 보임/숨김"(기록한 달을 전부 남겨 두어 헷갈리던 것)은 없앴다.
   * 새 UI 설정 키 pathMode를 쓰고 예전 ghosts 키는 더 이상 읽지 않는다(저장 키 버전·기록 구조는 그대로). */
  var pathMode = store.get("pathMode", "current");
  if (pathMode !== "current" && pathMode !== "compare3") pathMode = "current";
  // 대표 선(fix-B1 L3): 굵고 진한 점선. 색은 달별 선(계절 색 실선)·하늘 색과 구별되는 색 — 색만으로 구분하지 않게 범례에 이름을 쓰고,
  // 선 모양(점선 ↔ 지금 보는 달의 실선)으로도 구분한다. dark = 어두운 3D 배경에서 쓰는 밝은 색.
  var COMPARE3 = [
    { id: "springfall", label: "봄·가을", month: 3, color: "#7b3fb8", dark: "#c3a3ff" },
    { id: "summer", label: "여름", month: 6, color: "#d81b60", dark: "#ff7aa8" },
    { id: "winter", label: "겨울", month: 12, color: "#00838f", dark: "#45d3e0" },
  ];

  /* ───────── 1. 예상하기 / 4. 정리 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);

  /* 궁금한 점: 선택 입력 한 줄(비워도 마칠 수 있음). 저장 키 "curiosity" */
  var curiosityText = store.get("curiosity", "") || "";
  (function () {
    var saveCur = S.debounce(function () {
      store.set("curiosity", curiosityText);
    }, 250);
    var inp = el("input", {
      id: "ss-curiosity",
      type: "text",
      class: "ss-num-input ss-text-input",
      maxlength: "200",
      autocomplete: "off",
      placeholder: C.curiosity.placeholder,
    });
    inp.value = curiosityText;
    inp.addEventListener("input", function () {
      curiosityText = inp.value;
      saveCur();
    });
    $("curiosity-root").appendChild(
      el("div", { class: "ss-card" }, [el("label", { for: "ss-curiosity", class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "선택" }), C.curiosity.prompt]), inp])
    );
  })();

  /* ───────── 남중할 때 옆에서 본 모습 칸(모형) — spec 개정 4 보충(2026-09-26 사용자 결정) ─────────
   * 탐구 2(sci-6-2-1-2)의 '옆에서 본 모습' 칸을 본떴다. 3D 처음 시점은 남중 그림(막대기·그림자·빛줄기·호)이 담긴 자오선 면(정남북
   * 수직면)을 약 20° 비스듬히 보므로 호가 실제 각보다 작고 납작하게 보인다(여름은 그림자가 짧아 몇 px). 이 칸은 그 면을 정면으로 본
   * 그림이라 칸 속 빛줄기와 땅이 이루는 각 = 그 달 남중 고도다.
   *  - 3D와 같은 태양 방향 값 noonSun(month) 하나로 그린다: 각의 cos·sin = 그 값의 수평 길이·위 성분, 그림자 길이 = 막대기 길이 ×
   *    수평 길이 ÷ 위 성분(3D 그림자 끝과 같은 식), 태양 → 막대기 끝 → 그림자 끝이 한 직선. 막대기·받침판 비율도 3D와 같은 DEV.
   *  - 좌우는 탐구 2와 같은 약속(3D 처음 시점 화면의 좌우와 같게): 태양이 처음 시점 화면의 왼쪽이면 그림자는 오른쪽으로 그린다.
   *    남중 태양은 정남쪽이라 처음 시점(북북동에서 남쪽 하늘을 봄)에서 늘 왼쪽 → 칸의 왼쪽 = 남, 오른쪽 = 북(동쪽에서 서쪽을 바라본
   *    모습). 땅 양끝에 '남'·'북'을 적는다.
   *  - 숫자는 쓰지 않는다(값은 값 패널에만). 글자는 안 바뀌는 것('태양 고도', '남', '북', 칸 이름, 안내)뿐.
   *  - 자리: 값 칸 맨 아래(기록하기 아래) — 기본 화면은 오른쪽(좁은 화면은 아래) 패널, 크게 보기는 값·기록하기가 장면 안 막대로
   *    옮겨 가므로 조작 칸 안(달 고르기 바로 아래). 장면·버튼을 가리지 않고, 3D·2D 어느 쪽으로 보든 보인다.
   *  - 달을 고르기 전·태양이 남중하기 전에는 안내 글만(값 패널과 같은 때에 나타난다). */
  // 칸 좌표(viewBox 200×130): 땅 GY, 막대기 밑동 SX, 1(모형 단위) = K. 여름(75.5°) 태양이 위로, 겨울(29.0°) 태양이 왼쪽으로, 겨울 그림자·받침판이
  // 오른쪽으로 칸 안에 들어오는 가장 큰 K(여름 그림자·호가 되도록 크게). 태양은 막대기 끝에서 빛줄기를 따라 SUN_S만큼 떨어진 곳
  // (실제로는 아주 멀다 — 방향만 맞춘다).
  var SV = { W: 200, H: 130, GY: 110, SX: 30, K: 26.5, SUN_S: 0.8, SUN_R: 6, ARC_MAX: 32, ARC_K: 0.76 };
  // 처음 시점 카메라의 화면 오른쪽 방향(장면 x·z): 앞(카메라 → 가운데)의 수평 성분 f에 대해 오른쪽 = f × 위 = (−f.z, 0, f.x)
  var VIEW_RIGHT = (function () {
    var fx = -VIEW_DIR[0];
    var fz = -VIEW_DIR[2];
    var n = Math.hypot(fx, fz);
    return { x: -fz / n, z: fx / n };
  })();
  function makeSideView() {
    var LABEL = "태양이 남중할 때 막대기와 그림자를 옆에서 본 모습(모형)";
    var g = svg("svg", { viewBox: "0 0 " + SV.W + " " + SV.H, class: "sv-svg", "aria-hidden": "true", focusable: "false" });
    g.appendChild(svg("rect", { x: 0, y: 0, width: SV.W, height: SV.GY, class: "sv-sky" }));
    g.appendChild(svg("rect", { x: 0, y: SV.GY, width: SV.W, height: SV.H - SV.GY, class: "sv-earth" }));
    var dyn = svg("g", {}); // 달이 정해졌을 때만 보이는 것
    var board = svg("rect", { y: SV.GY, height: 3.5, class: "sv-board" });
    var shadow = svg("rect", { y: SV.GY - 1.5, height: 4.5, class: "sv-shadow" });
    var stick = svg("rect", { x: SV.SX - DEV.r * SV.K, y: SV.GY - DEV.stick * SV.K, width: 2 * DEV.r * SV.K, height: DEV.stick * SV.K, class: "sv-stick" });
    var arc = svg("path", { class: "sv-arc" });
    var ray = svg("line", { class: "sv-ray" });
    var sun = svg("circle", { r: SV.SUN_R, class: "sv-sun" });
    var lbl = svg("text", { y: SV.GY + 15, "text-anchor": "middle", class: "sv-lbl" }, "태양 고도");
    dyn.appendChild(board);
    g.appendChild(dyn);
    g.appendChild(svg("line", { x1: 0, x2: SV.W, y1: SV.GY, y2: SV.GY, class: "sv-ground" }));
    var dyn2 = svg("g", {});
    [shadow, stick, arc, ray, sun, lbl].forEach(function (x) {
      dyn2.appendChild(x);
    });
    g.appendChild(dyn2);
    var dirL = svg("text", { x: 6, y: SV.GY + 15, class: "sv-dir" });
    var dirR = svg("text", { x: SV.W - 6, y: SV.GY + 15, "text-anchor": "end", class: "sv-dir" });
    g.appendChild(dirL);
    g.appendChild(dirR);
    var guide = svg("text", { x: SV.W / 2, y: SV.GY / 2 + 4, "text-anchor": "middle", class: "sv-guide" });
    g.appendChild(guide);
    var node = el("figure", { class: "side-view", role: "img", "aria-label": LABEL }, [el("figcaption", { class: "side-cap", "aria-hidden": "true", text: "남중할 때 옆에서 본 모습(모형)" }), g]);
    function p2(x) {
      return x.toFixed(2);
    }
    var last = null;
    return {
      node: node,
      // month: 그릴 달(없으면 안내만), wait: 달은 골랐고 태양이 남중하기 전
      set: function (month, wait) {
        var key = month ? "m" + month : wait ? "wait" : "none";
        if (key === last) return;
        last = key;
        if (!month) {
          dyn.style.display = "none";
          dyn2.style.display = "none";
          guide.style.display = "";
          guide.textContent = wait ? "태양이 남중하면 나타나요…" : "달을 고르면 나타나요";
          dirL.textContent = "남";
          dirR.textContent = "북";
          node.setAttribute("aria-label", LABEL + ": " + guide.textContent);
          return;
        }
        var d = noonSun(month); // 3D와 같은 값
        var hl = Math.hypot(d.east, d.north); // cos(남중 고도)
        var s = d.up; // sin(남중 고도)
        if (!(s > 0) || !(hl > 0)) return;
        // 그림자가 뻗는 쪽: 태양이 처음 시점 화면의 왼쪽이면 오른쪽(+1) — 탐구 2와 같은 약속(장면 x = −동, z = 북)
        var sg = -d.east * VIEW_RIGHT.x + d.north * VIEW_RIGHT.z > 0 ? -1 : 1;
        var top = SV.GY - DEV.stick * SV.K; // 막대기 끝(칸 좌표)
        var L = (DEV.stick * hl) / s; // 그림자 길이(모형 단위) = 3D의 |막대기 밑동 → 그림자 끝|
        var tx = SV.SX + sg * L * SV.K; // 그림자 끝
        var sx = SV.SX - sg * SV.SUN_S * SV.K * hl; // 태양: 막대기 끝에서 태양 쪽으로(태양 → 막대기 끝 → 그림자 끝이 한 직선)
        var sy = top - SV.SUN_S * SV.K * s;
        var b0 = SV.SX - sg * DEV.marginS * SV.K; // 받침판(태양 쪽 끝 ~ 반대쪽 끝) — 3D 받침판과 같은 비율
        var b1 = SV.SX + sg * (DEV.z1 - DEV.z) * SV.K;
        board.setAttribute("x", p2(Math.min(b0, b1)));
        board.setAttribute("width", p2(Math.abs(b1 - b0)));
        shadow.setAttribute("x", p2(Math.min(SV.SX, tx)));
        shadow.setAttribute("width", p2(Math.abs(tx - SV.SX)));
        ray.setAttribute("x1", p2(sx));
        ray.setAttribute("y1", p2(sy));
        ray.setAttribute("x2", p2(tx));
        ray.setAttribute("y2", String(SV.GY));
        sun.setAttribute("cx", p2(sx));
        sun.setAttribute("cy", p2(sy));
        // 호: 그림자 끝에서 땅(막대기 쪽)과 빛줄기 사이 — 반지름은 그림자 길이의 ARC_K배(막대기에 닿지 않게), 가장 크게 ARC_MAX
        var r = Math.min(SV.ARC_MAX, SV.ARC_K * L * SV.K);
        arc.setAttribute(
          "d",
          "M " + p2(tx) + " " + SV.GY + " L " + p2(tx - sg * r) + " " + SV.GY + " A " + p2(r) + " " + p2(r) + " 0 0 " + (sg > 0 ? 1 : 0) + " " + p2(tx - sg * r * hl) + " " + p2(SV.GY - r * s) + " Z"
        );
        lbl.setAttribute("x", p2(clamp(tx - sg * r * 0.5, 47, SV.W - 47))); // '남'·'북'과 겹치지 않게
        dirL.textContent = sg > 0 ? "남" : "북";
        dirR.textContent = sg > 0 ? "북" : "남";
        dyn.style.display = "";
        dyn2.style.display = "";
        guide.style.display = "none";
        node.setAttribute(
          "aria-label",
          month +
            "월 21일 " +
            LABEL +
            ": 왼쪽이 " +
            (sg > 0 ? "남쪽, 오른쪽이 북쪽" : "북쪽, 오른쪽이 남쪽") +
            "이에요. 남쪽 하늘의 태양에서 오는 빛줄기가 막대기 끝을 지나 그림자 끝에 닿아요. 빨간 호는 그림자 끝에서 빛줄기와 땅이 이루는 각, 태양 고도예요."
        );
      },
    };
  }

  /* ═════════ 2. 실험하기 (앱 전용 화면) ═════════ */
  var R = {};
  (function buildExperimentDom() {
    var root = $("experiment-root");
    root.textContent = "";
    // 알아 두기
    var introBox = el("div", { class: "intro-body" });
    C.intro.forEach(function (line) {
      introBox.appendChild(S.rich(line, "p"));
    });
    introBox.appendChild(el("p", { class: "ss-help", text: "📚 자료: " + C.source.note + " (" + C.source.area + ", 매월 21일 오후 12시 30분 무렵)" }));
    var det = el("details", { class: "ss-card ss-intro" }, [el("summary", { text: "🔎 실험 방법 알아 두기" }), introBox]);
    det.open = store.get("intro", true) !== false;
    det.addEventListener("toggle", function () {
      if (S.Experiment.isQuietToggle(det)) return; // 크게 보기가 잠시 접고 편 것(학생 선택 아님)
      store.set("intro", det.open);
    });
    root.appendChild(det);
    R.lead = el("p", { class: "ss-lead", "aria-live": "polite" });
    root.appendChild(R.lead);

    // 하늘 모형(3D/2D)
    R.view3d = el("div", { class: "ss-view3d" });
    R.view2d = el("div", { class: "ss-view2d", hidden: true });
    R.tip = el("p", { class: "ss-view-tip" });
    R.loading = el("p", { class: "ss-view-loading", text: "3D 하늘 모형을 준비하고 있어요…" });
    R.ff = el("div", { class: "ff-badge", hidden: true, "aria-hidden": "true" });
    R.viewBox = el("div", { class: "ss-exp-view sky-view" }, [R.view3d, R.view2d, el("div", { class: "ss-view-badge", "aria-hidden": "true", text: "모형" }), R.ff, R.tip, R.loading]);
    // 좁은 화면(휴대폰)에서는 안내 글이 두 줄이 되어 장면 아래 가운데의 방위 이름표('북')를 가린다 → 3D 칸을 안내 글 위에서 끝내
    // 안내 글 자리를 비워 둔다(style.css, 안내 글 높이 --tip-h) — fix-B1 L11
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        R.viewBox.style.setProperty("--tip-h", Math.ceil(R.tip.getBoundingClientRect().height) + "px");
      }).observe(R.tip);
    }
    R.btnReset = el("button", { type: "button", class: "ss-btn", text: "🎥 처음 방향으로" });
    R.btnPathCurrent = el("button", { type: "button", class: "ss-btn", "aria-pressed": "true", text: "🌤️ 이번 달만" });
    R.btnPathCompare = el("button", { type: "button", class: "ss-btn", "aria-pressed": "false", text: "📊 계절 대표 3개" });
    R.pathModeGroup = el("div", { class: "ss-row path-mode-group", role: "group", "aria-label": "궤적 보기" }, [R.btnPathCurrent, R.btnPathCompare]);
    R.btnToggle = el("button", { type: "button", class: "ss-btn", text: "2D로 보기" });
    // 값(태양 고도·낮의 길이)은 장면 위에 겹쳐 띄우지 않는다 — "⛶ 전체 화면 보기" 토글이 그 자리(왼쪽 위)에 오고,
    // 바뀌는 값은 3D 이름표 대신 ②값 패널(R.valuePanel)로 보여 준다(꺼짐일 때도 장면 바로 아래, 켜짐일 때는 장면 안 막대).
    var viewCol = el("div", { class: "ss-exp-view-col" }, [R.viewBox, el("div", { class: "ss-row ss-view-tools sky-tools" }, [R.btnReset, R.pathModeGroup, R.btnToggle])]);
    var modelNote = S.rich(C.modelNote, "p");
    modelNote.className = "ss-help ss-model-note";

    // ① 달 바
    R.monthBtns = {};
    R.monthBar = el("div", { class: "month-bar", role: "group", "aria-label": "관찰할 달 고르기(3월부터 2월까지)" });
    C.seasons.forEach(function (s) {
      var row = el("div", { class: "season-months" });
      MONTHS.filter(function (m) {
        return m.season === s.id;
      }).forEach(function (m) {
        var b = el("button", { type: "button", class: "month-btn season-" + s.id, "aria-pressed": "false", "data-month": String(m.month) }, [
          el("span", { class: "month-num", text: m.month + "월" }),
          el("span", { class: "month-state", "aria-hidden": "true" }),
        ]);
        b.addEventListener("click", function () {
          pickMonth(m.month);
        });
        R.monthBtns[m.month] = b;
        row.appendChild(b);
      });
      R.monthBar.appendChild(el("div", { class: "season-group season-" + s.id }, [el("div", { class: "season-head" }, [el("span", { "aria-hidden": "true", text: s.icon + " " }), s.name]), row]));
    });
    // 방향키로 달 사이를 옮겨 다닌다(Tab으로도 된다)
    R.monthBar.addEventListener("keydown", function (e) {
      var order = MONTHS.map(function (m) {
        return R.monthBtns[m.month];
      });
      var i = order.indexOf(document.activeElement);
      if (i < 0) return;
      var j = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % order.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + order.length) % order.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = order.length - 1;
      if (j == null) return;
      e.preventDefault();
      order[j].focus();
    });
    // ①과 ②를 한 카드에 둔다(세로 화면에서도 하늘 모형·달 바·값·기록 버튼이 한 화면에 들어오게)

    // ② 값 패널(R.valuePanel = 머리말 + 값 + 범례 — "⛶ 전체 화면 보기"를 켜면 이 노드가 그대로 장면 안 막대로 옮겨 간다)
    R.valHead = el("span", { class: "value-head" });
    R.valAlt = el("dd", { class: "value-num" });
    R.valDay = el("dd", { class: "value-num" });
    R.values = el("dl", { class: "value-grid" }, [
      el("div", { class: "value-item" }, [el("dt", { text: "☀️ 태양의 남중 고도" }), R.valAlt]),
      el("div", { class: "value-item" }, [el("dt", { text: "🕒 낮의 길이" }), R.valDay]),
    ]);
    R.valueLive = el("div", { "aria-live": "polite" }, [R.values]);
    // 궤적 보기가 "계절 대표 3개"일 때만 보이는 범례(선 모양 + 이름) — 3D/2D 장면 안에는 이름표를 따로 띄우지 않는다(겹침 방지).
    // 지금 보는 달 = 계절 색 실선, 계절 대표 = 점선(fix-B1 L3). 세 대표 선은 지금 달과 겹쳐도 늘 그려져 범례와 맞는다.
    R.legendCurLine = el("span", { class: "path-legend-line is-cur", "aria-hidden": "true" });
    R.legendCurText = el("span");
    R.legendCur = el("span", { class: "path-legend-item" }, [R.legendCurLine, R.legendCurText]);
    R.pathLegend = el(
      "div",
      { class: "path-legend", hidden: true },
      [R.legendCur].concat(
        COMPARE3.map(function (c) {
          return el("span", { class: "path-legend-item" }, [el("span", { class: "path-legend-line", "aria-hidden": "true", style: "--c:" + c.color + ";--cd:" + c.dark }), c.label + " 대표"]);
        })
      )
    );
    // 번호는 기본 화면에서 ②(① 달 고르기 다음), 크게 보기에서는 값이 조건 카드보다 위(장면 안 막대·장면 바로 아래)라 👀(fix-B1 L12)
    R.valStepN = el("span", { class: "ss-step-n", text: "②" });
    R.valuePanel = el("div", { class: "value-panel" }, [el("h3", { class: "ss-step-h value-h" }, [R.valStepN, " ", R.valHead]), R.valueLive, R.pathLegend]);
    R.record = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide", text: "📝 기록하기", disabled: true });
    R.recordMsg = el("p", { class: "ss-help", "aria-live": "polite" });
    // 남중할 때 옆에서 본 모습 칸(개정 4 보충): 값 칸 맨 아래 — 크게 보기에서는 값·기록하기가 장면 안 막대로 옮겨 가 조작 칸의 달 고르기 바로 아래
    R.side = makeSideView();
    R.valueCard = el("div", { class: "value-card" }, [R.valuePanel, R.record, R.recordMsg, R.side.node]);
    var monthCard = el("div", { class: "ss-card ss-step-card obs-card" }, [
      el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: "①" }), " 관찰할 달 고르기"]),
      R.monthBar,
      R.valueCard,
    ]);

    // 진행
    R.progress = el("div", { class: "ss-progress" });
    R.panel = el("div", { class: "ss-exp-panel" }, [
      monthCard,
      el("div", { class: "ss-card ss-step-card" }, [R.progress, modelNote, el("p", { class: "ss-help safety-line", text: "⚠️ " + C.safety })]),
    ]);
    R.layout = el("div", { class: "ss-exp-layout" }, [viewCol, R.panel]);
    root.appendChild(R.layout);
  })();

  // "⛶ 전체 화면 보기"(크게 보기): 이 앱은 공통 Experiment.create()를 쓰지 않아 enlarge()로 토글·장면 안 막대를 붙인다.
  // 기록 버튼은 record로 막대 아랫줄에, 값(R.valuePanel)은 scenePanel로 막대 윗줄(좁은/낮은 화면은 장면 바로 아래 카드)에 옮겨진다.
  var enl = S.Experiment.enlarge({
    layout: R.layout,
    viewBox: R.viewBox,
    panel: R.panel,
    record: R.record,
    scenePanel: R.valuePanel,
    onChange: function (on) {
      R.valStepN.textContent = on ? "👀" : "②"; // 공통 틀의 관찰 카드와 같게(Review A2 N6)
    },
  });

  /* ── 실험 화면 상태 그리기 ── */
  var busy = false;
  var shownMonth = null; // 하늘 모형에 지금 그려져 있는 달
  var phase = "idle"; // 값 패널: idle | noon(고도만) | done
  function nextTodo(after) {
    var order = MONTHS.map(function (m) {
      return m.month;
    });
    var start = after ? order.indexOf(after) + 1 : 0;
    for (var k = 0; k < order.length; k++) {
      var m = order[(start + k) % order.length];
      if (!recOf(m)) return m;
    }
    return null;
  }
  function drawExp() {
    var n = recordedMonths().length;
    var total = MONTHS.length;
    var todo = nextTodo(selMonth);
    MONTHS.forEach(function (m) {
      var b = R.monthBtns[m.month];
      var rec = !!recOf(m.month);
      var s = seasonOf(m.month);
      b.setAttribute("aria-pressed", String(selMonth === m.month));
      b.setAttribute("aria-disabled", String(busy));
      b.classList.toggle("is-rec", rec);
      b.classList.toggle("is-next", !busy && !rec && todo === m.month && (selMonth == null || !!recOf(selMonth)));
      b.querySelector(".month-state").textContent = rec ? "✓" : "";
      b.setAttribute("aria-label", m.month + "월, " + s.name + (rec ? ", 기록함" : ", 아직 기록 안 함"));
    });
    // 진행 막대
    R.progress.textContent = "";
    var bar = el("div", { class: "ss-pbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(n), "aria-label": "기록한 달" }, [el("span")]);
    bar.firstChild.style.width = (100 * n) / total + "%";
    R.progress.appendChild(el("div", { class: "ss-prow" + (n >= total ? " is-done" : "") }, [el("span", { class: "ss-plabel", text: (n >= total ? "✅ " : "") + "기록한 달" }), bar, el("span", { class: "ss-pnum", text: n + "/" + total })]));
    R.lead.textContent =
      n >= total
        ? "12달을 모두 기록했어요! '다음 단계'로 가서 분석해 보세요."
        : "달을 누르고 값을 확인해 기록해요. (" + n + "/" + total + ")";
    // 값 패널
    var m = selMonth;
    // 범례의 "지금 보는 달" 줄(계절 색 실선) — 달을 고르기 전에는 숨김
    R.legendCur.hidden = !m;
    if (m) {
      R.legendCurLine.style.borderTopColor = seasonOf(m).color;
      R.legendCurText.textContent = m + "월(지금)";
    }
    if (!m) {
      R.valHead.textContent = "값 확인하고 기록하기 — 먼저 ①에서 달을 골라요";
      R.valAlt.textContent = "—";
      R.valDay.textContent = "—";
      R.valueCard.style.removeProperty("--season");
    } else {
      var d = BY[m];
      R.valHead.textContent = monthTitle(m);
      R.valueCard.style.setProperty("--season", seasonOf(m).color);
      var showAlt = phase === "noon" || phase === "done";
      var showDay = phase === "done";
      R.valAlt.textContent = showAlt ? f1(d.altitude) + "°" : busy ? "태양이 남중하면 나타나요…" : "—";
      R.valDay.textContent = showDay ? dayLabel(d.dayMinutes) : busy ? "해가 지면 나타나요…" : "—";
      R.valAlt.classList.toggle("is-wait", !showAlt);
      R.valDay.classList.toggle("is-wait", !showDay);
    }
    // 옆에서 본 모습 칸: 값 패널에 남중 고도가 나타날 때(남중) 그 달 모습, 그 전에는 안내만
    var sideOn = !!m && (phase === "noon" || phase === "done");
    R.side.set(sideOn ? m : null, !sideOn && !!m && busy);
    R.record.disabled = busy || !m || phase !== "done" || !seen[m];
    R.btnToggle.disabled = busy || mounting || (viewKind === "2d" && !can3D);
    R.btnPathCurrent.disabled = busy;
    R.btnPathCompare.disabled = busy;
    R.btnPathCurrent.setAttribute("aria-pressed", String(pathMode === "current"));
    R.btnPathCompare.setAttribute("aria-pressed", String(pathMode === "compare3"));
    R.pathLegend.hidden = pathMode !== "compare3";
    if (!busy && m && phase === "done") {
      if (recOf(m)) {
        var nx = nextTodo(m);
        R.recordMsg.textContent = "✓ 기록한 달이에요." + (nx ? " 다음은 " + nx + "월을 눌러 보세요." : "");
      } else R.recordMsg.textContent = "값을 확인했으면 '📝 기록하기'를 눌러요.";
    } else if (!busy) R.recordMsg.textContent = "";
  }

  /* ── 달 고르기 → 하루 길 보여 주기 ── */
  // 궤적 보기가 "계절 대표 3개"일 때만 COMPARE3(봄·가을=3월 · 여름=6월 · 겨울=12월)를 돌려준다(기록 여부와 무관).
  // 지금 보는 달이 대표 달과 같거나 거의 같아도(예: 3월·9월 — 봄·가을 선) 셋 다 그린다(fix-B1 L3): 3D는 같은 방향의 조금 바깥 구면에,
  // 2D는 지금 달의 실선 위에 점선으로 — 그래서 범례의 세 선이 늘 화면에 보인다.
  function pathList() {
    if (pathMode !== "compare3") return [];
    return COMPARE3.slice();
  }
  async function pickMonth(month) {
    if (busy) return;
    if (!view) {
      toast(mounting ? "하늘 모형을 준비하고 있어요. 잠시 뒤에 다시 눌러 주세요." : "하늘 모형을 준비하지 못했어요.");
      return;
    }
    selMonth = month;
    store.set("month", month);
    busy = true;
    phase = "idle";
    drawExp();
    var v = view;
    var ok = true;
    try {
      await S.Experiment.scrollIntoView(R.viewBox);
      if (v.whenVisible) await v.whenVisible(900);
      showFF(month);
      if (reduceMotion()) {
        v.show(month, pathList(month));
        phase = "noon";
      } else {
        await v.play(month, pathList(month), function () {
          phase = "noon";
          drawExp();
        });
      }
    } catch (e) {
      console.warn("[sci-6-2-1-3] 하늘 모형 애니메이션 오류(결과만 바로 보여 줘요)", e);
      ok = false;
    }
    if (view !== v && view) view.show(month, pathList(month)); // 도중에 화면이 바뀌었으면 새 화면에 결과만
    else if (!ok && view) view.show(month, pathList(month));
    hideFF();
    shownMonth = month;
    seen[month] = true;
    store.set("seen", seen);
    store.set("shown", month);
    phase = "done";
    busy = false;
    drawExp();
    setTimeout(function () {
      S.Experiment.scrollIntoView(R.record, { align: "nearest" }); // 기록 버튼이 화면 밖일 때만 조금 내린다
      // 크게 보기: 조작 칸 안의 '옆에서 본 모습' 칸이 가려 있으면 그 칸 안에서만 최소로 움직여 보이게(세로 화면처럼 조작 칸이 낮을 때 —
      // 달 버튼은 그대로 보인다). 기본 화면은 예전처럼 페이지를 더 움직이지 않는다(방금 누른 달 버튼이 머리말 밑으로 가려질 수 있어서)
      if (R.layout.classList.contains("is-full")) S.Experiment.scrollIntoView(R.side.node, { align: "nearest" });
    }, 60);
  }
  function showFF(month) {
    R.ff.textContent = "⏩ 빨리 감기(모형) · " + month + "월 21일 하루(낮 " + dayLabel(BY[month].dayMinutes) + ")를 약 1초로";
    R.ff.hidden = false;
  }
  function hideFF() {
    R.ff.hidden = true;
  }

  R.record.addEventListener("click", function () {
    var m = selMonth;
    if (busy || !m || phase !== "done" || !seen[m]) return;
    var d = BY[m];
    var r = records.upsert({ month: m, season: seasonOf(m).name, altitude: d.altitude, dayMinutes: d.dayMinutes, dayLabel: dayLabel(d.dayMinutes) });
    var n = recordedMonths().length;
    if (n >= MONTHS.length && !r.replaced) toast("🎉 12달을 모두 기록했어요! '다음 단계'로 가서 결과를 분석해 보세요.", 3800);
    else toast((r.replaced ? "🔁 다시 기록했어요: " : "📝 기록했어요: ") + m + "월 남중 고도 " + f1(d.altitude) + "°, 낮의 길이 " + dayLabel(d.dayMinutes));
    if (view) view.setGhosts(pathList(shownMonth));
    drawExp();
    lesson.refresh();
    // 아직 기록하지 않은 다음 달을 자동으로 골라 재생한다(학생은 기록하기만 누르면 된다)
    var nx = n < MONTHS.length ? nextTodo(m) : null;
    if (nx) {
      R.recordMsg.textContent = "▶ 다음 달(" + nx + "월)을 보여 줄게요.";
      setTimeout(function () {
        var sec = document.querySelector('section[data-stage="experiment"]');
        if (!busy && selMonth === m && sec && !sec.hidden) pickMonth(nx); // 그사이 다른 단계로 갔으면 재생하지 않는다
      }, 450);
    }
  });
  function setPathMode(mode) {
    if (busy || pathMode === mode) return;
    pathMode = mode;
    store.set("pathMode", pathMode);
    if (view) view.setGhosts(pathList(shownMonth));
    drawExp();
  }
  R.btnPathCurrent.addEventListener("click", function () {
    setPathMode("current");
  });
  R.btnPathCompare.addEventListener("click", function () {
    setPathMode("compare3");
  });
  R.btnReset.addEventListener("click", function () {
    if (view) view.resetView();
  });

  /* ───────── 3D·2D 공통: 한 달의 길(표본점) ───────── */
  function pathSamples(month, n) {
    var g = geo(month);
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var H = -g.H0 + (2 * g.H0 * i) / n;
      pts.push(sunDir(g.dec, H));
    }
    return pts;
  }

  /* ───────── 3D 하늘 모형 ─────────
   * 좌표: y 위, 북 = +z(카메라 쪽), 남 = −z, 동 = −x(남쪽을 볼 때 왼쪽), 서 = +x. 하늘 반구 반지름 RS. */
  var RS = 8;
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 2 * RS + 3, depth: 2 * RS + 5, center: [0, RS * 0.3, 0] },
      // 처음 시점(= "처음 방향으로"·두 번 탭): 교과서처럼 남쪽 하늘을 바라본 모습 — 동쪽이 왼쪽, 서쪽이 오른쪽으로 2D와 같다
      // (fix-B1 L5: 예전에는 남서쪽에서 봐서 동쪽이 오른쪽이었다). 북쪽에서 동쪽으로 조금 돌려 위에서 본다 — 정북에서 보면
      // 정남쪽 자오선에 그린 남중 고도 선·호가 옆으로 서서 보이지 않는다.
      viewDir: VIEW_DIR,
      minDistance: 7,
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var root = v.root;
      function P(d, r) {
        r = r == null ? RS : r;
        return new T.Vector3(-d.east * r, d.up * r, d.north * r);
      }
      function tube(points, radius, material, segs) {
        var curve = new T.CatmullRomCurve3(points);
        return new T.Mesh(new T.TubeGeometry(curve, segs || Math.max(8, points.length - 1), radius, 6, false), material);
      }

      // 땅(운동장)
      var groundMat = M.material(0xcfe0c3, { roughness: 0.95 });
      var ground = new T.Mesh(new T.CylinderGeometry(RS + 1.8, RS + 1.8, 0.2, 72), groundMat);
      ground.position.y = -0.1;
      root.add(ground);
      v.onThemeChange(function (dark) {
        groundMat.color.set(dark ? 0x5f6f5a : 0xcfe0c3);
      });
      // 지평선(해가 떠 있는 동안 밝게 빛난다)
      var ringMat = new T.MeshBasicMaterial({ color: 0x7d8a9c });
      var ring = new T.Mesh(new T.TorusGeometry(RS, 0.07, 8, 160), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      root.add(ring);
      // 하늘 반구(투명)
      var domeMat = new T.MeshBasicMaterial({ color: 0x9cc8f0, transparent: true, opacity: 0.08, side: T.DoubleSide, depthWrite: false });
      var dome = new T.Mesh(new T.SphereGeometry(RS, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      root.add(dome);
      // 정남쪽 자오선(남 → 머리 위). 고도 30°·60° 가로 보조선(위선)과 그 이름표는 없앴다(spec 개정 4 — 사용자: 필요 없음)
      var guideMat = new T.LineBasicMaterial({ color: 0x7f8ea3, transparent: true, opacity: 0.55 });
      var mer = [];
      for (var k = 0; k <= 30; k++) {
        var t = (k / 30) * (Math.PI / 2);
        mer.push(new T.Vector3(0, RS * Math.sin(t), -RS * Math.cos(t)));
      }
      root.add(new T.Line(new T.BufferGeometry().setFromPoints(mer), guideMat));
      // 방위
      [
        ["동", -RS - 1.0, 0],
        ["서", RS + 1.0, 0],
        ["남", 0, -RS - 1.0],
        ["북", 0, RS + 1.0],
      ].forEach(function (d) {
        // 방위 이름표는 하늘의 길(선) 위에 그린다 — 남쪽 하늘을 바라보는 처음 시점에서 여름 길(북서쪽으로 지는 부분)이 '서' 이름표
        // 앞을 지나가도 글자가 가려지지 않게(fix-B1 L5와 함께)
        var lb = M.label(d[0], { height: 1.1, bold: true, bg: "rgba(255,255,255,0.92)", depthTest: false });
        lb.renderOrder = 20;
        lb.position.set(d[1], 0.55, d[2]);
        root.add(lb);
      });
      /* ── 가운데: 태양 고도 측정기(받침판 + 막대기, 모형 — 치수는 위 DEV) ──
       * 남중할 때 교과서의 태양 고도 재는 방법을 그린다(spec 개정 4): 태양 쪽에서 오는 빛줄기가 막대기 끝을 지나 그림자 끝에 닿고,
       * 그림자 끝에서 그림자(받침판)와 그 빛줄기가 이루는 각(호) = 태양 고도. 해·그림자·빛줄기·호는 모두 같은 태양 방향으로 계산한다
       * (남중은 noonSun(month) 하나). 태양은 그대로 그 달의 길 위(반지름 RS, 길의 가장 높은 곳)에 있다. */
      var STICK_TIP = new T.Vector3(0, DEV.tipY, DEV.z);
      var boardMat = M.material(0xe8dcc0, { roughness: 0.8 });
      var board = new T.Mesh(new T.BoxGeometry(2 * DEV.halfW, DEV.top, DEV.z1 - DEV.z0), boardMat);
      board.name = "board";
      board.position.set(0, DEV.top / 2, (DEV.z0 + DEV.z1) / 2);
      var stick = new T.Mesh(new T.CylinderGeometry(DEV.r, DEV.r, DEV.stick, 16), M.material(0x8a5a2b));
      stick.name = "stick";
      stick.position.set(0, DEV.top + DEV.stick / 2, DEV.z);
      root.add(board, stick);
      v.onThemeChange(function (dark) {
        boardMat.color.set(dark ? 0xcbbf9f : 0xe8dcc0);
      });
      var devLbl = M.label("태양 고도 측정기", { height: 0.55 });
      devLbl.position.set(-DEV.halfW - 1.7, 0.45, DEV.z0 - 0.2); // 받침판 남동쪽 — 빛줄기·호와 겹치지 않는 자리
      root.add(devLbl);

      // 막대기 그림자: 태양 반대쪽(수평)으로, 받침판 위 길이 = 막대기 길이 ÷ tan(고도). 판 밖으로 나가는 부분(해 뜰 무렵·질 무렵의
      // 긴 그림자)은 땅(y ≈ 0) 위에 — 막대기 끝을 지난 빛이 땅에 닿는 곳(끝 높이 ÷ tan(고도))까지, 하늘 반구 안쪽까지만 그린다.
      var shadowMat = new T.MeshBasicMaterial({ color: 0x2b3240, transparent: true, opacity: 0.55, depthWrite: false });
      var shadowPivot = new T.Group(); // 막대기 밑동, 로컬 +z = 그림자 방향
      shadowPivot.position.set(0, 0, DEV.z);
      function shadowPart(name, y) {
        var m = new T.Mesh(new T.PlaneGeometry(2 * DEV.r, 1), shadowMat);
        m.name = name;
        m.rotation.x = -Math.PI / 2;
        m.position.y = y;
        m.renderOrder = 5;
        shadowPivot.add(m);
        return m;
      }
      var shBoard = shadowPart("shadowBoard", DEV.top + 0.008);
      var shGround = shadowPart("shadowGround", 0.012);
      shadowPivot.visible = false;
      root.add(shadowPivot);
      function spanShadow(m, from, to) {
        m.scale.y = Math.max(0.001, to - from);
        m.position.z = (from + to) / 2;
      }
      // 막대기 밑동에서 수평 방향 (ux, uz)로 받침판 가장자리까지 / 하늘 반구 안쪽 경계(원점에서 RS − 0.5)까지의 거리
      function boardExit(ux, uz) {
        var t = Infinity;
        if (ux > 1e-9) t = Math.min(t, DEV.halfW / ux);
        if (ux < -1e-9) t = Math.min(t, -DEV.halfW / ux);
        if (uz > 1e-9) t = Math.min(t, (DEV.z1 - DEV.z) / uz);
        if (uz < -1e-9) t = Math.min(t, (DEV.z0 - DEV.z) / uz);
        return t;
      }
      function domeExit(ux, uz) {
        var rl = RS - 0.5;
        var b = DEV.z * uz;
        return -b + Math.sqrt(Math.max(0, b * b - DEV.z * DEV.z + rl * rl));
      }
      // 태양 방향 d(동·위·북)를 장면 좌표의 단위 벡터로(태양 = RS × 이 벡터, placeSun과 같은 식)
      function dirOf(d) {
        return P(d, 1);
      }
      // 그림자 끝(받침판 윗면 위) = 막대기 끝 − (막대기 길이 ÷ d의 위 성분) × d — 막대기 끝을 지나는 햇빛이 판에 닿는 곳
      function shadowTip(D) {
        return STICK_TIP.clone().addScaledVector(D, -DEV.stick / D.y);
      }
      function setShadow(d) {
        if (!d || d.up <= 0.005) {
          shadowPivot.visible = false;
          return;
        }
        var hl = Math.hypot(d.east, d.north) || 1e-9;
        var ux = d.east / hl; // 그림자 방향 = 태양 반대쪽(수평): x = +east(동 = −x 이므로), z = −north
        var uz = -d.north / hl;
        var tanA = d.up / hl;
        var sb = DEV.stick / tanA; // 받침판 위 그림자 길이 = 막대기 길이 ÷ tan(고도)
        var edge = boardExit(ux, uz);
        var lim = domeExit(ux, uz);
        shadowPivot.rotation.y = Math.atan2(ux, uz);
        shadowPivot.visible = true;
        spanShadow(shBoard, 0, Math.min(sb, edge, lim));
        var sg = Math.min(DEV.tipY / tanA, lim); // 판 밖: 끝 높이 ÷ tan(고도)까지 땅 위에
        shGround.visible = sb > edge && sg > edge;
        if (shGround.visible) spanShadow(shGround, edge, sg);
      }
      // 태양(+빛무리) — 개정 4에서 원반 0.5 → 0.62, 빛무리 2.4 → 3.6(막대기 끝을 지나는 빛줄기가 빛무리 안에서 나오게)
      var SUN_R = 0.62;
      var sun = new T.Mesh(new T.SphereGeometry(SUN_R, 24, 16), new T.MeshBasicMaterial({ color: 0xffc93a }));
      sun.name = "sun";
      var gc = document.createElement("canvas");
      gc.width = gc.height = 128;
      var g2 = gc.getContext("2d");
      var grd = g2.createRadialGradient(64, 64, 8, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,220,90,0.9)");
      grd.addColorStop(1, "rgba(255,220,90,0)");
      g2.fillStyle = grd;
      g2.fillRect(0, 0, 128, 128);
      var glowTex = new T.CanvasTexture(gc);
      var glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
      glow.scale.set(3.6, 3.6, 1);
      sun.add(glow);
      sun.visible = false;
      root.add(sun);

      /* ── 남중 때의 태양 고도 그림(개정 4, 탐구 2 sci-6-2-1-2와 같은 빛줄기·호) ──
       * 막대기 끝을 지나 그림자 끝에 닿는 빛줄기 하나 + 그림자 끝의 호. 옅은 평행 빛줄기 여러 가닥은 없앴다(개정 4 보충 — 사용자:
       * "추가 태양 광선 가닥 더 있는 것들은 삭제"). 숫자 이름표는 띄우지 않는다(바뀌는 값은 값 패널에만).
       * 해가 남중 자리에 있을 때만 보인다(setNoon/hideNoon). */
      var UP = new T.Vector3(0, 1, 0);
      function rayTexture(fade) {
        // 세로 결: 아래(그림자 끝·땅 쪽) 불투명 → 위(태양 쪽) 끝 fade 비율만큼 투명해진다(빛무리 속에서 나오는 것처럼)
        var c = document.createElement("canvas");
        c.width = 4;
        c.height = 128;
        var x = c.getContext("2d");
        var gr = x.createLinearGradient(0, 0, 0, 128); // 캔버스 위 = 원기둥 위(태양 쪽)
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(fade, "rgba(255,255,255,1)");
        gr.addColorStop(1, "rgba(255,255,255,1)");
        x.fillStyle = gr;
        x.fillRect(0, 0, 4, 128);
        return new T.CanvasTexture(c);
      }
      var noonG = new T.Group();
      noonG.name = "noonPicture";
      noonG.visible = false;
      root.add(noonG);
      var keyRay = new T.Mesh(
        new T.CylinderGeometry(0.06, 0.06, 1, 10, 1, true),
        new T.MeshBasicMaterial({ color: 0xff9800, map: rayTexture(0.06), transparent: true, opacity: 0.95, depthWrite: false })
      );
      keyRay.name = "keyRay";
      keyRay.renderOrder = 41;
      noonG.add(keyRay);
      // 호: 채움(반투명) + 테두리(굵은 관 — 비스듬히 보아도 선이 보이게). 반지름은 그 달 그림자 길이의 ARC_K배(막대기에 닿지 않게),
      // 가장 크게 ARC_MAX
      var ARC_MAX = 2.2;
      var ARC_K = 0.8;
      var ARC_TUBE = 0.055;
      var arcG = new T.Group();
      arcG.name = "altArc";
      var arcFillMat = new T.MeshBasicMaterial({ color: 0xd8434f, transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false });
      var arcLineMat = new T.MeshBasicMaterial({ color: 0xd8434f, transparent: true, opacity: 0.95, depthWrite: false });
      var arcFill = new T.Mesh(new T.CircleGeometry(1, 8, 0, 0.5), arcFillMat);
      var arcLine = new T.Mesh(new T.BufferGeometry(), arcLineMat);
      arcFill.renderOrder = 42; // 빛줄기(41) 위 — 여름의 작은 호가 빛줄기에 덮이지 않게
      arcLine.renderOrder = 43;
      arcG.add(arcFill, arcLine);
      noonG.add(arcG);
      v.onThemeChange(function (dark) {
        var c = dark ? 0xff6f79 : 0xd8434f;
        arcFillMat.color.set(c);
        arcLineMat.color.set(c);
      });
      function stretch(mesh, a, b) {
        // 높이 1인 원기둥을 a → b로 늘려 놓는다(로컬 +y = b 쪽)
        var dd = b.clone().sub(a);
        var len = dd.length() || 0.001;
        mesh.position.copy(a).addScaledVector(dd, 0.5);
        mesh.quaternion.setFromUnitVectors(UP, dd.normalize());
        mesh.scale.set(1, len, 1);
      }
      var basis = new T.Matrix4();
      function setNoon(month) {
        var D = dirOf(noonSun(month)); // 그 달 남중의 태양 방향 — placeSun·setShadow·'옆에서 본 모습' 칸과 같은 값
        var sunC = D.clone().multiplyScalar(RS); // 태양 중심(placeSun과 같은 자리)
        var tip = shadowTip(D); // 그림자 끝(setShadow가 그린 그림자의 끝과 같은 점)
        // 또렷한 빛줄기: 막대기 끝을 지나는 d와 평행한 직선 위, 태양 중심에 가장 가까운 점(빛무리 안) → 그림자 끝
        var from = STICK_TIP.clone().addScaledVector(D, sunC.clone().sub(STICK_TIP).dot(D));
        stretch(keyRay, tip, from);
        // 호: 그림자 끝에서, 땅(막대기 밑동 쪽) 방향과 빛줄기(태양 쪽) 방향 사이 — 두 방향 모두 D에서 나온다(각 = asin(D.y) = 남중 고도)
        var hl = Math.hypot(D.x, D.z) || 1e-9;
        var toSun = new T.Vector3(D.x / hl, 0, D.z / hl); // 그림자 끝 → 막대기 밑동(수평)
        var a = Math.asin(clamp(D.y, -1, 1));
        var r = Math.min(ARC_MAX, ARC_K * (DEV.stick / Math.tan(a)));
        arcFill.geometry.dispose();
        arcFill.geometry = new T.CircleGeometry(r, 40, 0, a);
        var arcPts = [];
        for (var i = 0; i <= 40; i++) arcPts.push(new T.Vector3(r * Math.cos((a * i) / 40), r * Math.sin((a * i) / 40), 0));
        arcLine.geometry.dispose();
        arcLine.geometry = new T.TubeGeometry(new T.CatmullRomCurve3(arcPts), 40, ARC_TUBE, 8, false);
        basis.makeBasis(toSun, UP, toSun.clone().cross(UP));
        arcG.quaternion.setFromRotationMatrix(basis);
        arcG.position.set(tip.x, tip.y + 0.01, tip.z);
        noonG.visible = true;
      }
      function hideNoon() {
        noonG.visible = false;
      }

      var cur = null; // { group, tube, segs }
      var ghostGroup = null;
      function clearCur() {
        if (cur) v.discard(cur.group);
        cur = null;
        hideNoon();
      }
      function makeCur(month) {
        clearCur();
        var s = seasonOf(month);
        var pts = pathSamples(month, 96).map(function (d) {
          return P(d);
        });
        var segs = 96;
        var tb = tube(pts, 0.07, new T.MeshBasicMaterial({ color: new T.Color(s.color) }), segs);
        var g = new T.Group();
        g.add(tb);
        root.add(g);
        cur = { group: g, tube: tb, segs: segs };
      }
      function reveal(frac) {
        if (!cur) return;
        var k = Math.round(clamp(frac, 0, 1) * cur.segs);
        cur.tube.geometry.setDrawRange(0, k * 6 * 6);
      }
      // 궤적 보기(compare3): 대표 3개(봄·가을=3월·여름=6월·겨울=12월)를 기록 여부와 무관하게 그린다.
      // 이름표는 3D 안에 띄우지 않는다(개수가 늘면 서로 겹치던 문제, audit.md) — 색·이름은 값 패널 옆 범례(R.pathLegend)로.
      // fix-B1 L3: 굵기 0.05·불투명 0.9의 점선. 하늘 반구보다 2% 큰 구면에 그린다(보는 사람에게는 같은 방향 = 하늘의 같은 자리) —
      // 지금 보는 달의 굵은 길(반지름 RS)과 겹치는 달(3월·9월 등)에도 대표 선이 그 길 안에 묻히지 않고 보인다.
      var RG = RS * 1.02;
      var ghostDark = false;
      var ghostMats = [];
      v.onThemeChange(function (dk) {
        ghostDark = dk;
        ghostMats.forEach(function (m) {
          m.color.set(dk ? m.userData.cmp.dark : m.userData.cmp.color);
        });
      });
      function setGhosts(list) {
        if (ghostGroup) v.discard(ghostGroup);
        ghostGroup = new T.Group();
        ghostMats = [];
        list.forEach(function (c) {
          var pts = pathSamples(c.month, 96).map(function (d) {
            return P(d, RG);
          });
          var mat = new T.MeshBasicMaterial({ color: new T.Color(ghostDark ? c.dark : c.color), transparent: true, opacity: 0.9 });
          mat.userData.cmp = c;
          ghostMats.push(mat);
          // 점선: 표본 간격 4칸 그리고 2칸 비운다
          for (var i = 0; i + 1 < pts.length; i += 6) {
            var seg = pts.slice(i, Math.min(i + 5, pts.length));
            if (seg.length >= 2) ghostGroup.add(tube(seg, 0.05, mat, 4));
          }
        });
        root.add(ghostGroup);
        v.render();
      }
      function setDay(d) {
        var up = d ? d.up : -1;
        var day = up > 0 ? Math.min(1, up * 4 + 0.35) : 0;
        domeMat.opacity = 0.06 + 0.2 * day;
        ringMat.color.set(up > 0 ? 0xffc93a : 0x7d8a9c);
      }
      function placeSun(d) {
        sun.position.copy(P(d));
        sun.visible = d.up > -0.03;
        setShadow(d);
        setDay(d);
      }
      // 3D 캔버스 설명(화면 읽기 프로그램용) — 값은 값 패널에 있으므로 숫자는 넣지 않는다
      var canvasEl = v.renderer && v.renderer.domElement;
      function setAria(month) {
        if (!canvasEl) return;
        canvasEl.setAttribute(
          "aria-label",
          month
            ? "3D 하늘 모형: " +
                month +
                "월 21일 태양의 하루 길. 태양이 남중할 때 햇빛이 태양 고도 측정기의 막대기 끝을 지나 그림자 끝에 닿고, 그림자 끝에서 그림자와 빛줄기가 이루는 각을 호로 나타냈어요. 드래그하면 돌려 볼 수 있어요."
            : "3D 하늘 모형: 가운데에 태양 고도 측정기가 있어요. 달을 고르면 태양의 하루 길이 나타나요. 드래그하면 돌려 볼 수 있어요."
        );
      }
      setAria(null);

      var disposed = false;
      return {
        play: async function (month, ghosts, onNoon) {
          var g = geo(month);
          setGhosts(ghosts, month);
          makeCur(month);
          reveal(0);
          var ext = 0.14; // 해 뜨기 조금 전 · 해 진 뒤 조금 더(지평선 아래라 보이지 않는다)
          var Hs = -g.H0 - ext;
          var He = g.H0 + ext;
          var half = C.playMs / 2;
          function at(H) {
            var d = sunDir(g.dec, H);
            placeSun(d);
            reveal((H + g.H0) / (2 * g.H0));
          }
          setAria(month);
          at(Hs);
          await v.tween(half, function (e, lin) {
            at(Hs + (0 - Hs) * lin);
          });
          if (disposed) return;
          setNoon(month); // 남중: 태양 고도 그림이 나타난다
          if (onNoon) onNoon();
          await v.wait(200);
          // 오후에는 해가 남중 자리를 떠나 그림자가 돌아가므로 남중 그림(빛줄기·호)은 잠시 숨긴다(그림자 끝과 어긋나지 않게)
          hideNoon();
          await v.tween(half, function (e, lin) {
            at(He * lin);
          });
          if (disposed) return;
          // 끝: 남중 순간의 모습으로 멈춰 둔다(길 전체 + 태양 고도 그림)
          placeSun(noonSun(month));
          reveal(1);
          setNoon(month);
          v.render();
        },
        show: function (month, ghosts) {
          setGhosts(ghosts, month);
          makeCur(month);
          reveal(1);
          placeSun(noonSun(month));
          setNoon(month);
          setAria(month);
          v.render();
        },
        setGhosts: setGhosts,
        whenVisible: v.whenVisible,
        resetView: v.resetView,
        dispose: function () {
          disposed = true;
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2D 하늘 모형(남쪽 하늘을 바라본 그림: 가로 = 방위, 세로 = 고도) ───────── */
  function build2D(container) {
    container.textContent = "";
    var W = 640,
      H = 380,
      L = 56,
      Rr = 616,
      TOP = 26,
      HOR = 316;
    function X(az) {
      return L + ((az - 30) / 300) * (Rr - L);
    }
    function Y(alt) {
      return HOR - (alt / 90) * (HOR - TOP);
    }
    function azAlt(d) {
      var az = Math.atan2(d.east, d.north) / RAD;
      if (az < 0) az += 360;
      return { az: az, alt: Math.asin(clamp(d.up, -1, 1)) / RAD };
    }
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "sky2d", role: "img" });
    var sky = svg("rect", { x: 0, y: 0, width: W, height: HOR, rx: 10, fill: "#2c3a55" });
    s.appendChild(sky);
    s.appendChild(svg("rect", { x: 0, y: HOR, width: W, height: H - HOR, class: "sky2d-ground" }));
    // 고도 눈금: 가로 격자선(30°·60°)은 없앴다(spec 개정 4 — 3D의 위선 삭제와 같게). 왼쪽 눈금 숫자는 짧은 눈금과 함께 남겨 높이를 읽게 한다
    [30, 60, 90].forEach(function (a) {
      s.appendChild(svg("line", { x1: L - 3, x2: L + 9, y1: Y(a), y2: Y(a), class: "sky2d-tickmark" }));
      s.appendChild(svg("text", { x: L - 6, y: Y(a) + 5, "text-anchor": "end", class: "sky2d-tick" }, a + "°"));
    });
    s.appendChild(svg("line", { x1: X(180), x2: X(180), y1: HOR, y2: TOP, class: "sky2d-grid" }));
    s.appendChild(svg("line", { x1: 0, x2: W, y1: HOR, y2: HOR, class: "sky2d-horizon" }));
    [
      [45, "북동", false],
      [90, "동", true],
      [135, "남동", false],
      [180, "남", true],
      [225, "남서", false],
      [270, "서", true],
      [315, "북서", false],
    ].forEach(function (t) {
      s.appendChild(svg("line", { x1: X(t[0]), x2: X(t[0]), y1: HOR, y2: HOR + 8, class: "sky2d-horizon" }));
      s.appendChild(svg("text", { x: X(t[0]), y: HOR + (t[2] ? 30 : 26), "text-anchor": "middle", class: t[2] ? "sky2d-dir" : "sky2d-dir2" }, t[1]));
    });
    s.appendChild(svg("text", { x: W - 8, y: H - 8, "text-anchor": "end", class: "sky2d-cap" }, "남쪽 하늘을 바라본 모습(모형)"));
    var ghostG = svg("g", {});
    var curLine = svg("polyline", { class: "sky2d-path", fill: "none" });
    var noonG = svg("g", {});
    var sunC = svg("circle", { r: 12, class: "sky2d-sun" });
    sunC.style.display = "none";
    s.appendChild(curLine);
    s.appendChild(ghostG); // 대표 선(점선)은 지금 달의 실선 위에 — 같은 길이어도 보이게(fix-B1 L3)
    s.appendChild(noonG);
    s.appendChild(sunC);
    container.appendChild(s);

    var disposed = false;
    var raf = 0;
    var pts = [];
    function setLabel(month) {
      s.setAttribute(
        "aria-label",
        month
          ? month + "월 21일 태양의 하루 길 모형: 동쪽 지평선에서 떠서 남쪽 하늘의 가장 높은 곳(남중 고도 " + f1(BY[month].altitude) + "°)을 지나 서쪽으로 져요."
          : "남쪽 하늘을 바라본 하늘 모형이에요. 달을 고르면 태양의 하루 길이 나타나요."
      );
    }
    setLabel(null);
    // 궤적 보기(compare3): 대표 3개를 기록 여부와 무관하게 그린다. 이름표는 화면 안에 두지 않고(겹침 방지) 값 패널 옆 범례로.
    function setGhosts(list) {
      ghostG.textContent = "";
      list.forEach(function (c) {
        var p = pathSamples(c.month, 64)
          .map(function (d) {
            var q = azAlt(d);
            return X(q.az).toFixed(1) + "," + Y(Math.max(0, q.alt)).toFixed(1);
          })
          .join(" ");
        var pl = svg("polyline", { points: p, fill: "none", stroke: c.color, "stroke-width": 4.5, "stroke-opacity": 0.95, "stroke-dasharray": "13 8", "stroke-linecap": "round" });
        pl.appendChild(svg("title", {}, c.label + " 대표(" + c.month + "월 21일, 모형)"));
        ghostG.appendChild(pl);
      });
    }
    function drawNoon(month) {
      noonG.textContent = "";
      var a = BY[month].altitude;
      // 남중할 때 태양 높이(정남쪽 점선)만 그린다 — 숫자 이름표는 없앴다(fix-B1 L4, 값은 값 패널에만)
      noonG.appendChild(svg("line", { x1: X(180), x2: X(180), y1: HOR, y2: Y(a), class: "sky2d-noon" }));
    }
    function setDay(d) {
      var up = d ? d.up : -1;
      var day = up > 0 ? Math.min(1, up * 4 + 0.35) : 0;
      // 밤 #2c3a55 → 낮 #bfe0fb
      var c0 = [44, 58, 85],
        c1 = [191, 224, 251];
      sky.setAttribute(
        "fill",
        "rgb(" +
          c0
            .map(function (v, i) {
              return Math.round(v + (c1[i] - v) * day);
            })
            .join(",") +
          ")"
      );
    }
    function placeSun(d) {
      var q = azAlt(d);
      sunC.style.display = q.alt > -1 ? "" : "none";
      sunC.setAttribute("cx", X(q.az).toFixed(1));
      sunC.setAttribute("cy", Y(Math.max(q.alt, -2)).toFixed(1));
      setDay(d);
    }
    function prep(month, ghosts) {
      setGhosts(ghosts, month);
      noonG.textContent = "";
      curLine.setAttribute("stroke", seasonOf(month).color);
      pts = pathSamples(month, 96).map(function (d) {
        var q = azAlt(d);
        return X(q.az).toFixed(1) + "," + Y(Math.max(0, q.alt)).toFixed(1);
      });
      setLabel(month);
    }
    function reveal(frac) {
      var k = Math.round(clamp(frac, 0, 1) * (pts.length - 1));
      curLine.setAttribute("points", pts.slice(0, k + 1).join(" "));
    }
    function animate(ms, fn) {
      return new Promise(function (resolve) {
        var start = null;
        function frame(now) {
          if (disposed) return resolve();
          if (start == null) start = now;
          var t = document.hidden ? 1 : Math.min(1, (now - start) / ms);
          fn(t);
          if (t >= 1) resolve();
          else raf = requestAnimationFrame(frame);
        }
        if (document.hidden) {
          fn(1);
          resolve();
        } else raf = requestAnimationFrame(frame);
      });
    }
    function wait(ms) {
      return new Promise(function (r) {
        setTimeout(r, document.hidden ? 0 : ms);
      });
    }
    return {
      play: async function (month, ghosts, onNoon) {
        var g = geo(month);
        prep(month, ghosts);
        var ext = 0.14;
        var Hs = -g.H0 - ext,
          He = g.H0 + ext;
        function at(Hh) {
          placeSun(sunDir(g.dec, Hh));
          reveal((Hh + g.H0) / (2 * g.H0));
        }
        await animate(C.playMs / 2, function (t) {
          at(Hs * (1 - t));
        });
        if (disposed) return;
        drawNoon(month);
        if (onNoon) onNoon();
        await wait(200);
        await animate(C.playMs / 2, function (t) {
          at(He * t);
        });
        if (disposed) return;
        placeSun(noonSun(month));
        reveal(1);
      },
      show: function (month, ghosts) {
        prep(month, ghosts);
        reveal(1);
        drawNoon(month);
        placeSun(noonSun(month));
      },
      setGhosts: setGhosts,
      resetView: function () {},
      dispose: function () {
        disposed = true;
        cancelAnimationFrame(raf);
      },
    };
  }

  /* ── 3D ↔ 2D 전환 ── */
  var view = null;
  var viewKind = null;
  var mounting = false;
  var mountToken = 0;
  var can3D = S.Sim3D && S.Sim3D.isWebGLAvailable() && !/[?&]no3d=1/.test(location.search);
  function mount(kind, notice) {
    var my = ++mountToken;
    if (view && view.dispose) view.dispose();
    view = null;
    viewKind = null;
    R.view3d.textContent = "";
    R.view2d.textContent = "";
    if (kind === "3d") {
      mounting = true;
      R.loading.hidden = false;
      R.view2d.hidden = true;
      R.view3d.hidden = false;
      R.viewBox.classList.remove("is-2d");
      drawExp();
      Promise.resolve()
        .then(function () {
          return build3D(R.view3d, {
            onLost: function () {
              if (my !== mountToken) return;
              can3D = false;
              mount("2d", "3D 화면에 문제가 생겨 2D 화면으로 바꿨어요. 기록은 그대로예요.");
            },
          });
        })
        .catch(function (e) {
          console.warn("[sci-6-2-1-3] 3D 화면을 만들지 못했어요.", e);
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
            mount("2d", "이 기기에서는 3D 화면을 쓸 수 없어서 2D 화면으로 관찰해요.");
            return;
          }
          finishMount(v, "3d");
        });
    } else {
      mounting = false;
      R.loading.hidden = true;
      R.view3d.hidden = true;
      R.view2d.hidden = false;
      finishMount(build2D(R.view2d), "2d");
      if (notice) toast(notice, 3600);
    }
  }
  function finishMount(v, kind) {
    view = v;
    viewKind = kind;
    R.loading.hidden = true;
    R.viewBox.classList.toggle("is-2d", kind === "2d");
    if (enl) enl.fit(); // 3D↔2D 전환 뒤 크게 보기 장면 높이를 다시 잰다(science-sim/README "enlarge()" 안내)
    var narrow = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    R.tip.textContent =
      kind === "3d" ? "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향" : "2D 화면(남쪽 하늘을 바라본 모형)이에요. 가로는 방위, 세로는 태양 고도예요.";
    // 좁은 화면 기본 화면용 덧붙임 — 크게 보기(한 화면 실험실)는 페이지가 움직이지 않으므로 공통 CSS(.ss-tip-page)가 숨긴다
    if (kind === "3d" && narrow) R.tip.appendChild(el("span", { class: "ss-tip-page", text: " · 페이지를 움직일 때는 3D 화면 바깥을 밀어요" }));
    R.btnReset.hidden = kind !== "3d";
    R.btnToggle.textContent = kind === "3d" ? "2D로 보기" : can3D ? "3D로 보기" : /[?&]no3d=1/.test(location.search) ? "2D 화면으로 고정됨" : "3D를 쓸 수 없는 기기예요";
    var shown = Number(store.get("shown", 0)) || null;
    if (shown && BY[shown] && seen[shown]) {
      v.show(shown, pathList(shown));
      shownMonth = shown;
    } else v.setGhosts(pathList(null));
    drawExp();
  }
  R.btnToggle.addEventListener("click", function () {
    if (busy || mounting) return;
    var to2d = viewKind === "3d";
    if (!to2d && !can3D) return;
    store.set("view2d", to2d);
    mount(to2d ? "2d" : "3d");
  });

  // 새로고침 뒤: 마지막으로 본 달의 값을 다시 보여 준다
  if (selMonth && seen[selMonth]) phase = "done";
  var activated = false;
  function activateExp() {
    if (!activated) {
      activated = true;
      mount(can3D && !store.get("view2d", false) ? "3d" : "2d");
    }
    drawExp();
    // 실험하기에 들어올 때는 스크롤하지 않는다(fix-B1 M3 — 공통 틀과 같게: 펼쳐진 '🔎 실험 방법 알아 두기'를 먼저 읽게).
    // 달을 고르면(pickMonth) 그때 장면이 보이게 맞춘다.
  }
  drawExp();

  /* ═════════ 3. 기록·분석하기 ═════════ */
  // 꺾은선그래프(가로축: 3월 → 2월, 계절 띠 + 이름). 색만으로 구분하지 않도록 계절 띠에 이름을 쓴다.
  function lineChart(root, o) {
    var W = 600,
      H = 330,
      L = 70,
      Rm = 14,
      T = 30,
      B = 58;
    var iw = W - L - Rm,
      ih = H - T - B;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "ss-chart", role: "img", "aria-label": o.aria });
    function Y(v) {
      return T + ih - ((v - o.yMin) / (o.yMax - o.yMin)) * ih;
    }
    var step = iw / MONTHS.length;
    function X(i) {
      return L + step * i + step / 2;
    }
    // 계절 띠
    C.seasons.forEach(function (se, si) {
      var x0 = L + step * 3 * si;
      var band = svg("rect", { x: x0, y: T, width: step * 3, height: ih, fill: se.color, "fill-opacity": si % 2 ? 0.1 : 0.16 });
      s.appendChild(band);
      s.appendChild(svg("text", { x: x0 + step * 1.5, y: T - 9, "text-anchor": "middle", class: "ss-tick season-lbl" }, se.name));
    });
    for (var v = o.yMin; v <= o.yMax + 1e-9; v += o.yStep) {
      s.appendChild(svg("line", { x1: L, x2: W - Rm, y1: Y(v), y2: Y(v), class: "ss-grid" }));
      s.appendChild(svg("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "ss-tick" }, o.tick(v)));
    }
    s.appendChild(svg("text", { x: 16, y: T + ih / 2, "text-anchor": "middle", transform: "rotate(-90 16 " + (T + ih / 2) + ")", class: "ss-axis-label" }, o.yTitle));
    s.appendChild(svg("text", { x: L + iw / 2, y: H - 10, "text-anchor": "middle", class: "ss-axis-label" }, "월(매월 21일)"));
    MONTHS.forEach(function (m, i) {
      s.appendChild(svg("text", { x: X(i), y: T + ih + 20, "text-anchor": "middle", class: "ss-tick" }, m.month + "월"));
    });
    var pts = [];
    MONTHS.forEach(function (m, i) {
      var r = recOf(m.month);
      if (!r) return;
      pts.push({ i: i, v: o.value(r), r: r, m: m.month });
    });
    if (pts.length > 1)
      s.appendChild(
        svg("polyline", {
          points: pts
            .map(function (p) {
              return X(p.i) + "," + Y(p.v);
            })
            .join(" "),
          class: "ss-line ss-s1",
        })
      );
    pts.forEach(function (p) {
      var c = svg("circle", { cx: X(p.i), cy: Y(p.v), r: 5.5, class: "ss-dot ss-s1" });
      c.appendChild(svg("title", {}, p.m + "월: " + o.text(p.r)));
      s.appendChild(c);
      if (o.showValues) s.appendChild(svg("text", { x: X(p.i), y: Y(p.v) - 10, "text-anchor": "middle", class: "ss-val" }, o.short(p.r)));
    });
    s.appendChild(svg("line", { x1: L, x2: W - Rm, y1: T + ih, y2: T + ih, class: "ss-axis" }));
    s.appendChild(svg("line", { x1: L, x2: L, y1: T, y2: T + ih, class: "ss-axis" }));
    var fig = el("figure", { class: "ss-figure" }, [el("figcaption", { text: "📈 " + o.caption }), s]);
    root.appendChild(fig);
  }

  function drawResults() {
    S.TableChart.renderTable($("result-table"), {
      caption: "내 기록 표 (" + C.source.area + ", 매월 21일)",
      columns: [
        { id: "season", label: "계절" },
        { id: "month", label: "월" },
        { id: "alt", label: "태양의 남중 고도", unit: "°", digits: 1 },
        { id: "day", label: "낮의 길이" },
      ],
      rows: MONTHS.map(function (m) {
        var r = recOf(m.month);
        return { season: seasonOf(m.month).name, month: m.month + "월", alt: r ? r.altitude : null, day: r ? r.dayLabel : null };
      }),
    });
    var card = $("chart-card");
    card.textContent = "";
    card.appendChild(el("h3", { class: "sub-h first", text: "📈 꺾은선그래프로 나타내기" }));
    var grid = el("div", { class: "chart-grid" });
    var c1 = el("div");
    var c2 = el("div");
    grid.appendChild(c1);
    grid.appendChild(c2);
    card.appendChild(grid);
    lineChart(c1, {
      caption: "월별 태양의 남중 고도",
      aria: "월별 태양의 남중 고도 꺾은선그래프. 가로축은 3월부터 다음 해 2월까지의 달, 세로축은 태양의 남중 고도(0~90°)이고, 내가 기록한 값을 점과 선으로 나타냈어요. 정확한 값은 위 기록 표에 있어요.",
      yTitle: "태양의 남중 고도(°)",
      yMin: 0,
      yMax: 90,
      yStep: 15,
      tick: function (v) {
        return String(v);
      },
      value: function (r) {
        return r.altitude;
      },
      text: function (r) {
        return f1(r.altitude) + "°";
      },
      short: function (r) {
        return f1(r.altitude);
      },
      showValues: true,
    });
    lineChart(c2, {
      caption: "월별 낮의 길이",
      aria: "월별 낮의 길이 꺾은선그래프. 가로축은 3월부터 다음 해 2월까지의 달, 세로축은 낮의 길이(8~16시간)이고, 내가 기록한 값을 점과 선으로 나타냈어요. 정확한 값은 위 기록 표에 있어요.",
      yTitle: "낮의 길이(시간)",
      yMin: 8,
      yMax: 16,
      yStep: 1,
      tick: function (v) {
        return String(v);
      },
      value: function (r) {
        return r.dayMinutes / 60;
      },
      text: function (r) {
        return r.dayLabel;
      },
      showValues: false,
    });
    card.appendChild(
      el("p", {
        class: "ss-help chart-note",
        text: "점은 매월 21일의 값이에요. 남중 고도와 낮의 길이는 달이 바뀔 때 갑자기 바뀌지 않고 날마다 조금씩 계속 달라져요. (서울특별시 자료 — 지역마다 값이 조금씩 달라요)",
      })
    );
    card.appendChild(el("p", { class: "ss-help", text: "낮의 길이 그래프의 세로축은 8시간부터 그렸어요." }));
  }

  /* ═════════ 4. 마치기(결과 저장) ═════════ */
  function recordRows() {
    return MONTHS.filter(function (m) {
      return !!recOf(m.month);
    }).map(function (m) {
      var r = recOf(m.month);
      return { month: r.month, season: r.season, altitude: r.altitude, dayMinutes: r.dayMinutes, dayLabel: r.dayLabel };
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
    var rows = recordRows();
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened(),
      source: { area: C.source.area, day: 21 },
      records: rows,
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosityText.trim(),
      // 질문-답 표준 목록(관리자 "학생 응답" 화면용, docs/admin/responses-spec.md §3.3)
      qa: [].concat(
        predict.qa("predict"),
        [
          {
            stage: "experiment",
            id: "records",
            label: "내 기록",
            question: "계절별(매월 21일) 태양의 남중 고도와 낮의 길이",
            kind: "table",
            answer: {
              columns: [
                { key: "season", label: "계절" },
                { key: "month", label: "월" },
                { key: "altitude", label: "태양의 남중 고도(°)" },
                { key: "day", label: "낮의 길이" },
              ],
              rows: rows.map(function (r) {
                return { season: r.season, month: r.month + "월", altitude: f1(r.altitude), day: r.dayLabel };
              }),
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        [{ stage: "conclude", id: "curiosity", label: "궁금한 점(선택)", question: C.curiosity.prompt, kind: "text", answer: curiosityText.trim() }]
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
      return conclude.isDone() || "결론을 먼저 적고 '제출하고 모범 답안 보기'를 눌러 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var n = Object.keys(q).filter(function (k) {
        return q[k].correct;
      }).length;
      return ["기록한 달: " + recordedMonths().length + "/12", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
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
        return predict.isDone() || "예상하기 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        if (busy) return "태양의 길을 다 본 뒤에 넘어가요.";
        return allRecorded() || "12달을 모두 관찰하고 기록해야 넘어갈 수 있어요. (지금 " + recordedMonths().length + "/12)";
      },
      conclude: function () {
        if (!allRecorded()) return "먼저 실험하기에서 12달을 모두 기록해 주세요.";
        return quiz.isDone() || "분석 질문 2개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: allRecorded,
      analyze: function () {
        return quiz.isDone();
      },
      conclude: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: activateExp,
      analyze: drawResults,
    },
  });
})();
