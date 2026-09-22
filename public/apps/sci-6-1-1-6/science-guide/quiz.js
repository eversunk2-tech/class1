/*
 * science-guide/quiz.js — 보기 고르기 퀴즈 + 맞고 틀림 피드백 (정본: scripts/templates/science-guide/)
 * science-sim/quiz.js를 복사해 **문항 번호 앞 말(numLabel)과 저장 키(key) 옵션만 더했다**(나머지는 같다).
 * 채점은 보기 선택이 정답과 정확히 같을 때만 정답(여러 개 고르기는 모두 맞고 더 고른 것이 없어야 함).
 * 틀리면 피드백을 보고 다시 고를 수 있다(마지막 선택과 시도 횟수를 저장).
 *
 *   var quiz = SciSim.Quiz.render(el, [
 *     { id: "q1", text: "…", multi: true,
 *       options: [{ id: "a", label: "…" }, …], answer: ["a", "c"],
 *       correct: "맞았을 때 피드백", wrong: "틀렸을 때 피드백(답을 직접 말하지 않고 다시 볼 곳을 알려 준다)",
 *       wrongBy: { "b": "보기 b를 골랐을 때만 보여 줄 피드백" },        // 선택
 *       missBy: { "c": "정답 보기 c를 빠뜨렸을 때 보여 줄 피드백" },     // 선택(wrongBy가 먼저)
 *       grade: function (choiceIds) { return true | false; } },      // 선택: 정확 일치 대신 쓸 채점(예: '하나 이상 고르고 오답 보기는 없음')
 *   ], store, onChange, { numLabel: "문제", key: "analysis" });   // 마지막 인자 선택(기본값이 이것)
 *   quiz.isDone()   → 모든 문항을 '확인'했는지
 *   quiz.result()   → { q1: { choice: [...], correct: true, tries: 2 }, … }
 *   quiz.qa(stage)  → [{ stage, id, label, question, kind: "choice", multi, options: [라벨…], answer: { chosen: [라벨…], correct, tries } }] (detail.qa용, stage 기본 "quiz")
 *   저장 키: "analysis"
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var s = a.slice().sort().join("|");
    return s === b.slice().sort().join("|");
  }

  SciSim.Quiz = {
    render: function (root, questions, store, onChange, options) {
      var numLabel = (options && options.numLabel) || "문제";
      var KEY = (options && options.key) || "analysis";
      var state = store.get(KEY, {}) || {};
      root.textContent = "";

      questions.forEach(function (q, qi) {
        var st = state[q.id] || (state[q.id] = { choice: [], checked: false, correct: false, tries: 0 });
        var name = "ss-quiz-" + q.id;
        var fs = el("fieldset", { class: "ss-card ss-quiz" });
        fs.appendChild(
          el("legend", { class: "ss-q-label" }, [
            el("span", { class: "ss-q-num", text: numLabel + " " + (qi + 1) }),
            q.text,
            q.multi ? el("span", { class: "ss-q-note", text: " (알맞은 것을 모두 고르세요)" }) : el("span", { class: "ss-q-note", text: " (하나를 고르세요)" }),
          ])
        );
        var opts = el("div", { class: "ss-options" });
        var feedback = el("p", { class: "ss-feedback", "aria-live": "polite" });
        var checkBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary", text: "확인하기" });

        q.options.forEach(function (o) {
          var input = el("input", { type: q.multi ? "checkbox" : "radio", name: name, value: o.id });
          input.checked = st.choice.indexOf(o.id) >= 0;
          input.addEventListener("change", function () {
            var chosen = [];
            opts.querySelectorAll("input").forEach(function (i) {
              if (i.checked) chosen.push(i.value);
            });
            st.choice = chosen;
            st.checked = false; // 선택을 바꾸면 다시 확인해야 한다
            store.set(KEY, state);
            draw();
            if (onChange) onChange();
          });
          opts.appendChild(el("label", { class: "ss-option" }, [input, el("span", { text: o.label })]));
        });

        function draw() {
          fs.classList.toggle("is-correct", st.checked && st.correct);
          fs.classList.toggle("is-wrong", st.checked && !st.correct);
          checkBtn.disabled = st.choice.length === 0;
          if (!st.checked) {
            feedback.textContent = "";
            feedback.className = "ss-feedback";
            return;
          }
          feedback.className = "ss-feedback " + (st.correct ? "is-correct" : "is-wrong");
          var special = null;
          if (!st.correct && q.wrongBy) {
            st.choice.some(function (id) {
              if (q.wrongBy[id]) special = q.wrongBy[id];
              return !!special;
            });
          }
          if (!st.correct && !special && q.missBy) {
            (q.answer || []).some(function (id) {
              if (st.choice.indexOf(id) < 0 && q.missBy[id]) special = q.missBy[id];
              return !!special;
            });
          }
          feedback.textContent = st.correct ? "⭕ 맞았어요! " + q.correct : "❌ 다시 생각해 볼까요? " + (special || q.wrong);
        }

        checkBtn.addEventListener("click", function () {
          if (!st.choice.length) return;
          st.checked = true;
          st.tries = (st.tries || 0) + 1;
          st.correct = typeof q.grade === "function" ? !!q.grade(st.choice.slice()) : sameSet(st.choice, q.answer);
          store.set(KEY, state);
          draw();
          if (onChange) onChange();
        });

        fs.appendChild(opts);
        fs.appendChild(el("div", { class: "ss-row" }, [checkBtn]));
        fs.appendChild(feedback);
        root.appendChild(fs);
        draw();
      });

      return {
        isDone: function () {
          return questions.every(function (q) {
            return state[q.id] && state[q.id].checked;
          });
        },
        result: function () {
          var out = {};
          questions.forEach(function (q) {
            var s = state[q.id] || {};
            out[q.id] = { choice: (s.choice || []).slice(), correct: !!(s.checked && s.correct), tries: s.tries || 0 };
          });
          return out;
        },
        /* 질문-답 표준 목록(detail.qa). 고른 보기는 id가 아니라 사람이 읽는 라벨로 넣는다. stage 기본 "quiz" */
        qa: function (stage) {
          return questions.map(function (q, qi) {
            var s = state[q.id] || {};
            var label = function (id) {
              var o = q.options.filter(function (x) {
                return x.id === id;
              })[0];
              return o ? o.label : id;
            };
            return {
              stage: stage || "quiz",
              id: q.id,
              label: numLabel + " " + (qi + 1),
              question: q.text,
              kind: "choice",
              multi: !!q.multi,
              options: q.options.map(function (o) {
                return o.label;
              }),
              answer: { chosen: (s.choice || []).map(label), correct: !!(s.checked && s.correct), tries: s.tries || 0 },
            };
          });
        },
      };
    },
  };
})();
