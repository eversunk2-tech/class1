/*
 * science-guide/worksheet.js — 조사 결과 정리 틀(줄 더하기/지우기) + "지도서 예시와 비교해 보기" (정본: scripts/templates/science-guide/)
 * 칸(fields)은 config로 정한다. 차시마다 다른 정리 틀(용액/성질/이용하는 예, 원인/피해/대책/출처 …)을 같은 코드로 만든다.
 * 미리 채운 답은 없다. 학생이 직접 조사해 적은 뒤에만 지도서 예시(compare)가 열린다(답 먼저 보기 방지).
 * 학생이 적은 내용은 채점하지 않는다(자유 기록). 비교 표는 "내 기록에도 있는지"만 보여 준다.
 *
 *   var ws = SciSim.Worksheet.render(el, {
 *     title: "📝 조사 결과 정리하기",                            // 선택
 *     lead: "조사한 것을 한 줄에 하나씩 적어요.",                  // 선택
 *     rowLabel: "조사",                                          // 줄 이름 → "조사 1", "조사 2" …
 *     fields: [
 *       { id: "name", label: "용액 이름", type: "text", placeholder: "예: ○○", maxlength: 40 },
 *       { id: "property", label: "성질", type: "choice", options: ["산성", "염기성"] },   // 글자 버튼(색만으로 구분하지 않음)
 *       { id: "use", label: "이용하는 예", type: "textarea", placeholder: "…", maxlength: 200 },
 *     ],
 *     minRows: 3,                // 이만큼 '다 채운 줄'이 있어야 isDone
 *     maxRows: 10,               // 더 이상 줄을 더할 수 없음(저장 크기 제한)
 *     startRows: 3,              // 처음 보이는 빈 줄 수(기본 minRows)
 *     fixed: false,              // true면 줄 더하기/지우기 없이 startRows 줄만(예: 원인/피해/대책 한 벌만 적는 틀)
 *     incompleteText: "…",       // 선택(fixed일 때): 덜 채웠을 때 안내
 *     (fields의 칸마다 optional: true면 비워도 된다, minLength: n이면 n글자 이상이어야 채운 것으로 본다, hint: 칸 아래 도움말)
 *     requireEach: [{ field: "property", value: "산성", message: "산성 용액을 한 가지 이상 적어 주세요." }],   // 선택
 *     compare: {                 // 선택: 다 적은 뒤 열리는 지도서 예시
 *       buttonLabel: "📘 지도서 속 예시와 비교해 보기",
 *       title: "지도서 속 예시", lead: "…", source: "지도서 149~150쪽",
 *       columns: [{ id: "name", label: "용액" }, { id: "property", label: "성질" }, { id: "use", label: "이용하는 예" }],
 *       rows: [{ name: "…", property: "…", use: "…" }],
 *       matchField: "name",      // 선택: 이 칸 글자가 서로 포함되면 "내 기록에도 있어요"로 표시(띄어쓰기 무시)
 *       mineField: "property",   // 선택: 같은 줄에 "내가 고른 ○○"를 함께 보여 줄 칸. 지도서 값과 다르면 ✔ 대신 "⚠ ○○이 달라요"
 *       diffText: "…",           // 선택: mineField가 다를 때 덧붙일 안내(기본 "지도서 예시와 다시 비교해 보세요.")
 *     },
 *     doneText: "✔ …",           // 선택(fixed일 때): 칸을 모두 채웠을 때 문구(기본 "✔ 정리 틀의 칸을 모두 채웠어요.")
 *   }, store, onChange, { key: "worksheet" });                  // 마지막 인자 선택(저장 키, 기본 "worksheet")
 *   ws.isDone()      → true | false
 *   ws.status()      → true | "아직 못 넘어가는 까닭"(단계 이동 안내에 그대로 쓴다)
 *   ws.rows()        → 다 채운 줄만 [{ name, property, use }, …]
 *   ws.allRows()     → 한 칸이라도 적은 줄 모두
 *   ws.compareOpened() → 비교를 열어 봤는지
 *   ws.mismatches()  → 지도서 예시와 이름은 같은데 mineField가 다른 줄 [{ name, mine, guide }]
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;
  var uid = 0;

  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  // 이름이 같은지(띄어쓰기 무시). 한쪽이 다른 쪽을 품으면 같다고 보되, "용액"·"세제"처럼 뜻이 넓은 말만 적은 경우는 뺀다.
  var GENERIC = ["용액", "세제", "물", "액"];
  function sameName(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    var s = a.length < b.length ? a : b;
    var l = a.length < b.length ? b : a;
    return s.length >= 2 && GENERIC.indexOf(s) < 0 && l.indexOf(s) >= 0;
  }

  SciSim.Worksheet = {
    render: function (root, cfg, store, onChange, options) {
      var KEY = (options && options.key) || "worksheet";
      var fields = cfg.fields || [];
      var minRows = cfg.minRows == null ? 1 : cfg.minRows;
      var maxRows = cfg.fixed ? cfg.startRows || minRows || 1 : cfg.maxRows || 10;
      var startRows = Math.min(maxRows, Math.max(1, cfg.startRows || minRows || 1));
      var rowLabel = cfg.rowLabel || "조사";
      var prefix = "sg-ws-" + ++uid;

      var state = store.get(KEY, null);
      if (!state || typeof state !== "object" || !Array.isArray(state.rows)) state = { rows: [], compareOpen: false, compareSeen: false };
      state.rows = state.rows.filter(function (r) {
        return r && typeof r === "object";
      }).slice(0, maxRows);
      while (state.rows.length < startRows) state.rows.push({});
      var save = SciSim.debounce(function () {
        store.set(KEY, state);
      }, 250);
      function saveNow() {
        store.set(KEY, state);
      }

      function val(r, f) {
        return String(r[f.id] == null ? "" : r[f.id]).trim();
      }
      function isFilled(r) {
        return fields.every(function (f) {
          return f.optional || val(r, f).length >= (f.minLength || 1);
        });
      }
      function isEmpty(r) {
        return fields.every(function (f) {
          return !val(r, f);
        });
      }
      function filledRows() {
        return state.rows.filter(isFilled);
      }
      function status() {
        var filled = filledRows();
        if (filled.length < minRows) {
          if (cfg.fixed) return cfg.incompleteText || "정리 틀의 칸을 모두 채워 주세요.";
          return (
            "조사한 내용을 " + minRows + "줄 이상 모두 채워 주세요. (지금 다 채운 줄 " + filled.length + "개" +
            (state.rows.some(function (r) {
              return !isFilled(r) && !isEmpty(r);
            })
              ? ", 빈 칸이 있는 줄은 세지 않아요"
              : "") +
            ")"
          );
        }
        var need = (cfg.requireEach || []).filter(function (q) {
          return !filled.some(function (r) {
            return String(r[q.field]) === q.value;
          });
        });
        if (need.length) return need[0].message;
        return true;
      }

      root.textContent = "";
      var card = el("div", { class: "ss-card sg-ws" });
      if (cfg.title) card.appendChild(el("h3", { class: "sg-card-h", text: cfg.title }));
      if (cfg.lead) {
        var leadEl = SciSim.rich(cfg.lead, "p");
        leadEl.className = "ss-help sg-ws-lead";
        card.appendChild(leadEl);
      }
      var rowsBox = el("div", { class: "sg-ws-rows" });
      card.appendChild(rowsBox);
      var addBtn = cfg.fixed ? null : el("button", { type: "button", class: "ss-btn", text: "＋ 줄 더하기" });
      var statusEl = el("p", { class: "ss-help sg-ws-status", "aria-live": "polite" });
      if (addBtn) card.appendChild(el("div", { class: "ss-row" }, [addBtn]));
      card.appendChild(statusEl);
      root.appendChild(card);

      var compareCard = null;
      var compareBtn = null;
      var compareBody = null;
      if (cfg.compare) {
        compareBtn = el("button", { type: "button", class: "ss-btn ss-btn-primary", "aria-expanded": "false" });
        compareBody = el("div", { class: "sg-compare-body", hidden: true });
        compareCard = el("div", { class: "ss-card sg-ws-compare" }, [el("div", { class: "ss-row" }, [compareBtn]), compareBody]);
        root.appendChild(compareCard);
        compareBtn.addEventListener("click", function () {
          if (status() !== true) return;
          state.compareOpen = !state.compareOpen;
          if (state.compareOpen) state.compareSeen = true;
          saveNow();
          drawCompare();
          if (onChange) onChange();
        });
      }

      function changed() {
        save();
        drawStatus();
        if (onChange) onChange();
      }

      function drawRows() {
        rowsBox.textContent = "";
        state.rows.forEach(function (r, ri) {
          var fs = el("fieldset", { class: "sg-ws-row" + (cfg.fixed && state.rows.length === 1 ? " is-single" : "") });
          var legendKids = [el("span", { class: "ss-q-num", text: rowLabel + " " + (ri + 1) })];
          fs.appendChild(el("legend", { class: "sg-ws-legend" }, legendKids));
          var grid = el("div", { class: "sg-ws-grid" });
          fields.forEach(function (f) {
            var id = prefix + "-" + ri + "-" + f.id;
            var wrap;
            if (f.type === "choice") {
              var group = el("div", { class: "sg-seg", role: "radiogroup", "aria-labelledby": id + "-l" });
              (f.options || []).forEach(function (opt) {
                var input = el("input", { type: "radio", name: id, value: opt, class: "sg-seg-input", id: id + "-" + opt });
                input.checked = r[f.id] === opt;
                input.addEventListener("change", function () {
                  if (input.checked) {
                    r[f.id] = opt;
                    changed();
                  }
                });
                group.appendChild(el("label", { class: "sg-seg-opt", for: id + "-" + opt }, [input, el("span", { text: opt })]));
              });
              wrap = el("div", { class: "sg-ws-field sg-ws-choice" }, [el("span", { class: "sg-ws-label", id: id + "-l", text: f.label }), group]);
            } else {
              var isArea = f.type === "textarea";
              var input2 = el(isArea ? "textarea" : "input", {
                id: id,
                class: isArea ? "ss-textarea sg-ws-area" : "sg-ws-input",
                type: isArea ? null : "text",
                rows: isArea ? String(f.rows || 2) : null,
                maxlength: String(f.maxlength || (isArea ? 300 : 60)),
                placeholder: f.placeholder || "",
                autocomplete: "off",
              });
              input2.value = r[f.id] || "";
              input2.addEventListener("input", function () {
                r[f.id] = input2.value;
                changed();
              });
              wrap = el("div", { class: "sg-ws-field" + (isArea ? " is-wide" : "") }, [el("label", { class: "sg-ws-label", for: id, text: f.label }), input2]);
              if (f.hint) wrap.appendChild(el("p", { class: "ss-help", text: f.hint }));
            }
            grid.appendChild(wrap);
          });
          fs.appendChild(grid);
          if (!cfg.fixed && state.rows.length > 1) {
            fs.appendChild(
              el("div", { class: "sg-ws-tools" }, [
                el("button", {
                  type: "button",
                  class: "ss-btn ss-btn-ghost sg-ws-del",
                  "aria-label": rowLabel + " " + (ri + 1) + " 줄 지우기",
                  text: "🗑 이 줄 지우기",
                  onclick: function () {
                    if (!isEmpty(r) && !window.confirm(rowLabel + " " + (ri + 1) + "에 적은 내용을 지울까요?")) return;
                    state.rows.splice(ri, 1);
                    if (!state.rows.length) state.rows.push({});
                    saveNow();
                    drawRows();
                    drawStatus();
                    if (onChange) onChange();
                  },
                }),
              ])
            );
          }
          rowsBox.appendChild(fs);
        });
        if (addBtn) {
          addBtn.disabled = state.rows.length >= maxRows;
          addBtn.textContent = state.rows.length >= maxRows ? "줄은 " + maxRows + "개까지 적을 수 있어요" : "＋ 줄 더하기";
        }
      }

      if (addBtn)
        addBtn.addEventListener("click", function () {
          if (state.rows.length >= maxRows) return;
          state.rows.push({});
          saveNow();
          drawRows();
          drawStatus();
          var last = rowsBox.lastElementChild && rowsBox.lastElementChild.querySelector("input, textarea");
          if (last) last.focus();
        });

      function drawStatus() {
        var s = status();
        var n = filledRows().length;
        statusEl.classList.toggle("is-ok", s === true);
        statusEl.textContent =
          s !== true
            ? s
            : cfg.fixed
            ? cfg.doneText || "✔ 정리 틀의 칸을 모두 채웠어요."
            : "✔ 다 채운 줄 " + n + "개. 더 찾은 것이 있으면 줄을 더해 적어도 좋아요.";
        if (compareBtn) drawCompare();
      }

      function drawCompare() {
        var cmp = cfg.compare;
        var ok = status() === true;
        if (!ok && state.compareOpen) state.compareOpen = false;
        compareBtn.disabled = !ok;
        compareBtn.setAttribute("aria-expanded", state.compareOpen ? "true" : "false");
        compareBtn.textContent = !ok
          ? "🔒 " + (cmp.buttonLabel || "📘 지도서 속 예시와 비교해 보기").replace(/^📘\s*/, "") + " (정리 틀을 먼저 채워요)"
          : state.compareOpen
          ? "비교 표 접기 ▴"
          : cmp.buttonLabel || "📘 지도서 속 예시와 비교해 보기";
        compareBody.hidden = !state.compareOpen;
        if (!state.compareOpen) {
          compareBody.textContent = "";
          return;
        }
        compareBody.textContent = "";
        if (cmp.title) compareBody.appendChild(el("h4", { class: "sg-card-h", text: cmp.title }));
        if (cmp.lead) compareBody.appendChild(SciSim.rich(cmp.lead, "p"));
        var mine = filledRows();
        var cols = cmp.columns.slice();
        var table = el("table", { class: "ss-matrix sg-cmp-table" });
        var hr = el("tr", null, cols.map(function (c) {
          return el("th", { scope: "col", text: c.label });
        }));
        if (cmp.matchField) hr.appendChild(el("th", { scope: "col", text: "내 기록" }));
        table.appendChild(el("thead", null, [hr]));
        var tb = el("tbody");
        var matchedMine = {};
        var mismatchCount = 0;
        cmp.rows.forEach(function (row) {
          var tr = el("tr");
          cols.forEach(function (c, ci) {
            tr.appendChild(el(ci === 0 ? "th" : "td", ci === 0 ? { scope: "row", text: row[c.id] } : { text: row[c.id] }));
          });
          if (cmp.matchField) {
            var key = norm(row[cmp.matchField]);
            var hitIdx = -1;
            mine.some(function (m, mi) {
              var k = norm(m[cmp.matchField]);
              if (sameName(k, key)) {
                hitIdx = mi;
                return true;
              }
              return false;
            });
            var cell;
            if (hitIdx >= 0) {
              matchedMine[hitIdx] = true;
              var m = mine[hitIdx];
              // 이름은 같은데 mineField(예: 성질)가 지도서와 다르면 초록 ✔를 주지 않고 다시 보도록 알린다(채점은 하지 않음).
              var differs = !!cmp.mineField && norm(m[cmp.mineField]) !== norm(row[cmp.mineField]);
              if (differs) mismatchCount++;
              var sub = cmp.mineField
                ? el("span", { class: "sg-mine-sub", text: "(내가 고른 " + (fieldLabel(cmp.mineField) || "") + ": " + (m[cmp.mineField] || "-") + ")" })
                : null;
              cell = differs
                ? el("td", { class: "sg-mine is-diff" }, [
                    el("span", { text: "⚠ " + (fieldLabel(cmp.mineField) || "") + "이 달라요" }),
                    sub,
                    el("span", { class: "sg-mine-sub", text: cmp.diffText || "지도서 예시와 다시 비교해 보세요." }),
                  ])
                : el("td", { class: "sg-mine is-hit" }, [el("span", { text: "✔ 있어요" }), sub]);
            } else cell = el("td", { class: "sg-mine", text: "—" });
            tr.appendChild(cell);
          }
          tb.appendChild(tr);
        });
        table.appendChild(tb);
        compareBody.appendChild(el("div", { class: "ss-table-wrap" }, [table]));
        if (mismatchCount) {
          compareBody.appendChild(
            el("p", { class: "ss-help sg-cmp-warn", role: "note" }, [
              "⚠ 내 기록 가운데 " + mismatchCount + "가지는 지도서 예시와 " + (fieldLabel(cmp.mineField) || "") +
                "이 달라요. 무엇이 맞는지 자료를 다시 찾아보고, 위 정리 틀에서 고쳐 보세요.",
            ])
          );
        }
        if (cmp.matchField) {
          var extra = mine.filter(function (m, i) {
            return !matchedMine[i];
          });
          compareBody.appendChild(
            el("p", { class: "ss-help" }, [
              extra.length
                ? "지도서 예시에 없는 것을 " + extra.length + "가지 더 찾았어요: " +
                  extra.map(function (m) {
                    return m[cmp.matchField];
                  }).join(", ") +
                  ". 믿을 수 있는 자료에서 찾았는지 출처를 한 번 더 확인해 보세요."
                : "내 기록이 모두 지도서 예시 안에 있어요.",
            ])
          );
        }
        compareBody.appendChild(
          el("p", { class: "ss-help", text: cmp.tip || "내 기록과 비교해 보고, 빠진 예나 고칠 곳이 있으면 위 정리 틀에서 더하거나 고쳐 보세요." })
        );
        if (cmp.source) compareBody.appendChild(el("p", { class: "ss-help sg-source", text: "출처: " + cmp.source }));
      }
      // 지도서 예시와 이름은 같은데 mineField가 다른 내 기록 [{ name, mine, guide }] (결과 저장·요약용)
      function mismatchList() {
        var cmp = cfg.compare;
        if (!cmp || !cmp.matchField || !cmp.mineField) return [];
        var mine = filledRows();
        var out = [];
        cmp.rows.forEach(function (row) {
          var key = norm(row[cmp.matchField]);
          for (var i = 0; i < mine.length; i++) {
            if (!sameName(norm(mine[i][cmp.matchField]), key)) continue;
            if (norm(mine[i][cmp.mineField]) !== norm(row[cmp.mineField]))
              out.push({ name: val(mine[i], { id: cmp.matchField }), mine: val(mine[i], { id: cmp.mineField }), guide: row[cmp.mineField] });
            break;
          }
        });
        return out;
      }
      function fieldLabel(id) {
        var f = fields.filter(function (x) {
          return x.id === id;
        })[0];
        return f ? f.label : id;
      }

      drawRows();
      drawStatus();

      return {
        isDone: function () {
          return status() === true;
        },
        status: status,
        rows: function () {
          return filledRows().map(function (r) {
            var o = {};
            fields.forEach(function (f) {
              o[f.id] = val(r, f);
            });
            return o;
          });
        },
        allRows: function () {
          return state.rows
            .filter(function (r) {
              return !isEmpty(r);
            })
            .map(function (r) {
              var o = {};
              fields.forEach(function (f) {
                o[f.id] = val(r, f);
              });
              return o;
            });
        },
        compareOpened: function () {
          return !!state.compareSeen;
        },
        mismatches: function () {
          return mismatchList();
        },
      };
    },
  };
})();
