/*
 * app.js — sci-6-1-2-6 "속력과 관련된 안전 수칙과 안전장치를 조사해 볼까?" (조사 도우미)
 * 공통 틀(science-guide/)이 단계 이동·참고 자료·조사 팁·정리 틀·발표 준비·퀴즈·정리·저장을 맡고,
 * 이 파일은 config를 각 모듈에 넘기고 단계 조건과 저장 detail만 정한다. 화면의 사실은 모두 data/lesson-config.js에서 온다.
 * 정리 틀은 두 벌(① 안전 수칙, ② 안전장치)이라 Worksheet를 두 번 부른다(저장 키 worksheet-rule, worksheet-device).
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
  var ref = null;
  var refresh = function () {
    if (ref) ref.refresh();
    lesson.refresh();
  };

  /* ───────── 1. 조사 시작하기 ───────── */
  $("intro-topic").appendChild(
    el("div", { class: "ss-card sg-topic-card" }, [el("h3", { class: "sg-card-h", text: "🔎 오늘의 조사 주제" }), S.rich(C.intro.topic, "p")])
  );
  var predict = S.Predict.render(
    $("predict-root"),
    {
      questions: C.intro.questions,
      hints: C.intro.hints,
      minLength: C.intro.minLength,
      lengthTip: "왜 그렇게 생각했는지도 함께 적어 보세요.",
    },
    store,
    refresh
  );
  // 앞 차시 복습(답이 되는 내용은 넣지 않는다). 도입 흐름(복습 → 질문)에 맞게 주제 카드 아래, 질문 위에 둔다.
  $("intro-topic").appendChild(
    el(
      "div",
      { class: "sg-term" },
      [el("p", null, [el("strong", { text: "📖 앞에서 배운 것 떠올리기" })])].concat(
        C.intro.review.map(function (t) {
          return S.rich(t, "p");
        })
      )
    )
  );

  /* ───────── 2. 조사하기 ───────── */
  var R = C.research;
  // 참고 자료 카드에는 도입 질문의 답(지그재그 차선의 뜻)이 있으므로, 도입 질문을 다 적은 뒤에만 열린다.
  ref = S.RefCards.render(
    $("ref-root"),
    Object.assign({}, R.referenceCards, {
      open: true, // 도입을 마치고 처음 열릴 때 펼친 채로(도입 질문 1의 답을 확인하고 지나가게)
      locked: function () {
        return predict.isDone() || "조사 시작하기의 질문 2개에 내 생각을 먼저 적으면 열려요.";
      },
    }),
    store,
    { key: "refcard-open" }
  );
  var T = R.tips;
  S.TipsPanel.render(
    $("tips-root"),
    {
      keywords: T.keywords,
      sources: T.sources,
      book: T.book,
      sourceNote: "누리집은 선생님과 함께 확인하며 열어요. 수업과 관련된 자료만 찾아봐요.",
      items: [
        { icon: "✅", title: "믿을 수 있는 자료인지 확인해요", text: T.sourceCheck },
        { icon: "🤝", title: "인터넷 사용 약속", text: T.ethics },
        { icon: "📝", title: "이렇게 정리해요", text: T.howTo },
        { icon: "⚠️", title: "기기 안전", text: T.deviceSafety, tone: "warn" },
        { icon: "🚗", title: T.brakingTitle, text: T.braking },
      ],
      source: T.source,
    },
    { toast: lesson.toast }
  );

  var wsList = R.worksheets.map(function (w) {
    return S.Worksheet.render(
      $("worksheet-" + w.id + "-root"),
      {
        title: w.title,
        lead: w.lead,
        rowLabel: w.rowLabel,
        fields: w.fields,
        minRows: w.minRows,
        maxRows: w.maxRows,
        requireEach: w.requireEach,
        unique: w.unique,
        compare: w.compare,
      },
      store,
      refresh,
      { key: w.key }
    );
  });
  var wsRule = wsList[0];
  var wsDevice = wsList[1];
  function researchStatus() {
    var a = wsRule.status();
    if (a !== true) return "정리 틀 ① 안전 수칙: " + a;
    var b = wsDevice.status();
    if (b !== true) return "정리 틀 ② 안전장치: " + b;
    return true;
  }

  /* ───────── 3. 발표 준비하기 ───────── */
  var SH = C.share;
  var share = S.SharePrep.render(
    $("share-root"),
    {
      summaryTitle: "📋 내가 조사한 것 (조사하기에서 적은 내용)",
      script: { prompt: SH.scriptPrompt, placeholder: SH.scriptPlaceholder, minLength: SH.minLength, copy: true, platformNote: SH.platformNote },
      checklist: { title: SH.checklistTitle, items: SH.checklist, required: false },
      samples: { title: SH.sampleTitle, lead: SH.sampleLead, talks: SH.sampleTalks, source: SH.sampleSource },
      reflect: { prompt: SH.reflectQuestion, model: SH.reflectModel, minLength: 10, modelTitle: "📘 예시 답", compareTip: SH.reflectTip },
      etiquette: SH.etiquette,
    },
    store,
    refresh,
    {
      key: "share",
      toast: lesson.toast,
      summary: function () {
        var diff = wsDevice.mismatches().map(function (m) {
          return m.name;
        });
        var rules = wsRule.rows().map(function (r) {
          return "[안전 수칙] " + r.situation + ": " + r.rule;
        });
        var devices = wsDevice.rows().map(function (r) {
          // 예시 답안과 설치 위치가 다르게 적힌 줄은 발표 전에 다시 확인하도록 표시한다(공통 틀의 이름 맞추기 규칙으로 판정)
          return "[안전장치] " + r.name + " (" + r.place + "): " + r.func + (diff.indexOf(r.name) >= 0 ? "  ⚠ 예시 답안과 설치 위치가 달라요. 발표 전에 다시 확인해요." : "");
        });
        return rules.concat(devices);
      },
    }
  );

  /* ───────── 4. 정리 질문 ───────── */
  var quizItems = C.quiz.map(function (q) {
    return {
      id: q.id,
      text: q.text,
      options: q.options.map(function (label, i) {
        return { id: "o" + (i + 1), label: label };
      }),
      answer: ["o" + (q.options.indexOf(q.answer) + 1)],
      correct: q.correct,
      wrong: q.wrong,
    };
  });
  var quiz = S.Quiz.render(
    $("quiz-root"),
    quizItems,
    store,
    function () {
      drawConcludeGate();
      refresh();
    },
    { numLabel: "문제", key: "quiz" }
  );
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, refresh, { minLength: 10 });
  function drawConcludeGate() {
    var open = quiz.isDone();
    $("conclude-root").hidden = !open;
    $("conclude-locked").hidden = open;
  }
  $("conclude-locked").textContent = "🔒 위의 문제 " + quizItems.length + "개를 모두 확인하면 정리하기 질문이 나와요.";
  drawConcludeGate();

  /* ───────── 5. 궁금한 점 + 마치기 ───────── */
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, refresh);

  function buildDetail() {
    var q = quiz.result();
    var analysis = {};
    quizItems.forEach(function (qq) {
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
    var pv = predict.values();
    var cv = conclude.values();
    var sv = share.values();
    return {
      kind: "guide",
      intro: { zigzag: pv.q1, danger: pv.q2, hintsOpened: predict.hintsOpened() },
      rules: wsRule.rows(),
      devices: wsDevice.rows(),
      placeDiffers: wsDevice.mismatches(),
      comparedWithModel: { rules: wsRule.compareOpened(), devices: wsDevice.compareOpened() },
      share: { script: sv.script, reflect: sv.reflect, checked: sv.checked },
      quiz: analysis,
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
      // 틀린 뒤 고쳐 맞혀도 모두 "맞힘"이 되므로, 처음에 맞힌 문제 수를 따로 보여 준다
      var firstTry = quizItems.filter(function (qq) {
        return q[qq.id].correct && q[qq.id].tries === 1;
      }).length;
      var devices = wsDevice.rows();
      var car = devices.filter(function (r) {
        return r.place === "자동차";
      }).length;
      var diff = wsDevice.mismatches().length;
      return [
        "조사한 안전 수칙: " + wsRule.rows().length + "가지",
        "조사한 안전장치: " + devices.length + "가지 (자동차 " + car + "가지, 도로 " + (devices.length - car) + "가지)",
        diff ? "⚠ 예시 답안과 설치 위치가 다르게 적힌 안전장치가 " + diff + "가지 있어요. 조사하기로 돌아가 다시 확인해 보세요." : null,
        "발표 대본과 새롭게 알게 된 점을 적었어요.",
        "정리 문제 " + quizItems.length + "개를 모두 확인했어요. (처음 고른 답으로 맞힌 문제 " + firstTry + "개)",
      ].filter(Boolean);
    },
  });
  lesson.restart($("btn-restart"));

  // 긴 글 칸은 500자까지(최대로 채워도 저장 detail이 16,000자를 넘지 않게). 공통 틀 기본값은 1000자.
  document.querySelectorAll("textarea").forEach(function (t) {
    var m = parseInt(t.getAttribute("maxlength"), 10);
    if (!m || m > 500) t.setAttribute("maxlength", "500");
  });

  /* ───────── 단계 이동 ───────── */
  lesson.nav({
    el: $("stage-nav"),
    stages: C.stages,
    prevBtn: $("btn-prev"),
    nextBtn: $("btn-next"),
    gates: {
      research: function () {
        return predict.isDone() || "조사 시작하기의 질문 2개에 내 생각을 " + C.intro.minLength + "글자 이상 먼저 적어 주세요.";
      },
      share: function () {
        var s = researchStatus();
        return s === true ? true : "조사하기 — " + s;
      },
      wrapup: function () {
        var s = share.status();
        return s === true ? true : "발표 준비하기: " + s;
      },
      curiosity: function () {
        if (!quiz.isDone()) return "정리 질문의 문제 " + quizItems.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
        return conclude.isDone() || "결론, 적용 질문, 발전 질문을 모두 제출해 주세요.";
      },
    },
    done: {
      intro: predict.isDone,
      research: function () {
        return researchStatus() === true;
      },
      share: share.isDone,
      wrapup: function () {
        return quiz.isDone() && conclude.isDone();
      },
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      research: ref.refresh,
      share: share.refresh,
      wrapup: drawConcludeGate,
    },
  });
})();
