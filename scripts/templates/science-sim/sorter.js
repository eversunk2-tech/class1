/*
 * science-sim/sorter.js — 분류하기 활동(탭 또는 끌어다 놓기) (정본: scripts/templates/science-sim/)
 * 학생이 항목(용액·물체 등)을 무리(bin)로 직접 옮기고 '확인하기'를 누르면 맞고 틀림 피드백을 준다.
 * 태블릿 우선: ① 항목을 누른 뒤 ② 넣을 무리를 누르면 옮겨진다. 손가락/마우스로 끌어다 놓아도 된다.
 * 키보드: Tab으로 항목 → Enter/Space로 고르기 → Tab으로 무리 → Enter.
 *
 *   var sorter = SciSim.Sorter.render(el, {
 *     id: "classify",                                   // 저장 키(접두사 뒤)
 *     title: "용액 분류하기",
 *     intro: ["첫 문단(**굵게** 가능)", "둘째 문단"],      // 선택
 *     items: [{ id: "식초", label: "식초" }, …],
 *     bins: [{ id: "acid", label: "산성 용액", desc: "…" }, { id: "base", label: "염기성 용액", desc: "…" }],
 *     answer: { acid: ["식초", …], base: [ … ] },
 *     correct: "맞았을 때 피드백",
 *     wrong: "틀렸을 때 피드백(답을 직접 말하지 않는다)",
 *     hintAfter: { tries: 2, text: "두 번 넘게 틀렸을 때 더 구체적인 도움말" },   // 선택
 *   }, store, onChange);
 *   sorter.isDone()   → 확인해서 맞았는지
 *   sorter.result()   → { groups: { acid: [...], base: [...] }, correct, tries }
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    return a.slice().sort().join("|") === b.slice().sort().join("|");
  }

  SciSim.Sorter = {
    render: function (root, cfg, store, onChange) {
      var key = cfg.id || "sorter";
      var st = store.get(key, null);
      if (!st || typeof st !== "object") st = {};
      st.place = st.place || {}; // itemId → binId
      st.tries = st.tries || 0;
      var picked = null;
      var itemIds = cfg.items.map(function (i) {
        return i.id;
      });
      Object.keys(st.place).forEach(function (k) {
        if (itemIds.indexOf(k) < 0) delete st.place[k];
      });

      function save() {
        store.set(key, st);
        if (onChange) onChange();
      }

      root.textContent = "";
      var card = el("div", { class: "ss-card ss-sorter" });
      if (cfg.title) card.appendChild(el("h3", { class: "ss-sorter-title", text: cfg.title }));
      (cfg.intro || []).forEach(function (p) {
        card.appendChild(SciSim.rich(p, "p"));
      });
      card.appendChild(el("p", { class: "ss-help", text: "① 옮길 것을 누르고 ② 넣을 곳을 눌러요. 끌어다 놓아도 돼요." }));

      var tray = el("div", { class: "ss-tray", "data-bin": "", role: "group", "aria-label": "아직 나누지 않은 것" });
      var trayBtn = el("button", { type: "button", class: "ss-bin-target", text: "여기로 돌려놓기" });
      var trayBox = el("div", { class: "ss-bin ss-bin-tray", "data-bin": "" }, [el("p", { class: "ss-bin-label", text: "아직 나누지 않은 것" }), tray, trayBtn]);
      var binWrap = el("div", { class: "ss-bins" });
      var binBodies = {};
      var binBtns = {};
      var binBoxes = {};
      cfg.bins.forEach(function (b) {
        var body = el("div", { class: "ss-bin-body", role: "group", "aria-label": b.label });
        var btn = el("button", { type: "button", class: "ss-bin-target", text: "여기에 넣기" });
        btn.addEventListener("click", function () {
          moveTo(b.id);
        });
        var box = el("div", { class: "ss-bin", "data-bin": b.id }, [
          el("p", { class: "ss-bin-label", text: b.label }),
          b.desc ? SciSim.rich(b.desc, "p") : null,
          body,
          btn,
        ]);
        if (b.desc) box.children[1].className = "ss-bin-desc";
        box.addEventListener("click", function (e) {
          if (picked && !e.target.closest(".ss-chip-item") && e.target !== btn) moveTo(b.id);
        });
        binBodies[b.id] = body;
        binBtns[b.id] = btn;
        binBoxes[b.id] = box;
        binWrap.appendChild(box);
      });
      trayBtn.addEventListener("click", function () {
        moveTo("");
      });
      trayBox.addEventListener("click", function (e) {
        if (picked && !e.target.closest(".ss-chip-item") && e.target !== trayBtn) moveTo("");
      });

      var checkBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary", text: "확인하기" });
      var resetBtn = el("button", { type: "button", class: "ss-btn ss-btn-ghost", text: "처음처럼 되돌리기" });
      var feedback = el("p", { class: "ss-feedback", "aria-live": "polite" });
      var status = el("p", { class: "ss-help", "aria-live": "polite" });
      card.appendChild(trayBox);
      card.appendChild(binWrap);
      card.appendChild(el("div", { class: "ss-row" }, [checkBtn, resetBtn]));
      card.appendChild(status);
      card.appendChild(feedback);
      root.appendChild(card);

      var chips = {};
      cfg.items.forEach(function (it) {
        var c = el("button", { type: "button", class: "ss-chip-item", "aria-pressed": "false", "data-item": it.id, text: it.label });
        c.addEventListener("click", function (e) {
          e.stopPropagation();
          if (c.dataset.dragged === "1") {
            c.dataset.dragged = "";
            return;
          }
          picked = picked === it.id ? null : it.id;
          draw();
        });
        enableDrag(c, it.id);
        chips[it.id] = c;
      });

      function moveTo(binId) {
        if (!picked) return;
        if (binId) st.place[picked] = binId;
        else delete st.place[picked];
        var moved = picked;
        picked = null;
        st.checked = false;
        save();
        draw();
        try {
          chips[moved].focus({ preventScroll: true });
        } catch (e) {
          /* 무시 */
        }
      }

      // 끌어다 놓기(포인터 이벤트: 손가락·마우스·펜 모두). 누른 뒤의 움직임은 문서 전체에서 받는다.
      function enableDrag(chip, id) {
        var start = null;
        var ghost = null;
        function onMove(e) {
          if (!start || e.pointerId !== start.pid) return;
          if (!ghost) {
            if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
            ghost = chip.cloneNode(true);
            ghost.classList.add("ss-ghost");
            document.body.appendChild(ghost);
            picked = id;
            draw();
          }
          ghost.style.left = e.clientX + "px";
          ghost.style.top = e.clientY + "px";
          markOver(e.clientX, e.clientY);
          if (e.cancelable) e.preventDefault();
        }
        function cleanup() {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onCancel);
          if (ghost) ghost.remove();
          ghost = null;
          start = null;
          markOver(-1, -1);
        }
        function onUp(e) {
          if (!start || e.pointerId !== start.pid) return;
          var wasDrag = !!ghost;
          cleanup();
          if (!wasDrag) return;
          chip.dataset.dragged = "1"; // 뒤따르는 click을 무시
          setTimeout(function () {
            chip.dataset.dragged = "";
          }, 0);
          var target = binAt(e.clientX, e.clientY);
          if (target !== null) moveTo(target);
          else {
            picked = null;
            draw();
          }
        }
        function onCancel() {
          cleanup();
        }
        chip.addEventListener("pointerdown", function (e) {
          if (e.button != null && e.button !== 0) return;
          cleanup();
          start = { x: e.clientX, y: e.clientY, pid: e.pointerId };
          document.addEventListener("pointermove", onMove, { passive: false });
          document.addEventListener("pointerup", onUp);
          document.addEventListener("pointercancel", onCancel);
        });
      }
      function binAt(x, y) {
        if (x < 0) return null;
        var n = document.elementFromPoint(x, y);
        var b = n && n.closest ? n.closest("[data-bin]") : null;
        return b && card.contains(b) ? b.getAttribute("data-bin") : null;
      }
      function markOver(x, y) {
        var over = binAt(x, y);
        Object.keys(binBoxes).forEach(function (id) {
          binBoxes[id].classList.toggle("is-over", over === id);
        });
        trayBox.classList.toggle("is-over", over === "");
      }

      function draw() {
        tray.textContent = "";
        Object.keys(binBodies).forEach(function (b) {
          binBodies[b].textContent = "";
        });
        cfg.items.forEach(function (it) {
          var c = chips[it.id];
          c.setAttribute("aria-pressed", String(picked === it.id));
          var where = st.place[it.id];
          (where && binBodies[where] ? binBodies[where] : tray).appendChild(c);
          var binLabel = where ? cfg.bins.filter(function (b) { return b.id === where; })[0] : null;
          c.setAttribute("aria-label", it.label + (binLabel ? ", " + binLabel.label + "에 있음" : ", 아직 나누지 않음"));
        });
        var n = Object.keys(st.place).length;
        tray.parentNode.classList.toggle("is-empty", n === cfg.items.length);
        card.classList.toggle("is-picking", !!picked);
        Object.keys(binBtns).forEach(function (b) {
          binBtns[b].hidden = !picked || st.place[picked] === b;
        });
        trayBtn.hidden = !picked || !st.place[picked];
        status.textContent = picked
          ? "‘" + cfg.items.filter(function (i) { return i.id === picked; })[0].label + "’ " + "넣을 곳을 눌러요."
          : n < cfg.items.length
          ? "아직 " + (cfg.items.length - n) + "개를 나누지 않았어요."
          : "모두 나누었어요. ‘확인하기’를 눌러 보세요.";
        checkBtn.disabled = n < cfg.items.length;
        card.classList.toggle("is-correct", !!(st.checked && st.correct));
        card.classList.toggle("is-wrong", !!(st.checked && !st.correct));
        if (!st.checked) {
          feedback.textContent = "";
          feedback.className = "ss-feedback";
        } else {
          feedback.className = "ss-feedback " + (st.correct ? "is-correct" : "is-wrong");
          var extra = !st.correct && cfg.hintAfter && st.tries >= cfg.hintAfter.tries ? " " + cfg.hintAfter.text : "";
          feedback.textContent = st.correct ? "⭕ 맞았어요! " + cfg.correct : "❌ 다시 생각해 볼까요? " + cfg.wrong + extra;
        }
      }

      checkBtn.addEventListener("click", function () {
        if (Object.keys(st.place).length < cfg.items.length) return;
        st.tries += 1;
        st.checked = true;
        st.correct = cfg.bins.every(function (b) {
          var mine = itemIds.filter(function (id) {
            return st.place[id] === b.id;
          });
          return sameSet(mine, cfg.answer[b.id] || []);
        });
        picked = null;
        save();
        draw();
      });
      resetBtn.addEventListener("click", function () {
        st.place = {};
        st.checked = false;
        picked = null;
        save();
        draw();
      });
      draw();

      return {
        isDone: function () {
          return !!(st.checked && st.correct);
        },
        isChecked: function () {
          return !!st.checked;
        },
        result: function () {
          var groups = {};
          cfg.bins.forEach(function (b) {
            groups[b.id] = itemIds.filter(function (id) {
              return st.place[id] === b.id;
            });
          });
          return { groups: groups, correct: !!(st.checked && st.correct), tries: st.tries || 0 };
        },
      };
    },
  };
})();
