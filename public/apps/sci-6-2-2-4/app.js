/*
 * app.js — sci-6-2-2-4 "연소 후의 변화가 궁금해!" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 장면(촛대·양초·불꽃, 투명한 아크릴 통, 실험 1의 푸른색 염화 코발트 종이, 실험 2의 석회수 병과 뚜껑)
 *   ② 관찰 카드(실험 전·후 색 견본 + 보기 고르기, 화면의 결과와 같은 보기를 골라야 기록)
 *   ③ 분석 표(내 기록), 정리하기의 궁금한 점 한 줄  만 만든다.
 *
 * 과학 규칙(spec.md 1·5절, 개정 1):
 *   - 실험 1: 아크릴 통 안쪽 벽에 셀로판테이프로 붙인 푸른색 염화 코발트 종이 → 촛불을 덮는다 → 타는 동안 물이 생겨
 *     종이가 조금씩 변하기 시작하고, **촛불이 꺼진 뒤** 관찰하면 붉은색이다(교과서의 관찰 시점). 테이프로 덮인 부분은 물이 닿지 않아 푸른색 그대로.
 *   - 실험 2: 뚜껑을 연 석회수 병과 촛불을 함께 덮는다 → 촛불이 꺼지면 통을 들고 뚜껑을 닫아 흔든다 → 무색투명 → 뿌옇게 흐려짐.
 *   - 그을음·연기는 그리지 않는다(그을음은 불완전 연소 현상). 촛불이 꺼지는 까닭은 설명하지 않는다(탐구 3에서 다룸).
 *   - 촛불이 꺼질 때까지 기다리는 부분은 "빨리 감기(모형)"로 밝힌다. 양초는 타는 동안 조금 짧아진다(양초의 양이 줄어듦).
 * 3D와 2D는 같은 상태(S)와 같은 순서(sequence)를 쓰고 그리는 방법만 다르다.
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

  var EXP = {};
  C.experiments.forEach(function (x) {
    EXP[x.id] = x;
  });
  var EXP_IDS = C.experiments.map(function (x) {
    return x.id;
  });
  var CLEAR_BG = "repeating-conic-gradient(#e7edf3 0 25%, #ffffff 0 50%) 0 0 / 10px 10px";

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return r.exp;
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

  // 실험 화면에 결과가 남아 있는 실험(새로고침·화면 전환 뒤 그 모습으로 되돌림)
  var sceneAt = store.get("sceneAt", null);
  function setSceneAt(id) {
    sceneAt = id || null;
    store.set("sceneAt", sceneAt);
  }
  var checkTries = {}; // 관찰 카드에서 틀린 횟수(기록에 함께 저장)

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: paragraphs(C.intro.paragraphs),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    clearLabel: "🕯️ 실험 전 모습으로",
    clearMessage: "실험 전 모습으로 되돌렸어요. 기록은 그대로 남아 있어요.",
    runTitle: "실험하기",
    busyLabel: "⏩ 실험하는 중… 잘 지켜보세요 👀",
    factors: [
      {
        id: "exp",
        title: "실험 고르기",
        short: "실험",
        phaseTag: false,
        options: C.experiments.map(function (x) {
          return { id: x.id, label: x.name, icon: expIcon(x.id) };
        }),
      },
    ],
    phases: C.experiments.map(function (x) {
      return { id: x.id, name: x.phaseName, lead: x.lead, cells: [{ exp: x.id }] };
    }),
    doneLead: "두 실험을 모두 기록했어요. '다음 단계'로 가서 내 기록을 살펴봐요. 다시 보고 싶은 실험은 언제든 다시 해도 돼요.",
    cellKey: function (sel) {
      return sel.exp;
    },
    runLabel: function (sel) {
      return sel.exp === "A" ? "▶ 촛불을 아크릴 통으로 덮기" : "▶ 촛불과 석회수 병을 아크릴 통으로 덮기";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향",
      tip2D: "2D 화면(모형, 옆에서 본 모습)이에요.",
    },
    observe: observeCard,
    makeRecord: function (sel, observed) {
      return { exp: sel.exp, observed: observed, tries: checkTries[sel.exp] || 0 };
    },
    describeRecord: function (r) {
      return EXP[r.exp].rowLabel + " " + EXP[r.exp].short + " → " + r.observed;
    },
    extras: [safety],
    onRecorded: function (info) {
      // 실험 1을 기록하면 실험 2를 미리 골라 둔다(시간 줄이기). 실험 화면은 실험 2 준비 모습으로 바뀐다.
      if (info && info.phaseCompleted === "A" && !exp.phaseDone("B")) {
        setTimeout(function () {
          if (!document.hidden && !exp.isBusy() && !$("experiment-root").closest("section").hidden) exp.select({ exp: "B" });
        }, 1100);
      }
    },
    onChange: lesson.refresh,
  });

  // 실험 아이콘(모양으로도 구분: 종이 조각 / 유리병)
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
      if (id === "A") {
        n("rect", { x: 8, y: 4, width: 12, height: 20, rx: 1.5, class: "ei-paper" });
        n("rect", { x: 6, y: 11.5, width: 16, height: 5, class: "ei-tape" });
      } else {
        n("rect", { x: 8, y: 7, width: 12, height: 17, rx: 3, class: "ei-jar" });
        n("rect", { x: 9.5, y: 13, width: 9, height: 9.5, rx: 2, class: "ei-lime" });
        n("rect", { x: 10, y: 4, width: 8, height: 3, rx: 1, class: "ei-lid" });
      }
      return s;
    };
  }

  /* ── 관찰·기록 카드: 실험 전·후 견본 + 보기 고르기 ── */
  function chip(color, extraClass) {
    var c = el("span", { class: "swatch-chip" + (extraClass ? " " + extraClass : ""), "aria-hidden": "true" });
    if (color) c.style.background = color;
    return c;
  }
  function observeCard(sel) {
    var x = EXP[sel.exp];
    var afterName = el("span", { class: "swatch-name", text: x.after.text });
    var afterChip = chip(x.after.color, sel.exp === "B" ? "is-milky" : "");
    afterChip.removeAttribute("aria-hidden");
    afterChip.setAttribute("role", "img");
    afterChip.setAttribute("aria-label", "실험 후 견본(색 이름은 '색 이름도 보기' 버튼으로 들을 수 있어요)");
    var nameBtn = el("button", { type: "button", class: "ss-btn small-btn", "aria-pressed": "false", text: "🔤 색 이름도 보기" });
    var row = el("div", { class: "swatch-row" }, [
      el("div", { class: "swatch" }, [el("span", { class: "swatch-label", text: "실험 전" }), chip(x.before.color, x.before.color ? "" : "is-clear"), el("span", { class: "swatch-name is-on", text: x.before.text })]),
      el("span", { class: "arrow", "aria-hidden": "true", text: "→" }),
      el("div", { class: "swatch" }, [el("span", { class: "swatch-label", text: "실험 후 (화면)" }), afterChip, afterName]),
    ]);
    nameBtn.addEventListener("click", function () {
      var on = !afterName.classList.contains("is-on");
      afterName.classList.toggle("is-on", on);
      nameBtn.setAttribute("aria-pressed", String(on));
      nameBtn.textContent = on ? "🔤 색 이름 숨기기" : "🔤 색 이름도 보기";
    });
    // 세로 화면·휴대폰에서는 관찰 카드로 스크롤되면 실험 화면이 위로 밀려나므로, 방금 결과를 사진으로 카드 안에도 보여 준다(fix-1)
    var shot = null;
    try {
      shot = curView && curView.photo ? curView.photo() : null;
    } catch (e) {
      shot = null;
    }
    var body = el("div", { class: "obs-body" }, [
      shot ? el("figure", { class: "obs-photo" }, [shot, el("figcaption", { class: "ss-help", text: "📷 방금 한 실험 화면(모형)" })]) : null,
      row,
      el("div", { class: "swatch-tools" }, [nameBtn, el("span", { class: "ss-help", text: sel.exp === "A" ? "견본은 셀로판테이프가 덮지 않은 부분의 색이에요(모형)." : "견본은 흔든 뒤 석회수의 모습이에요(모형)." })]),
    ]);
    return {
      question: x.question,
      body: body,
      type: "choice",
      choices: x.choices,
      check: function (observed, ctx) {
        checkTries[sel.exp] = ctx.tries;
        if (observed === x.answer) return { ok: true, message: "⭕ 맞아요! 화면에서 본 결과와 같아요. '기록하기'를 눌러요." };
        return "🤔 " + x.wrong;
      },
      checkLabel: "✔️ 확인하기",
      retryLabel: "🔁 다시 실험해 보기",
    };
  }

  /* ── 관찰 카드에서 보기를 고르거나 확인하면 '기록하기' 버튼이 아래 단계 이동 막대에 가리지 않게 올린다(fix-1, 앱 전용) ── */
  function keepAboveFooter(node) {
    if (!node || node.hidden || !node.offsetParent) return;
    var footer = document.querySelector(".ss-footer-nav");
    var limit = (footer ? footer.getBoundingClientRect().top : window.innerHeight) - 10;
    var r = node.getBoundingClientRect();
    if (r.bottom <= limit) return;
    var dy = r.bottom - limit;
    try {
      window.scrollBy({ top: dy, behavior: "smooth" });
    } catch (e) {
      window.scrollBy(0, dy);
    }
  }
  $("experiment-root").addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".ss-observe .ss-obs, .ss-observe .ss-check-btn") : null;
    if (!t) return;
    setTimeout(function () {
      var btns = document.querySelectorAll(".ss-observe button");
      for (var i = 0; i < btns.length; i++) if (/기록하기/.test(btns[i].textContent)) return keepAboveFooter(btns[i]);
    }, 120);
  });

  /* ── 지금 고른 실험을 새로고침 뒤에도 되살린다(앱 전용, 공통 틀은 선택을 저장하지 않음) ── */
  function rememberSel(s) {
    if (!s || !EXP[s.exp]) return;
    store.set("curSel", { exp: s.exp });
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (saved && EXP[saved.exp]) exp.select(saved);
  }

  /* ───────── 두 화면이 함께 쓰는 장면 상태와 실험 순서 ───────── */
  // 단위: 장면 길이(모형). 탁자 윗면 y = 0.
  var G = {
    R: 1.6, // 아크릴 통 반지름
    HC: 3.8, // 아크릴 통 높이
    COVER_X: 0.15, // 덮었을 때 통 가운데
    ASIDE_X: 3.9, // 실험 전 통을 놓아둔 곳
    LIFT: 2.6, // 들어 올리는 높이(불꽃과 병 위로)
    CANDLE_X: -0.45,
    DISH_H: 0.12,
    H0: 1.5, // 양초 처음 길이
    H1: 1.38, // 촛불이 꺼질 때 길이(조금 줄어듦)
    JAR_X: 0.8,
    JAR_H: 1.0,
  };
  function freshState(expId, done) {
    var A = expId !== "B";
    return {
      exp: A ? "A" : "B",
      cupX: A && done ? G.COVER_X : G.ASIDE_X,
      cupY: 0,
      candleH: done ? G.H1 : G.H0,
      flame: done ? 0 : 1,
      paperT: A && done ? 1 : 0,
      lidT: !A && done ? 1 : 0,
      milkT: !A && done ? 1 : 0,
      shake: 0,
      done: !!done,
    };
  }

  // 상태 표시(HUD): 촛불 상태 + 지금 하는 일, 빨리 감기 배지, 화면 읽기용 알림
  function makeHud() {
    var flame = el("span", { class: "hud-flame" });
    var step = el("span", { class: "hud-step" });
    var node = el("div", { class: "hud", "aria-hidden": "true" }, [flame, step]);
    var ff = el("div", { class: "hud-ff", "aria-hidden": "true", hidden: true, text: "⏩ 빨리 감기(모형) · 촛불이 꺼질 때까지" });
    var live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    return {
      nodes: [node, ff, live],
      set: function (st, stepText) {
        flame.textContent = st.flame > 0 ? "🔥 촛불: 켜짐" : "촛불: 꺼짐";
        step.textContent = stepText || "";
        step.hidden = !stepText;
      },
      ff: function (on) {
        ff.hidden = !on;
      },
      say: function (t) {
        live.textContent = t;
      },
      remove: function () {
        [node, ff, live].forEach(function (x) {
          if (x.parentNode) x.parentNode.removeChild(x);
        });
      },
    };
  }
  function idleText(st) {
    if (st.done) return st.exp === "A" ? "종이 색을 살펴봐요" : "석회수를 살펴봐요";
    return st.exp === "A" ? "실험 1 준비: 종이를 붙인 통" : "실험 2 준비: 뚜껑을 연 석회수 병";
  }

  // 실험 순서(3D·2D 공통). api = { st, apply, tween(ms, fn(e, t)), hud, focus(what), home() }
  async function sequence(api, expId) {
    var st = api.st;
    // 탭이 숨겨지면 공통 틀의 트윈이 바로 끝나므로, 숨겨진 동안에는 다음 동작으로 넘어가지 않고 기다린다(fix-1)
    async function tw(ms, fn) {
      await waitVisible();
      await api.tween(ms, fn);
    }
    var fresh = freshState(expId, false);
    Object.keys(fresh).forEach(function (k) {
      st[k] = fresh[k];
    });
    api.apply(true);
    api.hud.set(st, "아크릴 통으로 덮어요");
    await waitVisible();
    await api.wide(); // 들어 올린 통이 화면 위로 잘리지 않게 조금 물러나서 본다(fix-1)
    // ① 통을 들어 옮겨 덮는다
    await tw(450, function (e) {
      st.cupY = G.LIFT * e;
      api.apply();
    });
    await tw(700, function (e) {
      st.cupX = G.ASIDE_X + (G.COVER_X - G.ASIDE_X) * e;
      api.apply();
    });
    await tw(500, function (e) {
      st.cupY = G.LIFT * (1 - e);
      api.apply();
    });
    await waitVisible();
    await api.home();
    // ② 촛불이 꺼질 때까지(빨리 감기) — 불꽃이 점점 작아지고 양초가 조금 짧아진다
    api.hud.ff(true);
    api.hud.set(st, "촛불을 지켜봐요");
    api.hud.say("빨리 감기(모형): 촛불이 꺼질 때까지 기다려요.");
    await tw(2600, function (e, t) {
      st.flame = 1 - 0.7 * t;
      st.candleH = G.H0 - (G.H0 - G.H1) * t;
      if (st.exp === "A") st.paperT = 0.3 * t * t; // 타는 동안 물이 생겨 종이가 조금씩 변하기 시작한다(모형)
      api.apply();
    });
    await tw(350, function (e, t) {
      st.flame = 0.3 * (1 - t);
      api.apply();
    });
    st.flame = 0;
    st.candleH = G.H1;
    api.hud.ff(false);
    api.apply();
    if (st.exp === "A") {
      api.hud.set(st, "촛불이 꺼졌어요 · 종이를 살펴봐요");
      api.hud.say("촛불이 꺼졌어요. 푸른색 염화 코발트 종이를 살펴봐요.");
      await waitVisible();
      await api.focus("paper");
      await tw(1200, function (e) {
        st.paperT = 0.3 + 0.7 * e;
        api.apply();
      });
    } else {
      api.hud.set(st, "촛불이 꺼졌어요 · 통을 들고 뚜껑을 닫아요");
      api.hud.say("촛불이 꺼졌어요. 통을 들어 올리고 석회수 병의 뚜껑을 닫아요.");
      await waitVisible();
      await api.wide();
      await tw(400, function (e) {
        st.cupY = G.LIFT * e;
        api.apply();
      });
      await tw(600, function (e) {
        st.cupX = G.COVER_X + (G.ASIDE_X - G.COVER_X) * e;
        api.apply();
      });
      await tw(350, function (e) {
        st.cupY = G.LIFT * (1 - e);
        api.apply();
      });
      await tw(750, function (e) {
        st.lidT = e;
        api.apply();
      });
      api.hud.set(st, "병을 흔들어요");
      api.hud.say("뚜껑을 닫고 병을 흔들어요.");
      await waitVisible();
      await api.focus("jar");
      await tw(1300, function (e, t) {
        st.shake = 0.26 * Math.sin(t * Math.PI * 8) * (1 - t * 0.6);
        st.milkT = Math.min(1, t * 1.25);
        api.apply();
      });
      st.shake = 0;
      st.milkT = 1;
      api.apply();
    }
    st.done = true;
    api.hud.set(st, idleText(st));
    api.hud.say(st.exp === "A" ? "종이의 색이 변했는지 살펴보고 관찰 결과를 골라요." : "석회수가 어떻게 변했는지 살펴보고 관찰 결과를 골라요.");
  }

  // 페이지가 보일 때까지 기다린다(숨겨진 채 실험이 끝나 저장 키를 쓰면, 떠날 때 보낸 저장과 로컬이 달라져 충돌 창이 뜬다)
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
  var curView = null; // 관찰 카드에 넣을 '실험 화면 사진'을 찍을 지금 화면

  function makeView(api, disposeFn, resetView, whenVisible, photo) {
    function setTo(expId, done) {
      var fresh = freshState(expId, done);
      Object.keys(fresh).forEach(function (k) {
        api.st[k] = fresh[k];
      });
      api.apply(true);
      api.hud.set(api.st, idleText(api.st));
    }
    var view = {
      photo: photo,
      whenVisible: whenVisible,
      highlight: function (s) {
        rememberSel(s);
        if (s && EXP[s.exp] && s.exp !== api.st.exp) {
          setTo(s.exp, false);
          api.home(); // 앞 실험에서 가까이 다가간 시점을 처음 방향으로
        }
      },
      run: async function (sel) {
        setSceneAt(null);
        await sequence(api, sel.exp);
        await waitVisible(); // 결과를 저장하는 일(여기와 공통 틀의 "scene")은 페이지가 보일 때만
        setSceneAt(sel.exp);
      },
      showInstant: function (sel) {
        // 결과 장면은 '기록한 실험'만 되살린다. 기록 전에 새로고침하면 관찰 카드 없이 결과만 남지 않게 실험 전 모습으로 둔다(fix-1).
        if (sceneAt !== sel.exp || !recOf(sel.exp)) return;
        setTo(sel.exp, true);
      },
      clear: function () {
        setSceneAt(null);
        setTo(api.st.exp, false);
        api.home();
      },
      resetView: resetView,
      dispose: function () {
        if (curView === view) curView = null;
        disposeFn();
      },
    };
    curView = view;
    return view;
  }

  /* ───────── 2D 대체 화면: 옆에서 본 모습 ───────── */
  function build2D(root) {
    var NS = "http://www.w3.org/2000/svg";
    function n(tag, a, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(a || {}).forEach(function (k) {
        e.setAttribute(k, a[k]);
      });
      if (text != null) e.textContent = text;
      return e;
    }
    var K = 70; // 장면 1 → 70 px
    var X0 = 150;
    var Y0 = 470; // 탁자 윗면
    function px(x) {
      return X0 + x * K;
    }
    function py(y) {
      return Y0 - y * K;
    }
    var disposed = false;
    var hud = makeHud();
    var svg = n("svg", { viewBox: "0 0 600 510", class: "side-svg", role: "img", "aria-label": "촛불과 아크릴 통 실험(2D 모형, 옆에서 본 모습)" });
    var defs = n("defs");
    var pat = n("pattern", { id: "s6224-clear", width: 10, height: 10, patternUnits: "userSpaceOnUse" });
    pat.appendChild(n("rect", { width: 10, height: 10, class: "s2-clear-a" }));
    pat.appendChild(n("rect", { width: 5, height: 5, class: "s2-clear-b" }));
    pat.appendChild(n("rect", { x: 5, y: 5, width: 5, height: 5, class: "s2-clear-b" }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    // 탁자
    svg.appendChild(n("rect", { x: 0, y: Y0, width: 600, height: 40, class: "s2-table" }));

    // 아크릴 통 뒤쪽 면(연한 채움) + 종이(뒤쪽 벽에 붙어 통과 함께 움직임)
    var R = G.R * K;
    var HCp = G.HC * K;
    var cupBack = n("g", {});
    cupBack.appendChild(n("rect", { x: -R, y: -HCp, width: 2 * R, height: HCp, class: "s2-cup-fill" }));
    var paper = n("g", {});
    var PW = 0.8 * K,
      PH = 1.1 * K,
      PX = 0.45 * K,
      PY = -2.3 * K;
    var pTop = n("rect", { x: PX - PW / 2, y: PY - PH / 2, width: PW, height: PH * 0.38, class: "s2-paper" });
    var pMid = n("rect", { x: PX - PW / 2, y: PY - PH / 2 + PH * 0.38, width: PW, height: PH * 0.24, class: "s2-paper s2-paper-keep" });
    var pBot = n("rect", { x: PX - PW / 2, y: PY - PH / 2 + PH * 0.62, width: PW, height: PH * 0.38, class: "s2-paper" });
    var tape = n("rect", { x: PX - PW / 2 - 8, y: PY - PH / 2 + PH * 0.38, width: PW + 16, height: PH * 0.24, class: "s2-tape" });
    paper.appendChild(pTop);
    paper.appendChild(pMid);
    paper.appendChild(pBot);
    paper.appendChild(tape);
    paper.appendChild(n("text", { x: PX, y: PY - PH / 2 - 10, "text-anchor": "middle", class: "s2-lbl-s" }, "염화 코발트 종이"));
    paper.appendChild(n("text", { x: PX - PW / 2, y: PY + PH / 2 + 16, class: "s2-lbl-xs" }, "▲ 셀로판테이프"));
    cupBack.appendChild(paper);
    svg.appendChild(cupBack);

    // 촛대 + 양초 + 불꽃
    var cx = px(G.CANDLE_X);
    svg.appendChild(n("rect", { x: cx - 36, y: Y0 - G.DISH_H * K, width: 72, height: G.DISH_H * K, rx: 4, class: "s2-dish" }));
    var candle = n("rect", { x: cx - 18, width: 36, class: "s2-candle" });
    svg.appendChild(candle);
    var wick = n("line", { x1: cx, x2: cx, class: "s2-wick" });
    svg.appendChild(wick);
    var flameG = n("g", {});
    var flameIn = n("g", { class: "s2-flicker" });
    flameIn.appendChild(n("ellipse", { cx: 0, cy: -24, rx: 11, ry: 26, class: "s2-flame" }));
    flameIn.appendChild(n("ellipse", { cx: 0, cy: -16, rx: 5.5, ry: 14, class: "s2-flame-core" }));
    flameIn.appendChild(n("ellipse", { cx: 0, cy: -4, rx: 5, ry: 5, class: "s2-flame-base" }));
    flameG.appendChild(flameIn);
    svg.appendChild(flameG);
    svg.appendChild(n("text", { x: cx, y: Y0 + 28, "text-anchor": "middle", class: "s2-lbl" }, "양초"));

    // 석회수 병(실험 2) + 뚜껑
    var jarG = n("g", {});
    var jarIn = n("g", {});
    var JW = 0.84 * K,
      JH = G.JAR_H * K;
    jarIn.appendChild(n("rect", { x: -JW / 2, y: -JH, width: JW, height: JH, rx: 8, class: "s2-jar" }));
    var liquid = n("rect", { x: -JW / 2 + 5, y: -JH * 0.66, width: JW - 10, height: JH * 0.66 - 5, rx: 5, class: "s2-lime" });
    jarIn.appendChild(liquid);
    jarIn.appendChild(n("rect", { x: -JW * 0.36, y: -JH - 8, width: JW * 0.72, height: 8, class: "s2-jar-neck" }));
    var lid = n("rect", { x: -JW * 0.4, y: -8, width: JW * 0.8, height: 10, rx: 3, class: "s2-lid" });
    jarIn.appendChild(lid);
    jarG.appendChild(jarIn);
    jarG.appendChild(n("text", { x: 0, y: 28, "text-anchor": "middle", class: "s2-lbl" }, "석회수"));
    var lidLbl = n("text", { "text-anchor": "middle", class: "s2-lbl-xs" }, "뚜껑");
    jarG.appendChild(lidLbl);
    svg.appendChild(jarG);

    // 아크릴 통 앞쪽 테두리(가장 위에)
    var cupFront = n("g", {});
    cupFront.appendChild(n("rect", { x: -R, y: -HCp, width: 2 * R, height: HCp, class: "s2-cup-line" }));
    cupFront.appendChild(n("line", { x1: -R + 10, y1: -HCp + 14, x2: -R + 10, y2: -24, class: "s2-cup-shine" }));
    cupFront.appendChild(n("text", { x: 0, y: -HCp - 10, "text-anchor": "middle", class: "s2-lbl" }, "아크릴 통"));
    svg.appendChild(cupFront);

    var head = el("div", { class: "s2-head" }, [hud.nodes[0], hud.nodes[1]]);
    var caption = el("p", { class: "s2-caption" });
    var box = el("div", { class: "s2-wrap" }, [head, svg, caption, hud.nodes[2]]);
    root.appendChild(box);

    var BLUE = C.experiments[0].before.color;
    var RED = C.experiments[0].after.color;
    function mix(a, b, t) {
      var pa = parseInt(a.slice(1), 16),
        pb = parseInt(b.slice(1), 16);
      var r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t));
      var g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t));
      var bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
      return "rgb(" + r + "," + g + "," + bl + ")";
    }
    var st = freshState("A", false);
    function apply() {
      if (disposed) return;
      var A = st.exp === "A";
      var t = "translate(" + px(st.cupX).toFixed(1) + " " + py(st.cupY).toFixed(1) + ")";
      cupBack.setAttribute("transform", t);
      cupFront.setAttribute("transform", t);
      paper.style.display = A ? "" : "none";
      caption.textContent = A ? "옆에서 본 모습(모형). 종이는 통 안쪽 벽(뒤쪽)에 붙어 있어요." : "옆에서 본 모습(모형). 뚜껑을 연 석회수 병과 촛불을 함께 덮어요.";
      var pc = mix(BLUE, RED, st.paperT);
      pTop.style.fill = pc;
      pBot.style.fill = pc;
      var top = Y0 - (G.DISH_H + st.candleH) * K;
      candle.setAttribute("y", top.toFixed(1));
      candle.setAttribute("height", (st.candleH * K).toFixed(1));
      wick.setAttribute("y1", top.toFixed(1));
      wick.setAttribute("y2", (top - 9).toFixed(1));
      flameG.style.display = st.flame > 0.01 ? "" : "none";
      flameG.setAttribute("transform", "translate(" + cx + " " + (top - 6).toFixed(1) + ") scale(" + (0.55 + 0.45 * st.flame).toFixed(3) + " " + st.flame.toFixed(3) + ")");
      jarG.style.display = A ? "none" : "";
      jarG.setAttribute("transform", "translate(" + px(G.JAR_X) + " " + Y0 + ")");
      jarIn.setAttribute("transform", "rotate(" + ((st.shake * 180) / Math.PI).toFixed(2) + " 0 0)");
      // 뚜껑: 탁자 위(오른쪽 앞) → 병 입구(살짝 들어 올리며 옮긴다)
      var lx0 = (2.15 - G.JAR_X) * K,
        ly0 = 0,
        lx1 = 0,
        ly1 = -JH - 8;
      var lt = st.lidT;
      var lx = lx0 + (lx1 - lx0) * lt;
      var ly = ly0 + (ly1 - ly0) * lt - Math.sin(Math.PI * lt) * 40;
      lid.setAttribute("transform", "translate(" + lx.toFixed(1) + " " + ly.toFixed(1) + ")");
      lidLbl.setAttribute("x", lx.toFixed(1));
      lidLbl.setAttribute("y", (ly - 14).toFixed(1));
      lidLbl.style.display = lt > 0.02 ? "none" : "";
      liquid.style.fillOpacity = String(0.25 + 0.7 * st.milkT);
      liquid.classList.toggle("is-milky", st.milkT > 0.02);
      liquid.style.fill = st.milkT > 0.02 ? mix("#d4e6f3", "#e6e9ec", st.milkT) : "";
    }
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
      wide: function () {
        return Promise.resolve();
      },
      home: function () {
        return Promise.resolve();
      },
    };
    apply();
    hud.set(st, idleText(st));
    return makeView(
      api,
      function () {
        disposed = true;
        hud.remove();
      },
      function () {},
      null,
      function () {
        var c = svg.cloneNode(true);
        c.setAttribute("class", "side-svg photo-svg");
        c.setAttribute("viewBox", "0 170 600 340"); // 실험이 끝난 뒤에는 통이 내려와 있으므로 위쪽 빈 곳을 잘라 크게 보인다
        c.setAttribute("aria-label", "방금 한 실험 화면(2D 모형)");
        return c;
      }
    );
  }

  /* ───────── 3D 화면 ───────── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 8.4, depth: 6.4, center: [1.75, 1.6, 0] },
      viewDir: [0, 0.4, 0.92],
      minDistance: 2.4,
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var hud = makeHud();
      hud.nodes.forEach(function (x) {
        container.appendChild(x);
      });

      // 탁자(조명에 덜 좌우되게 MeshBasicMaterial)
      var table = M.table(11, 6.5, 0xd9c7a3);
      table.material.dispose();
      table.material = new T.MeshBasicMaterial({ color: 0xe3d4b4 });
      table.position.x = 1.6;
      v.root.add(table);
      v.onThemeChange(function (dark) {
        table.material.color.set(dark ? 0x4d4436 : 0xe3d4b4);
      });

      // 촛대 + 양초 + 심지 + 불꽃(모형)
      var dish = new T.Mesh(new T.CylinderGeometry(0.5, 0.56, G.DISH_H, 32), M.material(0xa9b2bd, { metalness: 0.5, roughness: 0.35 }));
      dish.position.set(G.CANDLE_X, G.DISH_H / 2, 0.1);
      var candle = new T.Mesh(new T.CylinderGeometry(0.24, 0.24, 1, 28), M.material(0xf6f0de, { roughness: 0.6 }));
      candle.position.set(G.CANDLE_X, 0, 0.1);
      var wick = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.16, 8), M.material(0x2a2a2a));
      var flame = new T.Group();
      var fOuter = new T.Mesh(new T.SphereGeometry(0.12, 20, 16), new T.MeshBasicMaterial({ color: 0xffb938, transparent: true, opacity: 0.9, depthWrite: false }));
      fOuter.scale.set(1, 2.5, 1);
      fOuter.position.y = 0.26;
      var fCore = new T.Mesh(new T.SphereGeometry(0.06, 16, 12), new T.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.95, depthWrite: false }));
      fCore.scale.set(1, 2.4, 1);
      fCore.position.y = 0.2;
      var fBase = new T.Mesh(new T.SphereGeometry(0.055, 14, 10), new T.MeshBasicMaterial({ color: 0x4a7bd6, transparent: true, opacity: 0.75, depthWrite: false }));
      fBase.position.y = 0.06;
      flame.add(fBase, fOuter, fCore);
      var fLight = new T.PointLight(0xffb45a, 3, 0, 2);
      fLight.position.y = 0.3;
      flame.add(fLight);
      v.root.add(dish, candle, wick, flame);
      var candleLabel = M.label("양초", { height: 0.34, bold: true });
      candleLabel.position.set(G.CANDLE_X - 0.1, 0.45, 0.95);
      v.root.add(candleLabel);

      // 아크릴 통(투명): 옆면 + 윗면 + 테두리
      var cup = new T.Group();
      var acryl = new T.MeshStandardMaterial({ color: 0xdcecff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0, side: T.DoubleSide, depthWrite: false });
      var wall = new T.Mesh(new T.CylinderGeometry(G.R, G.R, G.HC, 56, 1, true), acryl);
      wall.position.y = G.HC / 2;
      var lidTop = new T.Mesh(new T.CircleGeometry(G.R, 56), acryl);
      lidTop.rotation.x = -Math.PI / 2;
      lidTop.position.y = G.HC;
      var rimMat = new T.MeshBasicMaterial({ color: 0x8fb4d9, transparent: true, opacity: 0.75 });
      var rimB = new T.Mesh(new T.TorusGeometry(G.R, 0.025, 8, 72), rimMat);
      rimB.rotation.x = Math.PI / 2;
      rimB.position.y = 0.02;
      var rimT = rimB.clone();
      rimT.position.y = G.HC;
      cup.add(wall, lidTop, rimB, rimT);
      var cupLabel = M.label("아크릴 통", { height: 0.36, bold: true });
      cupLabel.position.set(0, G.HC + 0.4, 0);
      cup.add(cupLabel);
      v.root.add(cup);

      // 실험 1: 통 안쪽 벽(뒤쪽)에 붙인 푸른색 염화 코발트 종이 + 셀로판테이프(가운데 띠)
      var paper = new T.Group();
      var PW = 0.8,
        PH = 1.1;
      var BLUE = new T.Color(C.experiments[0].before.color);
      var RED = new T.Color(C.experiments[0].after.color);
      var exposedMat = new T.MeshStandardMaterial({ color: BLUE.clone(), roughness: 0.85, side: T.DoubleSide });
      var keepMat = new T.MeshStandardMaterial({ color: BLUE.clone(), roughness: 0.85, side: T.DoubleSide });
      var pTop = new T.Mesh(new T.PlaneGeometry(PW, PH * 0.38), exposedMat);
      pTop.position.y = PH * 0.31;
      var pMid = new T.Mesh(new T.PlaneGeometry(PW, PH * 0.24), keepMat);
      var pBot = new T.Mesh(new T.PlaneGeometry(PW, PH * 0.38), exposedMat);
      pBot.position.y = -PH * 0.31;
      var tape = new T.Mesh(new T.PlaneGeometry(PW + 0.24, PH * 0.26), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.1, side: T.DoubleSide, depthWrite: false }));
      tape.position.z = 0.012;
      paper.add(pTop, pMid, pBot, tape);
      paper.position.set(0, 2.3, -(G.R - 0.08));
      var paperLabel = M.label("푸른색 염화 코발트 종이", { height: 0.32 });
      paperLabel.position.set(0, PH / 2 + 0.25, 0.05);
      var tapeLabel = M.label("셀로판테이프", { height: 0.26 });
      tapeLabel.position.set(PW / 2 + 0.62, 0, 0.05);
      paper.add(paperLabel, tapeLabel);
      cup.add(paper);

      // 실험 2: 석회수 병(무색투명) + 뚜껑
      var jar = new T.Group();
      jar.position.set(G.JAR_X, 0, 0.1);
      var glass = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, G.JAR_H, 32, 1, true), new T.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.28, roughness: 0.05, side: T.DoubleSide, depthWrite: false }));
      glass.position.y = G.JAR_H / 2;
      var jarBottom = new T.Mesh(new T.CircleGeometry(0.42, 32), new T.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false }));
      jarBottom.rotation.x = -Math.PI / 2;
      jarBottom.position.y = 0.01;
      var neck = new T.Mesh(new T.CylinderGeometry(0.3, 0.38, 0.14, 28, 1, true), new T.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false }));
      neck.position.y = G.JAR_H + 0.07;
      var CLEAR = new T.Color(0xd4e6f3);
      var MILK = new T.Color(0xeceff2);
      var limeMat = new T.MeshStandardMaterial({ color: CLEAR.clone(), transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false });
      var lime = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.62, 32), limeMat);
      lime.position.y = 0.33;
      var lidMesh = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.12, 28), M.material(0x3a4250, { roughness: 0.5 }));
      jar.add(glass, jarBottom, neck, lime, lidMesh);
      var jarLabel = M.label("석회수", { height: 0.3, bold: true });
      jarLabel.position.set(0.2, 0.35, 0.8);
      var lidLabel = M.label("뚜껑", { height: 0.3 });
      jar.add(jarLabel, lidLabel);
      v.root.add(jar);
      var LID0 = new T.Vector3(2.15 - G.JAR_X, 0.06, 1.35 - 0.1); // 탁자 위(오른쪽 앞)
      var LID1 = new T.Vector3(0, G.JAR_H + 0.2, 0); // 병 입구
      lidLabel.position.copy(LID0).add(new T.Vector3(0, 0.4, 0));

      // 불꽃이 살짝 흔들리는 모습(렌더할 때마다)
      var st = freshState("A", false);
      var flick = 1;
      v.scene.onBeforeRender = function () {
        if (st.flame <= 0) return;
        var tm = performance.now();
        flick = 1 + 0.06 * Math.sin(tm / 85) + 0.035 * Math.sin(tm / 31);
        flame.scale.set(0.55 + 0.45 * st.flame, st.flame * flick, 0.55 + 0.45 * st.flame);
      };

      function apply() {
        var A = st.exp === "A";
        cup.position.set(st.cupX, st.cupY, 0);
        paper.visible = A;
        exposedMat.color.copy(BLUE).lerp(RED, st.paperT);
        candle.scale.y = st.candleH;
        candle.position.y = G.DISH_H + st.candleH / 2;
        var top = G.DISH_H + st.candleH;
        wick.position.set(G.CANDLE_X, top + 0.06, 0.1);
        flame.position.set(G.CANDLE_X, top + 0.05, 0.1);
        flame.visible = st.flame > 0.01;
        flame.scale.set(0.55 + 0.45 * st.flame, Math.max(0.001, st.flame * flick), 0.55 + 0.45 * st.flame);
        fLight.intensity = 3 * st.flame;
        jar.visible = !A;
        jar.rotation.z = st.shake;
        var lt = st.lidT;
        lidMesh.position.lerpVectors(LID0, LID1, lt);
        lidMesh.position.y += Math.sin(Math.PI * lt) * 0.7;
        lidLabel.visible = lt < 0.02;
        limeMat.color.copy(CLEAR).lerp(MILK, st.milkT);
        limeMat.opacity = 0.22 + 0.7 * st.milkT;
        limeMat.depthWrite = st.milkT > 0.9;
      }
      apply();
      hud.set(st, idleText(st));

      // 좁은 화면(휴대폰)에서는 이름표를 키운다
      var tags = [candleLabel, cupLabel, paperLabel, tapeLabel, jarLabel, lidLabel].map(function (sp) {
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
        focus: function (what) {
          if (what === "paper") return v.focus([G.COVER_X, 2.2, -1.3], 0.62, 700);
          return v.focus([G.JAR_X, 0.7, 0.1], 0.55, 600);
        },
        home: function () {
          return v.flyHome(350);
        },
        wide: function () {
          var narrow = (container.clientWidth || 1024) < 600;
          return v.focus([1.9, narrow ? 3.0 : 2.3, 0], narrow ? 1.5 : 1.08, 350);
        },
      };
      v.render();
      return makeView(
        api,
        function () {
          if (labelRO) labelRO.disconnect();
          v.scene.onBeforeRender = function () {};
          hud.remove();
          v.dispose();
        },
        v.resetView,
        v.whenVisible,
        function () {
          var p = v.snapshot({ width: 560 });
          return p ? el("img", { src: p.url, alt: "방금 한 실험 화면(3D 모형)", class: "photo-img" }) : null;
        }
      );
    });
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  function drawResults() {
    var tn = $("toast");
    if (tn) tn.hidden = true; // 실험 단계의 완료 알림이 표를 가리지 않게
    S.TableChart.renderMatrix($("result-table"), {
      caption: "촛불이 꺼진 뒤의 변화 (내 기록)",
      rowHeader: "실험",
      rows: C.experiments.map(function (x) {
        return { id: x.id, label: x.rowLabel };
      }),
      cols: [
        { id: "material", label: "확인에 쓴 것" },
        { id: "before", label: "실험 전" },
        { id: "after", label: "실험 후 (내 기록)" },
      ],
      cell: function (row, col) {
        var x = EXP[row.id];
        if (col.id === "material") return { text: x.material };
        if (col.id === "before") return { text: x.before.text, color: x.before.color || CLEAR_BG };
        var r = recOf(row.id);
        if (!r) return null;
        return { text: r.observed, color: r.observed === x.answer ? x.after.color : null };
      },
      emptyText: "아직 기록 없음",
    });
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function obsQa() {
    return C.experiments.map(function (x) {
      var r = recOf(x.id);
      return {
        stage: "experiment",
        id: "obs_" + x.id,
        label: x.rowLabel + " 관찰",
        question: x.question,
        kind: "choice",
        options: x.choices.slice(),
        answer: { chosen: r ? [r.observed] : [], correct: !!r && r.observed === x.answer, tries: r ? (r.tries || 0) + 1 : 0 },
      };
    });
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
    var observations = {};
    C.experiments.forEach(function (x) {
      var r = recOf(x.id);
      observations[x.rowLabel] = { material: x.material, before: x.before.text, observed: r ? r.observed : null, tries: r ? (r.tries || 0) + 1 : 0 };
    });
    return {
      predict: predict.values(),
      hintsOpened: predict.hintsOpened ? predict.hintsOpened() : undefined,
      observations: observations,
      analysis: analysis,
      conclusion: conclude.values().conclusion,
      curiosity: curiosity.value(),
      // 질문-답 표준 목록(관리자 "학생 응답" 화면용, docs/admin/responses-spec.md §3.3)
      qa: [].concat(predict.qa("predict"), obsQa(), quiz.qa("analyze"), conclude.qa("conclude"), curiosity.qa("curiosity")),
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
      return ["기록한 실험: " + records.count() + "/" + EXP_IDS.length, "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
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
        return exp.allDone() || "실험 1과 실험 2의 관찰 결과를 모두 기록해야 넘어갈 수 있어요. (기록: " + p.done + "/" + p.total + ")";
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
