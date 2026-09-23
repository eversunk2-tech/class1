/*
 * science-sim/conclude.js — 정리하기: 결론 → 모범 답안 비교, 발전 질문 → 모범 답안 (정본: scripts/templates/science-sim/)
 * 학생이 먼저 적고 '제출'해야 모범 답안이 보인다. 문항은 순서대로 하나씩 열린다.
 *
 *   var conclude = SciSim.Conclude.render(el, [
 *     { id: "conclusion", kind: "결론", prompt: "…", model: "모범 답안" | ["줄1", "줄2"], compareTip: "…" },
 *     { id: "ext1", kind: "발전 질문 1", prompt: "…", model: … },
 *   ], store, onChange, { minLength: 5 });   // 마지막 인자 선택(제출에 필요한 최소 글자 수, 기본 5)
 *   conclude.isDone()   → 모든 문항을 제출했는지
 *   conclude.values()   → { conclusion: "…", ext1: "…", … }
 *   conclude.qa(stage)  → [{ stage, id, label: kind, question: prompt, kind: "text", answer, submitted }] (detail.qa용, stage 기본 "conclude")
 *   저장 키: "conclude"
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;
  var DEFAULT_MIN = 5;

  function modelNode(model) {
    var lines = Array.isArray(model) ? model : [model];
    return el(
      "div",
      { class: "ss-model-text" },
      lines.map(function (l) {
        return el("p", { text: l });
      })
    );
  }

  SciSim.Conclude = {
    render: function (root, items, store, onChange, options) {
      var MIN = (options && options.minLength) || DEFAULT_MIN;
      var state = store.get("conclude", {}) || {};
      var save = SciSim.debounce(function () {
        store.set("conclude", state);
      }, 250);
      root.textContent = "";
      var blocks = [];

      items.forEach(function (it, idx) {
        var st = state[it.id] || (state[it.id] = { text: "", submitted: false });
        var id = "ss-conclude-" + it.id;
        var ta = el("textarea", { id: id, class: "ss-textarea", rows: "4", maxlength: "1000", placeholder: "내 말로 적어 보세요." });
        ta.value = st.text || "";
        var submit = el("button", { type: "button", class: "ss-btn ss-btn-primary", text: "제출하고 모범 답안 보기" });
        var msg = el("p", { class: "ss-help", "aria-live": "polite" });
        var compare = el("div", { class: "ss-compare", hidden: true });
        var card = el("div", { class: "ss-card ss-conclude" }, [
          el("label", { for: id, class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: it.kind }), it.prompt]),
          ta,
          el("div", { class: "ss-row" }, [submit]),
          msg,
          compare,
        ]);

        function drawCompare() {
          compare.textContent = "";
          if (!st.submitted) {
            compare.hidden = true;
            submit.textContent = "제출하고 모범 답안 보기";
            return;
          }
          compare.hidden = false;
          submit.textContent = "고친 내용 다시 제출하기";
          compare.appendChild(
            el("div", { class: "ss-compare-grid" }, [
              el("div", { class: "ss-compare-mine" }, [el("h4", { text: "✏️ 내 답" }), el("p", { class: "ss-mine-text", text: st.text })]),
              el("div", { class: "ss-compare-model" }, [el("h4", { text: "📘 모범 답안" }), modelNode(it.model)]),
            ])
          );
          compare.appendChild(el("p", { class: "ss-help", text: it.compareTip || "내 답과 모범 답안을 비교해 보세요. 빠진 내용이 있으면 위에서 고쳐 써도 좋아요." }));
        }

        ta.addEventListener("input", function () {
          st.text = ta.value;
          save();
          msg.textContent = "";
        });
        submit.addEventListener("click", function () {
          var t = ta.value.trim();
          if (t.length < MIN) {
            msg.textContent = "조금 더 자세히 적어 보세요. (" + MIN + "글자 이상)";
            ta.focus();
            return;
          }
          st.text = t;
          st.submitted = true;
          store.set("conclude", state);
          drawCompare();
          update();
          if (onChange) onChange();
        });

        drawCompare();
        root.appendChild(card);
        blocks.push({ card: card, idx: idx });
      });

      function update() {
        // 앞 문항을 제출해야 다음 문항이 열린다
        var open = true;
        blocks.forEach(function (b) {
          b.card.hidden = !open;
          open = open && state[items[b.idx].id].submitted;
        });
      }
      update();

      return {
        isDone: function () {
          return items.every(function (it) {
            return state[it.id] && state[it.id].submitted;
          });
        },
        values: function () {
          var out = {};
          items.forEach(function (it) {
            out[it.id] = state[it.id] ? state[it.id].text || "" : "";
          });
          return out;
        },
        /* 질문-답 표준 목록(detail.qa). answer는 values()와 같고, submitted로 '제출하고 모범 답안 보기'를 눌렀는지 알린다. stage 기본 "conclude" */
        qa: function (stage) {
          return items.map(function (it) {
            var st = state[it.id] || {};
            return {
              stage: stage || "conclude",
              id: it.id,
              label: it.kind,
              question: it.prompt,
              kind: "text",
              answer: st.text || "",
              submitted: !!st.submitted,
            };
          });
        },
      };
    },
  };
})();
