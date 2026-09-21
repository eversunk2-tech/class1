/*
 * science-guide/curiosity.js — "더 탐구하고 싶은 점(또는 궁금한 점)" (정본: scripts/templates/science-guide/, science-sim에서 복사)
 *
 *   var cur = SciSim.Curiosity.render(el, { prompt: "…", placeholder: "…", examples: ["…"], minLength: 5 }, store, onChange);
 *   cur.value() / cur.isDone()
 *   저장 키: "curiosity"
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  SciSim.Curiosity = {
    render: function (root, cfg, store, onChange) {
      var text = store.get("curiosity", "") || "";
      var save = SciSim.debounce(function () {
        store.set("curiosity", text);
      }, 250);
      root.textContent = "";
      var ta = el("textarea", {
        id: "ss-curiosity",
        class: "ss-textarea",
        rows: "5",
        maxlength: "1000",
        placeholder: cfg.placeholder || "실험을 하며 더 알고 싶어진 점이나 궁금한 점을 적어 보세요.",
      });
      ta.value = text;
      ta.addEventListener("input", function () {
        text = ta.value;
        save();
        if (onChange) onChange();
      });
      var card = el("div", { class: "ss-card" }, [
        el("label", { for: "ss-curiosity", class: "ss-q-label" }, [el("span", { class: "ss-q-num", text: "궁금한 점" }), cfg.prompt || "더 탐구하고 싶은 점(또는 궁금한 점)을 적어 보세요."]),
        ta,
      ]);
      if (cfg.examples && cfg.examples.length) {
        card.appendChild(el("p", { class: "ss-help", text: "이런 식으로 적어도 좋아요: " + cfg.examples.join(" / ") }));
      }
      root.appendChild(card);
      return {
        value: function () {
          return text.trim();
        },
        isDone: function () {
          return text.trim().length >= (cfg.minLength || 2);
        },
      };
    },
  };
})();
