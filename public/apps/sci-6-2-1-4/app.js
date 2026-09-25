/*
 * app.js — sci-6-2-1-4 "태양 고도와 태양 에너지양의 관계는?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·저장(로그인 필수, app_progress, 완료 저장)·예상/분석/정리 화면을 맡고,
 * 이 파일은 아래만 만든다(spec.md "개정 1": 각도 슬라이더로 모든 각도 살펴보기).
 *   ① 실험하기 화면: 3D/2D 장면(스마트 기기 화면·센서·막대·LED 손전등·빛줄기·빛 자국·그림자·각도 표시),
 *      각도 슬라이더(10°~90°, 1° 단위, 30°·80° 눈금 버튼), 값 패널, '기록하기', 내 기록 목록
 *      - 공통 틀 experiment.js는 "조건 고르기 → 실행 → 관찰 카드" 흐름이라 슬라이더형에 맞지 않아 쓰지 않는다.
 *        3D↔2D 전환·렌더러 해제·새로고침 복원은 같은 방식으로 이 파일에서 한다(공통 틀은 고치지 않음).
 *   ② 기록·분석하기: 표 + 꺾은선그래프(x 각도, y 빛의 세기), 내 기록으로 채점하는 분석 질문
 *   ③ 마치기: detail(+detail.qa)
 *
 * 모형(지도서 외 값, 화면에 "모형"으로 밝힘):
 *   빛의 세기 = round(1000 × sin(각도))  → 30° 500, 80° 985
 *   그림자 길이 = 5 ÷ tan(각도) cm, 소수 첫째 자리(빛이 나란하게 들어온다고 봄) → 30° 8.7 cm, 80° 0.9 cm, 90° 0.0 cm
 *   빛이 닿는 면적(빛 자국) = 빛줄기 단면 ÷ sin(각도) → 각이 작을수록 넓고 흐리게
 *   손전등–화면 거리 20 cm는 늘 그대로(지도서 144쪽 "거리를 일정하게").
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

  /* ───────── 모형 값 ───────── */
  var RAD = Math.PI / 180;
  var REQ = C.required.map(function (r) {
    return r.deg;
  }); // [30, 80]
  function clampDeg(d) {
    d = Math.round(Number(d));
    if (!isFinite(d)) d = C.angleStart;
    return Math.min(C.angleMax, Math.max(C.angleMin, d));
  }
  function readingOf(deg) {
    return Math.round(C.intensityK * Math.sin(deg * RAD));
  }
  function shadowOf(deg) {
    if (deg >= 90) return 0;
    return Math.round((C.rodHeightCm / Math.tan(deg * RAD)) * 10) / 10;
  }
  function cm1(x) {
    return Number(x).toFixed(1);
  }
  function isRequired(deg) {
    return REQ.indexOf(deg) >= 0;
  }
  function reqInfo(deg) {
    return C.required.filter(function (r) {
      return r.deg === deg;
    })[0];
  }

  /* ───────── 기록(각도마다 하나, store "records") ───────── */
  var recs = store.get("records", []);
  if (!Array.isArray(recs)) recs = [];
  recs = recs.filter(function (r) {
    return r && typeof r.angle === "number";
  });
  function saveRecs() {
    store.set("records", recs);
  }
  function recGet(deg) {
    for (var i = 0; i < recs.length; i++) if (recs[i].angle === deg) return recs[i];
    return null;
  }
  function recList() {
    return recs.slice().sort(function (a, b) {
      return a.angle - b.angle;
    });
  }
  function extraCount() {
    return recs.filter(function (r) {
      return !isRequired(r.angle);
    }).length;
  }
  function requiredDone() {
    return REQ.every(function (d) {
      return !!recGet(d);
    });
  }
  function requiredCount() {
    return REQ.filter(function (d) {
      return !!recGet(d);
    }).length;
  }

  /* ───────── 분석 질문: 30°·80° 가운데 빛의 세기가 더 큰 쪽(내 기록으로 채점) ───────── */
  C.quiz.forEach(function (q) {
    if (q.dataGraded === "brighterOf30and80") {
      q.grade = function (choice) {
        var a = recGet(30);
        var b = recGet(80);
        var ans = a && b ? (b.reading > a.reading ? "80" : a.reading > b.reading ? "30" : null) : q.answer[0];
        return choice.length === 1 && choice[0] === ans;
      };
    }
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리(결론 + 선택 한 줄) ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
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

  /* ───────── 2. 실험하기: 화면 틀 ───────── */
  var angle = clampDeg(store.get("angle", C.angleStart));
  var saveAngle = S.debounce(function () {
    store.set("angle", angle);
  }, 300);

  var R = {};
  (function buildExperimentUI() {
    var root = $("experiment-root");
    root.textContent = "";

    // 실험 방법(접기 상태 저장)
    var intro = el("div");
    C.intro.paragraphs.forEach(function (p) {
      intro.appendChild(S.rich(p, "p"));
    });
    var det = el("details", { class: "ss-card ss-intro" }, [el("summary", { text: C.intro.title }), intro]);
    det.open = store.get("intro", true) !== false;
    det.addEventListener("toggle", function () {
      store.set("intro", det.open);
    });
    root.appendChild(det);
    R.lead = el("p", { class: "ss-lead", "aria-live": "polite" });
    root.appendChild(R.lead);

    // 왼쪽(세로 화면에서는 위): 실험 화면
    R.view3d = el("div", { class: "ss-view3d" });
    R.view2d = el("div", { class: "ss-view2d", hidden: true });
    R.tip = el("p", { class: "ss-view-tip" });
    R.loading = el("p", { class: "ss-view-loading", text: "3D 실험실을 준비하고 있어요…" });
    R.hudNum = el("span", { class: "lux-num" });
    R.hudSub = el("span", { class: "lux-sub" });
    R.hud = el("div", { class: "lux-hud", "aria-hidden": "true" }, [
      el("span", { class: "lux-app", text: "📱 조도 측정 앱(모형)" }),
      el("span", { class: "lux-row" }, [el("span", { class: "lux-label", text: "빛의 세기" }), R.hudNum]),
      R.hudSub,
    ]);
    R.viewBox = el("div", { class: "ss-exp-view" }, [R.view3d, R.view2d, el("div", { class: "ss-view-badge", "aria-hidden": "true", text: "모형" }), R.hud, R.tip, R.loading]);
    R.btnReset = el("button", { type: "button", class: "ss-btn", text: "🎥 처음 방향으로" });
    R.btnToggle = el("button", { type: "button", class: "ss-btn", text: "2D로 보기" });
    var viewCol = el("div", { class: "ss-exp-view-col" }, [R.viewBox, el("div", { class: "ss-row ss-view-tools" }, [R.btnReset, R.btnToggle])]);

    // 오른쪽(세로 화면에서는 아래): ① 각도 바꾸고 기록하기
    R.range = el("input", {
      type: "range",
      class: "ang-range",
      id: "ang-range",
      min: String(C.angleMin),
      max: String(C.angleMax),
      step: "1",
      "aria-label": "손전등과 화면이 이루는 각",
    });
    R.range.value = String(angle);
    R.snaps = {};
    var snapBox = el("div", { class: "ang-snaps" });
    C.required.forEach(function (r) {
      var b = el(
        "button",
        {
          type: "button",
          class: "ang-snap",
          "aria-pressed": "false",
          onclick: function () {
            setAngle(r.deg, true);
          },
        },
        [el("span", { class: "ang-snap-deg", text: r.label }), el("span", { class: "ang-snap-note", text: r.note })]
      );
      b.style.left = pos(r.deg);
      R.snaps[r.deg] = b;
      snapBox.appendChild(b);
    });
    var scale = el("div", { class: "ang-scale", "aria-hidden": "true" });
    [10, 30, 50, 70, 90].forEach(function (d) {
      var t = el("span", { class: "ang-tick", text: d + "°" });
      t.style.left = pos(d);
      scale.appendChild(t);
    });
    R.minus = el("button", { type: "button", class: "ss-btn ang-step", "aria-label": "각도 1° 줄이기", title: "1° 줄이기", text: "◀" });
    R.plus = el("button", { type: "button", class: "ss-btn ang-step", "aria-label": "각도 1° 늘리기", title: "1° 늘리기", text: "▶" });
    R.valAngle = el("strong", { class: "val-num" });
    R.valLux = el("strong", { class: "val-num" });
    R.valShadow = el("strong", { class: "val-num" });
    function tile(label, num, unit, cls) {
      return el("div", { class: "val-tile " + (cls || "") }, [el("span", { class: "val-label", text: label }), el("span", { class: "val-line" }, [num, unit ? el("span", { class: "val-unit", text: unit }) : null])]);
    }
    R.live = el("p", { class: "ss-sr-only", "aria-live": "polite" });
    R.record = el("button", { type: "button", class: "ss-btn ss-btn-primary ss-btn-big ss-wide" });
    R.recMsg = el("p", { class: "ss-help rec-msg", "aria-live": "polite" });
    // 크게 보기(enlarge())가 켜지면 이 노드를 그대로 장면 안 막대(또는 좁은 화면 카드)로 옮긴다(scenePanel).
    R.valGrid = el("div", { class: "val-grid" }, [tile("각도", R.valAngle, "°", "is-angle"), tile("빛의 세기", R.valLux, "", "is-lux"), tile("그림자 길이", R.valShadow, "cm", "is-shadow")]);
    var ctrlCard = el("div", { class: "ss-card ss-step-card ang-card" }, [
      el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: "①" }), " 각도를 바꾸고 기록하기"]),
      el("p", { class: "ang-how", text: "슬라이더를 끌거나 눈금 버튼·◀ ▶(1°씩)을 눌러요." }),
      el("div", { class: "ang-row" }, [R.minus, el("div", { class: "ang-track" }, [snapBox, R.range, scale]), R.plus]),
      R.valGrid,
      R.live,
      R.record,
      R.recMsg,
      S.rich(C.modelNote, "p"),
    ]);
    ctrlCard.lastChild.className = "ss-help ss-model-note";

    // ② 내 기록
    R.reqChips = el("div", { class: "req-chips" });
    R.extraNote = el("p", { class: "ss-help extra-note" });
    R.recList = el("ul", { class: "rec-list" });
    var recCard = el("div", { class: "ss-card ss-step-card rec-card" }, [
      el("h3", { class: "ss-step-h" }, [el("span", { class: "ss-step-n", text: "②" }), " 내 기록"]),
      R.reqChips,
      R.extraNote,
      R.recList,
    ]);

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

    R.panel = el("div", { class: "ss-exp-panel" }, [ctrlCard, recCard, safety]);
    R.layout = el("div", { class: "ss-exp-layout" }, [viewCol, R.panel]);
    root.appendChild(R.layout);
  })();

  // 크게 보기(전체 화면 보기) 토글 — 이 앱은 SciSim.Experiment.create()를 쓰지 않고 실험 화면을 직접 만들므로,
  // 같은 .ss-exp-layout > .ss-exp-view-col + .ss-exp-panel 구조에 enlarge()를 직접 연결한다(단계 A README 예시,
  // fix-A F9에서 이 앱으로 먼저 시험됨). 기록 버튼은 record로, 각도·빛의 세기·그림자 값(R.valGrid)은 scenePanel로 넘긴다.
  var enl = S.Experiment.enlarge({
    layout: R.layout,
    viewBox: R.viewBox,
    panel: R.panel,
    record: R.record,
    scenePanel: R.valGrid,
  });

  // 슬라이더 위 자리(엄지 44px 기준): 눈금 버튼·숫자를 엄지 가운데와 맞춘다
  function pos(deg) {
    var p = (deg - C.angleMin) / (C.angleMax - C.angleMin);
    return "calc(22px + (100% - 44px) * " + p.toFixed(4) + ")";
  }

  /* ───────── 각도 바꾸기(드래그 중 갱신은 requestAnimationFrame 한 번으로 묶는다) ───────── */
  var view = null;
  var viewKind = null;
  var rafId = 0;
  function setAngle(d, now) {
    d = clampDeg(d);
    if (d === angle && !now) return;
    angle = d;
    saveAngle();
    if (now || document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      applyAngle();
    } else if (!rafId) {
      rafId = requestAnimationFrame(function () {
        rafId = 0;
        applyAngle();
      });
    }
  }
  // 손전등 끌기(아래 build3D 안의 v.draggable)가 부를 이름을 따로 둔다: build3D() 콜백 안에는 3D 장면만 갱신하는
  // "지역" setAngle(deg)가 또 있어(장면 만들 때 view로 돌려주는 그 함수), 그 안에서 그냥 setAngle(...)을 부르면
  // 상태·DOM을 갱신하는 이 바깥쪽 setAngle이 아니라 그 지역 함수가 불린다(이름 가림). 별칭으로 가린다.
  var applyAngleFromScene = setAngle;
  function valueText(d) {
    return d + "도, 빛의 세기 " + readingOf(d) + ", 그림자 길이 " + cm1(shadowOf(d)) + " cm";
  }
  function applyAngle() {
    var d = angle;
    if (Number(R.range.value) !== d) R.range.value = String(d);
    R.range.setAttribute("aria-valuetext", valueText(d));
    R.range.style.setProperty("--p", ((d - C.angleMin) / (C.angleMax - C.angleMin)) * 100 + "%");
    R.valAngle.textContent = String(d);
    R.valLux.textContent = String(readingOf(d));
    R.valShadow.textContent = cm1(shadowOf(d));
    R.hudNum.textContent = String(readingOf(d));
    R.hudSub.textContent = "각도 " + d + "° · 그림자 " + cm1(shadowOf(d)) + " cm";
    R.minus.disabled = d <= C.angleMin;
    R.plus.disabled = d >= C.angleMax;
    REQ.forEach(function (r) {
      R.snaps[r].setAttribute("aria-pressed", String(r === d));
    });
    drawRecordButton();
    if (view) view.setAngle(d);
  }
  R.range.addEventListener("input", function () {
    setAngle(R.range.value);
  });
  R.range.addEventListener("change", function () {
    setAngle(R.range.value, true);
    R.live.textContent = valueText(angle); // 끌기를 마쳤을 때만 읽어 준다(끄는 동안 쏟아지지 않게)
  });
  R.minus.addEventListener("click", function () {
    setAngle(angle - 1, true);
    R.live.textContent = valueText(angle);
  });
  R.plus.addEventListener("click", function () {
    setAngle(angle + 1, true);
    R.live.textContent = valueText(angle);
  });

  /* ───────── 기록하기 ───────── */
  function canRecordExtra(d) {
    return isRequired(d) || !!recGet(d) || extraCount() < C.maxExtra;
  }
  function drawRecordButton() {
    var d = angle;
    var had = !!recGet(d);
    R.record.textContent = (had ? "🔁 " : "📝 ") + d + "° " + (had ? "다시 기록하기" : "기록하기");
    R.record.disabled = !canRecordExtra(d);
    if (!canRecordExtra(d)) R.recMsg.textContent = "다른 각도는 " + C.maxExtra + "개까지 더 기록할 수 있어요. 아래 '내 기록'에서 하나를 지우면 다시 기록할 수 있어요.";
    else if (had) R.recMsg.textContent = d + "°는 이미 기록했어요.";
    else if (isRequired(d)) R.recMsg.textContent = d + "°(" + reqInfo(d).note + ")는 꼭 기록할 각도예요.";
    else R.recMsg.textContent = requiredDone() ? "다른 각도도 기록해 볼 수 있어요(선택)." : "꼭 기록할 각도는 30°와 80°예요. 눈금 버튼을 눌러 보세요.";
  }
  R.record.addEventListener("click", function () {
    var d = angle;
    if (!canRecordExtra(d)) return;
    var before = requiredDone();
    var had = recGet(d);
    var rec = { angle: d, shadow: shadowOf(d), reading: readingOf(d), recordedAt: Date.now() };
    if (had) recs[recs.indexOf(had)] = rec;
    else recs.push(rec);
    saveRecs();
    if (!before && requiredDone()) toast("🎉 30°와 80°를 모두 기록했어요! 다른 각도도 살펴보거나 '다음 단계'로 가요.", 3800);
    else toast((had ? "🔁 다시 기록했어요: " : "📝 기록했어요: ") + d + "° → 빛의 세기 " + rec.reading + ", 그림자 " + cm1(rec.shadow) + " cm");
    drawRecords();
    lesson.refresh();
  });
  function removeRecord(d) {
    if (isRequired(d)) return;
    recs = recs.filter(function (r) {
      return r.angle !== d;
    });
    saveRecs();
    toast(d + "° 기록을 지웠어요.");
    drawRecords();
    lesson.refresh();
  }

  function drawRecords() {
    R.reqChips.textContent = "";
    R.reqChips.appendChild(el("span", { class: "req-title", text: "꼭 기록할 각도" }));
    C.required.forEach(function (r) {
      var done = !!recGet(r.deg);
      R.reqChips.appendChild(
        el("button", {
          type: "button",
          class: "req-chip" + (done ? " is-done" : ""),
          "aria-label": r.label + "(" + r.note + ") " + (done ? "기록함" : "아직 기록 안 함") + ". 누르면 이 각도로 바꿔요",
          text: (done ? "✅ " : "⬜ ") + r.label,
          onclick: function () {
            setAngle(r.deg, true);
          },
        })
      );
    });
    R.extraNote.textContent = "더 기록한 각도(선택): " + extraCount() + "/" + C.maxExtra + "개";
    R.recList.textContent = "";
    var list = recList();
    if (!list.length) R.recList.appendChild(el("li", { class: "rec-empty", text: "아직 기록이 없어요." }));
    list.forEach(function (r) {
      var req = isRequired(r.angle);
      var kids = [
        el("span", { class: "rec-deg", text: r.angle + "°" }),
        el("span", { class: "rec-val", text: "빛의 세기 " + r.reading + " · 그림자 " + cm1(r.shadow) + " cm" }),
      ];
      if (req) kids.push(el("span", { class: "rec-tag", text: "꼭" }));
      else
        kids.push(
          el("button", {
            type: "button",
            class: "ss-btn ss-btn-ghost rec-del",
            "aria-label": r.angle + "° 기록 지우기",
            text: "✕ 지우기",
            onclick: function () {
              removeRecord(r.angle);
            },
          })
        );
      R.recList.appendChild(el("li", { class: "rec-item" + (req ? " is-req" : "") }, kids));
    });
    var n = requiredCount();
    R.lead.textContent = requiredDone()
      ? "30°와 80°를 모두 기록했어요. 다른 각도도 살펴보거나 '다음 단계'로 가요."
      : "30°와 80°를 기록해야 다음 단계로 갈 수 있어요. (기록함 " + n + "/" + REQ.length + ")";
    drawRecordButton();
  }

  /* ───────── 3D ↔ 2D 화면 ───────── */
  var mountToken = 0;
  var mounting = false;
  var forced2D = /[?&]no3d=1/.test(location.search); // 교사 점검용 주소(2D 강제)
  var can3D = !!(S.Sim3D && S.Sim3D.isWebGLAvailable()) && !forced2D;
  R.btnReset.addEventListener("click", function () {
    if (view) view.resetView();
  });
  R.btnToggle.addEventListener("click", function () {
    if (mounting) return;
    var to2d = viewKind === "3d";
    store.set("view2d", to2d);
    mount(to2d ? "2d" : "3d");
  });
  function mount(kind, notice) {
    var my = ++mountToken; // 늦게 끝난 3D 생성은 버린다(겹쳐 생성 방지)
    if (view && view.dispose) view.dispose();
    view = null;
    viewKind = null;
    R.view3d.textContent = "";
    R.view2d.textContent = "";
    if (kind === "3d") {
      mounting = true;
      R.loading.hidden = false;
      R.view2d.hidden = true;
      R.view3d.hidden = false;
      R.viewBox.classList.remove("is-2d");
      Promise.resolve()
        .then(function () {
          return build3D(R.view3d, {
            onLost: function () {
              if (my !== mountToken) return;
              can3D = false;
              mount("2d", "3D 화면에 문제가 생겨 2D 화면으로 바꿨어요. 기록은 그대로예요.");
            },
          });
        })
        .catch(function (e) {
          console.warn("[sci-6-2-1-4] 3D 화면을 만들지 못했어요.", e);
          return null;
        })
        .then(function (v) {
          if (my !== mountToken) {
            if (v && v.dispose) v.dispose();
            return;
          }
          mounting = false;
          if (!v) {
            can3D = false;
            mount("2d", "이 기기에서는 3D 화면을 쓸 수 없어서 2D 화면으로 실험해요.");
            return;
          }
          finishMount(v, "3d");
        });
    } else {
      mounting = false;
      R.loading.hidden = true;
      R.view3d.hidden = true;
      R.view2d.hidden = false;
      R.viewBox.classList.add("is-2d");
      finishMount(build2D(R.view2d), "2d");
      if (notice) toast(notice, 3600);
    }
    drawToggle();
  }
  function drawToggle() {
    var k = viewKind || (mounting ? "3d" : "2d");
    R.btnToggle.textContent = k === "3d" ? "2D로 보기" : can3D ? "3D로 보기" : forced2D ? "2D 화면으로 보는 중" : "3D를 쓸 수 없는 기기예요";
    R.btnToggle.disabled = mounting || (k === "2d" && !can3D);
    R.btnToggle.setAttribute("aria-busy", String(mounting));
  }
  function finishMount(v, kind) {
    view = v;
    viewKind = kind;
    R.loading.hidden = true;
    R.viewBox.classList.toggle("is-2d", kind === "2d");
    if (enl) enl.fit(); // 3D↔2D 전환 뒤 크게 보기 장면 높이를 다시 맞춘다(README "추가 기능 2026-09-25")
    var narrow = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    R.tip.textContent =
      kind === "3d"
        ? narrow
          ? "👆 손전등을 끌면 각도가 바뀌어요 · 그 밖은 드래그: 돌리기" // fix-B2 L6: 센서·그림자 끝을 안 가리게 더 줄임
          : "👆 손전등을 끌면 각도가 바뀌어요 · 그 밖은 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향"
        : "2D 화면(모형): 위는 옆에서 본 모습, 아래는 위에서 본 빛이 닿는 곳이에요.";
    R.btnReset.hidden = kind !== "3d";
    v.setAngle(angle);
    drawToggle();
  }
  var activated = false;
  function activateExperiment() {
    if (!activated) {
      activated = true;
      mount(can3D && !store.get("view2d", false) ? "3d" : "2d");
    }
    applyAngle();
    drawRecords();
  }

  /* ───────── 장면 공통 치수(1 = 1 cm, 모형) ───────── */
  var DIST = C.distanceCm; // 20 cm: 손전등 앞(렌즈) ↔ 센서
  var ROD = C.rodHeightCm; // 5 cm
  var BEAM_R = 2.6; // 빛줄기 반지름(나란한 빛, 모형)
  var HALO_R = 6; // 가운데 밝은 빛 둘레의 흐린 빛(퍼진 빛) 반지름. 막대 그림자(최대 5 cm 폭 방향)가 늘 이 빛 안에 생기게 정함(모형)
  var SURF = 0.85; // 스마트 기기 윗면 높이
  var PHONE = { x0: -5, x1: 11, z0: -3.8, z1: 3.8 }; // 스마트 기기(화면) 자리
  var ROD_Z = 1.8; // 막대: 센서 옆(보는 쪽)
  var GUIDE_Z = 5.2; // 각도·거리 표시를 그리는 면(스마트 기기 앞쪽)
  var BODY_LEN = 8; // 손전등 몸통 길이

  /* ───────── 3D 화면 ───────── */
  function build3D(container, ctx) {
    return S.Sim3D.create({
      container: container,
      frame: { width: 56, depth: 44, center: [-3, 13, 0] },
      viewDir: [0.12, 0.42, 0.9],
      lightBg: 0x2a3140, // 어두운 교실(지도서 144쪽 "교실을 어둡게")
      darkBg: 0x141922,
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      v.renderer.localClippingEnabled = true;
      // 어두운 교실: 기본 조명을 줄인다(빛 자국이 잘 보이게)
      v.scene.traverse(function (o) {
        if (o.isHemisphereLight) o.intensity = 0.75;
        if (o.isDirectionalLight) o.intensity = 0.7;
      });

      // 책상
      var table = new T.Mesh(new T.BoxGeometry(160, 1, 110), M.material(0x565d6b, { roughness: 0.9 }));
      table.position.set(-3, -0.5, 0);
      v.root.add(table);

      // 스마트 기기(화면이 위로)
      var phone = new T.Group();
      var body = new T.Mesh(new T.BoxGeometry(PHONE.x1 - PHONE.x0, SURF - 0.05, PHONE.z1 - PHONE.z0), M.material(0x1c2129, { roughness: 0.5 }));
      body.position.set((PHONE.x0 + PHONE.x1) / 2, (SURF - 0.05) / 2, 0);
      var screen = new T.Mesh(new T.BoxGeometry(PHONE.x1 - PHONE.x0 - 0.8, 0.05, PHONE.z1 - PHONE.z0 - 0.8), M.material(0x6b7688, { roughness: 0.4 }));
      screen.position.set((PHONE.x0 + PHONE.x1) / 2, SURF - 0.025, 0);
      phone.add(body, screen);
      v.root.add(phone);

      // 센서(검은 점 + 고리)
      var sensor = new T.Mesh(new T.CircleGeometry(0.55, 32), new T.MeshBasicMaterial({ color: 0x0a0d12 }));
      sensor.rotation.x = -Math.PI / 2;
      sensor.position.set(0, SURF + 0.012, 0);
      var sensorRing = new T.Mesh(new T.RingGeometry(0.62, 0.9, 32), new T.MeshBasicMaterial({ color: 0x8fb6ff }));
      sensorRing.rotation.x = -Math.PI / 2;
      sensorRing.position.set(0, SURF + 0.014, 0);
      v.root.add(sensor, sensorRing);

      // 빨판 달린 막대(높이 5 cm, 수직)
      var cup = new T.Mesh(new T.CylinderGeometry(0.75, 1.0, 0.35, 24), M.material(0xc9504f, { roughness: 0.6 }));
      cup.position.set(0, SURF + 0.175, ROD_Z);
      var stick = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, ROD, 16), M.material(0xf0b44c, { roughness: 0.5 }));
      stick.position.set(0, SURF + ROD / 2, ROD_Z);
      v.root.add(cup, stick);

      // 화면(스마트 기기) 테두리에 맞춰 자르는 면
      var phoneClip = [
        new T.Plane(new T.Vector3(1, 0, 0), -PHONE.x0),
        new T.Plane(new T.Vector3(-1, 0, 0), PHONE.x1),
        new T.Plane(new T.Vector3(0, 0, 1), -PHONE.z0),
        new T.Plane(new T.Vector3(0, 0, -1), PHONE.z1),
      ];
      // 빛 자국(타원): 화면 위(잘라서) + 책상 위(화면 밖으로 넓어질 때)
      function spotMesh(y, clip, r, order) {
        var m = new T.Mesh(
          new T.CircleGeometry(r || BEAM_R, 64),
          new T.MeshBasicMaterial({ color: 0xffeaa0, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, clippingPlanes: clip || null })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, y, 0);
        m.renderOrder = order || 2;
        v.root.add(m);
        return m;
      }
      // 흐린 빛(둘레): 그림자는 빛이 닿는 곳에만 생기므로, 그림자가 생기는 자리까지 흐린 빛을 그린다
      var haloPhone = spotMesh(SURF + 0.015, phoneClip, HALO_R, 1);
      var haloTable = spotMesh(0.015, null, HALO_R, 1);
      var spotPhone = spotMesh(SURF + 0.02, phoneClip);
      var spotTable = spotMesh(0.02, null);

      // 막대 그림자(화면 위 + 화면 밖 책상 위)
      function shadowMesh(y) {
        var m = new T.Mesh(new T.PlaneGeometry(1, 0.7), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.72, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(0, y, ROD_Z);
        m.renderOrder = 3;
        v.root.add(m);
        return m;
      }
      var shadowPhone = shadowMesh(SURF + 0.03);
      var shadowTable = shadowMesh(0.03);

      // 빛줄기(나란한 빛, 반투명 원통을 화면 높이에서 비스듬히 자른 모양)
      var SEG = 48;
      var beamGeo = new T.BufferGeometry();
      var beamPos = new Float32Array((SEG + 1) * 2 * 3);
      beamGeo.setAttribute("position", new T.BufferAttribute(beamPos, 3));
      var idx = [];
      for (var i = 0; i < SEG; i++) {
        var a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      beamGeo.setIndex(idx);
      var beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
      beam.renderOrder = 4;
      beam.frustumCulled = false;
      v.root.add(beam);

      // LED 손전등(무리의 +x 방향 = 빛이 나가는 쪽, 원점 = 렌즈 가운데)
      var torch = new T.Group();
      var headGeo = new T.CylinderGeometry(BEAM_R + 0.45, 1.75, 3.2, 32);
      headGeo.rotateZ(-Math.PI / 2);
      var head = new T.Mesh(headGeo, M.material(0x5b6780, { roughness: 0.35, metalness: 0.4 }));
      head.position.x = -1.6;
      var bodyGeo = new T.CylinderGeometry(1.6, 1.45, BODY_LEN, 28);
      bodyGeo.rotateZ(-Math.PI / 2);
      var tbody = new T.Mesh(bodyGeo, M.material(0x39424f, { roughness: 0.45, metalness: 0.3 }));
      tbody.position.x = -3.2 - BODY_LEN / 2;
      var btn = new T.Mesh(new T.BoxGeometry(1.4, 0.5, 0.9), M.material(0xd9534f));
      btn.position.set(-6.5, 1.6, 0);
      var lensGeo = new T.CircleGeometry(BEAM_R, 40);
      lensGeo.rotateY(Math.PI / 2);
      var lens = new T.Mesh(lensGeo, new T.MeshBasicMaterial({ color: 0xfff6d0 }));
      lens.position.x = 0.03;
      torch.add(head, tbody, btn, lens);
      v.root.add(torch);

      // 각도·거리 표시(스마트 기기 앞쪽 면 z = GUIDE_Z에 그린다)
      var guideMat = new T.MeshBasicMaterial({ color: 0xdfe8f5 });
      var base = new T.Mesh(new T.BoxGeometry(14, 0.14, 0.14), guideMat);
      base.position.set(-7, SURF, GUIDE_Z); // 화면(지표면) 쪽 기준선
      var axisLine = new T.Mesh(new T.BoxGeometry(DIST, 0.14, 0.14), guideMat);
      v.root.add(base, axisLine);
      var arcMat = new T.MeshBasicMaterial({ color: 0x7fd1ff, side: T.DoubleSide });
      var arc = new T.Mesh(new T.RingGeometry(6.2, 6.8, 40, 1, Math.PI - 0.5, 0.5), arcMat);
      arc.position.set(0, SURF, GUIDE_Z);
      v.root.add(arc);

      // 글자(이름표): 고정 글자는 make.label, 바뀌는 글자(각도)는 캔버스를 다시 그린다
      var labels = [];
      function fixedLabel(text, at, o) {
        var sp = M.label(text, Object.assign({ height: 2.3 }, o || {}));
        sp.position.set(at[0], at[1], at[2]);
        v.root.add(sp);
        labels.push({ sp: sp, sx: sp.scale.x, sy: sp.scale.y, narrow: (o && o.narrow) || "grow", pos: at.slice() });
        return sp;
      }
      // narrow:"hide"(좁은 화면에서 숨김, fix-B2 L6) — 개편 단계 B에서 왼쪽 위에 "⛶ 전체 화면 보기" 토글이 생겨, 좁은
      // 화면(폭 480px 미만)에서 이 이름표가 각도에 따라 토글과 자주 겹쳤다(review-B L6, "grow"→"keep"으로 자람만 막은
      // 이전 시도로는 부족했음 — 겹침이 남음). 이름표 자리를 토글을 피해 동적으로 옮기려면 화면 좌표 투영이 필요해 범위를
      // 넘는다고 판단해, 이미 같은 파일에 있는 "화면 이름표 숨김"(예: "스마트 기기 화면(지표면)")과 같은 방식으로 좁은
      // 화면에서는 숨긴다 — 손전등 자체는 장면에서 뚜렷이 보이므로 이름표가 없어도 무엇인지 알 수 있다.
      var torchLabel = fixedLabel("🔦 손전등(태양)", [0, 0, 0], { bold: true, border: "#f2c230", narrow: "hide" });
      var sensorLabel = fixedLabel("센서", [2.4, SURF + 1.1, 4.6], { height: 2, narrow: "grow" });
      sensorLabel.userData.narrowPos = [4.2, SURF + 0.9, 6.2];
      var rodLabel = fixedLabel("막대", [2.9, SURF + ROD - 0.4, ROD_Z], { height: 2, narrow: "grow" });
      rodLabel.userData.narrowPos = [4.2, SURF + ROD + 0.4, ROD_Z];
      fixedLabel("스마트 기기 화면(지표면)", [8.5, SURF + 0.9, PHONE.z1 + 2.4], { height: 2, narrow: "hide" });
      var distLabel = fixedLabel("20.0 cm (늘 같음)", [0, 0, 0], { height: 2.1, border: "#dfe8f5" });

      // fix-B2 L4(review-B): 3D 각도 숫자 스프라이트(예전 angSprite/drawAngleText)는 없앴다 — 바뀌는 값은 값
      // 패널에만(CLAUDE.md "장면 속 글자 규칙"). 각도를 눈으로 보여 주는 호(arc)는 그대로 남긴다.

      // 좁은 화면(휴대폰)에서는 중요한 이름표(손전등·거리)를 키우고, 화면 이름표는 숨긴다(겹침 방지)
      var labelK = 0;
      function fitLabels() {
        var k = (container.clientWidth || 1024) < 480 ? 1.4 : 1;
        if (k === labelK) return;
        labelK = k;
        labels.forEach(function (l) {
          var kk = l.narrow === "grow" ? k : 1;
          l.sp.scale.set(l.sx * kk, l.sy * kk, 1);
          l.sp.visible = !(l.narrow === "hide" && k > 1);
          // 좁은 화면에서 '센서'·'막대'는 서로 겹치지 않는 자리로 옮긴다(막대는 막대 꼭대기 위, 센서는 앞쪽 오른쪽)
          var np = l.sp.userData.narrowPos;
          if (np && l.pos) {
            var q = k > 1 ? np : l.pos;
            l.sp.position.set(q[0], q[1], q[2]);
          }
        });
        v.render();
      }
      fitLabels();
      var labelRO = window.ResizeObserver ? new ResizeObserver(fitLabels) : null;
      if (labelRO) labelRO.observe(container);

      function setAngle(deg) {
        var th = deg * RAD;
        var c = Math.cos(th);
        var s = Math.sin(th);
        var lensC = new T.Vector3(-DIST * c, SURF + DIST * s, 0); // 센서에서 20 cm
        // 손전등: +x축을 빛 방향(c, -s, 0)으로
        torch.position.copy(lensC);
        torch.rotation.set(0, 0, -th);
        // 빛줄기: 렌즈 둘레 → 화면 높이에서 만나는 점
        var d = new T.Vector3(c, -s, 0);
        var u = new T.Vector3(s, c, 0); // 빛 방향에 수직(세로 면 안)
        for (var k = 0; k <= SEG; k++) {
          var a = (k / SEG) * Math.PI * 2;
          var px = lensC.x + BEAM_R * Math.cos(a) * u.x;
          var py = lensC.y + BEAM_R * Math.cos(a) * u.y;
          var pz = BEAM_R * Math.sin(a);
          var t = (py - SURF) / s;
          var o = k * 6;
          beamPos[o] = px;
          beamPos[o + 1] = py;
          beamPos[o + 2] = pz;
          beamPos[o + 3] = px + t * d.x;
          beamPos[o + 4] = SURF;
          beamPos[o + 5] = pz;
        }
        beamGeo.attributes.position.needsUpdate = true;
        beamGeo.computeBoundingSphere();
        // 빛 자국: 넓이 ∝ 1/sin, 밝기 ∝ sin (모형)
        var stretch = 1 / s;
        var alpha = 0.18 + 0.72 * s;
        [spotPhone, spotTable].forEach(function (m) {
          m.scale.set(stretch, 1, 1); // 원 → x 방향으로 늘어난 타원(회전 전 x축 = 세계 x축)
          m.material.opacity = alpha;
        });
        [haloPhone, haloTable].forEach(function (m) {
          m.scale.set(stretch, 1, 1);
          m.material.opacity = 0.07 + 0.16 * s; // 흐린 빛도 각이 작을수록 넓고 흐리게
        });
        // 막대 그림자: 막대 밑동에서 빛 반대쪽(+x)으로 5 ÷ tan(각도)
        var L = shadowOf(deg);
        var onPhone = Math.min(L, PHONE.x1);
        shadowPhone.visible = onPhone > 0.05;
        shadowPhone.scale.x = Math.max(onPhone, 0.001);
        shadowPhone.position.x = onPhone / 2;
        var rest = L - PHONE.x1;
        shadowTable.visible = rest > 0.05;
        shadowTable.scale.x = Math.max(rest, 0.001);
        shadowTable.position.x = PHONE.x1 + rest / 2;
        // 각도 표시: 기준선(화면 쪽) → 손전등 쪽
        arc.geometry.dispose();
        arc.geometry = new T.RingGeometry(6.2, 6.8, 40, 1, Math.PI - th, th);
        axisLine.position.set((-DIST * c) / 2, SURF + (DIST * s) / 2, GUIDE_Z);
        axisLine.rotation.set(0, 0, -th);
        distLabel.position.set((-DIST * c) / 2 + 2.6 * s, SURF + (DIST * s) / 2 + 2.6 * c + 1.2, GUIDE_Z + 0.5);
        // 손전등 이름표: 몸통 가운데에서 빛 방향에 수직(위·오른쪽)으로 조금 떨어진 곳(좁은 화면에서는 narrow:"hide"로
        // 숨겨 왼쪽 위 토글과 안 겹친다 — fix-B2 L6, fitLabels()가 처리)
        var back = DIST + 3.2 + BODY_LEN / 2;
        // 눕힌 손전등(각이 작을 때)은 위쪽에, 세운 손전등(각이 클 때)은 왼쪽에(오른쪽 위 조도 앱 화면과 겹치지 않게)
        var off = 4 + 5 * s * s;
        var sg = deg < 50 ? 1 : -1;
        torchLabel.position.set(-back * c + sg * off * s, SURF + back * s + sg * off * c, 0);
        v.render();
      }

      // 손전등을 직접 끌어 각도 바꾸기(개편 단계 B, spec.md "개정 1"·build-B 지침, fix-B2 M1로 다시 수정): 손전등은
      // 늘 센서 옆(0, SURF, 0)을 중심으로 z=0 평면 위를 도는 부채꼴 위에 있으므로, 그 평면과의 교점에서 각도를 구한다.
      // applyAngleFromScene을 부르는 것에 주의: 이 스코프 안의 지역 setAngle(deg)(바로 위, 3D 장면만 갱신)와 이름이
      // 겹치므로 별칭을 쓴다.
      //   fix-B2 M1(review-B): ① 상대 각도 — 손전등은 회전체라, 잡은 자리가 축 위든(머리·몸통) 축 밖이든(버튼처럼
      //   튀어나온 곳) "잡은 지점의 각(pivot 기준 atan2)"이 실제 회전각과 같은 속도로 바뀐다(강체 회전이므로 상수 오프셋만
      //   다르다) — 그래서 "잡은 순간의 각도 + 변화량"으로 계산하면 어디를 잡아도 결과가 같다(예전 절대값 방식은 머리·
      //   버튼 등 잡은 자리에 따라 각도가 30°→36°/34°/27°처럼 다르게 튀었다). ② 움직임 문턱(6px, 화면 좌표) — 이 문턱을
      //   넘기 전에는 onDrag·onEnd 모두 각도를 바꾸지 않는다(누르기만 해도 바뀌던 문제, 30° 기록 뒤 살짝 건드리면 풀리던
      //   문제). ③ 잡는 영역 — pad:0(레이가 손전등 자신에 실제로 맞을 때만, 화면 경계 상자+30px 기본값을 끔 — 기울어진
      //   손전등 옆 빈 하늘을 끌어도 잡히던 문제)과, 손전등 축을 따라 두르는 보이지 않는 굵은 손잡이 메시(터치를 쉽게, 몸통
      //   전체를 넉넉히 감싸되 화면 경계 상자보다 훨씬 좁게)를 함께 쓴다(README "추가 기능 2026-09-25").
      var dragPivot = new T.Vector3(0, SURF, 0);
      function degFromPoint(pt) {
        var dx = pt.x - dragPivot.x;
        var dy = pt.y - dragPivot.y;
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
        return (Math.atan2(dy, -dx) * 180) / Math.PI;
      }
      // 보이지 않는 굵은 손잡이(자식이라 torch와 함께 움직·회전한다): 몸통 끝(-11.2)~렌즈(0) 둘레를 반지름 4로 감싼다
      // (머리 반지름 최대 3.05·버튼 돌출 1.85보다 넉넉하게, pad:0과 짝을 이룬다).
      var handleGeo = new T.CylinderGeometry(4, 4, 13, 10);
      handleGeo.rotateZ(-Math.PI / 2);
      var handle = new T.Mesh(handleGeo, new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      handle.position.x = -5.5;
      torch.add(handle);
      var DRAG_MOVE_PX = 6;
      var dragStart = null; // { angle, point, x, y, moved }
      v.draggable(torch, {
        pad: 0,
        plane: { normal: [0, 0, 1], point: [0, SURF, 0] },
        onStart: function (info) {
          dragStart = {
            angle: angle,
            point: info.point ? info.point.clone() : null,
            x: info.event ? info.event.clientX : null,
            y: info.event ? info.event.clientY : null,
            moved: false,
          };
        },
        onDrag: function (info) {
          if (!dragStart) return;
          if (!dragStart.moved) {
            if (dragStart.x === null || !info.event) return; // 화면 좌표를 모르면 문턱을 넘었다고 볼 수 없다(그대로 대기)
            var mdx = info.event.clientX - dragStart.x;
            var mdy = info.event.clientY - dragStart.y;
            if (Math.hypot(mdx, mdy) < DRAG_MOVE_PX) return; // 문턱 안: 각도를 바꾸지 않는다
            dragStart.moved = true;
          }
          if (!info.point || !dragStart.point) return;
          var d0 = degFromPoint(dragStart.point);
          var d1 = degFromPoint(info.point);
          if (d0 === null || d1 === null) return;
          applyAngleFromScene(dragStart.angle + (d1 - d0)); // 슬라이더 "input"과 같은 방식(requestAnimationFrame 한 번으로 묶임)
        },
        onEnd: function (info) {
          var st = dragStart;
          dragStart = null;
          if (!st || !st.moved || !info.point || !st.point) return; // 문턱을 못 넘겼으면(누르기만 함) 각도를 그대로 둔다
          var d0 = degFromPoint(st.point);
          var d1 = degFromPoint(info.point);
          if (d0 === null || d1 === null) return;
          applyAngleFromScene(st.angle + (d1 - d0), true); // 슬라이더 "change"와 같은 방식(끝났을 때 값을 확정하고 읽어 준다)
          R.live.textContent = valueText(angle);
        },
      });

      v.render();
      return {
        setAngle: setAngle,
        resetView: v.resetView,
        dispose: function () {
          if (labelRO) labelRO.disconnect();
          v.dispose();
        },
      };
    });
  }

  /* ───────── 2D 대체 화면: 옆에서 본 모습 + 위에서 본 빛 자국(SVG) ───────── */
  var SVGNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function build2D(root) {
    var TOP_Y = 13; // 위에서 본 그림의 가운데(아래쪽)
    var s = sv("svg", { viewBox: "-34 -36 66 58", class: "v2-svg", role: "img", "aria-label": "옆에서 본 손전등과 화면, 위에서 본 빛이 닿는 곳(2D 모형)" });
    // 옆에서 본 모습
    s.appendChild(sv("text", { x: -33, y: -33, class: "v2-cap" }, "옆에서 본 모습"));
    s.appendChild(sv("rect", { x: -34, y: 0, width: 66, height: 1.6, class: "v2-table" }));
    s.appendChild(sv("rect", { x: PHONE.x0, y: -SURF, width: PHONE.x1 - PHONE.x0, height: SURF, rx: 0.3, class: "v2-phone" }));
    var haloBeam = sv("polygon", { class: "v2-halo-beam" });
    var haloSpot = sv("line", { class: "v2-halo-spot" });
    s.appendChild(haloBeam);
    s.appendChild(haloSpot);
    var beam = sv("polygon", { class: "v2-beam" });
    var spot = sv("line", { class: "v2-spot" });
    var shadow = sv("line", { class: "v2-shadow" });
    s.appendChild(beam);
    s.appendChild(spot);
    s.appendChild(shadow);
    s.appendChild(sv("line", { x1: 0, y1: -SURF, x2: 0, y2: -SURF - ROD, class: "v2-rod" }));
    s.appendChild(sv("circle", { cx: 0, cy: -SURF, r: 0.7, class: "v2-sensor" }));
    s.appendChild(sv("text", { x: 1.2, y: -SURF - ROD + 0.6, class: "v2-small" }, "막대"));
    var base = sv("line", { x1: 0, y1: -SURF, x2: -13, y2: -SURF, class: "v2-guide" });
    var arc = sv("path", { class: "v2-arc" });
    var angT = sv("text", { class: "v2-ang", "text-anchor": "middle" });
    var axis = sv("line", { class: "v2-guide v2-dash" });
    var distT = sv("text", { class: "v2-small", "text-anchor": "middle" }, "20.0 cm");
    var torch = sv("g", { class: "v2-torch" });
    torch.appendChild(sv("rect", { x: -3.2 - BODY_LEN, y: -1.6, width: BODY_LEN, height: 3.2, rx: 0.8, class: "v2-torch-body" }));
    torch.appendChild(sv("rect", { x: -3.2, y: -(BEAM_R + 0.45), width: 3.2, height: 2 * (BEAM_R + 0.45), rx: 0.6, class: "v2-torch-head" }));
    torch.appendChild(sv("line", { x1: 0, y1: -BEAM_R, x2: 0, y2: BEAM_R, class: "v2-lens" }));
    var torchT = sv("text", { class: "v2-small", "text-anchor": "middle" }, "손전등(태양)");
    [base, arc, axis, torch, angT, distT, torchT].forEach(function (n) {
      s.appendChild(n);
    });
    // 위에서 본 빛 자국
    s.appendChild(sv("text", { x: -33, y: TOP_Y - 5.2, class: "v2-cap" }, "위에서 본 빛이 닿는 곳"));
    s.appendChild(sv("rect", { x: PHONE.x0, y: TOP_Y + PHONE.z0, width: PHONE.x1 - PHONE.x0, height: PHONE.z1 - PHONE.z0, rx: 0.6, class: "v2-phone-top" }));
    var haloEll = sv("ellipse", { cx: 0, cy: TOP_Y, ry: HALO_R, class: "v2-halo-ell" });
    s.appendChild(haloEll);
    var ell = sv("ellipse", { cx: 0, cy: TOP_Y, ry: BEAM_R, class: "v2-ell" });
    var tShadow = sv("rect", { x: 0, y: TOP_Y + ROD_Z - 0.3, height: 0.6, class: "v2-shadow-top" });
    s.appendChild(ell);
    s.appendChild(tShadow);
    s.appendChild(sv("circle", { cx: 0, cy: TOP_Y + ROD_Z, r: 0.45, class: "v2-rod-top" }));
    s.appendChild(sv("circle", { cx: 0, cy: TOP_Y, r: 0.55, class: "v2-sensor" }));
    var ellT = sv("text", { class: "v2-small", "text-anchor": "middle" });
    s.appendChild(ellT);
    root.appendChild(s);

    function setAngle(deg) {
      var th = deg * RAD;
      var c = Math.cos(th);
      var sn = Math.sin(th);
      var y0 = -SURF;
      var Lx = -DIST * c;
      var Ly = y0 - DIST * sn;
      // 손전등: 렌즈에서 센서 쪽(c, sn)을 향하게(SVG는 y가 아래로)
      torch.setAttribute("transform", "translate(" + Lx.toFixed(3) + " " + Ly.toFixed(3) + ") rotate(" + deg + ")");
      var back = DIST + 3.2 + BODY_LEN / 2;
      var off = 4 + 5 * sn * sn;
      var sg = deg < 50 ? 1 : -1; // 3D와 같게: 눕히면 위, 세우면 왼쪽
      torchT.setAttribute("x", (-back * c + sg * off * sn).toFixed(2));
      torchT.setAttribute("y", (y0 - back * sn - sg * off * c + 0.8).toFixed(2));
      // 빛줄기(나란한 빛): 렌즈 양 끝 → 화면 높이
      var nx = -sn;
      var ny = c; // 빛 방향(c, sn)에 수직
      var pts = [
        [Lx + BEAM_R * nx, Ly + BEAM_R * ny],
        [Lx - BEAM_R * nx, Ly - BEAM_R * ny],
      ];
      var g = pts.map(function (p) {
        var t = (y0 - p[1]) / sn;
        return [p[0] + t * c, y0];
      });
      beam.setAttribute(
        "points",
        [pts[0], pts[1], g[1], g[0]]
          .map(function (p) {
            return p[0].toFixed(3) + "," + p[1].toFixed(3);
          })
          .join(" ")
      );
      // 흐린 빛(둘레, 모형): 반지름 HALO_R인 나란한 빛
      var hp = [
        [Lx + HALO_R * nx, Ly + HALO_R * ny],
        [Lx - HALO_R * nx, Ly - HALO_R * ny],
      ];
      var hg = hp.map(function (p) {
        var t = (y0 - p[1]) / sn;
        return [p[0] + t * c, y0];
      });
      haloBeam.setAttribute(
        "points",
        [hp[0], hp[1], hg[1], hg[0]]
          .map(function (p) {
            return p[0].toFixed(3) + "," + p[1].toFixed(3);
          })
          .join(" ")
      );
      haloSpot.setAttribute("x1", Math.min(hg[0][0], hg[1][0]).toFixed(3));
      haloSpot.setAttribute("x2", Math.max(hg[0][0], hg[1][0]).toFixed(3));
      haloSpot.setAttribute("y1", y0 - 0.25);
      haloSpot.setAttribute("y2", y0 - 0.25);
      haloEll.setAttribute("rx", (HALO_R / sn).toFixed(3));
      var alpha = 0.3 + 0.7 * sn;
      spot.setAttribute("x1", Math.min(g[0][0], g[1][0]).toFixed(3));
      spot.setAttribute("x2", Math.max(g[0][0], g[1][0]).toFixed(3));
      spot.setAttribute("y1", y0 - 0.25);
      spot.setAttribute("y2", y0 - 0.25);
      spot.style.opacity = alpha.toFixed(3);
      var L = shadowOf(deg);
      shadow.setAttribute("x1", 0);
      shadow.setAttribute("x2", L.toFixed(2));
      shadow.setAttribute("y1", y0 - 0.2);
      shadow.setAttribute("y2", y0 - 0.2);
      shadow.style.display = L > 0.05 ? "" : "none";
      // 각도 표시
      var R0 = 7;
      arc.setAttribute("d", "M " + -R0 + " " + y0 + " A " + R0 + " " + R0 + " 0 0 1 " + (-R0 * c).toFixed(3) + " " + (y0 - R0 * sn).toFixed(3));
      // 각도 숫자는 그림에 쓰지 않는다 — 바뀌는 값은 값 패널에만(CLAUDE.md "장면 속 글자", spec 개정 5-3 · review-B2 N3)
      angT.textContent = "";
      axis.setAttribute("x1", 0);
      axis.setAttribute("y1", y0);
      axis.setAttribute("x2", Lx.toFixed(3));
      axis.setAttribute("y2", Ly.toFixed(3));
      distT.setAttribute("x", (Lx / 2 + 3.4 * sn).toFixed(2));
      distT.setAttribute("y", (y0 - (DIST * sn) / 2 - 3.4 * c + 0.8).toFixed(2));
      // 위에서 본 빛 자국: 가로 반지름 = 빛줄기 반지름 ÷ sin
      ell.setAttribute("rx", (BEAM_R / sn).toFixed(3));
      ell.style.opacity = alpha.toFixed(3);
      tShadow.setAttribute("y", (TOP_Y + ROD_Z - 0.3).toFixed(2));
      tShadow.setAttribute("width", Math.max(L, 0).toFixed(2));
      tShadow.style.display = L > 0.05 ? "" : "none";
      ellT.setAttribute("x", 0);
      ellT.setAttribute("y", (TOP_Y + BEAM_R + 3).toFixed(2));
      ellT.textContent = deg < 45 ? "넓게 퍼져 닿아요" : deg > 70 ? "좁게 모여 닿아요" : "";
    }
    return {
      setAngle: setAngle,
      resetView: function () {},
      dispose: function () {
        root.textContent = "";
      },
    };
  }

  /* ───────── 3. 기록·분석하기 ───────── */
  function drawResults() {
    var T = S.TableChart;
    var list = recList();
    T.renderTable($("result-table"), {
      caption: "각도에 따른 그림자 길이와 빛의 세기 (내 기록)",
      columns: [
        { id: "angle", label: "각도" },
        { id: "shadow", label: "그림자 길이", unit: "cm", digits: 1 },
        { id: "reading", label: "빛의 세기", digits: 0 },
      ],
      rows: list.map(function (r) {
        return { angle: r.angle + "°" + (isRequired(r.angle) ? " (" + reqInfo(r.angle).note + ")" : ""), shadow: r.shadow, reading: r.reading };
      }),
    });
    var card = $("line-card");
    card.textContent = "";
    card.appendChild(el("p", { class: "axis-note", text: "세로축: 빛의 세기 · 가로축: 손전등과 화면이 이루는 각(°)" }));
    var box = el("div");
    card.appendChild(box);
    T.renderLine(
      box,
      Object.assign({}, C.chart.line, {
        series: [
          {
            name: "빛의 세기",
            points: list.map(function (r) {
              return { x: r.angle, y: r.reading };
            }),
          },
        ],
      })
    );
    card.appendChild(el("p", { class: "trend-note", text: "점은 내가 기록한 각도예요. 각도 순서대로 이었어요." }));
  }

  /* ───────── 4. 마치기(결과 저장) ───────── */
  function recRowsForQa() {
    return recList().map(function (r) {
      return { angle: String(r.angle), shadow: cm1(r.shadow), reading: String(r.reading) };
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
    return {
      predict: predict.values(),
      records: recList().map(function (r) {
        return { angleDeg: r.angle, shadowCm: r.shadow, reading: r.reading, required: isRequired(r.angle) };
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
            question: "내 측정 기록(각도·그림자 길이·빛의 세기 측정값)",
            kind: "table",
            answer: {
              columns: [
                { key: "angle", label: "각도(°)" },
                { key: "shadow", label: "그림자 길이(cm)" },
                { key: "reading", label: "빛의 세기" },
              ],
              rows: recRowsForQa(),
            },
          },
        ],
        quiz.qa("analyze"),
        conclude.qa("conclude"),
        curiosity.qa("conclude")
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
        return q[qq.id].correct;
      }).length;
      return ["기록한 각도: " + recs.length + "개 (30°·80° 포함)", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
    },
  });
  lesson.restart($("btn-restart"));

  applyAngle();
  drawRecords();

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
        return requiredDone() || "30°와 80°를 모두 기록해야 넘어갈 수 있어요. (기록함 " + requiredCount() + "/" + REQ.length + ")";
      },
      conclude: function () {
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: requiredDone,
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
