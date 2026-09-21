/*
 * app.js — sci-6-1-1-2 "지시약으로 여러 가지 용액을 분류해 볼까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(24홈판·점적병·지시약)  ② 관찰 카드의 색 견본  ③ 분석 표·분류·퀴즈 연결  만 만든다.
 * 색 판정은 모두 LessonConfig.results(지도서 표)에서만 가져온다.
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
  var IND = {};
  C.indicators.forEach(function (d, i) {
    IND[d.id] = Object.assign({ index: i }, d);
  });
  function keyOf(solId, indId) {
    return solId + "|" + indId;
  }
  // 지도서 표의 결과 + 화면에 칠할 색(변화 없음이면 용액의 처음 색)과 투명도
  function expected(solId, indId) {
    var r = C.results[solId][indId];
    var look = SOL[solId].look;
    var keep = r.color == null;
    return {
      text: r.text,
      colorName: r.colorName,
      color: keep ? look.color : r.color,
      keep: keep,
      clear: keep && look.clear,
      // 색이 변한 액체는 조금 더 진하게 보이게 한다(불투명한 용액은 그대로 불투명)
      opacity: keep ? look.opacity : Math.max(look.opacity, 0.85),
    };
  }
  // 학생이 고른 관찰 결과를 표에 칠할 색(모형). 그 지시약에서 나올 수 없는 결과면 색 없이 글자만(m4).
  function chipColor(solId, indId, text) {
    var d = IND[indId];
    var col = C.color;
    if (d.phase === "B") return { 붉은색: col.cabbageRed, 푸른색: col.cabbageBlue, 노란색: col.cabbageYellow }[text] || null;
    if (text === "변화 없음") return d.kind === "paper" ? d.color : SOL[solId].look.color;
    if (d.id === "리트머스파랑") return text === "붉은색으로 변함" ? col.litmusRed : null;
    if (d.id === "리트머스빨강") return text === "푸른색으로 변함" ? col.litmusBlue : null;
    return text === "붉은색으로 변함" ? col.phenolRed : null; // 페놀프탈레인
  }
  function hexToRgba(hex, a) {
    var h = hex.replace("#", "");
    return "rgba(" + [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(",") + "," + a + ")";
  }
  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (i) {
      return parseInt(a.substr(i, 2), 16);
    });
    var pb = [1, 3, 5].map(function (i) {
      return parseInt(b.substr(i, 2), 16);
    });
    return (
      "#" +
      pa
        .map(function (v, i) {
          var x = Math.round(v + (pb[i] - v) * t).toString(16);
          return x.length < 2 ? "0" + x : x;
        })
        .join("")
    );
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.solution, r.indicator);
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  // 예전 판(plate: {key:true})에 남은 실험 화면 상태를 새 형식(scene: {key: sel})으로 옮긴다
  (function migrate() {
    var old = store.get("plate", null);
    if (old && typeof old === "object" && !store.get("scene", null)) {
      var sc = {};
      Object.keys(old).forEach(function (k) {
        var p = k.split("|");
        if (SOL[p[0]] && IND[p[1]]) sc[k] = { sol: p[0], ind: p[1] };
      });
      store.set("scene", sc);
    }
    store.remove("plate");
  })();

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var sorter = S.Sorter.render($("classify-root"), C.classify, store, function () {
    drawQuizGate();
    lesson.refresh();
  });
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
  function drawQuizGate() {
    var open = sorter.isDone();
    $("quiz-wrap").hidden = !open;
    $("quiz-locked").hidden = open;
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div");
    C.intro.paragraphs.forEach(function (p) {
      var n = S.rich(typeof p === "string" ? p : p.text, "p");
      if (p.term) n.className = "ss-term";
      box.appendChild(n);
    });
    return box;
  }
  function bottleIcon(s) {
    var i = el("span", { class: "bottle-icon" + (s.look.clear ? " is-clear" : ""), "aria-hidden": "true" });
    i.style.setProperty("--liq", s.look.clear ? "transparent" : s.look.color);
    return i;
  }
  function indIcon(d) {
    var i = el("span", { class: "ind-icon ind-" + d.kind + (d.clear ? " is-clear" : ""), "aria-hidden": "true" });
    i.style.setProperty("--c", d.color);
    return i;
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

  function cellsOf(phase) {
    var out = [];
    C.indicators
      .filter(function (d) {
        return d.phase === phase;
      })
      .forEach(function (d) {
        C.solutions.forEach(function (s) {
          out.push({ sol: s.id, ind: d.id });
        });
      });
    return out;
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🧽 홈판 비우기",
    clearMessage: "홈판을 깨끗이 비웠어요. 기록은 그대로 남아 있어요.",
    factors: [
      {
        id: "sol",
        title: "용액 고르기",
        short: "용액",
        columns: 3,
        options: C.solutions.map(function (s) {
          return { id: s.id, label: s.name, icon: function () { return bottleIcon(s); } };
        }),
      },
      {
        id: "ind",
        title: "지시약 고르기",
        short: "지시약",
        options: C.indicators.map(function (d) {
          return { id: d.id, label: d.name, icon: function () { return indIcon(d); } };
        }),
        note: function (sel) {
          return sel.ind === "붉은양배추" ? "🥬 " + C.cabbageNote : null;
        },
      },
    ],
    phases: ["A", "B"].map(function (ph) {
      return { id: ph, name: C.phases[ph].name, title: C.phases[ph].title, lead: C.phases[ph].lead, cells: cellsOf(ph) };
    }),
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.sol, sel.ind);
    },
    runLabel: function (sel) {
      var d = IND[sel.ind];
      var s = SOL[sel.sol];
      return d.kind === "paper" ? "▶ " + s.name + "에 " + d.name + " 넣기" : "▶ " + s.name + "에 " + d.name + " " + d.drops + "방울 떨어뜨리기";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 병이나 홈을 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 홈이나 이름을 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { phase: IND[sel.ind].phase, solution: sel.sol, indicator: sel.ind, result: observed };
    },
    describeRecord: function (r) {
      return SOL[r.solution].name + " + " + IND[r.indicator].short + " → " + r.result;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.solutions.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      cols: C.indicators.map(function (d) {
        return { id: d.id, label: d.short };
      }),
      sel: function (r, c) {
        return { sol: r.id, ind: c.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  /* 관찰·기록 카드: 넣기 전 → 넣은 뒤 색 견본 + 보기 */
  function swatch(label, color, name, o) {
    o = o || {};
    var chip = el("span", { class: "swatch-chip" + (o.clear ? " is-clear" : "") });
    if (!o.clear) {
      var a = o.opacity == null ? 1 : o.opacity;
      // 투명한 용액은 바둑판 무늬 위에 색을 옅게 얹어 '비쳐 보임'을 나타낸다
      chip.style.backgroundImage =
        a < 0.8
          ? "linear-gradient(" + hexToRgba(color, 0.55 + a * 0.4) + "," + hexToRgba(color, 0.55 + a * 0.4) + "), repeating-conic-gradient(#e7edf3 0 25%, #ffffff 0 50%)"
          : "none";
      if (a < 0.8) chip.style.backgroundSize = "auto, 14px 14px";
      chip.style.backgroundColor = color;
    }
    return el("div", { class: "swatch" }, [chip, el("span", { class: "swatch-label", text: label }), el("span", { class: "swatch-name", text: name })]);
  }
  function observeCard(sel) {
    var d = IND[sel.ind];
    var s = SOL[sel.sol];
    var res = expected(sel.sol, sel.ind);
    var question =
      d.kind === "paper"
        ? s.name + "에 넣은 " + d.name + "의 색깔은 어떻게 되었나요?"
        : d.phase === "A"
        ? s.name + "에 " + S.josa(d.name, "을", "를") + " 떨어뜨린 뒤, 홈 안 용액의 색깔은 어떻게 되었나요?"
        : s.name + "에 " + S.josa(d.name, "을", "를") + " 떨어뜨린 뒤, 홈 안 용액은 무슨 색이 되었나요?";
    var sw = el("div", { class: "swatches" });
    var rowKids;
    if (d.kind === "paper") {
      rowKids = [
        swatch("넣기 전 시험지", d.color, d.colorName),
        el("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
        swatch("용액에 젖은 시험지", res.color, res.colorName),
      ];
    } else {
      rowKids = [
        swatch("떨어뜨린 " + d.short, d.color, d.colorName, { clear: d.clear }),
        el("span", { class: "plus", "aria-hidden": "true", text: "+" }),
        swatch("넣기 전 홈 안 용액", s.look.color, s.look.name, { clear: s.look.clear, opacity: s.look.opacity }),
        el("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
        swatch("넣은 뒤 홈 안 용액", res.color, res.colorName, { clear: res.clear, opacity: res.opacity }),
      ];
    }
    sw.appendChild(el("div", { class: "swatch-row" }, rowKids));
    var names = el("button", { type: "button", class: "ss-btn ss-btn-ghost small-btn", text: "🎨 색 이름 보기", "aria-pressed": "false" });
    names.addEventListener("click", function () {
      var on = sw.classList.toggle("show-names");
      names.textContent = on ? "🎨 색 이름 숨기기" : "🎨 색 이름 보기";
      names.setAttribute("aria-pressed", String(on));
    });
    sw.appendChild(el("div", { class: "swatch-tools" }, [names, el("span", { class: "ss-help", text: "색을 구별하기 어려우면 눌러요." })]));
    return { question: question, body: sw, type: "choice", choices: C.observeChoices[d.phase] };
  }

  /* ── 2D 대체 화면: 24홈판을 위에서 본 모형 ── */
  function build2D(root, ctx) {
    var cells = {};
    var colHeads = {};
    var rowHeads = {};
    var grid = el("div", { class: "plate2d", role: "group", "aria-label": "24홈판(2D 모형)" });
    grid.appendChild(el("div", { class: "p2-corner", text: "지시약 \\ 용액" }));
    C.solutions.forEach(function (s) {
      var h = el("button", { type: "button", class: "p2-col", text: s.name, onclick: function () {
        ctx.onPick({ sol: s.id });
      } });
      colHeads[s.id] = h;
      grid.appendChild(h);
    });
    C.indicators.forEach(function (d) {
      var rh = el("button", { type: "button", class: "p2-row", onclick: function () {
        ctx.onPick({ ind: d.id });
      } }, [indIcon(d), el("span", { text: d.short })]);
      rowHeads[d.id] = rh;
      grid.appendChild(rh);
      C.solutions.forEach(function (s) {
        var liquid = el("span", { class: "p2-liquid" });
        var w = el("button", { type: "button", class: "p2-well", onclick: function () {
          ctx.onPick({ sol: s.id, ind: d.id });
        } }, [liquid]);
        var c = { well: w, liquid: liquid, strip: null, sol: s, ind: d };
        cells[keyOf(s.id, d.id)] = c;
        label(c, null);
        grid.appendChild(w);
      });
    });
    root.appendChild(el("div", { class: "plate2d-wrap" }, [grid, el("p", { class: "p2-caption", text: "24홈판 · 실험 도움판 ① (위에서 본 모형)" })]));

    // 화면 읽기 사용자도 결과를 알 수 있게(m8)
    function label(c, res) {
      var base = c.sol.name + "에 " + c.ind.short;
      c.well.setAttribute(
        "aria-label",
        !res ? base + ", 비어 있음" : base + ", 실험함, " + (c.ind.kind === "paper" ? "젖은 시험지: " : "홈 안 용액: ") + res.colorName
      );
    }
    function setLiquid(c, color, opacity, clear) {
      c.well.classList.add("has-liquid");
      c.liquid.classList.toggle("is-clear", !!clear);
      c.liquid.style.background = clear ? "" : hexToRgba(color, Math.max(0.35, opacity));
    }
    function fill(c) {
      setLiquid(c, c.sol.look.color, c.sol.look.opacity, c.sol.look.clear);
    }
    function putStrip(c, color) {
      var lower = el("span", { class: "p2-strip-lower" });
      var strip = el("span", { class: "p2-strip" }, [el("span", { class: "p2-strip-upper" }), lower]);
      strip.style.setProperty("--c", color);
      lower.style.background = color;
      c.well.appendChild(strip);
      c.strip = { el: strip, lower: lower };
    }
    function dropInto(c, color) {
      var dr = el("span", { class: "p2-drop" });
      dr.style.background = color;
      c.well.appendChild(dr);
      setTimeout(function () {
        if (dr.parentNode) dr.parentNode.removeChild(dr);
      }, 600);
    }
    function reset(c) {
      c.well.classList.remove("has-liquid");
      c.liquid.classList.remove("is-clear");
      c.liquid.style.background = "";
      if (c.strip) c.strip.el.remove();
      c.strip = null;
      label(c, null);
    }
    return {
      highlight: function (s) {
        Object.keys(colHeads).forEach(function (id) {
          colHeads[id].classList.toggle("is-sel", s.sol === id);
        });
        Object.keys(rowHeads).forEach(function (id) {
          rowHeads[id].classList.toggle("is-sel", s.ind === id);
        });
        Object.keys(cells).forEach(function (k) {
          cells[k].well.classList.toggle("is-target", k === keyOf(s.sol, s.ind));
        });
      },
      run: async function (sel) {
        var c = cells[keyOf(sel.sol, sel.ind)];
        var d = IND[sel.ind];
        var res = expected(sel.sol, sel.ind);
        reset(c);
        c.well.classList.add("is-busy");
        await sleep(150);
        for (var i = 0; i < 3; i++) {
          dropInto(c, c.sol.look.color);
          await sleep(260);
        }
        fill(c);
        await sleep(400);
        if (d.kind === "paper") {
          putStrip(c, d.color);
          await sleep(500);
          c.strip.lower.style.background = res.color;
          await sleep(1000);
        } else {
          for (var j = 0; j < d.drops; j++) {
            dropInto(c, d.color);
            await sleep(300);
            if (d.phase === "B") setLiquid(c, mix(c.sol.look.color, d.color, ((j + 1) / d.drops) * 0.6), 0.85, false);
          }
          setLiquid(c, res.color, res.opacity, res.clear);
          await sleep(1000);
        }
        label(c, res);
        c.well.classList.remove("is-busy");
      },
      showInstant: function (sel) {
        var c = cells[keyOf(sel.sol, sel.ind)];
        var d = IND[sel.ind];
        var res = expected(sel.sol, sel.ind);
        reset(c);
        fill(c);
        if (d.kind === "paper") {
          putStrip(c, d.color);
          c.strip.lower.style.background = res.color;
        } else setLiquid(c, res.color, res.opacity, res.clear);
        label(c, res);
      },
      clear: function () {
        Object.keys(cells).forEach(function (k) {
          reset(cells[k]);
        });
      },
      resetView: function () {},
      dispose: function () {},
    };
  }

  /* ── 3D 화면 ── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 20.5, depth: 18.5, center: [-0.2, 0.8, -1.4] },
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var tableMesh = M.table(26, 19, 0xd9c7a3);
      tableMesh.position.z = -0.8;
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });

      var plate = M.wellPlate({ rows: C.indicators.length, cols: C.solutions.length, spacing: 1.9 });
      v.root.add(plate.group);
      var TOP = plate.height;
      var lb = M.label("24홈판 · 실험 도움판 ① (모형)", { height: 0.7 });
      lb.position.set(0, 0.35, plate.depth / 2 + 0.75);
      v.root.add(lb);

      function colX(c) {
        return plate.wells[0][c].position[0];
      }
      function rowZ(r) {
        return plate.wells[r][0].position[2];
      }

      // 선택 표시 고리
      function ring(radius, color) {
        var m = new T.Mesh(new T.TorusGeometry(radius, 0.07, 10, 40), new T.MeshBasicMaterial({ color: color }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        return m;
      }
      var targetRing = ring(0.8, 0xf2a93b);
      targetRing.position.y = TOP + 0.06;
      v.root.add(targetRing);

      // 지시약 줄 이름표(왼쪽)
      C.indicators.forEach(function (d, r) {
        var l = M.label(d.short, { height: 0.72, border: d.clear ? "#9aa7b5" : d.color });
        l.position.set(-plate.width / 2 - 2.3, 0.5, rowZ(r));
        v.root.add(l);
      });

      // 점적병(뒤쪽, 용액 열마다 하나) — 병 속 용액도 앞 차시 관찰 모습(색깔·투명도)으로
      var bottles = {};
      C.solutions.forEach(function (s, c) {
        var b = M.bottle({ liquid: s.look.color, liquidOpacity: Math.max(0.4, s.look.opacity) });
        var home = [colX(c), 0, -plate.depth / 2 - 1.6];
        b.position.fromArray(home);
        b.userData.home = home;
        v.root.add(b);
        v.pickable(b, { sol: s.id });
        var r = ring(0.6, 0x2f6fd6);
        r.position.set(home[0], 0.03, home[2]);
        v.root.add(r);
        // 이름표가 겹치지 않게 한 칸씩 높이를 엇갈려 둔다
        var two = s.label3d.indexOf("\n") >= 0;
        var l = M.label(s.label3d, { height: two ? 1.35 : 0.78 });
        l.position.set(home[0], (c % 2 ? 4.3 : 3.1) + (two ? 0.3 : 0), home[2]);
        v.root.add(l);
        bottles[s.id] = { obj: b, ring: r };
      });

      // 지시약(오른쪽, 줄마다 하나)
      var inds = {};
      var IX = plate.width / 2 + 1.7;
      C.indicators.forEach(function (d, r) {
        var obj =
          d.kind === "paper"
            ? M.paperBox(d.color)
            : M.bottle({ liquid: d.color, liquidOpacity: d.clear ? 0.45 : 0.9, radius: 0.42, height: 1.25, cap: 0x8a5a2b });
        obj.position.set(IX, 0, rowZ(r));
        v.root.add(obj);
        v.pickable(obj, { ind: d.id });
        var rg = ring(0.8, 0x2f6fd6);
        rg.position.set(IX, 0.03, rowZ(r));
        v.root.add(rg);
        inds[d.id] = { obj: obj, ring: rg };
      });
      // 핀셋(오른쪽 앞, 눕혀 둠)
      var tw = M.tweezers();
      tw.rotation.z = Math.PI / 2;
      tw.position.set(IX + 0.6, 0.08, plate.depth / 2 + 0.2);
      v.root.add(tw);

      // 홈(탭하면 그 칸 선택)
      var wellObjs = {};
      C.indicators.forEach(function (d, r) {
        C.solutions.forEach(function (s, c) {
          var w = plate.wells[r][c];
          v.pickable(w.hole, { sol: s.id, ind: d.id });
          v.pickable(w.liquid, { sol: s.id, ind: d.id });
          wellObjs[keyOf(s.id, d.id)] = { w: w, strip: null, sol: s };
        });
      });

      function setLiquid(o, color, opacity) {
        o.w.liquid.material.color.set(color);
        o.w.liquid.material.opacity = opacity;
      }
      function resetWell(k) {
        var o = wellObjs[k];
        o.w.liquid.visible = false;
        o.w.liquid.scale.set(1, 1, 1);
        setLiquid(o, o.sol.look.color, o.sol.look.opacity);
        if (o.strip) {
          v.discard(o.strip);
          o.strip = null;
        }
      }
      function placeStrip(o, color) {
        var st = M.paperStrip(color);
        st.position.set(o.w.position[0] + 0.1, TOP - 0.15, o.w.position[2]);
        st.rotation.z = -0.18;
        v.root.add(st);
        o.strip = st;
        return st;
      }

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          Object.keys(bottles).forEach(function (id) {
            bottles[id].ring.visible = s.sol === id;
          });
          Object.keys(inds).forEach(function (id) {
            inds[id].ring.visible = s.ind === id;
          });
          if (s.sol && s.ind) {
            var p = wellObjs[keyOf(s.sol, s.ind)].w.position;
            targetRing.position.x = p[0];
            targetRing.position.z = p[2];
            targetRing.visible = true;
          } else targetRing.visible = false;
          v.render();
        },
        run: async function (sel) {
          var solId = sel.sol;
          var indId = sel.ind;
          var k = keyOf(solId, indId);
          var o = wellObjs[k];
          var d = IND[indId];
          var look = SOL[solId].look;
          var res = expected(solId, indId);
          var wp = o.w.position;
          resetWell(k);
          await v.flyHome(350);

          // 1) 점적병을 들어 홈 위에서 거꾸로 기울여 용액 넣기
          var b = bottles[solId].obj;
          var home = b.userData.home;
          var H = b.userData.height;
          await v.moveTo(b, [home[0], 1.2, home[2]], 160);
          await v.moveTo(b, [wp[0], TOP + 0.7 + H, wp[2]], 300);
          await v.tween(240, function (t) {
            b.rotation.x = Math.PI * t;
          });
          for (var i = 0; i < 2; i++) {
            var drop = M.drop(look.color);
            drop.position.set(wp[0], TOP + 0.65, wp[2]);
            v.root.add(drop);
            await v.moveTo(drop, [wp[0], TOP + 0.05, wp[2]], 150);
            v.discard(drop);
            if (i === 0) {
              o.w.liquid.visible = true;
              o.w.liquid.scale.set(0.4, 1, 0.4);
            }
            var sc = 0.4 + 0.3 * (i + 1);
            o.w.liquid.scale.set(sc, 1, sc);
          }
          await v.tween(200, function (t) {
            b.rotation.x = Math.PI * (1 - t);
          });
          // 병이 돌아가는 동안 관찰할 홈 쪽으로 카메라가 다가간다
          var backHome = v.moveTo(b, [home[0], 1.2, home[2]], 360).then(function () {
            return v.moveTo(b, home, 180);
          });
          await v.focus([wp[0], TOP, wp[2]], 0.55, 550);
          await backHome;

          // 2) 지시약 넣기
          var ip = inds[indId].obj.position;
          if (d.kind === "paper") {
            // 핀셋으로 시험지를 집어 홈에 넣기
            var carrier = new T.Group();
            var st = M.paperStrip(d.color);
            var tz = M.tweezers();
            tz.position.y = 1.0;
            carrier.add(st, tz);
            carrier.position.set(ip.x, 0.4, ip.z);
            v.root.add(carrier);
            await v.moveTo(carrier, [ip.x, 2.6, ip.z], 180);
            await v.moveTo(carrier, [wp[0] + 0.1, 2.6, wp[2]], 340);
            await v.moveTo(carrier, [wp[0] + 0.1, TOP - 0.15, wp[2]], 300);
            v.root.attach(st);
            st.rotation.z = -0.18;
            o.strip = st;
            await v.moveTo(carrier, [wp[0] + 0.1, 3, wp[2]], 220);
            v.discard(carrier);
            // 용액에 젖은 아래쪽 색이 서서히 바뀜(바뀌지 않으면 그대로)
            await v.fadeColor(st.userData.lower, res.color, 800);
            await v.wait(150);
          } else {
            // 스포이트로 지시약 떨어뜨리기
            var pip = M.pipette(d.color);
            pip.position.set(ip.x, 1.3, ip.z);
            v.root.add(pip);
            await v.moveTo(pip, [ip.x, 2.8, ip.z], 180);
            await v.moveTo(pip, [wp[0], TOP + 0.9, wp[2]], 340);
            for (var j = 0; j < d.drops; j++) {
              var dr = M.drop(d.color);
              dr.position.set(wp[0], TOP + 0.85, wp[2]);
              v.root.add(dr);
              await v.moveTo(dr, [wp[0], TOP + 0.06, wp[2]], 140);
              v.discard(dr);
              if (d.phase === "B") setLiquid(o, mix(look.color, d.color, ((j + 1) / d.drops) * 0.6), Math.max(look.opacity, 0.7));
              await v.wait(50);
            }
            var back = v.moveTo(pip, [ip.x, 2.8, ip.z], 420);
            var fromOp = o.w.liquid.material.opacity;
            await Promise.all([
              v.fadeColor(o.w.liquid.material, res.color, 800),
              v.tween(800, function (t) {
                o.w.liquid.material.opacity = fromOp + (res.opacity - fromOp) * t;
              }),
            ]);
            await back;
            v.discard(pip);
            await v.wait(150);
          }
        },
        showInstant: function (sel) {
          var k = keyOf(sel.sol, sel.ind);
          var o = wellObjs[k];
          var res = expected(sel.sol, sel.ind);
          resetWell(k);
          o.w.liquid.visible = true;
          if (IND[sel.ind].kind === "paper") placeStrip(o, IND[sel.ind].color).userData.lower.color.set(res.color);
          else setLiquid(o, res.color, res.opacity);
          v.render();
        },
        clear: function () {
          Object.keys(wellObjs).forEach(resetWell);
          v.render();
        },
        resetView: v.resetView,
        dispose: v.dispose,
      };
    });
  }

  /* ───────── 3. 기록·분석하기: 표 ───────── */
  function drawResultTable() {
    var flagged = 0;
    S.TableChart.renderMatrix($("result-table"), {
      caption: "지시약에 따른 용액의 색깔 변화 (내 기록)",
      rowHeader: "용액 \\ 지시약",
      rows: C.solutions.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      cols: C.indicators.map(function (d) {
        return { id: d.id, label: d.name };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        var rec = records.get(keyOf(r.id, c.id));
        if (!rec) return null;
        var wrong = rec.result !== expected(r.id, c.id).text;
        if (wrong) flagged++;
        return {
          text: rec.result,
          color: chipColor(r.id, c.id, rec.result),
          flag: wrong ? "다시 실험해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ sol: r.id, ind: c.id });
          },
        };
      },
    });
    var note = $("recheck-note");
    note.hidden = flagged === 0;
    note.textContent = flagged ? "🔎 관찰을 다시 확인해 보면 좋은 칸이 " + flagged + "개 있어요. 🔁 버튼을 누르면 그 실험을 다시 해 볼 수 있어요." : "";
  }

  /* ───────── 5. 마치기(결과 저장) ───────── */
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
    var cv = conclude.values();
    return {
      predict: predict.values(),
      records: records.list().map(function (r) {
        return { phase: r.phase, solution: r.solution, indicator: r.indicator, result: r.result, recordedAt: r.recordedAt };
      }),
      classify: sorter.result(),
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
        return q[qq.id].correct;
      }).length;
      return [
        "기록한 실험: " + records.count() + "칸",
        "용액 분류: " + (sorter.isDone() ? "산성 용액과 염기성 용액으로 알맞게 나눔" : "아직 확인하지 않음"),
        "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘",
      ];
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
        return (
          exp.allDone() ||
          "실험 A(" + exp.phaseTotal("A") + "칸)와 실험 B(" + exp.phaseTotal("B") + "칸)를 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)"
        );
      },
      conclude: function () {
        if (!sorter.isDone()) return "기록·분석하기에서 여섯 가지 용액을 산성 용액과 염기성 용액으로 먼저 분류해 주세요.";
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "결론과 발전 질문 2개를 모두 제출해 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: function () {
        return sorter.isDone() && quiz.isDone();
      },
      conclude: conclude.isDone,
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: exp.activate,
      analyze: function () {
        drawResultTable();
        drawQuizGate();
      },
    },
  });
  drawQuizGate();
})();
