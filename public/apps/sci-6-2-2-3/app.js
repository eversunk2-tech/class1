/*
 * app.js — sci-6-2-2-3 "물질이 타려면 무엇이 필요할까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널(조건 고르기·실행·관찰 카드)·기록·진행 상황 DB 저장을 맡고, 이 파일은
 *   ① 실험 장면(3D/2D): 실험해요 1 — 아크릴 통으로 덮은 두 촛불(㉡에는 산소가 나오는 비커) / 실험해요 2 — 삼발이·철판·알코올램프·성냥 조각
 *   ② 시간 바(앱 전용, 실험해요 1): 두 통을 덮은 뒤 끌어서 시간 흐름을 살펴본다(모형, 시각 숫자 없음). 끝까지 가야 관찰 기록이 켜진다.
 *   ③ 장면 상태 표시(HUD), 관찰 카드 내용(보기 고르기 + 확인하기), 내 기록 표, 분석 표 2개, 정리하기 오개념 카드  만 만든다.
 *
 * 과학 규칙(spec.md 1.3·1.4·개정 1):
 *   - 결과는 교과서·실험관찰 표현만: ㉠ 먼저 꺼진다 / ㉡ 더 오래 탄다 / 머리 부분 불이 붙는다 / 나무 부분 색깔만 검게 변한다.
 *   - 시간(초)·온도(°C) 숫자는 쓰지 않는다(자료에 없음). 시간 바·가열은 "빨리 감기(모형)"로 밝힌다.
 *   - 두 아크릴 통은 크기가 같다. 성냥의 머리·나무 부분은 철판 가운데로부터 같은 거리에 둔다(변인 통제).
 *   - 연소 후 생기는 물질(다음 차시)은 말하지 않는다. 꺼진 촛불 위 흰 김은 모양만 보여 주고 이름을 붙이지 않는다.
 *
 * 장면 상태(sim, 저장 키 "sim"): { covered, t(시간 바 0~1), seen(시간 바 끝까지 봄), heat(가열 0/1), show("e1"|"e2") }
 * 3D/2D 화면은 이 상태를 그리기만 한다(render). 그래서 3D↔2D를 바꾸거나 새로고침해도 같은 모습으로 돌아온다.
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
  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;

  var COND = {};
  C.conditions.forEach(function (c) {
    COND[c.id] = c;
  });
  var PHASE = {};
  C.phases.forEach(function (p) {
    PHASE[p.id] = p;
  });
  function phaseOf(cond) {
    return COND[cond] ? COND[cond].phase : null;
  }
  function expOf(cond) {
    return phaseOf(cond) === "temperature" ? "e2" : "e1";
  }
  function condsOf(phaseId) {
    return C.conditions.filter(function (c) {
      return c.phase === phaseId;
    });
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.cond;
    },
    onChange: function () {
      lesson.refresh();
      drawMine();
    },
  });
  function recOf(cond) {
    var r = records.get(cond);
    return r ? r.result : null;
  }

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(오개념 카드 + 결론 + 선택 한 줄) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);

  (function () {
    var card = $("misc-card");
    card.appendChild(el("h3", { class: "misc-title", text: C.misconceptionCard.title }));
    card.appendChild(S.rich(C.misconceptionCard.text, "p"));
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
  $("more-note-text").textContent = C.curiosity.note;
  function showFinish() {
    $("finish-wrap").hidden = !conclude.isDone();
  }
  showFinish();

  /* ───────── 장면 상태(모형) ───────── */
  var T_DIM = 0.06; // 덮은 뒤 ㉠ 불꽃이 작아지기 시작하는 시간 바 위치(모형)
  var T_OUT = 0.42; // ㉠ 촛불이 꺼지는 시간 바 위치(모형, 실제 시간 아님)
  var TB_DIM = 0.78; // ㉡ 불꽃이 작아지기 시작하는 위치(모형) — ㉡도 더 오래 타다가 결국 꺼진다(fix-1)
  var TB_OUT = 0.96; // ㉡ 촛불이 꺼지는 위치(모형)
  var sim = (function () {
    var s = store.get("sim", null) || {};
    var t = Number(s.t);
    return {
      covered: !!s.covered,
      t: isFinite(t) ? clamp01(t) : 0,
      seen: !!s.seen,
      heat: s.heat === 1 ? 1 : 0,
      show: s.show === "e2" ? "e2" : "e1",
    };
  })();
  if (!sim.covered) {
    sim.t = 0;
    sim.seen = false;
  }
  var saveSim = S.debounce(function () {
    store.set("sim", { covered: sim.covered, t: Math.round(sim.t * 1000) / 1000, seen: sim.seen, heat: sim.heat, show: sim.show });
  }, 300);
  var anim = { lift: null, heat: null }; // 연출 중인 값(저장하지 않음)
  var curSel = null; // 지금 고른 조건 id

  function flameA(t) {
    if (t <= T_DIM) return 1;
    if (t >= T_OUT) return 0;
    var u = (t - T_DIM) / (T_OUT - T_DIM);
    return Math.max(0.12, 1 - Math.pow(u, 1.7));
  }
  function flameB(t) {
    if (t <= TB_DIM) return 1;
    if (t >= TB_OUT) return 0;
    var u = (t - TB_DIM) / (TB_OUT - TB_DIM);
    return Math.max(0.12, 1 - Math.pow(u, 1.7));
  }
  function snap() {
    var covered = sim.covered && anim.lift == null;
    var t = covered ? sim.t : 0;
    var h = anim.heat != null ? anim.heat : sim.heat;
    var s = (t - T_OUT) / 0.3;
    var sb = (t - TB_OUT) / 0.3;
    return {
      show: sim.show,
      sel: curSel,
      lift: anim.lift != null ? anim.lift : sim.covered ? 0 : 1,
      covered: covered,
      t: t,
      fA: covered ? flameA(t) : 1,
      fB: covered ? flameB(t) : 1,
      smoke: covered && s > 0 && s < 1 ? s : 0, // 꺼진 뒤 잠깐 올라가는 흰 김(모양만)
      smokeB: covered && sb > 0 && sb < 1 ? sb : 0,
      heat: h,
      lamp: h > 0 ? clamp01(h / 0.06) : 0,
      // 머리 부분: 불이 붙어 잠깐 타다가 다 타서 꺼진다(모형, fix-1)
      headFire: clamp01((h - 0.45) / 0.08) * (1 - clamp01((h - 0.78) / 0.14)),
      headBurnt: clamp01((h - 0.45) / 0.45),
      headDone: h >= 0.92,
      woodChar: clamp01((h - 0.5) / 0.5), // 머리 부분에 불이 붙은 뒤에 나무 부분 색이 검게 변해 간다(이 실험 시간 안에서는 아직 불이 붙지 않음)
    };
  }
  // 조건별 지금 모습(아이콘 + 글자: 색만으로 구분하지 않는다)
  function statusOf(cond, s) {
    if (cond === "none") {
      if (!s.covered) return { icon: "🔥", text: "불꽃 있음" + (s.lift > 0.99 ? "(덮기 전)" : "") };
      if (s.fA <= 0) return { icon: "💨", text: "불꽃 없음 — 꺼졌어요", off: true };
      if (s.fA < 0.99) return { icon: "🔥", text: "불꽃이 작아지고 있어요" };
      return { icon: "🔥", text: "불꽃 있음" };
    }
    if (cond === "added") {
      if (!s.covered) return { icon: "🔥", text: "불꽃 있음" + (s.lift > 0.99 ? "(덮기 전)" : "") };
      if (s.fB <= 0) return { icon: "💨", text: "불꽃 없음 — ㉠보다 늦게 꺼졌어요", off: true };
      if (s.fB < 0.99) return { icon: "🔥", text: "불꽃이 작아지고 있어요(㉠보다 오래 탔어요)" };
      return { icon: "🔥", text: s.t > T_OUT ? "불꽃 있음 — 아직 타고 있어요" : "불꽃 있음" };
    }
    if (cond === "head") {
      if (s.heat <= 0) return { icon: "·", text: "그대로(가열 전)" };
      if (s.headDone) return { icon: "⬛", text: "불이 붙어 타고 꺼졌어요(다 탔어요)", off: true };
      if (s.headFire > 0) return { icon: "🔥", text: "불꽃 있음 — 불이 붙었어요" };
      return { icon: "🌡", text: "데워지는 중" };
    }
    if (s.heat <= 0) return { icon: "·", text: "그대로(가열 전)" };
    if (s.woodChar >= 0.6) return { icon: "⬛", text: "아직 불꽃 없음 · 색이 검게 변했어요", off: true };
    if (s.woodChar > 0) return { icon: "🌡", text: "불꽃 없음 · 색이 조금씩 검게" };
    return { icon: "🌡", text: "데워지는 중" };
  }

  /* ───────── 그리기(requestAnimationFrame으로 묶기) ───────── */
  var curView = null; // 지금 붙어 있는 3D/2D 장면(render를 가진 것)
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
    var s = snap();
    if (curView) curView.render(s);
    if (ui) ui.draw(s);
  }

  // 앱 전용 트윈(3D·2D 공통, 탭이 숨겨지면 바로 끝낸다)
  function animate(ms, fn) {
    if (reduceMotion()) ms = Math.min(ms, 400);
    return new Promise(function (resolve) {
      if (document.hidden || ms <= 0) {
        fn(1);
        resolve();
        return;
      }
      var t0 = null;
      function tick(now) {
        if (t0 == null) t0 = now;
        var t = Math.min(1, (now - t0) / ms);
        if (document.hidden) t = 1;
        fn(t);
        if (t >= 1) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /* ───────── 3D 장면 ─────────
   * 1 단위 ≈ 2 cm(모형). 탁자 윗면 y = 0. 실험해요 1(e1)과 실험해요 2(e2)는 같은 자리에 두고 보이는 것만 바꾼다. */
  var A_X = -2.6; // ㉠ 통 가운데
  var B_X = 2.6; // ㉡ 통 가운데
  var CANDLE_DX = -0.55; // 통 안 촛불 자리(두 통 모두 같은 자리)
  var BEAKER_DX = 0.8; // ㉡ 통 안 비커 자리
  var BOX = { w: 3.2, h: 3.0, d: 2.4, raise: 2.1 };
  var PLATE_Y = 2.2; // 철판 윗면
  var PART_D = 1.3; // 철판 가운데로부터 성냥 조각까지 거리(머리·나무 같음)
  var E2_HOME_0 = [0, 1.5, 0.2];

  function radialTexture(T, stops, size) {
    var c = document.createElement("canvas");
    c.width = c.height = size || 128;
    var g = c.getContext("2d");
    var r = c.width / 2;
    var grad = g.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(function (s) {
      grad.addColorStop(s[0], s[1]);
    });
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.width);
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 11.6, depth: 7.4, center: [0, 2.0, 0] },
      viewDir: [0, 0.42, 0.91],
      minDistance: 3,
      onPick: function (p) {
        // 숨겨진 실험의 물체는 누르지 않은 것으로 본다
        if (p && p.cond && expOf(p.cond) === sim.show) ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var disposed = false;

      var table = M.table(14, 8, 0xd9c7a3);
      v.root.add(table);
      v.onThemeChange(function (dark) {
        table.material.color.set(dark ? 0x6b5d45 : 0xd9c7a3);
      });

      var glowTex = radialTexture(T, [[0, "rgba(255,200,90,0.85)"], [0.4, "rgba(255,160,40,0.35)"], [1, "rgba(255,140,0,0)"]]);
      var smokeTex = radialTexture(T, [[0, "rgba(235,235,235,0.85)"], [1, "rgba(235,235,235,0)"]]);

      // 불꽃(물방울 모양 회전체: 바깥 주황 + 안쪽 밝은 노랑 + 아래 파랑) — 크기는 render에서, 흔들림은 tick에서
      var flamePts = [
        [0, 0],
        [0.055, 0.02],
        [0.1, 0.07],
        [0.115, 0.14],
        [0.1, 0.22],
        [0.068, 0.3],
        [0.032, 0.37],
        [0, 0.44],
      ].map(function (p) {
        return new T.Vector2(p[0], p[1]);
      });
      var flameGeo = new T.LatheGeometry(flamePts, 20);
      function makeFlame(o) {
        o = o || {};
        var g = new T.Group();
        var outer = new T.Mesh(flameGeo, new T.MeshBasicMaterial({ color: o.outer || 0xff9a2e, transparent: true, opacity: o.opacity || 0.88, depthWrite: false }));
        var inner = new T.Mesh(flameGeo, new T.MeshBasicMaterial({ color: o.inner || 0xfff3b0, transparent: true, opacity: 0.95, depthWrite: false }));
        inner.scale.set(0.55, 0.62, 0.55);
        inner.position.y = 0.01;
        var base = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), new T.MeshBasicMaterial({ color: o.base || 0x4d8dff, transparent: true, opacity: 0.7, depthWrite: false }));
        base.scale.set(1, 0.7, 1);
        base.position.y = 0.035;
        var glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
        glow.position.y = 0.18;
        glow.scale.set(0.9, 0.9, 1);
        g.add(glow, outer, inner, base);
        g.userData = { size: 1, k: o.k || 1, seed: Math.random() * 10, glow: glow };
        return g;
      }
      var flames = [];
      function setFlame(f, size) {
        f.userData.size = size;
        f.visible = size > 0.001;
      }

      /* ── 실험해요 1: 촛불 두 개 + 같은 크기 아크릴 통 두 개 ── */
      var e1 = new T.Group();
      v.root.add(e1);
      var boxGeo = new T.BoxGeometry(BOX.w, BOX.h, BOX.d);
      var boxEdges = new T.EdgesGeometry(boxGeo);
      var rigs = {};
      [
        { id: "none", x: A_X, beaker: false },
        { id: "added", x: B_X, beaker: true },
      ].forEach(function (d) {
        var g = new T.Group();
        g.position.x = d.x;
        e1.add(g);
        // 받침 접시 + 작은 양초 + 심지
        var dish = new T.Mesh(new T.CylinderGeometry(0.5, 0.46, 0.06, 28), M.material(0xb8c0c8, { metalness: 0.5, roughness: 0.35 }));
        dish.position.set(CANDLE_DX, 0.03, 0);
        var candle = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.85, 28), M.material(0xf6f1e6, { roughness: 0.7 }));
        candle.position.set(CANDLE_DX, 0.06 + 0.425, 0);
        var wick = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.14, 8), M.material(0x222222));
        wick.position.set(CANDLE_DX, 0.91 + 0.07, 0);
        g.add(dish, candle, wick);
        v.pickable(candle, { cond: d.id });
        var fl = makeFlame();
        fl.position.set(CANDLE_DX, 0.98, 0);
        g.add(fl);
        flames.push(fl);
        var light = new T.PointLight(0xffb24a, 1.2, 4.5, 1.6);
        light.position.set(CANDLE_DX, 1.3, 0.2);
        g.add(light);
        // 고른 조건 표시(촛불 둘레 고리)
        var ring = new T.Mesh(new T.RingGeometry(0.62, 0.78, 40), new T.MeshBasicMaterial({ color: 0xf2a93b, side: T.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(CANDLE_DX, 0.012, 0);
        ring.visible = false;
        g.add(ring);
        var rig = { g: g, flame: fl, light: light, ring: ring, bubbles: [] };
        // ㉡: 비커(묽은 과산화 수소수 + 아이오딘화 칼륨) + 기포(산소)
        if (d.beaker) {
          var bx = BEAKER_DX;
          var glass = new T.Mesh(
            new T.CylinderGeometry(0.45, 0.42, 1.0, 28, 1, true),
            new T.MeshStandardMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.28, roughness: 0.1, side: T.DoubleSide, depthWrite: false })
          );
          glass.position.set(bx, 0.5, 0);
          var liquid = new T.Mesh(new T.CylinderGeometry(0.4, 0.39, 0.5, 28), M.material(0xe2bf62, { transparent: true, opacity: 0.72 }));
          liquid.position.set(bx, 0.27, 0);
          g.add(glass, liquid);
          v.pickable(glass, { cond: d.id });
          var bubMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
          var bubGeo = new T.SphereGeometry(0.035, 8, 6);
          for (var i = 0; i < 14; i++) {
            var b = new T.Mesh(bubGeo, bubMat);
            b.userData = { ph: Math.random(), sp: 0.35 + Math.random() * 0.35, ax: (Math.random() - 0.5) * 0.5, az: (Math.random() - 0.5) * 0.5 };
            b.position.set(bx, 0.1, 0);
            g.add(b);
            rig.bubbles.push(b);
          }
          var bl = M.label("비커: 묽은 과산화 수소수\n+ 아이오딘화 칼륨", { height: 0.5 });
          bl.position.set(bx + 0.2, 0.25, 1.55);
          g.add(bl);
          var bubLbl = M.label("기포 = 산소(모형)", { height: 0.3, bg: "rgba(235,248,255,0.95)" });
          bubLbl.position.set(bx, 1.22, 0.1);
          g.add(bubLbl);
          rig.bubLbl = bubLbl;
        }
        // 흰 김(꺼진 뒤 잠깐, 모양만)
        {
          var smoke = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
          smoke.position.set(CANDLE_DX, 1.1, 0);
          smoke.scale.set(0.35, 0.6, 1);
          g.add(smoke);
          rig.smoke = smoke;
        }
        // 아크릴 통(크기 같음) + 이름표
        var box = new T.Group();
        var shell = new T.Mesh(
          boxGeo,
          new T.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.14, roughness: 0.05, side: T.DoubleSide, depthWrite: false })
        );
        var edges = new T.LineSegments(boxEdges, new T.LineBasicMaterial({ color: 0x5d9ccc }));
        box.add(shell, edges);
        v.pickable(shell, { cond: d.id });
        var name = M.label(COND[d.id].name, { height: 0.5, bold: true, border: d.id === "none" ? "#5b6676" : "#2f6fd6" });
        name.position.set(0, BOX.h / 2 + 0.42, 0);
        box.add(name);
        g.add(box);
        rig.box = box;
        rig.name = name;
        rigs[d.id] = rig;
      });
      var sameLbl = M.label("크기가 같은 아크릴 통", { height: 0.36 });
      sameLbl.position.set(0, 0.25, 1.7);
      e1.add(sameLbl);

      /* ── 실험해요 2: 삼발이 · 철판 · 알코올램프 · 성냥의 머리/나무 부분 ── */
      var e2 = new T.Group();
      v.root.add(e2);
      var metal = M.material(0x6c737c, { metalness: 0.6, roughness: 0.4 });
      var ringT = new T.Mesh(new T.TorusGeometry(1.45, 0.05, 8, 48), metal);
      ringT.rotation.x = Math.PI / 2;
      ringT.position.y = PLATE_Y - 0.1;
      e2.add(ringT);
      [0, 1, 2].forEach(function (k) {
        var a = (k * 2 * Math.PI) / 3 + Math.PI / 6;
        var top = new T.Vector3(1.45 * Math.cos(a), PLATE_Y - 0.1, 1.45 * Math.sin(a));
        var bot = new T.Vector3(1.75 * Math.cos(a), 0, 1.75 * Math.sin(a));
        var len = top.distanceTo(bot);
        var leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, len, 8), metal);
        leg.position.copy(top).add(bot).multiplyScalar(0.5);
        leg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), top.clone().sub(bot).normalize());
        e2.add(leg);
      });
      var plate = new T.Mesh(new T.BoxGeometry(4.2, 0.08, 4.2), M.material(0xaab2bb, { metalness: 0.35, roughness: 0.5 }));
      plate.position.y = PLATE_Y - 0.04;
      e2.add(plate);
      // 철판에 퍼지는 열(모형): 가운데에서 바깥으로 넓어진다
      var heatTex = radialTexture(T, [[0, "rgba(255,70,20,0.95)"], [0.45, "rgba(255,120,40,0.55)"], [1, "rgba(255,150,60,0)"]], 256);
      var heatPlane = new T.Mesh(new T.PlaneGeometry(4.2, 4.2), new T.MeshBasicMaterial({ map: heatTex, transparent: true, opacity: 0, depthWrite: false }));
      heatPlane.rotation.x = -Math.PI / 2;
      heatPlane.position.y = PLATE_Y + 0.004;
      e2.add(heatPlane);
      var heatLbl = M.label("열이 퍼지는 모습(모형)", { height: 0.34, bg: "rgba(255,238,225,0.95)", border: "#d9622b" });
      heatLbl.position.set(-0.7, PLATE_Y + 0.16, -1.35);
      e2.add(heatLbl);
      // 가운데 표시 + 같은 거리 표시(점선)
      var dashMat = new T.LineDashedMaterial({ color: 0x1f2733, dashSize: 0.12, gapSize: 0.08 });
      [-1, 1].forEach(function (sx) {
        var ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, PLATE_Y + 0.01, 0.75), new T.Vector3(sx * PART_D, PLATE_Y + 0.01, 0.75)]), dashMat);
        ln.computeLineDistances();
        e2.add(ln);
      });
      var mid = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.02, 12), M.material(0x1f2733));
      mid.position.set(0, PLATE_Y + 0.01, 0);
      e2.add(mid);
      var distLbl = M.label("가운데로부터 같은 거리", { height: 0.28 });
      distLbl.position.set(0, PLATE_Y + 0.12, 1.3); // 점선 바로 앞(철판 위)
      e2.add(distLbl);
      // 알코올램프(철판 가운데 아래)
      var lampBody = new T.Mesh(
        new T.CylinderGeometry(0.42, 0.6, 0.8, 28),
        new T.MeshStandardMaterial({ color: 0xe6f3ff, transparent: true, opacity: 0.42, roughness: 0.1, depthWrite: false })
      );
      lampBody.position.y = 0.4;
      var alcohol = new T.Mesh(new T.CylinderGeometry(0.44, 0.56, 0.45, 28), M.material(0xbfe0ff, { transparent: true, opacity: 0.5 }));
      alcohol.position.y = 0.23;
      var neck = new T.Mesh(new T.CylinderGeometry(0.14, 0.17, 0.22, 16), M.material(0xb8c0c8, { metalness: 0.5 }));
      neck.position.y = 0.91;
      var lwick = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.1, 8), M.material(0xf3efe3));
      lwick.position.y = 1.07;
      e2.add(lampBody, alcohol, neck, lwick);
      var lampFlame = makeFlame({ outer: 0x6ea8ff, inner: 0xd6e8ff, base: 0x3b6fd1, opacity: 0.6 });
      lampFlame.position.y = 1.1;
      e2.add(lampFlame);
      flames.push(lampFlame);
      var lampLight = new T.PointLight(0x9cc3ff, 0, 4, 1.6);
      lampLight.position.set(0, 1.5, 0.3);
      e2.add(lampLight);
      var lampLbl = M.label("알코올램프", { height: 0.34 });
      lampLbl.position.set(2.75, 0.45, 1.3); // 철판 밖(가리지 않게)
      e2.add(lampLbl);
      // 성냥의 머리 부분(왼쪽) · 나무 부분(오른쪽): 철판 가운데로부터 같은 거리
      var headMat = M.material(0xa3262c, { roughness: 0.8 });
      var head = new T.Mesh(new T.SphereGeometry(0.19, 20, 14), headMat);
      head.scale.set(1.25, 0.8, 1);
      head.position.set(-PART_D, PLATE_Y + 0.14, 0);
      e2.add(head);
      v.pickable(head, { cond: "head" });
      var woodMat = M.material(0xe0b97c, { roughness: 0.85 });
      var wood = new T.Mesh(new T.BoxGeometry(0.17, 0.15, 1.05), woodMat);
      wood.position.set(PART_D, PLATE_Y + 0.075, 0);
      e2.add(wood);
      v.pickable(wood, { cond: "wood" });
      var WOOD0 = new T.Color(0xe0b97c);
      var WOOD1 = new T.Color(0x2a221c);
      var HEAD0 = new T.Color(0xa3262c);
      var HEAD1 = new T.Color(0x2a1512);
      var headFlame = makeFlame({ k: 0.9 });
      headFlame.position.set(-PART_D, PLATE_Y + 0.24, 0);
      e2.add(headFlame);
      flames.push(headFlame);
      var headLight = new T.PointLight(0xffb24a, 0, 2.5, 1.6);
      headLight.position.set(-PART_D, PLATE_Y + 0.6, 0.2);
      e2.add(headLight);
      var partRings = {};
      [
        ["head", -PART_D],
        ["wood", PART_D],
      ].forEach(function (d) {
        var r = new T.Mesh(new T.RingGeometry(0.55, 0.68, 40), new T.MeshBasicMaterial({ color: 0xf2a93b, side: T.DoubleSide }));
        r.rotation.x = -Math.PI / 2;
        r.position.set(d[1], PLATE_Y + 0.006, 0);
        r.visible = false;
        e2.add(r);
        partRings[d[0]] = r;
        var lb = M.label(COND[d[0]].name.replace("성냥의 ", "성냥의\n"), { height: 0.62, bold: true, border: "#1f2733" });
        lb.position.set(d[1] + Math.sign(d[1]) * 1.05, PLATE_Y + 0.45, -0.2);
        e2.add(lb);
      });
      // 모래 상자(안전)
      var sand = new T.Mesh(new T.BoxGeometry(1.6, 0.4, 1.2), M.material(0xd8c28f, { roughness: 0.95 }));
      sand.position.set(-4.3, 0.2, 0.6);
      e2.add(sand);
      var sandLbl = M.label("모래 상자", { height: 0.32 });
      sandLbl.position.set(-4.3, 0.75, 0.6);
      e2.add(sandLbl);

      // 좁은 화면(휴대폰)에서는 이름표를 키운다
      var bigLabels = [];
      e1.traverse(function (o) {
        if (o.isSprite && o.material.map && o !== rigs.none.smoke && o !== rigs.added.smoke) bigLabels.push(o);
      });
      e2.traverse(function (o) {
        if (o.isSprite && o.material.map && o.material.map !== glowTex) bigLabels.push(o);
      });
      bigLabels = bigLabels
        .filter(function (sp) {
          return sp.material.map !== glowTex && sp.material.map !== smokeTex;
        })
        .map(function (sp) {
          return { sp: sp, sx: sp.scale.x, sy: sp.scale.y };
        });
      var labelK = 0;
      function fitLabels() {
        var k = (container.clientWidth || 1024) < 480 ? 1.45 : 1;
        if (k === labelK) return;
        labelK = k;
        bigLabels.forEach(function (t) {
          t.sp.scale.set(t.sx * k, t.sy * k, 1);
        });
      }
      fitLabels();
      var labelRO = window.ResizeObserver ? new ResizeObserver(fitLabels) : null;
      if (labelRO) labelRO.observe(container);

      /* ── 상태 그리기 ── */
      var last = null;
      function render(s) {
        if (disposed) return;
        last = s;
        e1.visible = s.show === "e1";
        e2.visible = s.show === "e2";
        // e1
        var liftY = BOX.h / 2 + 0.01 + s.lift * BOX.raise;
        ["none", "added"].forEach(function (id) {
          var r = rigs[id];
          r.box.position.set(0, liftY, 0);
          r.ring.visible = s.sel === id;
          var size = id === "none" ? s.fA : s.fB;
          setFlame(r.flame, size);
          r.light.intensity = 1.2 * size;
          if (r.smoke) {
            var sm = id === "none" ? s.smoke : s.smokeB;
            r.smoke.material.opacity = sm > 0 ? 0.55 * (1 - sm) : 0;
            r.smoke.position.y = 1.05 + sm * 1.0;
            r.smoke.scale.set(0.3 + sm * 0.3, 0.5 + sm * 0.5, 1);
          }
        });
        // e2
        setFlame(lampFlame, s.lamp * 1.7);
        lampLight.intensity = 1.4 * s.lamp;
        heatPlane.material.opacity = 0.85 * Math.min(1, s.heat * 1.4);
        var hs = 0.2 + 0.8 * s.heat;
        heatPlane.scale.set(hs, hs, 1);
        heatLbl.visible = s.heat > 0;
        setFlame(headFlame, s.headFire * 0.9);
        headLight.intensity = 1.1 * s.headFire;
        headMat.color.copy(HEAD0).lerp(HEAD1, s.headBurnt);
        woodMat.color.copy(WOOD0).lerp(WOOD1, s.woodChar);
        partRings.head.visible = s.sel === "head";
        partRings.wood.visible = s.sel === "wood";
      }

      // 불꽃 흔들림·기포(가벼운 반복: 화면이 해제되면 멈춘다)
      var raf = 0;
      var still = reduceMotion();
      function tick(now) {
        if (disposed) return;
        var tt = now / 1000;
        flames.forEach(function (f) {
          var u = f.userData;
          if (!f.visible) return;
          var w = still ? 0 : 1;
          var sx = u.size * u.k * (1 + w * 0.035 * Math.sin(tt * 9.1 + u.seed));
          var sy = u.size * u.k * (1 + w * 0.08 * Math.sin(tt * 12.7 + u.seed * 2) + w * 0.04 * Math.sin(tt * 23 + u.seed));
          f.scale.set(sx, sy, sx);
          f.rotation.z = w * 0.04 * Math.sin(tt * 5.3 + u.seed);
        });
        if (last && last.show === "e1") {
          rigs.added.bubbles.forEach(function (b) {
            var d = b.userData;
            var p = (d.ph + tt * d.sp * (still ? 0.3 : 1)) % 1;
            b.position.set(BEAKER_DX + d.ax * (1 - p * 0.4), 0.08 + p * 0.95, d.az * (1 - p * 0.4));
            b.visible = p < 0.97;
          });
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      // 실험해요 2는 장치가 작아 조금 더 위에서, 가깝게 본다(공통 틀의 처음 시점은 실험해요 1에 맞춤)
      var E2_DIR = new T.Vector3(0, 0.66, 0.75).normalize();
      function fitFor(w, d) {
        var cw = container.clientWidth || 1;
        var ch = container.clientHeight || 1;
        var vfov = (v.camera.fov * Math.PI) / 180;
        var hfov = 2 * Math.atan(Math.tan(vfov / 2) * (cw / ch));
        return Math.max(w / 2 / Math.tan(hfov / 2), (d * 0.8) / 2 / Math.tan(vfov / 2)) * 1.04 + 0.5;
      }
      function flyTo(target, dist, ms) {
        var toT = new T.Vector3().fromArray(target);
        var toP = toT.clone().addScaledVector(E2_DIR, dist);
        var fromT = v.controls.target.clone();
        var fromP = v.camera.position.clone();
        return v.tween(ms || 600, function (e) {
          v.controls.target.lerpVectors(fromT, toT, e);
          v.camera.position.lerpVectors(fromP, toP, e);
        });
      }
      if (sim.show === "e2") flyTo(E2_HOME_0, fitFor(8.2, 5.6), 1);

      function spotOf(cond) {
        if (cond === "none") return [A_X * 0.55, 1.4, 0];
        if (cond === "added") return [B_X * 0.55, 1.4, 0];
        if (cond === "head") return [-PART_D * 0.4, PLATE_Y - 0.1, 0.2];
        return [PART_D * 0.4, PLATE_Y - 0.1, 0.2];
      }
      // 실험해요 2는 장치가 작아 처음 시점을 조금 가깝게(철판·램프가 모두 보이게) 잡는다
      function home(ms) {
        if (sim.show === "e2") return flyTo(E2_HOME_0, fitFor(8.2, 5.6), ms || 500);
        return v.flyHome(ms || 500);
      }
      return {
        render: render,
        focus: function (cond, ms) {
          if (expOf(cond) === "e2") return flyTo(spotOf(cond), fitFor(6.2, 4.2), ms || 700);
          return v.focus(spotOf(cond), 0.8, ms || 700);
        },
        home: home,
        resetView: function () {
          if (sim.show === "e2") home(1);
          else v.resetView();
        },
        whenVisible: v.whenVisible,
        dispose: function () {
          disposed = true;
          cancelAnimationFrame(raf);
          if (labelRO) labelRO.disconnect();
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2D 장면(SVG, 옆에서 본 모습) ───────── */
  function flamePath(cx, by, k) {
    // 밑이 둥글고 위가 뾰족한 불꽃(높이 약 46k)
    var h = 46 * k;
    var w = 11 * k;
    return (
      "M " + cx + " " + (by - h) +
      " C " + (cx + w * 0.4) + " " + (by - h * 0.62) + " " + (cx + w * 1.3) + " " + (by - h * 0.32) + " " + (cx + w * 0.9) + " " + (by - h * 0.08) +
      " C " + (cx + w * 0.6) + " " + by + " " + (cx - w * 0.6) + " " + by + " " + (cx - w * 0.9) + " " + (by - h * 0.08) +
      " C " + (cx - w * 1.3) + " " + (by - h * 0.32) + " " + (cx - w * 0.4) + " " + (by - h * 0.62) + " " + cx + " " + (by - h) + " Z"
    );
  }
  function build2D(container, ctx) {
    container.textContent = "";
    var disposed = false;
    var TY = 318; // 탁자 윗면
    var root = svg("svg", { viewBox: "0 0 700 360", class: "d2-svg", role: "img" });
    root.appendChild(svg("rect", { x: 0, y: 0, width: 700, height: 360, rx: 14, class: "d2-bg" }));
    root.appendChild(svg("rect", { x: 10, y: TY, width: 680, height: 30, rx: 6, class: "d2-table" }));

    /* 실험해요 1 */
    var g1 = svg("g", {});
    root.appendChild(g1);
    var r1 = {};
    [
      { id: "none", cx: 185 },
      { id: "added", cx: 515 },
    ].forEach(function (d) {
      var g = svg("g", { class: "d2-pick", "data-cond": d.id });
      g.addEventListener("click", function () {
        ctx.onPick({ cond: d.id });
      });
      var candleX = d.cx - 50;
      var sel = svg("ellipse", { cx: candleX, cy: TY + 4, rx: 44, ry: 9, class: "d2-selring" });
      g.appendChild(sel);
      g.appendChild(svg("rect", { x: candleX - 34, y: TY - 6, width: 68, height: 6, rx: 3, class: "d2-dish" }));
      g.appendChild(svg("rect", { x: candleX - 22, y: TY - 70, width: 44, height: 64, rx: 4, class: "d2-candle" }));
      g.appendChild(svg("line", { x1: candleX, y1: TY - 70, x2: candleX, y2: TY - 80, class: "d2-wick" }));
      var fg = svg("g", {});
      var glow = svg("circle", { cx: candleX, cy: TY - 100, r: 34, class: "d2-glow" });
      var outer = svg("path", { class: "d2-flame-out" });
      var inner = svg("path", { class: "d2-flame-in" });
      fg.appendChild(glow);
      fg.appendChild(outer);
      fg.appendChild(inner);
      g.appendChild(fg);
      var rr = { g: g, sel: sel, fg: fg, glow: glow, outer: outer, inner: inner, x: candleX, bubbles: [] };
      {
        rr.smoke = svg("ellipse", { cx: candleX, rx: 9, ry: 16, class: "d2-smoke" });
        g.appendChild(rr.smoke);
      }
      if (d.id === "added") {
        var bx = d.cx + 62;
        g.appendChild(svg("rect", { x: bx - 32, y: TY - 58, width: 64, height: 36, class: "d2-liquid" }));
        g.appendChild(svg("path", { d: "M " + (bx - 34) + " " + (TY - 90) + " L " + (bx - 32) + " " + TY + " L " + (bx + 32) + " " + TY + " L " + (bx + 34) + " " + (TY - 90), class: "d2-glass" }));
        for (var i = 0; i < 8; i++) {
          var c = svg("circle", { cx: bx, cy: TY - 30, r: 3.2, class: "d2-bubble" });
          c.__d = { ph: Math.random(), sp: 0.35 + Math.random() * 0.3, ax: (Math.random() - 0.5) * 44 };
          g.appendChild(c);
          rr.bubbles.push(c);
        }
        rr.bx = bx;
        g.appendChild(svg("text", { x: bx, y: TY - 100, "text-anchor": "middle", class: "d2-small" }, "기포 = 산소(모형)"));
      }
      // 아크릴 통(크기 같음)
      var box = svg("g", {});
      box.appendChild(svg("rect", { x: d.cx - 125, y: TY - 200, width: 250, height: 200, rx: 4, class: "d2-box" }));
      box.appendChild(svg("text", { x: d.cx, y: TY - 210, "text-anchor": "middle", class: "d2-name" }, COND[d.id].name));
      g.appendChild(box);
      rr.box = box;
      g1.appendChild(g);
      r1[d.id] = rr;
    });
    g1.appendChild(svg("text", { x: 350, y: 352, "text-anchor": "middle", class: "d2-small d2-ontable" }, "크기가 같은 아크릴 통 · ㉡ 비커: 묽은 과산화 수소수 + 아이오딘화 칼륨"));

    /* 실험해요 2 */
    var g2 = svg("g", {});
    root.appendChild(g2);
    var PY = 176; // 철판 윗면
    var CX = 350;
    var PD = 118; // 가운데로부터 같은 거리
    g2.appendChild(svg("line", { x1: CX - 150, y1: PY + 10, x2: CX - 185, y2: TY, class: "d2-leg" }));
    g2.appendChild(svg("line", { x1: CX + 150, y1: PY + 10, x2: CX + 185, y2: TY, class: "d2-leg" }));
    g2.appendChild(svg("line", { x1: CX - 20, y1: PY + 10, x2: CX - 10, y2: TY, class: "d2-leg d2-leg-back" }));
    g2.appendChild(svg("rect", { x: CX - 200, y: PY, width: 400, height: 10, rx: 2, class: "d2-plate" }));
    var defs = svg("defs", {});
    var gid = "d2heat" + Math.random().toString(36).slice(2, 7);
    var lg = svg("linearGradient", { id: gid, x1: "0", x2: "1", y1: "0", y2: "0" });
    [
      ["0", "0"],
      ["0.5", "1"],
      ["1", "0"],
    ].forEach(function (s) {
      lg.appendChild(svg("stop", { offset: s[0], "stop-color": "#ff5a1f", "stop-opacity": s[1] }));
    });
    defs.appendChild(lg);
    root.insertBefore(defs, root.firstChild);
    var heat = svg("rect", { y: PY - 2, height: 14, rx: 3, fill: "url(#" + gid + ")" });
    g2.appendChild(heat);
    var heatTxt = svg("text", { x: CX + 105, y: PY + 32, "text-anchor": "middle", class: "d2-small d2-heattxt" }, "열이 퍼지는 모습(모형)");
    g2.appendChild(heatTxt);
    // 알코올램프
    g2.appendChild(svg("path", { d: "M " + (CX - 30) + " " + (TY - 70) + " L " + (CX - 48) + " " + TY + " L " + (CX + 48) + " " + TY + " L " + (CX + 30) + " " + (TY - 70) + " Z", class: "d2-lamp" }));
    g2.appendChild(svg("rect", { x: CX - 10, y: TY - 84, width: 20, height: 14, class: "d2-neck" }));
    g2.appendChild(svg("text", { x: CX + 58, y: TY - 20, class: "d2-small" }, "알코올램프"));
    var lampF = svg("path", { class: "d2-lampflame" });
    g2.insertBefore(lampF, g2.firstChild); // 철판 뒤에 그려 불꽃 끝이 철판에 닿아 보이게
    // 같은 거리 표시
    g2.appendChild(svg("line", { x1: CX, y1: PY - 44, x2: CX, y2: PY - 4, class: "d2-mid" }));
    g2.appendChild(svg("line", { x1: CX - PD, y1: PY - 36, x2: CX, y2: PY - 36, class: "d2-dist" }));
    g2.appendChild(svg("line", { x1: CX, y1: PY - 36, x2: CX + PD, y2: PY - 36, class: "d2-dist" }));
    g2.appendChild(svg("text", { x: CX, y: PY - 50, "text-anchor": "middle", class: "d2-small" }, "가운데로부터 같은 거리"));
    // 머리 부분 · 나무 부분
    var parts = {};
    [
      ["head", CX - PD],
      ["wood", CX + PD],
    ].forEach(function (d) {
      var g = svg("g", { class: "d2-pick", "data-cond": d[0] });
      g.addEventListener("click", function () {
        ctx.onPick({ cond: d[0] });
      });
      var sel = svg("ellipse", { cx: d[1], cy: PY + 2, rx: 42, ry: 8, class: "d2-selring" });
      g.appendChild(sel);
      var body = d[0] === "head" ? svg("ellipse", { cx: d[1], cy: PY - 8, rx: 12, ry: 8, class: "d2-head" }) : svg("rect", { x: d[1] - 26, y: PY - 9, width: 52, height: 9, rx: 2, class: "d2-wood" });
      g.appendChild(body);
      g.appendChild(svg("text", { x: d[1], y: PY - 72, "text-anchor": "middle", class: "d2-name" }, COND[d[0]].name));
      var fl = null;
      if (d[0] === "head") {
        fl = svg("path", { class: "d2-flame-out" });
        g.appendChild(fl);
      }
      g2.appendChild(g);
      parts[d[0]] = { sel: sel, body: body, flame: fl, x: d[1] };
    });
    // 모래 상자
    g2.appendChild(svg("rect", { x: 30, y: TY - 30, width: 90, height: 30, rx: 3, class: "d2-sand" }));
    g2.appendChild(svg("text", { x: 75, y: TY - 38, "text-anchor": "middle", class: "d2-small" }, "모래 상자"));

    container.appendChild(el("div", { class: "d2-wrap" }, [root]));

    function mix(a, b, t) {
      var pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
      var pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
      return "rgb(" + pa.map(function (x, i) {
        return Math.round(x + (pb[i] - x) * t);
      }).join(",") + ")";
    }
    var last = null;
    function setFlame(rr, k, by) {
      rr.fg.setAttribute("visibility", k > 0.001 ? "visible" : "hidden");
      if (k <= 0.001) return;
      rr.outer.setAttribute("d", flamePath(rr.x, by, k));
      rr.inner.setAttribute("d", flamePath(rr.x, by - 2, k * 0.55));
      rr.glow.setAttribute("cy", by - 22 * k);
      rr.glow.setAttribute("r", 34 * k);
    }
    function render(s) {
      if (disposed) return;
      last = s;
      g1.setAttribute("visibility", s.show === "e1" ? "visible" : "hidden");
      g2.setAttribute("visibility", s.show === "e2" ? "visible" : "hidden");
      g1.style.display = s.show === "e1" ? "" : "none";
      g2.style.display = s.show === "e2" ? "" : "none";
      ["none", "added"].forEach(function (id) {
        var rr = r1[id];
        rr.box.setAttribute("transform", "translate(0 " + (-s.lift * 88).toFixed(1) + ")");
        rr.sel.setAttribute("visibility", s.sel === id ? "visible" : "hidden");
        setFlame(rr, id === "none" ? s.fA : s.fB, TY - 80);
        if (rr.smoke) {
          var sm = id === "none" ? s.smoke : s.smokeB;
          rr.smoke.setAttribute("visibility", sm > 0 ? "visible" : "hidden");
          rr.smoke.setAttribute("cy", (TY - 96 - sm * 60).toFixed(1));
          rr.smoke.setAttribute("opacity", (0.6 * (1 - sm)).toFixed(2));
        }
      });
      // e2
      var lk = s.lamp * 1.25;
      lampF.setAttribute("visibility", lk > 0.001 ? "visible" : "hidden");
      if (lk > 0.001) lampF.setAttribute("d", flamePath(CX, TY - 84, lk * 0.84));
      var w = 60 + 340 * s.heat;
      heat.setAttribute("x", (CX - w / 2).toFixed(1));
      heat.setAttribute("width", w.toFixed(1));
      heat.setAttribute("opacity", Math.min(1, s.heat * 1.4).toFixed(2));
      heat.setAttribute("visibility", s.heat > 0 ? "visible" : "hidden");
      heatTxt.setAttribute("visibility", s.heat > 0 ? "visible" : "hidden");
      parts.head.body.setAttribute("fill", mix("#a3262c", "#2a1512", s.headBurnt));
      parts.head.flame.setAttribute("visibility", s.headFire > 0.001 ? "visible" : "hidden");
      if (s.headFire > 0.001) parts.head.flame.setAttribute("d", flamePath(parts.head.x, PY - 12, s.headFire * 0.9));
      parts.wood.body.setAttribute("fill", mix("#e0b97c", "#2a221c", s.woodChar));
      parts.head.sel.setAttribute("visibility", s.sel === "head" ? "visible" : "hidden");
      parts.wood.sel.setAttribute("visibility", s.sel === "wood" ? "visible" : "hidden");
      root.setAttribute("aria-label", ariaOf(s));
    }
    // 기포(가벼운 반복)
    var raf = 0;
    var still = reduceMotion();
    function tick(now) {
      if (disposed) return;
      if (last && last.show === "e1" && !still) {
        var tt = now / 1000;
        r1.added.bubbles.forEach(function (c) {
          var d = c.__d;
          var p = (d.ph + tt * d.sp) % 1;
          c.setAttribute("cx", (r1.added.bx + d.ax * (1 - p * 0.5)).toFixed(1));
          c.setAttribute("cy", (TY - 6 - p * 50).toFixed(1));
        });
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return {
      render: render,
      focus: function () {
        return Promise.resolve();
      },
      home: function () {
        return Promise.resolve();
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
        cancelAnimationFrame(raf);
      },
    };
  }
  function ariaOf(s) {
    if (s.show === "e1") {
      return "실험해요 1 옆모습(모형): " + (s.covered ? "두 촛불을 크기가 같은 아크릴 통으로 덮었어요. " : "아직 덮지 않았어요. ") + "㉠ " + statusOf("none", s).text + ", ㉡ " + statusOf("added", s).text + ".";
    }
    return "실험해요 2 옆모습(모형): 철판 가운데로부터 같은 거리에 성냥의 머리 부분과 나무 부분이 있어요. 머리 부분 " + statusOf("head", s).text + ", 나무 부분 " + statusOf("wood", s).text + ".";
  }

  // 공통 틀에 넘기는 장면: 만든 장면을 curView로 잡고, 공통 틀 view 메서드는 앱 상태로 처리한다
  function wrapView(inner) {
    if (!inner) return inner;
    var w = {
      render: inner.render,
      focus: inner.focus,
      home: inner.home,
      highlight: function (sel) {
        onHighlight(sel);
      },
      run: function (sel) {
        return runCell(sel);
      },
      showInstant: function (sel) {
        restoreCell(sel);
      },
      clear: function () {
        clearScene();
      },
      resetView: inner.resetView,
      dispose: function () {
        if (curView === w) curView = null;
        inner.dispose();
      },
    };
    if (inner.whenVisible) w.whenVisible = inner.whenVisible;
    curView = w;
    inner.render(snap());
    return w;
  }

  /* ───────── 장면 동작(3D·2D 공통) ───────── */
  function setShow(to) {
    if (sim.show === to) return false;
    sim.show = to;
    saveSim();
    requestDraw();
    if (curView) curView.home(450);
    return true;
  }
  function onHighlight(sel) {
    var c = sel && sel.cond;
    if (c && COND[c]) {
      curSel = c;
      store.set("curSel", c);
      setShow(expOf(c));
    }
    requestDraw();
  }
  var seenWaiters = [];
  function markSeen() {
    if (sim.seen) return;
    sim.seen = true;
    saveSim();
    seenWaiters.splice(0).forEach(function (r) {
      r();
    });
    if (exp && !exp.isBusy()) exp.refresh();
  }
  async function runCell(sel) {
    var c = sel.cond;
    setShow(expOf(c));
    curSel = c;
    if (expOf(c) === "e1") {
      if (!sim.covered) {
        // 두 촛불을 크기가 같은 아크릴 통으로 동시에 덮는다
        sim.t = 0;
        sim.seen = false;
        if (curView) curView.home(400);
        ui.say("두 촛불을 아크릴 통으로 동시에 덮어요.");
        await animate(1300, function (t) {
          anim.lift = 1 - easeInOut(t);
          requestDraw();
        });
        anim.lift = null;
        sim.covered = true;
        saveSim();
        drawNow();
      }
      if (!sim.seen) {
        ui.waitBar(true);
        await new Promise(function (resolve) {
          seenWaiters.push(resolve);
        });
        ui.waitBar(false);
      }
      if (curView) await curView.focus(c, 650);
    } else {
      if (sim.heat < 1) {
        if (curView) curView.home(400);
        ui.ff(true);
        ui.say("알코올램프로 철판 가운데를 가열해요(빨리 감기).");
        var focused = false;
        await animate(3400, function (t) {
          anim.heat = t;
          if (!focused && t > 0.3 && curView) {
            focused = true;
            curView.focus(c, 900);
          }
          requestDraw();
        });
        anim.heat = null;
        sim.heat = 1;
        saveSim();
        ui.ff(false);
        drawNow();
        if (!focused && curView) await curView.focus(c, 600);
      } else if (curView) await curView.focus(c, 650);
    }
    var st = statusOf(c, snap());
    ui.say(COND[c].name + ": " + st.text);
  }
  function restoreCell(sel) {
    if (expOf(sel.cond) === "e1") {
      if (!sim.covered) {
        sim.covered = true;
        sim.seen = true;
        sim.t = 1;
      }
    } else sim.heat = 1;
    saveSim();
    requestDraw();
  }
  function clearScene() {
    sim.covered = false;
    sim.t = 0;
    sim.seen = false;
    sim.heat = 0;
    anim.lift = null;
    anim.heat = null;
    saveSim();
    if (curView) curView.home(450);
    requestDraw();
    if (exp) exp.refresh();
  }

  /* ───────── 2. 실험하기 ───────── */
  $("safety-note").textContent = C.safetyNote;
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
  var myTable = el("div", { class: "ss-card my-records" });

  // 실험 방법 안내는 처음에 접어 둔다(읽을 글 줄이기, review R5 — 펼치기로 볼 수 있음)
  if (store.get("intro", null) === null) store.set("intro", false);
  var exp = null;
  exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: paragraphs(C.intro.paragraphs),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🕯 실험 장치 처음 상태로",
    clearMessage: "실험 장치를 처음 상태로 되돌렸어요. 기록은 그대로 남아 있어요.",
    runTitle: "실험하기",
    busyLabel: function (sel) {
      return expOf(sel.cond) === "e1" ? "⏳ 덮은 뒤 아래 시간 바를 끝까지 끌어요" : "⏩ 가열하는 중… 잘 지켜보세요";
    },
    factors: [
      {
        id: "cond",
        title: "관찰할 조건 고르기",
        short: "관찰할 조건",
        options: C.conditions.map(function (c) {
          return { id: c.id, label: c.name };
        }),
      },
    ],
    phases: C.phases.map(function (ph) {
      return {
        id: ph.id,
        name: ph.name,
        lead: ph.lead,
        cells: condsOf(ph.id).map(function (c) {
          return { cond: c.id };
        }),
      };
    }),
    doneLead: "4칸을 모두 기록했어요. '다음 단계'로 가서 내 기록을 살펴봐요. 다시 살펴보고 싶은 실험은 언제든 다시 해도 돼요.",
    cellKey: function (sel) {
      return sel.cond;
    },
    runLabel: function (sel) {
      var c = COND[sel.cond];
      if (expOf(sel.cond) === "e1") {
        if (!sim.covered) return "▶ 두 촛불에 아크릴 통 덮기";
        if (!sim.seen) return "▶ 시간 바로 두 촛불 살펴보기";
        return "▶ " + c.mark + " 촛불 가까이 보기";
      }
      if (sim.heat < 1) return "▶ 알코올램프로 철판 가운데 가열하기";
      return "▶ " + c.name.replace("성냥의 ", "") + " 가까이 보기";
    },
    view: {
      build3D: function (c, ctx) {
        return build3D(c, ctx).then(wrapView);
      },
      build2D: function (c, ctx) {
        return wrapView(build2D(c, ctx));
      },
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향",
      tip2D: "2D 화면(모형, 옆에서 본 모습)이에요. 촛불이나 성냥 조각을 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { cond: sel.cond, phase: phaseOf(sel.cond), result: observed };
    },
    describeRecord: function (r) {
      return COND[r.cond].name + " → " + r.result;
    },
    extras: [myTable, safety],
    onChange: function () {
      lesson.refresh();
      drawMine();
    },
  });

  /* ── 관찰·기록 카드: 지금 모습(아이콘+글자) + 보기 고르기 + 확인하기 ── */
  var liveChip = null; // { cond, node }
  function chipNode(cond) {
    var icon = el("span", { class: "chip-ic", "aria-hidden": "true" });
    var txt = el("span", { class: "chip-tx" });
    var node = el("p", { class: "obs-chip" }, [el("strong", { text: COND[cond].name + " · 지금 모습: " }), icon, txt]);
    return { cond: cond, node: node, icon: icon, txt: txt };
  }
  function observeCard(sel) {
    var o = C.observe[sel.cond];
    var e1 = expOf(sel.cond) === "e1";
    liveChip = chipNode(sel.cond);
    var body = el("div", { class: "obs-body" }, [
      liveChip.node,
      el("p", { class: "ss-help", text: e1 ? "시간 바를 다시 끌어 보며 두 촛불을 비교해도 돼요." : "장면을 가까이 살펴봐도 돼요." }),
    ]);
    requestDraw();
    return {
      question: o.prompt,
      body: body,
      type: "choice",
      choices: o.options,
      check: function (observed) {
        if (e1 && !sim.seen) return "먼저 시간 바를 끝까지 끌어 두 촛불을 살펴보세요.";
        if (observed === o.answer) {
          return { ok: true, message: o.ok, node: e1 ? null : S.rich(sel.cond === "wood" ? C.ignitionNoteWood : C.ignitionNote, "p") };
        }
        return o.wrong;
      },
    };
  }

  /* ── 장면 위 표시(HUD) · 빨리 감기 배지 · 시간 바 · 안전 문구 (3D/2D를 바꿔도 남는다) ── */
  var ui = (function () {
    var viewBox = $("experiment-root").querySelector(".ss-exp-view");
    var hudA = el("span", { class: "hud-line" });
    var hudB = el("span", { class: "hud-line" });
    var hud = el("div", { class: "hud", "aria-hidden": "true" }, [hudA, hudB]);
    var ff = el("div", { class: "hud-ff", "aria-hidden": "true", hidden: true, text: "⏩ 빨리 감기(모형)" });
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    viewBox.appendChild(hud);
    viewBox.appendChild(ff);
    viewBox.appendChild(live);

    // 시간 바(실험해요 1)
    var fill = el("div", { class: "tb-fill" });
    var outMark = el("div", { class: "tb-mark", "aria-hidden": "true" });
    var thumb = el("div", { class: "tb-thumb", "aria-hidden": "true" });
    var rail = el("div", { class: "tb-rail" }, [fill, outMark, thumb]);
    var track = el("div", {
      class: "tb-track",
      role: "slider",
      tabindex: "0",
      "aria-label": "시간 바(모형): 두 통을 덮은 뒤 흐른 시간",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-orientation": "horizontal",
    }, [rail]);
    var ends = el("div", { class: "tb-ends", "aria-hidden": "true" }, [el("span", { text: "덮은 직후" }), el("span", { text: "시간이 더 흐른 뒤 →" })]);
    var ffBtn = el("button", { type: "button", class: "ss-btn tb-ff", text: "⏩ 끝까지 빨리 감기" });
    // 시간 바 안의 두 촛불 상태(좁은 화면에서 장면이 가려져도 보이게, fix-1)
    var statA = el("span", { class: "tb-st" });
    var statB = el("span", { class: "tb-st" });
    var stat = el("div", { class: "tb-stat", "aria-hidden": "true" }, [statA, statB]);
    var outMarkB = el("div", { class: "tb-mark is-b", "aria-hidden": "true" });
    var msg = el("p", { class: "tb-msg", "aria-live": "polite" });
    var barCard = el("div", { class: "ss-card tb-card" }, [
      el("div", { class: "tb-head" }, [el("h3", { class: "tb-title", text: "⏱ 시간 바 (모형 · 시각 숫자 없음)" }), ffBtn]),
      stat,
      track,
      ends,
      msg,
    ]);
    var plateNote = el("p", { class: "plate-note", role: "note", hidden: true, text: C.plateSafety });
    viewBox.parentNode.insertBefore(barCard, viewBox.nextSibling);
    viewBox.parentNode.insertBefore(plateNote, barCard.nextSibling);
    outMark.style.left = T_OUT * 100 + "%";
    rail.insertBefore(outMarkB, thumb);
    outMarkB.style.left = TB_OUT * 100 + "%";

    var waiting = false;
    var dragging = false;
    var ffAnim = null;
    function enabled() {
      return sim.show === "e1" && sim.covered && anim.lift == null && !(exp && exp.isBusy() && !waiting);
    }
    function setT(t) {
      sim.t = clamp01(t);
      if (sim.t >= 0.999) markSeen();
      saveSim();
      requestDraw();
    }
    function stopFF() {
      if (ffAnim) ffAnim.stop = true;
      ffAnim = null;
      ff.hidden = true;
    }
    function tFromX(clientX) {
      var r = rail.getBoundingClientRect();
      return r.width > 0 ? clamp01((clientX - r.left) / r.width) : 0;
    }
    track.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (!enabled()) {
        flash();
        return;
      }
      stopFF();
      dragging = true;
      try {
        track.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 무시 */
      }
      track.classList.add("is-drag");
      ff.hidden = false;
      setT(tFromX(e.clientX));
      e.preventDefault();
    });
    track.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      setT(tFromX(e.clientX));
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-drag");
      ff.hidden = true;
      if (sim.t > 0.97) setT(1); // 끝 가까이에서 놓으면 끝에 맞춘다
    }
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("lostpointercapture", endDrag);
    track.addEventListener("keydown", function (e) {
      var to = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = sim.t - 0.05;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = sim.t + 0.05;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = 1;
      else if (e.key === "PageUp") to = sim.t + 0.2;
      else if (e.key === "PageDown") to = sim.t - 0.2;
      if (to == null) return;
      e.preventDefault();
      if (!enabled()) {
        flash();
        return;
      }
      stopFF();
      setT(Math.round(clamp01(to) * 100) / 100);
    });
    ffBtn.addEventListener("click", function () {
      if (!enabled()) {
        flash();
        return;
      }
      stopFF();
      var from = sim.t >= 0.999 ? 0 : sim.t;
      var my = { stop: false };
      ffAnim = my;
      ff.hidden = false;
      animate(Math.max(600, (1 - from) * 2600), function (t) {
        if (my.stop) return;
        setT(from + (1 - from) * t);
      }).then(function () {
        if (ffAnim === my) {
          ffAnim = null;
          ff.hidden = true;
        }
      });
    });
    function flash() {
      if (sim.show !== "e1") return;
      msg.textContent = !sim.covered ? "먼저 오른쪽(또는 아래)의 ▶ 버튼으로 두 촛불을 아크릴 통으로 덮어요." : "덮는 중이에요. 잠시 기다려요.";
      barCard.classList.remove("is-flash");
      void barCard.offsetWidth;
      barCard.classList.add("is-flash");
    }

    var lastKey = "";
    function draw(s) {
      // HUD
      var ids = s.show === "e1" ? ["none", "added"] : ["head", "wood"];
      [hudA, hudB].forEach(function (node, i) {
        var st = statusOf(ids[i], s);
        node.textContent = (ids[i] === "none" || ids[i] === "added" ? COND[ids[i]].mark : ids[i] === "head" ? "머리" : "나무") + " " + st.icon + " " + st.text;
        node.classList.toggle("is-off", !!st.off);
        node.classList.toggle("is-sel", s.sel === ids[i]);
      });
      if (liveChip) {
        var cs = statusOf(liveChip.cond, s);
        liveChip.icon.textContent = cs.icon + " ";
        liveChip.txt.textContent = cs.text;
      }
      // 시간 바
      var show1 = s.show === "e1";
      barCard.hidden = !show1;
      plateNote.hidden = s.show !== "e2";
      var pct = (show1 && sim.covered ? sim.t : 0) * 100;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      var on = enabled();
      track.classList.toggle("is-off", !on);
      track.setAttribute("aria-disabled", String(!on));
      ffBtn.disabled = !on;
      track.setAttribute("aria-valuenow", String(Math.round(pct)));
      track.setAttribute("aria-valuetext", "덮은 뒤 시간 " + Math.round(pct) + "퍼센트(모형): ㉠ " + statusOf("none", s).text + ", ㉡ " + statusOf("added", s).text);
      outMark.hidden = !(sim.seen || sim.t >= T_OUT);
      outMarkB.hidden = !(sim.seen || sim.t >= TB_OUT);
      [["none", statA], ["added", statB]].forEach(function (d) {
        var st = statusOf(d[0], s);
        d[1].textContent = COND[d[0]].mark + " " + st.icon + " " + st.text;
        d[1].classList.toggle("is-off", !!st.off);
      });
      var key = [show1, sim.covered, sim.seen, waiting, anim.lift == null].join("|");
      if (key !== lastKey) {
        lastKey = key;
        barCard.classList.toggle("is-wait", waiting);
        if (!sim.covered) msg.textContent = anim.lift != null ? "⏬ 두 촛불을 아크릴 통으로 덮는 중이에요." : "▶ 버튼으로 두 촛불을 동시에 덮으면 시간 바를 움직일 수 있어요.";
        else if (!sim.seen) msg.textContent = "👉 시간 바를 오른쪽 끝까지 끌어 두 촛불을 비교해요. (⏩ 버튼도 돼요)";
        else msg.textContent = "✅ 끝까지 살펴봤어요. 시간 바를 앞뒤로 끌어 다시 비교해 볼 수 있어요.";
      }
    }
    return {
      draw: draw,
      ff: function (on) {
        ff.hidden = !on;
      },
      say: function (t) {
        live.textContent = t;
      },
      waitBar: function (on) {
        waiting = on;
        lastKey = "";
        requestDraw();
        if (on) {
          live.textContent = "두 촛불을 덮었어요. 시간 바를 오른쪽 끝까지 끌어 두 촛불을 비교해요.";
          setTimeout(function () {
            // 장면과 시간 바가 함께 보이게: 장면 위쪽을 머리말 바로 아래에 맞추고, 다 안 들어가면 시간 바 아래쪽을 아래 단계 버튼 위에 맞춘다
            var hd = document.querySelector(".ss-header");
            var ft = document.querySelector(".ss-footer-nav");
            var top = hd ? hd.getBoundingClientRect().height : 0;
            var bottom = (window.innerHeight || 0) - (ft ? ft.getBoundingClientRect().height : 0);
            var vTop = viewBox.getBoundingClientRect().top;
            var bBot = barCard.getBoundingClientRect().bottom;
            var y = window.scrollY + vTop - top - 6;
            if (bBot - vTop > bottom - top - 8) y = window.scrollY + bBot - bottom + 6;
            try {
              window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? "auto" : "smooth" });
            } catch (e) {
              window.scrollTo(0, Math.max(0, y));
            }
            try {
              track.focus({ preventScroll: true });
            } catch (e) {
              /* 무시 */
            }
          }, 60);
        }
      },
    };
  })();

  /* ── 확인하기를 누른 뒤 '기록하기' 버튼이 아래 단계 버튼에 가려지면 보이게 올린다(앱 전용, fix-1) ── */
  $("experiment-root").addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".ss-check-btn") : null;
    if (!t) return;
    setTimeout(function () {
      var obs = t.closest(".ss-observe");
      var rec = obs && [].slice.call(obs.querySelectorAll("button")).filter(function (b) {
        return b.textContent.indexOf("기록하기") >= 0;
      })[0];
      if (!rec || rec.offsetParent === null) return;
      var ft = document.querySelector(".ss-footer-nav");
      var limit = (window.innerHeight || 0) - (ft ? ft.getBoundingClientRect().height : 0) - 8;
      var r = rec.getBoundingClientRect();
      if (r.bottom > limit) {
        var dy = r.bottom - limit;
        try {
          window.scrollBy({ top: dy, behavior: reduceMotion() ? "auto" : "smooth" });
        } catch (err) {
          window.scrollBy(0, dy);
        }
      }
    }, 80);
  });

  /* ── 실험 패널의 '내 기록' 작은 표(2×2: 실험 1 ㉠·㉡ / 실험 2 머리·나무) ── */
  function drawMine() {
    if (!myTable || !exp) return;
    myTable.textContent = "";
    var n = C.conditions.filter(function (c) {
      return recOf(c.id);
    }).length;
    myTable.appendChild(el("h3", { class: "ss-step-h", text: "📋 내 기록 (" + n + "/" + C.conditions.length + ")" }));
    var p1Done = exp.phaseDone(C.phases[0].id);
    C.phases.forEach(function (ph, pi) {
      var row = el("div", { class: "mine-row" }, [el("span", { class: "mine-ph", text: ph.name.split(" — ")[0] })]);
      condsOf(ph.id).forEach(function (c) {
        var r = recOf(c.id);
        var locked = pi > 0 && !p1Done;
        var b = el(
          "button",
          {
            type: "button",
            class: "mine-cell" + (r ? " is-rec" : "") + (locked ? " is-locked" : "") + (curSel === c.id ? " is-sel" : ""),
            "aria-label": c.name + (r ? ", 기록함: " + r : locked ? ", 잠김" : ", 아직 기록 안 함"),
            onclick: function () {
              if (exp.select({ cond: c.id })) drawMine();
            },
          },
          [el("span", { class: "mine-name", text: c.name }), el("span", { class: "mine-val", text: r ? "✓ " + r : locked ? "🔒" : "—" })]
        );
        row.appendChild(b);
      });
      myTable.appendChild(row);
    });
  }

  /* ── 지금 고른 조건을 새로고침 뒤에도 되살린다(앱 전용, 공통 틀은 선택을 저장하지 않음) ── */
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (!selRestored) {
      selRestored = true;
      var saved = store.get("curSel", null);
      if (saved && COND[saved]) exp.select({ cond: saved });
    }
    drawMine();
    requestDraw();
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  function drawResults() {
    var tn = $("toast");
    if (tn) tn.hidden = true; // 실험 단계의 완료 알림이 표를 가리지 않게
    [
      ["result-table-1", C.phases[0], "조건"],
      ["result-table-2", C.phases[1], "성냥 부분"],
    ].forEach(function (d) {
      S.TableChart.renderTable($(d[0]), {
        caption: d[1].name + " (내 기록)",
        columns: [
          { id: "cond", label: d[2] },
          { id: "result", label: "내가 기록한 관찰 결과" },
        ],
        rows: condsOf(d[1].id).map(function (c) {
          return { cond: c.name, result: recOf(c.id) || "—" };
        }),
      });
    });
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function recordRows() {
    return C.conditions.map(function (c) {
      return { exp: PHASE[c.phase].name.split(" — ")[0], cond: c.name, result: recOf(c.id) || "" };
    });
  }
  function buildDetail() {
    var q = quiz.result();
    var analysis = {};
    C.quiz.forEach(function (qq) {
      var r = q[qq.id] || { choice: [], correct: false, tries: 0 };
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
    var rows = recordRows();
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened ? predict.hintsOpened() : undefined,
      records: rows.map(function (r) {
        return { experiment: r.exp, condition: r.cond, result: r.result };
      }),
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
            question: "내가 기록한 관찰 결과(실험 1: ㉠·㉡, 실험 2: 머리·나무 부분)",
            kind: "table",
            answer: {
              columns: [
                { key: "exp", label: "실험" },
                { key: "cond", label: "조건" },
                { key: "result", label: "관찰 결과" },
              ],
              rows: rows,
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        curiosity.qa("curiosity")
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
        return q[qq.id] && q[qq.id].correct;
      }).length;
      return ["기록한 칸: " + records.count() + "/" + C.conditions.length, "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "실험해요 1(㉠·㉡)과 실험해요 2(머리·나무 부분)를 모두 기록해야 넘어갈 수 있어요. (기록한 칸: " + p.done + "/" + p.total + ")";
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
  drawMine();
  drawNow();
})();
