/*
 * app.js — sci-6-2-2-1 "서로 다른 물질을 섞으면 어떻게 될까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(식초가 든 삼각 플라스크 2개 + 가루가 든 고무풍선)  ② 관찰 카드  ③ 분석 표·완료 저장  만 만든다.
 * 관찰 결과는 모두 LessonConfig.results(실험관찰 23쪽 교사용 예시)에서만 가져온다.
 *
 * 실행 방식(spec 열린 질문 2 추천안):
 *  - 그 가루를 아직 섞지 않았으면 "섞기"(고무풍선 세우기 → 가루가 식초로 → 결과 연출, 약 3~4초)
 *  - 이미 섞은 가루에서 살펴볼 것만 바꾸면 "살펴보기"(애니메이션 없이 카메라만 이동)
 *  - 같은 칸을 다시 실행하거나 관찰 보기를 틀렸을 때는 "다시 섞기"(처음 상태로 돌려 다시 재생)
 *  어느 쪽인지는 공통 틀이 저장하는 실험 화면 상태(store "scene")로 정한다.
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
  var POW = {};
  C.powders.forEach(function (p, i) {
    POW[p.id] = Object.assign({ index: i }, p);
  });
  var TGT = {};
  C.targets.forEach(function (t, i) {
    TGT[t.id] = Object.assign({ index: i }, t);
  });
  function keyOf(powderId, targetId) {
    return powderId + "|" + targetId;
  }
  function expected(powderId, targetId) {
    var r = C.results[powderId];
    return r ? r[targetId] || null : null;
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, document.hidden ? 0 : ms);
    });
  }
  var josaObj = function (n) {
    return S.josa(n, "을", "를");
  };

  /* 실행 방식: "mix"(처음 섞기) | "look"(이미 섞음 → 살펴보기만) | "remix"(같은 칸 다시 섞기) */
  function runMode(sel) {
    var sc = store.get("scene", {}) || {};
    if (sc[keyOf(sel.powder, sel.target)]) return "remix";
    var mixed = C.targets.some(function (t) {
      return !!sc[keyOf(sel.powder, t.id)];
    });
    return mixed ? "look" : "mix";
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.powder, r.target);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);

  /* 궁금한 점: 선택 입력 한 줄(비워도 마칠 수 있음). 저장 키 "curiosity" */
  var curiosityText = store.get("curiosity", "") || "";
  (function renderCuriosity() {
    var save = S.debounce(function () {
      store.set("curiosity", curiosityText);
    }, 250);
    var inp = el("input", { id: "ss-curiosity", type: "text", class: "ss-num-input ss-text-input", maxlength: "200", autocomplete: "off", placeholder: C.curiosity.placeholder });
    inp.value = curiosityText;
    inp.addEventListener("input", function () {
      curiosityText = inp.value;
      save();
    });
    $("curiosity-root").appendChild(
      el("div", { class: "ss-card curiosity-card" }, [el("label", { for: "ss-curiosity", class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "선택" }), C.curiosity.prompt]), inp])
    );
  })();

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div", { class: "intro-body" });
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    box.appendChild(el("p", { class: "safety-line", text: C.intro.safety }));
    var ex = el("details", { class: "examples" }, [
      el("summary", { text: "📚 교과서 속 다른 예 살펴보기 (참고)" }),
      el(
        "ul",
        null,
        C.examples.map(function (t) {
          return el("li", { text: t });
        })
      ),
    ]);
    box.appendChild(ex);
    return box;
  }

  var allCells = [];
  C.powders.forEach(function (p) {
    C.targets.forEach(function (t) {
      allCells.push({ powder: p.id, target: t.id });
    });
  });

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🧽 실험대 처음처럼 되돌리기",
    clearMessage: "삼각 플라스크와 고무풍선을 처음 상태로 되돌렸어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "powder",
        title: "섞을 가루 물질 고르기",
        short: "가루 물질",
        options: C.powders.map(function (p) {
          return { id: p.id, label: p.name, icon: function () { return el("span", { class: "opt-icon", "aria-hidden": "true", text: p.icon }); } };
        }),
      },
      {
        id: "target",
        title: "살펴볼 것 고르기",
        short: "살펴볼 것",
        options: C.targets.map(function (t) {
          return { id: t.id, label: t.name, icon: function () { return el("span", { class: "opt-icon", "aria-hidden": "true", text: t.icon }); } };
        }),
        note: function (sel) {
          if (!sel.powder || !sel.target) return null;
          var m = runMode(sel);
          if (m === "look") return "👀 " + josaObj(POW[sel.powder].name) + " 이미 섞었어요. 다시 섞지 않고 " + TGT[sel.target].short + "만 살펴봐요.";
          return null;
        },
      },
    ],
    phases: [{ id: "M", name: "관찰", title: "가루 물질과 식초 섞기", lead: C.phaseLead, cells: allCells }],
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.powder, sel.target);
    },
    runLabel: function (sel) {
      var m = runMode(sel);
      var pair = " (" + POW[sel.powder].name + " + 식초)";
      if (m === "look") return "👀 " + TGT[sel.target].short + " 살펴보기" + pair;
      if (m === "remix") return "🔁 다시 섞어 보기" + pair;
      return "▶ 고무풍선을 세워 섞기" + pair;
    },
    busyLabel: function (sel) {
      return sel.powder && sel.target && runMode(sel) === "look" ? "살펴보는 중… 👀" : "섞는 중… 잘 지켜보세요 👀";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 삼각 플라스크나 고무풍선을 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 삼각 플라스크를 눌러 가루 물질을 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { powder: sel.powder, target: sel.target, result: observed };
    },
    describeRecord: function (r) {
      return POW[r.powder].name + " · " + TGT[r.target].short + " → " + r.result;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.powders.map(function (p) {
        return { id: p.id, label: p.name };
      }),
      cols: C.targets.map(function (t) {
        return { id: t.id, label: t.icon + " " + t.short };
      }),
      sel: function (r, c) {
        return { powder: r.id, target: c.id };
      },
    },
    // 한 가루의 한 칸을 기록하면 같은 가루의 나머지 칸을 먼저 고른다(이미 섞었으니 '살펴보기'만 하면 된다)
    onRecorded: function (info) {
      var r = info.record;
      if (!r || info.allDone) return;
      var other = C.targets.filter(function (t) {
        return t.id !== r.target && !records.has(keyOf(r.powder, t.id));
      })[0];
      if (other) exp.select({ powder: r.powder, target: other.id });
    },
    onChange: lesson.refresh,
  });

  /* 확인하기·보기 고르기 뒤 피드백이 생기면 📝 기록하기가 하단 이동 막대에 가려질 수 있다 → 공통 틀의 규칙으로 보이게
     (기록하기가 꺼져 있으면 움직이지 않음, 크게 보기에서는 막대와 관찰 카드가 함께 보이게 — exp.revealRecord) */
  function revealRecordButton() {
    exp.revealRecord();
  }
  $("experiment-root").addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".ss-observe .ss-obs, .ss-observe .ss-check-btn") : null;
    if (!t) return;
    setTimeout(function () {
      requestAnimationFrame(revealRecordButton);
    }, 30);
  });

  /* 관찰·기록 카드: 본 모습(글) + 보기 고르기 → 확인하기(본 것과 같아야 기록) */
  function observeCard(sel) {
    var p = POW[sel.powder];
    var t = TGT[sel.target];
    var question = S.josa(p.name, "과", "와") + " 식초를 섞었을 때 " + (sel.target === "balloon" ? "고무풍선은" : "삼각 플라스크 안은") + " 어떻게 되었나요?";
    var body = el("div", { class: "ob-body" }, [
      el("p", { class: "ob-seen" }, [el("span", { class: "ob-icon", "aria-hidden": "true", text: t.icon }), el("span", { text: "👀 " + C.seen[sel.powder][sel.target] })]),
    ]);
    return {
      question: question,
      body: body,
      type: "choice",
      choices: C.observeChoices[sel.target],
      check: function (observed) {
        if (observed === expected(sel.powder, sel.target)) return true;
        return "🔍 방금 본 모습과 다른 것 같아요. 장면을 다시 살펴보고, 본 것과 같은 보기를 골라 보세요.";
      },
      okMessage: "⭕ 본 것과 같아요! '기록하기'를 눌러 기록해요.",
      retryLabel: "🔁 다시 섞어 보기",
    };
  }

  // 실험대를 되돌린 뒤(공통 틀이 화면 상태 "scene"을 비운 다음) 실행 버튼 글자·도움말을 다시 그린다
  function refreshSoon() {
    setTimeout(function () {
      if (exp && exp.refresh) exp.refresh();
    }, 0);
  }

  /* ───────── 3D 장면 ───────── */
  // 삼각 플라스크 모양(모형): 바닥 반지름 1.0, 어깨(1.9)에서 목 반지름 0.32, 입구 높이 2.58
  var FL = { R: 1.0, baseTop: 0.12, shoulder: 1.9, neckR: 0.32, neckTop: 2.5, lipTop: 2.58, liquidTop: 0.75, x: 2.3 };
  function flaskRadiusAt(y) {
    if (y <= FL.baseTop) return FL.R;
    if (y >= FL.shoulder) return FL.neckR;
    return FL.R - ((FL.R - FL.neckR) * (y - FL.baseTop)) / (FL.shoulder - FL.baseTop);
  }
  var BAL = {
    droop: 2.25, // 고무풍선이 옆으로 늘어진 각(라디안)
    limp: [0.42, 0.62, 0.42], // 늘어진(부풀지 않은) 몸통 크기
    full: [1.02, 1.12, 1.02], // 부푼 몸통 크기(모형)
    neckLen: 0.55,
  };

  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 8.4, depth: 6.8, center: [0, 2.6, 0] },
      viewDir: [0, 0.36, 0.93],
      minDistance: 3,
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var disposed = false;

      var tableMesh = M.table(12, 7, 0xd9c7a3);
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      // 화면 위에 겹쳐 보이는 안내 글(지금 하는 일) + 모형 배지
      var ovText = el("span", { class: "ov-text", hidden: true });
      var overlay = el("div", { class: "ov3d", "aria-hidden": "true" }, [el("span", { class: "ov-badge", text: C.modelBadge }), ovText]);
      container.appendChild(overlay);
      function say(text) {
        ovText.textContent = text || "";
        ovText.hidden = !text;
      }

      var glassMat = M.material(0xffffff, { transparent: true, opacity: 0.26, roughness: 0.08, side: T.DoubleSide, depthWrite: false });
      function flaskGeometry() {
        var pts = [
          [0.0, 0.0],
          [0.96, 0.0],
          [FL.R, 0.05],
          [FL.R, FL.baseTop],
          [FL.neckR + 0.05, FL.shoulder - 0.1],
          [FL.neckR, FL.shoulder + 0.05],
          [FL.neckR, FL.neckTop],
          [FL.neckR + 0.06, FL.neckTop + 0.03],
          [FL.neckR + 0.06, FL.lipTop],
          [FL.neckR - 0.02, FL.lipTop],
        ].map(function (p) {
          return new T.Vector2(p[0], p[1]);
        });
        return new T.LatheGeometry(pts, 40);
      }
      function liquidGeometry(top) {
        var pts = [
          [0, 0.04],
          [FL.R - 0.05, 0.04],
          [FL.R - 0.05, FL.baseTop],
          [flaskRadiusAt(top) - 0.05, top],
          [0, top],
        ].map(function (p) {
          return new T.Vector2(p[0], p[1]);
        });
        return new T.LatheGeometry(pts, 40);
      }
      var VINEGAR = 0xf1dc8c;

      function ring() {
        var m = new T.Mesh(new T.TorusGeometry(1.28, 0.06, 10, 48), new T.MeshBasicMaterial({ color: 0x2f6fd6 }));
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.03;
        m.visible = false;
        return m;
      }

      var pairs = {};
      C.powders.forEach(function (p, i) {
        var side = i === 0 ? -1 : 1;
        var x = side * FL.x;
        var g = new T.Group();
        g.position.set(x, 0, 0);
        v.root.add(g);

        var glass = new T.Mesh(flaskGeometry(), glassMat);
        glass.renderOrder = 3;
        g.add(glass);
        var liquidMat = M.material(VINEGAR, { transparent: true, opacity: 0.55, roughness: 0.15, emissive: VINEGAR, emissiveIntensity: 0.15, depthWrite: false });
        var liquid = new T.Mesh(liquidGeometry(FL.liquidTop), liquidMat);
        liquid.renderOrder = 1;
        g.add(liquid);
        var flaskPick = new T.Group();
        flaskPick.add(glass, liquid);
        g.add(flaskPick);
        v.pickable(flaskPick, { powder: p.id, target: "flask" });

        // 바닥에 가라앉은 가루(밀가루) — 처음에는 숨김
        var powderColor = p.id === "flour" ? 0xfbf8ee : 0xeef4f8;
        var sediment = new T.Mesh(new T.CylinderGeometry(FL.R - 0.12, FL.R - 0.08, 0.1, 36), M.material(powderColor, { roughness: 0.95 }));
        sediment.position.y = 0.09;
        sediment.scale.y = 0.01;
        sediment.visible = false;
        sediment.renderOrder = 2;
        g.add(sediment);
        // 액체 윗면의 거품 층(탄산수소 나트륨) — 처음에는 숨김
        var foam = new T.Mesh(
          new T.CylinderGeometry(flaskRadiusAt(FL.liquidTop) - 0.06, flaskRadiusAt(FL.liquidTop) - 0.06, 0.06, 32),
          M.material(0xffffff, { transparent: true, opacity: 0.75, roughness: 0.6 })
        );
        foam.position.y = FL.liquidTop + 0.03;
        foam.visible = false;
        foam.renderOrder = 2;
        g.add(foam);

        // 고무풍선: 입구에 씌운 고리 + 목 + 몸통(가루가 들어 있음). 피벗은 플라스크 입구
        var balColor = p.id === "flour" ? 0xe0574f : 0x3b7de0;
        var balMat = M.material(balColor, { transparent: true, opacity: 0.82, roughness: 0.45 });
        var pivot = new T.Group();
        pivot.position.y = FL.lipTop - 0.12;
        g.add(pivot);
        var collar = new T.Mesh(new T.CylinderGeometry(FL.neckR + 0.1, FL.neckR + 0.1, 0.26, 24), balMat);
        collar.position.y = 0.06;
        pivot.add(collar);
        var neck = new T.Mesh(new T.CylinderGeometry(0.16, FL.neckR + 0.08, BAL.neckLen, 20), balMat);
        neck.position.y = 0.19 + BAL.neckLen / 2;
        pivot.add(neck);
        var body = new T.Mesh(new T.SphereGeometry(1, 28, 20), balMat);
        body.renderOrder = 4;
        pivot.add(body);
        var inPowder = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), M.material(powderColor, { roughness: 0.95 }));
        pivot.add(inPowder);
        var balPick = new T.Group();
        pivot.remove(collar, neck, body, inPowder);
        balPick.add(collar, neck, body, inPowder);
        pivot.add(balPick);
        v.pickable(balPick, { powder: p.id, target: "balloon" });

        // 이름표(색만으로 구분하지 않도록 글자)
        var nameLabel = M.label(p.name, { height: 0.42, bold: true });
        nameLabel.position.set(0, 0.22, 1.62);
        g.add(nameLabel);
        var vinegarLabel = M.label("식초", { height: 0.36 });
        vinegarLabel.position.set(0, 0.5, 1.12);
        g.add(vinegarLabel);

        var r = ring();
        g.add(r);

        pairs[p.id] = {
          id: p.id,
          side: side,
          x: x,
          group: g,
          pivot: pivot,
          body: body,
          inPowder: inPowder,
          liquidMat: liquidMat,
          sediment: sediment,
          foam: foam,
          ring: r,
          bubbles: null,
          falling: null,
          state: "idle",
        };
        setBalloon(pairs[p.id], BAL.droop * -side, BAL.limp);
      });

      // 고무풍선 몸통 크기·각도(피벗 기준). angle: 0이면 똑바로 선 모습
      function setBalloon(o, angle, scale) {
        o.pivot.rotation.z = angle;
        o.body.scale.set(scale[0], scale[1], scale[2]);
        o.body.position.y = 0.19 + BAL.neckLen + scale[1] * 0.92;
        o.inPowder.position.y = 0.19 + BAL.neckLen + scale[1] * 1.3;
      }

      /* 기포: 액체 속에서 올라오는 작은 공(모형). 전용 루프로 움직이고, Sim3D 렌더 루프가 그린다 */
      var bubbleGeo = new T.SphereGeometry(1, 10, 8);
      var bubbleMat = M.material(0xffffff, { transparent: true, opacity: 0.85, roughness: 0.1, emissive: 0xbcd6ee, emissiveIntensity: 0.4 });
      function randIn(o) {
        var y = 0.08 + Math.random() * (FL.liquidTop - 0.15);
        var rr = (flaskRadiusAt(y) - 0.15) * Math.sqrt(Math.random());
        var a = Math.random() * Math.PI * 2;
        return { x: Math.cos(a) * rr, y: y, z: Math.sin(a) * rr };
      }
      function addBubbles(o) {
        if (o.bubbles) return;
        var grp = new T.Group();
        var list = [];
        for (var i = 0; i < 26; i++) {
          var m = new T.Mesh(bubbleGeo, bubbleMat);
          var s = 0.035 + (i % 4) * 0.012;
          m.scale.set(s, s, s);
          var p0 = randIn(o);
          m.position.set(p0.x, p0.y, p0.z);
          m.renderOrder = 2;
          grp.add(m);
          list.push({ mesh: m, speed: 0.35 + Math.random() * 0.45 });
        }
        o.group.add(grp);
        o.bubbles = { group: grp, list: list };
        startLoop();
      }
      function removeBubbles(o) {
        if (!o.bubbles) return;
        o.group.remove(o.bubbles.group);
        o.bubbles = null; // 기하·재질은 공유라 dispose 때 한꺼번에 해제
      }
      var loopId = 0;
      var lastT = 0;
      function startLoop() {
        if (loopId || disposed || reduceMotion()) return;
        lastT = performance.now();
        loopId = requestAnimationFrame(tick);
      }
      function tick(now) {
        loopId = 0;
        if (disposed) return;
        var dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        var any = false;
        Object.keys(pairs).forEach(function (id) {
          var o = pairs[id];
          if (!o.bubbles) return;
          any = true;
          o.bubbles.list.forEach(function (b) {
            b.mesh.position.y += b.speed * dt;
            if (b.mesh.position.y > FL.liquidTop - 0.02) {
              var p0 = randIn(o);
              b.mesh.position.set(p0.x, 0.08, p0.z);
            }
          });
        });
        if (any) loopId = requestAnimationFrame(tick);
      }

      function clearFalling(o) {
        if (o.falling) {
          v.discard(o.falling.group);
          o.falling = null;
        }
      }
      // 처음 상태: 고무풍선이 옆으로 늘어져 있고 가루가 풍선 안에 있음
      function resetPair(o) {
        clearFalling(o);
        removeBubbles(o);
        setBalloon(o, BAL.droop * -o.side, BAL.limp);
        o.inPowder.visible = true;
        o.liquidMat.color.set(VINEGAR);
        o.liquidMat.opacity = 0.55;
        o.sediment.visible = false;
        o.sediment.scale.y = 0.01;
        o.foam.visible = false;
        o.state = "idle";
      }
      // 섞은 뒤 결과(애니메이션 없이)
      function finalPair(o) {
        clearFalling(o);
        o.inPowder.visible = false;
        if (o.id === "flour") {
          setBalloon(o, 0.22 * -o.side, BAL.limp); // 선 채로 늘어져 있고 부풀지 않음
          o.sediment.visible = true;
          o.sediment.scale.y = 1;
          o.liquidMat.color.set(0xf4ead0);
          o.liquidMat.opacity = 0.66;
          removeBubbles(o);
          o.foam.visible = false;
        } else {
          setBalloon(o, 0, BAL.full);
          o.sediment.visible = false;
          o.foam.visible = true;
          addBubbles(o);
        }
        o.state = "mixed";
      }

      // 가루가 풍선에서 식초로 떨어지는 알갱이
      function makeFalling(o) {
        clearFalling(o);
        var grp = new T.Group();
        var geo = new T.SphereGeometry(0.05, 8, 6);
        var mat = M.material(o.id === "flour" ? 0xfbf8ee : 0xeef4f8, { roughness: 0.95 });
        var list = [];
        for (var i = 0; i < 36; i++) {
          var m = new T.Mesh(geo, mat);
          var a = Math.random() * Math.PI * 2;
          var rr = Math.random() * 0.2;
          m.position.set(Math.cos(a) * rr, FL.lipTop + 0.3, Math.sin(a) * rr);
          m.renderOrder = 2;
          grp.add(m);
          var endR = Math.random() * 0.75;
          list.push({ mesh: m, start: m.position.clone(), delay: Math.random() * 0.35, ex: Math.cos(a) * endR, ez: Math.sin(a) * endR });
        }
        o.group.add(grp);
        o.falling = { group: grp, list: list };
        return o.falling;
      }

      function targetPoint(o, target) {
        return target === "balloon" ? [o.x, FL.lipTop + 1.1, 0] : [o.x, 1.0, 0];
      }

      var runToken = 0;
      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          Object.keys(pairs).forEach(function (id) {
            pairs[id].ring.visible = s.powder === id;
          });
          v.render();
        },
        run: async function (sel) {
          var my = ++runToken;
          var o = pairs[sel.powder];
          var mode = runMode(sel);
          if (mode === "look" && o.state === "mixed") {
            say("👀 " + TGT[sel.target].short + " 살펴보기");
            await v.focus(targetPoint(o, sel.target), 0.72, 650);
            await v.wait(350);
            if (my === runToken) say("");
            return;
          }
          resetPair(o);
          say("");
          await v.focus([o.x, 2.2, 0], 0.8, 500);
          if (my !== runToken) return;
          // ① 고무풍선을 세운다
          say("① 고무풍선을 세워요");
          var a0 = o.pivot.rotation.z;
          await v.tween(900, function (t) {
            o.pivot.rotation.z = a0 * (1 - t);
            o.body.scale.set(BAL.limp[0], BAL.limp[1], BAL.limp[2]);
          });
          if (my !== runToken) return;
          // ② 가루가 식초 속으로 떨어진다
          say("② 가루가 식초와 섞여요");
          o.inPowder.visible = false;
          var f = makeFalling(o);
          var sinkTo = o.id === "flour" ? 0.12 : FL.liquidTop;
          await v.tween(1000, function (t, raw) {
            f.list.forEach(function (b) {
              var k = Math.max(0, Math.min(1, (raw - b.delay) / (1 - b.delay)));
              var y = b.start.y + (sinkTo - b.start.y) * (k * k);
              b.mesh.position.set(b.start.x + (b.ex - b.start.x) * k * (y < FL.liquidTop ? 1 : 0.2), y, b.start.z + (b.ez - b.start.z) * k * (y < FL.liquidTop ? 1 : 0.2));
              b.mesh.visible = !(o.id === "soda" && k >= 1);
            });
          });
          if (my !== runToken) return;
          clearFalling(o);
          // ③ 결과 연출(모형: 실제보다 빠르게)
          if (o.id === "flour") {
            say("③ 잘 지켜보세요");
            o.sediment.visible = true;
            var c0 = new T.Color(VINEGAR);
            var c1 = new T.Color(0xf4ead0);
            await v.tween(1700, function (t) {
              o.sediment.scale.y = Math.max(0.01, t);
              o.liquidMat.color.copy(c0).lerp(c1, t);
              o.liquidMat.opacity = 0.55 + 0.11 * t;
              o.pivot.rotation.z = 0.22 * -o.side * t; // 부풀지 않은 풍선이 힘없이 기운다
            });
          } else {
            say("③ 잘 지켜보세요 (모형: 빠르게)");
            o.foam.visible = true;
            addBubbles(o);
            await v.tween(1800, function (t) {
              setBalloon(o, 0, [
                BAL.limp[0] + (BAL.full[0] - BAL.limp[0]) * t,
                BAL.limp[1] + (BAL.full[1] - BAL.limp[1]) * t,
                BAL.limp[2] + (BAL.full[2] - BAL.limp[2]) * t,
              ]);
              o.foam.scale.y = 0.3 + 0.7 * t;
            });
          }
          if (my !== runToken) return;
          finalPair(o);
          say("👀 " + TGT[sel.target].short + " 살펴보기");
          await v.focus(targetPoint(o, sel.target), 0.72, 600);
          if (my === runToken) say("");
          v.render();
        },
        showInstant: function (sel) {
          var o = pairs[sel.powder];
          if (o && o.state !== "mixed") finalPair(o);
          v.render();
        },
        clear: function () {
          runToken++;
          say("");
          Object.keys(pairs).forEach(function (id) {
            resetPair(pairs[id]);
          });
          v.flyHome(400);
          refreshSoon();
        },
        resetView: v.resetView,
        dispose: function () {
          runToken++;
          disposed = true;
          if (loopId) cancelAnimationFrame(loopId);
          loopId = 0;
          Object.keys(pairs).forEach(function (id) {
            clearFalling(pairs[id]);
            removeBubbles(pairs[id]);
          });
          bubbleGeo.dispose();
          bubbleMat.dispose();
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
  // 2D 좌표: 플라스크 바닥 y=250, 폭 25~175, 어깨 y=112(78~122), 입구 y=64
  var D2 = { lip: 64, liquidTop: 205, droop: 118, limp: [13, 20], full: [40, 44] };
  function d2HalfWidth(y) {
    if (y <= 112) return 22;
    return 22 + (53 * (y - 112)) / 138;
  }
  function tween2(ms, fn, token, get) {
    return new Promise(function (resolve) {
      if (document.hidden || reduceMotion()) {
        fn(1);
        resolve();
        return;
      }
      var t0 = null;
      function step(now) {
        if (get() !== token) return resolve();
        if (t0 == null) t0 = now;
        var t = Math.min(1, (now - t0) / ms);
        var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        fn(e);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function build2D(root, ctx) {
    var token = 0;
    var getToken = function () {
      return token;
    };
    var panels = {};
    var row = el("div", { class: "d2-row" });
    var caption = el("p", { class: "d2-caption", "aria-live": "polite" });
    C.powders.forEach(function (p, i) {
      var side = i === 0 ? -1 : 1;
      var hwTop = d2HalfWidth(D2.liquidTop);
      var flask = svg("path", { class: "d2-glass", d: "M25,250 L78,112 L78," + D2.lip + " L122," + D2.lip + " L122,112 L175,250 Z" });
      var liquid = svg("path", { class: "d2-liquid", d: "M28,248 L" + (100 - hwTop + 2) + "," + D2.liquidTop + " L" + (100 + hwTop - 2) + "," + D2.liquidTop + " L172,248 Z" });
      var sediment = svg("path", { class: "d2-sediment", d: "M30,248 L34,236 L166,236 L170,248 Z" });
      var foam = svg("rect", { class: "d2-foam", x: 100 - hwTop + 4, y: D2.liquidTop - 5, width: 2 * hwTop - 8, height: 6, rx: 3 });
      var bubbles = svg("g", { class: "d2-bubbles" });
      for (var b = 0; b < 12; b++) {
        var bx = 100 + (((b * 37) % 100) - 50) * 1.1;
        bubbles.appendChild(svg("circle", { class: "d2-bub", cx: bx, cy: 244 - (b % 3) * 6, r: 2.5 + (b % 3), style: "animation-delay:" + ((b * 0.17) % 1.4).toFixed(2) + "s" }));
      }
      var falling = svg("g", { class: "d2-falling" });
      for (var f = 0; f < 10; f++) falling.appendChild(svg("circle", { class: "d2-grain", cx: 92 + (f % 5) * 4, cy: D2.lip - 4 - Math.floor(f / 5) * 5, r: 2.4 }));
      // 고무풍선(회전·크기는 JS로)
      var balNeck = svg("path", { class: "d2-balloon", d: "M-12,6 L12,6 L8,-14 L-8,-14 Z" });
      var balBody = svg("ellipse", { class: "d2-balloon d2-bal-" + p.id, cx: 0, cy: -34, rx: D2.limp[0], ry: D2.limp[1] });
      var balPowder = svg("circle", { class: "d2-powder", cx: 0, cy: -42, r: 8 });
      var balGroup = svg("g", { transform: "rotate(" + D2.droop * side + ")" }, [balNeck, balBody, balPowder]);
      var balWrap = svg("g", { transform: "translate(100," + D2.lip + ")" }, [balGroup]);
      var focusBal = svg("ellipse", { class: "d2-focus", cx: 100, cy: 0, rx: 60, ry: 62 });
      var focusFlask = svg("rect", { class: "d2-focus", x: 18, y: 150, width: 164, height: 106, rx: 14 });
      var name = svg("text", { class: "d2-name", x: 100, y: 278, "text-anchor": "middle" });
      name.textContent = p.name + " + 식초";
      var vin = svg("text", { class: "d2-vin", x: 100, y: 232, "text-anchor": "middle" });
      vin.textContent = "식초";
      var pic = svg("svg", { viewBox: "0 -70 200 360", class: "d2-svg", "aria-hidden": "true" }, [liquid, sediment, foam, bubbles, vin, flask, falling, balWrap, focusBal, focusFlask, name]);
      var btn = el("button", { type: "button", class: "d2-pick", "aria-pressed": "false", "aria-label": S.josa(p.name, "이", "가") + " 든 고무풍선과 식초(고르기)", onclick: function () { ctx.onPick({ powder: p.id }); } }, [pic]);
      row.appendChild(btn);
      panels[p.id] = { id: p.id, side: side, btn: btn, balGroup: balGroup, balBody: balBody, balPowder: balPowder, sediment: sediment, foam: foam, bubbles: bubbles, falling: falling, liquid: liquid, focusBal: focusBal, focusFlask: focusFlask, state: "idle" };
      resetPanel(panels[p.id]);
    });
    var badge = el("span", { class: "d2-badge", text: C.modelBadge });
    root.appendChild(el("div", { class: "d2-wrap" }, [badge, row, caption]));
    caption.textContent = "가루 물질을 고르고 고무풍선을 세워 섞어 보세요.";

    function setBal(o, angle, rx, ry) {
      o.balGroup.setAttribute("transform", "rotate(" + angle.toFixed(1) + ")");
      o.balBody.setAttribute("rx", rx.toFixed(1));
      o.balBody.setAttribute("ry", ry.toFixed(1));
      o.balBody.setAttribute("cy", (-14 - ry).toFixed(1));
      o.balPowder.setAttribute("cy", (-14 - ry * 1.4).toFixed(1));
    }
    function resetPanel(o) {
      setBal(o, D2.droop * o.side, D2.limp[0], D2.limp[1]);
      o.balPowder.style.display = "";
      o.sediment.style.display = "none";
      o.foam.style.display = "none";
      o.bubbles.classList.remove("is-on");
      o.falling.style.display = "none";
      o.falling.setAttribute("transform", "");
      o.liquid.classList.remove("is-cloudy");
      o.state = "idle";
    }
    function finalPanel(o) {
      o.balPowder.style.display = "none";
      o.falling.style.display = "none";
      if (o.id === "flour") {
        setBal(o, 12 * o.side, D2.limp[0], D2.limp[1]);
        o.sediment.style.display = "";
        o.sediment.style.opacity = "1";
        o.liquid.classList.add("is-cloudy");
      } else {
        setBal(o, 0, D2.full[0], D2.full[1]);
        o.foam.style.display = "";
        o.bubbles.classList.add("is-on");
      }
      o.state = "mixed";
    }
    function focusOn(sel) {
      Object.keys(panels).forEach(function (id) {
        var o = panels[id];
        var on = sel && sel.powder === id;
        o.focusBal.classList.toggle("is-on", !!(on && sel.target === "balloon" && o.state === "mixed"));
        o.focusFlask.classList.toggle("is-on", !!(on && sel.target === "flask" && o.state === "mixed"));
      });
    }

    return {
      highlight: function (s) {
        Object.keys(panels).forEach(function (id) {
          panels[id].btn.classList.toggle("is-sel", s.powder === id);
          panels[id].btn.setAttribute("aria-pressed", String(s.powder === id));
        });
        focusOn(null);
      },
      run: async function (sel) {
        var my = ++token;
        var o = panels[sel.powder];
        var mode = runMode(sel);
        if (mode === "look" && o.state === "mixed") {
          caption.textContent = "👀 " + josaObj(TGT[sel.target].short) + " 살펴봐요.";
          focusOn(sel);
          await sleep(500);
          return;
        }
        resetPanel(o);
        focusOn(null);
        caption.textContent = "① 고무풍선을 세워요…";
        var a0 = D2.droop * o.side;
        await tween2(900, function (t) {
          setBal(o, a0 * (1 - t), D2.limp[0], D2.limp[1]);
        }, my, getToken);
        if (my !== token) return;
        caption.textContent = "② 가루가 식초와 섞여요…";
        o.balPowder.style.display = "none";
        o.falling.style.display = "";
        var drop = (o.id === "flour" ? 236 : D2.liquidTop) - D2.lip + 4;
        await tween2(900, function (t) {
          o.falling.setAttribute("transform", "translate(0," + (drop * t).toFixed(1) + ")");
        }, my, getToken);
        if (my !== token) return;
        o.falling.style.display = "none";
        if (o.id === "flour") {
          caption.textContent = "③ 잘 지켜보세요…";
          o.sediment.style.display = "";
          o.liquid.classList.add("is-cloudy");
          await tween2(1600, function (t) {
            o.sediment.style.opacity = String(t);
            setBal(o, 12 * o.side * t, D2.limp[0], D2.limp[1]);
          }, my, getToken);
        } else {
          caption.textContent = "③ 잘 지켜보세요… (모형: 빠르게)";
          o.foam.style.display = "";
          o.bubbles.classList.add("is-on");
          await tween2(1700, function (t) {
            setBal(o, 0, D2.limp[0] + (D2.full[0] - D2.limp[0]) * t, D2.limp[1] + (D2.full[1] - D2.limp[1]) * t);
          }, my, getToken);
        }
        if (my !== token) return;
        finalPanel(o);
        focusOn(sel);
        caption.textContent = S.josa(POW[sel.powder].name, "과", "와") + " 식초를 섞었어요. " + josaObj(TGT[sel.target].short) + " 살펴봐요.";
      },
      showInstant: function (sel) {
        var o = panels[sel.powder];
        if (o && o.state !== "mixed") finalPanel(o);
      },
      clear: function () {
        token++;
        Object.keys(panels).forEach(function (id) {
          resetPanel(panels[id]);
        });
        focusOn(null);
        caption.textContent = "가루 물질을 고르고 고무풍선을 세워 섞어 보세요.";
        refreshSoon();
      },
      resetView: function () {},
      dispose: function () {
        token++;
      },
    };
  }

  /* ───────── 3. 기록·분석하기: 관찰 결과 표 ───────── */
  var nav = null;
  function drawResultTable() {
    S.TableChart.renderMatrix($("result-table"), {
      caption: "가루 물질과 식초를 섞었을 때의 변화 (내 기록)",
      rowHeader: "가루 물질 \\ 살펴본 것",
      rows: C.powders.map(function (p) {
        return { id: p.id, label: p.name + " + 식초" };
      }),
      cols: C.targets.map(function (t) {
        return { id: t.id, label: t.name };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        var rec = records.get(keyOf(r.id, c.id));
        if (!rec) return null;
        var wrong = rec.result !== expected(r.id, c.id);
        return {
          text: rec.result,
          icon: C.resultIcon[rec.result] || null,
          flag: wrong ? "다시 관찰해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ powder: r.id, target: c.id });
          },
        };
      },
    });
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function recordRows() {
    return C.powders.map(function (p) {
      var b = records.get(keyOf(p.id, "balloon"));
      var f = records.get(keyOf(p.id, "flask"));
      return { powder: p.name, balloon: b ? b.result : "", flask: f ? f.result : "" };
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
      records: records.list().map(function (r) {
        return { powder: POW[r.powder].name, target: TGT[r.target].name, result: r.result, recordedAt: r.recordedAt };
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
            label: "내 관찰 기록",
            question: "가루 물질별 고무풍선·삼각 플라스크 안의 변화",
            kind: "table",
            answer: {
              columns: [
                { key: "powder", label: "가루 물질" },
                { key: "balloon", label: "고무풍선의 변화" },
                { key: "flask", label: "삼각 플라스크 안의 변화" },
              ],
              rows: rows,
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
      return ["관찰하고 기록한 칸: " + exp.progress().done + "/" + exp.progress().total + "칸", "분석 질문: " + n + "/" + C.quiz.length + " 맞힘"];
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
        if (!exp.allDone()) return "먼저 실험하기에서 4칸을 모두 기록해 주세요.";
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
      analyze: drawResultTable,
    },
  });
})();
