/*
 * app.js — sci-6-2-2-2 "물질이 탈 때 어떤 현상이 나타날까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 화면 틀(3D/2D 전환)·관찰 카드·기록 저장·진행 상황 DB 저장을 맡고, 이 파일은
 *   ① 3D/2D 장면: 촛대 위 양초, 알코올램프(뚜껑), 점화기, 흔들리는 불꽃·빛(모형), 따뜻한 정도(가까이/멀리, 모형)
 *   ② 빨리 감기 바(앱 전용 UI, 코드 이름은 시간 바): 불을 붙인 뒤 '처음 … 나중'(모형)을 끌면 양초 길이·알코올 양이 줄고 촛농이 흘러내리는 모습
 *   ③ 관찰 카드 내용(보기 고르기 + 확인하기), 분석 표, 내 기록으로 답하는 '모두 고르기' 1개(fix-1), 결론 1개, 궁금한 점(선택)  만 만든다.
 *
 * spec.md "개정 1"(우선):
 *  - 로그인 필수·진행 저장은 공통 틀(persist.js / lesson.js)이 맡는다.
 *  - 관찰 결과는 화면(3D/2D)에 바로 보이고, 학생은 알맞은 보기를 골라 확인한 뒤 📝 기록하기로 저장한다(타이핑 없음).
 *  - 시간 바: 양초·알코올에 각각 불을 붙인 뒤 끌 수 있다. 수치는 보여 주지 않는다. '그 밖에 관찰한 것'은 시간 바를
 *    C.timeNeed분 넘게 움직여 본 뒤에 살펴볼(사진 비교) 수 있다.
 *  - 온도는 숫자로 나타내지 않는다(가까이/멀리의 정성적 모형). 다음 차시 내용·용어는 쓰지 않는다.
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
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, document.hidden ? 0 : ms);
    });
  }
  // 2D용 짧은 애니메이션(탭이 숨겨졌거나 움직임 줄이기면 바로 끝낸다)
  function tween2(ms, fn) {
    return new Promise(function (resolve) {
      if (document.hidden || reduceMotion() || ms <= 0) {
        fn(1);
        resolve();
        return;
      }
      var t0 = null;
      function step(now) {
        if (t0 == null) t0 = now;
        var t = Math.min(1, (now - t0) / ms);
        if (document.hidden) t = 1;
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        fn(e);
        if (t >= 1) resolve();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  var SUB = {};
  C.substances.forEach(function (s) {
    SUB[s.id] = s;
  });
  var MET = {};
  C.methods.forEach(function (m) {
    MET[m.id] = m;
  });
  var TMAX = C.timeMax;
  var TNEED = C.timeNeed;

  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;

  /* ───────── 기록 ───────── */
  function keyOf(sub, method) {
    return sub + "|" + method;
  }
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.sub, r.method);
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  function recOf(sub, method) {
    return records.get(keyOf(sub, method)) || null;
  }

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  // 결론 칸 글 시작 도움(답은 주지 않는다): 빈 칸 안내 글 + 칸 위 한 줄(적는 동안에도 보이게)
  (function () {
    var starter = C.conclude[0].starter;
    var ta = $("conclude-root").querySelector("textarea");
    if (!starter || !ta) return;
    ta.setAttribute("placeholder", starter);
    ta.parentNode.insertBefore(el("p", { class: "ss-help starter-line", text: "✏️ 이렇게 시작해 보세요: " + starter }), ta);
  })();

  /* 궁금한 점: 선택 입력 한 줄(비워도 마칠 수 있음). 저장 키 "curiosity" */
  var curiosityText = String(store.get("curiosity", "") || "");
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

  /* ───────── 타는 모습(모형) 상태: 물질마다 { lit, t(분), maxT } ───────── */
  function normBurn(b) {
    var out = {};
    C.substances.forEach(function (s) {
      var x = (b && b[s.id]) || {};
      var t = Number(x.t);
      var mx = Number(x.maxT);
      out[s.id] = {
        lit: x.lit === true,
        t: isFinite(t) ? clamp(t, 0, TMAX) : 0,
        maxT: isFinite(mx) ? clamp(mx, 0, TMAX) : 0,
      };
      if (!out[s.id].lit) out[s.id].t = 0;
    });
    return out;
  }
  var burn = normBurn(store.get("burn", null));
  var saveBurn = S.debounce(function () {
    store.set("burn", burn);
  }, 300);
  function explored(sub) {
    return burn[sub].maxT >= TNEED;
  }

  // 모형 값(화면에는 수치로 보여 주지 않는다)
  var CANDLE_H0 = 9; // 처음 양초 높이(장면 단위)
  var CANDLE_DROP = 2.4; // 시간 바 끝(10분, 모형)까지 줄어드는 길이
  var LV0 = 0.75; // 처음 알코올 양(알코올램프의 70~80%)
  var LV1 = 0.47; // 시간 바 끝(모형)
  function candleH(t) {
    return CANDLE_H0 - CANDLE_DROP * (clamp(t, 0, TMAX) / TMAX);
  }
  function alcLevel(t) {
    return LV0 - (LV0 - LV1) * (clamp(t, 0, TMAX) / TMAX);
  }
  function amountText(sub, t) {
    var what = sub === "candle" ? "양초 길이" : "알코올 양";
    var how = t < 0.05 ? "처음 그대로예요" : t < 3.5 ? "처음보다 조금 줄었어요" : t < 7 ? "처음보다 꽤 줄었어요" : "처음보다 많이 줄었어요";
    return what + ": " + how;
  }
  function minText(t) {
    // 빨리 감기 바는 실제 분이 아니므로 '처음 … 나중'으로만 말한다
    return t < 0.05 ? "불을 붙인 직후" : t < 3.5 ? "조금 지난 뒤" : t < 7 ? "꽤 지난 뒤" : "한참 지난 뒤";
  }

  /* ───────── 지금 고른 조건 · 화면 갱신(requestAnimationFrame으로 묶기) ───────── */
  var curSel = {};
  var curView = null; // 지금 붙어 있는 3D/2D 장면(앱 전용 메서드를 가진 것)
  var igniting = {}; // sub → Promise
  var burnEpoch = 0; // '불 끄고 처음 상태로'를 누르면 늘어난다(그사이 끝난 불 붙이기는 무시)
  var expBusy = false;
  var lastPhotos = null; // { sub, t, before, after } — '그 밖에 관찰한 것' 사진
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
    if (curView) {
      C.substances.forEach(function (s) {
        curView.setBurn(s.id, burn[s.id]);
      });
    }
    if (bar) bar.draw();
  }

  // 불 붙이기(점화기 애니메이션) — 실행 버튼과 시간 바의 '불 붙이기'가 함께 쓴다
  function igniteSub(sub) {
    if (burn[sub].lit) return Promise.resolve();
    if (igniting[sub]) return igniting[sub];
    var v = curView;
    var epoch = burnEpoch;
    var p = Promise.resolve()
      .then(function () {
        return v ? v.ignite(sub) : null;
      })
      .catch(function (e) {
        console.warn("[sci-6-2-2-2] 불 붙이기 애니메이션 오류(바로 불이 붙은 모습으로)", e);
      })
      .then(function () {
        delete igniting[sub];
        if (epoch === burnEpoch) {
          burn[sub].lit = true;
          burn[sub].t = 0;
          saveBurn();
          if (bar) bar.announce(SUB[sub].device + "에 불이 붙었어요. 불꽃이 계속 흔들리며 타고 있어요.");
        }
        drawNow();
        exp.refresh();
      });
    igniting[sub] = p;
    if (bar) bar.draw();
    return p;
  }

  /* ───────── 3D 장면 ─────────
   * 1 단위 ≈ 1 cm(모형). 탁자 윗면 y = 0. 양초(촛대) x = −7, 알코올램프 x = +7.
   * 불꽃은 위아래로 길쭉한 모양이 계속 흔들린다(모형). 따뜻한 정도는 숫자 없이 가까이/멀리 표시로만 보여 준다. */
  var X = { candle: -7, alcohol: 7 };
  var SIDE = { candle: 1, alcohol: -1 }; // 따뜻한 정도 표시를 놓는 쪽(두 기구 사이, 안쪽)
  var CUP_TOP = 1.3; // 양초 밑면(촛대 컵 안)
  var WICK_UP = 0.9; // 양초 윗면에서 심지 끝까지
  var LAMP_WICK_TIP = 7.2;
  function flameBase(sub, t) {
    return sub === "candle" ? CUP_TOP + candleH(t) + WICK_UP - 0.15 : LAMP_WICK_TIP - 0.1;
  }

  function radialTexture(T, inner, outer) {
    var c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 34, depth: 27, center: [0, 6.6, 0] },
      viewDir: [0, 0.42, 0.91],
      minDistance: 9,
      onPick: ctx.onPick,
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var root = v.root;
      var disposed = false;
      var reduce = reduceMotion();

      // 기본 조명을 조금 낮춰 불꽃 둘레가 밝아지는 모습이 보이게 한다
      v.scene.children.forEach(function (o) {
        if (o.isHemisphereLight) o.intensity = 1.05;
        if (o.isDirectionalLight) o.intensity = 1.0;
      });

      // 탁자
      var tableMat = new T.MeshStandardMaterial({ color: 0xd9c7a3, roughness: 0.85 });
      var table = new T.Mesh(new T.BoxGeometry(44, 0.6, 20), tableMat);
      table.position.y = -0.3;
      root.add(table);
      v.onThemeChange(function (dark) {
        tableMat.color.set(dark ? 0x6b5d45 : 0xd9c7a3);
      });

      var glass = function (op) {
        return new T.MeshStandardMaterial({ color: 0xdcecff, transparent: true, opacity: op, roughness: 0.08, metalness: 0.05, depthWrite: false });
      };

      /* ── 불꽃(모형) ── */
      function makeFlame(kind) {
        var g = new T.Group();
        var inner = kind === "candle" ? 0xff6a2a : 0xa9c6ff;
        var outer = kind === "candle" ? 0xffc53a : 0x5f97ff;
        var sph = new T.SphereGeometry(1, 24, 16);
        var outerMesh = new T.Mesh(sph, new T.MeshBasicMaterial({ color: outer, transparent: true, opacity: kind === "candle" ? 0.92 : 0.62, depthWrite: false }));
        outerMesh.scale.set(0.55, 1.65, 0.55);
        outerMesh.position.y = 1.35;
        outerMesh.renderOrder = 5;
        var innerMesh = new T.Mesh(sph, new T.MeshBasicMaterial({ color: inner, transparent: true, opacity: 0.9, depthWrite: false }));
        innerMesh.scale.set(0.34, 0.75, 0.34);
        innerMesh.position.y = kind === "candle" ? 0.65 : 0.85;
        innerMesh.renderOrder = 6;
        g.add(outerMesh, innerMesh);
        if (kind === "candle") {
          // 바깥쪽 끝을 조금 더 밝게(사실 왜곡 없이 볼거리만 더함, spec 열린 질문 4)
          var tip = new T.Mesh(sph, new T.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.55, depthWrite: false }));
          tip.scale.set(0.3, 0.8, 0.3);
          tip.position.y = 1.9;
          tip.renderOrder = 7;
          g.add(tip);
        } else {
          // 알코올 불꽃: 푸른빛 + 끝의 붉은빛
          var red = new T.Mesh(sph, new T.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0.7, depthWrite: false }));
          red.scale.set(0.26, 0.5, 0.26);
          red.position.y = 2.55;
          red.renderOrder = 7;
          g.add(red);
        }
        var glow = new T.Sprite(
          new T.SpriteMaterial({
            map: radialTexture(T, kind === "candle" ? "rgba(255,214,110,0.6)" : "rgba(170,200,255,0.5)", "rgba(255,255,255,0)"),
            transparent: true,
            depthWrite: false,
          })
        );
        glow.scale.set(10, 10, 1);
        glow.position.y = 1.4;
        glow.renderOrder = 4;
        g.add(glow);
        var light = new T.PointLight(kind === "candle" ? 0xffb347 : 0x9fbcff, 0, 22, 1.2);
        light.position.y = 1.4;
        g.add(light);
        var baseLight = kind === "candle" ? 26 : 16;
        var ph = kind === "candle" ? 0 : 1.7;
        g.userData.grow = 0; // 0: 꺼짐 → 1: 다 자란 불꽃
        g.visible = false;
        // 흔들림: 렌더할 때마다(보이는 동안 계속 그린다)
        outerMesh.onBeforeRender = function () {
          var tt = performance.now() / 1000;
          var k = reduce ? 0.25 : 1;
          var gr = g.userData.grow;
          var sx = 1 + k * 0.05 * Math.sin(tt * 13 + ph);
          var sy = 1 + k * (0.08 * Math.sin(tt * 9.3 + ph) + 0.04 * Math.sin(tt * 21 + ph));
          g.scale.set(gr * sx, gr * sy, gr * sx);
          g.rotation.z = k * 0.07 * Math.sin(tt * 5.1 + ph);
          g.rotation.x = k * 0.04 * Math.sin(tt * 4.3 + ph * 2);
          light.intensity = gr * baseLight * (1 + 0.1 * k * Math.sin(tt * 17 + ph));
        };
        return g;
      }

      /* ── 양초와 촛대 ── */
      var candleG = new T.Group();
      candleG.position.x = X.candle;
      root.add(candleG);
      var brass = M.material(0xc9a24a, { metalness: 0.45, roughness: 0.4 });
      var dish = new T.Mesh(new T.CylinderGeometry(3.0, 3.2, 0.5, 40), brass);
      dish.position.y = 0.25;
      var cup = new T.Mesh(new T.CylinderGeometry(1.35, 1.5, 1.4, 32), brass);
      cup.position.y = 1.15;
      candleG.add(dish, cup);
      var wax = M.material(0xf6f0e1, { roughness: 0.6 });
      var candleBody = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 32), wax);
      candleG.add(candleBody);
      var pool = new T.Mesh(new T.CylinderGeometry(0.84, 0.84, 0.06, 32), new T.MeshStandardMaterial({ color: 0xfffbea, roughness: 0.1, transparent: true, opacity: 0.9 }));
      candleG.add(pool);
      var wick = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, WICK_UP, 8), M.material(0x2b2118));
      candleG.add(wick);
      // 촛농(시간이 지나면 흘러내린다)
      var DRIPS = [
        { a: 0.6, start: 0.8, max: 2.2 },
        { a: 2.3, start: 2.5, max: 2.9 },
        { a: -0.9, start: 4.2, max: 1.8 },
        { a: 3.6, start: 6.0, max: 2.4 },
      ].map(function (d) {
        var m = new T.Mesh(new T.CapsuleGeometry(0.17, 1, 4, 10), wax);
        m.userData = d;
        candleG.add(m);
        return m;
      });
      var candleFlame = makeFlame("candle");
      candleG.add(candleFlame);
      v.pickable(candleG, { sub: "candle" });

      /* ── 알코올램프 ── */
      var lampG = new T.Group();
      lampG.position.x = X.alcohol;
      root.add(lampG);
      var liquidMat = new T.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false });
      var liquid = new T.Mesh(new T.CylinderGeometry(2.82, 2.9, 1, 40), liquidMat);
      liquid.renderOrder = 1;
      lampG.add(liquid);
      var innerWick = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 5.7, 8), M.material(0xe9e2cf));
      innerWick.position.y = 3.3;
      lampG.add(innerWick);
      var body = new T.Mesh(new T.CylinderGeometry(3.0, 3.1, 4.2, 40), glass(0.26));
      body.position.y = 2.1;
      body.renderOrder = 2;
      var shoulder = new T.Mesh(new T.CylinderGeometry(1.2, 3.0, 1.3, 40, 1, true), glass(0.3));
      shoulder.position.y = 4.85;
      shoulder.renderOrder = 2;
      var neck = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 0.7, 32, 1, true), glass(0.3));
      neck.position.y = 5.85;
      neck.renderOrder = 2;
      var holder = new T.Mesh(new T.CylinderGeometry(0.75, 0.9, 0.5, 24), M.material(0x9aa3ad, { metalness: 0.5, roughness: 0.35 }));
      holder.position.y = 6.45;
      var lampWick = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.9, 12), M.material(0xf2efe6));
      lampWick.position.y = LAMP_WICK_TIP - 0.45;
      lampG.add(body, shoulder, neck, holder, lampWick);
      // 뚜껑(불을 붙이지 않았을 때 덮여 있다)
      var cap = new T.Group();
      var capMat = glass(0.4);
      var capSide = new T.Mesh(new T.CylinderGeometry(1.3, 1.36, 1.8, 32, 1, true), capMat);
      var capTop = new T.Mesh(new T.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      capTop.position.y = 0.9;
      cap.add(capSide, capTop);
      cap.renderOrder = 3;
      lampG.add(cap);
      var CAP_ON = new T.Vector3(0, 6.55, 0);
      var CAP_OFF = new T.Vector3(4.6, 0.9, 2.6);
      cap.position.copy(CAP_ON);
      var lampFlame = makeFlame("alcohol");
      lampFlame.position.y = LAMP_WICK_TIP - 0.1;
      lampG.add(lampFlame);
      v.pickable(lampG, { sub: "alcohol" });

      // 이름표(눌러서 고를 수 있다)
      var labels = {};
      C.substances.forEach(function (s) {
        var lb = M.label(s.device, { height: 1.25, bold: true });
        lb.position.set(X[s.id], 0.9, 5.2);
        root.add(lb);
        v.pickable(lb, { sub: s.id });
        labels[s.id] = lb;
      });
      // 고른 물질 표시(바닥 고리)
      var ring = new T.Mesh(new T.RingGeometry(3.5, 3.95, 56), new T.MeshBasicMaterial({ color: 0x2f6fd6, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      ring.visible = false;
      root.add(ring);

      /* ── 점화기(모형) ── */
      var lighter = new T.Group();
      var handle = new T.Mesh(new T.BoxGeometry(1.1, 2.6, 0.8), M.material(0xd8434f));
      handle.position.set(0.3, -1.1, 0);
      var barrel = new T.Mesh(new T.CylinderGeometry(0.22, 0.26, 7, 12), M.material(0x9aa3ad, { metalness: 0.5, roughness: 0.35 }));
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(-3.5, 0, 0);
      var spark = new T.Sprite(new T.SpriteMaterial({ map: radialTexture(T, "rgba(255,230,140,0.95)", "rgba(255,200,80,0)"), transparent: true, depthWrite: false }));
      spark.position.set(-7.2, 0, 0);
      spark.scale.set(0.01, 0.01, 1);
      lighter.add(handle, barrel, spark);
      lighter.visible = false;
      root.add(lighter);

      /* ── 따뜻한 정도(모형): 불꽃 둘레의 붉은 번짐 + 가까이/멀리 표시 ── */
      var warmG = new T.Group();
      warmG.visible = false;
      root.add(warmG);
      var heatMat = new T.SpriteMaterial({ map: radialTexture(T, "rgba(232,70,40,0.55)", "rgba(232,70,40,0)"), transparent: true, depthWrite: false, opacity: 1 });
      var heat = new T.Sprite(heatMat);
      heat.scale.set(15, 15, 1);
      heat.renderOrder = 3;
      warmG.add(heat);
      var nearDot = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), new T.MeshBasicMaterial({ color: 0xd8434f }));
      var farDot = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), new T.MeshBasicMaterial({ color: 0xf2a93b }));
      var nearLbl = M.label("가까이 · 따뜻함 ●●●", { height: 1.1, bold: true, border: "#d8434f", color: "#9e1f2b" });
      var farLbl = M.label("멀리 · 따뜻함 ●○○", { height: 1.1, bold: true, border: "#d9822b", color: "#7a4a10" });
      warmG.add(nearDot, farDot, nearLbl, farLbl);
      var warmSub = null;
      function placeWarm(sub) {
        var base = flameBase(sub, burn[sub].t) + 1.3;
        var s = SIDE[sub];
        heat.position.set(X[sub], base, 0);
        nearDot.position.set(X[sub] + s * 2.8, base, 0);
        farDot.position.set(X[sub] + s * 7.2, base, 0);
        nearLbl.position.set(X[sub] + s * 3.6, base - 1.5, 0);
        farLbl.position.set(X[sub] + s * 7.2, base + 1.5, 0);
      }
      function setWarm(sub, animate) {
        warmSub = sub;
        if (!sub) {
          warmG.visible = false;
          return Promise.resolve();
        }
        placeWarm(sub);
        warmG.visible = true;
        if (!animate) {
          heatMat.opacity = 1;
          return Promise.resolve();
        }
        heatMat.opacity = 0;
        nearLbl.visible = farLbl.visible = false;
        return v
          .tween(900, function (t) {
            heatMat.opacity = t;
          })
          .then(function () {
            nearLbl.visible = true;
            return v.wait(350);
          })
          .then(function () {
            farLbl.visible = true;
          });
      }

      /* ── 상태 적용 ── */
      var shown = { candle: { lit: false, t: 0 }, alcohol: { lit: false, t: 0 } };
      var animating = {}; // 불 붙이는 중인 물질(상태 적용이 애니메이션을 덮지 않게)
      function applyCandle(st) {
        var h = candleH(st.t);
        candleBody.scale.set(1, h, 1);
        candleBody.position.y = CUP_TOP + h / 2;
        var top = CUP_TOP + h;
        pool.position.y = top + 0.02;
        pool.visible = !!st.lit;
        wick.position.y = top + WICK_UP / 2;
        DRIPS.forEach(function (m) {
          var d = m.userData;
          var L = st.lit ? clamp((st.t - d.start) / (TMAX - d.start + 1.5), 0, 1) * d.max : 0;
          m.visible = L > 0.05;
          if (!m.visible) return;
          m.scale.set(1, L, 1);
          m.position.set(Math.cos(d.a) * 1.02, top - 0.12 - L / 2, Math.sin(d.a) * 1.02);
        });
        candleFlame.position.y = flameBase("candle", st.t);
        if (!animating.candle) {
          candleFlame.userData.grow = st.lit ? 1 : 0;
          candleFlame.visible = !!st.lit;
        }
      }
      function applyLamp(st) {
        var lv = alcLevel(st.t);
        var hh = lv * 4.05;
        liquid.scale.set(1, hh, 1);
        liquid.position.y = 0.08 + hh / 2;
        if (!animating.alcohol) {
          lampFlame.userData.grow = st.lit ? 1 : 0;
          lampFlame.visible = !!st.lit;
          cap.position.copy(st.lit ? CAP_OFF : CAP_ON);
        }
      }
      function setBurn(sub, st) {
        if (disposed) return;
        shown[sub] = { lit: !!st.lit, t: st.t };
        if (sub === "candle") applyCandle(shown[sub]);
        else applyLamp(shown[sub]);
        if (warmSub === sub) {
          if (!st.lit) warmG.visible = false;
          else placeWarm(sub);
        }
      }

      function ignite(sub) {
        if (disposed) return Promise.resolve();
        animating[sub] = true;
        var flame = sub === "candle" ? candleFlame : lampFlame;
        var tip = new T.Vector3(X[sub], flameBase(sub, 0) + 0.25, 0);
        var home = new T.Vector3(X[sub] + 13, tip.y + 3, 4);
        var near = new T.Vector3(tip.x + 7.4, tip.y, 0.4);
        lighter.position.copy(home);
        lighter.visible = true;
        spark.scale.set(0.01, 0.01, 1);
        var p = Promise.resolve();
        if (sub === "alcohol") {
          // 뚜껑을 열어 옆에 둔다
          var from = cap.position.clone();
          p = p.then(function () {
            return v.tween(600, function (t) {
              cap.position.lerpVectors(from, CAP_OFF, t);
              cap.position.y += Math.sin(t * Math.PI) * 1.8;
            });
          });
        }
        return p
          .then(function () {
            return v.tween(650, function (t) {
              lighter.position.lerpVectors(home, near, t);
            });
          })
          .then(function () {
            return v.tween(260, function (t) {
              var s = 0.4 + 1.4 * Math.sin(t * Math.PI);
              spark.scale.set(s, s, 1);
            });
          })
          .then(function () {
            flame.visible = true;
            return v.tween(500, function (t) {
              flame.userData.grow = t;
            });
          })
          .then(function () {
            return v.tween(550, function (t) {
              lighter.position.lerpVectors(near, home, t);
            });
          })
          .then(function () {
            lighter.visible = false;
            animating[sub] = false; // 불꽃 상태는 앱이 drawNow로 맞춘다
          });
      }

      function focusOn(sub) {
        return v.focus([X[sub], flameBase(sub, shown[sub].t) + 1.3, 0], 0.46, 900);
      }

      // '사진'(전/후 비교): 같은 자리(삼각대)에서 찍는다. 찍는 순간에만 t를 바꾸고 되돌린다.
      function photo(sub, t) {
        if (disposed) return null;
        var keep = { lit: shown[sub].lit, t: shown[sub].t };
        var keepWarm = warmG.visible;
        warmG.visible = false;
        setBurn(sub, { lit: true, t: t });
        var markAt = sub === "candle" ? [X[sub], CUP_TOP + candleH(t), 1.05] : [X[sub], 0.08 + alcLevel(t) * 4.05, 3.0];
        var snap = v.snapshot({
          pose: sub === "candle" ? { position: [X[sub] + 0.8, 8.8, 17.5], target: [X[sub], 6.6, 0] } : { position: [X[sub] + 0.8, 7, 14], target: [X[sub], 4.6, 0] },
          width: 360,
          hide: [ring, labels.candle, labels.alcohol],
          marks: [{ at: markAt, radius: 0.06, label: sub === "candle" ? "양초 윗부분" : "알코올 높이" }],
        });
        setBurn(sub, keep);
        warmG.visible = keepWarm;
        if (!snap || !snap.url) return null;
        return el("img", { src: snap.url, alt: "", width: String(snap.width), height: String(snap.height), class: "ph-img" });
      }

      return {
        setBurn: setBurn,
        ignite: ignite,
        focusOn: focusOn,
        flyHome: function () {
          return v.flyHome(500);
        },
        wait: function (ms) {
          return v.wait(ms);
        },
        setWarm: setWarm,
        photo: photo,
        highlight: function (sel) {
          ring.visible = !!sel.sub;
          if (sel.sub) ring.position.x = X[sel.sub];
          if (!(sel.method === "warm" && sel.sub === warmSub)) setWarm(null);
        },
        clear: function () {
          setWarm(null);
          v.flyHome(500);
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

  /* ───────── 2D 장면(SVG, 옆에서 본 모습) ───────── */
  var P2 = 13; // 1 단위 = 13 px
  var X2 = { candle: 180, alcohol: 470 };
  var TABLE2 = 268;
  var CUP2 = 252; // 양초 밑면
  var LAMP_TIP2 = 170;
  function flameBase2(sub, t) {
    return sub === "candle" ? CUP2 - candleH(t) * P2 - 11 : LAMP_TIP2;
  }
  var svgUid = 0;
  // 장면 SVG 하나를 만든다(2D 화면과 2D '사진'이 함께 쓴다)
  function makeScene2D(opts) {
    opts = opts || {};
    var uid = "s6222-" + ++svgUid;
    var root = svg("svg", { viewBox: opts.viewBox || "0 0 640 320", class: "d2-svg" + (opts.photo ? " is-photo" : ""), role: "img" });
    var defs = svg("defs");
    function lin(id, stops) {
      var g = svg("linearGradient", { id: uid + id, x1: 0, y1: 1, x2: 0, y2: 0 });
      stops.forEach(function (s) {
        g.appendChild(svg("stop", { offset: s[0], "stop-color": s[1] }));
      });
      defs.appendChild(g);
    }
    function rad(id, c1, c2) {
      var g = svg("radialGradient", { id: uid + id });
      g.appendChild(svg("stop", { offset: "0", "stop-color": c1 }));
      g.appendChild(svg("stop", { offset: "1", "stop-color": c2 }));
      defs.appendChild(g);
    }
    lin("fc", [["0", "#ff6a2a"], ["0.35", "#ffb13a"], ["1", "#ffe27a"]]);
    lin("fa", [["0", "#4f86ff"], ["0.7", "#8db6ff"], ["1", "#ff8a5c"]]);
    rad("gc", "rgba(255,214,110,0.75)", "rgba(255,214,110,0)");
    rad("ga", "rgba(170,200,255,0.65)", "rgba(170,200,255,0)");
    rad("heat", "rgba(232,70,40,0.5)", "rgba(232,70,40,0)");
    var clip = svg("clipPath", { id: uid + "body" });
    clip.appendChild(svg("rect", { x: X2.alcohol - 38, y: 212, width: 76, height: 54, rx: 10 }));
    defs.appendChild(clip);
    root.appendChild(defs);
    root.appendChild(svg("rect", { x: 0, y: 0, width: 640, height: TABLE2, class: "d2-bg" }));
    root.appendChild(svg("rect", { x: 0, y: TABLE2, width: 640, height: 60, class: "d2-table" }));

    // 고른 물질 표시
    var selMark = svg("ellipse", { cx: 0, cy: TABLE2 + 4, rx: 70, ry: 10, class: "d2-sel", visibility: "hidden" });
    root.appendChild(selMark);

    // 따뜻한 정도(모형)
    var warm = svg("g", { class: "d2-warm", visibility: "hidden" });
    var heatC = svg("circle", { r: 96, fill: "url(#" + uid + "heat)" });
    var nearC = svg("circle", { r: 7, class: "d2-near" });
    var farC = svg("circle", { r: 7, class: "d2-far" });
    var nearT = svg("text", { class: "d2-warm-t d2-warm-near", "text-anchor": "middle" }, "가까이 ●●●");
    var farT = svg("text", { class: "d2-warm-t d2-warm-far", "text-anchor": "middle" }, "멀리 ●○○");
    warm.appendChild(heatC);
    warm.appendChild(nearC);
    warm.appendChild(farC);
    warm.appendChild(nearT);
    warm.appendChild(farT);

    // 양초와 촛대
    var cx = X2.candle;
    var cg = svg("g", { class: "d2-obj", "data-sub": "candle" });
    var cGlow = svg("circle", { cx: cx, r: 70, fill: "url(#" + uid + "gc)", visibility: "hidden" });
    cg.appendChild(cGlow);
    cg.appendChild(svg("rect", { x: cx - 42, y: TABLE2 - 8, width: 84, height: 8, rx: 4, class: "d2-brass" }));
    cg.appendChild(svg("rect", { x: cx - 19, y: CUP2 - 8, width: 38, height: 18, rx: 4, class: "d2-brass" }));
    var cBody = svg("rect", { x: cx - 13, width: 26, class: "d2-wax" });
    cg.appendChild(cBody);
    var cDrips = [
      { dx: -13, start: 0.8, max: 2.2 },
      { dx: 11, start: 2.5, max: 2.9 },
      { dx: -8, start: 4.2, max: 1.8 },
      { dx: 6, start: 6.0, max: 2.4 },
    ].map(function (d) {
      var r = svg("rect", { x: cx + d.dx - 2, width: 5, rx: 2.5, class: "d2-drip" });
      r.__d = d;
      cg.appendChild(r);
      return r;
    });
    var cPool = svg("ellipse", { cx: cx, rx: 11, ry: 3, class: "d2-pool" });
    cg.appendChild(cPool);
    var cWick = svg("line", { x1: cx, x2: cx, class: "d2-wick" });
    cg.appendChild(cWick);
    var cFlame = svg("g", { class: "d2-flame", visibility: "hidden" });
    var cFlameIn = svg("g", { class: "d2-flicker" });
    cFlameIn.appendChild(svg("ellipse", { cx: 0, cy: -24, rx: 10, ry: 27, fill: "url(#" + uid + "fc)" }));
    cFlameIn.appendChild(svg("ellipse", { cx: 0, cy: -9, rx: 5, ry: 10, fill: "#ff6a2a", opacity: 0.85 }));
    cFlame.appendChild(cFlameIn);
    cg.appendChild(cFlame);
    root.appendChild(cg);

    // 알코올램프
    var ax = X2.alcohol;
    var ag = svg("g", { class: "d2-obj", "data-sub": "alcohol" });
    var aGlow = svg("circle", { cx: ax, r: 64, fill: "url(#" + uid + "ga)", visibility: "hidden" });
    ag.appendChild(aGlow);
    var aLiq = svg("rect", { x: ax - 40, width: 80, class: "d2-liquid", "clip-path": "url(#" + uid + "body)" });
    ag.appendChild(aLiq);
    ag.appendChild(svg("line", { x1: ax, x2: ax, y1: 262, y2: 184, class: "d2-inwick" }));
    ag.appendChild(svg("path", { d: "M" + (ax - 40) + " 268 V222 Q" + (ax - 40) + " 210 " + (ax - 28) + " 208 L" + (ax - 15) + " 194 V184 H" + (ax + 15) + " V194 L" + (ax + 28) + " 208 Q" + (ax + 40) + " 210 " + (ax + 40) + " 222 V268 Z", class: "d2-glass" }));
    ag.appendChild(svg("rect", { x: ax - 10, y: 178, width: 20, height: 7, rx: 2, class: "d2-metal" }));
    ag.appendChild(svg("rect", { x: ax - 3, y: LAMP_TIP2, width: 6, height: 9, class: "d2-lampwick" }));
    var aCap = svg("path", { d: "M-17 32 V6 Q-17 -12 0 -12 Q17 -12 17 6 V32 Z", class: "d2-cap" });
    ag.appendChild(aCap);
    var aFlame = svg("g", { class: "d2-flame", visibility: "hidden", transform: "translate(" + ax + "," + LAMP_TIP2 + ")" });
    var aFlameIn = svg("g", { class: "d2-flicker d2-flicker-b" });
    aFlameIn.appendChild(svg("ellipse", { cx: 0, cy: -24, rx: 10, ry: 26, fill: "url(#" + uid + "fa)", opacity: 0.85 }));
    aFlameIn.appendChild(svg("ellipse", { cx: 0, cy: -10, rx: 5, ry: 10, fill: "#a9c6ff", opacity: 0.85 }));
    aFlame.appendChild(aFlameIn);
    ag.appendChild(aFlame);
    root.appendChild(ag);
    root.appendChild(warm);

    // 이름
    C.substances.forEach(function (s) {
      root.appendChild(svg("text", { x: X2[s.id], y: TABLE2 + 36, "text-anchor": "middle", class: "d2-name" }, s.device));
    });

    // 점화기
    var lighter = svg("g", { class: "d2-lighter", visibility: "hidden" });
    lighter.appendChild(svg("rect", { x: 0, y: -3, width: 92, height: 6, rx: 3, class: "d2-metal" }));
    lighter.appendChild(svg("rect", { x: 88, y: -8, width: 16, height: 40, rx: 4, class: "d2-lighter-h" }));
    var spark = svg("circle", { cx: -2, cy: 0, r: 0, class: "d2-spark" });
    lighter.appendChild(spark);
    root.appendChild(lighter);

    var state = { candle: { lit: false, t: 0 }, alcohol: { lit: false, t: 0 } };
    var anim = {};
    var warmSub = null;
    function capOn(on) {
      aCap.setAttribute("transform", on ? "translate(" + ax + ",162)" : "translate(" + (ax + 76) + ",236)");
    }
    function apply(sub) {
      var st = state[sub];
      if (sub === "candle") {
        var h = candleH(st.t) * P2;
        var top = CUP2 - h;
        cBody.setAttribute("y", top.toFixed(1));
        cBody.setAttribute("height", h.toFixed(1));
        cPool.setAttribute("cy", (top + 1).toFixed(1));
        cPool.setAttribute("visibility", st.lit ? "visible" : "hidden");
        cWick.setAttribute("y1", top.toFixed(1));
        cWick.setAttribute("y2", (top - 11).toFixed(1));
        cDrips.forEach(function (r) {
          var d = r.__d;
          var L = st.lit ? clamp((st.t - d.start) / (TMAX - d.start + 1.5), 0, 1) * d.max * P2 : 0;
          r.setAttribute("visibility", L > 1 ? "visible" : "hidden");
          r.setAttribute("y", (top - 1).toFixed(1));
          r.setAttribute("height", Math.max(0, L).toFixed(1));
        });
        cGlow.setAttribute("cy", (top - 11 - 22).toFixed(1));
        cFlame.setAttribute("transform", "translate(" + cx + "," + (top - 11).toFixed(1) + ")");
        if (!anim.candle) {
          cFlame.setAttribute("visibility", st.lit ? "visible" : "hidden");
          cGlow.setAttribute("visibility", st.lit ? "visible" : "hidden");
        }
      } else {
        var lh = alcLevel(st.t) * 58;
        aLiq.setAttribute("y", (266 - lh).toFixed(1));
        aLiq.setAttribute("height", lh.toFixed(1));
        aGlow.setAttribute("cy", LAMP_TIP2 - 22);
        if (!anim.alcohol) {
          aFlame.setAttribute("visibility", st.lit ? "visible" : "hidden");
          aGlow.setAttribute("visibility", st.lit ? "visible" : "hidden");
          capOn(!st.lit);
        }
      }
      if (warmSub === sub) placeWarm(sub);
    }
    function placeWarm(sub) {
      var fy = flameBase2(sub, state[sub].t) - 24;
      var s = SIDE[sub];
      var x0 = X2[sub];
      heatC.setAttribute("cx", x0);
      heatC.setAttribute("cy", fy);
      nearC.setAttribute("cx", x0 + s * 36);
      nearC.setAttribute("cy", fy);
      farC.setAttribute("cx", x0 + s * 124);
      farC.setAttribute("cy", fy);
      nearT.setAttribute("x", x0 + s * 50);
      nearT.setAttribute("y", fy + 28);
      farT.setAttribute("x", x0 + s * 124);
      farT.setAttribute("y", fy - 16);
      warm.setAttribute("visibility", state[sub].lit ? "visible" : "hidden");
    }
    capOn(true);
    apply("candle");
    apply("alcohol");
    return {
      node: root,
      state: state,
      setBurn: function (sub, st) {
        state[sub] = { lit: !!st.lit, t: st.t };
        apply(sub);
      },
      setSel: function (sub) {
        selMark.setAttribute("visibility", sub ? "visible" : "hidden");
        if (sub) selMark.setAttribute("cx", X2[sub]);
      },
      setWarm: function (sub, animate) {
        warmSub = sub;
        if (!sub) {
          warm.setAttribute("visibility", "hidden");
          return Promise.resolve();
        }
        placeWarm(sub);
        if (!animate) {
          warm.style.opacity = "";
          return Promise.resolve();
        }
        return tween2(900, function (t) {
          warm.style.opacity = String(t);
        });
      },
      ignite: function (sub) {
        anim[sub] = true;
        var tipX = X2[sub];
        var tipY = flameBase2(sub, 0) + 2;
        var hx = tipX + 150;
        var hy = tipY - 40;
        var fl = sub === "candle" ? cFlame : aFlame;
        var gl = sub === "candle" ? cGlow : aGlow;
        lighter.setAttribute("visibility", "visible");
        lighter.setAttribute("transform", "translate(" + hx + "," + hy + ")");
        var p = Promise.resolve();
        if (sub === "alcohol") {
          p = p.then(function () {
            return tween2(600, function (t) {
              aCap.setAttribute("transform", "translate(" + (ax + 76 * t) + "," + (162 + 74 * t - Math.sin(t * Math.PI) * 30) + ")");
            });
          });
        }
        return p
          .then(function () {
            return tween2(650, function (t) {
              lighter.setAttribute("transform", "translate(" + (hx + (tipX + 6 - hx) * t) + "," + (hy + (tipY - hy) * t) + ")");
            });
          })
          .then(function () {
            return tween2(260, function (t) {
              spark.setAttribute("r", (10 * Math.sin(t * Math.PI)).toFixed(1));
            });
          })
          .then(function () {
            fl.setAttribute("visibility", "visible");
            gl.setAttribute("visibility", "visible");
            return tween2(500, function (t) {
              fl.style.opacity = String(t);
              gl.style.opacity = String(t);
            });
          })
          .then(function () {
            return tween2(550, function (t) {
              lighter.setAttribute("transform", "translate(" + (tipX + 6 + (hx - tipX - 6) * t) + "," + (tipY + (hy - tipY) * t) + ")");
            });
          })
          .then(function () {
            lighter.setAttribute("visibility", "hidden");
            spark.setAttribute("r", "0");
            fl.style.opacity = "";
            gl.style.opacity = "";
            anim[sub] = false;
          });
      },
      describe: function () {
        return C.substances
          .map(function (s) {
            var st = state[s.id];
            return st.lit ? s.device + ": 불이 붙어 있어요(" + minText(st.t) + ", 불꽃이 계속 흔들리며 타요). " + amountText(s.id, st.t) + "." : s.device + ": 불이 붙어 있지 않아요.";
          })
          .join(" ");
      },
    };
  }

  function build2D(container, ctx) {
    container.textContent = "";
    var btns = {};
    var row = el("div", { class: "b2-row", role: "group", "aria-label": "물질 고르기(2D 모형)" });
    C.substances.forEach(function (s) {
      var b = el("button", { type: "button", class: "b2-pick", "aria-pressed": "false", onclick: function () {
        ctx.onPick({ sub: s.id });
      } }, [el("span", { "aria-hidden": "true", text: s.icon }), " " + s.device]);
      btns[s.id] = b;
      row.appendChild(b);
    });
    var sc = makeScene2D();
    var legend = el("p", { class: "d2-legend", hidden: true, text: "●●● 더 따뜻해요 · ●○○ 조금 따뜻해요 (모형: 온도는 숫자로 재지 않아요)" });
    container.appendChild(el("div", { class: "d2-wrap" }, [row, sc.node, legend]));
    var disposed = false;
    var warmOn = null;
    function describe() {
      sc.node.setAttribute("aria-label", "옆에서 본 실험대 모형. " + sc.describe());
    }
    describe();
    return {
      setBurn: function (sub, st) {
        if (disposed) return;
        sc.setBurn(sub, st);
        describe();
      },
      ignite: function (sub) {
        return sc.ignite(sub);
      },
      focusOn: function () {
        return sleep(400);
      },
      flyHome: function () {
        return Promise.resolve();
      },
      wait: sleep,
      setWarm: function (sub, animate) {
        warmOn = sub;
        legend.hidden = !sub;
        return sc.setWarm(sub, animate);
      },
      photo: function (sub, t) {
        var ph = makeScene2D({ photo: true, viewBox: sub === "candle" ? "60 60 240 230" : "350 60 240 230" });
        ph.setBurn(sub, { lit: true, t: t });
        ph.node.setAttribute("aria-hidden", "true");
        ph.node.classList.add("ph-img");
        return ph.node;
      },
      highlight: function (sel) {
        Object.keys(btns).forEach(function (id) {
          btns[id].setAttribute("aria-pressed", String(sel.sub === id));
        });
        sc.setSel(sel.sub || null);
        if (!(sel.method === "warm" && sel.sub && sel.sub === warmOn)) {
          warmOn = null;
          legend.hidden = true;
          sc.setWarm(null);
        }
      },
      clear: function () {
        warmOn = null;
        legend.hidden = true;
        sc.setWarm(null);
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
      },
    };
  }

  // 공통 틀에 넘기는 장면: 만든 장면을 curView로 잡아 시간 바와 연결하고, 실행(run)을 이 차시 방식으로 한다
  function wrapView(v) {
    if (!v) return v;
    var wrapped = Object.assign({}, v, {
      run: function (sel) {
        return runSel(wrapped, sel);
      },
      showInstant: function (sel) {
        // 새로고침·화면 전환 뒤: 타는 상태는 drawNow가 맞춘다. 따뜻한 정도는 지금 고른 칸일 때만 다시 보인다.
        if (sel.method === "warm" && burn[sel.sub].lit && curSel.sub === sel.sub && curSel.method === "warm") {
          v.setWarm(sel.sub, false);
        }
      },
      highlight: function (sel) {
        curSel = Object.assign({}, sel);
        v.highlight(sel);
        if (bar) bar.draw();
      },
      clear: function () {
        v.clear();
        C.substances.forEach(function (s) {
          burn[s.id].lit = false;
          burn[s.id].t = 0;
        });
        lastPhotos = null;
        burnEpoch++;
        saveBurn();
        drawNow();
        if (bar) bar.announce("불을 끄고 처음 상태로 되돌렸어요.");
        exp.refresh();
      },
      dispose: function () {
        if (curView === wrapped) curView = null;
        v.dispose();
      },
    });
    curView = wrapped;
    C.substances.forEach(function (s) {
      wrapped.setBurn(s.id, burn[s.id]);
    });
    if (bar) bar.draw();
    return wrapped;
  }

  // 실행: 불이 없으면 먼저 붙이고, 관찰 항목에 따라 살펴보기
  async function runSel(v, sel) {
    var sub = sel.sub;
    if (!burn[sub].lit) await igniteSub(sub);
    if (curView !== v) return;
    if (sel.method === "look") {
      v.setWarm(null);
      await v.focusOn(sub);
      await v.wait(600);
    } else if (sel.method === "warm") {
      await v.flyHome();
      await v.setWarm(sub, true);
    } else {
      // 그 밖에 관찰한 것: 불을 붙인 직후와 시간 바로 흘려 보낸 뒤를 같은 자리에서 찍은 사진으로 비교
      v.setWarm(null);
      await v.flyHome();
      var tAfter = burn[sub].t >= TNEED ? burn[sub].t : Math.max(burn[sub].maxT, TNEED);
      burn[sub].t = tAfter;
      burn[sub].maxT = Math.max(burn[sub].maxT, tAfter);
      saveBurn();
      drawNow();
      lastPhotos = { sub: sub, t: tAfter, before: v.photo(sub, 0), after: v.photo(sub, tAfter) };
      await v.wait(300);
    }
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
    el("summary", { text: "⚠️ 실제 실험에서 지켜요" }),
    el(
      "ul",
      null,
      C.safety.map(function (t) {
        return el("li", { text: t });
      })
    ),
  ]);
  // 실험하기 도입의 안전 안내 한 줄(접히지 않게 따로 둔다)
  $("experiment-root").parentNode.insertBefore(el("p", { class: "ss-card safety-line", role: "note" }, [el("span", { "aria-hidden": "true", text: "🧯 " }), C.safetyLine]), $("experiment-root"));

  var allCells = [];
  C.substances.forEach(function (s) {
    C.methods.forEach(function (m) {
      allCells.push({ sub: s.id, method: m.id });
    });
  });

  function runLabel(sel) {
    var s = SUB[sel.sub];
    var pre = burn[sel.sub].lit ? "▶ " : "▶ 🔥 불 붙이고 ";
    if (sel.method === "look") return pre + s.name + " 불꽃 살펴보기";
    if (sel.method === "warm") return pre + "가까이·멀리 따뜻한 정도 느껴 보기";
    return "📷 처음과 나중 모습을 사진으로 비교하기";
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: "🔎 실험 방법 알아 두기",
    modelNote: C.modelNote,
    clearLabel: "🧯 불 끄고 처음 상태로",
    clearMessage: "불을 끄고 처음 상태로 되돌렸어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "sub",
        title: "물질 고르기",
        short: "물질",
        options: C.substances.map(function (s) {
          return { id: s.id, label: s.name === s.device ? s.name : s.name + " (" + s.device + ")", icon: function () {
            return el("span", { class: "opt-icon", "aria-hidden": "true", text: s.icon });
          } };
        }),
      },
      {
        id: "method",
        title: "관찰 항목 고르기",
        short: "관찰 항목",
        options: C.methods.map(function (m) {
          return { id: m.id, label: m.name, icon: function () {
            return el("span", { class: "opt-icon", "aria-hidden": "true", text: m.icon });
          } };
        }),
        note: function (sel) {
          if (!sel.sub || !sel.method) return null;
          var s = SUB[sel.sub];
          if (sel.method === "change") {
            if (!burn[sel.sub].lit) return "⏳ 먼저 빨리 감기 바 위의 '🔥 불 붙이기'로 " + s.device + "에 불을 붙인 뒤, 바를 끌어 봐요.";
            if (!explored(sel.sub)) return "⏳ 빨리 감기 바를 가운데 점선까지 끌어 시간이 흐르는 모습을 먼저 살펴봐요.";
            return "✅ 시간이 흐르는 모습을 살펴봤어요. 📷 버튼을 눌러 처음과 나중을 비교해요.";
          }
          return null; // 불꽃의 모습·따뜻한 정도는 관찰 카드에 안내가 있어 여기서는 되풀이하지 않는다
        },
      },
    ],
    phases: [{ id: "M", name: "관찰", title: "양초와 알코올이 탈 때 관찰하기", lead: "물질과 관찰 항목을 바꿔 가며 살펴보고 6칸을 모두 기록해요.", cells: allCells }],
    doneLead: "6칸을 모두 기록했어요! '다음 단계'로 가서 표를 보고 분석해 보세요. 빨리 감기 바와 실험은 계속 해 볼 수 있어요.",
    cellKey: function (sel) {
      return keyOf(sel.sub, sel.method);
    },
    runLabel: runLabel,
    busyLabel: function (sel) {
      return !burn[sel.sub].lit ? "🔥 점화기로 불을 붙이는 중…" : "살펴보는 중… 잘 지켜보세요 👀";
    },
    canRun: function (sel) {
      if (sel.method !== "change") return true;
      var s = SUB[sel.sub];
      if (!burn[sel.sub].lit) return "먼저 빨리 감기 바 위의 '🔥 불 붙이기'로 " + s.device + "에 불을 붙인 뒤, 바를 끌어 봐요.";
      if (!explored(sel.sub)) return "먼저 빨리 감기 바를 가운데 점선까지 끌어 시간이 흐르는 모습을 살펴봐요.";
      return true;
    },
    onRunBlocked: function () {
      if (bar) bar.nudge();
    },
    onBusy: function (on) {
      expBusy = on;
      if (bar) bar.draw();
    },
    view: {
      build3D: function (c, ctx) {
        return build3D(c, ctx).then(wrapView);
      },
      build2D: function (c, ctx) {
        return wrapView(build2D(c, ctx));
      },
      tip3D: "👆 드래그: 돌려 보기 · 두 번 탭: 처음 방향 · 기구를 눌러 고를 수도 있어요",
      tip2D: "2D 화면(옆에서 본 모습, 모형)이에요. 위의 버튼으로 물질을 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { sub: sel.sub, method: sel.method, result: observed };
    },
    describeRecord: function (r) {
      return SUB[r.sub].name + " · " + MET[r.method].short;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.methods.map(function (m) {
        return { id: m.id, label: m.icon + " " + m.short };
      }),
      cols: C.substances.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      sel: function (r, c) {
        return { sub: c.id, method: r.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  /* 관찰·기록 카드: 화면에서 본 모습 + 보기 고르기 + 확인하기 */
  function observeCard(sel) {
    var s = SUB[sel.sub];
    var body = el("div", { class: "ob-body" });
    var question;
    var wrongMsg;
    if (sel.method === "look") {
      question = S.josa(s.name, "이", "가") + " 탈 때 불꽃은 어떤가요?";
      var nameEl = el("p", { class: "ob-name", hidden: true, text: "불꽃 색 이름: " + C.flameColorName[sel.sub] });
      var btn = el("button", { type: "button", class: "ss-btn ss-btn-ghost small-btn", text: "🎨 색 이름 보기", "aria-pressed": "false" });
      btn.addEventListener("click", function () {
        nameEl.hidden = !nameEl.hidden;
        btn.textContent = nameEl.hidden ? "🎨 색 이름 보기" : "🎨 색 이름 숨기기";
        btn.setAttribute("aria-pressed", String(!nameEl.hidden));
      });
      body.appendChild(
        el("div", { class: "ob-row" }, [
          el("span", { class: "ob-flame is-" + sel.sub, "aria-hidden": "true" }, [el("span", { class: "ob-flame-in" })]),
          el("div", { class: "ob-side" }, [el("p", { class: "ob-seen", text: "👀 모양, 주변의 밝기, 색깔을 살펴보고 골라요(모형)." }), nameEl, btn]),
        ])
      );
      wrongMsg = "3D 화면에서 불꽃의 모양, 불꽃 주변의 밝기, 불꽃의 색깔을 하나씩 다시 살펴보세요.";
    } else if (sel.method === "warm") {
      question = "불꽃 옆 가까운 곳과 먼 곳의 따뜻한 정도는 어떤가요?";
      body.appendChild(
        el("div", { class: "ob-warm", role: "group", "aria-label": "따뜻한 정도(모형)" }, [
          el("p", { class: "ob-meter" }, [el("span", { class: "ob-mname", text: "🖐️ 가까이(불꽃 옆)" }), el("span", { class: "ob-dots is-hot", text: "●●●" }), el("span", { class: "ob-mtext", text: "매우 따뜻해요" })]),
          el("p", { class: "ob-meter" }, [el("span", { class: "ob-mname", text: "🖐️ 멀리" }), el("span", { class: "ob-dots is-mild", text: "●○○" }), el("span", { class: "ob-mtext", text: "조금 따뜻해요" })]),
          el("p", { class: "ss-help", text: "모형: 실제로는 손을 불꽃 가까이 대지 않아요. 온도는 숫자로 재지 않아요." }),
        ])
      );
      wrongMsg = "'가까이'와 '멀리' 두 곳의 따뜻한 정도 표시를 다시 비교해 보세요.";
    } else {
      question = "시간이 지나면서 " + (sel.sub === "candle" ? "양초" : "알코올") + "에 어떤 변화가 있었나요?";
      var ph = lastPhotos && lastPhotos.sub === sel.sub ? lastPhotos : null;
      if (ph && ph.before && ph.after) {
        body.appendChild(
          el("div", { class: "ph-row" }, [
            el("figure", { class: "ph-fig" }, [ph.before, el("figcaption", { text: "📷 처음 (불을 붙인 직후)" })]),
            el("figure", { class: "ph-fig" }, [ph.after, el("figcaption", { text: "📷 나중 (" + minText(ph.t) + ", 빨리 감기 모형)" })]),
          ])
        );
        body.appendChild(el("p", { class: "ss-help", text: "같은 자리에서 찍은 사진이에요. 두 사진에서 " + (sel.sub === "candle" ? "양초의 길이와 옆면을" : "알코올램프 속 알코올의 높이를") + " 비교해 보세요." }));
      } else {
        body.appendChild(el("p", { class: "ob-seen", text: "⏳ 빨리 감기 바를 끌면서 " + (sel.sub === "candle" ? "양초의 길이와 옆면을" : "알코올램프 속 알코올의 높이를") + " 살펴보세요." }));
      }
      wrongMsg = "처음 사진과 나중 사진에서 " + (sel.sub === "candle" ? "양초의 길이와 옆면을" : "알코올의 높이를") + " 다시 비교해 보세요.";
    }
    var answer = C.answers[sel.sub][sel.method];
    return {
      question: question,
      body: body,
      type: "choice",
      choices: C.observeChoices[sel.method][sel.sub],
      check: function (observed) {
        return observed === answer ? { ok: true, message: "⭕ 맞아요! 화면에서 본 모습과 같아요. '📝 기록하기'를 눌러 기록해요." } : wrongMsg;
      },
      retryLabel: sel.method === "change" ? null : "🔁 다시 살펴보기",
    };
  }

  /* 확인을 통과하면 📝 기록하기 버튼이 아래쪽 이동 막대에 가리지 않게 보이도록 올린다 — 공통 틀의 규칙(exp.revealRecord:
     기록하기가 꺼져 있으면 그대로, 크게 보기에서는 장면 안 막대와 관찰 카드가 함께 보이게) */
  $("experiment-root").addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest(".ss-check-btn")) return;
    setTimeout(function () {
      exp.revealRecord();
    }, 60);
  });

  /* ───────── 시간 바(실험 화면 바로 아래) ───────── */
  var bar = (function () {
    var viewBox = $("experiment-root").querySelector(".ss-exp-view");
    var fast = el("div", { class: "scene-fast", "aria-hidden": "true", hidden: true, text: "⏩ 빨리 감기(모형)" });
    viewBox.appendChild(fast);

    var title = el("strong", { class: "tb-title" });
    var badge = el("span", { class: "tb-badge", text: "모형" });
    var igniteBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary tb-ignite" });
    var fill = el("div", { class: "tb-fill" });
    var thumb = el("div", { class: "tb-thumb", "aria-hidden": "true" });
    var railTicks = el("div", { class: "tb-rail-ticks", "aria-hidden": "true" });
    for (var i = 0; i <= TMAX; i++) {
      var sp = el("span", { class: "tb-rt" + (i % 2 === 0 ? " is-big" : "") });
      sp.style.left = (100 * i) / TMAX + "%";
      railTicks.appendChild(sp);
    }
    var needMark = el("span", { class: "tb-need", "aria-hidden": "true" });
    needMark.style.left = (100 * TNEED) / TMAX + "%";
    var rail = el("div", { class: "tb-rail" }, [fill, railTicks, needMark, thumb]);
    var track = el("div", {
      class: "tb-track",
      role: "slider",
      tabindex: "0",
      "aria-label": "빨리 감기 바(불을 붙인 뒤 시간이 흐르는 모습, 모형)",
      "aria-valuemin": "0",
      "aria-valuemax": String(TMAX),
      "aria-orientation": "horizontal",
    }, [rail]);
    var labelsRow = el("div", { class: "tb-labels", "aria-hidden": "true" });
    for (var j = 0; j <= TMAX; j += 2) {
      var lb = el("span", { text: j === 0 ? "처음(불 붙인 직후)" : j === TMAX ? "나중" : "" });
      lb.style.left = (100 * j) / TMAX + "%";
      labelsRow.appendChild(lb);
    }
    var stFlame = el("span", { class: "tb-st" });
    var stAmount = el("span", { class: "tb-st" });
    var stRow = el("p", { class: "tb-state" }, [stFlame, stAmount]);
    var msg = el("p", { class: "ss-help tb-msg" });
    var note = el("p", { class: "tb-note", text: "🏷 모형: 잘 보이도록 실제보다 훨씬 빠르게 줄어들게 나타냈어요." });
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    var card = el("div", { class: "ss-card tb-card" }, [
      el("div", { class: "tb-head" }, [title, badge]),
      igniteBtn,
      track,
      labelsRow,
      stRow,
      msg,
      note,
      live,
    ]);
    // 가로 화면(좌우 배치): 오른쪽 패널의 조건 고르기 아래(실행 버튼 위) / 세로·좁은 화면: 실험 화면 바로 아래
    var viewCol = viewBox.parentNode;
    var panel = $("experiment-root").querySelector(".ss-exp-panel");
    var runCard = panel.querySelector(".ss-run-card");
    var twoCol = window.matchMedia ? window.matchMedia("(min-width: 901px) and (orientation: landscape)") : null;
    function placeCard() {
      if (twoCol && twoCol.matches) panel.insertBefore(card, runCard);
      else viewCol.insertBefore(card, viewBox.nextSibling);
    }
    placeCard();
    if (twoCol) {
      if (twoCol.addEventListener) twoCol.addEventListener("change", placeCard);
      else if (twoCol.addListener) twoCol.addListener(placeCard);
    }

    function target() {
      return curSel.sub || null;
    }
    function usable() {
      var sub = target();
      return !!(sub && burn[sub].lit && !expBusy && !igniting[sub]);
    }

    igniteBtn.addEventListener("click", function () {
      var sub = target();
      if (!sub || expBusy || burn[sub].lit) return;
      igniteSub(sub);
    });

    var dragging = false;
    function tFromX(clientX) {
      var r = rail.getBoundingClientRect();
      var f = r.width > 0 ? (clientX - r.left) / r.width : 0;
      return clamp(f, 0, 1) * TMAX;
    }
    function setT(t) {
      var sub = target();
      if (!sub) return;
      var st = burn[sub];
      var wasExplored = explored(sub);
      st.t = clamp(Math.round(t * 10) / 10, 0, TMAX);
      st.maxT = Math.max(st.maxT, st.t);
      saveBurn();
      requestDraw();
      if (!wasExplored && explored(sub)) {
        exp.refresh();
        toast("✅ 시간이 흐르는 모습을 살펴봤어요. 이제 '그 밖에 관찰한 것'을 살펴볼 수 있어요.", 3200);
      }
    }
    track.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (!usable()) {
        nudge();
        return;
      }
      dragging = true;
      try {
        track.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 무시 */
      }
      track.classList.add("is-drag");
      fast.hidden = false;
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
      fast.hidden = true;
    }
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("lostpointercapture", endDrag);
    track.addEventListener("keydown", function (e) {
      var sub = target();
      if (!sub) return;
      var t = burn[sub].t;
      var to = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = t - 0.5;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = t + 0.5;
      else if (e.key === "PageDown") to = t - 2;
      else if (e.key === "PageUp") to = t + 2;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = TMAX;
      if (to == null) return;
      e.preventDefault();
      if (!usable()) {
        nudge();
        return;
      }
      setT(to);
    });

    var nudgeTimer = null;
    function nudge() {
      card.classList.remove("is-nudge");
      void card.offsetWidth;
      card.classList.add("is-nudge");
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(function () {
        card.classList.remove("is-nudge");
      }, 1400);
      S.Experiment.scrollIntoView(card, { align: "nearest" });
      var sub = target();
      if (!sub) toast("먼저 오른쪽(또는 아래)에서 물질을 골라요.", 2600);
      else if (!burn[sub].lit && !igniting[sub]) toast("먼저 '🔥 불 붙이기'를 눌러 " + SUB[sub].device + "에 불을 붙여요.", 2800);
    }

    function draw() {
      var sub = target();
      var st = sub ? burn[sub] : null;
      var lit = !!(st && st.lit);
      var t = st ? st.t : 0;
      var pct = (t / TMAX) * 100;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      card.classList.toggle("is-off", !lit);
      title.textContent = sub ? "⏩ 빨리 감기 · " + SUB[sub].device : "⏩ 빨리 감기";
      igniteBtn.hidden = !sub || lit;
      igniteBtn.disabled = expBusy || !!(sub && igniting[sub]);
      igniteBtn.textContent = sub && igniting[sub] ? "🔥 불을 붙이는 중…" : "🔥 " + (sub ? SUB[sub].device + "에 " : "") + "불 붙이기";
      track.setAttribute("aria-disabled", String(!usable()));
      track.setAttribute("aria-valuenow", String(t));
      var vt;
      if (!sub) vt = "물질을 고르지 않았어요";
      else if (!lit) vt = SUB[sub].device + "에 아직 불을 붙이지 않았어요";
      else vt = minText(t) + ", " + amountText(sub, t) + ", 불꽃은 계속 흔들리며 타고 있어요 (모형)";
      track.setAttribute("aria-valuetext", vt);
      if (!sub) {
        stFlame.textContent = "";
        stAmount.textContent = "";
        msg.textContent = "물질을 먼저 골라요. 불을 붙인 뒤 바를 끌면 시간이 흐르는 모습을 빨리 볼 수 있어요.";
      } else if (!lit) {
        stFlame.textContent = "";
        stAmount.textContent = "";
        msg.textContent = "'🔥 불 붙이기'를 누르면 바를 끌 수 있어요.";
      } else {
        stFlame.textContent = "🔥 " + minText(t) + " · 불꽃이 계속 타고 있어요";
        stAmount.textContent = (sub === "candle" ? "🕯️ " : "🧪 ") + amountText(sub, t);
        msg.textContent = explored(sub) ? "✅ 시간이 흐르는 모습을 살펴봤어요. 앞뒤로 끌어 다시 볼 수 있어요." : "바를 오른쪽으로 끌어 가운데 점선까지 가 봐요.";
      }
    }
    return {
      draw: draw,
      nudge: nudge,
      announce: function (text) {
        live.textContent = text;
      },
    };
  })();

  /* ───────── 3. 기록·분석하기: 표 ───────── */
  function drawResults() {
    S.TableChart.renderMatrix($("result-table"), {
      caption: "양초와 알코올이 탈 때 관찰한 결과 (내 기록)",
      rowHeader: "관찰 항목 \\ 물질",
      rows: C.methods.map(function (m) {
        return { id: m.id, label: m.icon + " " + m.short };
      }),
      cols: C.substances.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        var rec = recOf(c.id, r.id);
        return rec ? { text: rec.result } : null;
      },
    });
    $("result-table").appendChild(el("p", { class: "ss-help", text: "교과서·실험관찰의 관찰 결과를 바탕으로 한 모형 실험 기록이에요." }));
    var toastEl = $("toast");
    if (toastEl) toastEl.hidden = true; // 기록을 마친 알림이 표를 가리지 않게
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function recordRows() {
    var rows = [];
    C.substances.forEach(function (s) {
      C.methods.forEach(function (m) {
        var r = recOf(s.id, m.id);
        if (r) rows.push({ substance: s.name, method: m.short, result: r.result });
      });
    });
    return rows;
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
      records: rows,
      timeBar: {
        candle: Math.round(burn.candle.maxT * 10) / 10,
        alcohol: Math.round(burn.alcohol.maxT * 10) / 10,
      },
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
            label: "내 관찰 기록",
            question: "내 관찰 기록(물질×관찰 항목)",
            kind: "table",
            answer: {
              columns: [
                { key: "substance", label: "물질" },
                { key: "method", label: "관찰 항목" },
                { key: "result", label: "관찰 결과" },
              ],
              rows: rows,
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        [{ stage: "curiosity", id: "q1", label: "궁금한 점(선택)", question: C.curiosity.prompt, kind: "text", answer: curiosityText.trim() }]
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
      return ["관찰하고 기록한 칸: " + recordRows().length + "/" + allCells.length + "칸", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "관찰할 " + p.total + "칸을 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)";
      },
      conclude: function () {
        if (!exp.allDone()) return "먼저 실험하기에서 6칸을 모두 기록해 주세요.";
        return quiz.isDone() || "분석 질문에서 알맞은 보기를 모두 고르고 '확인하기'를 눌러 주세요.";
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
        requestDraw();
      },
      analyze: drawResults,
    },
  });
  drawNow();
})();
