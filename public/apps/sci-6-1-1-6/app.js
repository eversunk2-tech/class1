/*
 * app.js — sci-6-1-1-6 "산성화가 환경에 미치는 영향을 알아볼까?" (조사 도우미)
 * 공통 틀(science-guide/)이 단계 이동·주제 고르기·조사 팁·정리 틀·참고 자료·공유 준비·퀴즈·정리·저장을 맡고,
 * 이 파일은 config를 각 모듈에 넘기고 단계 조건과 저장 detail만 정한다. 화면의 사실은 모두 data/lesson-config.js에서 온다.
 * 학생 입력은 공통 틀이 textContent로만 넣는다(innerHTML 없음).
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
  // 빈칸 채우기는 Conclude 모듈을 하나 더 쓰므로 저장 키가 겹치지 않게 하위 접두사를 쓴다(처음부터 다시 하기에서 함께 지워진다).
  var fillStore = S.createStore(C.storageKey + ":fill");
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var refresh = function () {
    lesson.refresh();
  };

  /* ───────── 1. 조사 준비 ───────── */
  $("intro-lead").textContent = C.intro.lead;
  var predict = S.Predict.render(
    $("predict-root"),
    { questions: C.intro.questions, hints: C.intro.hints, minLength: C.intro.minLength, lengthTip: "왜 그렇게 생각했는지도 함께 적어 보세요." },
    store,
    function () {
      drawIntroGate();
      refresh();
    }
  );

  // 개념 카드: 도입 질문을 다 적은 뒤에만 보인다(용어는 내 생각을 적은 다음에 소개).
  $("concept-root").appendChild(
    el(
      "div",
      { class: "ss-card concept-card" },
      [el("h3", { class: "sg-card-h", text: C.intro.conceptTitle })]
        .concat(
          C.intro.concept.map(function (t) {
            return S.rich(t, "p");
          })
        )
        .concat([el("p", { class: "ss-help sg-source", text: "출처: " + C.intro.conceptSource })])
    )
  );

  var topic = S.TopicPicker.render(
    $("topic-root"),
    {
      title: "모둠별로 조사할 주제를 하나 골라요",
      choices: C.intro.topicChoices,
      confirmChange: "주제를 바꾸면 조사하기와 공유 준비하기에 적은 내용이 지워져요. 바꿀까요?",
      locked: function () {
        return (predict.isDone() && introSubmitted()) || "먼저 두 질문에 내 생각을 적고 '생각 다 적었어요'를 눌러요.";
      },
    },
    store,
    function (id, prev) {
      if (prev) {
        // 주제가 달라지면 조사 기록·공유 대본이 맞지 않으므로 지운다(정리하기·궁금한 점은 주제와 관계없어 남긴다).
        ["research", "refOpen", "share"].forEach(function (k) {
          store.remove(k);
        });
        store.set("step", "intro");
        location.reload();
        return;
      }
      drawTopic();
      buildResearch();
      refresh();
      lesson.toast("주제를 골랐어요: " + topic.label() + ". '다음 단계'를 눌러 조사해요.");
    },
    { key: "topic" }
  );

  // 개념 카드는 '생각 다 적었어요'를 눌러야 열린다. 누른 때의 답을 '처음 생각'으로 남겨, 개념을 본 뒤 고친 답과 구별한다.
  // (이전 판에서 이미 주제를 고른 기록이 있으면 그때의 답을 처음 생각으로 본다)
  if (!store.get("introSnapshot", null) && store.get("topic", "")) store.set("introSnapshot", predict.values());
  function introSubmitted() {
    return !!store.get("introSnapshot", null);
  }
  var introBtn = $("btn-intro-submit");
  introBtn.addEventListener("click", function () {
    if (!predict.isDone()) return;
    store.set("introSnapshot", predict.values());
    drawIntroGate();
    refresh();
    lesson.toast("내 생각을 기록했어요. 이제 '산성화'의 뜻을 읽고 조사할 주제를 골라요.");
  });
  function introRevised() {
    var snap = store.get("introSnapshot", null);
    if (!snap) return false;
    var cur = predict.values();
    return cur.q1 !== snap.q1 || cur.q2 !== snap.q2;
  }
  function drawIntroGate() {
    var ready = predict.isDone();
    var open = ready && introSubmitted();
    $("concept-area").hidden = !open;
    $("concept-locked").hidden = open;
    introBtn.disabled = !ready;
    $("concept-locked-msg").textContent = ready
      ? "🔒 두 질문에 내 생각을 다 적었으면 아래 버튼을 눌러요. '산성화'가 무엇인지 알려 주는 카드와 조사 주제 고르기가 나와요."
      : "🔒 두 질문에 내 생각을 " + predict.minLength + "글자 이상 적으면 '산성화'가 무엇인지 알려 주는 카드와 조사 주제 고르기가 나와요.";
    $("intro-revised").hidden = !(open && introRevised());
    topic.refresh();
  }
  drawIntroGate();

  /* ───────── 2. 조사하기 ───────── */
  var T = null; // 고른 주제의 사실(buildResearch에서 정한다)
  function drawTopic() {
    var box = $("research-topic");
    box.textContent = "";
    var t = C.topics[topic.value()];
    if (!t) return;
    var ch = C.intro.topicChoices.filter(function (c) {
      return c.id === topic.value();
    })[0];
    box.appendChild(
      el("div", { class: "ss-card sg-topic-card" }, [
        el("h3", { class: "sg-card-h" }, ["🔎 내가 고른 주제: ", el("span", { "aria-hidden": "true", text: (ch && ch.icon ? ch.icon + " " : "") }), t.label]),
        el("p", { class: "ss-help", text: "조사 팁을 참고해 " + S.josa(t.label, "으로", "로") + " 인한 환경의 피해 사례를 찾아 정리 틀에 적어요. 주제를 바꾸려면 1단계로 돌아가요." }),
      ])
    );
  }
  drawTopic();

  // 조사 팁·정리 틀·지도서 사실은 고른 주제에 맞춰 그린다. 처음 고를 때는 다시 그리고, 바꿀 때는 새로고침한다(위 onChange).
  var TP = C.tips;
  var ws = null;
  var ref = null;
  function buildResearch() {
    T = C.topics[topic.value()] || null;
    S.TipsPanel.render(
      $("tips-root"),
      {
        keywords: T ? T.searchTerms : [],
        sources: TP.sources,
        sourceNote: "누리집은 선생님과 함께 확인하며 열어요(새 창). 수업과 관련된 자료만 찾아봐요.",
        items: [
          { icon: "✅", title: "믿을 수 있는 자료인지 확인해요", text: TP.sourceCheck },
          { icon: "🤝", title: "인터넷 사용 약속", text: TP.ethics },
          { icon: "📝", title: "이렇게 정리해요", text: TP.howTo },
          { icon: "⚠️", title: "기기 안전", text: TP.deviceSafety, tone: "warn" },
        ],
        source: TP.source,
      },
      { toast: lesson.toast }
    );

    ws = S.Worksheet.render(
      $("worksheet-root"),
      {
        title: "📝 조사 결과 정리하기",
        lead: "조사한 내용을 **내 말로** 적어요. 네 칸을 모두 채우면 아래의 '참고 자료 속 사실'이 열려 내 조사와 비교할 수 있어요.",
        rowLabel: T ? T.label : "조사",
        fields: C.worksheet.fields,
        fixed: true,
        startRows: 1,
        minRows: 1,
        incompleteText: "원인·피해·대책은 5글자 이상, 출처는 2글자 이상 모두 적어 주세요.",
        doneText: "✔ 네 칸을 모두 채웠어요. 아래에서 참고 자료 속 사실과 비교해 보세요.",
      },
      store,
      function () {
        if (ref) ref.refresh();
        refresh();
      },
      { key: "research" }
    );

    // 주제별 지도서 사실: 정리 틀을 다 채운 뒤에만 열린다(답 먼저 보기 방지). 색이 아니라 이름·기호로 구분.
    ref = null;
    $("ref-root").textContent = "";
    if (!T) return;
    var groups = [
      { id: "cause", label: "원인", icon: "🔍", tone: "a", text: T.facts.cause },
      { id: "damage", label: "피해(현황·전망)", icon: "⚠️", tone: "b", text: T.facts.damage },
      { id: "solution", label: "대책", icon: "🌿", tone: "c", text: T.facts.solution },
    ];
    // 산호초 백화 현상은 여러 원인(주로 수온 상승)이 함께 작용한다는 점을 따로 알려 준다(지도서 159쪽 지도 길잡이 7)
    if (T.facts.damageNote) groups.splice(2, 0, { id: "damageNote", label: "알아 두기: 산호초 백화 현상", icon: "🌡️", text: T.facts.damageNote });
    if (T.facts.extra) groups.push({ id: "extra", label: "알아 두기", icon: "🐚", text: T.facts.extra });
    ref = S.RefCards.render(
      $("ref-root"),
      {
        title: "📚 참고 자료 속 사실과 비교해 보기: " + T.label,
        lead: "내가 조사한 내용과 비교해 보세요. 빠진 것이 있으면 위 정리 틀에 더 적어도 좋아요. (채점하지 않아요)",
        source: T.source,
        open: true,
        groups: groups,
        locked: function () {
          return ws.isDone() || "정리 틀의 네 칸을 먼저 채우면 열려요.";
        },
      },
      store,
      { key: "refOpen" }
    );
  }
  buildResearch();

  /* ───────── 3. 공유 준비하기 ───────── */
  var SH = C.share;
  function research() {
    return ws.allRows()[0] || {};
  }
  function stripEnd(s) {
    // 초안에 끼워 넣을 때 끝의 마침표만 뗀다(학생 글은 그대로 둔다)
    return String(s || "")
      .trim()
      .replace(/[.。!?\s]+$/, "");
  }
  var share = S.SharePrep.render(
    $("share-root"),
    {
      summaryTitle: "📋 내가 조사한 것 (조사하기에서 적은 내용)",
      script: { prompt: SH.scriptPrompt, placeholder: SH.scriptPlaceholder, minLength: SH.minLength, template: SH.template, copy: true, platformNote: SH.platformNote },
      checklist: { title: SH.checklistTitle, items: SH.checklist },
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
        var r = research();
        var out = [];
        if (topic.label()) out.push("주제: " + topic.label());
        C.worksheet.fields.forEach(function (f) {
          if (r[f.id]) out.push(f.label + ": " + r[f.id]);
        });
        return out.length > 1 ? out : [];
      },
      fill: function () {
        var r = research();
        return { topic: topic.label(), cause: stripEnd(r.cause), damage: stripEnd(r.damage), solution: stripEnd(r.solution), source: stripEnd(r.source) };
      },
    }
  );

  /* ───────── 4. 정리하기 ───────── */
  var fill = S.Conclude.render($("fill-root"), [C.fill], fillStore, function () {
    drawWrapGate();
    refresh();
  }, { minLength: 2 });

  var quizItems = C.quiz.map(function (q) {
    var idOf = function (label) {
      return "o" + (q.options.indexOf(label) + 1);
    };
    var wrongBy = {};
    Object.keys(q.wrongBy || {}).forEach(function (label) {
      wrongBy[idOf(label)] = q.wrongBy[label];
    });
    return {
      id: q.id,
      text: q.text,
      options: q.options.map(function (label, i) {
        return { id: "o" + (i + 1), label: label };
      }),
      answer: [idOf(q.answer)],
      correct: q.correct,
      wrong: q.wrong,
      wrongBy: wrongBy,
    };
  });
  var quiz = S.Quiz.render($("quiz-root"), quizItems, store, function () {
    drawWrapGate();
    refresh();
  }, { numLabel: "문제", key: "quiz" });
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, refresh, { minLength: 10 });
  function drawWrapGate() {
    $("quiz-area").hidden = !fill.isDone();
    var open = fill.isDone() && quiz.isDone();
    $("conclude-root").hidden = !open;
    $("conclude-locked").hidden = open;
  }
  drawWrapGate();

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
      topic: topic.label(),
      // 처음 생각(개념 카드를 보기 전)과, 그 뒤에 고쳤다면 고친 생각을 따로 남긴다
      intro: (function () {
        var snap = store.get("introSnapshot", null) || pv;
        var o = { q1: snap.q1, q2: snap.q2, hintsOpened: predict.hintsOpened() };
        if (introRevised()) o.revised = { q1: pv.q1, q2: pv.q2 };
        return o;
      })(),
      research: ws.rows()[0] || research(),
      openedFacts: !!store.get("refOpen", false) && ws.isDone(),
      share: { script: sv.script, checked: sv.checked, reflect: sv.reflect },
      fill: fill.values().fill,
      quiz: analysis,
      why: cv.why,
      extension: cv.ext1,
      conclusion: cv.conclusion,
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
      // 틀린 뒤 고쳐 맞혀도 모두 맞힘이 되므로, 처음 고른 답으로 맞힌 수를 보여 준다
      var firstTry = quizItems.filter(function (qq) {
        return q[qq.id].correct && q[qq.id].tries === 1;
      }).length;
      return [
        "조사한 주제: " + (topic.label() || "-"),
        "원인·피해·대책·출처를 정리하고 공유 대본을 썼어요.",
        "정리 문제 " + quizItems.length + "개를 모두 확인했어요. (처음 고른 답으로 맞힌 문제 " + firstTry + "개)",
      ];
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
      research: function () {
        if (!predict.isDone()) return "조사 준비의 두 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
        if (!introSubmitted()) return "두 질문을 다 적었으면 '생각 다 적었어요' 버튼을 눌러 주세요.";
        if (!topic.isDone()) return "조사할 주제를 하나 골라 주세요.";
        return true;
      },
      share: function () {
        var s = ws.status();
        return s === true ? true : "조사하기: " + s;
      },
      wrapup: function () {
        var s = share.status();
        return s === true ? true : "공유 준비하기: " + s;
      },
      curiosity: function () {
        if (!fill.isDone()) return "정리하기의 빈칸 채우기를 먼저 제출해 주세요.";
        if (!quiz.isDone()) return "정리하기의 문제 " + quizItems.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
        return conclude.isDone() || "서술형·발전 질문·결론을 모두 제출해 주세요.";
      },
    },
    done: {
      intro: function () {
        return predict.isDone() && introSubmitted() && topic.isDone();
      },
      research: function () {
        return ws.isDone();
      },
      share: share.isDone,
      wrapup: function () {
        return fill.isDone() && quiz.isDone() && conclude.isDone();
      },
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      share: share.refresh,
      research: function () {
        if (ref) ref.refresh();
      },
      wrapup: drawWrapGate,
    },
  });
})();
