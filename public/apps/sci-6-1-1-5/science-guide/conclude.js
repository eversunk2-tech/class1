/*
 * science-guide/conclude.js — 정리하기: 결론 → 모범 답안 비교, 발전 질문 → 모범 답안 (정본: scripts/templates/science-guide/, science-sim에서 복사)
 * 학생이 먼저 적고 '제출'해야 모범 답안이 보인다. 문항은 순서대로 하나씩 열린다.
 *
 *   var conclude = SciSim.Conclude.render(el, [
 *     { id: "conclusion", kind: "결론", prompt: "…", model: "모범 답안" | ["줄1", "줄2"], compareTip: "…" },
 *     { id: "ext1", kind: "발전 질문 1", prompt: "…", model: … },
 *   ], store, onChange, { minLength: 5 });   // 마지막 인자 선택(제출에 필요한 최소 글자 수, 기본 5)
 *   conclude.isDone()   → 모든 문항을 제출했는지
 *   conclude.values()   → { conclusion: "…", ext1: "…", … }   (마지막으로 제출한 글)
 *   conclude.qa(stage)  → [{ stage, id, label: kind, question: prompt, kind: "text", answer, submitted }] (detail.qa용, stage 기본 "conclude")
 *   저장 키: "conclude"
 *
 * 답 되짚기·차단(answer-check.js, docs/science/answer-check/spec.md)
 *   index.html에 answer-check.js를 불러온 앱에서만 동작한다(app.js 무변경). '제출하고 모범 답안 보기'를 누르면
 *   글자 수를 확인한 뒤 답을 한 번 살펴보고, 막히면 모범 답안을 아직 보여 주지 않는다. 적은 글은 지우지 않는다.
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
      var AC = SciSim.AnswerCheck || null;
      function keyOf(it) {
        return "conclude:" + it.id;
      }

      items.forEach(function (it, idx) {
        var st = state[it.id] || (state[it.id] = { text: "", submitted: false });
        // sent: 마지막으로 제출한 글. 제출 뒤 고친 글은 다시 제출해야 비교 칸과 결과(values)에 반영된다.
        if (st.submitted && st.sent == null) st.sent = st.text || "";
        var id = "ss-conclude-" + it.id;
        var ta = el("textarea", { id: id, class: "ss-textarea", rows: "4", maxlength: "1000", placeholder: "내 말로 적어 보세요." });
        ta.value = st.text || "";
        var submit = el("button", { type: "button", class: "ss-btn ss-btn-primary", text: "제출하고 모범 답안 보기" });
        var msg = el("p", { class: "ss-help", "aria-live": "polite" });
        var compare = el("div", { class: "ss-compare", hidden: true });
        var acHost = el("div", { class: "ss-ac-host" });
        var card = el("div", { class: "ss-card ss-conclude" }, [
          el("label", { for: id, class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: it.kind }), it.prompt]),
          ta,
          el("div", { class: "ss-row" }, [submit]),
          msg,
          acHost,
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
              el("div", { class: "ss-compare-mine" }, [el("h4", { text: "✏️ 내 답" }), el("p", { class: "ss-mine-text", text: st.sent })]),
              el("div", { class: "ss-compare-model" }, [el("h4", { text: "📘 모범 답안" }), modelNode(it.model)]),
            ])
          );
          compare.appendChild(el("p", { class: "ss-help", text: it.compareTip || "내 답과 모범 답안을 비교해 보세요. 빠진 내용이 있으면 위에서 고쳐 써도 좋아요." }));
        }

        ta.addEventListener("input", function () {
          st.text = ta.value;
          save();
          msg.textContent = st.submitted && ta.value.trim() !== st.sent ? "고친 내용은 '고친 내용 다시 제출하기'를 눌러야 반영돼요." : "";
        });
        function accept(t) {
          st.text = t;
          st.sent = t;
          st.submitted = true;
          msg.textContent = "";
          store.set("conclude", state);
          drawCompare();
          update();
          if (onChange) onChange();
        }
        var checking = false;
        submit.addEventListener("click", function () {
          if (checking) return;
          var t = ta.value.trim();
          if (t.length < MIN) {
            msg.textContent = "조금 더 자세히 적어 보세요. (" + MIN + "글자 이상)";
            ta.focus();
            return;
          }
          if (!AC) return accept(t);
          checking = true;
          submit.disabled = true;
          AC.verify({
            key: keyOf(it),
            stage: "conclude",
            question: it.prompt,
            answer: t,
            model: it.model,
            hint: it.checkHint || it.compareTip,
            mount: acHost,
            focus: ta,
            submitLabel: "그대로 제출하고 모범 답안 볼게요",
          }).then(
            function (okv) {
              checking = false;
              submit.disabled = false;
              /* 카드를 보는 동안 글을 고쳤으면 고친 글을 제출한다(너무 짧아졌으면 검사한 글 그대로) */
              var now = ta.value.trim();
              if (okv !== false) accept(now.length >= MIN ? now : t);
            },
            function () {
              /* 검사 자체가 실패하면 막지 않는다 */
              checking = false;
              submit.disabled = false;
              accept(t);
            }
          );
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
            // 제출한 글만 결과로 쓴다(제출 뒤 고치고 다시 제출하지 않은 글은 넣지 않음)
            out[it.id] = state[it.id] && state[it.id].submitted ? state[it.id].sent || "" : "";
          });
          return out;
        },
        /* 질문-답 표준 목록(detail.qa). answer는 values()와 같다(제출한 글만). stage 기본 "conclude" */
        qa: function (stage) {
          return items.map(function (it) {
            var st = state[it.id] || {};
            var item = {
              stage: stage || "conclude",
              id: it.id,
              label: it.kind,
              question: it.prompt,
              kind: "text",
              answer: st.submitted ? st.sent || "" : "",
              submitted: !!st.submitted,
            };
            /* 되짚기·차단 기록(값이 있을 때만 덧붙인다 — 기존 항목 모양은 그대로) */
            if (AC) {
              var extra = AC.qaFields(keyOf(it));
              Object.keys(extra).forEach(function (k) {
                item[k] = extra[k];
              });
            }
            return item;
          });
        },
      };
    },
  };
})();
