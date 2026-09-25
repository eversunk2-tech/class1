/*
 * app.js — sci-6-1-1-5 "산성 용액과 염기성 용액을 이용하는 예를 찾아라!" (조사 도우미)
 * 공통 틀(science-guide/)이 단계 이동·참고 자료·조사 팁·정리 틀·발표 준비·퀴즈·정리·저장을 맡고,
 * 이 파일은 config를 각 모듈에 넘기고 단계 조건과 저장 detail만 정한다. 화면의 사실은 모두 data/lesson-config.js에서 온다.
 * 2026-09-25 간략화: 4단계(조사 시작하기 → 조사하기 → 발표 준비하기 → 정리 질문). '더 탐구하고 싶은 점'(필수 한 줄)과
 * '학습 마치기'는 정리 질문 단계 안, 결론을 제출한 뒤에 나온다(새 기준 앱 sci-6-2-1-4와 같은 모양). 저장 detail은 questionSet: 2.
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var S = window.SciSim;
  var el = S.el;
  var $ = function (id) {
    return document.getElementById(id);
  };

  // 간략화 전(예전 판) 저장 키의 이 기기 사본을 지운다(2026-09-26, review-C M1) — 남겨 두면 로그아웃할 때 사이트가 예전 판 사본을
  // 올리려다 "다른 기기에서 저장한 기록과 달라요" 창을 띄우고, '확인'을 누르면 새 판 진행 기록이 예전 것으로 덮인다.
  // 예전 판은 새 판에서 쓰지 않는다(저장 키 버전을 올림). 이 앱의 예전 키만 지운다(localStorage.clear() 금지).
  (function () {
    var OLD = ["sci6115guide:v1"];
    try {
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        for (var j = 0; j < OLD.length; j++) if (k && (k === OLD[j] || k.indexOf(OLD[j] + ":") === 0)) drop.push(k);
      }
      drop.forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (e) {
      /* 저장소를 못 쓰면 지울 것도 없다 */
    }
  })();
  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var refresh = function () {
    lesson.refresh();
  };

  /* ───────── 1. 조사 시작하기 ───────── */
  var introRoot = $("intro-topic");
  introRoot.appendChild(el("div", { class: "ss-card sg-topic-card" }, [el("h3", { class: "sg-card-h", text: "🔎 오늘의 조사 주제" }), S.rich(C.intro.topic, "p")]));
  var predict = S.Predict.render(
    $("predict-root"),
    {
      questions: [{ id: "q1", text: C.intro.question, placeholder: C.intro.placeholder }],
      hints: C.intro.hints,
      minLength: C.intro.minLength,
      lengthTip: "왜 그렇게 생각했는지도 함께 적어 보세요.",
    },
    store,
    refresh
  );
  // 앞 차시 복습(용어만 — 답이 되는 내용은 넣지 않는다). 질문 아래에 둔다.
  $("predict-root").appendChild(
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
  S.RefCards.render($("ref-root"), R.referenceCards, store, { key: "refOpen" });
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
      ],
      source: T.source,
    },
    { toast: lesson.toast }
  );
  var ws = S.Worksheet.render(
    $("worksheet-root"),
    {
      title: "📝 조사 결과 정리하기",
      lead: "조사한 용액을 한 줄에 하나씩 적어요. **산성 용액과 염기성 용액을 모두 넣어 " + R.worksheet.minRows + "줄 이상** 채우면 참고 예시와 비교할 수 있어요.",
      rowLabel: "조사",
      fields: R.worksheet.fields,
      minRows: R.worksheet.minRows,
      maxRows: R.worksheet.maxRows,
      requireEach: R.worksheet.requireEach,
      compare: {
        buttonLabel: "📘 참고 예시와 비교해 보기",
        title: "참고 예시: 산성 용액과 염기성 용액을 이용하는 예",
        lead: "내가 조사한 것과 비교해 보세요. '내 기록' 칸은 내가 적은 용액 이름과 같은 것이 있는지, 내가 고른 성질이 참고 예시와 같은지 보여 줘요. 성질이 다르면 ⚠ 표시가 나와요.",
        columns: [
          { id: "name", label: "용액" },
          { id: "property", label: "성질" },
          { id: "use", label: "이용하는 예" },
        ],
        rows: R.modelExamples,
        matchField: "name",
        mineField: "property",
        diffText: "참고 예시에서는 다른 성질이에요. 자료를 다시 확인하고 위에서 고쳐 보세요.",
        source: R.modelSource,
      },
    },
    store,
    refresh,
    { key: "worksheet" }
  );

  /* ───────── 3. 발표 준비하기 ───────── */
  var SH = C.share;
  var share = S.SharePrep.render(
    $("share-root"),
    {
      summaryTitle: "📋 내가 조사한 것 (조사하기에서 적은 내용)",
      script: { prompt: SH.scriptPrompt, placeholder: SH.scriptPlaceholder, minLength: SH.minLength, copy: true, platformNote: SH.platformNote },
      samples: { title: "👂 다른 모둠의 발표 예시", lead: "여러 모둠의 발표 가운데 세 모둠의 예시예요.", talks: SH.sampleTalks, source: SH.sampleSource },
      reflect: { prompt: SH.reflectQuestion, model: SH.reflectModel, minLength: 10, modelTitle: "📘 예시 답", compareTip: SH.reflectTip },
      etiquette: SH.etiquette,
    },
    store,
    refresh,
    {
      key: "share",
      toast: lesson.toast,
      summary: function () {
        var diff = ws.mismatches().map(function (m) {
          return m.name;
        });
        return ws.rows().map(function (r) {
          // 참고 예시와 성질이 다르게 적힌 줄은 발표 전에 다시 확인하도록 표시한다
          return r.name + " (" + r.property + "): " + r.use + (diff.indexOf(r.name) >= 0 ? "  ⚠ 참고 예시와 성질이 달라요. 발표 전에 다시 확인해요." : "");
        });
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
  var quiz = S.Quiz.render($("quiz-root"), quizItems, store, function () {
    drawConcludeGate();
    refresh();
  }, { numLabel: "문제", key: "quiz" });
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, function () {
    refresh();
    showFinish();
  }, { minLength: 10 });
  function drawConcludeGate() {
    var open = quiz.isDone();
    $("conclude-root").hidden = !open;
    $("conclude-locked").hidden = open;
    showFinish();
  }
  $("conclude-locked").textContent = "🔒 위의 문제 " + quizItems.length + "개를 모두 확인하면 정리하기 질문이 나와요.";

  /* ───────── 4-2. 더 탐구하고 싶은 점(필수 한 줄) + 마치기 — 결론을 제출하면 나온다 ───────── */
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, refresh);
  // 새 기준 앱처럼 한 줄 입력: 공통 틀의 여러 줄 입력칸을 한 줄로 쓰고, Enter로 줄을 바꾸지 않게 한다(최대 200자).
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
  // 문제를 모두 확인하고 결론을 제출한 뒤에만 보인다(앞으로 돌아가 문제 답을 바꾸면 다시 숨는다)
  function showFinish() {
    $("finish-wrap").hidden = !(quiz.isDone() && conclude.isDone());
  }
  drawConcludeGate();

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
    var cv = conclude.values();
    var sv = share.values();
    // 간략화 후(questionSet: 2): 뺀 문항의 키(intro.experience, quiz.q2·q4, extension)는 아예 만들지 않는다.
    // 남긴 키의 이름·모양은 예전과 같다(관리자 "학생 응답" 매핑 src/data/app-responses/sci-6-1-1-5.ts의 v2 변형이 이 모양을 읽는다).
    return {
      kind: "guide",
      questionSet: 2,
      intro: { answer: predict.values().q1, hintsOpened: predict.hintsOpened() },
      worksheet: ws.rows(),
      propertyDiffers: ws.mismatches(),
      comparedWithModel: ws.compareOpened(),
      share: { script: sv.script, reflect: sv.reflect },
      quiz: analysis,
      conclusion: cv.conclusion,
      curiosity: curiosity.value(),
    };
  }

  lesson.finish({
    stage: "wrapup", // 마치기 화면이 있는 단계(공통 틀 기본값 "curiosity"는 이 앱에 없다)
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    // '더 탐구하고 싶은 점'이 비었는지·무의미한지는 공통 틀(lesson.js)이 마칠 때 본다(필수, 느슨 판정)
    canFinish: function () {
      if (!quiz.isDone()) return "정리 질문의 문제 " + quizItems.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      return conclude.isDone() || "결론을 먼저 적고 제출해 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      // 틀린 뒤 고쳐 맞혀도 모두 "맞힘"이 되므로, 처음에 맞힌 문제 수를 따로 보여 준다
      var firstTry = quizItems.filter(function (qq) {
        return q[qq.id].correct && q[qq.id].tries === 1;
      }).length;
      var rows = ws.rows();
      var acid = rows.filter(function (r) {
        return r.property === "산성";
      }).length;
      var diff = ws.mismatches().length;
      return [
        "조사해 정리한 예: " + rows.length + "가지 (산성 용액 " + acid + "가지, 염기성 용액 " + (rows.length - acid) + "가지)",
        diff ? "⚠ 참고 예시와 성질이 다르게 적힌 용액이 " + diff + "가지 있어요. 조사하기로 돌아가 다시 확인해 보세요." : null,
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
        return predict.isDone() || "조사 시작하기의 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      share: function () {
        var s = ws.status();
        return s === true ? true : "조사하기: " + s;
      },
      wrapup: function () {
        var s = share.status();
        return s === true ? true : "발표 준비하기: " + s;
      },
    },
    done: {
      intro: predict.isDone,
      research: ws.isDone,
      share: share.isDone,
      wrapup: function () {
        return quiz.isDone() && conclude.isDone() && !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      share: share.refresh,
      wrapup: drawConcludeGate,
    },
  });
})();
