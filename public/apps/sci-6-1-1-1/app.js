/*
 * app.js — sci-6-1-1-1 "여러 가지 용액을 분류해 볼까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(점적병 6개, 흰 종이, 글씨가 쓰인 흰 종이)  ② 관찰 카드 내용  ③ 분석 표·분류 기준·분류하기 연결  만 만든다.
 * 관찰 결과는 모두 LessonConfig.results(지도서 113, 116쪽 표)에서만 가져온다.
 * 묽은 염산 × 냄새는 안전상 관찰하지 않는 칸(skipCells)이다 — 값을 만들지 않는다.
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
  var MET = {};
  C.methods.forEach(function (m, i) {
    MET[m.id] = Object.assign({ index: i }, m);
  });
  function keyOf(solId, metId) {
    return solId + "|" + metId;
  }
  function expected(solId, metId) {
    var r = C.results[solId];
    return r ? r[metId] || null : null; // 묽은 염산의 냄새는 null(관찰하지 않음)
  }
  function isSkip(solId, metId) {
    return C.skip.cell.sol === solId && C.skip.cell.method === metId;
  }
  function hexToRgba(hex, a) {
    var h = hex.replace("#", "");
    return "rgba(" + [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(",") + "," + a + ")";
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  // 불투명한 용액(opacity 0.9 이상)은 화면에서 완전히 가려 뒤의 글씨가 비치지 않게 한다(모형)
  function alphaOf(look) {
    return look.opacity >= 0.9 ? 1 : look.opacity;
  }
  var obj = function (n) {
    return S.josa(n, "을", "를");
  };

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return keyOf(r.solution, r.method);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var myCrit = renderMyCriterion($("mycrit-root"), C.myCriterion);
  prepareQuizFeedback();
  prepareClassifyFeedback();
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var sorter = S.Sorter.renderRounds($("classify-root"), C.classify, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);

  /* ───────── 3. 기록·분석하기 ⓪: 내 분류 기준 세우기(채점 없음, 저장 키 "mycriterion") ───────── */
  function renderMyCriterion(root, cfg) {
    var values = store.get("mycriterion", {}) || {};
    var min = cfg.minLength || 2;
    var save = S.debounce(function () {
      store.set("mycriterion", values);
    }, 250);
    root.textContent = "";
    var card = el("div", { class: "ss-card" });
    card.appendChild(S.rich(cfg.intro, "p"));
    cfg.questions.forEach(function (q) {
      var id = "mycrit-" + q.id;
      var ta = el("textarea", { id: id, class: "ss-textarea", rows: "2", maxlength: "200", placeholder: q.placeholder, "aria-describedby": id + "-note" });
      ta.value = values[q.id] || "";
      var note = el("p", { class: "ss-help ss-len-note", id: id + "-note", "aria-live": "polite" });
      function drawNote() {
        var n = (values[q.id] || "").trim().length;
        note.textContent = n >= min ? "✔ 잘 적었어요." : min + "글자 이상 적어 주세요. (지금 " + n + "글자)";
        note.classList.toggle("is-ok", n >= min);
      }
      ta.addEventListener("input", function () {
        values[q.id] = ta.value;
        save();
        drawNote();
        lesson.refresh();
      });
      drawNote();
      card.appendChild(el("div", { class: "mycrit-q" }, [el("label", { for: id, class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: q.label }), q.text]), ta, note]));
    });
    root.appendChild(card);
    return {
      isDone: function () {
        return cfg.questions.every(function (q) {
          return (values[q.id] || "").trim().length >= min;
        });
      },
      values: function () {
        var out = {};
        cfg.questions.forEach(function (q) {
          out[q.id] = (values[q.id] || "").trim();
        });
        return out;
      },
    };
  }

  /* 분류 기준 고르기: 첫 오답에는 빠뜨린 보기를 말하지 않고(missFirst), missByAfter번째 확인부터 missBy를 보여 준다.
     틀(quiz.js)은 그릴 때마다 q.missBy[id]를 읽으므로 getter로 시도 횟수에 따라 문구를 바꾼다. (틀 반영 제안: missByAfter 옵션) */
  function prepareQuizFeedback() {
    C.quiz.forEach(function (q) {
      if (!q.missBy || !q.missFirst) return;
      var specific = q.missBy;
      var wrapped = {};
      Object.keys(specific).forEach(function (id) {
        Object.defineProperty(wrapped, id, {
          enumerable: true,
          get: function () {
            var a = store.get("analysis", {}) || {};
            var tries = (a[q.id] && a[q.id].tries) || 0;
            return tries >= (q.missByAfter || 2) ? specific[id] : q.missFirst;
          },
        });
      });
      q.missBy = wrapped;
    });
  }

  /* 분류하기: colorMixup(예: 식초를 '투명한가? → 그렇지 않다'에 넣음)일 때만 첫 오답부터 색깔 관련 안내를 덧붙인다.
     틀(sorter.js)은 그릴 때마다 cfg.hintAfter.tries/text를 읽으므로 getter로 처리한다. (틀 반영 제안: itemBy 옵션) */
  function prepareClassifyFeedback() {
    C.classify.rounds.forEach(function (r) {
      if (!r.colorMixup) return;
      var mix = r.colorMixup;
      var base = r.hintAfter || { tries: 2, text: "" };
      var key = C.classify.id + "." + r.id;
      function state() {
        return store.get(key, {}) || {};
      }
      function mixed() {
        var st = state();
        return !!(st.place && st.place[mix.item] === mix.bin);
      }
      r.hintAfter = {
        get tries() {
          return mixed() ? 1 : base.tries;
        },
        get text() {
          var later = (state().tries || 0) >= base.tries ? base.text : "";
          return mixed() ? (mix.text + (later ? " " + later : "")) : later;
        },
      };
    });
  }

  /* ───────── 2. 실험하기 ───────── */
  function introNode() {
    var box = el("div");
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    return box;
  }
  function bottleIcon(s) {
    var i = el("span", { class: "bottle-icon" + (s.look.clear ? " is-clear" : ""), "aria-hidden": "true" });
    i.style.setProperty("--liq", s.look.clear ? "transparent" : s.look.color);
    return i;
  }
  function methodIcon(m) {
    return el("span", { class: "method-icon", "aria-hidden": "true", text: m.icon });
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

  var allCells = [];
  C.solutions.forEach(function (s) {
    C.methods.forEach(function (m) {
      allCells.push({ sol: s.id, method: m.id }); // 묽은 염산 × 냄새는 skipCells로 자동 제외(23칸)
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
    clearLabel: "🧽 실험대 정리하기",
    clearMessage: "점적병을 제자리에 두었어요. 기록은 그대로 남아 있어요.",
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
        id: "method",
        title: "관찰 방법 고르기",
        short: "관찰 방법",
        options: C.methods.map(function (m) {
          return { id: m.id, label: m.name, icon: function () { return methodIcon(m); } };
        }),
        note: function (sel) {
          if (!sel.method) return null;
          var m = MET[sel.method];
          if (sel.method === "냄새" && sel.sol === C.skip.cell.sol) return null; // 안내 카드가 대신 뜬다
          return m.icon + " " + m.action + (sel.method === "냄새" ? " — 코를 직접 대지 않아요." : "");
        },
      },
    ],
    phases: [{ id: "M", name: "관찰", title: "여러 가지 용액 관찰하기", lead: C.phaseLead, cells: allCells }],
    skipCells: [C.skip],
    doneLead: C.doneLead,
    cellKey: function (sel) {
      return keyOf(sel.sol, sel.method);
    },
    runLabel: function (sel) {
      var n = SOL[sel.sol].name;
      if (sel.method === "색깔") return "▶ " + obj(n) + " 흰 종이에 대어 보기";
      if (sel.method === "투명도") return "▶ " + obj(n) + " 글씨가 쓰인 흰 종이에 대어 보기";
      if (sel.method === "거품") return "▶ " + obj(n) + " 흔들고 5초 기다리기";
      return "▶ 손으로 바람을 일으켜 " + n + "의 냄새 맡기";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 점적병이나 종이를 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 점적병을 눌러 고를 수 있어요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { solution: sel.sol, method: sel.method, result: observed };
    },
    describeRecord: function (r) {
      return SOL[r.solution].name + " · " + MET[r.method].short + " → " + r.result;
    },
    miniTable: {
      title: "기록한 칸 한눈에 보기",
      rows: C.solutions.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      cols: C.methods.map(function (m) {
        return { id: m.id, label: m.icon + " " + (m.id === "거품" ? "거품" : m.short) };
      }),
      sel: function (r, c) {
        return { sol: r.id, method: c.id };
      },
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  /* 관찰 결과를 글로 알려 주는 문장(그림·색만으로 전달하지 않기 위해) — 지도서 표 값에서만 만든다 */
  function seenText(solId, metId) {
    var v = expected(solId, metId);
    if (metId === "투명도") return v === "투명하다" ? "용액 뒤에 있는 글씨가 또렷하게 비쳐 보여요." : "용액에 가려서 뒤에 있는 글씨가 보이지 않아요.";
    if (metId === "거품") return v === "유지된다" ? "5초가 지난 뒤에도 거품이 남아 있어요." : "거품이 금방 사라져서 5초 뒤에는 남아 있지 않아요.";
    if (metId === "냄새") return v === "난다" ? "냄새가 느껴져요." : "아무 냄새도 느껴지지 않아요.";
    return "";
  }

  /* 관찰·기록 카드 */
  function miniScene(s, kind) {
    // kind: "paper"(흰 종이) | "text"(글씨가 쓰인 흰 종이)
    var liq = el("span", { class: "ob-liq" + (s.look.clear ? " is-clear" : "") });
    if (!s.look.clear) liq.style.background = hexToRgba(s.look.color, alphaOf(s.look));
    var bottle = el("span", { class: "ob-bottle", "aria-hidden": "true" }, [liq]);
    var paper = el("span", { class: "ob-paper" + (kind === "text" ? " has-text" : ""), "aria-hidden": "true" }, kind === "text" ? [el("span", { class: "ob-letter", text: "가" })] : []);
    // 색깔 관찰: 용액의 바닥과 뒤에 흰 종이(지도서 113쪽)
    var floor = kind === "paper" ? el("span", { class: "ob-floor", "aria-hidden": "true" }) : null;
    return el("div", { class: "ob-scene" }, [paper, floor, bottle]);
  }
  function observeCard(sel) {
    var s = SOL[sel.sol];
    var m = MET[sel.method];
    var body = el("div", { class: "ob-body" });
    var question;
    if (sel.method === "색깔") {
      question = "흰 종이에 대어 본 " + s.name + "의 색깔은 어떤가요?";
      var sc = miniScene(s, "paper");
      var nameEl = el("p", { class: "ob-name", hidden: true, text: "색 이름: " + expected(sel.sol, "색깔") });
      var btn = el("button", { type: "button", class: "ss-btn ss-btn-ghost small-btn", text: "🎨 색 이름 보기", "aria-pressed": "false" });
      btn.addEventListener("click", function () {
        nameEl.hidden = !nameEl.hidden;
        btn.textContent = nameEl.hidden ? "🎨 색 이름 보기" : "🎨 색 이름 숨기기";
        btn.setAttribute("aria-pressed", String(!nameEl.hidden));
      });
      body.appendChild(el("div", { class: "ob-row" }, [sc, el("div", { class: "ob-side" }, [el("p", { class: "ss-help", text: "흰 종이 앞에서 본 모습(모형)" }), nameEl, btn, el("p", { class: "ss-help", text: "색을 구별하기 어려우면 눌러요." })])]));
    } else if (sel.method === "투명도") {
      question = "글씨가 쓰인 흰 종이에 " + obj(s.name) + " 대어 보았어요. " + s.name + "의 투명한 정도는 어떤가요?";
      body.appendChild(el("div", { class: "ob-row" }, [miniScene(s, "text"), el("p", { class: "ob-seen", text: "👀 " + seenText(sel.sol, "투명도") })]));
    } else if (sel.method === "거품") {
      question = obj(s.name) + " 가볍게 흔들고 5초가 지났어요. 거품은 어떻게 되었나요?";
      body.appendChild(el("p", { class: "ob-seen", text: "⏱ " + seenText(sel.sol, "거품") }));
    } else {
      question = "손으로 바람을 일으켜 " + s.name + "의 냄새를 맡아 보았어요. 냄새가 나나요?";
      body.appendChild(el("p", { class: "ob-seen", text: "👃 " + seenText(sel.sol, "냄새") }));
    }
    return { question: question, body: body, type: "choice", choices: m.choices };
  }

  /* ── 2D 대체 화면: 점적병 줄 + 관찰 자리 ── */
  function build2D(root, ctx) {
    var btns = {};
    var row = el("div", { class: "b2-row", role: "group", "aria-label": "점적병(2D 모형)" });
    C.solutions.forEach(function (s) {
      var liq = el("span", { class: "b2-liq" + (s.look.clear ? " is-clear" : "") });
      if (!s.look.clear) liq.style.background = hexToRgba(s.look.color, Math.max(0.45, s.look.opacity));
      var b = el("button", { type: "button", class: "b2-pick", onclick: function () { ctx.onPick({ sol: s.id }); } }, [
        el("span", { class: "b2-mini", "aria-hidden": "true" }, [liq]),
        el("span", { class: "b2-name", text: s.name }),
      ]);
      btns[s.id] = b;
      row.appendChild(b);
    });
    var paper = el("div", { class: "st-paper", "aria-hidden": "true" }, [el("span", { class: "st-letter", text: "가" })]);
    var liquid = el("span", { class: "st-liq" });
    var foam = el("span", { class: "st-foam", "aria-hidden": "true" });
    var bottle = el("div", { class: "st-bottle", "aria-hidden": "true" }, [el("span", { class: "st-cap" }), liquid, foam]);
    var hand = el("span", { class: "st-hand", "aria-hidden": "true", text: "🖐️" });
    var timer = el("span", { class: "st-timer", "aria-hidden": "true" });
    var caption = el("p", { class: "st-caption", "aria-live": "polite" });
    var floorPaper = el("div", { class: "st-floor", "aria-hidden": "true" }); // 색깔 관찰 때 바닥에 까는 흰 종이
    var stage = el("div", { class: "st-stage" }, [paper, floorPaper, bottle, hand, timer]);
    root.appendChild(el("div", { class: "b2-wrap" }, [row, stage, caption]));

    var disp = null; // 지금 결과가 보이는 칸
    var token = 0;
    function setBottle(solId) {
      var s = SOL[solId];
      bottle.hidden = !s;
      if (!s) return;
      liquid.className = "st-liq" + (s.look.clear ? " is-clear" : "");
      liquid.style.background = s.look.clear ? "" : hexToRgba(s.look.color, alphaOf(s.look));
    }
    function reset(solId) {
      token++;
      disp = null;
      stage.className = "st-stage";
      paper.className = "st-paper";
      foam.textContent = "";
      foam.className = "st-foam";
      hand.className = "st-hand";
      timer.textContent = "";
      bottle.classList.remove("is-shaking");
      setBottle(solId);
      caption.textContent = solId ? SOL[solId].name + " 점적병을 골랐어요." : "점적병을 골라 보세요.";
    }
    function bubbles(n) {
      foam.textContent = "";
      for (var i = 0; i < n; i++) foam.appendChild(el("span", { class: "st-bubble" }));
    }
    function finalState(sel) {
      var v = expected(sel.sol, sel.method);
      setBottle(sel.sol);
      if (sel.method === "색깔") {
        stage.classList.add("at-paper", "with-floor");
        paper.className = "st-paper is-plain is-on";
        caption.textContent = obj(SOL[sel.sol].name) + " 흰 종이에 대어 보았어요.";
      } else if (sel.method === "투명도") {
        stage.classList.add("at-paper");
        paper.className = "st-paper is-on";
        caption.textContent = seenText(sel.sol, "투명도");
      } else if (sel.method === "거품") {
        if (v === "유지된다") bubbles(9);
        else foam.textContent = "";
        timer.textContent = "5초 지남";
        caption.textContent = seenText(sel.sol, "거품");
      } else {
        caption.textContent = "손으로 바람을 일으켜 냄새를 맡았어요. " + seenText(sel.sol, "냄새");
      }
      disp = keyOf(sel.sol, sel.method);
    }
    reset(null);

    return {
      highlight: function (s) {
        Object.keys(btns).forEach(function (id) {
          btns[id].classList.toggle("is-sel", s.sol === id);
          btns[id].setAttribute("aria-pressed", String(s.sol === id));
        });
        if (disp && disp === keyOf(s.sol, s.method)) return;
        reset(s.sol || null);
      },
      run: async function (sel) {
        reset(sel.sol);
        var my = token;
        var v = expected(sel.sol, sel.method);
        if (sel.method === "색깔" || sel.method === "투명도") {
          paper.className = "st-paper" + (sel.method === "색깔" ? " is-plain" : "");
          caption.textContent = sel.method === "색깔" ? "흰 종이 앞으로 점적병을 옮겨요…" : "글씨가 쓰인 흰 종이 앞으로 점적병을 옮겨요…";
          await sleep(200);
          paper.classList.add("is-on");
          if (sel.method === "색깔") stage.classList.add("with-floor");
          await sleep(500);
          stage.classList.add("at-paper");
          await sleep(1300);
        } else if (sel.method === "거품") {
          caption.textContent = "점적병을 가볍게 흔들어요…";
          bottle.classList.add("is-shaking");
          bubbles(v === "유지된다" ? 9 : 6);
          await sleep(800);
          bottle.classList.remove("is-shaking");
          if (v !== "유지된다") foam.classList.add("is-fading"); // 금방 사라짐
          for (var i = 5; i >= 1; i--) {
            if (my !== token) return;
            timer.textContent = "⏱ " + i;
            caption.textContent = "5초 동안 거품을 지켜봐요… " + i;
            await sleep(1000);
          }
        } else {
          caption.textContent = "코를 대지 않고 손으로 바람을 일으켜 냄새를 맡아요…";
          hand.classList.add("is-fanning");
          await sleep(2600);
          hand.classList.remove("is-fanning");
        }
        if (my !== token) return;
        foam.classList.remove("is-fading");
        finalState(sel);
      },
      showInstant: function (sel) {
        reset(sel.sol);
        finalState(sel);
      },
      clear: function () {
        reset(null);
        Object.keys(btns).forEach(function (id) {
          btns[id].classList.remove("is-sel");
        });
      },
      resetView: function () {},
      dispose: function () {
        token++;
      },
    };
  }

  /* ── 3D 화면 ── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 13.8, depth: 10.5, center: [0, 0.9, -0.3] },
      minDistance: 2.5, // 종이 앞 낮은 시점(앞줄 점적병보다 안쪽)으로 다가갈 수 있게
      onPick: function (p) {
        ctx.onPick(p);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var tableMesh = M.table(15, 12, 0xd9c7a3);
      tableMesh.position.z = -0.4;
      v.root.add(tableMesh);
      v.onThemeChange(function (dark) {
        tableMesh.material.color.set(dark ? 0x5b5042 : 0xd9c7a3);
      });
      // 쟁반
      var tray = new T.Mesh(new T.BoxGeometry(11, 0.12, 1.7), M.material(0xc9d3de, { roughness: 0.5 }));
      tray.position.set(0, 0.06, 2.7);
      v.root.add(tray);
      var TRAY = 0.12;

      // 세워 둔 흰 종이 두 장(왼쪽: 흰 종이, 오른쪽: 글씨가 쓰인 흰 종이)
      var PAPER_Z = -3.8;
      var STATION_Z = PAPER_Z + 0.78;
      function paperTexture(withText) {
        var c = document.createElement("canvas");
        c.width = 512;
        c.height = 370;
        var g = c.getContext("2d");
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, c.width, c.height);
        g.strokeStyle = "#d5dbe3";
        g.lineWidth = 6;
        g.strokeRect(3, 3, c.width - 6, c.height - 6);
        if (withText) {
          // 점적병 너비보다 작은 글씨(지도서 112쪽). 병 속 용액 높이에 오도록 아래쪽에 쓴다.
          g.fillStyle = "#1a1a1a";
          g.font = "800 72px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("가", c.width / 2, 300);
        }
        var tex = new T.CanvasTexture(c);
        tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
      }
      function standPaper(x, withText, methodId, name) {
        var g = new T.Group();
        var tex = paperTexture(withText);
        // 흰 종이가 조명 각도 때문에 회색으로 보이지 않도록 자체 밝기(emissive)를 조금 준다
        var sheet = new T.Mesh(
          new T.PlaneGeometry(3.6, 2.6),
          new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.9, side: T.DoubleSide })
        );
        sheet.position.y = 1.3;
        var stand = new T.Mesh(new T.BoxGeometry(3.7, 0.18, 0.5), M.material(0x9aa7b5));
        stand.position.set(0, 0.09, -0.12);
        g.add(sheet, stand);
        g.position.set(x, 0, PAPER_Z);
        v.root.add(g);
        v.pickable(g, { method: methodId });
        var l = M.label(name, { height: 0.5 });
        l.position.set(x, 3.0, PAPER_Z);
        v.root.add(l);
        return g;
      }
      var PAPER_X = { 색깔: -2.6, 투명도: 2.6 };
      standPaper(PAPER_X["색깔"], false, "색깔", "흰 종이");
      standPaper(PAPER_X["투명도"], true, "투명도", "글씨가 쓰인 흰 종이");
      // 색깔 관찰 자리: 용액의 바닥에도 흰 종이를 깐다(지도서 113쪽 "바닥과 뒷부분에 흰 종이"). 점적병이 놓이는 높이(TRAY)에 맞춘 얇은 받침 위 종이(모형)
      var floorSheet = new T.Mesh(
        new T.BoxGeometry(2.6, TRAY, 1.3),
        new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.9 })
      );
      floorSheet.position.set(PAPER_X["색깔"], TRAY / 2, STATION_Z + 0.05);
      v.root.add(floorSheet);

      // 선택 표시 고리
      function ring(radius, color) {
        var m = new T.Mesh(new T.TorusGeometry(radius, 0.06, 10, 40), new T.MeshBasicMaterial({ color: color }));
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        return m;
      }

      // 점적병 6개(앞쪽 쟁반 위에 일렬)
      var BR = 0.5;
      var BH = 1.7;
      var bottles = {};
      C.solutions.forEach(function (s, i) {
        // 불투명한 용액(opacity 0.9 이상)은 3D에서 완전히 가려 뒤의 글씨가 보이지 않게 한다
        var b = M.bottle({ radius: BR, height: BH, liquid: s.look.color, liquidOpacity: Math.max(0.2, alphaOf(s.look)) });
        // 투명한 용액·불투명한 용액이 뒤의 글씨를 비추거나 가리도록 정렬 순서를 둔다
        b.userData.liquid.renderOrder = 2;
        // 조명 때문에 용액 색이 탁하게 보이지 않도록 자체 밝기를 조금 준다(모형 색)
        b.userData.liquid.material.emissive.set(s.look.color);
        b.userData.liquid.material.emissiveIntensity = 0.35;
        b.userData.body.renderOrder = 3;
        var home = [(i - 2.5) * 1.75, TRAY, 2.7];
        b.position.fromArray(home);
        b.userData.home = home;
        v.root.add(b);
        v.pickable(b, { sol: s.id });
        var two = s.label3d.indexOf("\n") >= 0;
        var l = M.label(s.label3d, { height: two ? 0.95 : 0.52 });
        l.position.set(0, (i % 2 ? 3.15 : 2.45) + (two ? 0.2 : 0), 0);
        b.add(l);
        b.userData.label = l;
        var r = ring(0.72, 0x2f6fd6);
        r.position.set(home[0], TRAY + 0.03, home[2]);
        v.root.add(r);
        bottles[s.id] = { obj: b, ring: r, sol: s, bubbles: null };
      });

      // 화면 위에 겹쳐 보이는 안내(초시계·손 부채질) — 3D 모델 대신 단순 아이콘
      var overlay = el("div", { class: "ov3d", "aria-hidden": "true" });
      var ovTimer = el("span", { class: "ov-timer" });
      var ovHand = el("span", { class: "ov-hand", text: "🖐️" });
      var ovText = el("span", { class: "ov-text" });
      overlay.appendChild(ovTimer);
      overlay.appendChild(ovHand);
      overlay.appendChild(ovText);
      container.appendChild(overlay);
      function setOverlay(timer, hand, text) {
        ovTimer.textContent = timer || "";
        ovTimer.hidden = !timer;
        ovHand.hidden = !hand;
        ovHand.classList.toggle("is-fanning", !!hand);
        ovText.textContent = text || "";
        ovText.hidden = !text;
      }
      setOverlay();

      // 거품(병 안 액체 윗면의 작은 공들). 병을 따라 움직이도록 병의 자식으로 둔다.
      function addBubbles(o, n) {
        removeBubbles(o);
        var g = new T.Group();
        var top = BH * 0.64;
        // 흰 용액 위에서도 보이도록 하늘빛이 도는 거품(모형)
        var bubbleMat = M.material(0xdbe9f7, { transparent: true, opacity: 0.95, roughness: 0.15, emissive: 0x8fb3d6, emissiveIntensity: 0.35 });
        for (var i = 0; i < n; i++) {
          var a = (i / n) * Math.PI * 2 * 2.3;
          var rr = 0.12 + (i % 3) * 0.1;
          var m = new T.Mesh(new T.SphereGeometry(0.08 + (i % 4) * 0.02, 12, 10), bubbleMat);
          m.position.set(Math.cos(a) * rr, top + 0.06 + Math.floor(i / 6) * 0.1, Math.sin(a) * rr);
          m.renderOrder = 2; // 유리(3)보다 먼저 그려야 유리 너머로 보인다
          g.add(m);
        }
        o.obj.add(g);
        o.bubbles = g;
        return g;
      }
      function removeBubbles(o) {
        if (o.bubbles) v.discard(o.bubbles);
        o.bubbles = null;
      }

      var disp = null; // 지금 결과가 보이는 칸
      var runToken = 0;
      function homeAll() {
        Object.keys(bottles).forEach(function (id) {
          var o = bottles[id];
          o.obj.position.fromArray(o.obj.userData.home);
          o.obj.rotation.set(0, 0, 0);
          o.obj.userData.label.visible = true;
          removeBubbles(o);
        });
        setOverlay();
        disp = null;
      }
      function stationOf(metId) {
        return [PAPER_X[metId], TRAY, STATION_Z];
      }
      // 종이 앞 낮은 시점(용액을 지나 뒤의 종이가 보이게)
      function lowView(x, ms) {
        var fromT = v.controls.target.clone();
        var fromP = v.camera.position.clone();
        var toT = new T.Vector3(x, 0.75, STATION_Z - 0.2);
        // 카메라는 앞줄 점적병(z≈2.7)보다 안쪽에 둔다(병들이 시야를 가리지 않게)
        var toP = new T.Vector3(x, 1.45, STATION_Z + 5.0);
        return v.tween(ms || 700, function (t) {
          v.controls.target.lerpVectors(fromT, toT, t);
          v.camera.position.lerpVectors(fromP, toP, t);
        });
      }
      // 병을 옆에서 조금 내려다보는 시점(유리 너머 거품·병 모양이 보이게)
      function sideView(p, ms) {
        var fromT = v.controls.target.clone();
        var fromP = v.camera.position.clone();
        var toT = new T.Vector3(p[0], 1.1, p[2]);
        var toP = new T.Vector3(p[0], 2.2, p[2] + 3.6);
        return v.tween(ms || 650, function (t) {
          v.controls.target.lerpVectors(fromT, toT, t);
          v.camera.position.lerpVectors(fromP, toP, t);
        });
      }
      function finalState(sel) {
        var o = bottles[sel.sol];
        var val = expected(sel.sol, sel.method);
        homeAll();
        if (sel.method === "색깔" || sel.method === "투명도") {
          o.obj.position.fromArray(stationOf(sel.method));
          o.obj.userData.label.visible = false; // 낮은 시점에서 이름표가 화면 위로 잘리지 않게(관찰 카드에 이름이 있다)
          if (sel.method === "색깔") o.obj.rotation.z = 0.1;
        } else if (sel.method === "거품") {
          if (val === "유지된다") addBubbles(o, 16);
          setOverlay("5초 지남", false, seenText(sel.sol, "거품"));
        } else {
          o.obj.position.set(o.obj.userData.home[0], 0.6, 4.0);
        }
        disp = keyOf(sel.sol, sel.method);
      }

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          Object.keys(bottles).forEach(function (id) {
            bottles[id].ring.visible = s.sol === id;
          });
          if (disp && disp === keyOf(s.sol, s.method)) {
            v.render();
            return;
          }
          if (disp) homeAll();
          // 고른 점적병이 살짝 떠오른다
          Object.keys(bottles).forEach(function (id) {
            var o = bottles[id].obj;
            var h = o.userData.home;
            if (o.position.x === h[0] && o.position.z === h[2]) o.position.y = h[1] + (s.sol === id ? 0.3 : 0);
          });
          v.render();
        },
        run: async function (sel) {
          var my = ++runToken;
          var o = bottles[sel.sol];
          var b = o.obj;
          var home = b.userData.home;
          var val = expected(sel.sol, sel.method);
          homeAll();
          b.position.y = home[1] + 0.3;
          await v.flyHome(350);
          if (sel.method === "색깔" || sel.method === "투명도") {
            var st = stationOf(sel.method);
            await v.moveTo(b, [home[0], 1.6, home[2]], 250);
            await v.moveTo(b, [st[0], 1.6, st[2]], 550);
            await v.moveTo(b, st, 300);
            b.userData.label.visible = false; // 낮은 시점에서 이름표가 잘리지 않게
            await lowView(st[0], 800);
            if (sel.method === "색깔") {
              await v.tween(350, function (t) {
                b.rotation.z = 0.1 * t; // 종이 앞에서 살짝 기울여 본다
              });
            }
            await v.wait(700);
          } else if (sel.method === "거품") {
            await sideView(home, 650);
            var bub = addBubbles(o, val === "유지된다" ? 16 : 10);
            bub.scale.set(0.01, 0.01, 0.01);
            setOverlay("", false, "가볍게 흔들어요…");
            await v.tween(800, function (t) {
              b.rotation.z = 0.28 * Math.sin(t * Math.PI * 8) * (1 - t);
              b.position.y = home[1] + 0.3 + 0.12 * Math.abs(Math.sin(t * Math.PI * 8));
              var s = Math.min(1, t * 1.6);
              bub.scale.set(s, s, s);
            });
            b.rotation.z = 0;
            b.position.y = home[1] + 0.3;
            var fading = null;
            if (val !== "유지된다") {
              // 거품이 1초 남짓 만에 사라진다
              fading = v.tween(1200, function (t) {
                var s = Math.max(0.01, 1 - t);
                bub.scale.set(s, s, s);
              }).then(function () {
                removeBubbles(o);
              });
            }
            for (var i = 5; i >= 1; i--) {
              if (my !== runToken) return;
              setOverlay("⏱ " + i, false, "5초 동안 거품을 지켜봐요");
              await v.wait(1000);
            }
            if (fading) await fading;
          } else {
            await v.moveTo(b, [home[0], 0.6, 4.0], 450);
            await sideView([home[0], 0, 4.0], 550);
            setOverlay("", true, "코를 대지 않고 손으로 바람을 일으켜 맡아요");
            await v.wait(2600);
          }
          if (my !== runToken) return;
          finalState(sel);
          if (sel.method !== "거품") setOverlay();
          v.render();
        },
        showInstant: function (sel) {
          finalState(sel);
          v.render();
        },
        clear: function () {
          runToken++;
          homeAll();
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          runToken++;
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          v.dispose();
        },
      };
    });
  }

  /* ───────── 3. 기록·분석하기: 표 ───────── */
  var nav = null;
  function drawResultTable() {
    var flagged = 0;
    S.TableChart.renderMatrix($("result-table"), {
      caption: "여러 가지 용액의 관찰 결과 (내 기록)",
      rowHeader: "용액 \\ 관찰",
      rows: C.solutions.map(function (s) {
        return { id: s.id, label: s.name };
      }),
      cols: C.methods.map(function (m) {
        return { id: m.id, label: m.short };
      }),
      emptyText: "아직 기록 없음",
      cell: function (r, c) {
        if (isSkip(r.id, c.id)) return { text: C.skip.short, icon: "🚫", muted: true };
        var rec = records.get(keyOf(r.id, c.id));
        if (!rec) return null;
        var wrong = rec.result !== expected(r.id, c.id);
        if (wrong) flagged++;
        return {
          text: rec.result,
          color: c.id === "색깔" ? C.colorChip[rec.result] || null : null,
          icon: c.id === "색깔" ? null : C.resultIcon[rec.result] || null,
          flag: wrong ? "다시 관찰해 볼까요?" : null,
          onFlag: function () {
            nav.go("experiment");
            exp.select({ sol: r.id, method: c.id });
          },
        };
      },
    });
    var note = $("recheck-note");
    note.hidden = flagged === 0;
    note.textContent = flagged ? "🔎 다시 관찰해 보면 좋은 칸이 " + flagged + "개 있어요. 🔁 버튼을 누르면 그 관찰을 다시 해 볼 수 있어요." : "";
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
        return { solution: r.solution, method: r.method, result: r.result, recordedAt: r.recordedAt };
      }),
      skipped: [{ solution: C.skip.cell.sol, method: C.skip.cell.method, reason: C.skip.short }],
      myCriterion: myCrit.values(),
      analysis: analysis,
      classify: sorter.result(),
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
      var rs = sorter.result();
      var okRounds = C.classify.rounds.filter(function (r) {
        return rs[r.id] && rs[r.id].correct;
      }).length;
      return [
        "관찰하고 기록한 칸: " + exp.progress().done + "/" + exp.progress().total + "칸 (묽은 염산의 냄새는 안전을 위해 관찰하지 않음)",
        "분류 기준 고르기: " + (q.criteria && q.criteria.correct ? "알맞게 고름" : "다시 생각해 보기"),
        "기준에 따라 분류하기: " + okRounds + "/" + C.classify.rounds.length + "가지 기준 완료",
      ];
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
        return predict.isDone() || "예상하기의 두 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "관찰할 " + p.total + "칸을 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "칸)";
      },
      conclude: function () {
        if (!myCrit.isDone()) return "기록·분석하기에서 내 분류 기준과 분류 결과를 " + (C.myCriterion.minLength || 2) + "글자 이상 먼저 적어 주세요.";
        if (!quiz.isDone()) return "기록·분석하기에서 분류 기준을 고르고 '확인하기'를 눌러 주세요.";
        return sorter.isDone() || "기록·분석하기에서 " + C.classify.rounds.length + "가지 기준으로 용액을 알맞게 분류해 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "결론과 발전 질문 2개를 모두 제출해 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: function () {
        return myCrit.isDone() && quiz.isDone() && sorter.isDone();
      },
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
