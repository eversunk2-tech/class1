/*
 * science-guide/share-prep.js — 발표(공유) 준비하기 (정본: scripts/templates/science-guide/)
 * 지도서의 "공유해요"(모둠 발표) 활동을 혼자 쓰는 앱에 맞게 바꾼 화면이다. 실제로 올리거나 보내는 기능은 없다.
 *   ① 내 조사 기록 요약(참고용) → ② 발표 대본 쓰기(선택: 템플릿으로 초안 만들기, 복사하기)
 *   ③ 발표 전 확인할 점(체크리스트, 선택) → ④ 다른 모둠 예시 발표 → "새롭게 알게 된 점" 적고 제출 → 모범 답안과 비교
 *   ⑤ 발표 태도 안내
 *
 *   var share = SciSim.SharePrep.render(el, {
 *     summaryTitle: "📋 내가 조사한 것",                              // 선택
 *     script: {
 *       prompt: "내가 조사한 것을 친구들에게 어떻게 소개할지 적어 보세요.",
 *       placeholder: "…", minLength: 10,
 *       template: "{topic|은|는} {cause} 때문에 생기고 …",           // 선택: '초안 만들기' 버튼(값은 options.fill()이 준다). {키|은|는}은 받침에 맞게 조사를 붙인다
 *       copy: true,                                                  // 선택: '대본 복사하기' 버튼
 *       platformNote: "선생님이 안내한 공유 플랫폼에 붙여 넣어요.",     // 선택
 *     },
 *     checklist: { title: "발표 전에 확인해요", items: ["…", "…"], required: false },   // 선택
 *     samples: { title: "다른 모둠의 발표", lead: "…", talks: [{ group: "1모둠", text: "…" }], source: "실험관찰 15쪽" },   // 선택
 *     reflect: { prompt: "이 발표를 들었다면 새롭게 알게 된 점은?", model: "…", minLength: 10, compareTip: "…" },   // 선택
 *     etiquette: "모둠원 모두가 골고루 발표하고 …",                   // 선택
 *   }, store, onChange, {
 *     key: "share",                                                   // 선택(저장 키)
 *     summary: function () { return ["레몬즙(산성): …", …]; },         // 선택: ①에 보여 줄 내 기록(단계에 들어올 때 refresh로 다시 그림)
 *     fill: function () { return { topic: "산성비", cause: "…" }; },   // 선택: template 자리 채울 값
 *     toast: lesson.toast,
 *   });
 *   share.refresh()  → 내 조사 기록 요약을 다시 그린다(onEnter에서 부른다)
 *   share.isDone() / share.status() → true | "까닭"
 *   share.values()   → { script, reflect, checked: ["확인한 항목", …] }
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  SciSim.SharePrep = {
    render: function (root, cfg, store, onChange, options) {
      options = options || {};
      var KEY = options.key || "share";
      var toast = options.toast || function () {};
      var sc = cfg.script || {};
      var MIN = sc.minLength || 10;
      var rf = cfg.reflect || null;
      var RMIN = (rf && rf.minLength) || 10;
      var cl = cfg.checklist || null;

      var state = store.get(KEY, null);
      if (!state || typeof state !== "object") state = {};
      state.script = typeof state.script === "string" ? state.script : "";
      if (!state.reflect || typeof state.reflect !== "object") state.reflect = { text: "", submitted: false };
      if (!state.checks || typeof state.checks !== "object") state.checks = {};
      var save = SciSim.debounce(function () {
        store.set(KEY, state);
      }, 250);
      function saveNow() {
        store.set(KEY, state);
      }
      function notify() {
        if (onChange) onChange();
      }

      root.textContent = "";

      /* ① 내 조사 기록 요약 */
      var summaryBox = null;
      if (options.summary) {
        summaryBox = el("div", { class: "ss-card sg-summary" });
        root.appendChild(summaryBox);
      }
      function drawSummary() {
        if (!summaryBox) return;
        summaryBox.textContent = "";
        summaryBox.appendChild(el("h3", { class: "sg-card-h", text: cfg.summaryTitle || "📋 내가 조사한 것" }));
        var lines = options.summary() || [];
        if (!lines.length) summaryBox.appendChild(el("p", { class: "ss-help", text: "아직 정리한 조사 내용이 없어요. 앞 단계에서 먼저 적어 보세요." }));
        else
          summaryBox.appendChild(
            el(
              "ul",
              { class: "sg-summary-list" },
              lines.map(function (l) {
                return el("li", { text: l });
              })
            )
          );
      }

      /* ② 발표 대본 */
      var scriptId = "sg-share-script";
      var ta = el("textarea", { id: scriptId, class: "ss-textarea", rows: "5", maxlength: String(sc.maxlength || 1000), placeholder: sc.placeholder || "예: 제가 조사한 것은 …입니다." });
      ta.value = state.script;
      var note = el("p", { class: "ss-help ss-len-note", id: scriptId + "-note", "aria-live": "polite" });
      ta.setAttribute("aria-describedby", scriptId + "-note");
      function drawNote() {
        var n = state.script.trim().length;
        note.textContent = n >= MIN ? "✔ 잘 적었어요." : MIN + "글자 이상 적어 주세요. (지금 " + n + "글자)";
        note.classList.toggle("is-ok", n >= MIN);
      }
      ta.addEventListener("input", function () {
        state.script = ta.value;
        save();
        drawNote();
        notify();
      });
      var tools = el("div", { class: "ss-row" });
      if (sc.template && options.fill) {
        tools.appendChild(
          el("button", {
            type: "button",
            class: "ss-btn",
            text: "✨ 내가 적은 조사 내용으로 초안 만들기",
            onclick: function () {
              var v = options.fill() || {};
              // {key} → 값, {key|은|는} → 값 + 받침에 맞는 조사(값이 비면 "(   )")
              var draft = sc.template.replace(/\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g, function (m, k, a, b) {
                var s = v[k] == null ? "" : String(v[k]).trim();
                if (!s) return "(   )" + (a != null ? a + "/" + b : "");
                return a != null ? SciSim.josa(s, a, b) : s;
              });
              if (state.script.trim() && !window.confirm("지금 적은 대본을 초안으로 바꿀까요? 적은 내용은 지워져요.")) return;
              state.script = draft;
              ta.value = draft;
              saveNow();
              drawNote();
              notify();
              ta.focus();
            },
          })
        );
      }
      if (sc.copy) {
        tools.appendChild(
          el("button", {
            type: "button",
            class: "ss-btn ss-btn-ghost",
            text: "📋 대본 복사하기",
            onclick: function () {
              if (!state.script.trim()) {
                toast("먼저 대본을 적어 주세요.");
                return;
              }
              (SciSim.copyText ? SciSim.copyText(state.script) : Promise.resolve(false)).then(function (ok) {
                toast(ok ? "📋 대본을 복사했어요." : "복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요.");
              });
            },
          })
        );
      }
      var scriptCard = el("div", { class: "ss-card" }, [
        el("label", { for: scriptId, class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "발표 대본" }), sc.prompt || "내가 조사한 것을 친구들에게 어떻게 소개할지 적어 보세요."]),
        ta,
        note,
        tools.childNodes.length ? tools : null,
        sc.platformNote ? el("p", { class: "ss-help", text: sc.platformNote }) : null,
      ]);
      root.appendChild(scriptCard);

      /* ③ 확인할 점 */
      if (cl && cl.items && cl.items.length) {
        var clBox = el("fieldset", { class: "ss-card sg-checklist" }, [el("legend", { class: "ss-q-label", text: cl.title || "✅ 발표 전에 확인해요" })]);
        cl.items.forEach(function (label, i) {
          var input = el("input", { type: "checkbox" });
          input.checked = !!state.checks[i];
          input.addEventListener("change", function () {
            state.checks[i] = input.checked;
            saveNow();
            notify();
          });
          clBox.appendChild(el("label", { class: "ss-option sg-check" }, [input, el("span", { text: label })]));
        });
        if (cl.note) clBox.appendChild(el("p", { class: "ss-help", text: cl.note }));
        root.appendChild(clBox);
      }

      /* ④ 다른 모둠 예시 발표 → 새롭게 알게 된 점 */
      if (cfg.samples && cfg.samples.talks && cfg.samples.talks.length) {
        var sm = cfg.samples;
        var talks = el(
          "div",
          { class: "sg-talks" },
          sm.talks.map(function (t) {
            return el("figure", { class: "sg-talk" }, [
              el("figcaption", { class: "sg-talk-who" }, [el("span", { "aria-hidden": "true", text: "🎤 " }), t.group]),
              el("blockquote", { class: "sg-talk-text", text: t.text }),
            ]);
          })
        );
        root.appendChild(
          el("div", { class: "ss-card" }, [
            el("h3", { class: "sg-card-h", text: sm.title || "👂 다른 모둠의 발표" }),
            sm.lead ? SciSim.rich(sm.lead, "p") : null,
            talks,
            sm.source ? el("p", { class: "ss-help sg-source", text: "출처: " + sm.source }) : null,
          ])
        );
      }
      var reflectDone = function () {
        return !rf || !!state.reflect.submitted;
      };
      if (rf) {
        var rid = "sg-share-reflect";
        var rta = el("textarea", { id: rid, class: "ss-textarea", rows: "4", maxlength: "1000", placeholder: rf.placeholder || "새롭게 알게 된 점을 적어 보세요." });
        rta.value = state.reflect.text || "";
        // sent: 마지막으로 제출한 글. 제출 뒤 고친 글은 다시 제출해야 비교 칸과 결과(values)에 반영된다.
        if (state.reflect.submitted && state.reflect.sent == null) state.reflect.sent = state.reflect.text || "";
        var rmsg = el("p", { class: "ss-help", "aria-live": "polite" });
        var rbtn = el("button", { type: "button", class: "ss-btn ss-btn-primary" });
        var rcmp = el("div", { class: "ss-compare", hidden: true });
        var drawR = function () {
          rcmp.textContent = "";
          if (!state.reflect.submitted) {
            rcmp.hidden = true;
            rbtn.textContent = "제출하고 예시 답 보기";
            return;
          }
          rcmp.hidden = false;
          rbtn.textContent = "고친 내용 다시 제출하기";
          rcmp.appendChild(
            el("div", { class: "ss-compare-grid" }, [
              el("div", { class: "ss-compare-mine" }, [el("h4", { text: "✏️ 내 답" }), el("p", { text: state.reflect.sent })]),
              el("div", { class: "ss-compare-model" }, [el("h4", { text: rf.modelTitle || "📘 예시 답" }), el("p", { text: rf.model })]),
            ])
          );
          rcmp.appendChild(el("p", { class: "ss-help", text: rf.compareTip || "내 답과 예시 답을 비교해 보세요. 친구의 발표에서 새로 알게 된 점이 무엇인지 잘 드러나면 좋아요." }));
        };
        rta.addEventListener("input", function () {
          state.reflect.text = rta.value;
          save();
          rmsg.textContent =
            state.reflect.submitted && rta.value.trim() !== state.reflect.sent ? "고친 내용은 '고친 내용 다시 제출하기'를 눌러야 반영돼요." : "";
        });
        rbtn.addEventListener("click", function () {
          var t = rta.value.trim();
          if (t.length < RMIN) {
            rmsg.textContent = "조금 더 자세히 적어 보세요. (" + RMIN + "글자 이상)";
            rta.focus();
            return;
          }
          state.reflect.text = t;
          state.reflect.sent = t;
          state.reflect.submitted = true;
          rmsg.textContent = "";
          saveNow();
          drawR();
          notify();
        });
        drawR();
        root.appendChild(
          el("div", { class: "ss-card ss-conclude" }, [
            el("label", { for: rid, class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "알게 된 점" }), rf.prompt]),
            rta,
            el("div", { class: "ss-row" }, [rbtn]),
            rmsg,
            rcmp,
          ])
        );
      }

      /* ⑤ 발표 태도 */
      if (cfg.etiquette) {
        root.appendChild(el("div", { class: "ss-card sg-etiquette" }, [el("h3", { class: "sg-card-h", text: "🙋 발표할 때와 들을 때" }), SciSim.rich(cfg.etiquette, "p")]));
      }

      drawSummary();
      drawNote();

      function status() {
        if (state.script.trim().length < MIN) return "발표 대본을 " + MIN + "글자 이상 적어 주세요.";
        if (cl && cl.required && cl.items.some(function (x, i) { return !state.checks[i]; })) return "발표 전에 확인할 점을 모두 확인해 주세요.";
        if (!reflectDone()) return "다른 모둠의 발표를 보고 새롭게 알게 된 점을 적어 제출해 주세요.";
        return true;
      }

      return {
        refresh: drawSummary,
        status: status,
        isDone: function () {
          return status() === true;
        },
        values: function () {
          return {
            script: state.script.trim(),
            reflect: rf ? (state.reflect.submitted ? state.reflect.sent || "" : "") : undefined,   // 제출한 글만
            checked: cl
              ? cl.items.filter(function (x, i) {
                  return !!state.checks[i];
                })
              : undefined,
          };
        },
      };
    },
  };
})();
