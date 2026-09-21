/*
 * app.js — sci-6-1-1-3 "산성 용액과 염기성 용액의 성질을 비교해 볼까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(6홈판 2개·용액 병·재료 접시·핀셋 2개, 반응 연출)  ② 관찰 카드  ③ 분석 표·퀴즈 연결  만 만든다.
 * 반응 결과는 모두 LessonConfig.results(지도서 표)에서만 가져온다.
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
  var SOL = {};
  C.solutions.forEach(function (s, i) {
    SOL[s.id] = Object.assign({ index: i }, s);
  });
  var MAT = {};
  C.materials.forEach(function (m, i) {
    MAT[m.id] = Object.assign({ index: i }, m);
  });
  function keyOf(solId, matId) {
    return solId + "|" + matId;
  }
  function expected(solId, matId) {
    return C.results[solId][matId];
  }
  var KIND_OF_TEXT = {};
  Object.keys(C.results).forEach(function (s) {
    Object.keys(C.results[s]).forEach(function (m) {
      KIND_OF_TEXT[C.results[s][m].text] = C.results[s][m].kind;
    });
  });
  // 화면 읽기용 상태 설명(2D 홈)
  var STATE_TEXT = {
    fizz: "물질 표면에서 기포가 생기고, 시간이 지난 뒤 조각이 작아짐(빨리 감기 모형)",
    none: "물질의 모양이 그대로임",
    melt: "시간이 지난 뒤 물질이 흐물흐물해지고 용액이 조금 뿌옇게 됨(빨리 감기 모형)",
  };

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.solution, r.material);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);

  function paragraphs(list) {
    var box = el("div");
    list.forEach(function (p) {
      var n = S.rich(typeof p === "string" ? p : p.text, "p");
      if (p.term) n.className = "ss-term";
      box.appendChild(n);
    });
    return box;
  }
  // 분석 단계의 '주요 성분' 알아 두기 카드(탄산 칼슘·단백질은 여기서 처음 소개한다)
  (function () {
    var card = el("div", { class: "ss-card ss-intro comp-card" }, [el("h3", { class: "comp-h", text: C.components.title }), paragraphs(C.components.paragraphs)]);
    $("components-root").appendChild(card);
  })();

  /* ───────── 2. 실험하기 ───────── */
  function pieceIcon(matId) {
    return el("span", { class: "pc pc-" + matId, "aria-hidden": "true" });
  }
  function bottleIcon() {
    return el("span", { class: "bottle-icon", "aria-hidden": "true" });
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

  var cells = [];
  C.solutions.forEach(function (s) {
    C.materials.forEach(function (m) {
      cells.push({ mat: m.id, sol: s.id });
    });
  });

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: paragraphs(C.intro.paragraphs),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🧽 홈판 비우기",
    clearMessage: "홈판을 깨끗이 비웠어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "mat",
        title: "물질 고르기",
        short: "물질",
        options: C.materials.map(function (m) {
          return { id: m.id, label: m.name, icon: function () { return pieceIcon(m.id); } };
        }),
      },
      {
        id: "sol",
        title: "용액 고르기",
        short: "용액",
        options: C.solutions.map(function (s) {
          return { id: s.id, label: s.name, icon: bottleIcon };
        }),
        note: function (sel) {
          return sel.sol ? "🔧 " + SOL[sel.sol].name + " 홈판에는 " + SOL[sel.sol].tweezers + " 손잡이 핀셋을 써요(용액이 섞이지 않게)." : null;
        },
      },
    ],
    phases: [{ id: C.phase.id, name: C.phase.name, lead: C.phase.lead, cells: cells }],
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.sol, sel.mat);
    },
    runLabel: function (sel) {
      return "▶ " + S.josa(MAT[sel.mat].name, "을", "를") + " " + SOL[sel.sol].name + "에 넣기";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 접시·홈판을 눌러 고르기",
      tip2D: "2D 화면(모형)이에요. 접시·홈판·홈을 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { solution: sel.sol, material: sel.mat, result: observed };
    },
    describeRecord: function (r) {
      return SOL[r.solution].name + " + " + MAT[r.material].name + " → " + r.result;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.materials.map(function (m) {
        return { id: m.id, label: m.name };
      }),
      cols: C.solutions.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      sel: function (r, c) {
        return { mat: r.id, sol: c.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  function observeCard(sel) {
    var m = MAT[sel.mat];
    var s = SOL[sel.sol];
    // 모든 칸에 같은 안내를 보여 준다(특정 보기를 가리키지 않게)
    var body = el("p", { class: "melt-note", text: C.observeNote });
    return {
      question: S.josa(m.name, "은", "는") + " " + s.name + "에서 어떻게 되었나요?",
      body: body,
      type: "choice",
      choices: C.observeChoices,
    };
  }

  /* ── '시간 빨리 감기' 표시(3D·2D 공통, 실험 화면 위에 겹쳐 보인다) ── */
  // kind: "fizz"(녹아 작아지는 부분) | "melt"(흐물흐물). 문구는 C.fastForward에서 가져온다.
  function fastForward(container, ms, kind) {
    var msg = C.fastForward[kind] || C.fastForward.melt;
    var host = (container.closest && container.closest(".ss-exp-view")) || container;
    var bar = el("span", { class: "ff-bar-fill" });
    var text = el("span", { class: "ff-text", text: msg.start });
    var box = el("div", { class: "ff-overlay", role: "status" }, [
      el("strong", { class: "ff-title", text: "⏩ 시간 빨리 감기 (모형)" }),
      text,
      el("span", { class: "ff-bar" }, [bar]),
    ]);
    host.appendChild(box);
    bar.style.transitionDuration = ms + "ms";
    // 다음 프레임에 너비를 바꿔야 전환이 보인다
    setTimeout(function () {
      bar.style.width = "100%";
    }, 30);
    var t1 = setTimeout(function () {
      text.textContent = msg.mid;
    }, ms * 0.45);
    return {
      end: function () {
        clearTimeout(t1);
        text.textContent = msg.end;
        setTimeout(function () {
          if (box.parentNode) box.parentNode.removeChild(box);
        }, 1600);
      },
      remove: function () {
        clearTimeout(t1);
        if (box.parentNode) box.parentNode.removeChild(box);
      },
    };
  }

  /* ── 2D 대체 화면: 6홈판 2개를 위에서 본 모형 ── */
  function build2D(root, ctx) {
    var wells = {};
    var plateHeads = {};
    var dishBtns = {};
    var timers = [];
    var ff = null;
    var disposed = false;
    function wait(ms) {
      return new Promise(function (r) {
        timers.push(setTimeout(r, ms));
      });
    }

    var dishes = el("div", { class: "p3-dishes", role: "group", "aria-label": "재료 접시" });
    C.materials.forEach(function (m) {
      var b = el("button", { type: "button", class: "p3-dish", onclick: function () {
        ctx.onPick({ mat: m.id });
      } }, [el("span", { class: "p3-dish-plate" }, [pieceIcon(m.id)]), el("span", { class: "p3-dish-name", text: m.name })]);
      dishBtns[m.id] = b;
      dishes.appendChild(b);
    });

    var plates = el("div", { class: "p3-plates" });
    C.solutions.forEach(function (s) {
      var head = el("button", { type: "button", class: "p3-plate-head", onclick: function () {
        ctx.onPick({ sol: s.id });
      } }, [bottleIcon(), el("span", { text: s.name }), el("span", { class: "tw-tag tw-" + s.id, text: "핀셋: " + s.tweezers })]);
      plateHeads[s.id] = head;
      var grid = el("div", { class: "p3-grid" });
      C.materials.forEach(function (m) {
        var piece = pieceIcon(m.id);
        piece.classList.add("p3-piece");
        var bubbles = el("span", { class: "p3-bubbles", "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i"), el("i")]);
        var w = el("button", { type: "button", class: "p3-well", onclick: function () {
          ctx.onPick({ sol: s.id, mat: m.id });
        } }, [el("span", { class: "p3-liquid" }), piece, bubbles]);
        var c = { well: w, piece: piece, sol: s, mat: m };
        wells[keyOf(s.id, m.id)] = c;
        label(c, null);
        grid.appendChild(el("div", { class: "p3-cell" }, [w, el("span", { class: "p3-cell-name", text: m.name })]));
      });
      plates.appendChild(el("div", { class: "p3-plate p3-plate-" + s.id }, [head, grid]));
    });
    root.appendChild(
      el("div", { class: "p3-wrap" }, [
        dishes,
        plates,
        el("p", { class: "p2-caption", text: "6홈판 2개 · 실험 도움판 ② (위에서 본 모형, 쓰는 홈 4개만 나타냄). 두 용액은 모두 색깔이 없고 투명해요." }),
      ])
    );

    function label(c, kind) {
      var base = c.sol.name + " 홈의 " + c.mat.name;
      c.well.setAttribute("aria-label", kind ? base + ", 실험함: " + STATE_TEXT[kind] : base + ", 아직 넣지 않음");
    }
    function reset(c) {
      c.well.classList.remove("is-in", "r-fizz", "r-bub", "r-none", "r-melt", "fizzing", "rippling", "dropping");
      label(c, null);
    }
    function finalState(c, kind) {
      c.well.classList.add("is-in", "r-" + kind);
      label(c, kind);
    }
    return {
      highlight: function (s) {
        Object.keys(plateHeads).forEach(function (id) {
          plateHeads[id].classList.toggle("is-sel", s.sol === id);
          plateHeads[id].setAttribute("aria-pressed", String(s.sol === id));
        });
        Object.keys(dishBtns).forEach(function (id) {
          dishBtns[id].classList.toggle("is-sel", s.mat === id);
          dishBtns[id].setAttribute("aria-pressed", String(s.mat === id));
        });
        Object.keys(wells).forEach(function (k) {
          wells[k].well.classList.toggle("is-target", k === keyOf(s.sol, s.mat));
        });
      },
      run: async function (sel) {
        var c = wells[keyOf(sel.sol, sel.mat)];
        var kind = expected(sel.sol, sel.mat).kind;
        reset(c);
        c.well.classList.add("no-anim");
        void c.well.offsetWidth;
        c.well.classList.remove("no-anim");
        await wait(120);
        c.well.classList.add("is-in", "dropping");
        await wait(650);
        c.well.classList.remove("dropping");
        if (kind === "fizz") {
          // 기포는 넣자마자(실제 시간), 녹아 작아지는 부분은 '빨리 감기'로
          c.well.classList.add("fizzing", "r-bub");
          await wait(1100);
          if (disposed) return;
          ff = fastForward(root, 2400, "fizz");
          c.well.classList.add("r-fizz");
          await wait(2500);
          if (ff) ff.end();
          ff = null;
          c.well.classList.remove("fizzing", "r-bub");
        } else if (kind === "melt") {
          ff = fastForward(root, 3200, "melt");
          c.well.classList.add("r-melt");
          await wait(3300);
          if (ff) ff.end();
          ff = null;
          await wait(300);
        } else {
          c.well.classList.add("rippling", "r-none");
          await wait(1000);
          c.well.classList.remove("rippling");
        }
        if (!disposed) finalState(c, kind);
      },
      showInstant: function (sel) {
        var c = wells[keyOf(sel.sol, sel.mat)];
        reset(c);
        c.well.classList.add("no-anim");
        finalState(c, expected(sel.sol, sel.mat).kind);
        void c.well.offsetWidth;
        c.well.classList.remove("no-anim");
      },
      clear: function () {
        if (ff) ff.remove();
        ff = null;
        Object.keys(wells).forEach(function (k) {
          reset(wells[k]);
        });
      },
      resetView: function () {},
      dispose: function () {
        disposed = true;
        timers.forEach(clearTimeout);
        if (ff) ff.remove();
        ff = null;
      },
    };
  }

  /* ── 3D 화면 ── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 19.5, depth: 15.5, center: [0, 0.6, 2.2] },
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var ff = null;

      var tableMesh = M.table(24, 15, 0xd9c7a3);
      tableMesh.position.z = 0.6;
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      function ring(radius, color, tube) {
        var m = new T.Mesh(new T.TorusGeometry(radius, tube || 0.07, 10, 40), new T.MeshBasicMaterial({ color: color }));
        m.rotation.x = -Math.PI / 2;
        return m;
      }

      // 재료 조각 모형(겉보기 색만 반영: 흰색 / 회백색 / 반투명 흰색 / 연분홍빛)
      function makePiece(matId) {
        var g = new T.Group();
        var mesh;
        if (matId === "eggshell") {
          mesh = new T.Mesh(
            new T.SphereGeometry(0.42, 20, 10, 0, Math.PI * 1.2, 0, Math.PI * 0.42),
            M.material(0xf1e6cf, { roughness: 0.75, side: T.DoubleSide })
          );
          mesh.position.y = -0.42 * Math.cos(Math.PI * 0.42);
          mesh.scale.set(1.1, 1, 1);
        } else if (matId === "shell") {
          mesh = new T.Mesh(new T.CylinderGeometry(0.52, 0.52, 0.08, 20, 1, false, -0.95, 1.9), M.material(0xd9d3c7, { roughness: 0.6 }));
          mesh.position.set(0, 0.06, -0.26);
          mesh.rotation.x = -0.12;
          // 부채꼴 무늬(줄)
          for (var i = -2; i <= 2; i++) {
            var rib = new T.Mesh(new T.BoxGeometry(0.035, 0.03, 0.48), M.material(0xbfb6a6));
            rib.position.set(Math.sin(i * 0.35) * 0.24, 0.05, Math.cos(i * 0.35) * 0.24);
            rib.rotation.y = i * 0.35;
            mesh.add(rib);
          }
        } else if (matId === "eggwhite") {
          mesh = new T.Mesh(new T.IcosahedronGeometry(0.34, 1), M.material(0xf6f3e6, { roughness: 0.35 }));
          mesh.scale.set(1.2, 0.72, 1);
          mesh.position.y = 0.22;
        } else {
          mesh = new T.Mesh(new T.DodecahedronGeometry(0.34, 0), M.material(0xecd0c0, { roughness: 0.85 }));
          mesh.scale.set(1.35, 0.62, 0.95);
          mesh.position.y = 0.2;
        }
        g.add(mesh);
        g.userData.body = mesh;
        g.userData.baseScale = mesh.scale.clone();
        g.userData.baseY = mesh.position.y;
        return g;
      }
      function setOpacity(obj, a) {
        obj.traverse(function (o) {
          if (o.material) {
            o.material.transparent = true;
            o.material.opacity = a;
          }
        });
      }

      // 6홈판 2개(왼쪽: 묽은 염산, 오른쪽: 묽은 수산화 나트륨 용액). 재료 i → 홈 [i/2][i%2]
      var plates = {};
      var wellObjs = {};
      var PX = 4.3;
      C.solutions.forEach(function (s, si) {
        var gx = si === 0 ? -PX : PX;
        var plate = M.wellPlate({ rows: 2, cols: 3, spacing: 1.9, holeColor: 0x8fa3b8 });
        plate.group.position.x = gx;
        // 실험 도움판 ②(종이 판, 모형)
        var board = new T.Mesh(new T.BoxGeometry(plate.width + 0.9, 0.04, plate.depth + 0.9), M.material(0xfbfaf4, { roughness: 0.9 }));
        board.position.set(gx, 0.02, 0);
        v.root.add(board);
        v.root.add(plate.group);
        v.pickable(plate.group, { sol: s.id });
        var H = plate.height;
        var outline = new T.LineSegments(
          new T.EdgesGeometry(new T.BoxGeometry(plate.width + 0.4, H + 0.3, plate.depth + 0.4)),
          new T.LineBasicMaterial({ color: 0x2f6fd6 })
        );
        outline.position.set(gx, (H + 0.3) / 2, 0);
        outline.visible = false;
        v.root.add(outline);
        var two = s.label3d.indexOf("\n") >= 0;
        var pl = M.label(s.name + " 홈판", { height: 0.72 });
        pl.position.set(gx, 0.3, plate.depth / 2 + 0.85);
        v.root.add(pl);

        C.materials.forEach(function (m, mi) {
          var w = plate.wells[Math.floor(mi / 2)][mi % 2];
          var wp = [gx + w.position[0], H, w.position[2]];
          // 홈에 용액을 2/3 정도 넣어 둔 상태(색깔 없고 투명)
          w.liquid.visible = true;
          w.liquid.material.color.set(0xb9d3e8);
          w.liquid.material.opacity = 0.4;
          w.liquid.material.depthWrite = false;
          w.liquid.scale.y = 4;
          w.liquid.position.y = H + 0.13;
          var mark = ring(0.72, 0x9aa7b5, 0.035);
          mark.position.set(w.position[0], H + 0.01, w.position[2]);
          plate.group.add(mark);
          v.pickable(w.hole, { sol: s.id, mat: m.id });
          v.pickable(w.liquid, { sol: s.id, mat: m.id });
          // 홈 앞에 물질 이름표(실험 도움판 ②의 물질 이름, 지도서 137쪽)
          var wl = M.label(m.name, { height: 0.36 });
          wl.position.set(wp[0], H + 0.2, wp[2] + 0.9);
          v.root.add(wl);
          v.pickable(wl, { sol: s.id, mat: m.id });
          w.liquidBase = { color: w.liquid.material.color.getHex(), opacity: 0.4 };
          wellObjs[keyOf(s.id, m.id)] = { w: w, wp: wp, content: null, sol: s, mat: m };
        });

        // 용액 병(뒤쪽). 두 용액 모두 색깔 없고 투명 → 병에 색을 칠하지 않고 이름표로만 구분
        var b = M.bottle({ liquid: 0xd5e6f3, liquidOpacity: 0.4, radius: 0.55, height: 1.7 });
        b.position.set(gx, 0, -plate.depth / 2 - 1.5);
        v.root.add(b);
        v.pickable(b, { sol: s.id });
        var br = ring(0.72, 0x2f6fd6);
        br.position.set(gx, 0.03, -plate.depth / 2 - 1.5);
        br.visible = false;
        v.root.add(br);
        var bl = M.label(s.label3d, { height: two ? 1.45 : 0.85 });
        bl.position.set(gx, 3.2 + (two ? 0.3 : 0), -plate.depth / 2 - 1.5);
        v.root.add(bl);

        // 핀셋(홈판마다 따로, 손잡이 색으로 구분 — 색은 화면 구분용)
        var tw = makeTweezers(s.tweezerHex);
        var rest = { pos: [si === 0 ? -8.25 : 8.25, 0.12, 0.2], rotZ: si === 0 ? -Math.PI / 2 : Math.PI / 2 };
        tw.position.fromArray(rest.pos);
        tw.rotation.z = rest.rotZ;
        tw.userData.rest = rest;
        v.root.add(tw);
        var tl = M.label(si === 0 ? "염산용\n핀셋" : "수산화 나트륨\n용액용 핀셋", { height: 0.95, border: s.tweezerHex });
        tl.position.set(rest.pos[0], 1.3, rest.pos[2] + 1.5);
        v.root.add(tl);

        plates[s.id] = { outline: outline, bottleRing: br, tweezers: tw, gx: gx, H: H };
      });
      var TOP = plates.hcl.H;

      function makeTweezers(handleHex) {
        var g = new T.Group();
        var metal = M.material(0xb8c0c8, { metalness: 0.6, roughness: 0.3 });
        var a = new T.Mesh(new T.BoxGeometry(0.06, 1.7, 0.1), metal);
        var b2 = a.clone();
        a.position.set(-0.09, 0.85, 0);
        a.rotation.z = -0.06;
        b2.position.set(0.09, 0.85, 0);
        b2.rotation.z = 0.06;
        var grip = new T.Mesh(new T.BoxGeometry(0.42, 0.55, 0.16), M.material(new T.Color(handleHex), { roughness: 0.5 }));
        grip.position.y = 1.5;
        g.add(a, b2, grip);
        return g;
      }

      // 재료 접시(앞쪽)
      var dishes = {};
      C.materials.forEach(function (m, i) {
        var x = (i - 1.5) * 2.3;
        var z = 5.0;
        var g = new T.Group();
        var dish = new T.Mesh(new T.CylinderGeometry(0.85, 0.75, 0.12, 28), M.material(0xffffff, { roughness: 0.3, transparent: true, opacity: 0.85 }));
        dish.position.y = 0.06;
        g.add(dish);
        var p = makePiece(m.id);
        p.position.y = 0.12;
        g.add(p);
        g.position.set(x, 0, z);
        v.root.add(g);
        v.pickable(g, { mat: m.id });
        var r = ring(0.98, 0x2f6fd6);
        r.position.set(x, 0.04, z);
        r.visible = false;
        v.root.add(r);
        var dl = m.name.indexOf("삶은 ") === 0 ? m.name.replace("삶은 ", "삶은\n") : m.name;
        var l = M.label(dl, { height: dl.indexOf("\n") >= 0 ? 1.25 : 0.72 });
        l.position.set(x, 0.3, z + 1.35);
        v.root.add(l);
        dishes[m.id] = { group: g, ring: r, x: x, z: z };
      });

      // 선택한 홈 표시
      var targetRing = ring(0.8, 0xf2a93b);
      targetRing.position.y = TOP + 0.3;
      targetRing.visible = false;
      v.root.add(targetRing);

      // 홈 안에 들어간 조각(+ 붙어 있는 기포)
      function resetWell(k) {
        var o = wellObjs[k];
        if (o.content) v.discard(o.content);
        o.content = null;
        setCloudy(o, 0);
      }
      // 흐물흐물 칸: 용액이 조금 뿌옇게 흐려지는 모습(지도서 131·134쪽). t: 0(맑음)~1(흐림)
      function setCloudy(o, t) {
        var lm = o.w.liquid.material;
        var base = o.w.liquidBase;
        lm.color.setHex(base.color).lerp(new T.Color(0xeef1f3), t);
        lm.opacity = base.opacity + 0.3 * t;
      }
      function newContent(o) {
        var g = new T.Group();
        g.position.set(o.wp[0], TOP + 0.02, o.wp[2]);
        v.root.add(g);
        o.content = g;
        return g;
      }
      function applyFinal(piece, content, kind, o) {
        var body = piece.userData.body;
        var bs = piece.userData.baseScale;
        if (kind === "fizz") {
          body.scale.copy(bs).multiplyScalar(0.55);
          body.position.y = piece.userData.baseY * 0.55;
          addClingBubbles(content);
        } else if (kind === "melt") {
          body.scale.set(bs.x * 1.1, bs.y * 0.55, bs.z * 1.1);
          body.position.y = piece.userData.baseY * 0.55;
          setOpacity(piece, 0.65);
          setCloudy(o, 1);
        }
      }
      function bubbleMesh(r) {
        return new T.Mesh(new T.SphereGeometry(r, 10, 8), M.material(0xffffff, { transparent: true, opacity: 0.8, roughness: 0.1 }));
      }
      function addClingBubbles(content) {
        [[0.2, 0.12, 0.05], [-0.18, 0.1, 0.12], [0.05, 0.18, -0.2], [-0.05, 0.08, 0.25]].forEach(function (p) {
          var b = bubbleMesh(0.05);
          b.position.fromArray(p);
          content.add(b);
        });
      }
      async function riseBubble(o) {
        var b = bubbleMesh(0.04 + Math.random() * 0.035);
        var ox = o.wp[0] + (Math.random() - 0.5) * 0.5;
        var oz = o.wp[2] + (Math.random() - 0.5) * 0.5;
        b.position.set(ox, TOP + 0.08, oz);
        v.root.add(b);
        await v.moveTo(b, [ox + (Math.random() - 0.5) * 0.15, TOP + 0.75 + Math.random() * 0.3, oz], 520 + Math.random() * 260);
        v.discard(b);
      }

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          Object.keys(plates).forEach(function (id) {
            plates[id].outline.visible = s.sol === id;
            plates[id].bottleRing.visible = s.sol === id;
          });
          Object.keys(dishes).forEach(function (id) {
            dishes[id].ring.visible = s.mat === id;
          });
          if (s.sol && s.mat) {
            var p = wellObjs[keyOf(s.sol, s.mat)].wp;
            targetRing.position.x = p[0];
            targetRing.position.z = p[2];
            targetRing.visible = true;
          } else targetRing.visible = false;
          v.render();
        },
        run: async function (sel) {
          var k = keyOf(sel.sol, sel.mat);
          var o = wellObjs[k];
          var kind = expected(sel.sol, sel.mat).kind;
          var d = dishes[sel.mat];
          var tw = plates[sel.sol].tweezers;
          var rest = tw.userData.rest;
          resetWell(k);
          await v.flyHome(350);

          // 1) 이 홈판 전용 핀셋으로 접시의 조각을 집어 홈에 넣기
          var r0 = tw.rotation.z;
          var p0 = tw.position.clone();
          await v.tween(320, function (t) {
            tw.rotation.z = r0 * (1 - t);
            tw.position.set(p0.x, p0.y + (2.3 - p0.y) * t, p0.z);
          });
          await v.moveTo(tw, [d.x, 2.3, d.z], 420);
          await v.moveTo(tw, [d.x, 0.45, d.z], 240);
          var piece = makePiece(sel.mat);
          piece.position.set(d.x, 0.2, d.z);
          v.root.add(piece);
          tw.attach(piece);
          await v.moveTo(tw, [d.x, 2.4, d.z], 220);
          await v.moveTo(tw, [o.wp[0], 2.4, o.wp[2]], 440);
          await v.moveTo(tw, [o.wp[0], TOP + 0.55, o.wp[2]], 260);
          var content = newContent(o);
          content.attach(piece);
          var from = piece.position.clone();
          await v.tween(200, function (t) {
            piece.position.set(from.x * (1 - t), from.y * (1 - t), from.z * (1 - t));
          });
          // 핀셋은 제자리로, 카메라는 관찰할 홈 쪽으로
          var back = (async function () {
            await v.moveTo(tw, [tw.position.x, 2.3, tw.position.z], 200);
            await v.moveTo(tw, [rest.pos[0], 2.3, rest.pos[2]], 420);
            await v.tween(300, function (t) {
              tw.rotation.z = rest.rotZ * t;
              tw.position.y = 2.3 + (rest.pos[1] - 2.3) * t;
            });
          })();
          await v.focus([o.wp[0], TOP, o.wp[2]], 0.42, 550);

          // 2) 반응(지도서 결과에 따라)
          var body = piece.userData.body;
          var bs = piece.userData.baseScale.clone();
          var by = piece.userData.baseY;
          if (kind === "fizz") {
            // 기포는 넣자마자(실제 시간), 녹아 작아지는 부분은 '빨리 감기(모형)'로 보여 준다
            var rising = [];
            var shrink = v.wait(1100).then(function () {
              ff = fastForward(container, 2400, "fizz");
              return v.tween(2400, function (t) {
                var f = 1 - 0.45 * t;
                body.scale.copy(bs).multiplyScalar(f);
                body.position.y = by * f;
              });
            }).then(function () {
              if (ff) ff.end();
              ff = null;
            });
            for (var i = 0; i < 32; i++) {
              rising.push(riseBubble(o));
              await v.wait(105);
            }
            await Promise.all(rising.concat([shrink]));
            applyFinal(piece, content, "fizz", o);
          } else if (kind === "melt") {
            ff = fastForward(container, 3200, "melt");
            await v.tween(3200, function (t, raw) {
              body.scale.set(bs.x * (1 + 0.1 * t), bs.y * (1 - 0.45 * t), bs.z * (1 + 0.1 * t));
              body.position.y = by * (1 - 0.45 * t);
              body.rotation.y = Math.sin(raw * Math.PI * 6) * 0.08 * (1 - raw);
              setOpacity(piece, 1 - 0.35 * t);
              setCloudy(o, t);
            });
            body.rotation.y = 0;
            if (ff) ff.end();
            ff = null;
            await v.wait(250);
          } else {
            var liq = o.w.liquid;
            await v.tween(900, function (t, raw) {
              var s = 1 + Math.sin(raw * Math.PI * 3) * 0.06 * (1 - raw);
              liq.scale.x = s;
              liq.scale.z = s;
              body.position.y = by + Math.sin(raw * Math.PI * 2) * 0.03 * (1 - raw);
            });
            liq.scale.x = 1;
            liq.scale.z = 1;
            body.position.y = by;
            await v.wait(250);
          }
          await back;
        },
        showInstant: function (sel) {
          var k = keyOf(sel.sol, sel.mat);
          var o = wellObjs[k];
          resetWell(k);
          var content = newContent(o);
          var piece = makePiece(sel.mat);
          content.add(piece);
          applyFinal(piece, content, expected(sel.sol, sel.mat).kind, o);
          v.render();
        },
        clear: function () {
          if (ff) ff.remove();
          ff = null;
          Object.keys(wellObjs).forEach(resetWell);
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          if (ff) ff.remove();
          ff = null;
          v.dispose();
        },
      };
    });
  }

  /* ───────── 3. 기록·분석하기: 표 ───────── */
  function drawResultTable() {
    var flagged = 0;
    S.TableChart.renderMatrix($("result-table"), {
      caption: "용액에 넣은 물질의 변화 (내 기록)",
      rowHeader: "물질 \\ 용액",
      rows: C.materials.map(function (m) {
        return { id: m.id, label: m.name };
      }),
      cols: C.solutions.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        var rec = records.get(keyOf(c.id, r.id));
        if (!rec) return null;
        var wrong = rec.result !== expected(c.id, r.id).text;
        if (wrong) flagged++;
        var b = C.badge[KIND_OF_TEXT[rec.result]] || null;
        return {
          text: (b ? b.icon + " " : "") + rec.result,
          color: b ? b.color : null,
          flag: wrong ? "다시 실험해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ mat: r.id, sol: c.id });
          },
        };
      },
    });
    $("badge-note").textContent =
      "※ 칸 앞의 색 표시와 그림(🫧 기포 발생 · ➖ 변화 없음 · 〰️ 흐물흐물)은 결과 종류를 쉽게 구분하려고 붙인 화면 표시예요. 물질이나 용액의 실제 색이 아니에요.";
    $("time-note").textContent = C.meltNote;
    var note = $("recheck-note");
    note.hidden = flagged === 0;
    note.textContent = flagged ? "🔎 관찰을 다시 확인해 보면 좋은 칸이 " + flagged + "개 있어요. 🔁 버튼을 누르면 그 실험을 다시 해 볼 수 있어요." : "";
  }

  /* ───────── 5. 마치기(결과 저장) ───────── */
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
    var cv = conclude.values();
    return {
      predict: predict.values(),
      records: records.list().map(function (r) {
        return {
          solution: SOL[r.solution] ? SOL[r.solution].name : r.solution,
          material: MAT[r.material] ? MAT[r.material].name : r.material,
          result: r.result,
          recordedAt: r.recordedAt,
        };
      }),
      analysis: analysis,
      conclusion: cv.conclusion,
      extension: { q1: cv.ext1, q2: cv.ext2 },
      curiosity: curiosity.value(),
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
      var correct = C.quiz.filter(function (qq) {
        return q[qq.id] && q[qq.id].correct;
      }).length;
      return ["기록한 실험: " + records.count() + "칸", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
    },
  });
  lesson.restart($("btn-restart"));

  /* ───────── 단계 이동 ───────── */
  var nav = lesson.nav({
    el: $("stage-nav"),
    stages: C.stages,
    prevBtn: $("btn-prev"),
    nextBtn: $("btn-next"),
    gates: {
      experiment: function () {
        return predict.isDone() || "예상하기의 두 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "물질 4가지 × 용액 2가지 = 8칸을 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)";
      },
      conclude: function () {
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
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
      experiment: exp.activate,
      analyze: drawResultTable,
    },
  });
})();
