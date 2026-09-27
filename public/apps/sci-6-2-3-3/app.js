/*
 * app.js — sci-6-2-3-3 "전자석의 성질이 궁금해!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(둥근 머리 볼트 + 에나멜선 코일로 만든 전자석, 전지 끼우개·스위치·집게 전선, 둥근 철 고리, 나침반 2개)
 *   ② 관찰 카드(실험 1·3은 보기 고르기, 실험 2는 값 패널 + 기록하기 — 타이핑 없음)
 *   ③ 분석 표 2개, 정리하기의 궁금한 점 한 줄  만 만든다.
 *
 * 과학 규칙(spec.md 1·5절, 개정 1):
 *   - 실험 1: 스위치를 열었을 때는 둥근 철 고리가 붙지 않고, 닫았을 때만 붙는다(전기가 흐를 때만 자석의 성질).
 *   - 실험 2: 전지 1개 → 고리 4개, 전지 2개 직렬연결 → 고리 8개(교과서·실험관찰 예시 값, 자연수).
 *   - 실험 3: 바꾸기 전 왼쪽 N극·오른쪽 S극 / 바꾼 뒤 왼쪽 S극·오른쪽 N극.
 *     나침반 바늘의 빨간 끝(N극)은 전자석의 S극 쪽으로 끌린다(3학년 '자석의 이용' 사전 지식).
 *   - 전류에 의한 자기장 개념·자기장 화살표·전류 방향 표시를 쓰지 않는다(지도상 유의점).
 *   - 전지의 (+)극과 전자석의 N극을 연결해 설명하지 않는다(오개념 방지) — 극은 나침반으로만 판단한다.
 *   - 전자석을 쓰는 예(다음 차시)·전기 절약(다다음 차시)은 말하지 않는다.
 * 3D와 2D는 같은 상태(st)와 같은 순서(sequence)를 쓰고 그리는 방법만 다르다.
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

  var CELL = {};
  C.cells.forEach(function (c) {
    CELL[c.id] = c;
  });
  var PHASE = {};
  C.phases.forEach(function (p) {
    PHASE[p.id] = p;
  });
  function cellsOf(expId) {
    return C.cells.filter(function (c) {
      return c.exp === expId;
    });
  }
  function ringsOf(c) {
    return C.ringCounts[c.battery] || 0;
  }
  function poleOf(c) {
    return C.poles[c.dir][c.pos];
  }
  var MAX_RINGS = 8;

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.cell;
    },
    onChange: function () {
      lesson.refresh();
    },
  });
  function recOf(id) {
    return records.get(id) || null;
  }

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(결론 + 선택 한 줄) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  $("know-card").appendChild(S.rich(C.knowCard, "span"));

  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, function () {
    lesson.refresh();
    showFinish();
  });
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
  // 궁금한 점은 선택 입력 한 줄
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
  function showFinish() {
    $("finish-wrap").hidden = !conclude.isDone();
  }
  showFinish();

  /* ───────── 2. 실험하기 ───────── */
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

  var sceneAt = store.get("sceneAt", null); // 실험 화면에 결과가 남아 있는 칸 id
  function setSceneAt(id) {
    sceneAt = id || null;
    store.set("sceneAt", sceneAt);
  }
  var liveResultAt = null; // 이번에 실험을 마쳐 화면에 결과가 떠 있는 칸(새로고침하면 사라진다 — 3D↔2D 전환 때만 쓴다)
  var checkTries = {}; // 관찰 카드에서 틀린 횟수
  var shots = {}; // 실험 1의 두 장면 사진(스위치 열림 / 닫힘)

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: paragraphs(C.intro.paragraphs),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🔌 실험 전 모습으로",
    clearMessage: "실험 전 모습(스위치 열림)으로 되돌렸어요. 기록은 그대로 남아 있어요.",
    runTitle: "실험하기",
    // 실험 1은 실행 버튼이 스위치 여닫기 토글이다(누르는 동안 여는 중/닫는 중)
    busyLabel: function (sel) {
      var c = CELL[sel.opt];
      if (c && c.exp === "S") return sceneSwitchClosed() ? "⏳ 스위치를 여는 중…" : "⏳ 스위치를 닫는 중…";
      return "⏳ 실험하는 중… 잘 지켜보세요 👀";
    },
    factors: [
      {
        id: "exp",
        title: "실험 고르기",
        short: "실험",
        phaseTag: false,
        options: C.phases.map(function (p) {
          return { id: p.id, label: p.expLabel, icon: expIcon(p.id) };
        }),
      },
      {
        id: "opt",
        title: "조건 고르기",
        short: "조건",
        columns: 2,
        phaseTag: false,
        options: C.cells.map(function (c) {
          return { id: c.id, label: c.label };
        }),
        visible: function (oid, sel) {
          return !!sel.exp && CELL[oid].exp === sel.exp;
        },
        note: function (sel) {
          return sel.exp ? null : "먼저 위에서 실험을 골라요.";
        },
      },
    ],
    phases: C.phases.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        lead: p.lead,
        cells: cellsOf(p.id).map(function (c) {
          return { exp: p.id, opt: c.id };
        }),
      };
    }),
    doneLead: "7칸을 모두 기록했어요. '다음 단계'로 가서 내 기록을 살펴봐요. 다시 보고 싶은 실험은 언제든 다시 해도 돼요.",
    cellKey: function (sel) {
      return sel.opt;
    },
    runLabel: function (sel) {
      var c = CELL[sel.opt];
      // 실험 1(2026-09-27 사용자): 스위치가 열려 있으면 '스위치 닫기', 닫혀 있으면 '스위치 열기' — 누를 때마다 여닫는다
      // 버튼 앞 아이콘은 글자가 아니라 스위치 기호(CSS .sw-run::before — 틀이 글자를 textContent로 다시 써도 남는다, 2026-09-27 사용자)
      markSwitchRun(c.exp === "S");
      if (c.exp === "S") return sceneSwitchClosed() ? "스위치 열기" : "스위치 닫기";
      if (c.exp === "D" && c.dir === curDir() && sceneClosed()) return "▶ " + (c.pos === "left" ? "왼쪽" : "오른쪽") + " 나침반 살펴보기";
      return c.run;
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      // 3D 화면을 붙일 때마다 틀이 읽는다. 좁은 화면(폭 640px 이하 — 틀이 "페이지를 위아래로…"를 덧붙이는 폭)에서는 짧게 해
      // 안내 줄이 두 줄 안에 들어가게 한다(폭 360~375px에서 세 줄이면 장면 아래쪽의 전지·스위치를 가림). 처음 방향은 아래 '🎥 처음 방향으로' 버튼으로.
      get tip3D() {
        var narrow = !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
        return narrow
          ? "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 물체를 눌러도 돼요"
          : "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 스위치·전지·나침반을 눌러도 돼요";
      },
      tip2D: "2D 화면(모형, 옆에서 본 모습)이에요. 나침반은 위에서 본 모습으로 따로 보여 줘요. 스위치·전지·나침반을 눌러도 돼요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      var c = CELL[sel.opt];
      var rec = { cell: c.id, exp: c.exp };
      if (c.exp === "B") {
        rec.battery = c.battery;
        rec.rings = ringsOf(c);
      } else {
        rec.observed = observed;
        rec.tries = checkTries[c.id] || 0;
        if (c.exp === "D") {
          rec.dir = c.dir;
          rec.pos = c.pos;
        }
      }
      return rec;
    },
    describeRecord: function (r) {
      var c = CELL[r.cell];
      if (c.exp === "B") return c.short + " → 고리 " + r.rings + "개";
      return c.short + " → " + r.observed;
    },
    extras: [safety],
    onChange: lesson.refresh,
  });

  // 실험 아이콘(색이 아니라 모양으로도 구분: 스위치 / 전지 / 나침반)
  function expIcon(id) {
    return function () {
      var NS = "http://www.w3.org/2000/svg";
      var s = document.createElementNS(NS, "svg");
      s.setAttribute("viewBox", "0 0 28 28");
      s.setAttribute("class", "exp-icon");
      s.setAttribute("aria-hidden", "true");
      function n(tag, a) {
        var e = document.createElementNS(NS, tag);
        Object.keys(a).forEach(function (k) {
          e.setAttribute(k, a[k]);
        });
        s.appendChild(e);
      }
      if (id === "S") {
        n("rect", { x: 3, y: 16, width: 22, height: 5, rx: 2, class: "ei-base" });
        n("line", { x1: 6, y1: 16, x2: 21, y2: 7, class: "ei-lever" });
        n("circle", { cx: 6, cy: 16, r: 2.6, class: "ei-dot" });
        n("circle", { cx: 22, cy: 16, r: 2.6, class: "ei-dot" });
      } else if (id === "B") {
        n("rect", { x: 3, y: 9, width: 10, height: 11, rx: 2, class: "ei-cell" });
        n("rect", { x: 15, y: 9, width: 10, height: 11, rx: 2, class: "ei-cell" });
        n("rect", { x: 6, y: 6, width: 4, height: 3, class: "ei-nub" });
        n("rect", { x: 18, y: 6, width: 4, height: 3, class: "ei-nub" });
      } else {
        n("circle", { cx: 14, cy: 14, r: 10, class: "ei-dial" });
        n("polygon", { points: "14,5 11,15 17,15", class: "ei-needle-n" });
        n("polygon", { points: "14,23 11,13 17,13", class: "ei-needle-s" });
      }
      return s;
    };
  }

  /* ── 관찰·기록 카드 ── */
  function photoNode() {
    try {
      return curView && curView.photo ? curView.photo() : null;
    } catch (e) {
      return null;
    }
  }
  function figure(node, caption) {
    if (!node) return null;
    return el("figure", { class: "obs-photo" }, [node, el("figcaption", { class: "ss-help", text: caption })]);
  }
  // 나침반 확대 그림(위에서 본 모습). angle: 0 = 북(위), +π/2 = 왼쪽, -π/2 = 오른쪽
  function compassSVG(angle, pos) {
    var NS = "http://www.w3.org/2000/svg";
    function n(tag, a, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(a || {}).forEach(function (k) {
        e.setAttribute(k, a[k]);
      });
      if (text != null) e.textContent = text;
      return e;
    }
    var W = 260,
      H = 200,
      cx = pos === "left" ? 95 : 165,
      cy = 105,
      R = 68;
    var svg = n("svg", {
      viewBox: "0 0 " + W + " " + H,
      class: "comp-svg",
      role: "img",
      "aria-label": "위에서 본 " + (pos === "left" ? "왼쪽" : "오른쪽") + " 나침반(모형). 빨간 끝은 나침반 바늘의 N극이에요.",
    });
    // 전자석(회색 막대) — 왼쪽 나침반이면 오른쪽에, 오른쪽 나침반이면 왼쪽에 있다
    var barX = pos === "left" ? 196 : 8;
    svg.appendChild(n("rect", { x: barX, y: 86, width: 56, height: 38, rx: 8, class: "comp-bar" }));
    svg.appendChild(n("text", { x: barX + 28, y: 70, "text-anchor": "middle", class: "comp-lbl" }, "전자석"));
    // 나침반 판
    svg.appendChild(n("circle", { cx: cx, cy: cy, r: R, class: "comp-dial" }));
    svg.appendChild(n("text", { x: cx, y: cy - R + 18, "text-anchor": "middle", class: "comp-n" }, "북"));
    // 바늘: 빨강(N) 끝 방향 = (-sin a, -cos a)
    var ux = -Math.sin(angle),
      uy = -Math.cos(angle);
    var L = R - 14;
    var px = -uy,
      py = ux; // 수직 방향
    function tri(dx, dy, cls) {
      var p = [cx + dx * L, cy + dy * L, cx + px * 11 - dx * 6, cy + py * 11 - dy * 6, cx - px * 11 - dx * 6, cy - py * 11 - dy * 6];
      return n("polygon", { points: p[0] + "," + p[1] + " " + p[2] + "," + p[3] + " " + p[4] + "," + p[5], class: cls });
    }
    svg.appendChild(tri(-ux, -uy, "comp-needle-s"));
    svg.appendChild(tri(ux, uy, "comp-needle-n"));
    // 바늘 끝 글자: 나침반 판 안쪽, 그 바늘 쪽 절반의 위(빨강)·아래(파랑)에 — 그림 가장자리에서 잘리거나 판 테두리·바늘 끝을
    // 가리지 않게(글자 폭 약 64px, 전에는 바늘 끝 바깥에 두어 왼쪽 나침반의 '빨강(N극)'이 그림 왼쪽 끝에서 잘렸다). 세로 바늘은 오른쪽에.
    function tag(dx, dy, text, cls, above) {
      var x, y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        x = cx + dx * 28;
        y = above ? cy - 18 : cy + 30;
      } else {
        x = cx + 42;
        y = cy + dy * (L - 6) + 5;
      }
      return n("text", { x: Math.max(36, Math.min(W - 36, x)), y: y, "text-anchor": "middle", class: cls }, text);
    }
    svg.appendChild(tag(-ux, -uy, "파랑(S극)", "comp-tag-s", false));
    svg.appendChild(n("circle", { cx: cx, cy: cy, r: 6, class: "comp-pin" }));
    svg.appendChild(tag(ux, uy, "빨강(N극)", "comp-tip", true));
    return svg;
  }

  function observeCard(sel) {
    var c = CELL[sel.opt];
    if (c.exp === "S") {
      // 두 사진은 학생이 여닫을 때마다 지금 시점 그대로 다시 찍은 가장 최근 모습(열림·닫힘)이다(sequence).
      // 사진 설명에는 고리가 붙었는지 같은 결과 말을 넣지 않는다(학생이 사진과 장면에서 보고 고른다).
      var body = el("div", { class: "obs-body" }, [
        el("div", { class: "shot-row" }, [
          figure(shots.open, "① 스위치를 열었을 때"),
          figure(shots.closed, "② 스위치를 닫았을 때"),
        ]),
        el("p", { class: "ss-help", text: "'스위치 닫기'·'스위치 열기'를 여러 번 눌러 다시 살펴봐도 돼요." }),
      ]);
      return {
        question: C.switchCheck.question,
        body: body,
        type: "choice",
        choices: C.switchCheck.choices,
        check: function (observed, ctx) {
          checkTries[c.id] = ctx.tries;
          if (!swEverClosed) return "먼저 '스위치 닫기'를 눌러 보세요.";
          if (observed === C.switchCheck.answer) return { ok: true, message: C.switchCheck.correct };
          return "🤔 " + C.switchCheck.wrong;
        },
        checkLabel: "✔️ 확인하기",
        // '다시 실험해 보기' 버튼은 두지 않는다 — 실행 버튼(스위치 닫기/열기)이 곧 다시 해 보는 버튼이다
      };
    }
    if (c.exp === "B") {
      var n = ringsOf(c);
      var chips = el("div", { class: "ring-chips", role: "img", "aria-label": "붙은 둥근 철 고리 " + n + "개" });
      for (var i = 0; i < n; i++) chips.appendChild(el("span", { class: "ring-chip", "aria-hidden": "true" }));
      var body2 = el("div", { class: "obs-body" }, [
        figure(photoNode(), "📷 방금 한 실험 화면(모형)"),
        el("div", { class: "val-panel", role: "group", "aria-label": "값 패널" }, [
          el("span", { class: "val-cond", text: "🔋 " + c.short }),
          el("span", { class: "val-main" }, [
            el("span", { class: "val-label", text: "붙은 둥근 철 고리" }),
            el("strong", { class: "val-num", text: String(n) }),
            el("span", { class: "val-unit", text: "개" }),
          ]),
        ]),
        chips,
        el("p", { class: "ss-help", text: "고리는 매번 새 둥근 철 고리로 잰 것처럼 보여 줘요(모형)." }),
      ]);
      return {
        question: "붙은 둥근 철 고리 개수를 확인하고 '기록하기'를 눌러요.",
        body: body2,
        type: "numeric",
        fields: [], // 타이핑 없음: 값이 바로 보이고 '기록하기'가 켜진다
      };
    }
    var ang = needleAngle(c.dir);
    // 2026-09-27 사용자: "나침반 바늘의 빨간 끝은 N극이에요. 자석의 다른 극끼리 끌어당겨요." 문장은 지운다
    // (무엇을 기록하는지 오히려 헷갈리게 함). 나침반 그림의 빨강(N극)·파랑(S극) 표시와 그림 설명은 그대로 둔다.
    var body3 = el("div", { class: "obs-body" }, [
      figure(photoNode(), "📷 방금 한 실험 화면(모형)"),
      el("figure", { class: "comp-fig" }, [compassSVG(ang, c.pos), el("figcaption", { class: "ss-help", text: "🔍 " + C.directions.filter(function (d) { return d.id === c.dir; })[0].name + " · " + (c.pos === "left" ? "왼쪽" : "오른쪽") + " 나침반을 위에서 본 모습(모형)" })]),
    ]);
    return {
      question: (c.pos === "left" ? "왼쪽" : "오른쪽") + " 나침반의 바늘을 보고, 전자석의 끝이 무슨 극인지 골라 봅시다.", // 2026-09-26 사용자 문구
      body: body3,
      type: "choice",
      choices: C.poleCheck.choices,
      check: function (observed, ctx) {
        checkTries[c.id] = ctx.tries;
        if (observed === poleOf(c)) return { ok: true, message: C.poleCheck.correct };
        return "🤔 " + C.poleCheck.wrong;
      },
      checkLabel: "✔️ 확인하기",
      retryLabel: "🔁 다시 실험해 보기",
    };
  }

  /* ── 지금 고른 조건을 새로고침 뒤에도 되살린다(앱 전용, 공통 틀은 선택을 저장하지 않음) ── */
  function rememberSel(s) {
    if (!s || !s.opt || !CELL[s.opt]) return;
    store.set("curSel", { exp: CELL[s.opt].exp, opt: s.opt });
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (saved && CELL[saved.opt]) exp.select({ exp: CELL[saved.opt].exp, opt: saved.opt });
  }
  // 실행 버튼 글자를 지금 장면에 맞춘다(실험 1의 '스위치 닫기/열기' — 실행 중에는 건드리지 않는다)
  function refreshRunLabel() {
    if (exp && !exp.isBusy()) exp.refresh();
  }
  // 실행 버튼이 실험 1의 스위치 토글일 때 버튼 앞에 스위치 기호를 그린다(style.css .ss-run-btn.sw-run::before — 실행 중에는 숨김)
  function markSwitchRun(on) {
    if (exp && exp.runButton) exp.runButton.classList.toggle("sw-run", !!on);
  }

  /* ── 장면의 물체를 눌러 고르기(직접 조작, sim-redesign spec §3.3) ──
     버튼과 같은 길(ctx.onPick → 틀의 select)로 고르므로 저장되는 값·구조가 같고, 조작 단계를 늘리지 않는다.
     실험을 고르기 전, 실행 중, 장면이 아직 고른 실험의 모습이 아닐 때(그 실험의 조건을 버튼으로 처음 고르기 전)의 누르기는 무시한다.
       실험 1: 스위치 → 여닫기(실행 버튼 '스위치 닫기/열기'와 같음), 둥근 철 고리 → 조건 고르기
       실험 2: 전지 → 전지 1개 ↔ 전지 2개(직렬연결)
       실험 3: 나침반 → 그 나침반(위치), 전지 → 전지의 방향(바꾸기 전 ↔ 바꾼 뒤) */
  function cellOfD(dir, pos) {
    for (var i = 0; i < C.cells.length; i++) {
      var c = C.cells[i];
      if (c.exp === "D" && c.dir === dir && c.pos === pos) return c.id;
    }
    return null;
  }
  function onScenePick(what, ctx) {
    if (!exp || exp.isBusy()) return;
    var cur = pickSel;
    if (!cur || !cur.exp) return;
    if (!sceneState || sceneState.exp !== cur.exp) return;
    var target = null;
    var toggle = false;
    if (cur.exp === "S") {
      if (what === "switch") {
        target = "test";
        toggle = true;
      } else if (what === "ring") target = "test";
    } else if (cur.exp === "B") {
      if (what === "battery") target = cur.opt === "b1" ? "b2" : "b1";
    } else if (cur.exp === "D") {
      var dc = cur.opt && CELL[cur.opt] && CELL[cur.opt].exp === "D" ? CELL[cur.opt] : null;
      var dir = dc ? dc.dir : "before";
      var pos = dc ? dc.pos : "left";
      if (what === "left" || what === "right") pos = what;
      else if (what === "battery") dir = dir === "before" ? "after" : "before";
      else return;
      target = cellOfD(dir, pos);
    }
    if (!target) return;
    if (cur.opt !== target) ctx.onPick({ exp: CELL[target].exp, opt: target });
    if (toggle) {
      var b = exp.runButton;
      if (b && !b.disabled) b.click();
    }
  }

  /* ───────── 두 화면이 함께 쓰는 장면 상태와 실험 순서 ───────── */
  // 단위: 장면 길이(모형). 탁자 윗면 y = 0.
  var G = {
    Y: 1.45, // 전자석 중심 높이(받침대 위)
    BOLT_L: 2.2,
    BOLT_R: 0.14,
    COIL_R: 0.25,
    TIP: 1.1, // 전자석 오른쪽 끝
    RING_X: 1.15,
    RING_R: 0.1,
    RING_GAP: 0.15,
    COMP_X: 1.95, // 나침반 자리(양 끝 바깥)
    COMP_Y: 1.15, // 나침반 받침 높이(전자석 끝과 나란히 보이게 — 모형)
  };
  function needleAngle(dir) {
    // 바꾸기 전(왼쪽 N·오른쪽 S): 두 나침반의 빨간 끝이 모두 왼쪽(-x) → +90°
    // 바꾼 뒤(왼쪽 S·오른쪽 N): 두 나침반의 빨간 끝이 모두 오른쪽(+x) → -90°
    return dir === "after" ? -Math.PI / 2 : Math.PI / 2;
  }
  function freshState(cellId) {
    var c = CELL[cellId] || CELL.test;
    return {
      cell: c.id,
      exp: c.exp,
      battery: c.exp === "B" ? c.battery : 1,
      flipped: false,
      closed: false,
      rings: 0, // 붙은 고리 수
      riseT: 0, // 실험 1에서 고리가 전자석 끝으로 올라붙는 정도(0~1)
      swT: null, // 실험 1 스위치 레버가 움직이는 중일 때 닫힌 정도(0 = 열림 ~ 1 = 닫힘), 멈춰 있으면 null(closed를 따른다)
      needleA: 0, // 나침반 바늘 각도(0 = 북)
      look: c.pos || null,
      done: false,
    };
  }
  // 지금 화면의 전지 방향·스위치(실행 버튼 글자·연출 판단에 쓴다)
  var sceneState = null;
  function curDir() {
    return sceneState && sceneState.exp === "D" ? (sceneState.flipped ? "after" : "before") : null;
  }
  function sceneClosed() {
    return !!(sceneState && sceneState.closed);
  }
  // 실험 1 스위치(토글, 2026-09-27 사용자): 장면이 실험 1 모습이고 스위치가 닫혀 있는가 — 실행 버튼 글자('스위치 닫기/열기')가 따른다.
  // 장면이 다른 실험 모습이면 실험 1을 고르는 순간 실험 전 모습(열림)으로 돌아가므로 '닫기'.
  function sceneSwitchClosed() {
    return !!(sceneState && sceneState.exp === "S" && sceneState.closed);
  }
  // 실험 1의 지금 스위치 상태 — 3D·2D 화면을 바꿔도 이어지게 두 화면이 함께 쓴다(저장하지 않음: 새로 고침하면 열림에서 다시).
  // swEverClosed: 실험 1을 고른 뒤 스위치를 한 번이라도 닫아 보았는지('확인하기' 조건).
  var swClosed = false;
  var swEverClosed = false;
  // 지금 고른 조건(장면 물체 누르기 판단에 쓴다 — view.highlight가 적어 둔다)
  var pickSel = null;

  // 상태 표시(HUD) — 실험 1은 스위치 상태만(고리가 붙었는지는 학생이 장면에서 본다), 실험 2의 고리 개수는 연출이 끝난 뒤에만
  function makeHud() {
    var sw = el("span", { class: "hud-sw" });
    var info = el("span", { class: "hud-info" });
    var node = el("div", { class: "hud", "aria-hidden": "true" }, [sw, info]);
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    return {
      nodes: [node, live],
      set: function (st, extra) {
        sw.textContent = st.closed ? "스위치: 닫힘" : "스위치: 열림"; // 앞 아이콘은 스위치 기호(style.css .hud-sw::before)
        sw.classList.toggle("is-on", !!st.closed);
        var t = "";
        if (st.exp === "B") t = "🔋 전지 " + st.battery + "개" + (st.battery === 2 ? " 직렬연결" : "") + (st.done ? " · 🔗 붙은 고리: " + st.rings + "개" : "");
        info.textContent = extra || t;
        if (!extra && st.exp === "D") {
          // "전지 방향: "은 좁은 화면에서 숨긴다(style.css .hud-pre) — 상태 표시가 두 줄 안에 들어가 위쪽 가운데를 덜 가리게
          info.appendChild(document.createTextNode("🔋 "));
          info.appendChild(el("span", { class: "hud-pre", text: "전지 방향: " }));
          info.appendChild(document.createTextNode((st.flipped ? "바꾼 뒤" : "바꾸기 전") + (st.look ? " · 🧭 " + (st.look === "left" ? "왼쪽" : "오른쪽") + " 나침반" : "")));
        }
        info.hidden = !info.textContent;
      },
      say: function (t) {
        live.textContent = t;
      },
      remove: function () {
        [node, live].forEach(function (x) {
          if (x.parentNode) x.parentNode.removeChild(x);
        });
      },
    };
  }
  function idleText(st) {
    if (st.exp === "S") return null;
    return null;
  }
  // 장면 대체 설명(3D 장면·2D 그림의 aria-label) — 장면을 "보는 것"과 같아서 지금 모습을 말한다(화면을 보기 어려운 학생도 관찰할 수 있게).
  // 알림(aria-live)이 아니라 장면을 찾아 읽을 때만 들린다.
  function sceneDesc(st) {
    var sw = "스위치: " + (st.closed ? "닫힘" : "열림") + ". ";
    if (st.exp === "S") return sw + "둥근 철 고리: " + ((st.riseT || 0) >= 1 ? "전자석 끝부분에 붙어 있음." : "전자석 끝부분 아래 받침 위에 있음.");
    if (st.exp === "B") return "전지 " + st.battery + "개" + (st.battery === 2 ? "(직렬연결)" : "") + ". " + sw + (st.done ? "전자석 끝부분에 붙은 둥근 철 고리: " + st.rings + "개." : "");
    var a = st.needleA || 0;
    var where = Math.abs(a) < 0.3 ? "북쪽" : a > 0 ? "왼쪽" : "오른쪽";
    return "전지의 방향: " + (st.flipped ? "바꾼 뒤" : "바꾸기 전") + ". " + sw + "두 나침반 바늘의 빨간 끝(N극)이 모두 " + where + "을 가리킴.";
  }

  // 페이지가 보일 때까지 기다린다(숨겨진 채 실험이 끝나 저장 키를 쓰면 가짜 충돌이 생길 수 있다)
  function waitVisible() {
    if (!document.hidden) return Promise.resolve();
    return new Promise(function (resolve) {
      function on() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", on);
        window.removeEventListener("pageshow", on);
        resolve();
      }
      document.addEventListener("visibilitychange", on);
      window.addEventListener("pageshow", on);
    });
  }

  /* 실험 1: 스위치 여닫기 토글(2026-09-27 사용자 — 자동 확대 없이 전체 회로가 보이는 시점에서, 여러 번 열고 닫을 수 있게).
     누를 때마다 스위치를 닫거나 연다. 카메라는 옮기지 않는다(처음 시점이든 학생이 스스로 확대·이동한 시점이든 그대로).
     닫으면 전기가 흘러 둥근 철 고리가 전자석 끝부분으로 끌려 올라가 붙고, 열면 전기가 끊겨 떨어진다
     (전자석은 전기가 흐를 때만 자석의 성질이 나타난다 — 모형). 연출은 1초 안쪽.
     관찰 카드의 두 사진(열림·닫힘)은 바뀌기 전·후 모습을 지금 시점 그대로 찍어 늘 가장 최근 모습으로 바꾼다. */
  var ALT_OPEN = "스위치를 열었을 때의 실험 화면(모형)";
  var ALT_CLOSED = "스위치를 닫았을 때의 실험 화면(모형)";
  async function toggleSwitch(api, tw) {
    var st = api.st;
    if (st.exp !== "S") {
      // 장면이 다른 실험 모습이면 실험 1의 실험 전 모습(스위치 열림)으로(카메라는 그대로)
      var f0 = freshState("test");
      Object.keys(f0).forEach(function (k) {
        st[k] = f0[k];
      });
      swClosed = false;
      api.apply(true);
      api.hud.set(st);
    }
    var closing = !st.closed;
    shots[closing ? "open" : "closed"] = api.shot(closing ? ALT_OPEN : ALT_CLOSED, "tip");
    if (closing) {
      // 레버를 내려 스위치를 닫는다 → 전기가 흐르면 둥근 철 고리가 끝부분으로 끌려 올라가 붙는다
      await tw(250, function (e) {
        st.swT = e;
        api.apply();
      });
      st.swT = null;
      st.closed = true;
      swClosed = true;
      swEverClosed = true;
      api.apply();
      api.hud.set(st);
      api.hud.say("스위치를 닫았어요.");
      await tw(380, function (e, t) {
        st.riseT = t * t; // 가까워질수록 빨라진다
        api.apply();
      });
      st.riseT = 1;
      st.rings = 1;
    } else {
      // 레버를 들어 스위치를 여는 순간 전기가 끊겨 둥근 철 고리가 떨어진다
      st.closed = false;
      swClosed = false;
      api.hud.set(st);
      api.hud.say("스위치를 열었어요.");
      await tw(380, function (e, t) {
        st.swT = Math.max(0, 1 - t / 0.65);
        st.riseT = 1 - t * t; // 떨어질 때도 점점 빨라진다
        api.apply();
      });
      st.swT = null;
      st.riseT = 0;
      st.rings = 0;
    }
    api.apply();
    shots[closing ? "closed" : "open"] = api.shot(closing ? ALT_CLOSED : ALT_OPEN, "tip");
  }

  /* 실험 순서(3D·2D 공통).
     api = { st, apply(instant), tween(ms, fn(e, t)), hud, focus(what), home(), shot() } */
  async function sequence(api, cellId) {
    var c = CELL[cellId];
    var st = api.st;
    async function tw(ms, fn) {
      await waitVisible();
      await api.tween(ms, fn);
    }
    if (c.exp === "S") {
      await toggleSwitch(api, tw);
      st.done = true;
      api.apply();
      api.hud.set(st);
      return;
    }
    var sameDir = st.exp === "D" && c.exp === "D" && st.closed && (st.flipped ? "after" : "before") === c.dir;

    if (!sameDir) {
      // 실험 전 모습으로 되돌린다(스위치 열림)
      var fresh = freshState(cellId);
      if (c.exp === "D") fresh.flipped = st.exp === "D" ? st.flipped : false;
      Object.keys(fresh).forEach(function (k) {
        st[k] = fresh[k];
      });
      api.apply(true);
      api.hud.set(st);
      await waitVisible();
      await api.home();
    }

    if (c.exp === "B") {
      var n = ringsOf(c);
      api.hud.set(st, "🔋 전지 " + c.battery + "개" + (c.battery === 2 ? " 직렬연결" : "") + " · 스위치를 닫아요");
      api.hud.say("전지 " + c.battery + "개를 연결하고 스위치를 닫아요.");
      await tw(450, function (e) {
        st.closed = e > 0.5;
        api.apply();
      });
      st.closed = true;
      api.apply();
      // 둥근 철 고리가 하나씩 끝부분에 달라붙는다(움직이는 동안에는 고리만 — 붙은 개수 글은 끝에 한 번, 아래 st.done 뒤)
      await tw(1250, function (e) {
        st.rings = Math.min(n, Math.round(e * n));
        api.apply();
        api.hud.set(st);
      });
      st.rings = n;
      st.done = true;
      api.apply();
      api.hud.set(st);
      api.hud.say("둥근 철 고리 " + n + "개가 붙었어요. 값 패널을 확인하고 기록해요.");
    } else {
      if (!sameDir) {
        if (c.dir === "after" && !st.flipped) {
          api.hud.set(st, "🔄 전지의 방향을 반대로 바꿔요");
          api.hud.say("스위치를 열고 전지의 방향을 반대로 바꿔요.");
          await tw(950, function (e) {
            st.flipT = e;
            api.apply();
          });
          st.flipped = true;
          st.flipT = 0;
          api.apply();
        }
        api.hud.set(st, "스위치를 닫아요"); // 상태 표시 앞의 스위치 기호와 겹쳐 🔌를 따로 붙이지 않는다
        await tw(450, function (e) {
          st.closed = e > 0.5;
          api.apply();
        });
        st.closed = true;
        api.apply();
        // 나침반 바늘이 돌아 멈춘다
        var target = needleAngle(c.dir);
        var from = st.needleA;
        api.hud.say("스위치를 닫았어요. 나침반 바늘이 움직여요.");
        await tw(800, function (e) {
          st.needleA = from + (target - from) * e;
          api.apply();
        });
        st.needleA = target;
        api.apply();
      }
      st.look = c.pos;
      api.hud.set(st);
      await waitVisible();
      await api.focus(c.pos);
      api.hud.say((c.pos === "left" ? "왼쪽" : "오른쪽") + " 나침반을 살펴보고 극을 골라요.");
    }
    st.done = true;
    api.apply();
    api.hud.set(st);
  }

  var curView = null;

  function makeView(api, disposeFn, resetView, whenVisible, photo) {
    function setTo(cellId, done) {
      var c = CELL[cellId];
      var fresh = freshState(cellId);
      if (done) {
        fresh.closed = true;
        if (c.exp === "S") {
          // 실험 1은 '결과 장면'이 아니라 지금 스위치 상태(학생이 마지막으로 여닫은 모습)를 되살린다
          // (3D↔2D를 바꿔도 이어지게 — 새로 고침하면 swClosed가 비어 열림)
          fresh.closed = swClosed;
          fresh.rings = swClosed ? 1 : 0;
          fresh.riseT = swClosed ? 1 : 0;
        }
        if (c.exp === "B") fresh.rings = ringsOf(c);
        if (c.exp === "D") {
          fresh.flipped = c.dir === "after";
          fresh.needleA = needleAngle(c.dir);
          fresh.look = c.pos;
        }
        fresh.done = true;
      }
      if (!(c.exp === "S" && done)) {
        // 실험 1의 실험 전 모습이거나 다른 실험 모습이면 스위치 토글 상태도 처음(열림)으로
        swClosed = false;
        swEverClosed = false;
      }
      Object.keys(fresh).forEach(function (k) {
        api.st[k] = fresh[k];
      });
      api.apply(true);
      api.hud.set(api.st, idleText(api.st));
    }
    sceneState = api.st;
    var view = {
      photo: photo,
      whenVisible: whenVisible,
      highlight: function (s) {
        pickSel = s ? { exp: s.exp || null, opt: s.opt || null } : null;
        markSwitchRun(!!(s && s.opt && CELL[s.opt] && CELL[s.opt].exp === "S")); // 조건을 다 고르지 않았으면('…을 골라요') 아이콘 없음
        rememberSel(s);
        if (!s || !s.opt || !CELL[s.opt]) return;
        var c = CELL[s.opt];
        // 실험 1을 다시 고르거나 화면을 다시 그릴 때: 지금 스위치 상태·시점을 그대로 둔다(누를 때마다 처음 시점으로 되돌리지 않음).
        // 다른 실험 모습에서 실험 1을 고를 때만 아래에서 실험 전 모습(열림)·처음 시점(전체 회로)으로.
        if (c.exp === "S" && api.st.exp === "S") {
          api.st.cell = c.id;
          if (!!api.st.closed !== swClosed) {
            api.st.closed = swClosed;
            api.st.riseT = swClosed ? 1 : 0;
            api.st.rings = swClosed ? 1 : 0;
            api.apply(true);
          }
          api.hud.set(api.st);
          return;
        }
        // 같은 실험 안에서 방향이 같은 칸(나침반 위치만 다름)은 화면을 그대로 둔다
        if (api.st.exp === "D" && c.exp === "D" && api.st.closed && (api.st.flipped ? "after" : "before") === c.dir) {
          api.st.cell = c.id;
          api.hud.set(api.st);
          return;
        }
        if (api.st.cell === c.id) return;
        setTo(c.id, false);
        api.home();
      },
      run: async function (sel) {
        setSceneAt(null);
        liveResultAt = null;
        await sequence(api, sel.opt);
        await waitVisible();
        setSceneAt(sel.opt);
        liveResultAt = sel.opt;
      },
      showInstant: function (sel) {
        // 결과 장면은 '기록한 칸' 또는 '방금 실험을 마쳐 관찰 카드가 열려 있는 칸'만 되살린다.
        // (3D↔2D를 바꿔도 화면과 관찰 카드가 어긋나지 않게 한다. 새로고침하면 liveResultAt이 비므로 예전처럼 실험 전 모습이다.)
        if (sceneAt !== sel.opt || (!recOf(sel.opt) && liveResultAt !== sel.opt)) return;
        setTo(sel.opt, true);
      },
      clear: function () {
        setSceneAt(null);
        liveResultAt = null;
        setTo(api.st.cell || "test", false);
        api.home();
        refreshRunLabel(); // 실험 1이면 실행 버튼이 다시 '스위치 닫기'
      },
      resetView: resetView,
      dispose: function () {
        if (curView === view) curView = null;
        if (sceneState === api.st) sceneState = null;
        disposeFn();
      },
    };
    curView = view;
    return view;
  }

  /* ───────── 2D 대체 화면: 옆에서 본 모습 + 나침반은 위에서 본 모습 ───────── */
  function build2D(root, ctx) {
    var NS = "http://www.w3.org/2000/svg";
    function n(tag, a, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(a || {}).forEach(function (k) {
        e.setAttribute(k, a[k]);
      });
      if (text != null) e.textContent = text;
      return e;
    }
    var K = 88; // 장면 1 → 88 px
    var X0 = 205;
    var Y0 = 430; // 탁자 윗면
    function px(x) {
      return X0 + x * K;
    }
    function py(y) {
      return Y0 - y * K;
    }
    var disposed = false;
    var hud = makeHud();
    var svg = n("svg", { viewBox: "0 0 600 470", class: "side-svg", role: "img", "aria-label": "전자석 실험(2D 모형, 옆에서 본 모습)" });
    svg.appendChild(n("rect", { x: 0, y: Y0, width: 600, height: 40, class: "s2-table" }));

    // 집게 전선(맨 아래에 그려 다른 물체에 가리게 한다)
    var wireA = n("path", { class: "s2-wire", d: "" });
    var wireB = n("path", { class: "s2-wire", d: "" });
    var wireC = n("path", { class: "s2-wire is-red", d: "" });
    svg.appendChild(wireA);
    svg.appendChild(wireB);
    svg.appendChild(wireC);

    // 받침대 2개 + 전자석(볼트 + 종이 + 에나멜선 코일)
    var boltY = py(G.Y);
    [-0.8, 0.8].forEach(function (x) {
      svg.appendChild(n("rect", { x: px(x) - 15, y: py(G.Y - G.BOLT_R), width: 30, height: G.Y * K - G.BOLT_R * K, class: "s2-stand" }));
    });
    svg.appendChild(n("rect", { x: px(-G.BOLT_L / 2), y: boltY - G.BOLT_R * K, width: G.BOLT_L * K, height: 2 * G.BOLT_R * K, rx: 4, class: "s2-bolt" }));
    svg.appendChild(n("rect", { x: px(-G.BOLT_L / 2) - 12, y: boltY - 0.22 * K, width: 12, height: 0.44 * K, rx: 3, class: "s2-boltHead" }));
    svg.appendChild(n("rect", { x: px(-0.74), y: boltY - 0.2 * K, width: 1.48 * K, height: 0.4 * K, rx: 4, class: "s2-paper" }));
    var coil = n("g", {});
    for (var i = 0; i < 17; i++) {
      coil.appendChild(n("ellipse", { cx: px(-0.7 + i * 0.0875), cy: boltY, rx: 4, ry: G.COIL_R * K, class: "s2-coil" }));
    }
    svg.appendChild(coil);
    svg.appendChild(n("text", { x: px(0), y: boltY - 0.36 * K, "text-anchor": "middle", class: "s2-lbl" }, "전자석 (에나멜선을 감은 둥근 머리 볼트)"));

    // 둥근 철 고리: 접시 + 접시에 담긴 고리(그림) + 전자석 끝에 붙어 매달리는 고리
    var RX = px(G.RING_X);
    var RR = 12;
    var dish = n("g", {});
    dish.appendChild(n("rect", { x: RX - 44, y: Y0 - 13, width: 88, height: 13, rx: 4, class: "s2-dish" }));
    var pile = n("g", {});
    [-26, -9, 8, 25].forEach(function (dx) {
      pile.appendChild(n("circle", { cx: RX + dx, cy: Y0 - 17, r: RR - 3, class: "s2-ring" }));
    });
    dish.appendChild(pile);
    svg.appendChild(dish);
    var ringStand = n("rect", { x: RX - 22, y: Y0 - 0.58 * K, width: 44, height: 0.58 * K, class: "s2-stand" });
    svg.appendChild(ringStand);
    var ringNodes = [];
    for (var r = 0; r < MAX_RINGS; r++) {
      var rn = n("circle", { cx: RX, cy: Y0 - 18, r: RR, class: "s2-ring is-on" });
      ringNodes.push(rn);
      svg.appendChild(rn);
    }
    var ringLbl = n("text", { x: RX, y: Y0 + 24, "text-anchor": "middle", class: "s2-lbl-s" }, "둥근 철 고리");
    svg.appendChild(ringLbl);

    // 스위치(오른쪽 위) · 전지 끼우개(오른쪽 아래)
    var swG = n("g", { class: "s2-tap" });
    svg.appendChild(swG);
    var batG = n("g", { class: "s2-tap" });
    svg.appendChild(batG);

    // 나침반 2개(위에서 본 모습, 인세트)
    var compL = n("g", { class: "s2-tap" });
    var compR = n("g", { class: "s2-tap" });
    svg.appendChild(compL);
    svg.appendChild(compR);

    // 그림의 물체를 눌러 고르기(3D와 같은 규칙 — onScenePick)
    [
      [swG, "switch"],
      [batG, "battery"],
      [compL, "left"],
      [compR, "right"],
      [ringStand, "ring"],
      [ringNodes[0], "ring"],
    ].forEach(function (p) {
      p[0].setAttribute("data-tap", p[1]);
      p[0].addEventListener("click", function () {
        if (!disposed) onScenePick(p[1], ctx);
      });
    });
    ringStand.classList.add("s2-tap");
    ringNodes[0].classList.add("s2-tap");

    var head = el("div", { class: "s2-head" }, [hud.nodes[0]]);
    var caption = el("p", { class: "s2-caption" });
    var box = el("div", { class: "s2-wrap" }, [head, svg, caption, hud.nodes[1]]);
    root.appendChild(box);

    var st = freshState("test");

    // 회로 자리(px)
    var SW = { x: 400, y: 250, w: 116, h: 13 }; // 스위치 받침
    var BAT = { x: 402, y: 356, w: 70, h: 40, gap: 8 };

    function drawSwitch() {
      swG.textContent = "";
      swG.appendChild(n("rect", { x: SW.x - 8, y: SW.y - 44, width: SW.w + 16, height: 84, class: "s2-hit" })); // 누르는 곳(보이지 않음)
      swG.appendChild(n("rect", { x: SW.x, y: SW.y, width: SW.w, height: SW.h, rx: 4, class: "s2-swbase" }));
      var x1 = SW.x + 14,
        x2 = SW.x + SW.w - 14;
      swG.appendChild(n("circle", { cx: x1, cy: SW.y, r: 6, class: "s2-swdot" }));
      swG.appendChild(n("circle", { cx: x2, cy: SW.y, r: 6, class: "s2-swdot" }));
      var lev = st.swT != null ? st.swT : st.closed ? 1 : 0; // 레버가 닫힌 정도(실험 1은 여닫는 동안 부드럽게)
      swG.appendChild(n("line", { x1: x1, y1: SW.y, x2: x2, y2: SW.y - 30 * (1 - lev), class: "s2-lever" + (st.closed ? " is-on" : "") }));
      swG.appendChild(n("text", { x: SW.x + SW.w / 2, y: SW.y + 32, "text-anchor": "middle", class: "s2-lbl-s" }, st.closed ? "스위치 (닫힘)" : "스위치 (열림)"));
    }
    function drawBatteries() {
      batG.textContent = "";
      var nB = st.exp === "D" ? 1 : st.battery;
      batG.appendChild(n("rect", { x: BAT.x - 8, y: BAT.y - 10, width: nB * (BAT.w + BAT.gap) + 8, height: BAT.h + 36, class: "s2-hit" })); // 누르는 곳(보이지 않음, 전지 사이 틈 포함)
      for (var k = 0; k < nB; k++) {
        var x = BAT.x + k * (BAT.w + BAT.gap);
        batG.appendChild(n("rect", { x: x, y: BAT.y, width: BAT.w, height: BAT.h, rx: 6, class: "s2-holder" }));
        var tF = st.flipT || 0;
        var sx = tF > 0 ? Math.max(0.05, Math.abs(Math.cos(Math.PI * tF))) : 1;
        var flip = st.flipped ? -1 : 1;
        var g2 = n("g", { transform: "translate(" + (x + BAT.w / 2) + " " + (BAT.y + BAT.h / 2) + ") scale(" + sx.toFixed(3) + " 1)" });
        g2.appendChild(n("rect", { x: -28, y: -13, width: 56, height: 26, rx: 4, class: "s2-battery" }));
        g2.appendChild(n("rect", { x: flip > 0 ? 28 : -34, y: -6, width: 6, height: 12, class: "s2-nub" }));
        g2.appendChild(n("text", { x: flip > 0 ? 15 : -15, y: 5, "text-anchor": "middle", class: "s2-sign" }, "+"));
        g2.appendChild(n("text", { x: flip > 0 ? -15 : 15, y: 5, "text-anchor": "middle", class: "s2-sign" }, "−"));
        batG.appendChild(g2);
      }
      batG.appendChild(n("text", { x: BAT.x + (nB * (BAT.w + BAT.gap)) / 2 - 4, y: BAT.y + BAT.h + 20, "text-anchor": "middle", class: "s2-lbl-s" }, nB === 2 ? "전지 2개 (직렬연결)" : "전지 1개"));
    }
    function drawWires() {
      var nB = st.exp === "D" ? 1 : st.battery;
      var leftEnd = px(-G.BOLT_L / 2) - 12;
      var rightEnd = px(G.BOLT_L / 2);
      // ① 전자석 오른쪽 끝 → 스위치 왼쪽
      wireA.setAttribute("d", "M " + rightEnd + " " + boltY + " L " + (rightEnd + 30) + " " + (boltY - 20) + " L " + SW.x + " " + SW.y);
      // ② 스위치 오른쪽 → 전지(오른쪽 끝)
      var batRight = BAT.x + nB * BAT.w + (nB - 1) * BAT.gap;
      wireB.setAttribute("d", "M " + (SW.x + SW.w) + " " + SW.y + " L " + (batRight + 36) + " " + SW.y + " L " + (batRight + 36) + " " + (BAT.y + BAT.h / 2) + " L " + batRight + " " + (BAT.y + BAT.h / 2));
      // ③ 전지(왼쪽 끝) → 위로 돌아 전자석 왼쪽 끝 · 2개일 때는 전지 사이를 잇는 선도 함께
      var d = "M " + BAT.x + " " + (BAT.y + BAT.h / 2) + " L " + (BAT.x - 26) + " " + (BAT.y + BAT.h / 2) + " L " + (BAT.x - 26) + " " + 176 + " L " + (leftEnd - 42) + " " + 176 + " L " + (leftEnd - 42) + " " + boltY + " L " + leftEnd + " " + boltY;
      if (nB === 2) {
        var mid = BAT.x + BAT.w;
        d += " M " + mid + " " + (BAT.y + BAT.h / 2) + " L " + (mid + BAT.gap / 2) + " " + (BAT.y - 8) + " L " + (mid + BAT.gap) + " " + (BAT.y + BAT.h / 2);
      }
      wireC.setAttribute("d", d);
    }
    function drawCompass(g, pos, on) {
      g.textContent = "";
      var cx = pos === "left" ? 80 : 520,
        cy = 74,
        R = 46;
      g.appendChild(n("circle", { cx: cx, cy: cy, r: R, class: "s2-comp" + (on ? " is-on" : "") }));
      // 나침반판 안쪽 글자는 판 색(흰색)에 맞춘 고정 색을 쓴다(다크 모드 대비)
      g.appendChild(n("text", { x: cx, y: cy - R + 15, "text-anchor": "middle", class: "s2-dial-t" }, "북"));
      var a = st.exp === "D" ? st.needleA : 0;
      var ux = -Math.sin(a),
        uy = -Math.cos(a);
      var L = R - 20;
      var pxv = -uy,
        pyv = ux;
      function tri(dx, dy, cls) {
        var p = [cx + dx * L, cy + dy * L, cx + pxv * 8 - dx * 4, cy + pyv * 8 - dy * 4, cx - pxv * 8 - dx * 4, cy - pyv * 8 - dy * 4];
        return n("polygon", { points: p[0] + "," + p[1] + " " + p[2] + "," + p[3] + " " + p[4] + "," + p[5], class: cls });
      }
      g.appendChild(tri(-ux, -uy, "comp-needle-s"));
      g.appendChild(tri(ux, uy, "comp-needle-n"));
      // 색만으로 구분하지 않게 바늘 끝에 N·S 글자를 붙인다
      g.appendChild(n("text", { x: cx + ux * (L + 11), y: cy + uy * (L + 11) + 4, "text-anchor": "middle", class: "s2-tag-n" }, "N"));
      g.appendChild(n("text", { x: cx - ux * (L + 11), y: cy - uy * (L + 11) + 4, "text-anchor": "middle", class: "s2-tag-s" }, "S"));
      g.appendChild(n("circle", { cx: cx, cy: cy, r: 4, class: "comp-pin" }));
      g.appendChild(n("text", { x: cx, y: cy + R + 18, "text-anchor": "middle", class: "s2-lbl-xs" }, (pos === "left" ? "왼쪽" : "오른쪽") + " 나침반"));
      g.appendChild(n("text", { x: cx, y: cy + R + 34, "text-anchor": "middle", class: "s2-lbl-xs" }, "(위에서 본 모습)"));
    }
    function apply() {
      if (disposed) return;
      var isD = st.exp === "D";
      compL.style.display = isD ? "" : "none";
      compR.style.display = isD ? "" : "none";
      if (isD) {
        drawCompass(compL, "left", st.look === "left");
        drawCompass(compR, "right", st.look === "right");
      }
      dish.style.display = st.exp === "B" ? "" : "none";
      pile.style.display = st.rings > 0 ? "none" : "";
      ringStand.style.display = st.exp === "S" ? "" : "none";
      ringLbl.style.display = isD ? "none" : "";
      var TIP_Y = py(G.Y - G.BOLT_R - 0.16);
      var SIT_Y = py(0.68);
      ringNodes.forEach(function (node, idx) {
        if (st.exp === "S") {
          // 실험 1: 고리 한 개(크게). 스위치를 닫으면 받침에서 끝부분으로 올라붙는다.
          var on = idx === 0;
          node.style.display = on ? "" : "none";
          if (!on) return;
          node.setAttribute("r", String(RR * 1.8));
          node.setAttribute("cx", String(RX));
          node.setAttribute("cy", String(SIT_Y + (TIP_Y - SIT_Y) * (st.riseT || 0)));
          return;
        }
        node.setAttribute("r", String(RR));
        var attached = idx < st.rings;
        node.style.display = attached ? "" : "none";
        if (!attached) return;
        node.setAttribute("cx", String(RX));
        node.setAttribute("cy", String(py(G.Y - G.BOLT_R - 0.06 - idx * G.RING_GAP)));
      });
      drawBatteries();
      drawSwitch();
      drawWires();
      caption.textContent = isD
        ? "옆에서 본 모습(모형). 나침반은 전자석 양 끝 바깥에 놓고, 위에서 본 모습으로 따로 보여 줘요."
        : "옆에서 본 모습(모형). 전자석 끝부분 가까이에 둥근 철 고리를 놓았어요."; // 준비 모습만(고리가 붙은 뒤에도 맞는 말, 결과는 말하지 않음 — review-D2 L6)
      var desc = "전자석 실험(2D 모형, 옆에서 본 모습). " + sceneDesc(st);
      if (desc !== lastDesc) svg.setAttribute("aria-label", (lastDesc = desc));
      // 누를 수 있는 물체에만 손가락 모양(실험마다 누를 수 있는 것이 다르다 — onScenePick)
      swG.classList.toggle("s2-tap", st.exp === "S");
      batG.classList.toggle("s2-tap", st.exp !== "S");
      ringNodes[0].classList.toggle("s2-tap", st.exp === "S");
    }
    var lastDesc = "";
    function animate(ms, fn) {
      return new Promise(function (resolve) {
        if (document.hidden || disposed) {
          fn(1, 1);
          resolve();
          return;
        }
        var t0 = null;
        (function tick(now) {
          if (disposed) {
            resolve();
            return;
          }
          if (t0 == null) t0 = now;
          var t = Math.min(1, (now - t0) / ms);
          var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          fn(e, t);
          if (t >= 1) resolve();
          else requestAnimationFrame(tick);
        })(performance.now());
      });
    }
    var api = {
      st: st,
      apply: apply,
      tween: animate,
      hud: hud,
      focus: function () {
        return Promise.resolve();
      },
      home: function () {
        return Promise.resolve();
      },
      shot: function (alt, crop) {
        var c = svg.cloneNode(true);
        c.setAttribute("class", "side-svg photo-svg");
        c.setAttribute("aria-label", alt || "실험 화면(2D 모형)");
        if (crop === "tip") {
          // 실험 1: 그림 전체 그대로(스위치까지 보이게 — 3D 사진처럼 지금 모습 전체) + 볼 곳(둥근 철 고리)에 점선 표시
          var TIP_Y = py(G.Y - G.BOLT_R - 0.16);
          var SIT_Y = py(0.68);
          var ry = SIT_Y + (TIP_Y - SIT_Y) * (st.riseT || 0);
          c.appendChild(n("circle", { cx: RX, cy: ry, r: 34, class: "s2-mark-bg" }));
          c.appendChild(n("circle", { cx: RX, cy: ry, r: 34, class: "s2-mark" }));
        }
        return c;
      },
    };
    apply();
    hud.set(st);
    return makeView(
      api,
      function () {
        disposed = true;
        hud.remove();
      },
      function () {},
      null,
      function () {
        return api.shot("방금 한 실험 화면(2D 모형)");
      }
    );
  }

  /* ───────── 3D 화면 ───────── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 6.8, depth: 5.4, center: [0, 1.0, 0] },
      viewDir: [0, 0.5, 0.86],
      minDistance: 2.4,
      onPick: function (what) {
        onScenePick(what, ctx);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var hud = makeHud();
      hud.nodes.forEach(function (x) {
        container.appendChild(x);
      });
      // 누르기(탭) 대상 등록: three.js 레이는 숨긴 물체도 맞히므로, 숨긴 물체(자신이나 조상이 숨김)는 누르기에 걸리지 않게 한다
      // (예: 실험 1에서 숨어 있는 나침반 받침, 전지 1개일 때 숨은 둘째 전지 끼우개).
      function pickable(obj, value) {
        obj.traverse(function (o) {
          var orig = o.raycast;
          if (typeof orig !== "function") return;
          o.raycast = function (rc, hits) {
            for (var n = o; n; n = n.parent) if (n.visible === false) return;
            return orig.call(this, rc, hits);
          };
        });
        v.pickable(obj, value);
      }

      var table = M.table(9, 5.2, 0xd9c7a3);
      table.material.dispose();
      table.material = new T.MeshBasicMaterial({ color: 0xe3d4b4 });
      v.root.add(table);
      v.onThemeChange(function (dark) {
        table.material.color.set(dark ? 0x4d4436 : 0xe3d4b4);
      });

      // ── 전자석: 받침대 2개 + 둥근 머리 볼트 + 종이 + 에나멜선 코일 ──
      [-0.8, 0.8].forEach(function (x) {
        var stand = new T.Mesh(new T.BoxGeometry(0.3, G.Y - G.BOLT_R, 0.34), M.material(0xb59b74, { roughness: 0.8 }));
        stand.position.set(x, (G.Y - G.BOLT_R) / 2, 0);
        v.root.add(stand);
      });
      var bolt = new T.Mesh(new T.CylinderGeometry(G.BOLT_R, G.BOLT_R, G.BOLT_L, 24), M.material(0xa8b0ba, { metalness: 0.55, roughness: 0.35 }));
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(0, G.Y, 0);
      var head = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.14, 24), M.material(0x99a2ac, { metalness: 0.55, roughness: 0.35 }));
      head.rotation.z = Math.PI / 2;
      head.position.set(-G.BOLT_L / 2 - 0.07, G.Y, 0);
      var paper = new T.Mesh(new T.CylinderGeometry(G.BOLT_R + 0.03, G.BOLT_R + 0.03, 1.5, 24), M.material(0xf3f0e6, { roughness: 0.9 }));
      paper.rotation.z = Math.PI / 2;
      paper.position.set(0, G.Y, 0);
      v.root.add(bolt, head, paper);
      // 에나멜선 코일(촘촘한 링 반복 — 감은 모습의 모형)
      var coilMat = M.material(0xb5712f, { metalness: 0.45, roughness: 0.4 });
      var coilGeo = new T.TorusGeometry(G.COIL_R - 0.06, 0.035, 8, 20);
      var coil = new T.Group();
      for (var i = 0; i < 22; i++) {
        var ring = new T.Mesh(coilGeo, coilMat);
        ring.rotation.y = Math.PI / 2;
        ring.position.x = -0.7 + i * (1.4 / 21);
        coil.add(ring);
      }
      coil.position.y = G.Y;
      v.root.add(coil);
      var emLabel = M.label("전자석", { height: 0.3, bold: true });
      emLabel.position.set(0, G.Y + 0.55, 0);
      v.root.add(emLabel);

      // ── 둥근 철 고리 + 접시 ──
      var dish = new T.Mesh(new T.CylinderGeometry(0.42, 0.46, 0.06, 28), M.material(0xc9ced6, { roughness: 0.5 }));
      dish.position.set(G.RING_X, 0.03, 0);
      v.root.add(dish);
      var ringGeo = new T.TorusGeometry(G.RING_R, 0.024, 10, 24);
      var ringMat = M.material(0xb9c0c8, { metalness: 0.6, roughness: 0.3 });
      var ringMeshes = [];
      for (var r = 0; r < MAX_RINGS; r++) {
        var rm = new T.Mesh(ringGeo, ringMat);
        v.root.add(rm);
        ringMeshes.push(rm);
      }
      // 실험 1: 고리를 올려 두는 작은 받침(전자석 끝부분 바로 아래)
      var ringStand = new T.Mesh(new T.BoxGeometry(0.5, 0.58, 0.5), M.material(0xcbb896, { roughness: 0.85 }));
      ringStand.position.set(G.RING_X, 0.29, 0);
      v.root.add(ringStand);
      // 전자석 오른쪽 끝에서 스위치로 가는 집게 전선이 이름표 앞을 지나 글자("철")를 가렸다 → 이름표를 늘 위에 그린다
      var ringLabel = M.label("둥근 철 고리", { height: 0.26, depthTest: false });
      ringLabel.position.set(G.RING_X + 0.78, 0.5, 0.62);
      v.root.add(ringLabel);

      // ── 전지 끼우개 · 전지 ──
      var batGroup = new T.Group();
      var holders = [];
      for (var b = 0; b < 2; b++) {
        var hg = new T.Group();
        var holder = new T.Mesh(new T.BoxGeometry(0.72, 0.16, 0.34), M.material(0x2f3742, { roughness: 0.6 }));
        holder.position.y = 0.08;
        var cellBody = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.6, 20), M.material(0xd8b23a, { roughness: 0.45 }));
        cellBody.rotation.z = Math.PI / 2;
        cellBody.position.y = 0.26;
        var nub = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.06, 12), M.material(0xc9ced6, { metalness: 0.5 }));
        nub.rotation.z = Math.PI / 2;
        nub.position.set(0.33, 0.26, 0);
        var pack = new T.Group();
        pack.add(cellBody, nub);
        hg.add(holder, pack);
        hg.position.set(-0.6 + b * 0.82, 0, 1.45);
        hg.userData.pack = pack;
        batGroup.add(hg);
        holders.push(hg);
      }
      v.root.add(batGroup);
      var batLabel = M.label("전지", { height: 0.26 });
      batLabel.position.set(-0.6, 0.62, 1.45);
      v.root.add(batLabel);

      // ── 스위치 ──
      var swGroup = new T.Group();
      var swBase = new T.Mesh(new T.BoxGeometry(0.62, 0.08, 0.3), M.material(0x8c6b45, { roughness: 0.8 }));
      swBase.position.y = 0.04;
      var post1 = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.1, 10), M.material(0xc9ced6, { metalness: 0.6 }));
      post1.position.set(-0.22, 0.12, 0);
      var post2 = post1.clone();
      post2.position.x = 0.22;
      var lever = new T.Mesh(new T.BoxGeometry(0.48, 0.035, 0.07), M.material(0xc9ced6, { metalness: 0.7, roughness: 0.25 }));
      lever.position.set(0.24, 0, 0);
      var leverPivot = new T.Group();
      leverPivot.add(lever);
      leverPivot.position.set(-0.22, 0.16, 0);
      swGroup.add(swBase, post1, post2, leverPivot);
      swGroup.position.set(1.35, 0, 1.45);
      v.root.add(swGroup);
      var swLabel = M.label("스위치", { height: 0.26 });
      swLabel.position.set(1.35, 0.52, 1.45);
      v.root.add(swLabel);

      // ── 집게 전선(모형) ──
      function wire(points, color) {
        var curve = new T.CatmullRomCurve3(
          points.map(function (p) {
            return new T.Vector3(p[0], p[1], p[2]);
          })
        );
        return new T.Mesh(new T.TubeGeometry(curve, 30, 0.022, 8, false), M.material(color || 0x2b2f36, { roughness: 0.7 }));
      }
      var wires = new T.Group();
      wires.add(wire([[-0.98, 0.26, 1.45], [-1.5, 0.4, 1.2], [-1.6, 1.0, 0.5], [-G.BOLT_L / 2 - 0.2, G.Y, 0]], 0x2b2f36));
      wires.add(wire([[1.57, 0.16, 1.45], [1.9, 0.45, 1.1], [1.75, 1.05, 0.5], [G.BOLT_L / 2 + 0.05, G.Y, 0]], 0x2b2f36));
      // 전지 → 스위치: 전지 1개일 때와 2개(직렬연결)일 때 잇는 곳이 다르다
      var wireOne = wire([[-0.22, 0.26, 1.45], [0.45, 0.2, 1.75], [1.13, 0.16, 1.45]], 0xc0392b);
      var wireTwo = wire([[0.6, 0.26, 1.45], [0.85, 0.2, 1.72], [1.13, 0.16, 1.45]], 0xc0392b);
      var wireLink = wire([[-0.22, 0.26, 1.45], [-0.02, 0.34, 1.62], [0.18, 0.26, 1.45]], 0xc0392b); // 직렬연결
      wires.add(wireOne, wireTwo, wireLink);
      v.root.add(wires);

      // ── 나침반 2개 ──
      function makeCompass(side) {
        var g = new T.Group();
        var dial = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.06, 32), M.material(0xf6f7f9, { roughness: 0.5 }));
        dial.position.y = 0.03;
        var rim = new T.Mesh(new T.TorusGeometry(0.42, 0.025, 8, 36), M.material(0x8a929c, { metalness: 0.4 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.06;
        var needle = new T.Group();
        var nN = new T.Mesh(new T.ConeGeometry(0.06, 0.3, 4), M.material(0xd8434f));
        nN.rotation.x = -Math.PI / 2;
        nN.position.set(0, 0.09, -0.15);
        var nS = new T.Mesh(new T.ConeGeometry(0.06, 0.3, 4), M.material(0x3b6fd1));
        nS.rotation.x = Math.PI / 2;
        nS.position.set(0, 0.09, 0.15);
        var tagN = M.label("N", { height: 0.22, color: "#c02c38", bold: true });
        tagN.position.set(0, 0.22, -0.31);
        var tagS = M.label("S", { height: 0.22, color: "#2c55a8", bold: true });
        tagS.position.set(0, 0.22, 0.31);
        needle.add(nN, nS, tagN, tagS);
        var pin = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.12, 10), M.material(0x555b63, { metalness: 0.5 }));
        pin.position.y = 0.09;
        g.add(dial, rim, needle, pin);
        var north = M.label("북", { height: 0.17 });
        north.position.set(-0.3, 0.1, -0.28);
        g.add(north);
        var lb = M.label((side === "left" ? "왼쪽" : "오른쪽") + " 나침반", { height: 0.22 });
        // 나침반 바로 위(바늘 끝 N·S 글자와는 떨어지게) — 나침반으로 다가간 화면에서 위쪽 이동 화살표(▲)와 겹치지 않을 만큼 낮게
        lb.position.set(0, 0.72, 0.05);
        g.add(lb);
        var mark = new T.Mesh(new T.TorusGeometry(0.5, 0.035, 8, 40), new T.MeshBasicMaterial({ color: 0x2f6fd6 }));
        mark.rotation.x = Math.PI / 2;
        mark.position.y = 0.01;
        mark.visible = false;
        g.add(mark);
        g.userData.needle = needle;
        g.userData.label = lb;
        g.userData.mark = mark;
        return g;
      }
      var compL = makeCompass("left");
      compL.position.set(-G.COMP_X, G.COMP_Y, 0);
      var compR = makeCompass("right");
      compR.position.set(G.COMP_X, G.COMP_Y, 0);
      var pedestals = [-G.COMP_X, G.COMP_X].map(function (x) {
        var p = new T.Mesh(new T.BoxGeometry(0.95, G.COMP_Y, 0.95), M.material(0xcbb896, { roughness: 0.85 }));
        p.position.set(x, G.COMP_Y / 2, 0);
        v.root.add(p);
        return p;
      });
      v.root.add(compL, compR);

      // ── 누르면 고르는 물체(onScenePick — 버튼과 같은 결과) ──
      // 작은 스위치·전지는 보이지 않는 조금 큰 상자(투명, 깊이를 쓰지 않음)를 붙여 손가락으로 누르기 쉽게 한다
      var hitMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      function hitBox(parent, w, h, d, y) {
        var hb = new T.Mesh(new T.BoxGeometry(w, h, d), hitMat);
        hb.position.y = y;
        parent.add(hb);
      }
      hitBox(swGroup, 0.8, 0.46, 0.5, 0.2);
      pickable(swGroup, "switch");
      holders.forEach(function (h) {
        hitBox(h, 0.8, 0.46, 0.48, 0.22);
        pickable(h, "battery");
      });
      pickable(ringStand, "ring");
      pickable(ringMeshes[0], "ring");
      pickable(compL, "left");
      pickable(pedestals[0], "left");
      pickable(compR, "right");
      pickable(pedestals[1], "right");

      var st = freshState("test");
      var lastDesc = "";

      function apply() {
        var isD = st.exp === "D";
        compL.visible = isD;
        compR.visible = isD;
        pedestals.forEach(function (p) {
          p.visible = isD;
        });
        dish.visible = st.exp === "B";
        ringStand.visible = st.exp === "S";
        ringLabel.visible = st.exp !== "D";
        // 전지: 실험 3은 1개만 쓴다
        var nB = isD ? 1 : st.battery;
        holders.forEach(function (h, idx) {
          h.visible = idx < nB;
          var flip = st.flipped ? Math.PI : 0;
          var tF = st.flipT || 0;
          h.userData.pack.rotation.y = flip + (tF > 0 ? Math.PI * tF : 0);
        });
        wireOne.visible = nB === 1;
        wireTwo.visible = nB === 2;
        wireLink.visible = nB === 2;
        batLabel.visible = true;
        // 스위치 레버(실험 1은 여닫는 동안 부드럽게 — swT)
        leverPivot.rotation.z = st.swT != null ? 0.5 * (1 - st.swT) : st.closed ? 0 : 0.5;
        // 둥근 철 고리
        var TIP_Y = G.Y - G.BOLT_R - 0.16;
        var SIT_Y = 0.68;
        ringMeshes.forEach(function (m, idx) {
          var show = st.exp === "B" ? true : idx === 0 && st.exp === "S";
          m.visible = show;
          if (!show) return;
          if (st.exp === "S") {
            // 실험 1: 고리 한 개(크게). 스위치를 닫으면 받침에서 끝부분으로 올라붙는다.
            m.scale.setScalar(1.8);
            m.rotation.set(0, 0, 0);
            m.position.set(G.RING_X, SIT_Y + (TIP_Y - SIT_Y) * (st.riseT || 0), 0);
            return;
          }
          m.scale.setScalar(1);
          if (idx < st.rings) {
            m.position.set(G.RING_X, G.Y - G.BOLT_R - 0.08 - idx * G.RING_GAP, 0);
            m.rotation.set(0, 0, 0);
          } else {
            m.position.set(G.RING_X + (idx - st.rings - 1.5) * 0.09, 0.075, 0.16);
            m.rotation.set(Math.PI / 2, 0, 0);
          }
        });
        // 나침반 바늘
        if (isD) {
          compL.userData.needle.rotation.y = st.needleA;
          compR.userData.needle.rotation.y = st.needleA;
          compL.userData.mark.visible = st.look === "left";
          compR.userData.mark.visible = st.look === "right";
        }
        // '전자석' 이름표: 실험 3에서는 살펴볼 나침반 쪽 끝부분 바로 위로(나침반으로 다가간 화면의 가장자리에서 잘리거나 왼쪽 위
        // '전체 화면 보기' 버튼 밑에 들어가지 않게), 그 밖에는 가운데 위
        var emSide = isD && st.look ? (st.look === "left" ? -1 : 1) : 0;
        emLabel.position.set(emSide * 0.85, G.Y + (emSide ? 0.45 : 0.55), 0);
        // 장면 대체 설명(캔버스 aria-label) — 지금 모습
        var desc = "전자석 실험 장면(3D 모형). " + sceneDesc(st) + " 드래그하면 돌려 볼 수 있어요.";
        if (desc !== lastDesc) {
          var cv = container.querySelector("canvas");
          if (cv) cv.setAttribute("aria-label", (lastDesc = desc));
        }
      }
      apply();
      hud.set(st);

      // 좁은 화면(휴대폰)에서는 이름표를 키운다
      var tags = [emLabel, ringLabel, batLabel, swLabel, compL.userData.label, compR.userData.label].map(function (sp) {
        return { sp: sp, sx: sp.scale.x, sy: sp.scale.y };
      });
      var labelK = 0;
      function fitLabels() {
        var k = (container.clientWidth || 1024) < 480 ? 1.5 : 1;
        if (k === labelK) return;
        labelK = k;
        tags.forEach(function (t) {
          t.sp.scale.set(t.sx * k, t.sy * k, 1);
        });
        v.render();
      }
      fitLabels();
      var labelRO = window.ResizeObserver ? new ResizeObserver(fitLabels) : null;
      if (labelRO) labelRO.observe(container);

      var api = {
        st: st,
        apply: function () {
          apply();
        },
        tween: v.tween,
        hud: hud,
        // 실험 3만 나침반으로 다가간다(실험 1은 2026-09-27부터 자동으로 다가가지 않는다 — 전체 회로가 보이는 시점 그대로)
        focus: function (what) {
          var narrow = (container.clientWidth || 1024) < 600;
          if (what === "left") return v.focus([-G.COMP_X, G.COMP_Y + 0.25, 0.05], narrow ? 0.72 : 0.46, 700);
          if (what === "right") return v.focus([G.COMP_X, G.COMP_Y + 0.25, 0.05], narrow ? 0.72 : 0.46, 700);
          return v.flyHome(350);
        },
        home: function () {
          return v.flyHome(350);
        },
        // 3D는 지금 보고 있는 시점 그대로 찍는다. 실험 1은 볼 곳(둥근 철 고리)에 점선 표시를 함께 그린다.
        shot: function (alt, crop) {
          var marks = [];
          if (crop === "tip") {
            var TIP_Y = G.Y - G.BOLT_R - 0.16;
            var SIT_Y = 0.68;
            marks = [{ at: [G.RING_X, SIT_Y + (TIP_Y - SIT_Y) * (st.riseT || 0), 0], radius: 0.075 }];
          }
          var p = v.snapshot({ width: 460, marks: marks });
          return p ? el("img", { src: p.url, alt: alt || "실험 화면(3D 모형)", class: "photo-img" }) : null;
        },
      };
      v.render();
      return makeView(
        api,
        function () {
          if (labelRO) labelRO.disconnect();
          hud.remove();
          v.dispose();
        },
        v.resetView,
        v.whenVisible,
        function () {
          return api.shot("방금 한 실험 화면(3D 모형)");
        }
      );
    });
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  function drawResults() {
    var tn = $("toast");
    if (tn) tn.hidden = true;
    var T = S.TableChart;
    T.renderMatrix($("result-battery"), {
      caption: "표 1. 전지의 개수와 전자석에 붙는 둥근 철 고리 개수 (내 기록)",
      rowHeader: "전지 개수",
      rows: cellsOf("B").map(function (c) {
        return { id: c.id, label: c.short };
      }),
      cols: [{ id: "rings", label: "붙은 둥근 철 고리" }],
      cell: function (row) {
        var r = recOf(row.id);
        if (!r) return null;
        return { text: r.rings + "개", icon: "🔗" };
      },
      emptyText: "아직 기록 없음",
    });
    T.renderMatrix($("result-pole"), {
      caption: "표 2. 전지의 방향과 전자석의 극 (내 기록)",
      rowHeader: "전지의 방향",
      rows: C.directions.map(function (d) {
        return { id: d.id, label: d.name };
      }),
      cols: C.positions.map(function (p) {
        return { id: p.id, label: p.name };
      }),
      cell: function (row, col) {
        var c = C.cells.filter(function (x) {
          return x.exp === "D" && x.dir === row.id && x.pos === col.id;
        })[0];
        var r = c && recOf(c.id);
        if (!r) return null;
        return { text: r.observed, icon: r.observed === "N극" ? "🔴" : "🔵" };
      },
      emptyText: "아직 기록 없음",
    });
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function qaSwitch() {
    var r = recOf("test");
    return {
      stage: "experiment",
      id: "switch",
      label: "실험 1 관찰",
      question: C.switchCheck.question,
      kind: "choice",
      options: C.switchCheck.choices.slice(),
      answer: { chosen: r ? [r.observed] : [], correct: !!r && r.observed === C.switchCheck.answer, tries: r ? (r.tries || 0) + 1 : 0 },
    };
  }
  function qaBatteryTable() {
    return {
      stage: "experiment",
      id: "records_battery",
      label: "내 관찰 기록(전지 개수)",
      question: "내 관찰 기록(전지 개수별 붙는 둥근 철 고리 개수)",
      kind: "table",
      answer: {
        columns: [
          { key: "battery", label: "전지 개수" },
          { key: "rings", label: "붙는 고리 개수(개)" },
        ],
        rows: cellsOf("B").map(function (c) {
          var r = recOf(c.id);
          return { battery: c.short, rings: r ? String(r.rings) : "" };
        }),
      },
    };
  }
  function qaPoleTable() {
    var rows = [];
    C.directions.forEach(function (d) {
      C.positions.forEach(function (p) {
        var c = C.cells.filter(function (x) {
          return x.exp === "D" && x.dir === d.id && x.pos === p.id;
        })[0];
        var r = c && recOf(c.id);
        rows.push({ dir: d.name, pos: p.name, pole: r ? r.observed : "" });
      });
    });
    return {
      stage: "experiment",
      id: "records_pole",
      label: "내 관찰 기록(전지 방향)",
      question: "내 관찰 기록(전지의 방향과 나침반 위치별로 고른 극)",
      kind: "table",
      answer: {
        columns: [
          { key: "dir", label: "방향" },
          { key: "pos", label: "위치" },
          { key: "pole", label: "고른 극" },
        ],
        rows: rows,
      },
    };
  }

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
    var observations = { switch: null, rings: {}, poles: {} };
    var sr = recOf("test");
    observations.switch = sr ? { observed: sr.observed, correct: sr.observed === C.switchCheck.answer, tries: (sr.tries || 0) + 1 } : null;
    cellsOf("B").forEach(function (c) {
      var r = recOf(c.id);
      observations.rings[c.short] = r ? r.rings : null;
    });
    cellsOf("D").forEach(function (c) {
      var r = recOf(c.id);
      observations.poles[c.short] = r ? { observed: r.observed, correct: r.observed === poleOf(c), tries: (r.tries || 0) + 1 } : null;
    });
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened ? predict.hintsOpened() : undefined,
      observations: observations,
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosity.value(),
      // 질문-답 표준 목록(관리자 "학생 응답" 화면용, docs/admin/responses-spec.md §3.3)
      qa: [].concat(predict.qa("predict"), [qaSwitch(), qaBatteryTable(), qaPoleTable()], quiz.qa("analyze"), conclude.qa("conclude"), curiosity.qa("curiosity")),
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
        return q[qq.id].correct;
      }).length;
      return ["기록한 칸: " + records.count() + "/" + C.cells.length, "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "실험 1·2·3의 관찰 결과를 모두 기록해야 넘어갈 수 있어요. (기록: " + p.done + "/" + p.total + ")";
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
})();
