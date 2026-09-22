/*
 * app.js — sci-6-2-1-2 "하루 동안 태양 고도, 그림자 길이, 기온의 관계는?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 화면 틀(3D/2D 전환)·기록 저장·진행 상황 DB 저장을 맡고, 이 파일은
 *   ① 3D/2D 장면: 태양 고도 측정기(막대기 10 cm·자·각도기·실), 그늘의 온도계, 하늘의 태양과 하루 경로
 *   ② 시간 바(앱 전용 UI): 9:30~15:30, 1분 단위 슬라이더 + 매시 30분 눈금 버튼 7개 + 값 패널 + 📝 기록하기
 *   ③ 분석 표·꺾은선그래프 3개, 내 기록으로 답하는 보기 고르기 2개, 결론 1개, 궁금한 점 한 줄(선택)   만 만든다.
 *
 * spec.md "개정 1"(우선):
 *  - 기록은 매시 30분 눈금 7곳에서만(필수 7칸, 개정 2: 8:30 삭제). 값은 data/lesson-config.js의 results(교과서·실험관찰 예시 값)만 기록한다.
 *  - 눈금 사이는 살펴보기 전용 모형 값: 태양 고도(data/sun-table.js), 그림자 길이 = 10 ÷ tan(태양 고도) + 보정(눈금에서 표와 같게),
 *    기온 = 8점 단조 3차 보간(PCHIP, 14:30 최고값 27.0 °C를 넘지 않음).
 *  - 눈금 버튼 → 약 1초 빨리 감기(모형). 학생은 값을 타이핑하지 않는다. 모든 수치는 소수 첫째 자리.
 *
 * 공통 틀과의 연결: Experiment.create에 조건(factors) 없이 단계 1개(8칸)를 넘기고, 공통 틀의 실행·관찰 카드는 쓰지 않는다
 * (style.css에서 실행 카드를 숨김). 기록은 이 파일의 📝 기록하기가 records.upsert로 직접 하고 exp.refresh()로 진행률을 갱신한다.
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
  // 기온: 8점 단조 3차 보간(Fritsch–Carlson PCHIP)
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
  // 그 시각의 값(눈금이면 표 값 그대로)
  function valuesAt(min) {
    var tk = tickAt(min);
    if (tk) {
      var r = C.results[tk.id];
      return { min: tk.min, tick: tk, solar: r.solar, shadow: r.shadow, temp: r.temp, az: azAt(tk.min) };
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

  /* 궁금한 점: 선택 입력 한 줄(비워도 마칠 수 있음). 저장 키 "curiosity" */
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

  /* ───────── 지금 시각 · 화면 갱신(requestAnimationFrame으로 묶기) ───────── */
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

  /* ───────── 동적 글자 라벨(3D, 캔버스 하나를 다시 그려 재사용) ───────── */
  function dynLabel(T, o) {
    var W = 720;
    var H = 150;
    var cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    var g = cv.getContext("2d");
    var tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.renderOrder = 20;
    var h = o.height || 3;
    sp.scale.set((h * W) / H, h, 1);
    var last = null;
    function set(text) {
      if (text === last) return;
      last = text;
      g.clearRect(0, 0, W, H);
      g.font = "700 64px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      var tw2 = Math.min(W - 16, g.measureText(text).width + 44);
      var x = (W - tw2) / 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, 12, tw2, H - 24, 30);
      else g.rect(x, 12, tw2, H - 24);
      g.fillStyle = "rgba(255,255,255,0.94)";
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = o.border || "#1f2733";
      g.stroke();
      g.fillStyle = o.color || "#1f2733";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, W / 2, H / 2 + 3, W - 40);
      tex.needsUpdate = true;
    }
    return { sprite: sp, set: set };
  }

  // 그래프 색(실험관찰 11쪽): 태양 고도 빨강, 그림자 길이 초록, 기온 파랑
  var COL = { solar: "#d8434f", shadow: "#2f8a3a", temp: "#3b6fd1" };

  /* ───────── 3D 장면 ─────────
   * 1 단위 = 1 cm(측정기 기준). 땅 y = 0, 받침판 윗면 y = 1. 북 = +z, 남 = −z, 동 = −x, 서 = +x
   * (처음 시점은 북쪽 위에서 남쪽 하늘을 바라본다 → 화면 왼쪽이 동쪽, 오른쪽이 서쪽).
   * 태양·경로는 반지름 SKY_R의 하늘(모형) 위에 그린다. 실제 거리·크기와 다르다. */
  var SKY_R = 34;
  function sunDir(T, azDeg, altDeg) {
    var a = azDeg * RAD;
    var h = altDeg * RAD;
    return new T.Vector3(-Math.sin(a) * Math.cos(h), Math.sin(h), Math.cos(a) * Math.cos(h));
  }
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 84, depth: 76, center: [0, 12, 1] },
      viewDir: [-0.22, 0.7, 0.68],
      minDistance: 12,
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var root = v.root;
      var disposed = false;

      // 햇빛 방향 조명(태양을 따라 움직인다)
      var sunLight = null;
      v.scene.children.forEach(function (o) {
        if (o.isDirectionalLight) sunLight = o;
      });

      // 땅(운동장)
      var groundMat = M.material(0xcdb98f, { roughness: 0.95 });
      var ground = new T.Mesh(new T.CylinderGeometry(52, 52, 0.6, 64), groundMat);
      ground.position.y = -0.3;
      root.add(ground);
      v.onThemeChange(function (dark) {
        groundMat.color.set(dark ? 0x7a6d52 : 0xcdb98f);
      });
      // 방위(땅 위 글자)
      [
        ["동", -47, 0],
        ["서", 47, 0],
        ["남", 0, -47],
        ["북", 0, 47],
      ].forEach(function (d) {
        var lb = M.label(d[0], { height: 3.4, bold: true, bg: "rgba(255,255,255,0.9)", border: "#5b6676" });
        lb.position.set(d[1], 2.2, d[2]);
        root.add(lb);
      });

      // ── 태양 고도 측정기(그림자가 자와 나란하도록 돌려 놓는다) ──
      var dev = new T.Group();
      root.add(dev);
      var board = new T.Mesh(new T.BoxGeometry(32, 1, 9), M.material(0xe6cfa0, { roughness: 0.8 }));
      board.position.set(11.5, 0.5, 0);
      dev.add(board);
      // 자(0~25 cm, 1 cm 눈금·5 cm 숫자) — 그림자 바로 옆
      var PX = 40;
      var rcv = document.createElement("canvas");
      rcv.width = 27 * PX;
      rcv.height = 128;
      var rg = rcv.getContext("2d");
      rg.fillStyle = "#fff6cf";
      rg.fillRect(0, 0, rcv.width, rcv.height);
      rg.fillStyle = "#1f2733";
      rg.textAlign = "center";
      rg.font = "700 40px system-ui, sans-serif";
      for (var mm = 0; mm <= 250; mm++) {
        var px = (1 + mm / 10) * PX;
        var hh = mm % 50 === 0 ? 62 : mm % 10 === 0 ? 44 : mm % 5 === 0 ? 28 : 16;
        rg.fillRect(px - (mm % 10 === 0 ? 2 : 1), 0, mm % 10 === 0 ? 4 : 2, hh);
        if (mm % 50 === 0) rg.fillText(String(mm / 10), px, 110);
      }
      var rtex = new T.CanvasTexture(rcv);
      rtex.colorSpace = T.SRGBColorSpace;
      rtex.anisotropy = 8;
      var ruler = new T.Mesh(new T.PlaneGeometry(27, 3.2), new T.MeshStandardMaterial({ map: rtex, roughness: 0.6 }));
      ruler.rotation.x = -Math.PI / 2;
      ruler.position.set(12.5, 1.02, 2.3); // 자의 0 눈금 = 막대기 뿌리(x = 0), 위쪽 가장자리가 그림자 쪽
      dev.add(ruler);
      var rulerLbl = M.label("자(cm)", { height: 1.8 });
      rulerLbl.position.set(26, 2.4, 4.6);
      dev.add(rulerLbl);
      // 막대기(10 cm)
      var stick = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, C.stickCm, 16), M.material(0x8b5a2b));
      stick.position.set(0, 1 + C.stickCm / 2, 0);
      dev.add(stick);
      var stickLbl = M.label("막대기 10 cm", { height: 1.9 });
      stickLbl.position.set(-2.5, 12.8, 0);
      dev.add(stickLbl);
      // 그림자(받침판 위, 길이만 바뀐다)
      var shadowMat = new T.MeshBasicMaterial({ color: 0x2b2b2b, transparent: true, opacity: 0.78, depthWrite: false });
      var shadow = new T.Mesh(new T.PlaneGeometry(1, 0.9), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 1.03;
      dev.add(shadow);
      // 그림자 끝 표시(초록)
      var tipMark = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 3), M.material(0x2f8a3a));
      tipMark.rotation.x = Math.PI; // 아래를 가리킨다
      dev.add(tipMark);
      // 실(막대기 끝 → 그림자 끝)
      var thread = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 1, 8), M.material(0x3a3f4a));
      dev.add(thread);
      // 각도기(그림자 끝에 중심, 막대기 쪽이 0°)
      var PR = 6;
      // 앞면·뒷면 두 장: 어느 쪽에서 보아도 숫자가 뒤집혀 보이지 않고 0°가 막대기 쪽에 오게 한다
      function protTexture(mirror) {
        var pcv = document.createElement("canvas");
        pcv.width = 512;
        pcv.height = 512;
        var pg = pcv.getContext("2d");
        var pc = 256;
        var prr = 250;
        var sx = mirror ? 1 : -1; // 0° 쪽: 앞면은 왼쪽, 뒷면은 오른쪽
        pg.beginPath();
        pg.arc(pc, pc, prr, Math.PI, 2 * Math.PI);
        pg.closePath();
        pg.fillStyle = "rgba(235,245,255,0.8)";
        pg.fill();
        pg.lineWidth = 5;
        pg.strokeStyle = "#1f2733";
        pg.stroke();
        pg.fillStyle = "#1f2733";
        pg.strokeStyle = "#1f2733";
        pg.textAlign = "center";
        pg.textBaseline = "middle";
        pg.font = "700 30px system-ui, sans-serif";
        for (var dg = 0; dg <= 180; dg++) {
          var th = dg * RAD;
          var len = dg % 10 === 0 ? 34 : dg % 5 === 0 ? 22 : 12;
          pg.lineWidth = dg % 10 === 0 ? 3 : 1.5;
          pg.beginPath();
          pg.moveTo(pc + sx * Math.cos(th) * prr, pc - Math.sin(th) * prr);
          pg.lineTo(pc + sx * Math.cos(th) * (prr - len), pc - Math.sin(th) * (prr - len));
          pg.stroke();
          if (dg % 30 === 0 && dg > 0 && dg < 180) pg.fillText(String(dg), pc + sx * Math.cos(th) * (prr - 62), pc - Math.sin(th) * (prr - 62));
        }
        var tex = new T.CanvasTexture(pcv);
        tex.colorSpace = T.SRGBColorSpace;
        return tex;
      }
      var prot = new T.Group();
      var protGeo = new T.CircleGeometry(PR, 64, 0, Math.PI);
      var protFront = new T.Mesh(protGeo, new T.MeshBasicMaterial({ map: protTexture(false), transparent: true, side: T.FrontSide, depthWrite: false }));
      var protBack = new T.Mesh(protGeo, new T.MeshBasicMaterial({ map: protTexture(true), transparent: true, side: T.FrontSide, depthWrite: false }));
      protBack.rotation.y = Math.PI;
      prot.add(protFront, protBack);
      dev.add(prot);
      // 각(그림자와 실 사이) 표시 — 빨강
      var arcMat = new T.MeshBasicMaterial({ color: 0xd8434f, transparent: true, opacity: 0.75, side: T.DoubleSide, depthWrite: false });
      var arc = new T.Mesh(new T.RingGeometry(1.4, 2.6, 32, 1, Math.PI - 0.5, 0.5), arcMat);
      dev.add(arc);
      var arcAlt = null;

      // 값 라벨(색 + 글자)
      var lblSolar = dynLabel(T, { height: 3.3, border: COL.solar, color: "#9e1f2b" });
      var lblShadow = dynLabel(T, { height: 3.3, border: COL.shadow, color: "#1d5e27" });
      var lblTemp = dynLabel(T, { height: 3.3, border: COL.temp, color: "#1f4a9e" });
      root.add(lblSolar.sprite, lblShadow.sprite, lblTemp.sprite);

      // ── 그늘의 온도계(모형: 실제로는 지표면에서 1.5 m 높이) ──
      var TH = { x: 33, z: -2, y0: 4, h: 16, tMin: 15, tMax: 30 };
      var thermo = new T.Group();
      thermo.position.set(TH.x, 0, TH.z);
      root.add(thermo);
      var stand = new T.Mesh(new T.BoxGeometry(6, 0.6, 4), M.material(0x5b6676));
      stand.position.y = 0.3;
      thermo.add(stand);
      var post = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, TH.y0 + TH.h + 2, 8), M.material(0x5b6676));
      post.position.set(-3.6, (TH.y0 + TH.h + 2) / 2, -0.6);
      thermo.add(post);
      // 눈금판
      var tcv = document.createElement("canvas");
      tcv.width = 256;
      tcv.height = 1024;
      var tg = tcv.getContext("2d");
      tg.fillStyle = "#ffffff";
      tg.fillRect(0, 0, 256, 1024);
      tg.fillStyle = "#1f2733";
      tg.font = "700 52px system-ui, sans-serif";
      tg.textAlign = "right";
      tg.textBaseline = "middle";
      var TPX = 1024 / (TH.tMax - TH.tMin + 2);
      function tY(t) {
        return 1024 - (t - TH.tMin + 1) * TPX;
      }
      for (var tt = TH.tMin * 2; tt <= TH.tMax * 2; tt++) {
        var tv = tt / 2;
        var whole = tt % 2 === 0;
        tg.fillRect(whole ? 150 : 170, tY(tv) - (whole ? 3 : 1.5), whole ? 60 : 40, whole ? 6 : 3);
        if (whole && tv % 5 === 0) tg.fillText(String(tv), 140, tY(tv));
      }
      tg.textAlign = "center";
      tg.font = "700 44px system-ui, sans-serif";
      tg.fillText("°C", 90, 40);
      var ttex = new T.CanvasTexture(tcv);
      ttex.colorSpace = T.SRGBColorSpace;
      var boardH = TH.h + 2 * (TH.h / (TH.tMax - TH.tMin));
      var tBoard = new T.Mesh(new T.PlaneGeometry(5, boardH), new T.MeshBasicMaterial({ map: ttex }));
      tBoard.position.set(-0.6, TH.y0 + boardH / 2 - TH.h / (TH.tMax - TH.tMin), 0);
      thermo.add(tBoard);
      function thermoY(t) {
        return TH.y0 + ((t - TH.tMin) / (TH.tMax - TH.tMin)) * TH.h;
      }
      var tube = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, TH.h + 3, 12), M.material(0xffffff, { transparent: true, opacity: 0.45, roughness: 0.1 }));
      tube.position.set(1.4, TH.y0 + (TH.h + 3) / 2 - 1.5, 0.3);
      thermo.add(tube);
      var bulb = new T.Mesh(new T.SphereGeometry(0.9, 16, 12), M.material(0xd8434f));
      bulb.position.set(1.4, TH.y0 - 1.8, 0.3);
      thermo.add(bulb);
      var liquid = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 1, 10), M.material(0xd8434f));
      thermo.add(liquid);
      // 햇빛 가리개(남·동·서쪽 판 + 지붕, 북쪽만 열림): 태양은 이 시각 내내 남동~남서 하늘에 있으므로 안쪽 온도계는 그늘이다
      var shadeWall = new T.Mesh(new T.BoxGeometry(12, TH.y0 + TH.h + 8, 0.6), M.material(0x3f7f5f));
      shadeWall.position.set(0, (TH.y0 + TH.h + 8) / 2, -4.2);
      thermo.add(shadeWall);
      var shadeRoof = new T.Mesh(new T.BoxGeometry(12, 0.5, 6), M.material(0x3f7f5f));
      shadeRoof.position.set(0, TH.y0 + TH.h + 8, -1.4);
      thermo.add(shadeRoof);
      [-6.2, 6.2].forEach(function (x) {
        var side = new T.Mesh(new T.BoxGeometry(0.5, TH.y0 + TH.h + 8, 6), M.material(0x3f7f5f));
        side.position.set(x, (TH.y0 + TH.h + 8) / 2, -1.4);
        thermo.add(side);
      });
      var shadePatch = new T.Mesh(new T.PlaneGeometry(12, 9), new T.MeshBasicMaterial({ color: 0x2b2b2b, transparent: true, opacity: 0.35, depthWrite: false }));
      shadePatch.rotation.x = -Math.PI / 2;
      shadePatch.position.set(0, 0.04, 0.4);
      thermo.add(shadePatch);
      var thermoLbl = M.label("그늘에 둔 온도계\n(실제는 땅에서 1.5 m 높이)", { height: 3 });
      thermoLbl.position.set(0, 2.2, 6.6);
      thermo.add(thermoLbl);

      // ── 하늘: 태양, 하루 경로(점선), 매시 30분 점, 햇빛 ──
      var pathPts = [];
      for (var m = MIN0; m <= MIN1; m += 5) {
        pathPts.push(sunDir(T, SUN.az[m - MIN0], SUN.alt[m - MIN0]).multiplyScalar(SKY_R));
      }
      var pathLine = new T.Line(new T.BufferGeometry().setFromPoints(pathPts), new T.LineDashedMaterial({ color: 0xe0901a, dashSize: 1.4, gapSize: 1 }));
      pathLine.computeLineDistances();
      root.add(pathLine);
      TIMES.forEach(function (t) {
        var p = sunDir(T, SUN.az[t.min - MIN0], SUN.alt[t.min - MIN0]).multiplyScalar(SKY_R);
        var dot = new T.Mesh(new T.SphereGeometry(0.55, 10, 8), M.material(0xe0901a));
        dot.position.copy(p);
        root.add(dot);
        var tl = M.label(t.label, { height: 1.9, bg: "rgba(255,248,225,0.92)" });
        tl.position.copy(p).add(new T.Vector3(0, -2.4, 0));
        root.add(tl);
      });
      var sunMesh = new T.Mesh(new T.SphereGeometry(2.6, 24, 16), new T.MeshBasicMaterial({ color: 0xffc928 }));
      root.add(sunMesh);
      var gcv = document.createElement("canvas");
      gcv.width = 128;
      gcv.height = 128;
      var gg = gcv.getContext("2d");
      var grad = gg.createRadialGradient(64, 64, 8, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,220,90,0.9)");
      grad.addColorStop(1, "rgba(255,220,90,0)");
      gg.fillStyle = grad;
      gg.fillRect(0, 0, 128, 128);
      var glowTex = new T.CanvasTexture(gcv);
      var glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
      glow.scale.set(13, 13, 1);
      root.add(glow);
      var sunLbl = M.label("태양", { height: 2.2, bg: "rgba(255,244,200,0.95)", border: "#e0a000" });
      root.add(sunLbl);
      // 햇빛(막대기 끝을 지나 그림자 끝에 닿는 빛 — 실과 같은 방향)
      var rayMat = new T.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.55, depthWrite: false });
      var ray = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 1, 8), rayMat);
      root.add(ray);

      var UP = new T.Vector3(0, 1, 0);
      function stretch(mesh, a, b) {
        var d = b.clone().sub(a);
        var len = d.length() || 0.001;
        mesh.position.copy(a).addScaledVector(d, 0.5);
        mesh.quaternion.setFromUnitVectors(UP, d.normalize());
        mesh.scale.set(1, len, 1);
      }

      var tmpA = new T.Vector3();
      var tmpB = new T.Vector3();
      function setTime(st) {
        if (disposed) return;
        var L = st.shadow;
        var alt = st.solar;
        var az = st.az;
        // 측정기 방향: 받침판의 +x(자)가 그림자 방향(태양 반대쪽)을 향한다
        var a = az * RAD;
        dev.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
        shadow.scale.x = L;
        shadow.position.x = L / 2;
        tipMark.position.set(L, 2.1, 0.6);
        stretch(thread, tmpA.set(0, 1 + C.stickCm, 0), tmpB.set(L, 1, 0));
        prot.position.set(L, 1.02, -0.25);
        arc.position.set(L, 1.02, -0.2);
        if (arcAlt !== alt) {
          arcAlt = alt;
          arc.geometry.dispose();
          arc.geometry = new T.RingGeometry(1.4, 2.8, 32, 1, Math.PI - alt * RAD, alt * RAD);
        }
        // 라벨
        dev.updateMatrixWorld(true);
        lblSolar.set("태양 고도 " + f1(alt) + "°");
        lblSolar.sprite.position.copy(dev.localToWorld(tmpA.set(L + 1, 1 + PR + 3.2, 0)));
        lblShadow.set("그림자 길이 " + f1(L) + " cm");
        lblShadow.sprite.position.copy(dev.localToWorld(tmpA.set(L / 2 + 2, 3.2, 6.4)));
        lblTemp.set("기온 " + f1(st.temp) + " °C");
        lblTemp.sprite.position.set(TH.x, TH.y0 + TH.h + 5, TH.z);
        // 온도계 액주
        var top = thermoY(clamp(st.temp, TH.tMin, TH.tMax));
        var bottom = TH.y0 - 1.8;
        liquid.scale.y = top - bottom;
        liquid.position.set(1.4, (top + bottom) / 2, 0.3);
        // 태양·햇빛
        var dir = sunDir(T, az, alt);
        sunMesh.position.copy(dir).multiplyScalar(SKY_R);
        glow.position.copy(sunMesh.position);
        sunLbl.position.copy(sunMesh.position).add(new T.Vector3(0, 4.4, 0));
        if (sunLight) sunLight.position.copy(dir).multiplyScalar(30);
        var tipW = dev.localToWorld(tmpB.set(L, 1, 0)).clone();
        var from = new T.Vector3(0, 1 + C.stickCm, 0).addScaledVector(dir, 26);
        stretch(ray, from, tipW);
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
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2D 장면(SVG): 하늘(남쪽을 바라본 모습) + 측정기 옆모습 + 온도계 ───────── */
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
    var pts = [];
    for (var m = MIN0; m <= MIN1; m += 5) pts.push(SX(SUN.az[m - MIN0]).toFixed(1) + "," + SY(SUN.alt[m - MIN0]).toFixed(1));
    sky.appendChild(svg("polyline", { points: pts.join(" "), class: "d2-path" }));
    TIMES.forEach(function (t, i) {
      var x = SX(SUN.az[t.min - MIN0]);
      var y = SY(SUN.alt[t.min - MIN0]);
      sky.appendChild(svg("circle", { cx: x, cy: y, r: 4, class: "d2-pathdot" }));
      sky.appendChild(svg("text", { x: x, y: y + (i % 2 ? 24 : -12), "text-anchor": "middle", class: "d2-small" }, t.label));
    });
    var sunG = svg("g", { class: "d2-sun" });
    sunG.appendChild(svg("circle", { cx: 0, cy: 0, r: 15 }));
    sky.appendChild(sunG);

    // 측정기 옆모습 + 온도계
    var PXC = 16; // 1 cm
    var BX = 150; // 막대기 뿌리
    var BY = 280; // 받침판 윗면
    var dv = svg("svg", { viewBox: "0 0 710 360", class: "d2-svg d2-dev", role: "img" });
    dv.appendChild(svg("rect", { x: 0, y: 0, width: 700, height: 360, rx: 14, class: "d2-devbg" }));
    dv.appendChild(svg("text", { x: 16, y: 30, class: "d2-title" }, "태양 고도 측정기 (옆에서 본 모습 · 모형)"));
    dv.appendChild(svg("rect", { x: BX - 30, y: BY, width: 26 * PXC + 50, height: 12, class: "d2-board" }));
    // 자
    dv.appendChild(svg("rect", { x: BX - 6, y: BY + 12, width: 25 * PXC + 12, height: 34, class: "d2-ruler" }));
    for (var mm = 0; mm <= 250; mm += 5) {
      var x0 = BX + (mm / 10) * PXC;
      var big = mm % 50 === 0;
      var mid = mm % 10 === 0;
      dv.appendChild(svg("line", { x1: x0, x2: x0, y1: BY + 12, y2: BY + 12 + (big ? 16 : mid ? 11 : 6), class: "d2-tick" }));
      if (big) dv.appendChild(svg("text", { x: x0, y: BY + 42, "text-anchor": "middle", class: "d2-num" }, String(mm / 10)));
    }
    dv.appendChild(svg("text", { x: BX + 25 * PXC + 12, y: BY + 42, class: "d2-num" }, "(cm)"));
    // 햇빛(막대기 끝을 지나는 빛)
    var rayL = svg("line", { class: "d2-ray" });
    dv.appendChild(rayL);
    // 그림자
    var shd = svg("rect", { x: BX, y: BY - 6, height: 6, class: "d2-shadow" });
    dv.appendChild(shd);
    // 막대기
    dv.appendChild(svg("rect", { x: BX - 5, y: BY - C.stickCm * PXC, width: 10, height: C.stickCm * PXC, rx: 3, class: "d2-stick" }));
    dv.appendChild(svg("text", { x: BX - 12, y: BY - C.stickCm * PXC + 18, "text-anchor": "end", class: "d2-small" }, "막대기"));
    dv.appendChild(svg("text", { x: BX - 12, y: BY - C.stickCm * PXC + 40, "text-anchor": "end", class: "d2-small" }, "10 cm"));
    // 각도기(그림자 끝 중심) + 각 + 실
    var prot = svg("g", { class: "d2-prot" });
    prot.appendChild(svg("path", { d: "M -70 0 A 70 70 0 0 1 70 0 Z", class: "d2-protbg" }));
    for (var dg = 0; dg <= 180; dg += 10) {
      var c = Math.cos(dg * RAD);
      var s = Math.sin(dg * RAD);
      prot.appendChild(svg("line", { x1: -c * 70, y1: -s * 70, x2: -c * 60, y2: -s * 60, class: "d2-tick" }));
    }
    dv.appendChild(prot);
    var angArc = svg("path", { class: "d2-arc" });
    dv.appendChild(angArc);
    var thr = svg("line", { class: "d2-thread" });
    dv.appendChild(thr);
    var tip = svg("polygon", { class: "d2-tip" });
    dv.appendChild(tip);
    var solarTxt = svg("text", { class: "d2-val d2-val-solar" });
    dv.appendChild(solarTxt);
    var shadowTxt = svg("text", { x: BX, y: BY + 72, class: "d2-val d2-val-shadow" });
    dv.appendChild(shadowTxt);
    // 온도계
    var TX0 = 648;
    var TY0 = 290; // 15 °C
    var TPC = 12; // 1 °C
    dv.appendChild(svg("text", { x: TX0, y: 30, "text-anchor": "middle", class: "d2-small" }, "온도계(그늘)"));
    dv.appendChild(svg("rect", { x: TX0 - 40, y: TY0 - 15 * TPC - 16, width: 80, height: 15 * TPC + 48, rx: 8, class: "d2-tboard" }));
    for (var t2 = 15; t2 <= 30; t2++) {
      var yy = TY0 - (t2 - 15) * TPC;
      dv.appendChild(svg("line", { x1: TX0 + 10, x2: TX0 + (t2 % 5 === 0 ? 26 : 18), y1: yy, y2: yy, class: "d2-tick" }));
      if (t2 % 5 === 0) dv.appendChild(svg("text", { x: TX0 - 12, y: yy + 6, "text-anchor": "end", class: "d2-num" }, String(t2)));
    }
    dv.appendChild(svg("rect", { x: TX0 - 4, y: TY0 - 15 * TPC - 8, width: 8, height: 15 * TPC + 20, rx: 4, class: "d2-tube" }));
    var liq = svg("rect", { x: TX0 - 3, width: 6, class: "d2-liquid" });
    dv.appendChild(liq);
    dv.appendChild(svg("circle", { cx: TX0, cy: TY0 + 20, r: 10, class: "d2-liquid" }));
    var tempTxt = svg("text", { x: 704, y: 348, "text-anchor": "end", class: "d2-val d2-val-temp" });
    dv.appendChild(tempTxt);

    container.appendChild(el("div", { class: "d2-wrap" }, [sky, dv]));

    function setTime(st) {
      if (disposed) return;
      var L = st.shadow;
      var alt = st.solar;
      sunG.setAttribute("transform", "translate(" + SX(st.az).toFixed(1) + "," + SY(alt).toFixed(1) + ")");
      sky.setAttribute("aria-label", "하늘 모형: " + clockText(st.min) + "에 태양이 " + (st.az < 170 ? "남동쪽" : st.az > 190 ? "남서쪽" : "남쪽") + " 하늘, 태양 고도 " + f1(alt) + "도 높이에 있어요.");
      var tx = BX + L * PXC;
      shd.setAttribute("width", Math.max(0, L * PXC).toFixed(1));
      thr.setAttribute("x1", BX);
      thr.setAttribute("y1", BY - C.stickCm * PXC);
      thr.setAttribute("x2", tx.toFixed(1));
      thr.setAttribute("y2", BY);
      var k = 130;
      rayL.setAttribute("x1", (BX - Math.cos(alt * RAD) * k).toFixed(1));
      rayL.setAttribute("y1", (BY - C.stickCm * PXC - Math.sin(alt * RAD) * k).toFixed(1));
      rayL.setAttribute("x2", tx.toFixed(1));
      rayL.setAttribute("y2", BY);
      prot.setAttribute("transform", "translate(" + tx.toFixed(1) + "," + BY + ")");
      var r = 34;
      var ex = tx - Math.cos(alt * RAD) * r;
      var ey = BY - Math.sin(alt * RAD) * r;
      angArc.setAttribute("d", "M " + tx.toFixed(1) + " " + BY + " L " + (tx - r).toFixed(1) + " " + BY + " A " + r + " " + r + " 0 0 1 " + ex.toFixed(1) + " " + ey.toFixed(1) + " Z");
      tip.setAttribute("points", [tx, BY - 8, tx - 8, BY - 22, tx + 8, BY - 22].join(" "));
      solarTxt.setAttribute("x", (tx + 10).toFixed(1));
      solarTxt.setAttribute("y", BY - 84);
      solarTxt.setAttribute("text-anchor", tx > 430 ? "end" : "start");
      solarTxt.textContent = "태양 고도 " + f1(alt) + "°";
      shadowTxt.textContent = "그림자 길이 " + f1(L) + " cm";
      dv.setAttribute("aria-label", "태양 고도 측정기 모형: 그림자와 실이 이루는 각(태양 고도)은 " + f1(alt) + "도, 그림자 길이는 " + f1(L) + " 센티미터, 온도계의 기온은 " + f1(st.temp) + "도예요.");
      var ty = TY0 - (clamp(st.temp, 15, 30) - 15) * TPC;
      liq.setAttribute("y", ty.toFixed(1));
      liq.setAttribute("height", (TY0 + 14 - ty).toFixed(1));
      tempTxt.textContent = "기온 " + f1(st.temp) + " °C";
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
        lead: "시간 바를 끌어 하루 동안의 변화를 살펴보고, 매시 30분 눈금 7곳에서 값을 기록해요.",
        cells: TIMES.map(function (t) {
          return { time: t.id };
        }),
      },
    ],
    doneLead: "7개 시각을 모두 기록했어요! '다음 단계'로 가서 표와 그래프로 분석해 보세요. 시간 바는 계속 움직여 볼 수 있어요.",
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
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향",
      tip2D: "2D 화면(모형)이에요. 위는 남쪽 하늘의 태양, 아래는 태양 고도 측정기를 옆에서 본 모습과 온도계예요.",
    },
    observe: function () {
      return { question: "", type: "numeric", fields: [] };
    },
    makeRecord: function () {
      return {};
    },
    extras: [myTable, safety],
    onChange: lesson.refresh,
  });

  /* ───────── 시간 바(3D 장면 바로 아래) ───────── */
  var bar = (function () {
    var viewBox = $("experiment-root").querySelector(".ss-exp-view");
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

    // 값 패널
    function cell(cls, icon, name) {
      var val = el("strong", { class: "vp-val" });
      var node = el("div", { class: "vp-cell " + cls }, [el("span", { class: "vp-name" }, [el("span", { "aria-hidden": "true", text: icon + " " }), name]), val]);
      return { node: node, val: val };
    }
    var vTime = cell("vp-time", "🕘", "시각");
    var vSolar = cell("vp-solar", "📐", "태양 고도");
    var vShadow = cell("vp-shadow", "▬", "그림자 길이");
    var vTemp = cell("vp-temp", "🌡", "기온");
    var vp = el("div", { class: "vp", role: "group", "aria-label": "지금 시각의 측정값" }, [vTime.node, vSolar.node, vShadow.node, vTemp.node]);
    var srcLine = el("p", { class: "vp-src" });
    var southNote = el("p", { class: "vp-south", hidden: true, text: C.southNote });
    var recBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide", text: "📝 기록하기" });
    var recMsg = el("p", { class: "ss-help tb-msg", "aria-live": "polite" });
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });

    var box = el("div", { class: "ss-card tb-card" }, [track, tickRow]);
    viewBox.parentNode.insertBefore(box, viewBox.nextSibling);
    var valsCard = el("div", { class: "ss-card ss-step-card vals-card" }, [
      el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: "📏" }), " 측정값 확인하고 기록하기"]),
      vp,
      srcLine,
      recBtn,
      recMsg,
      southNote,
      live,
    ]);
    // 가로 화면(좌우 배치): 측정값 카드를 오른쪽 패널 맨 위에 / 세로·좁은 화면: 시간 바 바로 아래에
    var panel = $("experiment-root").querySelector(".ss-exp-panel");
    var twoCol = window.matchMedia ? window.matchMedia("(min-width: 901px) and (orientation: landscape)") : null;
    function placeVals() {
      if (twoCol && twoCol.matches) panel.insertBefore(valsCard, panel.firstChild);
      else box.parentNode.insertBefore(valsCard, box.nextSibling);
    }
    placeVals();
    if (twoCol) {
      if (twoCol.addEventListener) twoCol.addEventListener("change", placeVals);
      else if (twoCol.addListener) twoCol.addListener(placeVals);
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
      // 매시 30분 눈금 가까이(±3분)에서 놓으면 눈금에 맞춘다
      for (var i = 0; i < TIMES.length; i++) {
        var d = Math.abs(TIMES[i].min - cur);
        if (d > 0 && d <= 3) {
          goTo(TIMES[i].min, 150);
          break;
        }
      }
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
      var res = records.upsert({ time: t.id, label: t.label, solar: r.solar, shadow: r.shadow, temp: r.temp,  });
      exp.refresh();
      drawRecords();
      var desc = t.label + " — 태양 고도 " + f1(r.solar) + "°, 그림자 길이 " + f1(r.shadow) + " cm, 기온 " + f1(r.temp) + " °C";
      if (!before && exp.allDone()) toast("🎉 7개 시각을 모두 기록했어요! '다음 단계'로 가서 결과를 분석해 보세요.", 3800);
      else toast((res.replaced ? "🔁 다시 기록했어요: " : "📝 기록했어요: ") + desc, 3000);
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
        recMsg.textContent = "눈금 사이 시각은 살펴보기만 해요. 위의 눈금 버튼(9:30~15:30)을 누르면 기록할 수 있어요." + (todo ? " 다음: " + todo.label : "");
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
