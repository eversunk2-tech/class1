/*
 * app.js — sci-6-2-3-1 "전구에 불을 켜려면 어떻게 해야 할까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 실험 장면(전지·전구·스위치·전선으로 만든 전기 회로)  ② 관찰 카드  ③ 분석 표·완료 저장  만 만든다.
 * 결과(켜짐/안 켜짐)와 배선 설명은 모두 LessonConfig(교과서·실험관찰 값)에서만 가져온다.
 *
 * 실험 구성(spec.md "개정 1"):
 *  - 실험 1: 전기 회로 카드 (가)~(라) 4칸. 카드를 고르면 그 배선이 3D에 그대로 나타나고, '스위치 닫기'로 확인한다.
 *  - 실험 2: (나)와 같은 배선에서 스위치 자리에 플라스틱·고무·금속 막대를 끼워 3칸. 실험 1을 다 기록해야 열린다.
 *  - 값을 타이핑하지 않는다. 본 것과 같은 보기를 고르고 '기록하기'로 저장한다(7칸).
 *
 * 개편 단계 D(2026-09-27, spec.md "개정 2"): 저장 키·저장 구조·기록·detail은 그대로.
 *  - 관찰 카드·장면 위 안내 글·2D 캡션은 결과(켜짐/안 켜짐)를 먼저 말하지 않는다 — 본 모습 글은 맞는 보기로 확인한 뒤에만.
 *    결과는 장면 대체 설명(3D 캔버스·2D 그림의 aria-label)이 말한다(화면을 보지 못하는 학생용).
 *  - 3D에서 물체를 눌러 고르기: 탁자 왼쪽 뒤 '전기 회로 카드' (가)~(라), 실험 2가 열리면 오른쪽 뒤 '막대 꽂이'의 막대·이름표.
 *  - 실행할 때 전구로 다가가는 연출을 없앴다(카메라를 움직이지 않음 — 처음 시점은 회로 전체, 학생이 확대·이동해 둔 시점은 그대로).
 *  - 기록 뒤 다음 조건을 고르지 않는다(공통 틀 — "다음" 표시도 없음, 2026-09-27). 앱은 따로 고르는 코드가 없다.
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

  /* ───────── 차시 데이터 ───────── */
  var ITEM = {};
  var ITEMS = [];
  C.circuits.forEach(function (c) {
    var it = Object.assign({ kind: "circuit" }, c);
    ITEM[it.id] = it;
    ITEMS.push(it);
  });
  C.rods.forEach(function (r) {
    var it = Object.assign({ kind: "rod" }, r);
    ITEM[it.id] = it;
    ITEMS.push(it);
  });
  function expected(itemId) {
    return ITEM[itemId].lit ? C.litText : C.unlitText;
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function obsQuestion(itemId) {
    var it = ITEM[itemId];
    return it.kind === "circuit"
      ? it.label + ": 스위치를 닫았을 때 전구에 불이 켜졌나요?"
      : S.josa(it.label, "을", "를") + " 연결했을 때 전구에 불이 켜졌나요?";
  }
  function qaId(itemId) {
    return (ITEM[itemId].kind === "circuit" ? "circuit_" : "material_") + itemId;
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.item;
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
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

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div", { class: "intro-body" });
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    box.appendChild(
      el("div", { class: "safety-line" }, [
        el("p", { class: "safety-h", text: "⚠️ 실제로 실험할 때 지킬 일" }),
        el(
          "ul",
          null,
          C.intro.safety.map(function (t) {
            return el("li", { text: t });
          })
        ),
      ])
    );
    return box;
  }

  function itemIcon(it) {
    return function () {
      return el("span", { class: "opt-icon", "aria-hidden": "true", text: it.kind === "circuit" ? "🔌" : "🪵" });
    };
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🧽 실험대 처음처럼 되돌리기",
    clearMessage: "전기 회로를 처음 상태로 되돌렸어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "item",
        title: "무엇으로 실험할지 고르기",
        short: "실험할 것",
        options: ITEMS.map(function (it) {
          return { id: it.id, label: it.label, icon: itemIcon(it) };
        }),
      },
    ],
    phases: [
      { id: "circuit", name: C.phase1.name, lead: C.phase1.lead, cells: C.circuits.map(function (c) { return { item: c.id }; }) },
      { id: "material", name: C.phase2.name, lead: C.phase2.lead, cells: C.rods.map(function (r) { return { item: r.id }; }) },
    ],
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return sel.item;
    },
    runLabel: function (sel) {
      var it = ITEM[sel.item];
      return it.kind === "circuit" ? "▶ 스위치 닫기 · " + it.label : "▶ " + it.label + " 연결하기";
    },
    busyLabel: "실험하는 중… 전구를 잘 지켜보세요 👀",
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 번 탭: 처음 방향 · 카드·막대를 눌러 고르기",
      tip2D: "2D 화면(모형, 회로를 그림으로 나타낸 모습)이에요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { item: sel.item, kind: ITEM[sel.item].kind, result: observed, tries: triesOf[sel.item] || 0 };
    },
    describeRecord: function (r) {
      return ITEM[r.item].label + " → " + r.result;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: ITEMS.map(function (it) {
        return { id: it.id, label: it.label };
      }),
      cols: [{ id: "lit", label: "전구" }],
      sel: function (r) {
        return { item: r.id };
      },
    },
    onChange: lesson.refresh,
  });

  /* 관찰·기록 카드: 중립 안내 + 보기 고르기 → 확인하기(본 것과 같아야 기록)
     단계 D(review-A L8): 보기 바로 위에 정답과 같은 말("전구에 불이 켜졌어요" ↔ 보기 "불이 켜졌다")을 먼저 보여 주지 않는다.
     처음에는 "장면에서 전구를 살펴보세요"만, 실제 모습 글(💡/⚫ + seen)은 맞는 보기로 '확인하기'를 누른 뒤에만 드러낸다
     (틀린 보기로 확인하면 계속 숨김 — sci-6-2-2-3 chipNode()와 같은 방식). 장면을 보지 못하는 학생은 장면 대체 설명(sceneText)으로 본다. */
  function observeCard(sel) {
    var it = ITEM[sel.item];
    var look = el("span", { class: "ob-look", text: "👀 " + (it.kind === "circuit" ? "스위치를 닫은 뒤 장면에서 전구를 살펴보세요." : "막대를 끼운 뒤 장면에서 전구를 살펴보세요.") });
    var reveal = el("span", { class: "ob-reveal", hidden: true }, [
      el("span", { class: "ob-icon", "aria-hidden": "true", text: it.lit ? "💡" : "⚫" }),
      el("span", { text: "본 모습: " + it.seen }),
    ]);
    var body = el("div", { class: "ob-body" }, [el("p", { class: "ob-seen" }, [look, reveal])]);
    return {
      question: obsQuestion(sel.item),
      body: body,
      type: "choice",
      choices: C.observeChoices.slice(),
      // ctx.tries = 이 관찰 카드에서 틀린 횟수(공통 틀이 센다) → 기록에 함께 담는다
      check: function (observed, ctx) {
        var ok = observed === expected(sel.item);
        reveal.hidden = !ok; // 맞는 보기로 확인했을 때만 실제 모습 글(틀린 보기로 다시 확인하면 다시 숨김)
        look.hidden = ok;
        if (ok) {
          triesOf[sel.item] = ctx && typeof ctx.tries === "number" ? ctx.tries : 0;
          return true;
        }
        return "🔍 방금 본 모습과 다른 것 같아요. 전구를 다시 살펴보고, 본 것과 같은 보기를 골라 보세요.";
      },
      okMessage: "⭕ 본 것과 같아요! '기록하기'를 눌러 기록해요.",
      retryLabel: "🔁 다시 해 보기",
    };
  }
  var triesOf = {};

  /* ───────── 3D 장면 ───────── */
  // 실험대 위 부품 자리(모형). 단위는 장면 안에서만 쓰는 값이다.
  var P = {
    batPlus: [-1.3, 0.42, -2.4],
    batMinus: [1.3, 0.42, -2.4],
    bulbL: [-3.45, 0.34, 1.7],
    bulbR: [-2.15, 0.34, 1.7],
    swL: [2.15, 0.34, 1.7],
    swR: [3.45, 0.34, 1.7],
  };
  var WIRE_RED = 0xd8434f;
  var WIRE_BLACK = 0x33383f;
  var FRAME = { width: 9.8, depth: 7.8, center: [0, 0.7, -0.1] };
  // 직접 고르기(단계 D, spec §3.3): 전선이 어떤 회로에서도 지나가지 않는 탁자 뒤 양쪽에
  //  - 왼쪽 뒤: 전기 회로 카드 (가)~(라)(뒷줄 가·나, 앞줄 다·라 — 교과서의 '전기 회로 카드'처럼 회로 그림 + 이름)
  //  - 오른쪽 뒤: 막대 꽂이(플라스틱·고무·금속 — 실험 2가 열린 뒤에만 보인다. 고른 막대는 스위치 자리로 간다)
  var CARD = { cols: [-4.12, -2.98], rows: [-3.0, -1.5], w: 1.06, d: 0.78, lean: 0.82 };
  var STAND = { x: 3.55, z: -2.1, w: 2.3, h: 0.62, d: 0.5, xs: [2.8, 3.55, 4.3] };
  var ROD_HOVER_Y = 1.5; // 끼우기 전(스위치 자리 위)
  var ROD_IN_Y = 0.44; // 끼운 뒤(두 집게 사이)
  var FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

  function endPoint(which) {
    if (which === "plus") return P.batPlus;
    if (which === "minus") return P.batMinus;
    return null;
  }
  // 장면 대체 설명(3D 캔버스·2D 그림의 aria-label) — 화면을 보지 못하는 학생에게는 이것이 장면을 '보는 것'이다.
  // 관찰 카드에서는 보기와 같은 말을 먼저 보여 주지 않지만, 장면 설명은 실행한 뒤의 전구 모습(seen)을 말한다(단계 D 지침 3).
  function sceneText(it, done, kind) {
    var head = (kind === "3D" ? "3D 실험 장면" : "2D 그림") + "(모형). ";
    if (!it) return head + "아직 실험할 것을 고르지 않았어요." + (kind === "3D" ? " 탁자 왼쪽 뒤의 전기 회로 카드 (가)~(라)" + (rodsOpen() ? "나 오른쪽 뒤 막대 꽂이의 막대" : "") + "를 눌러 고를 수 있어요." : "");
    if (it.kind === "circuit") return head + S.josa(it.label, "을", "를") + " 연결했어요. " + (done ? "스위치를 닫았어요. " + it.seen : "스위치가 열려 있어요.");
    return head + "스위치를 떼어 낸 자리에 " + S.josa(it.label, "을", "를") + (done ? " 끼웠어요. " + it.seen : " 끼우기 전이에요.");
  }
  function rodsOpen() {
    // 실험 2(막대)는 실험 1을 모두 기록해야 열린다(공통 틀의 단계 잠금). 열리기 전에는 막대를 장면에 두지 않는다(누를 수도 없게).
    return !!(exp && exp.phaseDone && exp.phaseDone("circuit"));
  }

  // 회로 카드 그림(모형): 2D 회로도(D2PATH)와 같은 배선을 작게 — 위 전지, 왼쪽 아래 전구, 오른쪽 아래 스위치(3D 처음 시점과 같은 좌우)
  function drawCard(c, on) {
    var cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 194;
    var g = cv.getContext("2d");
    g.fillStyle = "#fffdf6";
    g.fillRect(0, 0, cv.width, cv.height);
    g.lineWidth = on ? 18 : 6;
    g.strokeStyle = on ? "#2f6fd6" : "#9aa6b4";
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cv.width - g.lineWidth, cv.height - g.lineWidth);
    g.fillStyle = "#1f2937";
    g.font = "800 58px " + FONT;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(c.short, cv.width / 2, 52);
    var s = Math.min(196 / 460, 104 / 300);
    g.save();
    g.translate((cv.width - 460 * s) / 2, 80);
    g.scale(s, s);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 17;
    function wire(d, color) {
      if (!d || typeof Path2D === "undefined") return;
      g.strokeStyle = color;
      g.stroke(new Path2D(d));
    }
    var w = c.wire;
    wire(D2PATH.a[w.a], w.color === "black" ? "#33383f" : "#d8434f");
    wire(D2PATH.b, "#33383f");
    wire(w.c ? D2PATH.c[w.c] : "", "#33383f");
    g.fillStyle = "#2f6fd6";
    g.fillRect(176, 32, 108, 36); // 전지
    g.fillStyle = "#e7edf3";
    g.strokeStyle = "#6f7f91";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(80, 204, 28, 0, Math.PI * 2); // 전구
    g.fill();
    g.stroke();
    g.fillStyle = "#3b4350";
    g.fillRect(36, 230, 88, 22);
    g.fillRect(336, 232, 88, 20); // 스위치 받침
    g.strokeStyle = "#8d99a8";
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(342, 240);
    g.lineTo(404, 208); // 스위치(열림)
    g.stroke();
    g.restore();
    return cv;
  }

  function build3D(container, ctx) {
    // 3D에서 물체를 눌러 고르기(단계 D): 카드 → 그 회로, 막대 → 그 막대. 버튼과 같은 길(ctx.onPick → 공통 틀의 pick/select, 실행 중이면 공통 틀이 무시).
    var live = { sel: null, ready: false };
    function onPick(p) {
      if (!live.ready || !p || !p.item || !ITEM[p.item]) return;
      if (live.sel && live.sel.item === p.item) return; // 이미 고른 것: 다시 고르면 관찰 카드가 닫히므로 그대로 둔다(sci-6-2-2-4와 같음)
      if (ITEM[p.item].kind === "rod" && !rodsOpen()) return; // 아직 열리지 않은 실험 2(막대는 숨겨져 있어 보통은 맞지도 않는다)
      ctx.onPick({ item: p.item });
    }
    return S.Sim3D.create({
      container: container,
      frame: FRAME,
      viewDir: [0, 0.66, 0.75],
      minDistance: 3.2,
      onPick: onPick,
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var disposed = false;
      var canvas = container.querySelector("canvas.ss-canvas");

      var tableMesh = M.table(14, 10, 0xd9c7a3);
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      // 화면 위에 겹쳐 보이는 안내 글 + 모형 배지
      var ovText = el("span", { class: "ov-text", hidden: true });
      var overlay = el("div", { class: "ov3d", "aria-hidden": "true" }, [el("span", { class: "ov-badge", text: C.modelBadge }), ovText]);
      container.appendChild(overlay);
      function say(text) {
        ovText.textContent = text || "";
        ovText.hidden = !text;
      }

      var metalMat = M.material(0xc2ccd6, { metalness: 0.55, roughness: 0.32 });
      var darkMat = M.material(0x3b4350, { roughness: 0.7 });

      function post(parent, x) {
        var m = new T.Mesh(new T.BoxGeometry(0.26, 0.44, 0.3), metalMat);
        m.position.set(x, 0.32, 0);
        parent.add(m);
        return m;
      }

      /* 전지 끼우개 */
      var batG = new T.Group();
      batG.position.set(0, 0, -2.4);
      v.root.add(batG);
      var batBase = new T.Mesh(new T.BoxGeometry(3.1, 0.3, 1.15), darkMat);
      batBase.position.y = 0.15;
      batG.add(batBase);
      var battery = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 2.05, 24), M.material(0x2f6fd6, { roughness: 0.45 }));
      battery.rotation.z = Math.PI / 2;
      battery.position.y = 0.6;
      batG.add(battery);
      var batCap = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.18, 16), metalMat);
      batCap.rotation.z = Math.PI / 2;
      batCap.position.set(-1.1, 0.6, 0);
      batG.add(batCap);
      post(batG, -1.3);
      post(batG, 1.3);
      var lbPlus = M.label("+극", { height: 0.44, bold: true });
      lbPlus.position.set(-1.35, 1.25, 0);
      batG.add(lbPlus);
      var lbMinus = M.label("-극", { height: 0.44, bold: true });
      lbMinus.position.set(1.35, 1.25, 0);
      batG.add(lbMinus);
      var lbBat = M.label("전지", { height: 0.4 });
      lbBat.position.set(0, 1.3, 0); // (+)극·(-)극 라벨 사이. 앞쪽에 두면 (라)의 전선이 글자를 지나간다
      batG.add(lbBat);

      /* 전구 끼우개 */
      var bulbG = new T.Group();
      bulbG.position.set(-2.8, 0, 1.7);
      v.root.add(bulbG);
      var bulbBase = new T.Mesh(new T.BoxGeometry(1.6, 0.28, 1.0), darkMat);
      bulbBase.position.y = 0.14;
      bulbG.add(bulbBase);
      post(bulbG, -0.65);
      post(bulbG, 0.65);
      var socket = new T.Mesh(new T.CylinderGeometry(0.3, 0.34, 0.52, 20), metalMat);
      socket.position.y = 0.54;
      bulbG.add(socket);
      var filMat = M.material(0xfff0bf, { emissive: 0xffc23a, emissiveIntensity: 0, roughness: 0.4 });
      var filament = new T.Mesh(new T.TorusGeometry(0.11, 0.028, 8, 16), filMat);
      filament.position.y = 1.0;
      filament.rotation.x = Math.PI / 2;
      bulbG.add(filament);
      var glassMat = M.material(0xffffff, { transparent: true, opacity: 0.3, roughness: 0.08, emissive: 0xffd76a, emissiveIntensity: 0, side: T.DoubleSide, depthWrite: false });
      var glass = new T.Mesh(new T.SphereGeometry(0.44, 24, 18), glassMat);
      glass.position.y = 1.12;
      glass.renderOrder = 4;
      bulbG.add(glass);
      var haloMat = new T.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
      var halo = new T.Mesh(new T.SphereGeometry(0.6, 18, 14), haloMat);
      halo.position.y = 1.12;
      halo.visible = false;
      halo.renderOrder = 5;
      bulbG.add(halo);
      var bulbLight = new T.PointLight(0xffd98a, 0, 7, 2);
      bulbLight.position.set(0, 1.12, 0);
      bulbG.add(bulbLight);
      var lbBulb = M.label("전구", { height: 0.4 });
      lbBulb.position.set(0, 0.2, 0.8);
      bulbG.add(lbBulb);

      /* 스위치 (실험 2에서는 같은 자리에 막대를 끼운다) */
      var swG = new T.Group();
      swG.position.set(2.8, 0, 1.7);
      v.root.add(swG);
      var swBase = new T.Mesh(new T.BoxGeometry(1.9, 0.26, 1.0), darkMat);
      swBase.position.y = 0.13;
      swG.add(swBase);
      var swPostL = post(swG, -0.65);
      var swPostR = post(swG, 0.65);
      var leverPivot = new T.Group();
      leverPivot.position.set(-0.65, 0.5, 0);
      swG.add(leverPivot);
      var lever = new T.Mesh(new T.BoxGeometry(1.4, 0.09, 0.22), metalMat);
      lever.position.set(0.7, 0, 0);
      leverPivot.add(lever);
      var lbSw = M.label("스위치", { height: 0.4 });
      lbSw.position.set(0, 0.2, 0.8);
      swG.add(lbSw);
      var lbRod = M.label("막대", { height: 0.4 });
      lbRod.position.set(0, 1.1, 0);
      lbRod.visible = false;
      swG.add(lbRod);

      // 누르기(탭) 대상 등록: 숨긴 물체는 레이에 걸리지 않게 한다(three.js 레이는 숨긴 물체도 맞힌다 — sci-6-2-2-3과 같은 방식)
      function pickable(obj, value) {
        obj.traverse(function (o) {
          if (!o.isMesh && !o.isSprite) return;
          var orig = o.raycast;
          o.raycast = function (rc, hits) {
            for (var n = o; n; n = n.parent) if (n.visible === false) return;
            return orig.call(this, rc, hits);
          };
        });
        v.pickable(obj, value);
      }
      // 눈에 안 보이는 누르기 영역(가는 막대도 손가락으로 누르기 쉽게) — 그리지 않고 레이만 맞는다
      var hitMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
      var owned = []; // 이 장면이 만든 텍스처·지오메트리(해제용)

      /* 전기 회로 카드 (가)~(라) — 탁자 왼쪽 뒤, 작은 받침에 기대 세운 카드(누르면 그 회로) */
      var cards = {};
      var cardGeo = new T.BoxGeometry(CARD.w, 0.035, CARD.d);
      var standGeo = new T.BoxGeometry(CARD.w + 0.08, 0.1, 0.3);
      var woodMat = M.material(0xb98a55, { roughness: 0.75 });
      var paperEdge = M.material(0xf1ead8, { roughness: 0.9 });
      owned.push(cardGeo, standGeo);
      C.circuits.forEach(function (c, i) {
        var g = new T.Group();
        g.position.set(CARD.cols[i % 2], 0, CARD.rows[Math.floor(i / 2)]);
        v.root.add(g);
        var base = new T.Mesh(standGeo, woodMat); // 카드 아래쪽을 받치는 받침
        base.position.set(0, 0.05, 0.12);
        g.add(base);
        var texOff = new T.CanvasTexture(drawCard(c, false));
        var texOn = new T.CanvasTexture(drawCard(c, true));
        [texOff, texOn].forEach(function (t) {
          t.colorSpace = T.SRGBColorSpace;
          t.anisotropy = 4;
          owned.push(t);
        });
        var face = new T.MeshStandardMaterial({ map: texOff, roughness: 0.85 });
        var pivot = new T.Group(); // 카드 아래 모서리(앞)를 축으로 뒤로 기댄다 → 그림이 처음 시점 쪽을 향한다
        pivot.position.set(0, 0.08, 0.12);
        pivot.rotation.x = CARD.lean;
        g.add(pivot);
        var card = new T.Mesh(cardGeo, [paperEdge, paperEdge, face, paperEdge, paperEdge, paperEdge]);
        card.position.set(0, 0.02, -CARD.d / 2);
        pivot.add(card);
        pickable(g, { item: c.id });
        cards[c.id] = { group: g, face: face, texOff: texOff, texOn: texOn, mats: [face] };
      });

      /* 막대 꽂이(실험 2) — 탁자 오른쪽 뒤. 고른 막대는 스위치 자리로 간다(끼우기 전: 위에 떠 있음, 실행: 두 집게 사이로) */
      var standG = new T.Group();
      standG.position.set(STAND.x, 0, STAND.z);
      v.root.add(standG);
      var standBox = new T.Mesh(new T.BoxGeometry(STAND.w, STAND.h, STAND.d), woodMat);
      standBox.position.y = STAND.h / 2;
      standG.add(standBox);
      var rodGeo = new T.CylinderGeometry(0.14, 0.14, 1.5, 18);
      var rodHitGeo = new T.CylinderGeometry(0.34, 0.34, 1.62, 10);
      var labelHitGeo = new T.BoxGeometry(STAND.w / 3 - 0.04, STAND.h + 0.04, STAND.d + 0.04);
      owned.push(rodGeo, rodHitGeo, labelHitGeo);
      var rods = {};
      C.rods.forEach(function (r, i) {
        var mat = M.material(r.color, { roughness: r.id === "metal" ? 0.25 : 0.7, metalness: r.id === "metal" ? 0.7 : 0.05 });
        var mesh = new T.Mesh(rodGeo, mat);
        mesh.add(new T.Mesh(rodHitGeo, hitMat));
        v.root.add(mesh);
        pickable(mesh, { item: r.id });
        var hit = new T.Mesh(labelHitGeo, hitMat); // 꽂이의 그 막대 자리를 눌러도 그 막대
        hit.position.set(STAND.xs[i] - STAND.x, STAND.h / 2, 0);
        standG.add(hit);
        pickable(hit, { item: r.id });
        var tag = M.label(r.short, { height: 0.34, bold: true }); // 꽂이 앞 이름표(안 바뀌는 이름 — 누르면 그 막대)
        tag.position.set(STAND.xs[i] - STAND.x, 0.3, STAND.d / 2 + 0.16);
        standG.add(tag);
        pickable(tag, { item: r.id });
        rods[r.id] = { mesh: mesh, mat: mat, hole: [STAND.xs[i], STAND.h + 0.75 - 0.3, STAND.z] };
      });
      // 막대 자리: 꽂이(세움) 또는 스위치 자리(눕힘 — y는 떠 있음/끼움)
      function rodAtStand(r) {
        r.mesh.rotation.set(0, 0, 0);
        r.mesh.position.fromArray(r.hole);
      }
      function rodAtSlot(r, y) {
        r.mesh.rotation.set(0, 0, Math.PI / 2);
        r.mesh.position.set(P.swL[0] + (P.swR[0] - P.swL[0]) / 2, y, P.swL[2]);
      }

      /* 전선(집게 달린 전선) — 두 점을 잇는 관 + 양 끝 집게 */
      var clipGeo = new T.BoxGeometry(0.2, 0.26, 0.16);
      function makeWire(color) {
        var g = new T.Group();
        var mat = M.material(color, { roughness: 0.5 });
        var mesh = new T.Mesh(tube([0, 0, 0], [1, 0, 0], 0.2), mat);
        var c1 = new T.Mesh(clipGeo, metalMat);
        var c2 = new T.Mesh(clipGeo, metalMat);
        g.add(mesh, c1, c2);
        v.root.add(g);
        return {
          group: g,
          mesh: mesh,
          mat: mat,
          set: function (a, b, sag) {
            mesh.geometry.dispose();
            mesh.geometry = tube(a, b, sag);
            c1.position.fromArray(a);
            c2.position.fromArray(b);
            g.visible = true;
          },
          hide: function () {
            g.visible = false;
          },
          dispose: function () {
            mesh.geometry.dispose();
            mat.dispose();
          },
        };
      }
      function tube(a, b, sag) {
        var A = new T.Vector3().fromArray(a);
        var B = new T.Vector3().fromArray(b);
        var mid = A.clone().add(B).multiplyScalar(0.5);
        mid.y = sag == null ? 0.16 : sag;
        return new T.TubeGeometry(new T.QuadraticBezierCurve3(A, mid, B), 28, 0.055, 8, false);
      }
      var wireA = makeWire(WIRE_RED); // 전구 ↔ 전지
      var wireB = makeWire(WIRE_BLACK); // 전구 ↔ 스위치
      var wireC = makeWire(WIRE_BLACK); // 스위치 ↔ 전지

      /* 전기가 흐르는 길(모형) — 작은 화살표가 회로를 따라 돈다 */
      var flowCurve = new T.CatmullRomCurve3(
        [P.batPlus, [-2.4, 0.2, -0.4], P.bulbL, [-2.8, 0.75, 1.7], P.bulbR, [0, 0.2, 1.7], P.swL, [2.8, 0.55, 1.7], P.swR, [2.4, 0.2, -0.4], P.batMinus, [0, 0.62, -2.4]].map(function (p) {
          return new T.Vector3().fromArray(p);
        }),
        true,
        "catmullrom",
        0.4
      );
      var arrowGroup = new T.Group();
      arrowGroup.visible = false;
      v.root.add(arrowGroup);
      var arrowGeo = new T.ConeGeometry(0.115, 0.3, 10);
      var arrowMat = new T.MeshBasicMaterial({ color: 0xffb020 });
      var arrows = [];
      for (var ai = 0; ai < 8; ai++) {
        var am = new T.Mesh(arrowGeo, arrowMat);
        arrowGroup.add(am);
        arrows.push(am);
      }
      var flowT = 0;
      var UP = new T.Vector3(0, 1, 0);
      function placeArrows() {
        if (disposed) return;
        for (var i = 0; i < arrows.length; i++) {
          var t = (((flowT + i / arrows.length) % 1) + 1) % 1; // 0 이상 1 미만(음수면 곡선 위치가 NaN이 되어 오류가 났다)
          if (!isFinite(t)) return;
          var p = flowCurve.getPointAt(t);
          var tan = flowCurve.getTangentAt(t);
          if (!p || !tan || !arrows[i]) return;
          arrows[i].position.copy(p);
          arrows[i].quaternion.setFromUnitVectors(UP, tan.normalize());
        }
      }
      placeArrows();
      var loopId = 0;
      var lastT = 0;
      function startFlow() {
        if (loopId || disposed || reduceMotion()) return;
        lastT = performance.now();
        loopId = requestAnimationFrame(flowTick);
      }
      function flowTick(now) {
        loopId = 0;
        if (disposed || !arrowGroup.visible) return;
        // requestAnimationFrame의 시각이 시작 때 잰 performance.now()보다 이를 수 있다 → 음수 dt는 0으로(단계 D: 3D를 다시 열 때마다 난 오류)
        var dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000));
        lastT = now;
        flowT = (flowT + (isFinite(dt) ? dt : 0) * 0.22) % 1;
        placeArrows();
        loopId = requestAnimationFrame(flowTick);
      }

      /* 장면 상태 적용 */
      function setWiring(w) {
        // (라)처럼 전지의 (-)극 쪽으로 가는 전선은 검정으로 그린다(실험관찰 75쪽 카드와 같게)
        wireA.mat.color.set(w.color === "black" ? WIRE_BLACK : WIRE_RED);
        var ea = endPoint(w.a);
        if (ea) wireA.set(P.bulbL, ea, 0.16);
        else wireA.hide();
        wireB.set(P.bulbR, P.swL, 0.16);
        var ec = endPoint(w.c);
        if (ec) wireC.set(P.swR, ec, w.c === "plus" ? 1.15 : 0.16);
        else wireC.hide();
      }
      function setLit(k) {
        filMat.emissiveIntensity = 2.8 * k;
        glassMat.emissiveIntensity = 0.32 * k;
        glassMat.opacity = 0.3 + 0.18 * k;
        haloMat.opacity = 0.28 * k;
        halo.visible = k > 0.02;
        bulbLight.intensity = 2.0 * k;
        var on = k > 0.5;
        arrowGroup.visible = on;
        if (on) startFlow();
      }
      function setSwitch(closed) {
        leverPivot.rotation.z = closed ? 0 : 0.62;
      }
      // 실험 2에서는 교과서처럼 스위치를 떼어 내고(받침·단자·레버 숨김) 전선 집게 사이에 막대만 끼운다
      function showRod(it) {
        var isRod = !!(it && it.kind === "rod");
        lbRod.visible = isRod;
        lever.visible = !isRod;
        lbSw.visible = !isRod;
        swBase.visible = !isRod;
        swPostL.visible = !isRod;
        swPostR.visible = !isRod;
      }
      // 카드·막대 꽂이: 고른 카드는 파란 테두리로 조금 들고, 고른 막대는 스위치 자리로(done이면 끼운 모습). 막대는 실험 2가 열린 뒤에만 보인다.
      function placeProps(it, done) {
        Object.keys(cards).forEach(function (id) {
          var on = !!(it && it.id === id);
          var cd = cards[id];
          if (cd.face.map !== (on ? cd.texOn : cd.texOff)) cd.face.map = on ? cd.texOn : cd.texOff;
          cd.group.position.y = on ? 0.06 : 0;
        });
        var open = rodsOpen() || !!(it && it.kind === "rod");
        standG.visible = open;
        Object.keys(rods).forEach(function (id) {
          var r = rods[id];
          r.mesh.visible = open;
          if (it && it.id === id) rodAtSlot(r, done ? ROD_IN_Y : ROD_HOVER_Y);
          else rodAtStand(r);
        });
      }
      // 아직 아무것도 고르지 않은 처음 상태
      function emptyScene() {
        wireA.hide();
        wireB.hide();
        wireC.hide();
        showRod(null);
        placeProps(null, false);
        setSwitch(false);
        setLit(0);
      }
      // sel에 맞는 장면. done이면 실험이 끝난 모습(스위치 닫힘 · 결과 표시)
      function applyScene(sel, done) {
        if (!sel || !sel.item || !ITEM[sel.item]) {
          emptyScene();
          describe(null, false);
          return;
        }
        var it = ITEM[sel.item];
        showRod(it);
        placeProps(it, !!done);
        if (it.kind === "circuit") {
          setWiring(it.wire);
          setSwitch(!!done);
        } else {
          setWiring({ a: "plus", c: "minus" });
          setSwitch(true);
        }
        setLit(done && it.lit ? 1 : 0);
        describe(it, !!done);
      }
      // 장면 대체 설명(3D 캔버스 aria-label) — 장면을 '보는 것'과 같으므로 실행한 뒤의 전구 모습도 말한다(관찰 카드의 글은 숨긴 대신)
      function describe(it, done) {
        if (canvas) canvas.setAttribute("aria-label", sceneText(it, done, "3D") + " 드래그하면 돌려 볼 수 있어요.");
      }

      // 실행할 때 카메라를 움직이지 않는다(단계 D): 전구로 다가가는 연출은 없앴고(배선 비교가 핵심이고, 다가가면 이름표가 안내 줄·이동 화살표에
      // 가렸다), 학생이 확대·이동해 둔 시점도 그대로 둔다 — sci-6-2-3-3 스위치 여닫기와 같은 원칙(2026-09-27 사용자: "학생이 스스로 필요시
      // 확대할 수 있으니", review-D2 L5). 처음 시점은 회로 전체가 보인다.

      var doneCells = {};
      var curSel = null;
      var saidFor = null; // 장면 위 안내 글이 가리키는 칸(다른 것을 고르면 지운다)
      emptyScene();
      describe(null, false);
      v.render();
      live.ready = true;

      var runToken = 0;
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          curSel = s && s.item ? { item: s.item } : null;
          live.sel = curSel;
          if (saidFor && (!curSel || curSel.item !== saidFor)) {
            say("");
            saidFor = null;
          }
          applyScene(curSel, curSel && doneCells[curSel.item]);
          v.render();
        },
        run: async function (sel) {
          var my = ++runToken;
          var it = ITEM[sel.item];
          curSel = { item: sel.item };
          live.sel = curSel;
          applyScene(curSel, false);
          say("");
          saidFor = sel.item;
          if (it.kind === "circuit") {
            say("① 스위치를 닫아요");
            await v.tween(520, function (t) {
              leverPivot.rotation.z = 0.62 * (1 - t);
            });
          } else {
            say("① " + S.josa(it.label, "을", "를") + " 끼워요");
            var r = rods[it.id];
            await v.tween(600, function (t) {
              r.mesh.position.y = ROD_HOVER_Y + (ROD_IN_Y - ROD_HOVER_Y) * t;
            });
          }
          if (my !== runToken) return;
          await v.wait(220);
          if (my !== runToken) return;
          say("② 전구를 잘 살펴보세요");
          if (it.lit) {
            await v.tween(460, function (t) {
              setLit(t);
            });
          } else {
            setLit(0);
            await v.wait(360);
          }
          if (my !== runToken) return;
          doneCells[sel.item] = true;
          applyScene(curSel, true);
          // 끝난 뒤에도 전구의 결과는 글로 말하지 않는다(보기 "불이 켜졌다/켜지지 않았다"와 같은 말이 되므로 — 장면에서 직접 본다). 한 일만 남긴다.
          say(it.kind === "circuit" ? "🔌 스위치를 닫았어요" : "🪵 " + S.josa(it.label, "을", "를") + " 끼웠어요");
          v.render();
        },
        showInstant: function (sel) {
          if (!sel || !sel.item || !ITEM[sel.item]) return;
          doneCells[sel.item] = true;
          curSel = { item: sel.item };
          live.sel = curSel;
          applyScene(curSel, true);
          v.render();
        },
        clear: function () {
          runToken++;
          doneCells = {};
          say("");
          saidFor = null;
          applyScene(curSel, false);
          v.flyHome(400);
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          runToken++;
          disposed = true;
          live.ready = false;
          if (loopId) cancelAnimationFrame(loopId);
          loopId = 0;
          wireA.dispose();
          wireB.dispose();
          wireC.dispose();
          clipGeo.dispose();
          arrowGeo.dispose();
          arrowMat.dispose();
          hitMat.dispose();
          owned.forEach(function (x) {
            x.dispose();
          });
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2D 대체 화면(SVG, 모형) ───────── */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, String(attrs[k]));
    });
    (kids || []).forEach(function (c) {
      if (c) n.appendChild(c);
    });
    return n;
  }
  // 2D 회로도 좌표(모형): 전지 위, 전구 왼쪽 아래, 스위치 오른쪽 아래
  var D2 = {
    batL: [170, 50],
    batR: [290, 50],
    bulbL: [40, 240],
    bulbR: [120, 240],
    swL: [340, 242],
    swR: [420, 242],
  };
  var D2PATH = {
    // a: 전구 왼쪽 단자 → 전지 단자 / c: 스위치 오른쪽 단자 → 전지 단자 / b: 전구 ↔ 스위치(항상)
    a: { plus: "M40,240 L40,50 L170,50", minus: "M40,240 L40,14 L290,14 L290,50" },
    c: { minus: "M420,242 L420,50 L290,50", plus: "M420,242 L420,14 L170,14 L170,50" },
    b: "M120,240 L120,278 L340,278 L340,242",
  };

  function build2D(root, ctx) {
    var wireA = svg("path", { class: "d2-wire d2-red", d: "" });
    var wireB = svg("path", { class: "d2-wire", d: D2PATH.b });
    var wireC = svg("path", { class: "d2-wire", d: "" });

    // 전지
    var batBox = svg("rect", { class: "d2-part", x: 170, y: 30, width: 120, height: 40, rx: 8 });
    var batCell = svg("rect", { class: "d2-battery", x: 182, y: 38, width: 96, height: 24, rx: 6 });
    var batPlus = svg("text", { class: "d2-pole", x: 170, y: 88, "text-anchor": "middle" });
    batPlus.textContent = "+극";
    var batMinus = svg("text", { class: "d2-pole", x: 290, y: 88, "text-anchor": "middle" });
    batMinus.textContent = "-극";
    // 전지 이름은 배터리 아래에 둔다(위쪽은 (다)·(라)의 전선이 지나간다)
    var batName = svg("text", { class: "d2-name", x: 230, y: 110, "text-anchor": "middle" });
    batName.textContent = "전지";
    var termBL = svg("circle", { class: "d2-term", cx: 170, cy: 50, r: 6 });
    var termBR = svg("circle", { class: "d2-term", cx: 290, cy: 50, r: 6 });

    // 전구
    var glow = svg("circle", { class: "d2-glow", cx: 80, cy: 206, r: 34 });
    var bulbCircle = svg("circle", { class: "d2-bulb", cx: 80, cy: 206, r: 22 });
    var bulbBase = svg("rect", { class: "d2-part", x: 40, y: 232, width: 80, height: 18, rx: 5 });
    var bulbName = svg("text", { class: "d2-name", x: 80, y: 266, "text-anchor": "middle" });
    bulbName.textContent = "전구";
    var termLL = svg("circle", { class: "d2-term", cx: 40, cy: 240, r: 6 });
    var termLR = svg("circle", { class: "d2-term", cx: 120, cy: 240, r: 6 });

    // 스위치 / 막대
    var swBase = svg("rect", { class: "d2-part", x: 340, y: 234, width: 80, height: 16, rx: 5 });
    var lever = svg("line", { class: "d2-lever", x1: 340, y1: 242, x2: 412, y2: 242 });
    var rod2 = svg("rect", { class: "d2-rod", x: 340, y: 234, width: 80, height: 16, rx: 6 });
    var swName = svg("text", { class: "d2-name", x: 380, y: 266, "text-anchor": "middle" });
    swName.textContent = "스위치";
    var termSL = svg("circle", { class: "d2-term", cx: 340, cy: 242, r: 6 });
    var termSR = svg("circle", { class: "d2-term", cx: 420, cy: 242, r: 6 });

    // 그림 대체 설명(role=img + aria-label, sceneText) — 캡션은 결과를 말하지 않고, 그림 설명이 전구 모습을 말한다(단계 D)
    var pic = svg("svg", { viewBox: "0 0 460 290", class: "d2-svg", role: "img", "aria-label": sceneText(null, false, "2D") }, [
      wireA,
      wireB,
      wireC,
      batBox,
      batCell,
      termBL,
      termBR,
      batPlus,
      batMinus,
      batName,
      glow,
      bulbCircle,
      bulbBase,
      termLL,
      termLR,
      bulbName,
      swBase,
      rod2,
      lever,
      termSL,
      termSR,
      swName,
    ]);
    var badge = el("span", { class: "d2-badge", text: C.modelBadge });
    var caption = el("p", { class: "d2-caption", "aria-live": "polite" });
    root.appendChild(el("div", { class: "d2-wrap" }, [badge, pic, caption]));
    caption.textContent = "무엇으로 실험할지 고른 뒤 실행 버튼을 눌러 보세요.";

    var doneCells = {};
    var curSel = null;
    var token = 0;

    function showSwitchParts(on) {
      swBase.style.display = on ? "" : "none";
      lever.style.display = on ? "" : "none";
    }
    function apply(sel, done) {
      var it = sel && sel.item ? ITEM[sel.item] : null;
      if (!it) {
        wireA.setAttribute("d", "");
        wireA.classList.add("d2-red");
        wireB.style.display = "none";
        wireC.setAttribute("d", "");
        rod2.style.display = "none";
        showSwitchParts(true);
        swName.textContent = "스위치";
        setOpen(true);
        setLit(false);
        pic.setAttribute("aria-label", sceneText(null, false, "2D"));
        return;
      }
      var w = it.kind === "circuit" ? it.wire : { a: "plus", c: "minus" };
      wireB.style.display = "";
      wireA.setAttribute("d", D2PATH.a[w.a] || "");
      wireA.classList.toggle("d2-red", w.color !== "black");
      wireC.setAttribute("d", (w.c && D2PATH.c[w.c]) || "");
      if (it.kind === "rod") {
        // 교과서처럼 스위치를 떼어 내고 전선 사이에 막대만 끼운다. 실행 전에는 흐리게(아직 끼우기 전)
        showSwitchParts(false);
        rod2.style.display = "";
        rod2.setAttribute("fill", "#" + ("000000" + it.color.toString(16)).slice(-6));
        rod2.classList.toggle("is-pending", !done);
        swName.textContent = it.short + " 막대";
        setOpen(false);
      } else {
        showSwitchParts(true);
        rod2.style.display = "none";
        swName.textContent = "스위치";
        setOpen(!done);
      }
      setLit(!!done && it.lit);
      pic.setAttribute("aria-label", sceneText(it, !!done, "2D"));
    }
    function setOpen(open) {
      lever.setAttribute("x2", open ? "405" : "412");
      lever.setAttribute("y2", open ? "214" : "242");
    }
    function setLit(on) {
      bulbCircle.classList.toggle("is-lit", on);
      glow.classList.toggle("is-lit", on);
      [wireA, wireB, wireC].forEach(function (w) {
        w.classList.toggle("is-flow", on);
      });
    }
    function sleep(ms) {
      return new Promise(function (r) {
        setTimeout(r, document.hidden || reduceMotion() ? 0 : ms);
      });
    }
    function captionFor(sel) {
      if (!sel || !sel.item) return "무엇으로 실험할지 고른 뒤 실행 버튼을 눌러 보세요.";
      var it = ITEM[sel.item];
      if (doneCells[sel.item]) return it.label + " — 실험을 마친 모습이에요.";
      return it.kind === "rod"
        ? S.josa(it.label, "을", "를") + " 아직 끼우기 전이에요. 실행 버튼을 눌러 보세요."
        : it.label + "를 연결한 모습이에요. 스위치를 닫아 보세요.";
    }

    return {
      highlight: function (s) {
        curSel = s && s.item ? { item: s.item } : null;
        apply(curSel, curSel && doneCells[curSel.item]);
        caption.textContent = captionFor(curSel);
      },
      run: async function (sel) {
        var my = ++token;
        var it = ITEM[sel.item];
        curSel = { item: sel.item };
        apply(curSel, false);
        caption.textContent = it.kind === "circuit" ? "① 스위치를 닫아요…" : "① " + S.josa(it.label, "을", "를") + " 끼워요…";
        await sleep(520);
        if (my !== token) return;
        doneCells[sel.item] = true;
        apply(curSel, true);
        // 결과(켜짐/안 켜짐)는 캡션에 쓰지 않는다 — 보기와 같은 말이 되므로(단계 D). 그림과 그림 설명(aria-label)으로 본다.
        caption.textContent = "② " + (it.kind === "circuit" ? "스위치를 닫았어요." : S.josa(it.label, "을", "를") + " 끼웠어요.") + " 전구를 잘 살펴보세요.";
        await sleep(420);
      },
      showInstant: function (sel) {
        if (!sel || !sel.item || !ITEM[sel.item]) return;
        doneCells[sel.item] = true;
        curSel = { item: sel.item };
        apply(curSel, true);
      },
      clear: function () {
        token++;
        doneCells = {};
        apply(curSel, false);
        caption.textContent = "전기 회로를 처음 상태로 되돌렸어요.";
      },
      resetView: function () {},
      dispose: function () {
        token++;
      },
    };
  }

  /* ───────── 3. 기록·분석하기: 결과 표 2개 ───────── */
  var nav = null;
  function matrixFor(elm, cfg, list) {
    S.TableChart.renderMatrix(elm, {
      caption: cfg.caption,
      rowHeader: cfg.rowHeader,
      rows: list.map(function (x) {
        return { id: x.id, label: x.kind === "circuit" ? "회로 " + x.short : x.label };
      }),
      cols: [{ id: "lit", label: cfg.colLabel }],
      emptyText: "아직 기록 없음",
      cell: function (r) {
        var rec = records.get(r.id);
        if (!rec) return null;
        var wrong = rec.result !== expected(r.id);
        return {
          text: rec.result,
          icon: C.resultIcon[rec.result] || null,
          flag: wrong ? "다시 관찰해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ item: r.id });
          },
        };
      },
    });
  }
  function drawResultTables() {
    matrixFor($("result-table1"), C.table1, ITEMS.filter(function (x) { return x.kind === "circuit"; }));
    matrixFor($("result-table2"), C.table2, ITEMS.filter(function (x) { return x.kind === "rod"; }));
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function recordRows() {
    return ITEMS.map(function (it) {
      var rec = records.get(it.id);
      return { item: it.label, group: it.kind === "circuit" ? C.phase1.name : C.phase2.name, result: rec ? rec.result : "" };
    });
  }
  function obsQa() {
    return ITEMS.map(function (it) {
      var rec = records.get(it.id);
      return {
        stage: "experiment",
        id: qaId(it.id),
        label: it.label + " 관찰",
        question: obsQuestion(it.id),
        kind: "choice",
        options: C.observeChoices.slice(),
        answer: { chosen: rec ? [rec.result] : [], correct: !!rec && rec.result === expected(it.id), tries: rec ? rec.tries || 0 : 0 },
      };
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
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened(),
      records: records.list().map(function (r) {
        return { item: ITEM[r.item].label, kind: r.kind, result: r.result, tries: r.tries || 0, recordedAt: r.recordedAt };
      }),
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosity.value(),
      // 질문-답 표준 목록(관리자 "학생 응답" 화면용, docs/admin/responses-spec.md §3.3)
      qa: [].concat(
        predict.qa("predict"),
        obsQa(),
        [
          {
            stage: "experiment",
            id: "records",
            label: "내 실험 기록",
            question: "전기 회로 (가)~(라)와 막대 재질별 전구의 불",
            kind: "table",
            answer: {
              columns: [
                { key: "group", label: "실험" },
                { key: "item", label: "실험한 것" },
                { key: "result", label: "전구" },
              ],
              rows: recordRows(),
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
      return conclude.isDone() || "결론을 먼저 적고 '제출하고 모범 답안 보기'를 눌러 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var n = Object.keys(q).filter(function (k) {
        return q[k].correct;
      }).length;
      var p = exp.progress();
      return ["관찰하고 기록한 칸: " + p.done + "/" + p.total + "칸", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
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
        return predict.isDone() || "예상하기 질문에 내 생각을 " + C.predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "관찰할 " + p.total + "칸을 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)";
      },
      conclude: function () {
        if (!exp.allDone()) return "먼저 실험하기에서 7칸을 모두 기록해 주세요.";
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
      experiment: exp.activate,
      analyze: drawResultTables,
    },
  });
})();
