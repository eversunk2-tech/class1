/*
 * science-sim/predict.js — 예상하기 화면 (정본: scripts/templates/science-sim/)
 * 규칙: 답을 미리 보여 주지 않는다. 학생이 직접 타이핑한다. 힌트는 한 단계씩 열리고, 답이 아닌 생각할 거리만 준다.
 *
 *   var predict = SciSim.Predict.render(el, {
 *     intro: "…",                                   // 선택
 *     questions: [{ id: "q1", text: "…", placeholder: "…" }],
 *     hints: ["첫 번째 힌트", "두 번째 힌트", …],     // 순서대로 하나씩 열린다
 *     minLength: 10,                                 // 이 글자 수 이상이면 '적었다'로 본다(기본 2). 3 이상이면 입력칸 아래에 남은 글자 수를 알려 준다.
 *     lengthTip: "까닭도 함께 적어 보세요.",          // 선택: 글자 수 안내 뒤에 붙는 말
 *   }, store, onChange);
 *   predict.values()   → { q1: "…", q2: "…" }
 *   predict.isDone()   → 모든 질문을 적었는지
 *   predict.qa(stage)  → [{ stage, id, label, question, kind: "text", answer }] (detail.qa용 질문-답 목록, stage 기본 "predict")
 *   predict.checkPass() → true | Promise<bool> (답 되짚기·차단 — answer-check.js가 있을 때만, 없으면 늘 true)
 *   저장 키: "predict"(답), "hints"(열린 힌트 수)
 *
 * 답 되짚기·차단(answer-check.js, docs/science/answer-check/spec.md)
 *   - index.html에 answer-check.js를 불러온 앱에서만 동작한다. app.js는 바꿀 필요가 없다:
 *     이 화면이 들어 있는 <section data-stage="…">를 스스로 찾아 등록하고, lesson.js가 단계 이동 직전에 불러 준다.
 *   - 막히면 그 질문 칸 아래에 카드가 뜨고, 학생이 적은 글은 지우지 않는다.
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  SciSim.Predict = {
    render: function (root, cfg, store, onChange) {
      var values = store.get("predict", {}) || {};
      var opened = Math.min(store.get("hints", 0) || 0, (cfg.hints || []).length);
      var minLength = cfg.minLength || 2;
      var save = SciSim.debounce(function () {
        store.set("predict", values);
      }, 250);

      root.textContent = "";
      if (cfg.intro) root.appendChild(el("p", { class: "ss-lead", text: cfg.intro }));

      var boxes = {}; /* 질문별 { ta, host } — 되짚기·차단 카드를 붙일 자리 */

      cfg.questions.forEach(function (q, i) {
        var id = "ss-predict-" + q.id;
        var ta = el("textarea", {
          id: id,
          class: "ss-textarea",
          rows: "4",
          placeholder: q.placeholder || "내 생각을 적어 보세요.",
          maxlength: "1000",
        });
        ta.value = values[q.id] || "";
        var note = minLength > 2 ? el("p", { class: "ss-help ss-len-note", id: id + "-note", "aria-live": "polite" }) : null;
        if (note) ta.setAttribute("aria-describedby", id + "-note");
        var drawNote = function () {
          if (!note) return;
          var n = (values[q.id] || "").trim().length;
          note.textContent =
            n >= minLength
              ? "✔ 잘 적었어요." + (cfg.lengthTip ? " " + cfg.lengthTip : "")
              : minLength + "글자 이상 적어 주세요. (지금 " + n + "글자)" + (cfg.lengthTip ? " " + cfg.lengthTip : "");
          note.classList.toggle("is-ok", n >= minLength);
        };
        ta.addEventListener("input", function () {
          values[q.id] = ta.value;
          save();
          drawNote();
          if (onChange) onChange();
        });
        drawNote();
        var host = el("div", { class: "ss-ac-host" });
        boxes[q.id] = { ta: ta, host: host };
        root.appendChild(
          el("div", { class: "ss-card ss-question" }, [
            el("label", { for: id, class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "질문 " + (i + 1) }), q.text]),
            ta,
            note,
            host,
          ])
        );
      });

      var hints = cfg.hints || [];
      if (hints.length) {
        var list = el("ol", { class: "ss-hint-list", "aria-live": "polite" });
        var btn = el("button", { type: "button", class: "ss-btn ss-btn-ghost" });
        var box = el("div", { class: "ss-card ss-hints" }, [
          el("p", { class: "ss-hint-title", text: "💡 생각이 잘 안 나면 힌트를 하나씩 열어 보세요. (힌트는 답이 아니에요)" }),
          list,
          btn,
        ]);
        var drawHints = function () {
          list.textContent = "";
          for (var i = 0; i < opened; i++) list.appendChild(el("li", { text: hints[i] }));
          if (opened >= hints.length) {
            btn.textContent = "힌트를 모두 열었어요";
            btn.disabled = true;
          } else {
            btn.textContent = "힌트 " + (opened + 1) + " 보기 (" + (opened + 1) + "/" + hints.length + ")";
            btn.disabled = false;
          }
        };
        btn.addEventListener("click", function () {
          if (opened < hints.length) opened++;
          store.set("hints", opened);
          drawHints();
        });
        drawHints();
        root.appendChild(box);
      }

      /* ── 답 되짚기·차단(answer-check.js가 있을 때만) ── */
      var AC = SciSim.AnswerCheck || null;
      function keyOf(q) {
        return "predict:" + q.id;
      }
      function checkPass() {
        if (!AC) return true;
        var list = cfg.questions.slice();
        var i = 0;
        function step() {
          if (i >= list.length) return Promise.resolve(true);
          var q = list[i++];
          var box = boxes[q.id];
          var text = (values[q.id] || "").trim();
          if (!box || text.length < minLength) return step(); /* 글자 수는 기존 gate가 본다 */
          return AC.verify({
            key: keyOf(q),
            stage: "predict",
            question: q.text,
            answer: text,
            hint: q.checkHint || cfg.checkHint,
            mount: box.host,
            focus: box.ta,
          }).then(function (okv) {
            return okv === false ? false : step();
          });
        }
        return step();
      }
      /* 이 화면이 들어 있는 단계를 찾아 등록해 둔다 → lesson.js가 그 단계를 떠나기 직전에 불러 준다(app.js 무변경). */
      if (AC) {
        var section = null;
        try {
          section = root.closest ? root.closest("[data-stage]") : null;
        } catch (e) {
          section = null;
        }
        if (section) AC.register(section.getAttribute("data-stage"), checkPass);
      }

      return {
        checkPass: checkPass,
        values: function () {
          var out = {};
          cfg.questions.forEach(function (q) {
            out[q.id] = (values[q.id] || "").trim();
          });
          return out;
        },
        isDone: function () {
          return cfg.questions.every(function (q) {
            return (values[q.id] || "").trim().length >= minLength;
          });
        },
        minLength: minLength,
        hintsOpened: function () {
          return opened;
        },
        /* 질문-답 표준 목록(detail.qa, docs/admin/responses-spec.md §3.3). stage: 이 화면의 단계 id(기본 "predict") */
        qa: function (stage) {
          return cfg.questions.map(function (q, i) {
            var item = {
              stage: stage || "predict",
              id: q.id,
              label: cfg.questions.length > 1 ? "질문 " + (i + 1) : "예상",
              question: q.text,
              kind: "text",
              answer: (values[q.id] || "").trim(),
            };
            /* 되짚기·차단 기록(값이 있을 때만 덧붙인다 — 기존 항목 모양은 그대로) */
            if (AC) {
              var extra = AC.qaFields(keyOf(q));
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
