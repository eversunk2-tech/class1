/*
 * app.js — sci-6-2-1-2 "하루 동안 태양 고도, 그림자 길이, 기온의 관계는?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 화면 틀(3D/2D 전환·전체 화면 보기)·기록 저장·진행 상황 DB 저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(모형): 운동장의 나무(높이 10 cm — 그림자를 재는 물체), 작은 사람(크기 비교용 장식), 백엽상 속 온도계,
 *      하늘의 태양과 하루 경로, 평행한 옅은 빛줄기 + 나무 꼭대기를 지나 그림자 끝에 닿는 빛줄기, 그림자 끝의 작은 호(태양 고도)
 *   ② 시간 바(앱 전용 UI): 9:30~15:30, 1분 단위 슬라이더 + 매시 30분 눈금 버튼 7개. 하늘의 태양을 끌어도 시각이 바뀐다(양방향).
 *   ③ 측정값 패널(시각·태양 고도·그림자 길이·기온 + 📝 기록하기) — 공통 틀의 scenePanel(크게 보기의 장면 안 막대)
 *   ④ 분석 표·꺾은선그래프 3개, 내 기록으로 답하는 보기 고르기 2개, 결론 1개, 궁금한 점 한 줄   만 만든다.
 *
 * spec.md "개정 1"(그대로):
 *  - 기록은 매시 30분 눈금 7곳에서만(필수 7칸, fix-1-report.md 개정 2: 8:30 삭제). 값은 data/lesson-config.js의 results(교과서·실험관찰 예시 값)만 기록한다.
 *  - 눈금 사이는 살펴보기 전용 모형 값: 태양 고도(data/sun-table.js), 그림자 길이 = 10 ÷ tan(태양 고도) + 보정(눈금에서 표와 같게),
 *    기온 = 단조 3차 보간(PCHIP, 14:30 최고값 27.0 °C를 넘지 않음).
 *  - 눈금 버튼 → 약 1초 빨리 감기(모형). 학생은 값을 타이핑하지 않는다. 모든 수치는 소수 첫째 자리.
 * spec.md 끝 "개정 2(2026-09-25, 개편 단계 B)": 장면을 나무 + 작은 사람으로, 태양 끌기(시간 바와 양방향), 해·빛줄기·그림자·호를
 *  태양 방향 벡터 하나에서 계산, 바뀌는 값은 3D 이름표 없이 측정값 패널에만.
 * spec.md 끝 "개정 3(2026-09-25, fix-B1)": 3D 오른쪽 위 "옆에서 본 모습" 칸(같은 태양 방향 벡터로 그림 — 칸 속 각 = 태양 고도),
 *  2D 옆모습도 해가 서쪽이면 오른쪽에서 빛, '북' 이름표를 조금 높여 아래 안내 글에 가리지 않게.
 *
 * 공통 틀과의 연결: Experiment.create에 조건(factors) 없이 단계 1개(7칸)를 넘기고, 공통 틀의 실행·관찰 카드는 쓰지 않는다
 * (style.css에서 실행 카드를 숨김). 기록은 이 파일의 📝 기록하기가 records.upsert로 직접 하고 exp.refresh()로 진행률을 갱신한다.
 * 측정값 패널은 scenePanel로 넘긴다 — 크게 보기에서는 공통 틀이 장면 안 막대(좁은 화면은 장면 바로 아래 카드)로 옮기고,
 * 기본 화면에서는 원래 자리(측정값 카드 안)로 되돌린다. 앱은 측정값 카드만 옮기고 scenePanel 노드는 건드리지 않는다.
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var SUN = window.SunTable;
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
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function f1(v) {
    return Number(v).toFixed(1);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;

  /* ───────── 측정 시각·모형 ───────── */
  var TIMES = C.times;
  var MIN0 = SUN.startMin; // 570 = 9:30
  var MIN1 = SUN.endMin; // 930 = 15:30
  var TIME_BY_ID = {};
  TIMES.forEach(function (t) {
    TIME_BY_ID[t.id] = t;
  });
  function tickAt(min) {
    for (var i = 0; i < TIMES.length; i++) if (Math.abs(TIMES[i].min - min) < 1e-6) return TIMES[i];
    return null;
  }
  function clockText(min) {
    var m = Math.round(min);
    return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  }
  function clockSpeech(min) {
    var m = Math.round(min);
    return Math.floor(m / 60) + "시 " + (m % 60) + "분";
  }
  // 표 값(분 단위 배열)을 소수 분에서 선형 보간
  function tableAt(arr, min) {
    var x = clamp(min, MIN0, MIN1) - MIN0;
    var i = Math.floor(x);
    if (i >= arr.length - 1) return arr[arr.length - 1];
    var f = x - i;
    return arr[i] * (1 - f) + arr[i + 1] * f;
  }
  function azAt(min) {
    return tableAt(SUN.az, min);
  }
  var RAD = Math.PI / 180;
  // 그림자 보정: 눈금에서 (표의 그림자 길이 − 10 ÷ tan(표의 태양 고도)) → 눈금 사이 선형 보간(예: 9:30 14.55 → 14.5)
  var SHADOW_CORR = TIMES.map(function (t) {
    var r = C.results[t.id];
    return r.shadow - C.stickCm / Math.tan(r.solar * RAD);
  });
  // 기온: 단조 3차 보간(Fritsch–Carlson PCHIP)
  var TX = TIMES.map(function (t) {
    return t.min;
  });
  var TY = TIMES.map(function (t) {
    return C.results[t.id].temp;
  });
  var TD = (function () {
    var n = TX.length;
    var h = [];
    var d = [];
    var i;
    for (i = 0; i < n - 1; i++) {
      h.push(TX[i + 1] - TX[i]);
      d.push((TY[i + 1] - TY[i]) / h[i]);
    }
    var m = new Array(n);
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        var w1 = 2 * h[i] + h[i - 1];
        var w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    function end(h0, h1, d0, d1) {
      var v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (Math.sign(v) !== Math.sign(d0)) return 0;
      if (Math.sign(d0) !== Math.sign(d1) && Math.abs(v) > Math.abs(3 * d0)) return 3 * d0;
      return v;
    }
    m[0] = end(h[0], h[1], d[0], d[1]);
    m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
    return m;
  })();
  function tempAt(min) {
    var x = clamp(min, MIN0, MIN1);
    var i = Math.min(TX.length - 2, Math.max(0, Math.floor((x - TX[0]) / 60)));
    var h = TX[i + 1] - TX[i];
    var t = (x - TX[i]) / h;
    var t2 = t * t;
    var t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * TY[i] + (t3 - 2 * t2 + t) * h * TD[i] + (-2 * t3 + 3 * t2) * TY[i + 1] + (t3 - t2) * h * TD[i + 1];
  }
  // 그 시각의 값(눈금이면 표 값 그대로). solar·shadow·temp는 화면 값(소수 첫째 자리),
  // alt·az는 장면을 그리는 태양 위치(모형 표 그대로 — 눈금에서는 alt = 표의 태양 고도와 같다).
  function valuesAt(min) {
    var tk = tickAt(min);
    if (tk) {
      var r = C.results[tk.id];
      return { min: tk.min, tick: tk, solar: r.solar, shadow: r.shadow, temp: r.temp, alt: r.solar, az: azAt(tk.min) };
    }
    var alt = tableAt(SUN.alt, min);
    var x = clamp(min, MIN0, MIN1) - MIN0;
    var i = Math.min(TIMES.length - 2, Math.floor(x / 60));
    var f = (x - 60 * i) / 60;
    var corr = SHADOW_CORR[i] * (1 - f) + SHADOW_CORR[i + 1] * f;
    return {
      min: min,
      tick: null,
      solar: Math.round(alt * 10) / 10,
      shadow: Math.round((C.stickCm / Math.tan(alt * RAD) + corr) * 10) / 10,
      temp: Math.round(tempAt(min) * 10) / 10,
      alt: alt,
      az: azAt(min),
    };
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.time;
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  function recOf(id) {
    return records.list().filter(function (r) {
      return r.time === id;
    })[0] || null;
  }

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);

  /* 궁금한 점: 입력 한 줄(공통 틀 lesson.js가 '더 탐구하고 싶은 점' 필수로 다룬다). 저장 키 "curiosity" */
  var curiosityText = store.get("curiosity", "") || "";
  (function () {
    var saveCur = S.debounce(function () {
      store.set("curiosity", curiosityText);
    }, 250);
    var inp = el("input", { id: "ss-curiosity", type: "text", class: "ss-num-input ss-text-input", maxlength: "200", autocomplete: "off", placeholder: C.curiosity.placeholder });
    inp.value = curiosityText;
    inp.addEventListener("input", function () {
      curiosityText = inp.value;
      saveCur();
    });
    $("curiosity-root").appendChild(el("div", { class: "ss-card" }, [el("label", { for: "ss-curiosity", class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "선택" }), C.curiosity.prompt]), inp]));
  })();

  /* ───────── 지금 시각 · 화면 갱신(requestAnimationFrame으로 묶기) ─────────
   * 지금 시각(cur, 분) 하나가 모든 것의 출발점이다: 시간 바·눈금 버튼·태양 끌기가 cur를 바꾸고,
   * drawNow()가 그 시각의 값으로 장면(setTime)과 시간 바·측정값 패널(bar.draw)을 함께 다시 그린다. */
  var cur = Number(store.get("minute", MIN0));
  if (!isFinite(cur)) cur = MIN0;
  cur = clamp(Math.round(cur), MIN0, MIN1);
  var saveMinute = S.debounce(function () {
    store.set("minute", Math.round(cur));
  }, 400);
  var curView = null; // 지금 붙어 있는 3D/2D 장면(setTime을 가진 것)
  var tweening = false;
  var rafPending = 0;
  function requestDraw() {
    if (rafPending) return;
    if (document.hidden) {
      drawNow();
      return;
    }
    rafPending = requestAnimationFrame(function () {
      rafPending = 0;
      drawNow();
    });
  }
  function drawNow() {
    var st = valuesAt(cur);
    if (curView) curView.setTime(st);
    if (bar) bar.draw(st);
  }

  // 빨리 감기(모형): 지금 시각에서 목표 시각까지 약 1초
  var tw = null;
  function cancelTween() {
    if (!tw) return;
    cancelAnimationFrame(tw.raf);
    tw = null;
    tweening = false;
    if (bar) bar.setFast(false);
  }
  function goTo(target, ms) {
    cancelTween();
    target = clamp(Math.round(target), MIN0, MIN1);
    var from = cur;
    if (ms == null) ms = 1000;
    if (reduceMotion()) ms = Math.min(ms, 250);
    if (Math.abs(target - from) < 1e-6 || ms <= 0 || document.hidden) {
      cur = target;
      saveMinute();
      requestDraw();
      return;
    }
    tweening = true;
    if (bar) bar.setFast(ms >= 400);
    var start = null;
    var my = { raf: 0 };
    tw = my;
    function step(now) {
      if (tw !== my) return;
      if (start == null) start = now;
      var t = Math.min(1, (now - start) / ms);
      if (document.hidden) t = 1;
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      cur = t >= 1 ? target : from + (target - from) * e;
      drawNow();
      if (t >= 1) {
        tw = null;
        tweening = false;
        if (bar) bar.setFast(false);
        saveMinute();
        drawNow();
      } else my.raf = requestAnimationFrame(step);
    }
    my.raf = requestAnimationFrame(step);
  }
  function setMinute(min) {
    cancelTween();
    cur = clamp(Math.round(min), MIN0, MIN1);
    saveMinute();
    requestDraw();
  }
  // 끌기(시간 바·하늘의 태양)를 놓았을 때: 매시 30분 눈금 가까이(±3분)면 그 눈금에 맞춘다
  function snapToTick() {
    for (var i = 0; i < TIMES.length; i++) {
      var d = Math.abs(TIMES[i].min - cur);
      if (d > 0 && d <= 3) {
        goTo(TIMES[i].min, 150);
        return;
      }
    }
  }

  /* ───────── 장면(모형) 공통 치수 ─────────
   * 1 단위 = 1 cm(모형). 땅 y = 0. 북 = +z, 남 = −z, 동 = −x, 서 = +x
   * (처음 시점은 북쪽 위에서 남쪽 하늘을 바라본다 → 화면 왼쪽이 동쪽, 오른쪽이 서쪽).
   * 나무 높이 TREE_H = 10(cm) — 태양 고도 측정기의 막대기(10 cm)와 같게 둬서 그림자 길이 = 10 ÷ tan(태양 고도)가 표 값과 맞는다.
   * 하늘(모형)은 나무 꼭대기 TOP을 중심으로 한 반지름 SKY_R의 반구다. 그래서 태양 = TOP + SKY_R·d이고,
   * 태양 중심 → 나무 꼭대기 → 그림자 끝 P = TOP − (TREE_H ÷ d.y)·d 가 한 직선 위에 있다(d = 태양 방향 단위 벡터).
   * 실제 태양은 아주 멀리 있어 햇빛이 평행하다 — 옅은 빛줄기들도 모두 d와 평행하게 그린다. */
  var SKY_R = 16;
  var TREE_H = C.stickCm;
  var TRUNK = { r0: 0.55, r1: 0.42, h: 3.2 };
  // 원뿔 3단(저폴리곤 소나무). 원뿔마다 (높이 ÷ 밑 반지름) > tan(최고 고도 51.7°)라 그림자의 가장 먼 끝은 늘 나무 꼭대기의 그림자다.
  var CONES = [
    { y0: 2.4, y1: 6.6, r: 3.0, color: 0x3f8f4e },
    { y0: 4.3, y1: 8.1, r: 2.4, color: 0x4b9f5b },
    { y0: 6.2, y1: TREE_H, r: 1.7, color: 0x5aae68 },
  ];
  // 사람·백엽상 자리: 9:30~15:30 내내(1분 간격 계산) 나무 그림자·옅은 빛줄기와 겹치지 않는 곳(서로 1.8 이상 떨어짐)
  var PERSON_AT = { x: -7.5, z: -4 };
  var SCREEN_AT = { x: 13.5, z: -6.5 };
  // 옅은 빛줄기가 땅에 닿는 곳(그림자 끝 P 기준): at = P의 몇 배 거리, side = 옆으로(그림자와 수직), beyond = 그림자 끝 너머
  var FAINT_RAYS = [
    { at: 1, side: -9 },
    { at: 1, side: -4.5 },
    { at: 1, side: 4.5 },
    { at: 1, side: 9 },
    { at: 1, beyond: 4 },
    { at: 1.3, side: -6 },
    { at: 1.3, side: 6 },
  ];
  var sunDragging = false;

  // 태양 방향 단위 벡터 d(동 = −x, 위 = +y, 북 = +z). 3D(sunDir)와 2D가 같은 식을 쓴다.
  function sunVec(azDeg, altDeg) {
    var a = azDeg * RAD;
    var h = altDeg * RAD;
    return { x: -Math.sin(a) * Math.cos(h), y: Math.sin(h), z: Math.cos(a) * Math.cos(h) };
  }
  function sunDir(T, azDeg, altDeg) {
    var s = sunVec(azDeg, altDeg);
    return new T.Vector3(s.x, s.y, s.z);
  }

  /* ───────── 옆에서 본 모습 칸(모형) — 3D 장면 오른쪽 위(2026-09-25 fix-B1: review-B M2, 사용자 결정) ─────────
   * 처음 시점(북쪽에서 남쪽을 봄)은 호가 담긴 수직면(해·나무 꼭대기·그림자 끝을 지나는 면)을 비스듬히 본다. 한낮에는 그 면이 거의
   * 카메라 쪽을 향해서 화면 속 호가 옆으로 서고 실제 태양 고도보다 훨씬 작게 보인다(12:30이 가장 작아 보이는 거꾸로 된 모습 — 오개념 위험).
   * 이 칸은 그 수직면을 늘 옆에서(정면으로) 본 그림이라 칸 속 빛줄기와 땅이 이루는 각 = 태양 고도다.
   *  - 3D의 해·빛줄기·그림자·호와 같은 태양 방향 벡터 d 하나로 그린다(applySun(d)에서 set(d) — 따로 계산하지 않는다):
   *    각의 cos·sin = d의 수평 길이·d.y, 그림자 길이 = 나무 높이 × (d의 수평 길이 ÷ d.y)(3D 그림자 끝과 같은 식).
   *  - 빛이 오는 쪽: 해가 남중 전(동쪽, d.x < 0)이면 왼쪽, 남중 뒤(서쪽, d.x > 0)면 오른쪽 — 북쪽에서 남쪽을 보는 처음 시점의 좌우와 같다.
   *  - 숫자는 쓰지 않는다(값은 측정값 패널에만). 칸의 글자는 안 바뀌는 이름("옆에서 본 모습(모형)", "태양 고도")뿐이다.
   *  - 누르기는 칸을 지나 장면으로 간다(pointer-events: none). 3D 칸이 좁거나 낮으면(휴대폰) 숨긴다 — 2D 화면 아래쪽이 같은 옆모습이다. */
  var SV = { W: 200, H: 118, CX: 100, GY: 90, K: 5.3, SUN_S: 5.2, ARC: 19 };
  // 처음 시점(3D viewDir [-0.217, 0.438, 0.872], 중심→카메라) 카메라의 화면 오른쪽 방향(월드 x·z). 앞(카메라→중심)의 수평 성분 f에 대해
  // 오른쪽 = f × 위 = (−f.z, 0, f.x). 옆모습 칸의 좌우를 이 방향으로 정해야 3D 처음 시점과 늘 같다(정남 기준으로 뒤집으면
  // 처음 시점이 동쪽으로 14° 돌아가 있어 12:25~12:59에 좌우가 반대였다 — review-B2 N1).
  var VIEW_RIGHT = (function () {
    var fx = 0.217, fz = -0.872, n = Math.hypot(fx, fz);
    return { x: -fz / n, z: fx / n };
  })();
  function makeSideView() {
    var top = SV.GY - TREE_H * SV.K; // 나무 꼭대기(칸 좌표)
    var g = svg("svg", { viewBox: "0 0 " + SV.W + " " + SV.H, class: "sv-svg", "aria-hidden": "true", focusable: "false" });
    g.appendChild(svg("rect", { x: 0, y: 0, width: SV.W, height: SV.GY, class: "sv-sky" }));
    g.appendChild(svg("rect", { x: 0, y: SV.GY, width: SV.W, height: SV.H - SV.GY, class: "sv-earth" }));
    g.appendChild(svg("line", { x1: 0, x2: SV.W, y1: SV.GY, y2: SV.GY, class: "sv-ground" }));
    var shadow = svg("rect", { y: SV.GY - 1.5, height: 4.5, class: "sv-shadow" });
    g.appendChild(shadow);
    // 나무(3D 나무와 같은 비율: 줄기 + 원뿔 3단, 가운데 SV.CX)
    var tree = svg("g", { class: "sv-tree", "data-bx": String(SV.CX) });
    tree.appendChild(svg("rect", { x: SV.CX - TRUNK.r0 * SV.K, y: SV.GY - TRUNK.h * SV.K, width: 2 * TRUNK.r0 * SV.K, height: TRUNK.h * SV.K, class: "sv-trunk" }));
    CONES.forEach(function (cn) {
      var yb = SV.GY - cn.y0 * SV.K;
      var ya = SV.GY - cn.y1 * SV.K;
      var hw = cn.r * SV.K;
      tree.appendChild(svg("polygon", { points: [SV.CX - hw, yb, SV.CX + hw, yb, SV.CX, ya].join(" "), class: "sv-crown" }));
    });
    g.appendChild(tree);
    var arc = svg("path", { class: "sv-arc" });
    var ray = svg("line", { class: "sv-ray" });
    var tip = svg("circle", { r: 3.2, cy: SV.GY, class: "sv-tip" });
    var sun = svg("circle", { r: 6, class: "sv-sun" });
    var lbl = svg("text", { y: SV.GY + 18, "text-anchor": "middle", class: "sv-lbl" }, "태양 고도");
    [arc, ray, tip, sun, lbl].forEach(function (x) {
      g.appendChild(x);
    });
    var LABEL = "나무와 그림자를 옆에서 본 모습(모형): 해에서 오는 빛줄기가 나무 꼭대기를 지나 그림자 끝에 닿아요. 빨간 호는 빛줄기와 땅이 이루는 각, 태양 고도예요.";
    var node = el("figure", { class: "side-view", role: "img", "aria-label": LABEL }, [el("figcaption", { class: "side-cap", "aria-hidden": "true", text: "옆에서 본 모습(모형)" }), g]);
    var lastSide = 0;
    function p2(v) {
      return v.toFixed(2);
    }
    return {
      node: node,
      // d: 3D와 같은 태양 방향 단위 벡터
      set: function (d) {
        var hl = Math.hypot(d.x, d.z); // cos(태양 고도)
        var s = d.y; // sin(태양 고도)
        if (!(s > 0) || !(hl > 0)) return;
        // 그림자가 뻗는 쪽: 해가 처음 시점 화면의 왼쪽이면 오른쪽(+1), 오른쪽이면 왼쪽(−1) — 3D 처음 시점과 좌우를 맞춘다(review-B2 N1)
        var sg = d.x * VIEW_RIGHT.x + d.z * VIEW_RIGHT.z > 0 ? -1 : 1;
        var L = (TREE_H * hl) / s; // 그림자 길이(cm) = 3D의 |밑동 → 그림자 끝|(TREE_H ÷ d.y만큼 d를 따라 내려간 수평 거리)
        var tx = SV.CX + sg * L * SV.K; // 그림자 끝
        var sx = SV.CX - sg * SV.SUN_S * SV.K * hl; // 해: 나무 꼭대기에서 d 쪽으로(해 → 꼭대기 → 그림자 끝이 한 직선)
        var sy = top - SV.SUN_S * SV.K * s;
        shadow.setAttribute("x", p2(Math.min(SV.CX, tx)));
        shadow.setAttribute("width", p2(Math.abs(tx - SV.CX)));
        ray.setAttribute("x1", p2(sx));
        ray.setAttribute("y1", p2(sy));
        ray.setAttribute("x2", p2(tx));
        ray.setAttribute("y2", String(SV.GY));
        sun.setAttribute("cx", p2(sx));
        sun.setAttribute("cy", p2(sy));
        tip.setAttribute("cx", p2(tx));
        var r = SV.ARC;
        arc.setAttribute(
          "d",
          "M " + p2(tx) + " " + SV.GY + " L " + p2(tx - sg * r) + " " + SV.GY + " A " + r + " " + r + " 0 0 " + (sg > 0 ? 1 : 0) + " " + p2(tx - sg * r * hl) + " " + p2(SV.GY - r * s) + " Z"
        );
        lbl.setAttribute("x", p2(clamp(tx - sg * r * 0.5, 26, SV.W - 26)));
        if (sg !== lastSide) {
          lastSide = sg;
          node.setAttribute("aria-label", LABEL + (sg > 0 ? " 지금 햇빛은 왼쪽에서 와요." : " 지금 햇빛은 오른쪽에서 와요."));
        }
      },
    };
  }
  // 2D 볼록 껍질(Andrew monotone chain). pts: [x0, z0, x1, z1, …] → 반시계 순서의 점 번호
  function hull2(pts, n) {
    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    idx.sort(function (a, b) {
      return pts[2 * a] - pts[2 * b] || pts[2 * a + 1] - pts[2 * b + 1];
    });
    function cross(o, a, b) {
      return (pts[2 * a] - pts[2 * o]) * (pts[2 * b + 1] - pts[2 * o + 1]) - (pts[2 * a + 1] - pts[2 * o + 1]) * (pts[2 * b] - pts[2 * o]);
    }
    var lo = [];
    var up = [];
    idx.forEach(function (p) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop();
      lo.push(p);
    });
    for (var j = idx.length - 1; j >= 0; j--) {
      var q = idx[j];
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 1e-9) up.pop();
      up.push(q);
    }
    lo.pop();
    up.pop();
    return lo.concat(up);
  }

  /* ───────── 3D 장면 ───────── */
  function build3D(container, ctx) {
    // 휴대폰처럼 좁은 화면(폭 480px 미만)은 장면 왼쪽 위(모형 배지·시각·전체 화면 보기 버튼)와 아래(안내 글)가 차지하는 몫이 커서,
    // 조금 멀리서 보고 장면을 오른쪽으로 옮겨 해·그림자 끝이 그 자리에 가리지 않게 한다(만들 때의 폭으로 정한다).
    var cw = container.clientWidth || 0;
    var narrow = cw > 0 && cw < 480;
    return S.Sim3D.create({
      container: container,
      frame: narrow ? { width: 34, depth: 56, center: [-12, 10.4, 1] } : { width: 34, depth: 48, center: [-0.5, 9.4, 0] },
      // 북쪽에서 동쪽으로 14° 돌린 곳, 26° 높이에서 남쪽 하늘을 본다(왼쪽 동·오른쪽 서). 정북이면 12:30의 호가 옆으로 서서
      // 안 보이므로 조금 돌렸다 — 7개 눈금 모두 화면에서 호가 보인다(가장 좁은 13:30도 약 8°).
      viewDir: [-0.217, 0.438, 0.872],
      minDistance: 12,
      lightBg: 0xd8eafb,
      darkBg: 0x162033,
      onLost: ctx.onLost,
      // 하늘의 시각 점(매시 30분)을 누르면 그 시각으로 빨리 감기(눈금 버튼과 같다)
      onPick: function (pk) {
        if (pk && pk.min != null && !sunDragging) goTo(pk.min, 1000);
      },
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var root = v.root;
      var disposed = false;
      var UP = new T.Vector3(0, 1, 0);
      var TOP = new T.Vector3(0, TREE_H, 0);

      // 햇빛 방향 조명(태양 방향 d를 따라 움직인다)
      var sunLight = null;
      v.scene.children.forEach(function (o) {
        if (o.isDirectionalLight) sunLight = o;
      });
      if (sunLight) sunLight.color.set(0xfff4dc);

      // ── 땅(운동장, 모형) ──
      var groundMat = M.material(0xcdb98f, { roughness: 0.95 });
      var ground = new T.Mesh(new T.CylinderGeometry(32, 32, 0.6, 72), groundMat);
      ground.position.y = -0.3;
      root.add(ground);
      // 잔디 조각(땅에 그린 무늬 — 높이가 없어 그림자를 만들지 않는다)
      var grassMat = new T.MeshStandardMaterial({ color: 0x8fbe6c, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      [
        [SCREEN_AT.x, SCREEN_AT.z, 4.2, 3.2, 0.3],
        [-18, -14, 5, 3, 0.6],
        [20, -16, 4.5, 2.6, -0.4],
        [-22, 8, 3.6, 2.4, 0.2],
        [6, -22, 6, 2.6, 0.1],
        [-10, -21, 4, 2, -0.3],
        [22, 10, 3, 2, 0.5],
      ].forEach(function (g) {
        var patch = new T.Mesh(new T.CircleGeometry(1, 9), grassMat);
        patch.rotation.set(-Math.PI / 2, 0, g[4]);
        patch.scale.set(g[2], g[3], 1);
        patch.position.set(g[0], 0.01, g[1]);
        root.add(patch);
      });
      v.onThemeChange(function (dark) {
        groundMat.color.set(dark ? 0x7a6d52 : 0xcdb98f);
        grassMat.color.set(dark ? 0x4f6e3c : 0x8fbe6c);
      });
      // 방위(땅 위 글자). '북'은 처음 시점에서 장면 아래 가운데라 조금 높이고 작게(높이 2.7, 3.1) — 아래쪽 안내 글에 가리지 않게
      // (fix-B1 L11: 1024×768 기본 화면 79px² → 0, 휴대폰 가로 155px² → 0). 그림자 끝·호·그림자 길이 선과도 겹치지 않는다(9:30~15:30).
      [
        ["동", -23, 0],
        ["서", 23, 0],
        ["남", 0, -23],
        ["북", 0, 14.5, 3.1, 2.7],
      ].forEach(function (d) {
        var lb = M.label(d[0], { height: d[4] || 3, bold: true, bg: "rgba(255,255,255,0.9)", border: "#5b6676" });
        lb.position.set(d[1], d[3] || 2, d[2]);
        root.add(lb);
      });

      // ── 나무(모형, 높이 10 cm — 그림자를 재는 물체) ──
      var tree = new T.Group();
      root.add(tree);
      var trunk = new T.Mesh(new T.CylinderGeometry(TRUNK.r1, TRUNK.r0, TRUNK.h, 7), M.material(0x8b5a2b, { roughness: 0.9, flatShading: true }));
      trunk.position.y = TRUNK.h / 2;
      tree.add(trunk);
      var coneMeshes = CONES.map(function (cn) {
        var m = new T.Mesh(new T.ConeGeometry(cn.r, cn.y1 - cn.y0, 8), M.material(cn.color, { roughness: 0.85, flatShading: true }));
        m.position.y = (cn.y0 + cn.y1) / 2;
        tree.add(m);
        return m;
      });
      // 이름표(안 바뀌는 글자)는 나무 꼭대기 오른쪽 옆 — 나무 꼭대기를 지나는 빛줄기는 늘 꼭대기의 위(해 쪽)나 아래(그림자 끝 쪽)로만
      // 지나가서 이 자리를 가리지 않는다(9:30~15:30 확인)
      var treeLbl = M.label("나무(모형)\n높이 10 cm", { height: 2.7, bg: "rgba(255,255,255,0.9)" });
      treeLbl.position.set(4.8, 9.2, 0.5);
      root.add(treeLbl);

      // ── 작은 사람(크기 비교용 장식 — 재지 않는다) ──
      var person = new T.Group();
      person.position.set(PERSON_AT.x, 0, PERSON_AT.z);
      person.rotation.y = 0.55;
      root.add(person);
      function pPart(geo, color, x, y, z) {
        var m = new T.Mesh(geo, M.material(color, { roughness: 0.8, flatShading: true }));
        m.position.set(x, y, z);
        person.add(m);
        return m;
      }
      var pLegs = [pPart(new T.BoxGeometry(0.34, 1.5, 0.38), 0x2f3a56, -0.21, 0.75, 0), pPart(new T.BoxGeometry(0.34, 1.5, 0.38), 0x2f3a56, 0.21, 0.75, 0)];
      var pBody = [
        pPart(new T.BoxGeometry(1.0, 1.3, 0.56), 0x7d5fd6, 0, 2.15, 0),
        pPart(new T.BoxGeometry(0.26, 1.15, 0.3), 0x7d5fd6, -0.64, 2.2, 0),
        pPart(new T.BoxGeometry(0.26, 1.15, 0.3), 0x7d5fd6, 0.64, 2.2, 0),
      ];
      var pHead = [
        pPart(new T.IcosahedronGeometry(0.44, 1), 0xf1c7a0, 0, 3.2, 0),
        pPart(new T.CylinderGeometry(0.46, 0.47, 0.24, 10), 0xf2c21b, 0, 3.52, 0),
        pPart(new T.BoxGeometry(0.56, 0.07, 0.42), 0xf2c21b, 0, 3.43, 0.36),
      ];

      // ── 백엽상(모형) — 문은 북쪽(햇빛이 들지 않는 쪽)에 있고 열려 있어 안의 온도계가 보인다 ──
      var box = new T.Group();
      box.position.set(SCREEN_AT.x, 0, SCREEN_AT.z);
      root.add(box);
      var lcv = document.createElement("canvas");
      lcv.width = 64;
      lcv.height = 128;
      var lg = lcv.getContext("2d");
      lg.fillStyle = "#f4f4ef";
      lg.fillRect(0, 0, 64, 128);
      lg.fillStyle = "#c9ccc4";
      for (var ly = 6; ly < 128; ly += 14) lg.fillRect(0, ly, 64, 4); // 비늘살(루버)
      var louverTex = new T.CanvasTexture(lcv);
      louverTex.colorSpace = T.SRGBColorSpace;
      var whiteMat = M.material(0xf4f4ef, { roughness: 0.7 });
      var louverMat = new T.MeshStandardMaterial({ map: louverTex, roughness: 0.75 });
      function bPart(w, h, d, x, y, z, mat) {
        var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat || whiteMat);
        m.position.set(x, y, z);
        box.add(m);
        return m;
      }
      var BX0 = 2.2; // 상자 바닥 높이(다리)
      var bLegs = [
        bPart(0.16, BX0, 0.16, -0.95, BX0 / 2, -0.6),
        bPart(0.16, BX0, 0.16, 0.95, BX0 / 2, -0.6),
        bPart(0.16, BX0, 0.16, -0.95, BX0 / 2, 0.6),
        bPart(0.16, BX0, 0.16, 0.95, BX0 / 2, 0.6),
      ];
      var bShell = [
        bPart(2.2, 2.2, 0.1, 0, BX0 + 1.1, -0.7, louverMat), // 뒤(남)
        bPart(0.1, 2.2, 1.5, -1.05, BX0 + 1.1, 0, louverMat), // 동
        bPart(0.1, 2.2, 1.5, 1.05, BX0 + 1.1, 0, louverMat), // 서
        bPart(2.2, 0.1, 1.5, 0, BX0 + 2.15, 0), // 위
        bPart(2.2, 0.1, 1.5, 0, BX0 + 0.05, 0), // 바닥
      ];
      var bRoof = bPart(2.6, 0.24, 1.9, 0, BX0 + 2.32, 0);
      var hinge = new T.Group();
      hinge.position.set(1.05, BX0 + 1.1, 0.78);
      hinge.rotation.y = 1.75; // 북쪽으로 열린 문(서쪽 경첩)
      box.add(hinge);
      var bDoor = new T.Mesh(new T.BoxGeometry(2.1, 2.1, 0.08), louverMat);
      bDoor.position.set(-1.05, 0, 0);
      hinge.add(bDoor);
      // 온도계(안쪽 뒤 벽, 북쪽을 향함): 눈금판 15~30 °C + 빨간 액주. 기온 숫자는 측정값 패널에만 쓴다.
      var TH = { tMin: 15, tMax: 30, y0: BX0 + 0.45, h: 1.45 };
      var tcv = document.createElement("canvas");
      tcv.width = 128;
      tcv.height = 512;
      var tg = tcv.getContext("2d");
      tg.fillStyle = "#ffffff";
      tg.fillRect(0, 0, 128, 512);
      tg.fillStyle = "#1f2733";
      tg.font = "700 34px system-ui, sans-serif";
      tg.textAlign = "right";
      tg.textBaseline = "middle";
      var tPad = 40;
      function tPix(t) {
        return 512 - tPad - ((t - TH.tMin) / (TH.tMax - TH.tMin)) * (512 - 2 * tPad);
      }
      for (var tt = TH.tMin; tt <= TH.tMax; tt++) {
        var big = tt % 5 === 0;
        tg.fillRect(big ? 70 : 82, tPix(tt) - (big ? 3 : 1.5), big ? 40 : 28, big ? 6 : 3);
        if (big) tg.fillText(String(tt), 62, tPix(tt));
      }
      var tTex = new T.CanvasTexture(tcv);
      tTex.colorSpace = T.SRGBColorSpace;
      var boardH = TH.h * (512 / (512 - 2 * tPad));
      var tBoard = new T.Mesh(new T.PlaneGeometry(0.62, boardH), new T.MeshBasicMaterial({ map: tTex }));
      tBoard.position.set(-0.15, TH.y0 + TH.h / 2, -0.62);
      box.add(tBoard);
      function thermoY(t) {
        return TH.y0 + ((clamp(t, TH.tMin, TH.tMax) - TH.tMin) / (TH.tMax - TH.tMin)) * TH.h;
      }
      var tube = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, TH.h + 0.2, 8), M.material(0xffffff, { transparent: true, opacity: 0.55, roughness: 0.1 }));
      tube.position.set(0.3, TH.y0 + TH.h / 2, -0.58);
      box.add(tube);
      var bulb = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), M.material(0xd8434f));
      bulb.position.set(0.3, TH.y0 - 0.12, -0.58);
      box.add(bulb);
      var liquid = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1, 8), M.material(0xd8434f));
      box.add(liquid);
      var boxLbl = M.label("백엽상\n(속에 온도계)", { height: 2.5, bg: "rgba(255,255,255,0.9)" });
      boxLbl.position.set(SCREEN_AT.x, BX0 + 4.1, SCREEN_AT.z);
      root.add(boxLbl);

      // ── 하늘(모형): 하루 경로(점선), 매시 30분 점(누르면 그 시각으로), 태양 ──
      function skyPoint(i) {
        return sunDir(T, SUN.az[i], SUN.alt[i]).multiplyScalar(SKY_R).add(TOP);
      }
      var skyPts = [];
      for (var si = 0; si <= MIN1 - MIN0; si++) skyPts.push(skyPoint(si));
      var pathPts = skyPts.filter(function (p, i) {
        return i % 5 === 0;
      });
      var pathLine = new T.Line(new T.BufferGeometry().setFromPoints(pathPts), new T.LineDashedMaterial({ color: 0xd9860f, dashSize: 1.2, gapSize: 0.9 }));
      pathLine.computeLineDistances();
      root.add(pathLine);
      var dotGeo = new T.SphereGeometry(0.5, 10, 8);
      var dotMat = M.material(0xd9860f);
      var hitGeo = new T.SphereGeometry(1.7, 8, 6);
      var hitMat = new T.MeshBasicMaterial();
      var tickLabels = [];
      TIMES.forEach(function (t) {
        var p = skyPts[t.min - MIN0];
        var dot = new T.Mesh(dotGeo, dotMat);
        dot.position.copy(p);
        root.add(dot);
        var hit = new T.Mesh(hitGeo, hitMat);
        hit.visible = false; // 누르기 쉬운 넓은 자리(보이지 않음)
        hit.position.copy(p);
        root.add(hit);
        v.pickable(hit, { min: t.min });
        var tl = M.label(t.label, { height: 1.55, bg: "rgba(255,248,225,0.92)" });
        tl.position.copy(p).add(new T.Vector3(0, -3.3, 0));
        tl.userData.tick = t.id;
        root.add(tl);
        v.pickable(tl, { min: t.min });
        tickLabels.push(tl);
      });
      var sunMesh = new T.Mesh(new T.SphereGeometry(1.8, 20, 14), new T.MeshBasicMaterial({ color: 0xffc928 }));
      sunMesh.name = "sun";
      root.add(sunMesh);
      var gcv = document.createElement("canvas");
      gcv.width = 128;
      gcv.height = 128;
      var gg = gcv.getContext("2d");
      var grad = gg.createRadialGradient(64, 64, 8, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,214,80,0.95)");
      grad.addColorStop(1, "rgba(255,214,80,0)");
      gg.fillStyle = grad;
      gg.fillRect(0, 0, 128, 128);
      var glow = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(gcv), transparent: true, depthWrite: false }));
      glow.scale.set(9, 9, 1);
      root.add(glow);

      // ── 빛줄기: 옅은 빛줄기 여러 가닥(모두 d와 평행) + 나무 꼭대기를 지나 그림자 끝에 닿는 빛줄기 하나(또렷하게) ──
      var rcv = document.createElement("canvas");
      rcv.width = 4;
      rcv.height = 128;
      var rg = rcv.getContext("2d");
      var rgr = rg.createLinearGradient(0, 0, 0, 128); // 위(하늘 쪽)는 투명 → 땅 쪽으로 옅게 보인다
      rgr.addColorStop(0, "rgba(255,255,255,0)");
      rgr.addColorStop(0.45, "rgba(255,255,255,0.55)");
      rgr.addColorStop(1, "rgba(255,255,255,0.8)");
      rg.fillStyle = rgr;
      rg.fillRect(0, 0, 4, 128);
      var rayTex = new T.CanvasTexture(rcv);
      var faintMat = new T.MeshBasicMaterial({ color: 0xffc83d, map: rayTex, transparent: true, opacity: 0.75, depthWrite: false });
      var faintGeo = new T.CylinderGeometry(0.075, 0.075, 1, 6, 1, true);
      var faint = FAINT_RAYS.map(function (f, i) {
        var m = new T.Mesh(faintGeo, faintMat);
        m.name = "faintRay" + i;
        m.renderOrder = 40;
        root.add(m);
        return m;
      });
      var keyRay = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 1, 10), new T.MeshBasicMaterial({ color: 0xff9800, transparent: true, opacity: 0.95, depthWrite: false }));
      keyRay.name = "keyRay";
      keyRay.renderOrder = 41;
      root.add(keyRay);

      // ── 그림자(모형): 물체 조각마다 꼭짓점을 d를 따라 땅(y = 0)에 투영한 볼록 껍질 ──
      // 같은 물체의 조각 그림자가 겹친 곳도 한 번만 어둡게: 먼저 그리는 조각일수록 땅에서 아주 조금 더 높게(0.02씩) 깊이를 써서
      // 뒤에 그리는 조각은 겹친 곳에서 깊이 검사에 걸려 빠진다(서로 다른 물체의 그림자는 배치상 겹치지 않는다).
      // (polygonOffset은 기기마다 깊이 단위가 달라 겹친 곳이 얼룩지므로 쓰지 않는다.)
      root.updateMatrixWorld(true);
      var SH_Y = 0.02; // 그림자 높이(땅 바로 위)
      var SH_STEP = 0.02; // 조각마다 높이 차(먼저 그리는 조각이 위)
      var casters = [];
      var shadowMats = [];
      function addCasterGroup(name, groups) {
        groups.forEach(function (meshes, gi) {
          var seen = {};
          var arr = [];
          var vv = new T.Vector3();
          meshes.forEach(function (mesh) {
            var pos = mesh.geometry.attributes.position;
            for (var k = 0; k < pos.count; k++) {
              vv.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld);
              var key = vv.x.toFixed(3) + "," + vv.y.toFixed(3) + "," + vv.z.toFixed(3);
              if (seen[key]) continue;
              seen[key] = 1;
              arr.push(vv.x, vv.y, vv.z);
            }
          });
          var n = arr.length / 3;
          var geo = new T.BufferGeometry();
          geo.setAttribute("position", new T.BufferAttribute(new Float32Array(Math.max(1, n - 2) * 9), 3));
          geo.setDrawRange(0, 0);
          var mat = new T.MeshBasicMaterial({
            color: 0x1c1710,
            transparent: true,
            opacity: 0.42,
            side: T.DoubleSide,
            depthWrite: true,
            depthFunc: T.LessDepth,
          });
          shadowMats.push(mat);
          var mesh = new T.Mesh(geo, mat);
          mesh.name = "shadow:" + name + ":" + gi;
          mesh.frustumCulled = false;
          mesh.renderOrder = 2 + gi;
          root.add(mesh);
          casters.push({ pts: arr, n: n, proj: new Float64Array(2 * n), mesh: mesh, y: SH_Y + (groups.length - gi) * SH_STEP });
        });
      }
      addCasterGroup("tree", [[trunk]].concat(coneMeshes.map(function (m) { return [m]; })));
      addCasterGroup("person", [pLegs, pBody, pHead]);
      addCasterGroup("box", bLegs.map(function (m) { return [m]; }).concat([bShell, [bRoof], [bDoor]]));
      v.onThemeChange(function (dark) {
        shadowMats.forEach(function (m) {
          m.opacity = dark ? 0.5 : 0.42;
        });
      });
      function updateShadows(d) {
        casters.forEach(function (c) {
          var p = c.pts;
          var pr = c.proj;
          for (var i = 0; i < c.n; i++) {
            var s = p[3 * i + 1] / d.y;
            pr[2 * i] = p[3 * i] - s * d.x;
            pr[2 * i + 1] = p[3 * i + 2] - s * d.z;
          }
          var h = hull2(pr, c.n);
          var attr = c.mesh.geometry.attributes.position;
          var a = attr.array;
          var o = 0;
          for (var t = 1; t < h.length - 1; t++) {
            [h[0], h[t], h[t + 1]].forEach(function (q) {
              a[o++] = pr[2 * q];
              a[o++] = c.y;
              a[o++] = pr[2 * q + 1];
            });
          }
          attr.needsUpdate = true;
          c.mesh.geometry.setDrawRange(0, Math.max(0, (h.length - 2) * 3));
        });
      }

      // ── 그림자 끝·그림자 길이(초록) + 태양 고도 호(빨강, 반지름은 나무 키의 1/3보다 작게) ──
      var markMat = function (color, opacity) {
        return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, side: T.DoubleSide, depthWrite: false });
      };
      var lenG = new T.Group();
      root.add(lenG);
      var lenBack = new T.Mesh(new T.PlaneGeometry(1, 0.42), markMat(0xffffff, 0.9));
      var lenLine = new T.Mesh(new T.PlaneGeometry(1, 0.22), markMat(0x2f8a3a, 1));
      [lenBack, lenLine].forEach(function (m, i) {
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.22 + i * 0.01; // 그림자(최고 0.18)보다 위
        m.renderOrder = 30 + i;
        lenG.add(m);
      });
      var tipG = new T.Group();
      tipG.name = "shadowTip";
      root.add(tipG);
      var tipRing = new T.Mesh(new T.RingGeometry(0.42, 0.66, 20), markMat(0xffffff, 0.95));
      var tipDot = new T.Mesh(new T.CircleGeometry(0.44, 20), markMat(0x2f8a3a, 1));
      [tipRing, tipDot].forEach(function (m, i) {
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.24 + i * 0.01;
        m.renderOrder = 32 + i;
        tipG.add(m);
      });
      var ARC_R = 3.1; // < 나무 키(10)의 1/3(3.33)
      var arcG = new T.Group();
      arcG.name = "altArc";
      root.add(arcG);
      var arcFill = new T.Mesh(new T.CircleGeometry(ARC_R, 24, 0, 0.5), new T.MeshBasicMaterial({ color: 0xd8434f, transparent: true, opacity: 0.4, side: T.DoubleSide, depthWrite: false }));
      var arcLine = new T.Mesh(new T.RingGeometry(ARC_R - 0.3, ARC_R + 0.02, 24, 1, 0, 0.5), new T.MeshBasicMaterial({ color: 0xd8434f, transparent: true, opacity: 0.95, side: T.DoubleSide, depthWrite: false }));
      arcFill.renderOrder = 34;
      arcLine.renderOrder = 35;
      arcG.add(arcFill, arcLine);
      var arcAlt = null;
      function setArcAngle(a) {
        if (arcAlt !== null && Math.abs(arcAlt - a) < 1e-7) return;
        arcAlt = a;
        arcFill.geometry.dispose();
        arcFill.geometry = new T.CircleGeometry(ARC_R, 24, 0, a);
        arcLine.geometry.dispose();
        arcLine.geometry = new T.RingGeometry(ARC_R - 0.3, ARC_R + 0.02, 24, 1, 0, a);
      }

      // ── 태양을 끌어 시각 바꾸기: 포인터 레이에 가장 가까운(각도) 하늘 경로의 분을 고른다 → setMinute(시간 바와 같은 길) ──
      function nearestMinute(ray) {
        var best = -1;
        var bestV = Infinity;
        var o = ray.origin;
        var dr = ray.direction;
        for (var i = 0; i < skyPts.length; i++) {
          var p = skyPts[i];
          var dx = p.x - o.x;
          var dy = p.y - o.y;
          var dz = p.z - o.z;
          var along = dx * dr.x + dy * dr.y + dz * dr.z;
          if (along <= 0) continue;
          var perp2 = dx * dx + dy * dy + dz * dz - along * along;
          var val = perp2 / (along * along);
          if (val < bestV) {
            bestV = val;
            best = i;
          }
        }
        return best < 0 ? null : MIN0 + best;
      }
      var dragStart = null;
      v.draggable(sunMesh, {
        onStart: function (info) {
          sunDragging = true;
          cancelTween();
          dragStart = info.event ? { x: info.event.clientX, y: info.event.clientY, moved: false } : { moved: true };
        },
        onDrag: function (info) {
          if (!info.ray) return;
          // 잡은 자리에서 조금(6px) 움직이기 전에는 시각을 바꾸지 않는다(누르기만 해도 1~2분 튀지 않게)
          if (dragStart && !dragStart.moved && info.event) {
            if (Math.hypot(info.event.clientX - dragStart.x, info.event.clientY - dragStart.y) < 6) return;
            dragStart.moved = true;
          }
          var m = nearestMinute(info.ray);
          if (m != null) setMinute(m);
        },
        onEnd: function () {
          sunDragging = false;
          var moved = dragStart && dragStart.moved;
          dragStart = null;
          if (moved) snapToTick();
        },
      });

      // ── 옆에서 본 모습 칸(3D 칸 오른쪽 위, 크게 보기의 막대 위) — applySun(d)에서 같은 d로 함께 그린다 ──
      var side = makeSideView();
      container.appendChild(side.node);
      /* 칸 크기(처음 시점 기준으로 재서 정한다): 칸의 왼쪽 끝이, 칸과 같은 높이 띠 안에 있는 하늘의 해 길(해 원판이 지나는 자리)·
         시각 이름표·물체 이름표보다 오른쪽이 되게 폭을 줄인다. 장면 칸이 가로에 비해 높을수록(머리말 접기, 큰 화면의 기본 화면)
         해 길의 오른쪽 끝(15:30)이 화면 오른쪽으로 오기 때문이다. 학생이 돌려 본 시점과 무관하게 늘 처음 시점으로 잰다
         (잠깐 처음 시점으로 옮겨 재고 곧바로 되돌린다 — 한 작업 안이라 화면에는 되돌린 시점만 그려진다).
         3D 칸이 좁거나(폭 480px 미만 — 휴대폰) 낮거나(250px 미만) 칸이 너무 작아지면(132px 미만) 숨긴다(2D 화면 아래쪽이 같은 옆모습). */
      var SIDE = { top: 46, right: 10, gap: 10, min: 132, max: 240 };
      var sideLabels = tickLabels.concat([treeLbl, boxLbl]);
      root.children.forEach(function (o) {
        if (o.isSprite && sideLabels.indexOf(o) < 0 && o !== glow) sideLabels.push(o); // 방위 이름표
      });
      function sideLimit(cw, ch, band) {
        // 처음 시점에서 band(칸의 위·아래, px)와 겹치는 해 길(해 원판)·이름표의 가장 오른쪽 x(px)
        var cam = v.camera;
        var rightV = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
        var upV = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
        function px(p) {
          var q = p.clone().project(cam);
          return { x: ((q.x + 1) / 2) * cw, y: ((1 - q.y) / 2) * ch };
        }
        var lim = 0;
        function take(x0, x1, y0, y1) {
          if (y1 >= band[0] && y0 <= band[1]) lim = Math.max(lim, x1);
        }
        for (var i = 0; i < skyPts.length; i += 2) {
          var c = px(skyPts[i]);
          var e = px(skyPts[i].clone().addScaledVector(rightV, 1.8)); // 해 반지름
          var r = Math.hypot(e.x - c.x, e.y - c.y);
          take(c.x - r, c.x + r, c.y - r, c.y + r);
        }
        sideLabels.forEach(function (sp) {
          var xs = [];
          var ys = [];
          [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(function (k) {
            var q = px(sp.position.clone().addScaledVector(rightV, k[0] * sp.scale.x).addScaledVector(upV, k[1] * sp.scale.y));
            xs.push(q.x);
            ys.push(q.y);
          });
          take(Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys));
        });
        return lim;
      }
      function placeSide() {
        if (disposed) return;
        var cw = container.clientWidth || 0;
        var ch = container.clientHeight || 0;
        var off = cw < 480 || ch < 250;
        if (!off) {
          var want = clamp(Math.round(0.28 * cw), 150, SIDE.max);
          side.node.classList.remove("is-off");
          side.node.style.width = want + "px";
          var hPx = side.node.getBoundingClientRect().height || 0;
          var keep = v.cameraPose();
          v.resetView();
          var lim = sideLimit(cw, ch, [SIDE.top - SIDE.gap, SIDE.top + hPx + SIDE.gap]);
          v.setCameraPose(keep);
          var w = Math.floor(Math.min(want, cw - SIDE.right - SIDE.gap - lim));
          if (w < SIDE.min) off = true;
          else side.node.style.width = w + "px";
        }
        side.node.classList.toggle("is-off", off);
      }
      var sideRaf = 0;
      function fitSide() {
        // 칸 크기가 바뀐 뒤(공통 틀이 카메라 비율을 맞춘 다음 프레임)에 잰다
        if (sideRaf) return;
        sideRaf = requestAnimationFrame(function () {
          sideRaf = 0;
          placeSide();
        });
      }
      placeSide(); // 처음 한 번은 바로(한 프레임이라도 해 길을 가리지 않게)
      var sideRO = window.ResizeObserver ? new ResizeObserver(fitSide) : null;
      if (sideRO) sideRO.observe(container);

      /* ── 태양 방향 벡터 d 하나로 장면의 모든 햇빛 그림을 함께 계산한다 ── */
      var tmp = new T.Vector3();
      var basis = new T.Matrix4();
      function stretch(mesh, a, b) {
        var dd = tmp.copy(b).sub(a);
        var len = dd.length() || 0.001;
        mesh.position.copy(a).addScaledVector(dd, 0.5);
        mesh.quaternion.setFromUnitVectors(UP, dd.normalize());
        mesh.scale.set(1, len, 1);
      }
      function applySun(d) {
        var sunPos = d.clone().multiplyScalar(SKY_R).add(TOP); // 태양 = 나무 꼭대기 + SKY_R·d
        sunMesh.position.copy(sunPos);
        glow.position.copy(sunPos);
        if (sunLight) {
          sunLight.position.copy(d).multiplyScalar(40);
          sunLight.target.position.set(0, 0, 0);
        }
        var k = TREE_H / d.y; // 나무 꼭대기에서 땅까지 빛줄기의 길이
        var tip = TOP.clone().addScaledVector(d, -k); // 그림자 끝 P(y = 0) — 길이 |OP| = 10 ÷ tan(태양 고도)
        stretch(keyRay, tip, sunPos); // 태양 중심 → 나무 꼭대기 → 그림자 끝(한 직선)
        var hl = Math.hypot(d.x, d.z) || 1;
        var toSun = new T.Vector3(d.x / hl, 0, d.z / hl); // 땅 위에서 태양 쪽(그림자 끝 → 나무 밑동)
        var sd = toSun.clone().negate(); // 그림자 방향
        var lat = new T.Vector3(-sd.z, 0, sd.x); // 그림자와 수직(땅 위)
        var rayLen = SKY_R + k;
        FAINT_RAYS.forEach(function (f, i) {
          var g = tip.clone().multiplyScalar(f.at || 1).addScaledVector(lat, f.side || 0).addScaledVector(sd, f.beyond || 0);
          g.y = 0;
          stretch(faint[i], g, g.clone().addScaledVector(d, rayLen)); // 모두 d와 평행
        });
        updateShadows(d);
        // 그림자 길이(밑동 O → 그림자 끝 P, 초록)와 그림자 끝 표시
        var L = Math.hypot(tip.x, tip.z);
        lenG.position.set(0, 0, 0);
        lenG.rotation.y = Math.atan2(-sd.z, sd.x);
        [lenBack, lenLine].forEach(function (m) {
          m.scale.x = L;
          m.position.x = L / 2;
        });
        tipG.position.set(tip.x, 0, tip.z);
        // 태양 고도 호: 그림자 끝에서, 땅(밑동 쪽) 방향과 빛줄기(태양 쪽) 방향 사이 — 두 방향이 모두 d에서 나온다
        setArcAngle(Math.asin(clamp(d.y, -1, 1)));
        var w = toSun.clone().cross(UP);
        basis.makeBasis(toSun, UP, w);
        arcG.quaternion.setFromRotationMatrix(basis);
        arcG.position.set(tip.x, 0.25, tip.z);
        // 옆에서 본 모습 칸도 같은 d로(칸 속 각 = 태양 고도, 빛이 오는 쪽 = 해가 있는 쪽)
        side.set(d);
      }

      function setTime(st) {
        if (disposed) return;
        applySun(sunDir(T, st.az, st.alt));
        // 해가 매시 30분 점에 있으면 그 점의 시각 이름표는 잠시 숨긴다(해·빛줄기가 이름표를 덮지 않게 — 시각은 측정값 패널에)
        tickLabels.forEach(function (tl) {
          tl.visible = !(st.tick && st.tick.id === tl.userData.tick);
        });
        // 백엽상 속 온도계 액주(기온 숫자는 측정값 패널에)
        var top = thermoY(st.temp);
        var bottom = TH.y0 - 0.12;
        liquid.scale.y = top - bottom;
        liquid.position.set(0.3, (top + bottom) / 2, -0.58);
      }

      return {
        setTime: setTime,
        highlight: function () {},
        run: function () {
          return Promise.resolve();
        },
        showInstant: function () {},
        clear: function () {
          goTo(MIN0, 600);
        },
        resetView: v.resetView,
        whenVisible: v.whenVisible,
        dispose: function () {
          disposed = true;
          sunDragging = false;
          if (sideRO) sideRO.disconnect();
          if (sideRaf) cancelAnimationFrame(sideRaf);
          if (side.node.parentNode) side.node.parentNode.removeChild(side.node);
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2D 장면(SVG): 하늘(남쪽을 바라본 모습, 태양 끌기) + 나무와 그림자(옆에서 본 모습) + 백엽상 속 온도계 ───────── */
  function build2D(container) {
    container.textContent = "";
    var disposed = false;
    // 하늘
    var SX = function (az) {
      return 40 + ((az - 90) / 180) * 620;
    };
    var SY = function (alt) {
      return 200 - alt * 3;
    };
    var sky = svg("svg", { viewBox: "0 0 700 250", class: "d2-svg d2-sky", role: "img" });
    sky.appendChild(svg("rect", { x: 0, y: 0, width: 700, height: 250, rx: 14, class: "d2-skybg" }));
    sky.appendChild(svg("text", { x: 16, y: 30, class: "d2-title" }, "하늘 (남쪽을 바라본 모습 · 모형)"));
    [20, 40, 60].forEach(function (a) {
      sky.appendChild(svg("line", { x1: 40, x2: 660, y1: SY(a), y2: SY(a), class: "d2-grid" }));
      sky.appendChild(svg("text", { x: 664, y: SY(a) + 5, class: "d2-small" }, a + "°"));
    });
    sky.appendChild(svg("rect", { x: 0, y: 200, width: 700, height: 50, class: "d2-groundbg" }));
    sky.appendChild(svg("line", { x1: 20, x2: 680, y1: 200, y2: 200, class: "d2-horizon" }));
    [
      ["동", 90],
      ["남", 180],
      ["서", 270],
    ].forEach(function (d) {
      sky.appendChild(svg("text", { x: SX(d[1]), y: 232, "text-anchor": "middle", class: "d2-dir" }, d[0]));
    });
    sky.appendChild(svg("text", { x: 199, y: 238, "text-anchor": "middle", class: "d2-small d2-hint" }, "☀ 해를 끌어 시각을 바꿀 수 있어요"));
    var pathXY = [];
    for (var pi = 0; pi <= MIN1 - MIN0; pi++) pathXY.push([SX(SUN.az[pi]), SY(SUN.alt[pi])]);
    var pts = pathXY.filter(function (p, i) {
      return i % 5 === 0;
    }).map(function (p) {
      return p[0].toFixed(1) + "," + p[1].toFixed(1);
    });
    sky.appendChild(svg("polyline", { points: pts.join(" "), class: "d2-path" }));
    var tickTexts = {};
    TIMES.forEach(function (t) {
      var p = pathXY[t.min - MIN0];
      sky.appendChild(svg("circle", { cx: p[0], cy: p[1], r: 4, class: "d2-pathdot" }));
      // 시각 이름표는 모두 점 아래(제목과 겹치지 않게). 해가 그 점에 있으면 잠시 숨긴다(3D와 같다)
      tickTexts[t.id] = svg("text", { x: p[0], y: p[1] + 24, "text-anchor": "middle", class: "d2-small" }, t.label);
      sky.appendChild(tickTexts[t.id]);
      var hit = svg("circle", { cx: p[0], cy: p[1], r: 16, class: "d2-dothit" }); // 누르면 그 시각으로(눈금 버튼과 같다)
      hit.addEventListener("click", function () {
        goTo(t.min, 1000);
      });
      sky.appendChild(hit);
    });
    var sunG = svg("g", { class: "d2-sun" });
    sunG.appendChild(svg("circle", { cx: 0, cy: 0, r: 30, class: "d2-sunhit" }));
    sunG.appendChild(svg("circle", { cx: 0, cy: 0, r: 15, class: "d2-sunball" }));
    sky.appendChild(sunG);
    // 해 끌기(2D): 누른 자리에서 가장 가까운 하루 경로의 분으로
    var drag2 = null;
    function svgXY(e) {
      var m = sky.getScreenCTM();
      if (!m) return null;
      var p = sky.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      return p.matrixTransform(m.inverse());
    }
    function nearest2D(p) {
      var best = 0;
      var bd = Infinity;
      for (var i = 0; i < pathXY.length; i++) {
        var dx = pathXY[i][0] - p.x;
        var dy = pathXY[i][1] - p.y;
        var dd = dx * dx + dy * dy;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      return MIN0 + best;
    }
    sunG.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      drag2 = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      try {
        sunG.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 무시 */
      }
      sunDragging = true;
      cancelTween();
      e.preventDefault();
    });
    sunG.addEventListener("pointermove", function (e) {
      if (!drag2 || e.pointerId !== drag2.id) return;
      if (!drag2.moved && Math.hypot(e.clientX - drag2.x, e.clientY - drag2.y) < 6) return;
      drag2.moved = true;
      var p = svgXY(e);
      if (p) setMinute(nearest2D(p));
    });
    function end2(e) {
      if (!drag2 || (e && e.pointerId !== drag2.id)) return;
      var moved = drag2.moved;
      drag2 = null;
      sunDragging = false;
      if (moved) snapToTick();
    }
    sunG.addEventListener("pointerup", end2);
    sunG.addEventListener("pointercancel", end2);
    sunG.addEventListener("lostpointercapture", end2);

    // 나무와 그림자(옆에서 본 모습): 위 하늘 그림·3D와 같게 햇빛은 해 쪽에서 온다 — 해가 남중 전(동쪽)이면 왼쪽 위에서,
    // 남중 뒤(서쪽)면 오른쪽 위에서(fix-B1 L5: 예전에는 오후에도 늘 왼쪽에서 왔다). 해가 서쪽이면 땅(0~GW) 위의 나무·사람·그림자를
    // 좌우로 옮겨 놓는다(나무·사람 모양은 좌우 대칭이라 자리만 옮기고, 글자는 뒤집지 않고 자리·정렬만 바꾼다). 오른쪽 온도계는 그대로.
    var PXC = 16; // 1 cm
    var GW = 596; // 땅 폭(그 오른쪽은 백엽상 속 온도계 자리)
    var BX0 = 170; // 나무 밑동(빛이 왼쪽에서 올 때)
    var PX0 = 58; // 작은 사람(빛이 왼쪽에서 올 때)
    var GY = 262; // 땅
    var TOPY = GY - TREE_H * PXC; // 나무 꼭대기
    function sideX(x, flip) {
      return flip ? GW - x : x;
    }
    var dv = svg("svg", { viewBox: "0 0 710 330", class: "d2-svg d2-dev", role: "img" });
    dv.appendChild(svg("rect", { x: 0, y: 0, width: 710, height: 330, rx: 14, class: "d2-devbg" }));
    dv.appendChild(svg("rect", { x: 0, y: GY, width: GW, height: 330 - GY, class: "d2-groundbg" }));
    dv.appendChild(svg("line", { x1: 0, x2: GW, y1: GY, y2: GY, class: "d2-horizon" }));
    dv.appendChild(svg("text", { x: 16, y: 28, class: "d2-title" }, "나무와 그림자 (옆에서 본 모습 · 모형)"));
    var faintL = [0, 1, 2].map(function () {
      var l = svg("line", { class: "d2-faint" });
      dv.appendChild(l);
      return l;
    });
    var keyL = svg("line", { class: "d2-ray" });
    var shd = svg("rect", { y: GY - 3, height: 7, rx: 3, class: "d2-shadow" });
    dv.appendChild(shd);
    // 작은 사람(장식)과 그 그림자 — 모양은 x = 0 둘레에 그리고 자리로 옮긴다
    var pShd = svg("rect", { y: GY - 3, height: 7, rx: 3, class: "d2-shadow" });
    dv.appendChild(pShd);
    var person2 = svg("g", { class: "d2-person" });
    person2.appendChild(svg("rect", { x: -5, y: GY - 24, width: 10, height: 24, rx: 3, class: "d2-pleg" }));
    person2.appendChild(svg("rect", { x: -8, y: GY - 45, width: 16, height: 22, rx: 5, class: "d2-pbody" }));
    person2.appendChild(svg("circle", { cx: 0, cy: GY - 51, r: 7, class: "d2-phead" }));
    person2.appendChild(svg("path", { d: "M -8 " + (GY - 54) + " a 8 6 0 0 1 16 0 z", class: "d2-pcap" }));
    dv.appendChild(person2);
    // 나무(원뿔 3단 + 줄기) — x = 0 둘레에 그리고 자리로 옮긴다
    var tree2 = svg("g", { class: "d2-tree" });
    tree2.appendChild(svg("rect", { x: -8, y: GY - TRUNK.h * PXC, width: 16, height: TRUNK.h * PXC, class: "d2-trunk" }));
    CONES.forEach(function (cn) {
      var yb = GY - cn.y0 * PXC;
      var ya = GY - cn.y1 * PXC;
      var hw = cn.r * PXC;
      tree2.appendChild(svg("polygon", { points: [-hw, yb, hw, yb, 0, ya].join(" "), class: "d2-crown" }));
    });
    dv.appendChild(tree2);
    // 나무 이름표는 빛이 오는 쪽, 꼭대기보다 아래(빛줄기는 꼭대기 위로만 지나가서 가리지 않는다)
    var treeLbl1 = svg("text", { y: TOPY + 26, class: "d2-small" }, "나무(모형)");
    var treeLbl2 = svg("text", { y: TOPY + 46, class: "d2-small" }, "높이 10 cm");
    dv.appendChild(treeLbl1);
    dv.appendChild(treeLbl2);
    dv.appendChild(keyL);
    // 그림자 길이(초록 치수선) · 그림자 끝 · 태양 고도 호(빨강)
    var lenL = svg("line", { y1: GY + 18, y2: GY + 18, class: "d2-len" });
    var lenA = svg("line", { y1: GY + 10, y2: GY + 26, class: "d2-len" });
    var lenB = svg("line", { y1: GY + 10, y2: GY + 26, class: "d2-len" });
    dv.appendChild(lenL);
    dv.appendChild(lenA);
    dv.appendChild(lenB);
    var angArc = svg("path", { class: "d2-arc" });
    dv.appendChild(angArc);
    var tip = svg("circle", { r: 6, class: "d2-tip" });
    dv.appendChild(tip);
    var lenLbl = svg("text", { y: GY + 44, class: "d2-small d2-lenlbl" }, "그림자 길이");
    dv.appendChild(lenLbl);
    // 빛이 오는 쪽에 따라 나무·사람·글자 자리를 맞춘다(flip: 해가 서쪽 → 빛이 오른쪽에서, 그림자는 왼쪽으로)
    var sideFlip = null;
    function layoutSide(flip) {
      if (flip === sideFlip) return;
      sideFlip = flip;
      var bx = sideX(BX0, flip);
      tree2.setAttribute("transform", "translate(" + bx + ",0)");
      person2.setAttribute("transform", "translate(" + sideX(PX0, flip) + ",0)");
      [treeLbl1, treeLbl2].forEach(function (t) {
        t.setAttribute("x", String(flip ? bx + 36 : bx - 36));
        t.setAttribute("text-anchor", flip ? "start" : "end");
      });
      lenLbl.setAttribute("x", String(bx));
      lenLbl.setAttribute("text-anchor", flip ? "end" : "start");
    }
    // 백엽상 속 온도계(오른쪽)
    var TX0 = 653;
    var TY0 = 262; // 15 °C
    var TPC = 11; // 1 °C
    dv.appendChild(svg("text", { x: TX0, y: 30, "text-anchor": "middle", class: "d2-small" }, "백엽상 속"));
    dv.appendChild(svg("text", { x: TX0, y: 50, "text-anchor": "middle", class: "d2-small" }, "온도계"));
    dv.appendChild(svg("polygon", { points: [TX0 - 50, 70, TX0 + 50, 70, TX0, 56].join(" "), class: "d2-box" }));
    dv.appendChild(svg("rect", { x: TX0 - 44, y: 70, width: 88, height: TY0 - 70 + 34, rx: 6, class: "d2-box" }));
    for (var t2 = 15; t2 <= 30; t2++) {
      var yy = TY0 - (t2 - 15) * TPC;
      dv.appendChild(svg("line", { x1: TX0 + 10, x2: TX0 + (t2 % 5 === 0 ? 26 : 18), y1: yy, y2: yy, class: "d2-tick" }));
      if (t2 % 5 === 0) dv.appendChild(svg("text", { x: TX0 - 12, y: yy + 6, "text-anchor": "end", class: "d2-num" }, String(t2)));
    }
    dv.appendChild(svg("rect", { x: TX0 - 4, y: TY0 - 15 * TPC - 8, width: 8, height: 15 * TPC + 20, rx: 4, class: "d2-tube" }));
    var liq = svg("rect", { x: TX0 - 3, width: 6, class: "d2-liquid" });
    dv.appendChild(liq);
    dv.appendChild(svg("circle", { cx: TX0, cy: TY0 + 18, r: 9, class: "d2-liquid" }));
    dv.appendChild(svg("line", { x1: TX0 - 30, x2: TX0 - 30, y1: TY0 + 34, y2: 322, class: "d2-boxleg" }));
    dv.appendChild(svg("line", { x1: TX0 + 30, x2: TX0 + 30, y1: TY0 + 34, y2: 322, class: "d2-boxleg" }));

    container.appendChild(el("div", { class: "d2-wrap" }, [sky, dv]));

    function setTime(st) {
      if (disposed) return;
      var alt = st.alt * RAD;
      var c = Math.cos(alt);
      var s = Math.sin(alt);
      sunG.setAttribute("transform", "translate(" + SX(st.az).toFixed(1) + "," + SY(st.alt).toFixed(1) + ")");
      Object.keys(tickTexts).forEach(function (id) {
        tickTexts[id].style.visibility = st.tick && st.tick.id === id ? "hidden" : "";
      });
      sky.setAttribute("aria-label", "하늘 모형: " + clockText(st.min) + "에 태양이 " + (st.az < 170 ? "남동쪽" : st.az > 190 ? "남서쪽" : "남쪽") + " 하늘, 태양 고도 " + f1(st.solar) + "도 높이에 있어요.");
      // 빛이 오는 쪽: 3D와 같은 태양 방향 벡터(sunVec)의 동서 성분 — 해가 서쪽(x > 0)이면 옆모습을 좌우로 옮겨 놓는다
      var flip = sunVec(st.az, st.alt).x > 0;
      layoutSide(flip);
      var sg = flip ? -1 : 1; // 그림자가 뻗는 쪽(+1 = 오른쪽)
      var bx = sideX(BX0, flip);
      var px = sideX(PX0, flip);
      // 태양 방향 하나(alt)로: 그림자 끝 = 나무 높이 ÷ tan(고도), 빛줄기는 모두 같은 기울기
      var L = TREE_H / Math.tan(alt);
      var tx = bx + sg * L * PXC;
      shd.setAttribute("x", Math.min(bx, tx).toFixed(1));
      shd.setAttribute("width", Math.max(0, L * PXC).toFixed(1));
      var pl = (3.7 / Math.tan(alt)) * PXC;
      pShd.setAttribute("x", (sg > 0 ? px : px - pl).toFixed(1));
      pShd.setAttribute("width", pl.toFixed(1));
      // 나무 꼭대기를 지나 그림자 끝에 닿는 빛줄기(위 끝은 제목 아래까지)
      var up = (TOPY - 40) / s;
      keyL.setAttribute("x1", (bx - sg * c * up).toFixed(1));
      keyL.setAttribute("y1", "40");
      keyL.setAttribute("x2", tx.toFixed(1));
      keyL.setAttribute("y2", String(GY));
      // 옅은 빛줄기: 그림자 끝 너머에 닿는 평행한 빛(나무 꼭대기 위로 지나간다)
      [50, 100, 150].forEach(function (off, i) {
        var gx = tx + sg * off;
        var up2 = (GY - 40) / s;
        faintL[i].setAttribute("x1", (gx - sg * c * up2).toFixed(1));
        faintL[i].setAttribute("y1", "40");
        faintL[i].setAttribute("x2", gx.toFixed(1));
        faintL[i].setAttribute("y2", String(GY));
      });
      lenL.setAttribute("x1", String(bx));
      lenL.setAttribute("x2", tx.toFixed(1));
      lenA.setAttribute("x1", String(bx));
      lenA.setAttribute("x2", String(bx));
      lenB.setAttribute("x1", tx.toFixed(1));
      lenB.setAttribute("x2", tx.toFixed(1));
      tip.setAttribute("cx", tx.toFixed(1));
      tip.setAttribute("cy", String(GY));
      var r = 34;
      angArc.setAttribute("d", "M " + tx.toFixed(1) + " " + GY + " L " + (tx - sg * r).toFixed(1) + " " + GY + " A " + r + " " + r + " 0 0 " + (sg > 0 ? 1 : 0) + " " + (tx - sg * c * r).toFixed(1) + " " + (GY - s * r).toFixed(1) + " Z");
      dv.setAttribute("aria-label", "나무와 그림자 모형(옆에서 본 모습): " + clockText(st.min) + "에 " + (flip ? "오른쪽(서쪽)" : "왼쪽(동쪽)") + "에서 와서 나무 꼭대기를 지나 그림자 끝에 닿는 햇빛이 땅과 이루는 각(태양 고도)은 " + f1(st.solar) + "도, 그림자 길이는 " + f1(st.shadow) + " 센티미터, 백엽상 속 온도계의 기온은 " + f1(st.temp) + "도예요.");
      var ty = TY0 - (clamp(st.temp, 15, 30) - 15) * TPC;
      liq.setAttribute("y", ty.toFixed(1));
      liq.setAttribute("height", (TY0 + 12 - ty).toFixed(1));
    }
    return {
      setTime: setTime,
      highlight: function () {},
      run: function () {
        return Promise.resolve();
      },
      showInstant: function () {},
      clear: function () {
        goTo(MIN0, 600);
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
        if (drag2) {
          drag2 = null;
          sunDragging = false;
        }
      },
    };
  }

  // 공통 틀에 넘기는 장면: 만든 장면을 curView로 잡아 시간 바와 연결한다
  function wrapView(v) {
    if (!v) return v;
    var wrapped = Object.assign({}, v, {
      dispose: function () {
        if (curView === wrapped) curView = null;
        v.dispose();
      },
    });
    curView = wrapped;
    wrapped.setTime(valuesAt(cur));
    return wrapped;
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div", { class: "intro-body" });
    C.intro.forEach(function (line) {
      box.appendChild(S.rich(line, "p"));
    });
    return box;
  }
  var safety = el("details", { class: "ss-card safety" }, [
    el("summary", { text: "⚠️ 실제로 측정할 때 지켜요" }),
    el(
      "ul",
      null,
      C.safety.map(function (t) {
        return el("li", { text: t });
      })
    ),
  ]);
  var myTable = el("div", { class: "ss-card my-records" });

  /* 측정값 패널(값 4칸 + 📝 기록하기) — 공통 틀에 scenePanel로 넘긴다(크게 보기: 장면 안 막대 / 좁은 화면: 장면 바로 아래 카드).
   * 원래 자리는 측정값 카드(valsCard) 안이다. 출처 줄·남중 안내는 카드에 남아 크게 보기에서도 시간 바 아래에 보인다. */
  function valCell(cls, icon, name) {
    var val = el("strong", { class: "vp-val" });
    var node = el("div", { class: "vp-cell " + cls }, [el("span", { class: "vp-name" }, [el("span", { "aria-hidden": "true", text: icon + " " }), name]), val]);
    return { node: node, val: val };
  }
  var vTime = valCell("vp-time", "🕘", "시각");
  var vSolar = valCell("vp-solar", "📐", "태양 고도");
  var vShadow = valCell("vp-shadow", "▬", "그림자 길이");
  var vTemp = valCell("vp-temp", "🌡", "기온");
  var vp = el("div", { class: "vp", role: "group", "aria-label": "지금 시각의 측정값" }, [vTime.node, vSolar.node, vShadow.node, vTemp.node]);
  var recBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide rec-btn", text: "📝 기록하기" });
  var recMsg = el("p", { class: "ss-help tb-msg", "aria-live": "polite" });
  var scenePanel = el("div", { class: "vals-scene" }, [vp, el("div", { class: "vals-rec" }, [recBtn, recMsg])]);
  var srcLine = el("p", { class: "vp-src" });
  var southNote = el("p", { class: "vp-south", hidden: true, text: C.southNote });
  var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
  var valsCard = el("div", { class: "ss-card ss-step-card vals-card" }, [
    el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: "📏" }), " 측정값 확인하고 기록하기"]),
    scenePanel,
    srcLine,
    southNote,
    live,
  ]);

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: "🔎 측정 방법 알아 두기",
    modelNote: C.modelNote,
    clearLabel: "⏮ 9:30으로",
    clearMessage: "시간 바를 9:30으로 되돌렸어요. 기록은 그대로 남아 있어요.",
    factors: [],
    phases: [
      {
        id: "M",
        name: "측정",
        lead: "하늘의 해를 끌거나 시간 바를 움직여 하루 동안의 변화를 살펴보고, 매시 30분 눈금 7곳에서 값을 기록해요.",
        cells: TIMES.map(function (t) {
          return { time: t.id };
        }),
      },
    ],
    doneLead: "7개 시각을 모두 기록했어요! '다음 단계'로 가서 표와 그래프로 분석해 보세요. 해와 시간 바는 계속 움직여 볼 수 있어요.",
    cellKey: function (sel) {
      return sel.time;
    },
    runLabel: function () {
      return "시간 바의 눈금 버튼을 눌러요";
    },
    view: {
      build3D: function (c, ctx) {
        return build3D(c, ctx).then(wrapView);
      },
      build2D: function (c, ctx) {
        return wrapView(build2D(c, ctx));
      },
      tip3D: "👆 해를 끌면 시각이 바뀌어요 · 빈 곳을 끌면 돌려 보기 · 두 번 탭: 처음 방향",
      tip2D: "2D 화면(모형)이에요. 위는 남쪽 하늘의 태양(끌 수 있어요), 아래는 나무와 그림자를 옆에서 본 모습과 백엽상 속 온도계예요.",
    },
    observe: function () {
      return { question: "", type: "numeric", fields: [] };
    },
    makeRecord: function () {
      return {};
    },
    extras: [myTable, safety],
    scenePanel: scenePanel,
    onChange: lesson.refresh,
  });

  /* ───────── 시간 바(3D 장면 바로 아래) · 측정값 카드 자리 ───────── */
  var bar = (function () {
    var expRoot = $("experiment-root");
    var viewBox = expRoot.querySelector(".ss-exp-view");
    var layoutEl = expRoot.querySelector(".ss-exp-layout");
    var panel = expRoot.querySelector(".ss-exp-panel");
    // 장면 위 표시: 지금 시각, 빨리 감기
    var clock = el("div", { class: "scene-clock", "aria-hidden": "true" });
    var fast = el("div", { class: "scene-fast", "aria-hidden": "true", hidden: true, text: "⏩ 빨리 감기(모형)" });
    viewBox.appendChild(clock);
    viewBox.appendChild(fast);

    var fill = el("div", { class: "tb-fill" });
    var thumb = el("div", { class: "tb-thumb", "aria-hidden": "true" });
    var railTicks = el("div", { class: "tb-rail-ticks", "aria-hidden": "true" });
    var NH = Math.round((MIN1 - MIN0) / 30); // 30분 간격 작은 눈금(매시 30분이 큰 눈금)
    for (var h = 0; h <= NH; h++) railTicks.appendChild(el("span", { class: "tb-rt" + (h % 2 === 0 ? " is-big" : "") }));
    var railTicksKids = railTicks.children;
    for (var k = 0; k < railTicksKids.length; k++) railTicksKids[k].style.left = (100 * k) / NH + "%";
    var rail = el("div", { class: "tb-rail" }, [fill, railTicks, thumb]);
    var track = el("div", {
      class: "tb-track",
      role: "slider",
      tabindex: "0",
      "aria-label": "측정 시각 바꾸기(시간 바)",
      "aria-valuemin": String(MIN0),
      "aria-valuemax": String(MIN1),
      "aria-orientation": "horizontal",
    }, [rail]);
    var tickRow = el("div", { class: "tb-ticks", role: "group", "aria-label": "매시 30분 눈금(누르면 그 시각으로 빨리 감기)" });
    var tickBtns = {};
    TIMES.forEach(function (t, i) {
      var b = el("button", { type: "button", class: "tb-tick", onclick: function () {
        goTo(t.min, 1000);
      } }, [el("span", { class: "tb-tick-t", text: t.label }), el("span", { class: "tb-tick-ok", "aria-hidden": "true", text: "✓" })]);
      b.style.left = "calc(22px + (100% - 44px) * " + i / (TIMES.length - 1) + ")";
      tickBtns[t.id] = b;
      tickRow.appendChild(b);
    });

    var box = el("div", { class: "ss-card tb-card" }, [track, tickRow]);
    viewBox.parentNode.insertBefore(box, viewBox.nextSibling);
    /* 측정값 카드 자리(기본 화면): 가로 좌우 배치면 오른쪽 패널 맨 위, 그 밖(세로·좁은 화면·크게 보기)은 시간 바 바로 아래.
       카드 안의 scenePanel은 공통 틀이 크게 보기에서 막대로 옮기고 되돌린다 — 앱은 카드만 옮긴다(scenePanel 노드는 건드리지 않음). */
    var twoColMq = window.matchMedia ? window.matchMedia("(min-width: 901px) and (orientation: landscape)") : null;
    function placeVals() {
      var twoCol = !!(twoColMq && twoColMq.matches) && !layoutEl.classList.contains("is-full");
      if (twoCol) {
        if (panel.firstChild !== valsCard) panel.insertBefore(valsCard, panel.firstChild);
      } else if (box.nextSibling !== valsCard) box.parentNode.insertBefore(valsCard, box.nextSibling);
      valsCard.classList.toggle("is-away", scenePanel.parentNode !== valsCard);
    }
    placeVals();
    if (twoColMq) {
      if (twoColMq.addEventListener) twoColMq.addEventListener("change", placeVals);
      else if (twoColMq.addListener) twoColMq.addListener(placeVals);
    }
    // 크게 보기를 켜고 끄거나(레이아웃 .is-full) 공통 틀이 scenePanel을 옮기면(카드 안 자식 바뀜) 카드 자리·모양을 다시 맞춘다
    if ("MutationObserver" in window) {
      var mo = new MutationObserver(placeVals);
      mo.observe(layoutEl, { attributes: true, attributeFilter: ["class"] });
      mo.observe(valsCard, { childList: true });
    }

    // 끌기(터치·마우스): 레일 기준 위치 → 분
    var dragging = false;
    function minFromX(clientX) {
      var r = rail.getBoundingClientRect();
      var f = r.width > 0 ? (clientX - r.left) / r.width : 0;
      return MIN0 + clamp(f, 0, 1) * (MIN1 - MIN0);
    }
    track.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      try {
        track.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 무시 */
      }
      track.classList.add("is-drag");
      setMinute(minFromX(e.clientX));
      e.preventDefault();
    });
    track.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      setMinute(minFromX(e.clientX));
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-drag");
      snapToTick(); // 매시 30분 눈금 가까이(±3분)에서 놓으면 눈금에 맞춘다
    }
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("lostpointercapture", endDrag);
    track.addEventListener("keydown", function (e) {
      var r = Math.round(cur);
      var to = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = r - 1;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = r + 1;
      else if (e.key === "Home") to = MIN0;
      else if (e.key === "End") to = MIN1;
      else if (e.key === "PageUp") {
        to = TIMES.filter(function (t) {
          return t.min > r;
        }).map(function (t) {
          return t.min;
        })[0];
        if (to == null) to = MIN1;
      } else if (e.key === "PageDown") {
        var before = TIMES.filter(function (t) {
          return t.min < r;
        });
        to = before.length ? before[before.length - 1].min : MIN0;
      }
      if (to == null) return;
      e.preventDefault();
      setMinute(to);
    });

    function nextTodo() {
      return TIMES.filter(function (t) {
        return !recOf(t.id);
      })[0] || null;
    }
    recBtn.addEventListener("click", function () {
      var st = valuesAt(cur);
      if (tweening || !st.tick) return;
      var t = st.tick;
      var r = C.results[t.id];
      var before = exp.allDone();
      var res = records.upsert({ time: t.id, label: t.label, solar: r.solar, shadow: r.shadow, temp: r.temp });
      exp.refresh();
      drawRecords();
      var vals = f1(r.solar) + "° · " + f1(r.shadow) + " cm · " + f1(r.temp) + " °C";
      // 알림은 태블릿에서 한 줄이 되게 짧게(머리말 위에 떠서 장면을 가리지 않게) — 측정값만 말한다
      if (!before && exp.allDone()) toast("🎉 7개 시각을 모두 기록했어요! '다음 단계'로 가요.", 3800);
      else toast((res.replaced ? "🔁 " + t.label + " 다시 기록: " : "📝 " + t.label + " 기록: ") + vals, 3000);
      lesson.refresh();
      draw(st);
    });

    var lastKey = "";
    function draw(st) {
      var pct = ((st.min - MIN0) / (MIN1 - MIN0)) * 100;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      var tk = st.tick;
      var clk = clockText(st.min);
      vTime.val.textContent = clk;
      vSolar.val.textContent = f1(st.solar) + "°";
      vShadow.val.textContent = f1(st.shadow) + " cm";
      vTemp.val.textContent = f1(st.temp) + " °C";
      clock.textContent = "🕘 " + clk;
      track.setAttribute("aria-valuenow", String(Math.round(st.min)));
      track.setAttribute(
        "aria-valuetext",
        clockSpeech(st.min) + ", 태양 고도 " + f1(st.solar) + "도, 그림자 길이 " + f1(st.shadow) + " 센티미터, 기온 " + f1(st.temp) + "도" + (tk ? "" : ", 눈금 사이(살펴보기)")
      );
      var key = [Math.round(st.min), tweening, records.list().length].join("|");
      if (key === lastKey) return;
      lastKey = key;
      // 출처 표시
      vp.classList.toggle("is-model", !tk);
      srcLine.textContent = tk
        ? "📘 교과서·실험관찰 예시 값(2023년 9월 23일 서울 관측 자료)이에요."
        : "🏷 모형: 눈금 사이 값은 살펴보기만 해요(기록하지 않아요).";
      southNote.hidden = !(tk && tk.south && !tweening);
      // 눈금 버튼
      var todo = nextTodo();
      TIMES.forEach(function (t) {
        var b = tickBtns[t.id];
        var done = !!recOf(t.id);
        var at = !!(tk && tk.id === t.id);
        b.classList.toggle("is-rec", done);
        b.classList.toggle("is-at", at);
        b.classList.toggle("is-next", !done && !!todo && todo.id === t.id && !at);
        if (at) b.setAttribute("aria-current", "true");
        else b.removeAttribute("aria-current");
        b.setAttribute("aria-label", t.label + "으로 빨리 감기" + (done ? ", 기록함" : ", 아직 기록 안 함"));
      });
      // 기록하기
      if (tweening) {
        recBtn.disabled = true;
        recBtn.textContent = "⏩ 빨리 감는 중…";
        recMsg.textContent = "";
      } else if (tk) {
        var done2 = !!recOf(tk.id);
        recBtn.disabled = false;
        recBtn.textContent = done2 ? "🔁 " + tk.label + " 다시 기록하기" : "📝 " + tk.label + " 측정값 기록하기";
        recMsg.textContent = done2 ? "✅ " + tk.label + "은 기록했어요." + (todo ? " 다음: " + todo.label + " 눈금을 눌러요." : "") : "값을 확인하고 기록하기를 눌러요.";
      } else {
        recBtn.disabled = true;
        recBtn.textContent = "📝 기록은 매시 30분 눈금에서";
        recMsg.textContent = "눈금 사이 시각은 살펴보기만 해요. 눈금 버튼(9:30~15:30)이나 하늘의 시각 점을 누르면 기록할 수 있어요." + (todo ? " 다음: " + todo.label : "");
      }
      if (!tweening && tk) live.textContent = tk.label + ": 태양 고도 " + f1(st.solar) + "도, 그림자 길이 " + f1(st.shadow) + " 센티미터, 기온 " + f1(st.temp) + "도";
    }
    return {
      draw: draw,
      setFast: function (on) {
        fast.hidden = !on;
        lastKey = "";
      },
    };
  })();

  // 실험 패널의 '내 기록' 작은 표
  function drawRecords() {
    myTable.textContent = "";
    myTable.appendChild(el("h3", { class: "ss-step-h", text: "📋 내 기록 (" + records.list().length + "/" + TIMES.length + ")" }));
    var holder = el("div");
    myTable.appendChild(holder);
    S.TableChart.renderTable(holder, {
      caption: "측정 시각별 기록",
      columns: [
        { id: "time", label: "시각" },
        { id: "solar", label: "태양 고도", unit: "°", digits: 1 },
        { id: "shadow", label: "그림자 길이", unit: "cm", digits: 1 },
        { id: "temp", label: "기온", unit: "°C", digits: 1 },
      ],
      rows: TIMES.map(function (t) {
        var r = recOf(t.id);
        return { time: t.label, solar: r ? r.solar : null, shadow: r ? r.shadow : null, temp: r ? r.temp : null };
      }),
    });
  }
  drawRecords();
  drawNow();

  /* ───────── 3. 기록·분석하기 ───────── */
  function drawResults() {
    S.TableChart.renderTable($("result-table"), {
      caption: "내 기록 표 (하루 동안의 태양 고도, 그림자 길이, 기온)",
      columns: [
        { id: "time", label: "측정 시각" },
        { id: "solar", label: "태양 고도", unit: "°", digits: 1 },
        { id: "shadow", label: "그림자 길이", unit: "cm", digits: 1 },
        { id: "temp", label: "기온", unit: "°C", digits: 1 },
      ],
      rows: TIMES.map(function (t) {
        var r = recOf(t.id);
        return { time: t.label, solar: r ? r.solar : null, shadow: r ? r.shadow : null, temp: r ? r.temp : null };
      }),
    });
    $("result-table").appendChild(el("p", { class: "ss-help", text: "모든 값은 교과서·실험관찰 예시 값(2023년 9월 23일 서울 관측 자료)이에요." }));
    ["solar", "shadow", "temp"].forEach(function (k) {
      renderChart(k);
    });
  }
  function renderChart(k) {
    {
      S.TableChart.renderLine(
        $("chart-" + k),
        Object.assign({}, C.chart[k], {
          data: TIMES.map(function (t) {
            var r = recOf(t.id);
            return { label: t.label, value: r ? r[k] : null };
          }),
        })
      );
    }
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function recordRows() {
    return TIMES.map(function (t) {
      return recOf(t.id);
    }).filter(Boolean);
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
      records: rows.map(function (r) {
        return { time: r.label, solar: r.solar, shadow: r.shadow, temp: r.temp };
      }),
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
            question: "측정 시각별 태양 고도·그림자 길이·기온",
            kind: "table",
            answer: {
              columns: [
                { key: "time", label: "측정 시각" },
                { key: "solar", label: "태양 고도(°)" },
                { key: "shadow", label: "그림자 길이(cm)" },
                { key: "temp", label: "기온(°C)" },
              ],
              rows: rows.map(function (r) {
                return { time: r.label, solar: f1(r.solar), shadow: f1(r.shadow), temp: f1(r.temp) };
              }),
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        [{ stage: "curiosity", id: "curiosity", label: "궁금한 점(선택)", question: C.curiosity.prompt, kind: "text", answer: curiosityText.trim() }]
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
      return ["내 기록: " + recordRows().length + "/" + TIMES.length + "개 시각", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "매시 30분 눈금 7곳(9:30~15:30)의 값을 모두 기록해야 넘어갈 수 있어요. (지금 " + exp.progress().done + "/" + TIMES.length + ")";
      },
      conclude: function () {
        if (!exp.allDone()) return "먼저 실험하기에서 7개 시각을 모두 기록해 주세요.";
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
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: function () {
        exp.activate();
        drawRecords();
        requestDraw();
      },
      analyze: drawResults,
    },
  });
})();
