/*
 * science-guide/topic-picker.js — 조사 주제 고르기(하나만) (정본: scripts/templates/science-guide/)
 * 주제에 따라 참고 자료·검색어·정리 틀이 달라지는 조사 차시에서 쓴다(예: 산성비 / 해양 산성화 / 토양 산성화).
 * 이미 고른 주제를 바꾸면 confirmChange 문구로 한 번 묻고, onChange(새 id, 이전 id)를 부른다
 * (앱은 여기서 주제에 딸린 입력을 지울지 정한다).
 *
 *   var topic = SciSim.TopicPicker.render(el, {
 *     title: "조사할 주제를 하나 골라요",
 *     choices: [{ id: "rain", label: "산성비", icon: "🌧", desc: "…" }, …],
 *     confirmChange: "주제를 바꾸면 조사하기에 적은 내용이 지워져요. 바꿀까요?",   // 선택
 *     locked: function () { return true | "잠긴 까닭"; },                          // 선택
 *   }, store, function (id, prev) { … }, { key: "topic" });
 *   topic.value() → 고른 id 또는 ""     topic.isDone()     topic.refresh()   (locked 조건 다시 보기)
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;
  var uid = 0;

  SciSim.TopicPicker = {
    render: function (root, cfg, store, onChange, options) {
      var KEY = (options && options.key) || "topic";
      var cur = store.get(KEY, "") || "";
      var name = "sg-topic-" + ++uid;
      root.textContent = "";
      var fs = el("fieldset", { class: "ss-card sg-topic" }, [el("legend", { class: "ss-q-label", text: cfg.title || "조사할 주제를 하나 골라요" })]);
      var lockNote = el("p", { class: "ss-help sg-lock-note", hidden: true });
      var grid = el("div", { class: "sg-topic-grid" });
      var inputs = [];
      cfg.choices.forEach(function (c) {
        var input = el("input", { type: "radio", name: name, value: c.id });
        input.checked = cur === c.id;
        input.addEventListener("change", function () {
          if (!input.checked || c.id === cur) return;
          if (cur && cfg.confirmChange && !window.confirm(cfg.confirmChange)) {
            inputs.forEach(function (i) {
              i.checked = i.value === cur;
            });
            return;
          }
          var prev = cur;
          cur = c.id;
          store.set(KEY, cur);
          if (onChange) onChange(cur, prev);
        });
        inputs.push(input);
        grid.appendChild(
          el("label", { class: "ss-option sg-topic-opt" }, [
            input,
            el("span", { class: "sg-topic-text" }, [
              el("strong", null, [c.icon ? el("span", { "aria-hidden": "true", text: c.icon + " " }) : null, c.label]),
              c.desc ? el("span", { class: "ss-help", text: c.desc }) : null,
            ]),
          ])
        );
      });
      fs.appendChild(lockNote);
      fs.appendChild(grid);
      root.appendChild(fs);

      function refresh() {
        var r = cfg.locked ? cfg.locked() : true;
        var locked = r !== true;
        inputs.forEach(function (i) {
          i.disabled = locked;
        });
        fs.classList.toggle("is-locked", locked);
        lockNote.hidden = !locked;
        lockNote.textContent = locked ? "🔒 " + (typeof r === "string" ? r : "앞의 활동을 먼저 해 주세요.") : "";
      }
      refresh();

      return {
        value: function () {
          return cur;
        },
        label: function () {
          var c = cfg.choices.filter(function (x) {
            return x.id === cur;
          })[0];
          return c ? c.label : "";
        },
        isDone: function () {
          return !!cur;
        },
        refresh: refresh,
      };
    },
  };
})();
