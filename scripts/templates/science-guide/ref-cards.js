/*
 * science-guide/ref-cards.js — 조사 참고 자료 카드(접고 펼치기) (정본: scripts/templates/science-guide/)
 * 지도서 근거가 있는 "참고 자료"만 보여 준다. 카드마다 출처(지도서 쪽수 등)를 적는다.
 * 색만으로 구분하지 않는다: 무리(group)마다 이름 글자와 기호(icon)를 함께 보여 준다.
 *
 *   var cards = SciSim.RefCards.render(el, {
 *     title: "📚 조사 참고 자료",                       // 카드 머리(요약 줄)
 *     lead: "조사 방향을 잡을 때 열어 보세요.",           // 선택
 *     source: "지도서 149쪽",                           // 선택: 카드 아래 출처
 *     open: false,                                      // 처음에 펼칠지(기본 false). 펼침 상태는 저장된다.
 *     groups: [                                         // 무리별 목록 또는 글
 *       { id: "acid", label: "산성 용액", icon: "🍋", tone: "a", items: ["식초", "레몬즙"] },
 *       { id: "note", label: "알아 두기", text: "**굵게** 표시도 돼요." },
 *     ],
 *     locked: function () { return true | "잠긴 까닭(이 글이 보인다)"; },   // 선택: 조건을 채워야 열린다(예: 먼저 적은 뒤 공개)
 *   }, store, { key: "refcard-open" });                  // 마지막 인자 선택(펼침 상태 저장 키, 기본 "ref:" + 첫 무리 id)
 *   cards.refresh()   → locked 조건을 다시 확인해 잠김/열림을 바꾼다(입력이 바뀔 때마다 불러 준다)
 *
 * tone: "a" | "b" | "c" — style-guide.css의 테두리 색(--sg-tone-a/b/c). 색은 보조 표시일 뿐이고 label·icon이 주 정보다.
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  SciSim.RefCards = {
    render: function (root, cfg, store, options) {
      var groups = cfg.groups || [];
      var KEY = (options && options.key) || "ref:" + (groups[0] ? groups[0].id : "cards");
      var saved = store ? store.get(KEY, null) : null;
      var isOpen = saved == null ? !!cfg.open : !!saved;

      root.textContent = "";
      var details = el("details", { class: "ss-card sg-ref" });
      details.open = isOpen;
      var summary = el("summary", { class: "sg-ref-summary" }, [el("span", { text: cfg.title || "📚 조사 참고 자료" })]);
      var lockNote = el("p", { class: "ss-help sg-lock-note", "aria-live": "polite", hidden: true });
      var body = el("div", { class: "sg-ref-body" });
      if (cfg.lead) body.appendChild(el("p", { class: "ss-help sg-ref-lead", text: cfg.lead }));

      var grid = el("div", { class: "sg-ref-grid" });
      groups.forEach(function (g) {
        var box = el("section", { class: "sg-ref-group" + (g.tone ? " sg-tone-" + g.tone : ""), "aria-label": g.label });
        box.appendChild(el("h4", { class: "sg-ref-h" }, [g.icon ? el("span", { class: "sg-ref-icon", "aria-hidden": "true", text: g.icon }) : null, g.label]));
        if (g.items && g.items.length) {
          box.appendChild(
            el(
              "ul",
              { class: "sg-ref-list" },
              g.items.map(function (it) {
                return el("li", null, [SciSim.rich(it)]);
              })
            )
          );
        }
        if (g.text) box.appendChild(SciSim.rich(g.text, "p"));
        grid.appendChild(box);
      });
      body.appendChild(grid);
      if (cfg.source) body.appendChild(el("p", { class: "ss-help sg-source", text: "출처: " + cfg.source }));

      details.appendChild(summary);
      details.appendChild(lockNote);
      details.appendChild(body);
      root.appendChild(details);

      var locked = false;
      details.addEventListener("toggle", function () {
        if (locked) return;
        if (store) store.set(KEY, details.open);
      });
      summary.addEventListener("click", function (e) {
        if (!locked) return;
        e.preventDefault(); // 잠겨 있으면 펼치지 않는다
        lockNote.hidden = false;
      });

      function refresh() {
        var r = cfg.locked ? cfg.locked() : true;
        locked = r !== true;
        details.classList.toggle("is-locked", locked);
        summary.setAttribute("aria-disabled", locked ? "true" : "false");
        body.hidden = locked;
        if (locked) {
          lockNote.textContent = "🔒 " + (typeof r === "string" ? r : "앞의 활동을 먼저 해 주세요.");
          lockNote.hidden = false;
          details.open = true; // 잠김 안내가 보이도록(내용은 숨김)
        } else {
          lockNote.hidden = true;
          if (details.classList.contains("was-locked")) {
            details.classList.remove("was-locked");
            details.open = store ? !!store.get(KEY, cfg.open) : !!cfg.open;
          }
        }
        if (locked) details.classList.add("was-locked");
      }
      refresh();

      return {
        refresh: refresh,
        isLocked: function () {
          return locked;
        },
      };
    },
  };
})();
