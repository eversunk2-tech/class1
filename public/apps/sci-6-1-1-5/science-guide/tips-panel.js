/*
 * science-guide/tips-panel.js — 조사 팁 카드 목록 (정본: scripts/templates/science-guide/)
 * 검색어 예시(누르면 복사), 참고 누리집(새 탭, 지도서에 나온 곳만), 참고 도서, 그 밖의 안내(출처 확인·인터넷 윤리·기기 안전 등).
 * 검색어는 **복사만** 한다(외부 검색 사이트로 자동 이동하지 않는다 — 학생이 수업과 관계없는 결과를 만나지 않게).
 *
 *   var tips = SciSim.TipsPanel.render(el, {
 *     title: "🔎 조사 팁",                                        // 선택
 *     keywords: ["산성 용액의 이용", "염기성 용액의 이용"],          // 선택: 검색어 칩
 *     keywordNote: "누르면 검색어가 복사돼요. …",                   // 선택
 *     sources: [{ label: "에듀넷", url: "https://www.edunet.net", note: "'산 염기 이용'으로 검색" }],   // 선택: 지도서에 나온 누리집만
 *     sourceNote: "선생님과 함께 확인하며 열어요.",                   // 선택: 누리집 목록 아래 안내
 *     book: "김희정, 『…』, 아르볼, 2018",                          // 선택: 참고 도서(문자열 또는 배열)
 *     items: [{ icon: "✅", title: "출처 확인", text: "…" }, …],   // 선택: 그 밖의 팁 카드(**굵게** 가능)
 *     source: "지도서 148~149쪽",                                  // 선택: 카드 아래 근거
 *   }, { toast: lesson.toast });                                   // 선택: 복사 알림을 띄울 함수
 *   tips.copied()   → 이번 화면에서 복사한 검색어 목록
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  function copyText(text) {
    // navigator.clipboard(보안 출처에서만) → 안 되면 숨긴 textarea로 execCommand
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    var ok = false;
    try {
      ta.select();
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
  SciSim.copyText = copyText;

  SciSim.TipsPanel = {
    render: function (root, cfg, options) {
      var toast = (options && options.toast) || function () {};
      var copied = [];
      root.textContent = "";
      var card = el("div", { class: "ss-card sg-tips" });
      card.appendChild(el("h3", { class: "sg-card-h", text: cfg.title || "🔎 조사 팁" }));
      var list = el("div", { class: "sg-tip-grid" });

      if (cfg.keywords && cfg.keywords.length) {
        var chips = el("div", { class: "sg-chips" });
        var status = el("p", { class: "ss-help", "aria-live": "polite" });
        cfg.keywords.forEach(function (k) {
          chips.appendChild(
            el("button", {
              type: "button",
              class: "sg-chip",
              "aria-label": "검색어 '" + k + "' 복사하기",
              onclick: function () {
                copyText(k).then(function (ok) {
                  if (ok) {
                    if (copied.indexOf(k) < 0) copied.push(k);
                    status.textContent = "📋 '" + k + "'" + SciSim.josa(k, "을", "를").slice(k.length) + " 복사했어요. 검색창에 붙여 넣어 보세요.";
                    toast("📋 검색어를 복사했어요: " + k);
                  } else {
                    status.textContent = "복사하지 못했어요. 검색창에 '" + k + "'" + SciSim.josa(k, "을", "를").slice(k.length) + " 직접 적어 보세요.";
                  }
                });
              },
            }, [el("span", { "aria-hidden": "true", text: "🔍 " }), k])
          );
        });
        list.appendChild(
          el("section", { class: "sg-tip" }, [
            el("h4", { text: "검색어 예시" }),
            chips,
            el("p", { class: "ss-help", text: cfg.keywordNote || "누르면 검색어가 복사돼요. 선생님이 알려 준 검색 사이트에 붙여 넣어 찾아보세요." }),
            status,
          ])
        );
      }

      if ((cfg.sources && cfg.sources.length) || cfg.book) {
        var sec = el("section", { class: "sg-tip" }, [el("h4", { text: "참고할 자료" })]);
        if (cfg.sources && cfg.sources.length) {
          sec.appendChild(
            el(
              "ul",
              { class: "sg-link-list" },
              cfg.sources.map(function (s) {
                return el("li", null, [
                  el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, [s.label, el("span", { class: "sg-ext", text: " ↗ (새 창)" })]),
                  s.note ? el("span", { class: "sg-link-note", text: " — " + s.note }) : null,
                ]);
              })
            )
          );
        }
        if (cfg.book) {
          var books = Array.isArray(cfg.book) ? cfg.book : [cfg.book];
          sec.appendChild(
            el(
              "ul",
              { class: "sg-link-list" },
              books.map(function (b) {
                return el("li", null, [el("span", { "aria-hidden": "true", text: "📖 " }), "참고 도서: " + b]);
              })
            )
          );
        }
        sec.appendChild(el("p", { class: "ss-help", text: cfg.sourceNote || "누리집은 선생님과 함께 확인하며 열어요." }));
        list.appendChild(sec);
      }

      (cfg.items || []).forEach(function (it) {
        list.appendChild(
          el("section", { class: "sg-tip" + (it.tone ? " sg-tip-" + it.tone : "") }, [
            el("h4", null, [it.icon ? el("span", { "aria-hidden": "true", text: it.icon + " " }) : null, it.title]),
            SciSim.rich(it.text, "p"),
          ])
        );
      });

      card.appendChild(list);
      if (cfg.source) card.appendChild(el("p", { class: "ss-help sg-source", text: "근거: " + cfg.source }));
      root.appendChild(card);

      return {
        copied: function () {
          return copied.slice();
        },
      };
    },
  };
})();
