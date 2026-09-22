/*
 * app.js — sci-6-1-2-1 "운동하는 물체의 특징을 찾아라!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(교실 안·바닷가·공원)과 5초 간격 사진 두 장(사진 1·사진 2)  ② 관찰 카드(사진 비교)
 *   ③ 기록 한눈에 보기·분석 표·퀴즈 연결  만 만든다.
 * 어떤 물체가 움직이는지는 LessonConfig.scenes[].objects[].moved(지도서 값)에서만 정한다.
 *   moved=true인 물체만 MOVERS에 경로가 있고, 나머지는 장면을 만든 자리에서 절대 움직이지 않는다.
 * 사진은 삼각대처럼 같은 방향에서 두 번 찍는다(사진 1을 찍을 때의 시점을 사진 2에도 그대로 쓴다).
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
  // fix-1(2026-09-22): 분석 보기 순서·발전 질문 2가 바뀌었다. 예전 판에서 저장한 해당 답은 새 문항과 맞지 않으므로 지운다.
  (function () {
    if (store.get("contentRev", 0) >= 2) return;
    var an = store.get("analysis", null);
    if (an && typeof an === "object") {
      ["q2", "q3", "q4"].forEach(function (k) {
        delete an[k];
      });
      store.set("analysis", an);
    }
    var cc = store.get("conclude", null);
    if (cc && typeof cc === "object" && cc.ext2) {
      delete cc.ext2;
      store.set("conclude", cc);
    }
    store.set("contentRev", 2);
  })();
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;
  var WAIT = C.waitSeconds;
  var SAME = C.observeChoices[0];
  var DIFF = C.observeChoices[1];

  /* ───────── 장면·물체 찾기 ───────── */
  var SCENE = {};
  var OBJ = {};
  C.scenes.forEach(function (sc) {
    SCENE[sc.id] = sc;
    sc.objects.forEach(function (o) {
      OBJ[o.id] = { id: o.id, name: o.name, moved: o.moved, scene: sc.id };
    });
  });
  function keyOf(scene, obj) {
    return scene + ":" + obj;
  }
  function expected(objId) {
    return OBJ[objId].moved ? DIFF : SAME;
  }

  /* ───────── 움직임 모형(장면 시간 t초 → 자리) ─────────
   * 장면마다 '장면 시간'을 두고, 사진 찍기 한 번에 실제 5초만큼 흐른다(새로고침해도 이어짐).
   * 움직이는 물체는 닫힌 길(타원)을 따라 계속 가므로 순간 이동이 없다. 5초 동안 가는 거리는 모형이다. */
  function loop(cx, cz, rx, rz, speed, a0, dir, y) {
    var R = Math.sqrt((rx * rx + rz * rz) / 2);
    var w = speed / R;
    return function (t) {
      var a = a0 + dir * w * t;
      var dx = -rx * Math.sin(a) * dir;
      var dz = rz * Math.cos(a) * dir;
      return { x: cx + rx * Math.cos(a), y: y || 0, z: cz + rz * Math.sin(a), yaw: Math.atan2(dx, dz), dist: speed * t, dx: dx };
    };
  }
  var strollerPath = loop(-4, 4.1, 4.2, 1.9, 0.8, 0.9, 1);
  var MOVERS = {
    walker: loop(-6.2, 3, 3.4, 2.2, 0.75, 1.9, 1),
    clock: null, // 바늘만 돈다(clockAngles)
    gull: loop(-1.5, -3.2, 3.2, 2.1, 1.2, 0.3, -1, 5),
    boat: loop(1.5, -5.5, 5, 1.1, 0.7, 2.6, 1),
    stroller: strollerPath,
    dog: (function () {
      var R = Math.sqrt((4.2 * 4.2 + 1.9 * 1.9) / 2);
      var outer = loop(-4, 4.1, 5.0, 2.7, 0.8 * (Math.sqrt((25 + 2.7 * 2.7) / 2) / R), 0.9 + 0.16, 1);
      return outer;
    })(),
    biker: loop(-1, 2.5, 7.8, 3.45, 2.0, 3.6, 1), // 산책로(7.5×3.2, 폭 1.5) 바깥 차선 — 연못과 겹쳐 보이지 않게
    runner: loop(-1, 2.5, 7.0, 2.75, 1.5, 0.8, -1),
    duckboat: loop(6, -4.8, 1.8, 1.8, 0.5, 1.2, 1),
    plane: loop(0, -2.5, 7.5, 1.5, 3, 3.9, 1, 4.8), // 가로로 긴 3D 화면에서도 사진 안에 들도록 낮고 가깝게(나무 꼭대기 약 4.4보다 높게)
  };
  // 2D 그림은 화면 비율이 고정이라 하늘 높이 떠 있는 예전 경로를 그대로 쓴다(3D는 좁은 화면에서도 사진에 들도록 낮춘 경로).
  var MOVERS_2D = { plane: loop(0, -6, 9, 2.2, 3, 3.9, 1, 6.2) };
  // 움직이는 물체(moved)와 경로가 1:1로 맞는지 확인(지도서 값과 화면이 어긋나지 않게)
  Object.keys(OBJ).forEach(function (id) {
    var has = Object.prototype.hasOwnProperty.call(MOVERS, id);
    if (OBJ[id].moved !== has) console.warn("[sci-6-1-2-1] 움직임 설정이 지도서 값과 다릅니다:", id);
  });
  // 벽시계: 10시 10분 0초에서 시작. 초침 6˚/초(5초 → 30˚), 분침 0.1˚/초, 시침 1/120˚/초
  var CLOCK_START = 10 * 3600 + 10 * 60;
  function clockAngles(t) {
    var s = CLOCK_START + t;
    return { sec: ((s % 60) / 60) * 360, min: ((s % 3600) / 3600) * 360, hour: ((s % 43200) / 43200) * 360 };
  }
  var sceneTime = { A: 0, B: 0, C: 0 };
  (function () {
    var saved = store.get("sceneTime", null);
    if (saved && typeof saved === "object")
      Object.keys(sceneTime).forEach(function (k) {
        if (typeof saved[k] === "number" && isFinite(saved[k]) && saved[k] >= 0) sceneTime[k] = saved[k] % 3600;
      });
  })();
  function saveTime() {
    store.set("sceneTime", sceneTime);
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.scene, r.objId);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  // 퀴즈 보기는 글자 그대로 id로 쓴다(저장 detail에도 그대로 남는다)
  var QUIZ = C.quiz.map(function (q) {
    var ids = {};
    var opts = q.options.map(function (label, i) {
      ids[label] = "o" + (i + 1);
      return { id: "o" + (i + 1), label: label };
    });
    var wrongBy = null;
    if (q.wrongBy) {
      wrongBy = {};
      Object.keys(q.wrongBy).forEach(function (label) {
        wrongBy[ids[label]] = q.wrongBy[label];
      });
    }
    return {
      id: q.id,
      text: q.text,
      multi: !!q.multi,
      options: opts,
      answer: q.answer.map(function (a) {
        return ids[a];
      }),
      correct: q.correct,
      wrong: q.wrong,
      wrongBy: wrongBy,
    };
  });
  var quiz = S.Quiz.render($("quiz-root"), QUIZ, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);

  /* ───────── 2. 실험하기: 알아 두기(새·나무 미리보기) ───────── */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) {
      if (c) n.appendChild(c);
    });
    return n;
  }
  function birdTreePhoto(flown, caption) {
    var s = svgEl("svg", { viewBox: "0 0 200 140", class: "demo-photo", role: "img", "aria-label": caption });
    s.appendChild(svgEl("rect", { x: 0, y: 0, width: 200, height: 140, fill: "#d8ecfa" }));
    s.appendChild(svgEl("rect", { x: 0, y: 112, width: 200, height: 28, fill: "#9fcf86" }));
    // 나무(같은 자리)
    s.appendChild(svgEl("rect", { x: 62, y: 70, width: 14, height: 46, fill: "#8a6343" }));
    s.appendChild(svgEl("circle", { cx: 69, cy: 58, r: 30, fill: "#5f9e53" }));
    s.appendChild(svgEl("line", { x1: 76, y1: 82, x2: 104, y2: 70, stroke: "#8a6343", "stroke-width": 5, "stroke-linecap": "round" }));
    // 새
    var bx = flown ? 164 : 100;
    var by = flown ? 30 : 60;
    var bird = svgEl("g", { transform: "translate(" + bx + "," + by + ")" }, [
      svgEl("ellipse", { cx: 0, cy: 0, rx: 9, ry: 6, fill: "#46505e" }),
      svgEl("circle", { cx: 7, cy: -5, r: 4, fill: "#46505e" }),
      svgEl("path", { d: "M10 -5 L15 -4 L10 -3 Z", fill: "#e0a030" }),
      flown ? svgEl("path", { d: "M-6 -2 L-2 -16 L4 -3 Z", fill: "#5d6878" }) : svgEl("path", { d: "M-8 -1 L4 -3 L-2 3 Z", fill: "#5d6878" }),
    ]);
    s.appendChild(bird);
    return el("figure", { class: "demo-fig" }, [s, el("figcaption", { text: caption })]);
  }
  function introNode() {
    var box = el("div", { class: "intro-box" });
    box.appendChild(
      el("div", { class: "demo-pair" }, [birdTreePhoto(false, "📷 사진 1"), el("span", { class: "demo-arrow", "aria-hidden": "true", text: "5초 뒤 →" }), birdTreePhoto(true, "📷 사진 2 (5초 뒤)")])
    );
    box.appendChild(el("p", { class: "ss-help", text: C.intro.demoCaption }));
    var ol = el("ul", { class: "intro-steps" });
    C.intro.steps.forEach(function (t) {
      ol.appendChild(el("li", null, [S.rich(t, "span")]));
    });
    box.appendChild(ol);
    box.appendChild(el("p", { class: "ss-term" }, [S.rich(C.intro.note, "span")]));
    return box;
  }
  // 안전 약속(가치·태도 목표): 하나씩 확인 표시(임시 저장, 결과에도 남긴다)
  var safetyState = store.get("safety", []) || [];
  var safetyCard = (function () {
    var list = el("ul", { class: "safety-list" });
    var count = el("p", { class: "ss-help", "aria-live": "polite" });
    function drawCount() {
      var n = safetyState.length;
      count.textContent = n >= C.safety.items.length ? "✅ 약속을 모두 확인했어요." : "확인한 약속: " + n + "/" + C.safety.items.length;
    }
    C.safety.items.forEach(function (t, i) {
      var id = "safety-" + i;
      var cb = el("input", { type: "checkbox", id: id });
      cb.checked = safetyState.indexOf(i) >= 0;
      cb.addEventListener("change", function () {
        safetyState = safetyState.filter(function (x) {
          return x !== i;
        });
        if (cb.checked) safetyState.push(i);
        store.set("safety", safetyState);
        drawCount();
      });
      list.appendChild(el("li", null, [el("label", { for: id, class: "safety-item" }, [cb, el("span", { text: t })])]));
    });
    drawCount();
    var d = el("details", { class: "ss-card safety" }, [
      el("summary", { text: C.safety.title }),
      el("p", { class: "ss-help", text: "이 앱은 사진 대신 3D 장면(모형)으로 관찰해요. 실제로 교실과 창밖을 찍어 관찰할 때 지킬 약속을 읽고 하나씩 확인해 보세요." }),
      list,
      count,
    ]);
    d.open = store.get("safetyOpen", true) !== false;
    d.addEventListener("toggle", function () {
      store.set("safetyOpen", d.open);
    });
    return d;
  })();

  /* ───────── 기록 한눈에 보기(장면마다 물체 수가 달라 앱이 직접 그린다) ───────── */
  var overview = el("div", { class: "overview" });
  var overviewBox = el("details", { class: "ss-card ss-mini-box" }, [
    el("summary", null, ["기록한 물체 한눈에 보기", el("span", { class: "ss-help", text: " (물체를 누르면 그 물체를 골라요)" })]),
    overview,
  ]);
  overviewBox.open = true;
  var curSel = {};
  function drawOverview() {
    overview.textContent = "";
    C.scenes.forEach(function (sc, i) {
      var prevDone = i === 0 || exp.phaseDone(C.scenes[i - 1].id);
      var n = exp.phaseCount(sc.id);
      var row = el("div", { class: "ov-row" + (prevDone ? "" : " is-locked") });
      row.appendChild(el("p", { class: "ov-head", text: (n >= sc.objects.length ? "✅ " : prevDone ? "" : "🔒 ") + sc.name + " " + n + "/" + sc.objects.length }));
      var chips = el("div", { class: "ov-chips" });
      sc.objects.forEach(function (o) {
        var done = records.has(keyOf(sc.id, o.id));
        var isSel = curSel.scene === sc.id && curSel.obj === o.id;
        chips.appendChild(
          el("button", {
            type: "button",
            class: "ov-chip" + (done ? " is-rec" : "") + (isSel ? " is-sel" : ""),
            disabled: exp.isBusy() || !prevDone,
            "aria-pressed": String(isSel),
            "aria-label": sc.name + ", " + o.name + (done ? ", 기록함" : prevDone ? ", 아직 기록 안 함" : ", 잠김"),
            text: (done ? "✓ " : "") + o.name,
            onclick: function () {
              exp.select({ scene: sc.id, obj: o.id });
            },
          })
        );
      });
      row.appendChild(chips);
      overview.appendChild(row);
    });
  }

  /* ───────── 사진(사진 1 · 사진 2) ───────── */
  var photos = null; // 마지막으로 찍은 두 사진 { sel, kind: "img"|"svg", p1, p2, z1, z2 }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function cropCanvas(src, x, y, w, h) {
    var c = document.createElement("canvas");
    var W = 360;
    c.width = W;
    c.height = Math.round((W * h) / w);
    c.getContext("2d").drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
    try {
      return c.toDataURL("image/jpeg", 0.88);
    } catch (e) {
      return "";
    }
  }
  function photoFig(kind, content, caption, alt) {
    var media;
    if (kind === "img") media = el("img", { src: content, alt: alt, class: "photo-media", draggable: "false" });
    else {
      media = content;
      media.setAttribute("class", "scene2d photo-media"); // 2D 그림의 글자 스타일을 그대로 쓴다
      media.setAttribute("role", "img");
      media.setAttribute("aria-label", alt);
    }
    return el("figure", { class: "photo-fig" }, [media, el("figcaption", { text: caption })]);
  }
  function observeBody(sel) {
    var box = el("div", { class: "photos" });
    var name = OBJ[sel.obj].name;
    if (!photos || photos.sel.scene !== sel.scene || photos.sel.obj !== sel.obj || !photos.p1) {
      box.appendChild(el("p", { class: "ss-help", text: "사진을 만들지 못했어요. 방금 본 장면을 떠올려 골라 보세요." }));
      return box;
    }
    var P = photos;
    box.appendChild(
      el("div", { class: "photo-pair" }, [
        photoFig(P.kind, P.p1, "📷 사진 1", "사진 1: " + SCENE[sel.scene].name + " 장면. " + (P.in1 === false ? "고른 물체(" + name + ")는 사진 밖에 있음" : "고른 물체(" + name + ")에 점선 원 표시")),
        photoFig(P.kind, P.p2, "📷 사진 2 (5초 뒤)", "사진 2: 5초 뒤 같은 방향에서 찍은 " + SCENE[sel.scene].name + " 장면. " + (P.in2 === false ? "고른 물체(" + name + ")는 사진 밖에 있음" : "고른 물체(" + name + ")에 점선 원 표시")),
      ])
    );
    if (P.in1 === false || P.in2 === false)
      box.appendChild(
        el("p", { class: "ss-help", text: "⚠️ " + (P.in1 === false ? "사진 1" : "사진 2") + "에서는 고른 물체가 화면 밖에 있었어요. 3D 화면을 돌려 물체가 잘 보이게 한 뒤 다시 찍어 보세요." })
      );
    if (P.z1 && P.z2) {
      box.appendChild(el("p", { class: "photo-sub", text: "🔍 사진 1에서 고른 물체가 있던 곳을 두 사진에서 똑같이 잘라 크게 본 모습" }));
      box.appendChild(
        el("div", { class: "photo-pair is-zoom" }, [
          photoFig(P.kind, P.z1, "🔍 사진 1 확대", "사진 1 확대: " + name + " 주변"),
          photoFig(P.kind, P.z2, "🔍 사진 2 확대", "사진 2 확대: 사진 1과 같은 곳"),
        ])
      );
    }
    box.appendChild(el("p", { class: "ss-help", text: "💡 두 사진은 같은 자리에서 같은 방향으로 찍었어요. 점선 원 안의 물체가 두 사진에서 어디에 있는지 비교해 보세요." }));
    return box;
  }
  function shutterFlash(container) {
    var f = el("div", { class: "shutter", "aria-hidden": "true" });
    container.appendChild(f);
    setTimeout(function () {
      if (f.parentNode) f.parentNode.removeChild(f);
    }, 420);
  }

  /* ───────── 새로고침 뒤 선택 되살리기 ───────── */
  function rememberSel(s) {
    curSel = { scene: s.scene || null, obj: s.obj || null };
    if (s.scene) store.set("curSel", curSel);
    drawOverview();
  }
  function firstOpenScene() {
    for (var i = 0; i < C.scenes.length; i++) if (!exp.phaseDone(C.scenes[i].id)) return C.scenes[i].id;
    return C.scenes[0].id;
  }
  function sceneOpen(id) {
    var idx = C.scenes.map(function (s) {
      return s.id;
    }).indexOf(id);
    for (var i = 0; i < idx; i++) if (!exp.phaseDone(C.scenes[i].id)) return false;
    return idx >= 0;
  }
  function sceneFor(s) {
    return s && s.scene && SCENE[s.scene] ? s.scene : firstOpenScene();
  }

  /* ───────── 장면 배치(3D·2D 공통 자리, 단위 ≈ m) ───────── */
  var FRAME = { width: 25, depth: 17, center: [0, 0.8, 0] };
  var LAYOUT = {
    A: {
      desk: { at: [7, 0, -1.2] },
      desks: [[0, 0, -1.2], [3.5, 0, -1.2], [0, 0, 2.6], [3.5, 0, 2.6], [7, 0, 2.6]],
      window: { at: [-6, 0, -7.45] },
      plant: { at: [-10.2, 0, -6.4] },
      friend1: { at: [-6, 0, -6.3] },
      friend2: { at: [3.5, 0, 1.95] }, // 책상(3.5, 2.6) 뒤에 앉아 앞(+z)을 봄
      clock: { at: [3, 4.4, -7.4] },
    },
    B: {
      lighthouse: { at: [-9.6, 0, -3.3] },
      bench: { at: [2.6, 0, 3] },
      seated: { at: [3.4, 0, 3] },
      wheelchair: { at: [6.8, 0, 1.2] },
      rock: { at: [-5.6, 0, -1.7] },
      grass: { at: [9, 0, 5.4] },
      tree: { at: [9.8, 0, -1.2] },
    },
    C: {
      gym: { at: [-8.6, 0, -4.6] },
      bench2: { at: [-3, 0, -4.8] },
      reader: { at: [-2.6, 0, -4.8] },
      tree2: { at: [1.6, 0, -5.6] },
      pond: { at: [6, 0, -4.8], r: 2.9 },
      track: { cx: -1, cz: 2.5, rx: 7.5, rz: 3.2, w: 1.5 },
    },
  };
  function sceneSky(id) {
    return id === "A" ? null : true;
  }

  /* ───────── 2. 실험하기: 실험 틀 연결 ───────── */
  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    loadingText: "3D 장면을 준비하고 있어요…",
    clearLabel: "↺ 장면을 맨 처음 모습으로",
    clearMessage: "움직인 물체들을 맨 처음 모습으로 되돌렸어요. 기록은 그대로 남아 있어요.",
    runTitle: "사진 찍기",
    factors: [
      {
        id: "scene",
        title: "장면 고르기",
        short: "장면",
        columns: 3,
        phaseTag: false,
        options: C.scenes.map(function (sc) {
          return { id: sc.id, label: sc.name };
        }),
        note: function (sel) {
          return sel.scene ? "📖 " + SCENE[sel.scene].source + "을 본뜬 장면(모형)이에요." : null;
        },
      },
      {
        id: "obj",
        title: "관찰할 물체 고르기",
        short: "물체",
        phaseTag: false,
        options: Object.keys(OBJ).map(function (id) {
          return { id: id, label: OBJ[id].name };
        }),
        visible: function (oid, sel) {
          return !!sel.scene && OBJ[oid].scene === sel.scene;
        },
        note: function (sel) {
          return sel.scene ? null : "먼저 ① 장면을 고르면 관찰할 물체가 나와요.";
        },
      },
    ],
    phases: C.scenes.map(function (sc) {
      return {
        id: sc.id,
        name: sc.name,
        lead: sc.lead,
        cells: sc.objects.map(function (o) {
          return { scene: sc.id, obj: o.id };
        }),
      };
    }),
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.scene, sel.obj);
    },
    runLabel: function () {
      return "📷 사진 찍기 (" + WAIT + "초 뒤 다시 찍기)";
    },
    busyLabel: "⏱ 초시계로 " + WAIT + "초를 재는 중… 장면을 잘 지켜보세요 👀",
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 물체를 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 물체를 눌러 고를 수도 있어요.",
    },
    observe: function (sel) {
      return { question: C.observeQuestion, body: observeBody(sel), type: "choice", choices: C.observeChoices };
    },
    makeRecord: function (sel, observed) {
      return { scene: sel.scene, objId: sel.obj, object: OBJ[sel.obj].name, result: observed };
    },
    describeRecord: function (r) {
      return SCENE[r.scene].name + " · " + r.object + " → " + r.result;
    },
    extras: [overviewBox, safetyCard],
    onBusy: function () {
      drawOverview();
    },
    onChange: function () {
      lesson.refresh();
      drawOverview();
    },
  });

  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (!selRestored) {
      selRestored = true;
      var saved = store.get("curSel", null);
      var s = null;
      if (saved && saved.scene && SCENE[saved.scene] && sceneOpen(saved.scene)) {
        s = { scene: saved.scene };
        if (saved.obj && OBJ[saved.obj] && OBJ[saved.obj].scene === saved.scene) s.obj = saved.obj;
      } else s = { scene: firstOpenScene() }; // 장면만 미리 고른다(물체는 학생이 직접)
      exp.select(s);
    }
    drawOverview();
  }

  /* ───────── 2D 대체 화면: 비스듬히 내려다본 그림(모형) ───────── */
  // 3D 자리(x, y, z) → 그림 자리. 앞(+z)일수록 아래, 높을수록(+y) 위.
  function P2(x, y, z) {
    return [x, z * 0.62 - y * 0.95];
  }
  var VB = { x: -12.5, y: -11.6, w: 25, h: 17.2 };
  var INK = "#3a4452";
  var PERSON = { shirts: [0x8a94a6, 0x6f7b8f, 0x9aa3b2, 0x7d8797, 0x858d9c], pants: 0x4f5866, head: 0xc4c9d1 };
  function hex(n) {
    return "#" + ("000000" + n.toString(16)).slice(-6);
  }
  function shirtOf(id) {
    var i = 0;
    for (var k = 0; k < id.length; k++) i += id.charCodeAt(k);
    return PERSON.shirts[i % PERSON.shirts.length];
  }

  function build2D(root, ctx) {
    var wrap = el("div", { class: "scene2d-wrap" });
    root.appendChild(wrap);
    var svg = null;
    var shown = null;
    var items = {}; // objId → { g, parts, base:[x,y,z], ext:{w,h}, update(t) }
    var ring = null;
    var ringLabel = null;
    var selObj = null;

    function person2(opts) {
      // opts.pose: stand | sit | walk | ride · 원점 = 발 아래(앉은 자세는 엉덩이 아래 바닥)
      var g = svgEl("g");
      var shirt = hex(opts.shirt || PERSON.shirts[0]);
      var pants = hex(PERSON.pants);
      var head = hex(PERSON.head);
      var parts = {};
      if (opts.pose === "sit" || opts.pose === "ride") {
        var hy = opts.pose === "ride" ? -0.95 : -0.47;
        parts.thigh = svgEl("line", { x1: 0, y1: hy, x2: 0.42, y2: hy, stroke: pants, "stroke-width": 0.2, "stroke-linecap": "round" });
        parts.shin = svgEl("line", { x1: 0.42, y1: hy, x2: 0.42, y2: opts.pose === "ride" ? -0.45 : 0, stroke: pants, "stroke-width": 0.18, "stroke-linecap": "round" });
        g.appendChild(parts.thigh);
        g.appendChild(parts.shin);
        g.appendChild(svgEl("rect", { x: -0.24, y: hy - 0.62, width: 0.48, height: 0.62, rx: 0.1, fill: shirt }));
        g.appendChild(svgEl("circle", { cx: 0, cy: hy - 0.8, r: 0.17, fill: head }));
        if (opts.book) g.appendChild(svgEl("rect", { x: 0.18, y: hy - 0.46, width: 0.34, height: 0.24, fill: "#f4efe2", stroke: "#8a6a3b", "stroke-width": 0.04 }));
        if (opts.pose === "ride") g.appendChild(svgEl("line", { x1: 0.05, y1: hy - 0.5, x2: 0.55, y2: hy - 0.35, stroke: shirt, "stroke-width": 0.13, "stroke-linecap": "round" }));
      } else {
        parts.legL = svgEl("line", { x1: -0.08, y1: -0.85, x2: -0.08, y2: 0, stroke: pants, "stroke-width": 0.17, "stroke-linecap": "round" });
        parts.legR = svgEl("line", { x1: 0.08, y1: -0.85, x2: 0.08, y2: 0, stroke: pants, "stroke-width": 0.17, "stroke-linecap": "round" });
        g.appendChild(parts.legL);
        g.appendChild(parts.legR);
        g.appendChild(svgEl("rect", { x: -0.24, y: -1.47, width: 0.48, height: 0.64, rx: 0.1, fill: shirt }));
        g.appendChild(svgEl("circle", { cx: 0, cy: -1.65, r: 0.17, fill: head }));
      }
      return { g: g, parts: parts };
    }
    function swingLegs(parts, phase, amp) {
      if (!parts.legL) return;
      var a = Math.sin(phase) * (amp || 0.35);
      parts.legL.setAttribute("x2", String(-0.08 + Math.sin(a) * 0.85));
      parts.legL.setAttribute("y2", String(-0.85 + Math.cos(a) * 0.85));
      parts.legR.setAttribute("x2", String(0.08 - Math.sin(a) * 0.85));
      parts.legR.setAttribute("y2", String(-0.85 + Math.cos(a) * 0.85));
    }
    function tree2(scale) {
      var s = scale || 1;
      return svgEl("g", null, [
        svgEl("rect", { x: -0.2 * s, y: -1.8 * s, width: 0.4 * s, height: 1.8 * s, fill: "#8a6343" }),
        svgEl("circle", { cx: 0, cy: -2.6 * s, r: 1.2 * s, fill: "#5f9e53" }),
        svgEl("circle", { cx: -0.6 * s, cy: -2.1 * s, r: 0.8 * s, fill: "#6aab5d" }),
      ]);
    }
    function bench2d() {
      return svgEl("g", null, [
        svgEl("rect", { x: -1.2, y: -0.5, width: 2.4, height: 0.14, fill: "#a0703f" }),
        svgEl("rect", { x: -1.2, y: -1.05, width: 2.4, height: 0.14, fill: "#a0703f" }),
        svgEl("line", { x1: -1, y1: -0.36, x2: -1, y2: 0, stroke: "#5c4a38", "stroke-width": 0.1 }),
        svgEl("line", { x1: 1, y1: -0.36, x2: 1, y2: 0, stroke: "#5c4a38", "stroke-width": 0.1 }),
      ]);
    }
    function desk2d() {
      return svgEl("g", null, [
        svgEl("rect", { x: -0.65, y: -0.8, width: 1.3, height: 0.12, fill: "#c79a62", stroke: "#8a6a3b", "stroke-width": 0.03 }),
        svgEl("line", { x1: -0.55, y1: -0.68, x2: -0.55, y2: 0, stroke: "#6b7280", "stroke-width": 0.07 }),
        svgEl("line", { x1: 0.55, y1: -0.68, x2: 0.55, y2: 0, stroke: "#6b7280", "stroke-width": 0.07 }),
      ]);
    }

    // 물체 하나 그리기: kind → { g, parts, ext(표시 원 크기), top(라벨 높이) }
    function drawObj(sc, id) {
      var L = LAYOUT[sc] || {};
      var g = svgEl("g");
      var parts = {};
      var ext = { w: 1, h: 1.8 };
      var p;
      switch (id) {
        case "desk":
          g.appendChild(desk2d());
          ext = { w: 1.4, h: 0.9 };
          break;
        case "window":
          g.appendChild(svgEl("rect", { x: -1.6, y: -4.2, width: 3.2, height: 2.2, fill: "#cfe8f7", stroke: "#e9eef3", "stroke-width": 0.18 }));
          g.appendChild(svgEl("line", { x1: 0, y1: -4.2, x2: 0, y2: -2, stroke: "#e9eef3", "stroke-width": 0.12 }));
          ext = { w: 3.4, h: 2.4, cy: -3.1 };
          break;
        case "plant":
          g.appendChild(svgEl("path", { d: "M-0.35 -0.6 L0.35 -0.6 L0.27 0 L-0.27 0 Z", fill: "#b5653a" }));
          g.appendChild(svgEl("circle", { cx: 0, cy: -1.05, r: 0.5, fill: "#4f9a4a" }));
          g.appendChild(svgEl("circle", { cx: -0.3, cy: -0.8, r: 0.3, fill: "#5aa653" }));
          ext = { w: 1.1, h: 1.6 };
          break;
        case "friend1":
          p = person2({ pose: "stand", shirt: shirtOf(id) });
          g.appendChild(p.g);
          break;
        case "friend2":
        case "reader":
          if (id === "reader") g.appendChild(svgEl("g", { transform: "translate(-0.3,0)" }, [bench2d()]));
          else g.appendChild(svgEl("rect", { x: -0.3, y: -0.47, width: 0.6, height: 0.08, fill: "#8d96a3" }));
          p = person2({ pose: "sit", shirt: shirtOf(id), book: true });
          g.appendChild(p.g);
          ext = { w: 1.1, h: 1.5, up: true };
          break;
        case "walker":
        case "stroller":
        case "runner":
          p = person2({ pose: "walk", shirt: shirtOf(id) });
          parts = p.parts;
          g.appendChild(p.g);
          break;
        case "clock":
          g.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 1.25, fill: "#ffffff", stroke: "#4a5361", "stroke-width": 0.14 }));
          for (var k = 0; k < 12; k++) {
            var a = (k / 12) * Math.PI * 2;
            g.appendChild(svgEl("line", { x1: Math.sin(a) * 1.0, y1: -Math.cos(a) * 1.0, x2: Math.sin(a) * 1.13, y2: -Math.cos(a) * 1.13, stroke: "#4a5361", "stroke-width": k % 3 ? 0.04 : 0.09 }));
          }
          parts.hour = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: -0.55, stroke: "#1f2733", "stroke-width": 0.11, "stroke-linecap": "round" });
          parts.min = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: -0.85, stroke: "#1f2733", "stroke-width": 0.07, "stroke-linecap": "round" });
          parts.sec = svgEl("line", { x1: 0, y1: 0.2, x2: 0, y2: -1.05, stroke: "#c0392b", "stroke-width": 0.035, "stroke-linecap": "round" });
          g.appendChild(parts.hour);
          g.appendChild(parts.min);
          g.appendChild(parts.sec);
          g.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 0.07, fill: "#1f2733" }));
          ext = { w: 2.8, h: 2.8, cy: 0 };
          break;
        case "lighthouse":
          g.appendChild(svgEl("path", { d: "M-0.7 0 L-0.45 -4.6 L0.45 -4.6 L0.7 0 Z", fill: "#f5f5f0", stroke: "#b9bec6", "stroke-width": 0.05 }));
          g.appendChild(svgEl("path", { d: "M-0.62 -1.3 L-0.57 -2.1 L0.57 -2.1 L0.62 -1.3 Z", fill: "#c94b43" }));
          g.appendChild(svgEl("path", { d: "M-0.53 -3.0 L-0.5 -3.7 L0.5 -3.7 L0.53 -3.0 Z", fill: "#c94b43" }));
          g.appendChild(svgEl("rect", { x: -0.4, y: -5.2, width: 0.8, height: 0.6, fill: "#f3e5a4", stroke: "#4a5361", "stroke-width": 0.05 }));
          g.appendChild(svgEl("path", { d: "M-0.6 -5.2 L0 -5.8 L0.6 -5.2 Z", fill: "#4a5361" }));
          ext = { w: 1.8, h: 6 };
          break;
        case "bench":
        case "bench2":
          g.appendChild(bench2d());
          ext = { w: 2.6, h: 1.2 };
          break;
        case "seated":
          p = person2({ pose: "sit", shirt: shirtOf(id) });
          g.appendChild(p.g);
          ext = { w: 1, h: 1.5, up: true };
          break;
        case "wheelchair":
          g.appendChild(svgEl("circle", { cx: -0.1, cy: -0.36, r: 0.36, fill: "none", stroke: "#3b4250", "stroke-width": 0.08 }));
          p = person2({ pose: "sit", shirt: shirtOf(id) });
          g.appendChild(p.g);
          g.appendChild(svgEl("circle", { cx: 0.5, cy: -0.1, r: 0.1, fill: "#3b4250" }));
          ext = { w: 1.2, h: 1.6 };
          break;
        case "rock":
          g.appendChild(svgEl("path", { d: "M-1.1 0 L-0.8 -0.7 L-0.1 -1.05 L0.7 -0.8 L1.1 0 Z", fill: "#8a8f96", stroke: "#6b7078", "stroke-width": 0.05 }));
          ext = { w: 2.3, h: 1.2 };
          break;
        case "grass":
          [-0.6, -0.2, 0.2, 0.6].forEach(function (x, i) {
            g.appendChild(svgEl("path", { d: "M" + (x - 0.15) + " 0 L" + x + " " + (-0.7 - (i % 2) * 0.25) + " L" + (x + 0.15) + " 0 Z", fill: "#4f9a4a" }));
          });
          ext = { w: 1.6, h: 1 };
          break;
        case "tree":
        case "tree2":
          g.appendChild(tree2(1));
          ext = { w: 2.6, h: 3.9 };
          break;
        case "gull":
          parts.wing = svgEl("path", { d: "M-0.7 -0.25 Q-0.35 -0.55 0 -0.1 Q0.35 -0.55 0.7 -0.25", fill: "none", stroke: "#f7f7f7", "stroke-width": 0.14, "stroke-linecap": "round" });
          g.appendChild(svgEl("ellipse", { cx: 0, cy: -0.1, rx: 0.32, ry: 0.14, fill: "#f7f7f7", stroke: "#8a929c", "stroke-width": 0.04 }));
          g.appendChild(parts.wing);
          g.appendChild(svgEl("path", { d: "M0.3 -0.13 L0.48 -0.09 L0.3 -0.05 Z", fill: "#e0a030" }));
          ext = { w: 1.6, h: 0.9, cy: -0.15 };
          break;
        case "boat":
          g.appendChild(svgEl("path", { d: "M-1.3 -0.5 L1.3 -0.5 L0.9 0 L-1 0 Z", fill: "#b85c38" }));
          g.appendChild(svgEl("line", { x1: 0, y1: -0.5, x2: 0, y2: -2.4, stroke: "#6b4a2b", "stroke-width": 0.08 }));
          g.appendChild(svgEl("path", { d: "M0.08 -2.3 L1.0 -0.7 L0.08 -0.7 Z", fill: "#f5f5f0", stroke: "#b9bec6", "stroke-width": 0.03 }));
          ext = { w: 2.8, h: 2.6 };
          break;
        case "dog":
          g.appendChild(svgEl("ellipse", { cx: 0, cy: -0.42, rx: 0.4, ry: 0.17, fill: "#a8743f" }));
          g.appendChild(svgEl("circle", { cx: 0.42, cy: -0.6, r: 0.14, fill: "#a8743f" }));
          parts.legL = svgEl("line", { x1: -0.25, y1: -0.35, x2: -0.25, y2: 0, stroke: "#7d5530", "stroke-width": 0.08 });
          parts.legR = svgEl("line", { x1: 0.25, y1: -0.35, x2: 0.25, y2: 0, stroke: "#7d5530", "stroke-width": 0.08 });
          g.appendChild(parts.legL);
          g.appendChild(parts.legR);
          g.appendChild(svgEl("line", { x1: -0.38, y1: -0.5, x2: -0.58, y2: -0.72, stroke: "#a8743f", "stroke-width": 0.07 }));
          ext = { w: 1.2, h: 0.9, up: true };
          break;
        case "gym":
          g.appendChild(svgEl("line", { x1: -1.2, y1: 0, x2: -1.2, y2: -2.2, stroke: "#4f6d8a", "stroke-width": 0.14 }));
          g.appendChild(svgEl("line", { x1: 1.2, y1: 0, x2: 1.2, y2: -2.2, stroke: "#4f6d8a", "stroke-width": 0.14 }));
          g.appendChild(svgEl("line", { x1: -1.25, y1: -2.15, x2: 1.25, y2: -2.15, stroke: "#4f6d8a", "stroke-width": 0.12 }));
          g.appendChild(svgEl("line", { x1: -1.2, y1: -1.2, x2: 1.2, y2: -1.2, stroke: "#6b8aa8", "stroke-width": 0.08 }));
          ext = { w: 2.8, h: 2.5 };
          break;
        case "biker":
          parts.w1 = svgEl("circle", { cx: -0.55, cy: -0.33, r: 0.33, fill: "none", stroke: "#2f3640", "stroke-width": 0.07 });
          parts.w2 = svgEl("circle", { cx: 0.55, cy: -0.33, r: 0.33, fill: "none", stroke: "#2f3640", "stroke-width": 0.07 });
          g.appendChild(parts.w1);
          g.appendChild(parts.w2);
          g.appendChild(svgEl("path", { d: "M-0.55 -0.33 L-0.05 -0.33 L0.3 -0.85 L-0.15 -0.9 Z M0.3 -0.85 L0.55 -0.33", fill: "none", stroke: "#3b7dd8", "stroke-width": 0.06 }));
          p = person2({ pose: "ride", shirt: shirtOf(id) });
          g.appendChild(svgEl("g", { transform: "translate(-0.2,0.05)" }, [p.g]));
          ext = { w: 1.6, h: 2 };
          break;
        case "duckboat":
          g.appendChild(svgEl("ellipse", { cx: 0, cy: -0.25, rx: 0.75, ry: 0.28, fill: "#f2c53d", stroke: "#b8902a", "stroke-width": 0.04 }));
          g.appendChild(svgEl("rect", { x: 0.35, y: -1.0, width: 0.18, height: 0.6, fill: "#f2c53d" }));
          g.appendChild(svgEl("circle", { cx: 0.46, cy: -1.08, r: 0.22, fill: "#f2c53d" }));
          g.appendChild(svgEl("path", { d: "M0.64 -1.1 L0.86 -1.04 L0.64 -0.98 Z", fill: "#e07a2e" }));
          ext = { w: 1.8, h: 1.4 };
          break;
        case "plane":
          g.appendChild(svgEl("ellipse", { cx: 0, cy: 0, rx: 1.2, ry: 0.2, fill: "#eef1f5", stroke: "#7d8794", "stroke-width": 0.04 }));
          g.appendChild(svgEl("path", { d: "M-0.2 0 L0.3 -0.05 L-0.35 0.6 L-0.6 0.6 Z", fill: "#c9d0d9" }));
          g.appendChild(svgEl("path", { d: "M-1.0 -0.1 L-1.25 -0.55 L-0.95 -0.55 L-0.7 -0.1 Z", fill: "#c9d0d9" }));
          ext = { w: 2.6, h: 1.3, cy: 0 };
          break;
      }
      return { g: g, parts: parts, ext: ext };
    }

    var S2 = 1.3; // 넓은 그림에서도 잘 보이도록 물체를 조금 크게(모형)
    function place(it, x, y, z, flip) {
      var q = P2(x, y, z);
      it.at = [x, y, z];
      it.g.setAttribute("transform", "translate(" + q[0].toFixed(3) + "," + q[1].toFixed(3) + ") scale(" + (flip ? -S2 : S2) + "," + S2 + ")");
      if (it.lbl) {
        // 이름표: 바닥에 선 물체는 발밑, 벽·하늘의 물체(창문·시계·갈매기·비행기)는 그 물체 바로 아래
        var below = it.ext.up ? -it.ext.h * S2 - 0.2 : it.ext.cy != null ? (it.ext.cy + it.ext.h / 2) * S2 + 0.5 : 0.55;
        it.lbl.setAttribute("x", q[0].toFixed(3));
        it.lbl.setAttribute("y", (q[1] + below).toFixed(3));
      }
    }
    function applyTime(sc) {
      var t = sceneTime[sc];
      Object.keys(items).forEach(function (id) {
        var it = items[id];
        if (id === "clock") {
          var an = clockAngles(t);
          it.parts.sec.setAttribute("transform", "rotate(" + an.sec.toFixed(2) + ")");
          it.parts.min.setAttribute("transform", "rotate(" + an.min.toFixed(3) + ")");
          it.parts.hour.setAttribute("transform", "rotate(" + an.hour.toFixed(4) + ")");
          return;
        }
        var m = MOVERS_2D[id] || MOVERS[id];
        if (!m) return;
        var s = m(t);
        place(it, s.x, s.y, s.z, s.dx < 0);
        if (it.parts.legL) swingLegs(it.parts, s.dist * (id === "runner" ? 2.4 : id === "dog" ? 4 : 2.8), id === "runner" ? 0.5 : 0.35);
        if (it.parts.wing) it.parts.wing.setAttribute("transform", "scale(1," + (0.6 + 0.4 * Math.cos(s.dist * 5)).toFixed(3) + ")");
      });
      drawRing();
    }
    function markOf(id) {
      var it = items[id];
      if (!it) return null;
      var q = P2(it.at[0], it.at[1], it.at[2]);
      var cy = (it.ext.cy != null ? it.ext.cy : -it.ext.h / 2) * S2;
      return { x: q[0], y: q[1] + cy, r: (Math.max(it.ext.w, it.ext.h) / 2) * S2 + 0.25 };
    }
    function drawRing() {
      if (!ring) return;
      var m = selObj ? markOf(selObj) : null;
      ring.style.display = m ? "" : "none";
      ringLabel.style.display = m ? "" : "none";
      if (!m) return;
      ring.setAttribute("cx", m.x.toFixed(3));
      ring.setAttribute("cy", m.y.toFixed(3));
      ring.setAttribute("r", m.r.toFixed(3));
      ringLabel.setAttribute("x", m.x.toFixed(3));
      var ly = m.y - m.r - 0.25;
      ringLabel.setAttribute("y", (ly < VB.y + 0.8 ? m.y + m.r + 0.75 : ly).toFixed(3));
      ringLabel.textContent = OBJ[selObj].name;
    }

    function build(sc) {
      wrap.textContent = "";
      items = {};
      var L = LAYOUT[sc];
      svg = svgEl("svg", { viewBox: VB.x + " " + VB.y + " " + VB.w + " " + VB.h, class: "scene2d", role: "group", "aria-label": SCENE[sc].name + " 장면(2D 모형)" });
      var bg = svgEl("g");
      var horizon = P2(0, 0, -8)[1];
      if (sc === "A") {
        bg.appendChild(svgEl("rect", { x: VB.x, y: VB.y, width: VB.w, height: horizon - VB.y + 0.1, fill: "#e8e2d6" }));
        bg.appendChild(svgEl("rect", { x: VB.x, y: horizon, width: VB.w, height: VB.y + VB.h - horizon, fill: "#d2b48a" }));
      } else {
        bg.appendChild(svgEl("rect", { x: VB.x, y: VB.y, width: VB.w, height: horizon - VB.y + 0.1, fill: "#d8ecfa" }));
        if (sc === "B") {
          var shore = P2(0, 0, -2)[1];
          bg.appendChild(svgEl("rect", { x: VB.x, y: horizon, width: VB.w, height: shore - horizon, fill: "#7fb6d9" }));
          bg.appendChild(svgEl("rect", { x: VB.x, y: shore, width: VB.w, height: VB.y + VB.h - shore, fill: "#ecdcaa" }));
        } else {
          bg.appendChild(svgEl("rect", { x: VB.x, y: horizon, width: VB.w, height: VB.y + VB.h - horizon, fill: "#a9d48f" }));
          var tr = L.track;
          var tc = P2(tr.cx, 0, tr.cz);
          bg.appendChild(svgEl("ellipse", { cx: tc[0], cy: tc[1], rx: tr.rx, ry: tr.rz * 0.62, fill: "none", stroke: "#dcc79a", "stroke-width": tr.w * 0.8 }));
          var pc = P2(L.pond.at[0], 0, L.pond.at[2]);
          bg.appendChild(svgEl("ellipse", { cx: pc[0], cy: pc[1], rx: L.pond.r, ry: L.pond.r * 0.62, fill: "#6fa8d6" }));
        }
      }
      svg.appendChild(bg);
      if (sc === "A") {
        // 책상(장식) — 고를 때는 모두 '책상'
        L.desks.forEach(function (d) {
          if (d[0] === L.desk.at[0] && d[2] === L.desk.at[2]) return;
          var q = P2(d[0], 0, d[2]);
          var dg = svgEl("g", { transform: "translate(" + q[0] + "," + q[1] + ") scale(" + S2 + ")", class: "pick2d" }, [desk2d()]);
          dg.addEventListener("click", function () {
            ctx.onPick({ scene: "A", obj: "desk" });
          });
          svg.appendChild(dg);
        });
      }
      // 물체들(뒤쪽부터)
      var list = SCENE[sc].objects.map(function (o) {
        var at;
        if (MOVERS[o.id]) {
          var s0 = (MOVERS_2D[o.id] || MOVERS[o.id])(sceneTime[sc]);
          at = [s0.x, s0.y, s0.z];
        } else at = L[o.id].at;
        return { o: o, at: at };
      });
      list.sort(function (a, b) {
        return a.at[2] - a.at[1] * 0.3 - (b.at[2] - b.at[1] * 0.3);
      });
      var labels = svgEl("g", { class: "lbls2d" });
      list.forEach(function (x) {
        var d = drawObj(sc, x.o.id);
        var it = { g: d.g, parts: d.parts, ext: d.ext, at: x.at };
        it.g.setAttribute("class", "pick2d");
        it.g.setAttribute("tabindex", "-1");
        it.g.addEventListener("click", function () {
          ctx.onPick({ scene: sc, obj: x.o.id });
        });
        // 이름표(모든 물체에 똑같이 — 움직이는 물체만 따로 표시하지 않는다)
        it.lbl = svgEl("text", { class: "lbl2d", "text-anchor": "middle", "font-size": "0.4" }, [document.createTextNode(x.o.name)]);
        labels.appendChild(it.lbl);
        place(it, x.at[0], x.at[1], x.at[2]);
        svg.appendChild(it.g);
        items[x.o.id] = it;
      });
      svg.appendChild(labels);
      ring = svgEl("circle", { class: "ring2d", fill: "none", stroke: "#e8590c", "stroke-width": 0.12, "stroke-dasharray": "0.35 0.22" });
      ringLabel = svgEl("text", { class: "ringlbl2d", "text-anchor": "middle", "font-size": "0.55" });
      svg.appendChild(ring);
      svg.appendChild(ringLabel);
      wrap.appendChild(svg);
      wrap.appendChild(el("p", { class: "p2-caption", text: SCENE[sc].name + " — " + SCENE[sc].source + "을 본뜬 그림(모형)" }));
      shown = sc;
      applyTime(sc);
    }
    function ensure(sc) {
      if (shown !== sc) build(sc);
    }
    function snap(sc) {
      var c = svg.cloneNode(true);
      c.removeAttribute("aria-label");
      var m = selObj ? markOf(selObj) : null;
      return { node: c, mark: m };
    }
    function zoomOf(shot, m0) {
      var c = shot.node.cloneNode(true);
      var w = Math.max(6, m0.r * 4.2);
      var h = w * 0.72;
      var x = clamp(m0.x - w / 2, VB.x, VB.x + VB.w - w);
      var y = clamp(m0.y - h / 2, VB.y, VB.y + VB.h - h);
      c.setAttribute("viewBox", x.toFixed(2) + " " + y.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2));
      return c;
    }
    return {
      highlight: function (s) {
        rememberSel(s);
        ensure(sceneFor(s));
        selObj = s.obj && OBJ[s.obj] && OBJ[s.obj].scene === shown ? s.obj : null;
        drawRing();
      },
      run: async function (sel) {
        ensure(sel.scene);
        selObj = sel.obj;
        drawRing();
        var sc = sel.scene;
        var s1 = snap(sc);
        shutterFlash(wrap);
        var t0 = sceneTime[sc];
        var stop = false;
        var start = performance.now();
        (function frame() {
          if (stop) return;
          var k = Math.min(1, (performance.now() - start) / (WAIT * 1000));
          sceneTime[sc] = t0 + WAIT * k;
          if (shown === sc) applyTime(sc);
          if (k < 1) requestAnimationFrame(frame);
        })();
        await S.Countdown.run(wrap, WAIT, { label: "초 뒤에 사진 2를 찍어요", note: "실제 시간 " + WAIT + "초 (초시계)" });
        stop = true;
        sceneTime[sc] = t0 + WAIT;
        saveTime();
        applyTime(sc);
        var s2 = snap(sc);
        shutterFlash(wrap);
        photos = { sel: { scene: sc, obj: sel.obj }, kind: "svg", p1: s1.node, p2: s2.node };
        if (s1.mark) {
          photos.z1 = zoomOf(s1, s1.mark);
          photos.z2 = zoomOf(s2, s1.mark);
        }
      },
      showInstant: function () {},
      clear: function () {
        Object.keys(sceneTime).forEach(function (k) {
          sceneTime[k] = 0;
        });
        saveTime();
        if (shown) applyTime(shown);
      },
      resetView: function () {},
      dispose: function () {
        wrap.textContent = "";
      },
    };
  }

  /* ───────── 3D 화면 ───────── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: FRAME,
      viewDir: [0, 0.62, 0.79],
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      return make3D(v, container);
    });
  }

  function make3D(v, container) {
    var T = v.THREE;
    var mat = v.make.material;
    var dark = false;
    var cur = null; // { id, group, objs: { id: { target, radius, update(t) } } }
    var selObj = null;

    // 선택 표시: 아래를 가리키는 화살표 + 이름표(장면을 바꿔도 남는다)
    var selGroup = new T.Group();
    var arrow = new T.Mesh(new T.ConeGeometry(0.28, 0.6, 16), new T.MeshBasicMaterial({ color: 0xe8590c }));
    arrow.rotation.x = Math.PI;
    selGroup.add(arrow);
    var selLabel = null;
    selGroup.visible = false;
    v.root.add(selGroup);

    function box(w, h, d, color, extra) {
      return new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, extra));
    }
    function cyl(r1, r2, h, color, seg, extra) {
      return new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 16), mat(color, extra));
    }
    function sphere(r, color, extra) {
      return new T.Mesh(new T.SphereGeometry(r, 16, 12), mat(color, extra));
    }
    function at(obj, x, y, z) {
      obj.position.set(x, y, z);
      return obj;
    }

    // 사람 모형(얼굴 없는 회색 계열). 원점 = 발 아래 바닥. 앞 = +z
    function person(o) {
      var g = new T.Group();
      var shirt = o.shirt || PERSON.shirts[0];
      var legs = [];
      var arms = [];
      var hipY = o.pose === "sit" ? 0.47 : o.pose === "ride" ? 0.95 : 0.86;
      if (o.pose === "sit" || o.pose === "ride") {
        [-0.12, 0.12].forEach(function (sx) {
          var thigh = box(0.17, 0.17, 0.46, PERSON.pants);
          thigh.position.set(sx, hipY, 0.2);
          var shin = box(0.15, o.pose === "ride" ? 0.55 : 0.47, 0.15, PERSON.pants);
          shin.position.set(sx, o.pose === "ride" ? hipY - 0.3 : 0.235, 0.42);
          g.add(thigh, shin);
        });
      } else {
        [-0.12, 0.12].forEach(function (sx) {
          var piv = new T.Group();
          piv.position.set(sx, hipY, 0);
          var leg = cyl(0.085, 0.075, hipY, PERSON.pants, 10);
          leg.position.y = -hipY / 2;
          piv.add(leg);
          g.add(piv);
          legs.push(piv);
        });
      }
      var torso = box(0.46, 0.62, 0.26, shirt);
      torso.position.y = hipY + 0.33;
      var head = sphere(0.165, PERSON.head);
      head.position.y = hipY + 0.82;
      g.add(torso, head);
      [-0.3, 0.3].forEach(function (sx) {
        var piv = new T.Group();
        piv.position.set(sx, hipY + 0.6, 0);
        var arm = cyl(0.065, 0.06, 0.58, shirt, 10);
        arm.position.y = -0.29;
        piv.add(arm);
        if (o.book || o.pose === "ride") piv.rotation.x = -1.05;
        g.add(piv);
        arms.push(piv);
      });
      if (o.book) {
        var book = box(0.42, 0.3, 0.05, 0xf4efe2);
        book.position.set(0, hipY + 0.42, 0.45);
        book.rotation.x = -0.5;
        var cover = box(0.44, 0.31, 0.02, 0x8a6a3b);
        cover.position.set(0, hipY + 0.41, 0.47);
        cover.rotation.x = -0.5;
        g.add(book, cover);
      }
      g.userData.legs = legs;
      g.userData.arms = arms;
      g.scale.setScalar(BIG);
      return g;
    }
    function walkPose(g, phase, amp) {
      var a = Math.sin(phase) * (amp || 0.45);
      var L = g.userData.legs;
      var A = g.userData.arms;
      if (L && L.length === 2) {
        L[0].rotation.x = a;
        L[1].rotation.x = -a;
      }
      if (A && A.length === 2 && !g.userData.fixedArms) {
        A[0].rotation.x = -a * 0.8;
        A[1].rotation.x = a * 0.8;
      }
    }
    // 넓은 장면에서도 잘 보이도록 사람·작은 물체를 조금 크게 만든다(모형)
    var BIG = 1.3;
    function desk() {
      var g = new T.Group();
      g.scale.setScalar(BIG);
      g.add(at(box(1.3, 0.07, 0.75, 0xc79a62), 0, 0.74, 0));
      [[-0.58, -0.3], [0.58, -0.3], [-0.58, 0.3], [0.58, 0.3]].forEach(function (p) {
        g.add(at(cyl(0.035, 0.035, 0.72, 0x6b7280, 8), p[0], 0.36, p[1]));
      });
      return g;
    }
    function chair(color) {
      var g = new T.Group();
      g.scale.setScalar(BIG);
      g.add(at(box(0.5, 0.06, 0.48, color || 0x8d96a3), 0, 0.45, 0));
      g.add(at(box(0.5, 0.5, 0.05, color || 0x8d96a3), 0, 0.72, -0.24));
      [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(function (p) {
        g.add(at(cyl(0.025, 0.025, 0.45, 0x5b6474, 6), p[0], 0.225, p[1]));
      });
      return g;
    }
    function bench() {
      var g = new T.Group();
      g.scale.setScalar(1.15);
      g.add(at(box(2.4, 0.08, 0.5, 0xa0703f), 0, 0.46, 0));
      g.add(at(box(2.4, 0.4, 0.06, 0xa0703f), 0, 0.8, -0.24));
      [-1, 1].forEach(function (x) {
        g.add(at(box(0.08, 0.46, 0.45, 0x5c4a38), x, 0.23, 0));
      });
      return g;
    }
    function tree(scale) {
      var s = scale || 1;
      var g = new T.Group();
      g.add(at(cyl(0.2 * s, 0.28 * s, 2 * s, 0x8a6343, 10), 0, s, 0));
      g.add(at(sphere(1.25 * s, 0x5f9e53), 0, 2.7 * s, 0));
      g.add(at(sphere(0.85 * s, 0x6aab5d), -0.6 * s, 2.2 * s, 0.4 * s));
      return g;
    }
    function tripod() {
      // 공통 소품: 삼각대 + 스마트 기기(촬영 중임을 알리는 장식)
      var g = new T.Group();
      [0, 2.1, 4.2].forEach(function (a) {
        var leg = cyl(0.03, 0.03, 1.3, 0x2f3640, 6);
        leg.position.set(Math.sin(a) * 0.25, 0.62, Math.cos(a) * 0.25);
        leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
        g.add(leg);
      });
      g.add(at(box(0.5, 0.3, 0.05, 0x1f2733), 0, 1.4, 0));
      g.add(at(cyl(0.05, 0.05, 0.03, 0x6ea0ff, 12), 0.15, 1.45, -0.04));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      return g;
    }

    var SCENE3D = {
      A: function (G, objs) {
        var L = LAYOUT.A;
        G.add(at(box(34, 0.2, 22, 0xd2b48a, { roughness: 0.9 }), 0, -0.1, 3.3));
        G.add(at(box(34, 6.2, 0.3, 0xe8e2d6), 0, 3.1, -7.75));
        // 창문(뒤 벽)
        var win = new T.Group();
        win.add(at(box(3.4, 2.4, 0.08, 0xe9eef3), 0, 3.1, 0));
        win.add(at(box(3.1, 2.1, 0.06, 0xcfe8f7, { roughness: 0.2 }), 0, 3.1, 0.05));
        win.add(at(box(0.08, 2.1, 0.08, 0xe9eef3), 0, 3.1, 0.08));
        at(win, L.window.at[0], 0, L.window.at[2]);
        G.add(win);
        objs.window = { target: win, radius: 1.8 };
        // 책상들(모두 '책상'으로 고른다). 표시는 L.desk 자리의 책상에
        var deskMain = null;
        var deskAll = new T.Group();
        L.desks.concat([L.desk.at]).forEach(function (d) {
          var dk = at(desk(), d[0], 0, d[2]);
          deskAll.add(dk);
          if (d === L.desk.at) deskMain = dk;
        });
        G.add(deskAll);
        objs.desk = { target: deskMain, pickRoot: deskAll, radius: 0.9 };
        // 화분
        var plant = new T.Group();
        plant.add(at(cyl(0.35, 0.27, 0.6, 0xb5653a), 0, 0.3, 0));
        plant.add(at(sphere(0.5, 0x4f9a4a), 0, 1.0, 0));
        plant.add(at(sphere(0.32, 0x5aa653), -0.3, 0.8, 0.15));
        at(plant, L.plant.at[0], 0, L.plant.at[2]);
        plant.scale.setScalar(BIG);
        G.add(plant);
        objs.plant = { target: plant, radius: 0.7 };
        // 창밖을 보는 친구(창 쪽을 봄 → 등이 보임)
        var f1 = person({ pose: "stand", shirt: shirtOf("friend1") });
        at(f1, L.friend1.at[0], 0, L.friend1.at[2]);
        f1.rotation.y = Math.PI;
        G.add(f1);
        objs.friend1 = { target: f1, radius: 0.9 };
        // 책 읽는 친구(의자에 앉아 책을 봄)
        var f2 = new T.Group();
        f2.add(chair());
        f2.add(person({ pose: "sit", shirt: shirtOf("friend2"), book: true }));
        at(f2, L.friend2.at[0], 0, L.friend2.at[2]);
        // 앞(+z)의 책상을 보고 앉음
        G.add(f2);
        objs.friend2 = { target: f2, radius: 0.9 };
        // 걸어가는 친구
        var wk = person({ pose: "stand", shirt: shirtOf("walker") });
        G.add(wk);
        objs.walker = {
          target: wk,
          radius: 0.9,
          update: function (t) {
            var s = MOVERS.walker(t);
            wk.position.set(s.x, 0, s.z);
            wk.rotation.y = s.yaw;
            walkPose(wk, s.dist * 2.8, 0.45);
          },
        };
        // 벽시계(초침·분침·시침)
        var clk = new T.Group();
        var face = cyl(1.25, 1.25, 0.08, 0xffffff, 40);
        face.rotation.x = Math.PI / 2;
        clk.add(face);
        var rim = new T.Mesh(new T.TorusGeometry(1.27, 0.08, 10, 48), mat(0x4a5361));
        clk.add(rim);
        for (var k = 0; k < 12; k++) {
          var a = (k / 12) * Math.PI * 2;
          var tick = box(k % 3 ? 0.04 : 0.08, 0.16, 0.02, 0x4a5361);
          tick.position.set(Math.sin(a) * 1.06, Math.cos(a) * 1.06, 0.06);
          tick.rotation.z = -a;
          clk.add(tick);
        }
        function hand(len, w, color, back, z) {
          var piv = new T.Group();
          var m = box(w, len + back, 0.02, color);
          m.position.y = (len - back) / 2;
          piv.add(m);
          piv.position.z = z;
          clk.add(piv);
          return piv;
        }
        var hHour = hand(0.55, 0.1, 0x1f2733, 0, 0.07);
        var hMin = hand(0.88, 0.06, 0x1f2733, 0, 0.09);
        var hSec = hand(1.05, 0.03, 0xc0392b, 0.22, 0.11);
        clk.add(at(cyl(0.07, 0.07, 0.05, 0x1f2733, 12), 0, 0, 0.13));
        clk.children[clk.children.length - 1].rotation.x = Math.PI / 2;
        at(clk, L.clock.at[0], L.clock.at[1], L.clock.at[2]);
        G.add(clk);
        objs.clock = {
          target: clk,
          radius: 1.4,
          update: function (t) {
            var an = clockAngles(t);
            hSec.rotation.z = (-an.sec * Math.PI) / 180; // 앞에서 볼 때 시계 방향
            hMin.rotation.z = (-an.min * Math.PI) / 180;
            hHour.rotation.z = (-an.hour * Math.PI) / 180;
          },
        };
      },
      B: function (G, objs) {
        var L = LAYOUT.B;
        G.add(at(box(34, 0.2, 16, 0xecdcaa, { roughness: 0.95 }), 0, -0.1, 6));
        G.add(at(box(34, 0.1, 9, 0x7fb6d9, { roughness: 0.3 }), 0, -0.12, -6.5));
        // 등대
        var lh = new T.Group();
        lh.add(at(cyl(0.45, 0.7, 4.6, 0xf5f5f0, 20), 0, 2.3, 0));
        lh.add(at(cyl(0.6, 0.65, 0.8, 0xc94b43, 20), 0, 1.7, 0));
        lh.add(at(cyl(0.5, 0.55, 0.7, 0xc94b43, 20), 0, 3.35, 0));
        lh.add(at(cyl(0.42, 0.42, 0.6, 0xf3e5a4, 16, { emissive: 0x6b5a10 }), 0, 4.9, 0));
        lh.add(at(new T.Mesh(new T.ConeGeometry(0.62, 0.6, 16), mat(0x4a5361)), 0, 5.5, 0));
        at(lh, L.lighthouse.at[0], 0, L.lighthouse.at[2]);
        G.add(lh);
        objs.lighthouse = { target: lh, radius: 1.3 };
        // 의자(긴 의자)와 앉아 있는 사람
        var bn = at(bench(), L.bench.at[0], 0, L.bench.at[2]);
        G.add(bn);
        objs.bench = { target: bn, radius: 1.3 };
        var st = person({ pose: "sit", shirt: shirtOf("seated") });
        at(st, L.seated.at[0], 0, L.seated.at[2] - 0.12);
        G.add(st);
        objs.seated = { target: st, radius: 0.8 };
        // 휠체어 탄 사람
        var wc = new T.Group();
        wc.add(at(box(0.55, 0.06, 0.5, 0x3b4250), 0, 0.45, 0));
        wc.add(at(box(0.55, 0.55, 0.05, 0x3b4250), 0, 0.75, -0.25));
        [-0.34, 0.34].forEach(function (x) {
          var wh = new T.Mesh(new T.TorusGeometry(0.32, 0.035, 8, 24), mat(0x2f3640));
          wh.position.set(x, 0.34, -0.05);
          wh.rotation.y = Math.PI / 2;
          wc.add(wh);
          wc.add(at(sphere(0.07, 0x2f3640), x * 0.7, 0.07, 0.35));
        });
        var wcp = person({ pose: "sit", shirt: shirtOf("wheelchair") });
        wcp.scale.setScalar(1);
        wc.add(wcp);
        at(wc, L.wheelchair.at[0], 0, L.wheelchair.at[2]);
        wc.scale.setScalar(BIG);
        wc.rotation.y = -0.5;
        G.add(wc);
        objs.wheelchair = { target: wc, radius: 0.9 };
        // 바위
        var rk = new T.Mesh(new T.DodecahedronGeometry(0.9, 0), mat(0x8a8f96, { roughness: 0.95, flatShading: true }));
        rk.scale.set(1.3, 0.75, 1);
        at(rk, L.rock.at[0], 0.45, L.rock.at[2]);
        G.add(rk);
        objs.rock = { target: rk, radius: 1.2 };
        // 풀
        var gr = new T.Group();
        for (var i = 0; i < 7; i++) {
          var bl = new T.Mesh(new T.ConeGeometry(0.1, 0.6 + (i % 3) * 0.2, 6), mat(0x4f9a4a));
          bl.position.set(Math.cos(i * 2.4) * 0.35, 0.3 + (i % 3) * 0.1, Math.sin(i * 2.4) * 0.3);
          gr.add(bl);
        }
        at(gr, L.grass.at[0], 0, L.grass.at[2]);
        G.add(gr);
        objs.grass = { target: gr, radius: 0.7 };
        // 나무
        var tr = at(tree(1), L.tree.at[0], 0, L.tree.at[2]);
        G.add(tr);
        objs.tree = { target: tr, radius: 1.6 };
        // 갈매기
        var gull = new T.Group();
        var gb = sphere(0.28, 0xf7f7f7);
        gb.scale.set(0.8, 0.7, 1.5);
        gull.add(gb);
        gull.add(at(new T.Mesh(new T.ConeGeometry(0.06, 0.2, 6), mat(0xe0a030)), 0, 0, 0.5));
        gull.children[1].rotation.x = Math.PI / 2;
        var wings = [];
        [-1, 1].forEach(function (sx) {
          var piv = new T.Group();
          var w = box(0.8, 0.03, 0.3, 0xe9ecef);
          w.position.x = sx * 0.4;
          piv.add(w);
          gull.add(piv);
          wings.push({ piv: piv, sx: sx });
        });
        G.add(gull);
        gull.scale.setScalar(1.6);
        objs.gull = {
          target: gull,
          radius: 0.7,
          update: function (t) {
            var s = MOVERS.gull(t);
            gull.position.set(s.x, s.y, s.z);
            gull.rotation.y = s.yaw;
            var f = Math.sin(s.dist * 5) * 0.5;
            wings.forEach(function (w) {
              w.piv.rotation.z = w.sx * f;
            });
          },
        };
        // 배
        var boat = new T.Group();
        var hull = box(0.9, 0.45, 2.4, 0xb85c38);
        hull.position.y = 0.15;
        boat.add(hull);
        boat.add(at(cyl(0.05, 0.05, 2.1, 0x6b4a2b, 8), 0, 1.3, 0.1));
        var sail = new T.Mesh(new T.BufferGeometry(), mat(0xf5f5f0, { side: T.DoubleSide }));
        sail.geometry.setAttribute("position", new T.Float32BufferAttribute([0, 0.45, 0.15, 0, 2.3, 0.15, 0, 0.45, 1.1], 3));
        sail.geometry.computeVertexNormals();
        boat.add(sail);
        G.add(boat);
        boat.scale.setScalar(BIG);
        objs.boat = {
          target: boat,
          radius: 1.4,
          update: function (t) {
            var s = MOVERS.boat(t);
            boat.position.set(s.x, 0, s.z);
            boat.rotation.y = s.yaw;
          },
        };
        // 산책하는 사람과 개
        var sw = person({ pose: "stand", shirt: shirtOf("stroller") });
        G.add(sw);
        objs.stroller = {
          target: sw,
          radius: 0.9,
          update: function (t) {
            var s = MOVERS.stroller(t);
            sw.position.set(s.x, 0, s.z);
            sw.rotation.y = s.yaw;
            walkPose(sw, s.dist * 2.8, 0.4);
          },
        };
        var dog = new T.Group();
        dog.add(at(box(0.3, 0.3, 0.75, 0xa8743f), 0, 0.45, 0));
        dog.add(at(box(0.26, 0.26, 0.3, 0xa8743f), 0, 0.68, 0.45));
        var dlegs = [];
        [[-0.1, 0.25], [0.1, 0.25], [-0.1, -0.25], [0.1, -0.25]].forEach(function (p, i) {
          var piv = new T.Group();
          piv.position.set(p[0], 0.32, p[1]);
          var lg = box(0.08, 0.32, 0.08, 0x7d5530);
          lg.position.y = -0.16;
          piv.add(lg);
          dog.add(piv);
          dlegs.push({ piv: piv, s: i % 2 ? 1 : -1 });
        });
        var tail = box(0.05, 0.05, 0.3, 0xa8743f);
        tail.position.set(0, 0.62, -0.48);
        tail.rotation.x = 0.7;
        dog.add(tail);
        G.add(dog);
        dog.scale.setScalar(BIG);
        objs.dog = {
          target: dog,
          radius: 0.6,
          update: function (t) {
            var s = MOVERS.dog(t);
            dog.position.set(s.x, 0, s.z);
            dog.rotation.y = s.yaw;
            var a = Math.sin(s.dist * 4) * 0.5;
            dlegs.forEach(function (d) {
              d.piv.rotation.x = a * d.s;
            });
          },
        };
      },
      C: function (G, objs) {
        var L = LAYOUT.C;
        G.add(at(box(34, 0.2, 26, 0xa9d48f, { roughness: 0.95 }), 0, -0.1, 2));
        // 산책로(타원 고리)와 연못
        var tr = L.track;
        var shape = new T.Shape();
        shape.absellipse(0, 0, tr.rx + tr.w / 2, tr.rz + tr.w / 2, 0, Math.PI * 2, false);
        var hole = new T.Path();
        hole.absellipse(0, 0, tr.rx - tr.w / 2, tr.rz - tr.w / 2, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        var track = new T.Mesh(new T.ShapeGeometry(shape, 48), mat(0xdcc79a, { roughness: 0.95 }));
        track.rotation.x = -Math.PI / 2;
        track.position.set(tr.cx, 0.01, tr.cz);
        G.add(track);
        var pond = cyl(L.pond.r, L.pond.r, 0.06, 0x6fa8d6, 40, { roughness: 0.25 });
        at(pond, L.pond.at[0], 0.02, L.pond.at[2]);
        G.add(pond);
        // 운동 기구(철봉 모양 틀)
        var gym = new T.Group();
        [-1.2, 1.2].forEach(function (x) {
          gym.add(at(cyl(0.07, 0.07, 2.3, 0x4f6d8a, 10), x, 1.15, 0));
        });
        var bar = cyl(0.05, 0.05, 2.5, 0x4f6d8a, 10);
        bar.rotation.z = Math.PI / 2;
        gym.add(at(bar, 0, 2.2, 0));
        var bar2 = cyl(0.04, 0.04, 2.4, 0x6b8aa8, 10);
        bar2.rotation.z = Math.PI / 2;
        gym.add(at(bar2, 0, 1.3, 0));
        at(gym, L.gym.at[0], 0, L.gym.at[2]);
        G.add(gym);
        objs.gym = { target: gym, radius: 1.5 };
        // 의자 + 책 읽는 사람(의자에 앉아 앞(+z)을 봄)
        var bn = at(bench(), L.bench2.at[0], 0, L.bench2.at[2]);
        G.add(bn);
        objs.bench2 = { target: bn, radius: 1.3 };
        var rd = person({ pose: "sit", shirt: shirtOf("reader"), book: true });
        at(rd, L.reader.at[0] + 0.3, 0, L.reader.at[2] - 0.12);
        G.add(rd);
        objs.reader = { target: rd, radius: 0.8 };
        // 나무
        var tw = at(tree(1.1), L.tree2.at[0], 0, L.tree2.at[2]);
        G.add(tw);
        objs.tree2 = { target: tw, radius: 1.7 };
        // 자전거 타는 사람
        var bk = new T.Group();
        var wheels = [];
        [-0.55, 0.55].forEach(function (z) {
          var wh = new T.Mesh(new T.TorusGeometry(0.33, 0.04, 8, 24), mat(0x2f3640));
          wh.position.set(0, 0.34, z);
          wh.rotation.y = Math.PI / 2;
          bk.add(wh);
          wheels.push(wh);
        });
        var fr = box(0.05, 0.05, 1.0, 0x3b7dd8);
        fr.position.set(0, 0.6, 0);
        fr.rotation.x = 0.35;
        bk.add(fr);
        bk.add(at(box(0.05, 0.5, 0.05, 0x3b7dd8), 0, 0.7, 0.45));
        bk.add(at(box(0.5, 0.04, 0.04, 0x2f3640), 0, 0.95, 0.45));
        var rider = person({ pose: "ride", shirt: shirtOf("biker") });
        rider.scale.setScalar(1);
        rider.position.set(0, 0, -0.25);
        bk.add(rider);
        G.add(bk);
        bk.scale.setScalar(BIG);
        objs.biker = {
          target: bk,
          radius: 1.0,
          update: function (t) {
            var s = MOVERS.biker(t);
            bk.position.set(s.x, 0, s.z);
            bk.rotation.y = s.yaw;
            wheels.forEach(function (w) {
              w.rotation.x = s.dist / 0.33;
            });
          },
        };
        // 오리 배
        var db = new T.Group();
        var dbody = sphere(0.6, 0xf2c53d);
        dbody.scale.set(0.9, 0.5, 1.4);
        dbody.position.y = 0.2;
        db.add(dbody);
        db.add(at(cyl(0.12, 0.14, 0.6, 0xf2c53d, 10), 0, 0.65, 0.6));
        db.add(at(sphere(0.22, 0xf2c53d), 0, 1.0, 0.65));
        var beak = new T.Mesh(new T.ConeGeometry(0.08, 0.25, 8), mat(0xe07a2e));
        beak.rotation.x = Math.PI / 2;
        db.add(at(beak, 0, 0.98, 0.9));
        G.add(db);
        db.scale.setScalar(BIG);
        objs.duckboat = {
          target: db,
          radius: 0.9,
          update: function (t) {
            var s = MOVERS.duckboat(t);
            db.position.set(s.x, 0.05, s.z);
            db.rotation.y = s.yaw;
          },
        };
        // 비행기(하늘)
        var pl = new T.Group();
        var fus = cyl(0.22, 0.16, 2.4, 0xeef1f5, 12);
        fus.rotation.x = Math.PI / 2;
        pl.add(fus);
        pl.add(at(box(2.6, 0.05, 0.5, 0xc9d0d9), 0, 0, 0.1));
        pl.add(at(box(0.9, 0.04, 0.3, 0xc9d0d9), 0, 0.05, -1.05));
        pl.add(at(box(0.04, 0.5, 0.35, 0xc9d0d9), 0, 0.28, -1.05));
        G.add(pl);
        objs.plane = {
          target: pl,
          radius: 1.4,
          update: function (t) {
            var s = MOVERS.plane(t);
            pl.position.set(s.x, s.y, s.z);
            pl.rotation.y = s.yaw;
          },
        };
        // 달리는 사람
        var rn = person({ pose: "stand", shirt: shirtOf("runner") });
        G.add(rn);
        objs.runner = {
          target: rn,
          radius: 0.9,
          update: function (t) {
            var s = MOVERS.runner(t);
            rn.position.set(s.x, 0, s.z);
            rn.rotation.y = s.yaw;
            walkPose(rn, s.dist * 2.4, 0.7);
          },
        };
      },
    };

    function applyBg() {
      if (!cur) return;
      var c = cur.id === "A" ? (dark ? 0x1b2230 : 0xeef3f8) : dark ? 0x1d2a3a : 0xcfe6f7;
      v.scene.background = new T.Color(c);
    }
    v.onThemeChange(function (d) {
      dark = d;
      applyBg();
    });

    function applyTime() {
      if (!cur) return;
      var t = sceneTime[cur.id];
      Object.keys(cur.objs).forEach(function (id) {
        if (cur.objs[id].update) cur.objs[id].update(t);
      });
      placeSel();
    }
    function centerOf(ent) {
      var b = new T.Box3().setFromObject(ent.target);
      var c = b.getCenter(new T.Vector3());
      return c;
    }
    function placeSel() {
      if (!cur || !selObj || !cur.objs[selObj]) {
        selGroup.visible = false;
        return;
      }
      var ent = cur.objs[selObj];
      var b = new T.Box3().setFromObject(ent.target);
      var c = b.getCenter(new T.Vector3());
      arrow.position.set(c.x, b.max.y + 0.55, c.z);
      if (selLabel) selLabel.position.set(c.x, b.max.y + 1.35, c.z);
      selGroup.visible = true;
    }
    function setSel(id) {
      if (selObj === id && (id == null || selLabel)) {
        placeSel();
        return;
      }
      selObj = id;
      if (selLabel) {
        v.discard(selLabel);
        selLabel = null;
      }
      if (id) {
        selLabel = v.make.label(OBJ[id].name, { height: 0.62, border: "#e8590c", depthTest: false });
        selGroup.add(selLabel);
      }
      placeSel();
    }
    function showScene(id) {
      if (cur && cur.id === id) return;
      if (cur) v.discard(cur.group);
      var G = new T.Group();
      var objs = {};
      SCENE3D[id](G, objs);
      var tp = tripod();
      tp.position.set(-9.9, 0, 6.2);
      tp.rotation.y = 0.35;
      G.add(tp);
      Object.keys(objs).forEach(function (oid) {
        v.pickable(objs[oid].pickRoot || objs[oid].target, { scene: id, obj: oid });
      });
      v.root.add(G);
      cur = { id: id, group: G, objs: objs };
      selObj = null;
      if (selLabel) {
        v.discard(selLabel);
        selLabel = null;
      }
      applyBg();
      applyTime();
    }

    // 사진: 고른 물체 자리에 점선 원. 반지름은 물체 크기를 그 시점에서 본 크기로
    function markFor(ent, pose) {
      var c = centerOf(ent);
      var fwd = new T.Vector3().fromArray(pose.target).sub(new T.Vector3().fromArray(pose.position)).normalize();
      var right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
      var a = v.project(c.toArray(), pose);
      var b = v.project(c.clone().addScaledVector(right, ent.radius).toArray(), pose);
      var r = clamp(Math.abs(b.x - a.x) * 1.2, 0.03, 0.2);
      return { at: c.toArray(), radius: r, label: OBJ[selObj].name };
    }
    // 사진 안에 넉넉히(이름표 자리까지) 들어오는지
    function framedAt(ent, pose) {
      var p = v.project(centerOf(ent).toArray(), pose);
      return p.inView && p.x >= 0.06 && p.x <= 0.94 && p.y >= 0.14 && p.y <= 0.94;
    }
    // 지금부터 몇 초(정수) 뒤에 찍으면 사진 1·사진 2(5초 뒤)에 모두 들어오는지. 지금 바로 되면 0, 못 찾으면 0(그대로 찍는다)
    function secondsUntilFramed(ent, sc, pose) {
      var t0 = sceneTime[sc];
      var found = 0;
      for (var k = 0; k <= 20; k++) {
        sceneTime[sc] = t0 + k;
        applyTime();
        var ok1 = framedAt(ent, pose);
        sceneTime[sc] = t0 + k + WAIT;
        applyTime();
        if (ok1 && framedAt(ent, pose)) {
          found = k;
          break;
        }
      }
      sceneTime[sc] = t0;
      applyTime();
      return found;
    }
    function shoot(ent, pose) {
      return v.snapshot({ pose: pose, width: 560, marks: [markFor(ent, pose)], hide: [selGroup] });
    }

    showScene(firstOpenScene());
    v.render();

    return {
      whenVisible: v.whenVisible,
      highlight: function (s) {
        rememberSel(s);
        showScene(sceneFor(s));
        setSel(s.obj && OBJ[s.obj] && OBJ[s.obj].scene === cur.id ? s.obj : null);
        v.render();
      },
      run: async function (sel) {
        showScene(sel.scene);
        setSel(sel.obj);
        var sc = sel.scene;
        var ent = cur.objs[sel.obj];
        // 고른 물체가 화면 밖이면 처음 방향으로 돌아와서 찍는다
        if (!v.project(centerOf(ent).toArray()).inView) await v.flyHome(500);
        var pose = v.cameraPose();
        // 움직이는 물체가 지금 화면 밖이면(예: 좁은 화면에서 먼 하늘의 비행기) 사진 1·2에 모두 들어오는 때까지
        // 실제 시간으로 기다렸다가 찍는다(빨리 감기 없음). 기다리는 동안 장면 시간도 같이 흐른다.
        if (MOVERS[sel.obj]) {
          var need = secondsUntilFramed(ent, sc, pose);
          if (need > 0) {
            var tw = sceneTime[sc];
            var cdw = S.Countdown.run(container, need, { label: "초 뒤에 사진 1을 찍어요", note: "고른 물체가 화면 안에 들어올 때까지 기다려요 (실제 시간)" });
            v.tween(need * 1000, function (e, lin) {
              if (!cur || cur.id !== sc) return;
              sceneTime[sc] = tw + need * lin;
              applyTime();
            });
            await cdw;
            sceneTime[sc] = tw + need;
            saveTime();
            applyTime();
          }
        }
        var p1 = shoot(ent, pose);
        shutterFlash(container);
        var t0 = sceneTime[sc];
        var cd = S.Countdown.run(container, WAIT, { label: "초 뒤에 사진 2를 찍어요", note: "실제 시간 " + WAIT + "초 (초시계)" });
        v.tween(WAIT * 1000, function (e, lin) {
          if (!cur || cur.id !== sc) return;
          sceneTime[sc] = t0 + WAIT * lin;
          applyTime();
        });
        await cd; // 벽시계 기준 실제 5초
        sceneTime[sc] = t0 + WAIT;
        saveTime();
        applyTime();
        var p2 = v.isDisposed() ? null : shoot(ent, pose);
        shutterFlash(container);
        photos = {
          sel: { scene: sc, obj: sel.obj },
          kind: "img",
          p1: p1 && p1.url,
          p2: p2 && p2.url,
          in1: !!(p1 && p1.marks[0] && p1.marks[0].inView),
          in2: !!(p2 && p2.marks[0] && p2.marks[0].inView),
        };
        if (p1 && p2 && p1.marks[0] && p1.marks[0].inView) {
          var m = p1.marks[0];
          var cw = clamp(m.r * 2 * 2.4, p1.width * 0.28, p1.width * 0.6);
          var ch = cw * 0.72;
          var x = clamp(m.x - cw / 2, 0, p1.width - cw);
          var y = clamp(m.y - ch / 2, 0, p1.height - ch);
          if (ch <= p1.height) {
            photos.z1 = cropCanvas(p1.canvas, x, y, cw, ch);
            photos.z2 = cropCanvas(p2.canvas, x, y, cw, ch);
          }
        }
        v.render();
      },
      showInstant: function () {},
      clear: function () {
        Object.keys(sceneTime).forEach(function (k) {
          sceneTime[k] = 0;
        });
        saveTime();
        applyTime();
        v.render();
      },
      resetView: v.resetView,
      dispose: function () {
        v.dispose();
      },
    };
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  var nav; // 아래에서 만든다(표의 '다시 살펴보기' 버튼이 쓴다)
  function drawResults() {
    var T = S.TableChart;
    var flagged = 0;
    // 실험관찰 23쪽처럼: 장면마다 같은 위치 / 다른 위치에 있는 물체
    T.renderMatrix($("summary-table"), {
      caption: "5초 간격으로 찍은 두 사진 비교 결과 (내 기록)",
      rowHeader: "장면",
      rows: C.scenes.map(function (sc) {
        return { id: sc.id, label: sc.name };
      }),
      cols: [
        { id: SAME, label: "⏸ 같은 위치에 있는 물체" },
        { id: DIFF, label: "🏃 다른 위치에 있는 물체" },
      ],
      emptyText: "없음",
      cell: function (r, c) {
        var names = SCENE[r.id].objects
          .filter(function (o) {
            var rec = records.get(keyOf(r.id, o.id));
            return rec && rec.result === c.id;
          })
          .map(function (o) {
            return o.name;
          });
        return names.length ? { text: names.join(", "), icon: C.resultIcon[c.id] } : null;
      },
    });
    var holder = $("scene-tables");
    holder.textContent = "";
    C.scenes.forEach(function (sc) {
      var box = el("div", { class: "scene-table" });
      holder.appendChild(box);
      T.renderMatrix(box, {
        caption: sc.name + " (" + sc.source + ")",
        rowHeader: "물체",
        rows: sc.objects.map(function (o) {
          return { id: o.id, label: o.name };
        }),
        cols: [{ id: "r", label: "내가 고른 결과" }],
        emptyText: "아직 기록 없음",
        cell: function (r) {
          var rec = records.get(keyOf(sc.id, r.id));
          if (!rec) return null;
          var wrong = rec.result !== expected(r.id);
          if (wrong) flagged++;
          return {
            text: rec.result,
            icon: C.resultIcon[rec.result],
            flag: wrong ? "다시 살펴볼까요?" : null,
            onFlag: function () {
              nav.go("experiment");
              exp.select({ scene: sc.id, obj: r.id });
            },
          };
        },
      });
    });
    var note = $("recheck-note");
    note.hidden = flagged === 0;
    note.textContent = flagged
      ? "🔎 다시 살펴보면 좋은 물체가 " + flagged + "개 있어요. 아래 '장면별로 자세히 보기'에서 🔁 버튼을 누르면 그 물체의 사진을 다시 찍어 볼 수 있어요."
      : "";
    if (flagged) $("detail-box").open = true;
  }

  /* ───────── 5. 마치기(결과 저장) ───────── */
  function buildDetail() {
    var q = quiz.result();
    var analysis = {};
    QUIZ.forEach(function (qq) {
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
      records: records.list().map(function (r) {
        return { scene: r.scene, object: r.object, result: r.result, recordedAt: r.recordedAt };
      }),
      analysis: analysis,
      conclusion: cv.conclusion,
      extension: { q1: cv.ext1, q2: cv.ext2 },
      curiosity: curiosity.value(),
      safetyChecked: safetyState.length,
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
      var correct = QUIZ.filter(function (qq) {
        return q[qq.id].correct;
      }).length;
      return ["관찰한 물체: " + records.count() + "개", "분석 질문: " + correct + "/" + QUIZ.length + " 맞힘"];
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
        return predict.isDone() || "예상하기의 두 질문에 내 생각을 " + C.predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "교실 안·바닷가·공원의 물체를 모두 관찰해 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "개)";
      },
      conclude: function () {
        return quiz.isDone() || "분석 질문 " + QUIZ.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "결론과 발전 질문 2개를 모두 제출해 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: quiz.isDone,
      conclude: conclude.isDone,
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: activateExperiment,
      analyze: drawResults,
    },
  });
  drawOverview();
})();
