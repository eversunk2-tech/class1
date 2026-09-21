/*
 * science-sim/table-chart.js — 기록 → 표 / 색상 매트릭스 / 막대·꺾은선 그래프 (정본: scripts/templates/science-sim/)
 * 차시마다 알맞은 형태를 고른다(LessonConfig.chart.type: "matrix" | "table" | "bar" | "line").
 * 색만으로 결과를 구분하지 않도록 칸에는 항상 글자를, 그래프 계열에는 서로 다른 점 모양과 범례를 함께 쓴다.
 *
 * 1) 색상 매트릭스(범주형 결과: 색 변화 등)
 *   SciSim.TableChart.renderMatrix(el, {
 *     caption: "…", rowHeader: "용액",
 *     rows: [{ id, label }], cols: [{ id, label }],
 *     cell: function (row, col) { return { text: "붉은색으로 변함", color: "#d8434f"|null, flag: "…"|null, onFlag: fn } | null; },
 *     emptyText: "아직 기록 없음",
 *   });
 *
 * 2) 수치 기록 표(회차별 측정값 + 평균)
 *   SciSim.TableChart.renderTable(el, {
 *     caption: "물체의 이동 거리와 걸린 시간",
 *     columns: [{ id: "object", label: "물체" }, { id: "time", label: "걸린 시간", unit: "초", digits: 1 }],
 *     rows: [{ object: "장난감 자동차", time: 2.4 }, …],
 *     footer: [{ object: "평균", time: 2.35 }],       // 선택(평균 줄 등)
 *     emptyText: "아직 기록이 없어요",
 *   });
 *
 * 3) 꺾은선그래프(수치 x축 · 여러 계열)
 *   SciSim.TableChart.renderLine(el, {
 *     caption: "시간에 따른 이동 거리",
 *     xLabel: "시간", xUnit: "초", yLabel: "이동 거리", yUnit: "m",
 *     series: [{ name: "장난감 자동차", points: [{ x: 0, y: 0 }, { x: 1, y: 0.8 }] }, …],
 *     xMin: 0, yMin: 0,            // 선택(기본 0). xMax/yMax를 주지 않으면 자료에 맞춰 눈금을 정한다.
 *     showValues: false,           // 점 옆에 값 쓰기
 *   });
 *   예전 형식 { data: [{ label, value }] }(범주형 x축, 계열 하나)도 그대로 쓸 수 있다.
 *
 * 4) 막대그래프(범주 × 여러 계열)
 *   SciSim.TableChart.renderBar(el, {
 *     caption: "물체별 평균 속력", xLabel: "물체", yLabel: "속력", yUnit: "m/s",
 *     categories: ["장난감 자동차", "공"],
 *     series: [{ name: "1회", values: [0.4, 0.3] }, { name: "평균", values: [0.42, 0.31] }],
 *     digits: 2,
 *   });
 *   예전 형식 { data: [{ label, value }], unit }도 그대로 쓸 수 있다.
 *
 *   축 제목은 "이동 거리(m)"처럼 이름과 단위를 함께 쓴다. 값이 없는 칸(null)은 그리지 않는다.
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;
  var SVGNS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }

  // 배경색에 맞춰 읽기 쉬운 글자색(검정/흰색) 고르기
  function textOn(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length !== 6) return "";
    var r = parseInt(h.slice(0, 2), 16) / 255;
    var g = parseInt(h.slice(2, 4), 16) / 255;
    var b = parseInt(h.slice(4, 6), 16) / 255;
    var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.55 ? "#1a1a1a" : "#ffffff";
  }

  function fmt(v, digits) {
    if (v == null || v === "") return "";
    if (typeof v !== "number") return String(v);
    if (digits == null) return String(Math.round(v * 1000) / 1000);
    return v.toFixed(digits);
  }
  function axisTitle(label, unit) {
    return (label || "") + (unit ? "(" + unit + ")" : "");
  }

  // 보기 좋은 눈금(1, 2, 5 × 10ⁿ)
  function niceTicks(min, max, count) {
    if (!(max > min)) max = min + 1;
    var span = max - min;
    var step0 = span / (count || 5);
    var mag = Math.pow(10, Math.floor(Math.log10(step0)));
    var norm = step0 / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    var lo = Math.floor(min / step + 1e-9) * step;
    var hi = Math.ceil(max / step - 1e-9) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { min: lo, max: hi, step: step, ticks: ticks };
  }
  function tickText(v, step) {
    var d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
    return v.toFixed(d);
  }

  var MARKERS = ["circle", "square", "triangle", "diamond"];
  function marker(kind, x, y, cls) {
    var r = 5.5;
    if (kind === "square") return svg("rect", { x: x - r, y: y - r, width: r * 2, height: r * 2, class: cls });
    if (kind === "triangle") return svg("polygon", { points: [x, y - r - 1, x + r + 1, y + r, x - r - 1, y + r].join(" "), class: cls });
    if (kind === "diamond") return svg("polygon", { points: [x, y - r - 1, x + r + 1, y, x, y + r + 1, x - r - 1, y].join(" "), class: cls });
    return svg("circle", { cx: x, cy: y, r: r, class: cls });
  }

  function legend(series, kind) {
    if (series.length < 2) return null;
    var box = el("ul", { class: "ss-legend" });
    series.forEach(function (s, i) {
      var sw = svg("svg", { viewBox: "0 0 28 14", width: 28, height: 14, "aria-hidden": "true" });
      var cls = "ss-s" + ((i % 4) + 1);
      if (kind === "line") {
        sw.appendChild(svg("line", { x1: 2, x2: 26, y1: 7, y2: 7, class: "ss-line " + cls }));
        sw.appendChild(marker(MARKERS[i % 4], 14, 7, "ss-dot " + cls));
      } else sw.appendChild(svg("rect", { x: 6, y: 1, width: 16, height: 12, rx: 2, class: "ss-bar " + cls + " ss-pat" + ((i % 4) + 1) }));
      box.appendChild(el("li", null, [sw, el("span", { text: s.name })]));
    });
    return box;
  }

  function renderMatrix(root, o) {
    root.textContent = "";
    var table = el("table", { class: "ss-matrix" });
    if (o.caption) table.appendChild(el("caption", { text: o.caption }));
    var head = el("tr", null, [el("th", { scope: "col", text: o.rowHeader || "" })]);
    o.cols.forEach(function (c) {
      head.appendChild(el("th", { scope: "col", text: c.label }));
    });
    table.appendChild(el("thead", null, [head]));
    var body = el("tbody");
    o.rows.forEach(function (r) {
      var tr = el("tr", null, [el("th", { scope: "row", text: r.label })]);
      o.cols.forEach(function (c) {
        var v = o.cell(r, c);
        var td = el("td");
        if (!v) {
          td.className = "is-empty";
          td.appendChild(el("span", { class: "ss-cell-text", text: o.emptyText || "—" }));
        } else {
          var parts = [];
          if (v.color) {
            var chip = el("span", { class: "ss-chip", "aria-hidden": "true" });
            chip.style.background = v.color;
            parts.push(chip);
          }
          parts.push(el("span", { class: "ss-cell-text", text: v.text }));
          td.appendChild(el("div", { class: "ss-cell" }, parts));
          if (v.flag) {
            td.classList.add("is-flagged");
            td.appendChild(el("button", { type: "button", class: "ss-flag", onclick: v.onFlag || null }, ["🔁 " + v.flag]));
          }
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    root.appendChild(el("div", { class: "ss-table-wrap", tabindex: "0", role: "region", "aria-label": o.caption || "기록 표" }, [table]));
  }

  function renderTable(root, o) {
    root.textContent = "";
    var table = el("table", { class: "ss-matrix ss-numtable" });
    if (o.caption) table.appendChild(el("caption", { text: o.caption }));
    var head = el("tr");
    o.columns.forEach(function (c) {
      head.appendChild(el("th", { scope: "col", text: axisTitle(c.label, c.unit) }));
    });
    table.appendChild(el("thead", null, [head]));
    var body = el("tbody");
    function addRow(row, into, isFoot) {
      var tr = el("tr", { class: isFoot ? "is-foot" : null });
      o.columns.forEach(function (c, i) {
        var v = row[c.id];
        tr.appendChild(el(i === 0 ? "th" : "td", i === 0 ? { scope: "row", text: fmt(v, c.digits) } : { text: fmt(v, c.digits) || "—" }));
      });
      into.appendChild(tr);
    }
    (o.rows || []).forEach(function (r) {
      addRow(r, body);
    });
    if (!(o.rows || []).length) {
      body.appendChild(el("tr", null, [el("td", { colspan: String(o.columns.length), class: "is-empty", text: o.emptyText || "아직 기록이 없어요" })]));
    }
    table.appendChild(body);
    if (o.footer && o.footer.length) {
      var foot = el("tfoot");
      o.footer.forEach(function (r) {
        addRow(r, foot, true);
      });
      table.appendChild(foot);
    }
    root.appendChild(el("div", { class: "ss-table-wrap", tabindex: "0", role: "region", "aria-label": o.caption || "기록 표" }, [table]));
  }

  // 공통 틀: 여백·축·눈금을 그린 SVG와 좌표 변환 함수
  function frame(o, xs, ys) {
    var W = 600,
      H = 340,
      L = 64,
      R = 18,
      T = 18,
      B = 62;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "ss-chart", role: "img", "aria-label": o.caption || "그래프" });
    var iw = W - L - R,
      ih = H - T - B;
    var yMin = o.yMin != null ? o.yMin : Math.min(0, Math.min.apply(null, ys.concat([0])));
    var yMaxRaw = o.yMax != null ? o.yMax : Math.max.apply(null, ys.concat([yMin + 1e-9]));
    var yt = niceTicks(yMin, yMaxRaw === yMin ? yMin + 1 : yMaxRaw, 5);
    if (o.yMax != null) yt.max = o.yMax;
    function Y(v) {
      return T + ih - ((v - yt.min) / (yt.max - yt.min)) * ih;
    }
    yt.ticks.forEach(function (v) {
      if (v > yt.max + 1e-9) return;
      s.appendChild(svg("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "ss-grid" }));
      s.appendChild(svg("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "ss-tick" }, tickText(v, yt.step)));
    });
    var yTitle = axisTitle(o.yLabel, o.yUnit || o.unit);
    if (yTitle) s.appendChild(svg("text", { x: 16, y: T + ih / 2, "text-anchor": "middle", transform: "rotate(-90 16 " + (T + ih / 2) + ")", class: "ss-axis-label" }, yTitle));
    var xTitle = axisTitle(o.xLabel, o.xUnit);
    if (xTitle) s.appendChild(svg("text", { x: L + iw / 2, y: H - 10, "text-anchor": "middle", class: "ss-axis-label" }, xTitle));
    return { s: s, W: W, H: H, L: L, R: R, T: T, B: B, iw: iw, ih: ih, Y: Y, yt: yt };
  }
  function finish(root, o, f, kind, series) {
    f.s.appendChild(svg("line", { x1: f.L, x2: f.W - f.R, y1: f.T + f.ih, y2: f.T + f.ih, class: "ss-axis" }));
    f.s.appendChild(svg("line", { x1: f.L, x2: f.L, y1: f.T, y2: f.T + f.ih, class: "ss-axis" }));
    var kids = [f.s];
    var lg = legend(series, kind);
    if (lg) kids.push(lg);
    var fig = el("figure", { class: "ss-figure" }, kids);
    if (o.caption) fig.appendChild(el("figcaption", { text: o.caption }));
    root.appendChild(fig);
  }

  function renderLine(root, o) {
    root.textContent = "";
    // 예전 형식(범주형 x축, 계열 하나)
    if (o.data && !o.series) {
      var cats = o.data.map(function (d) {
        return d.label;
      });
      return renderCategoryLine(root, o, cats, [{ name: o.yLabel || "", values: o.data.map(function (d) { return d.value; }) }]);
    }
    var series = o.series || [];
    var xs = [],
      ys = [];
    series.forEach(function (s) {
      (s.points || []).forEach(function (p) {
        if (p.x != null && p.y != null) {
          xs.push(p.x);
          ys.push(p.y);
        }
      });
    });
    var f = frame(o, xs, ys);
    var xMin = o.xMin != null ? o.xMin : Math.min(0, Math.min.apply(null, xs.concat([0])));
    var xt = niceTicks(xMin, o.xMax != null ? o.xMax : Math.max.apply(null, xs.concat([xMin + 1])), 6);
    if (o.xMax != null) xt.max = o.xMax;
    function X(v) {
      return f.L + ((v - xt.min) / (xt.max - xt.min)) * f.iw;
    }
    xt.ticks.forEach(function (v) {
      if (v > xt.max + 1e-9) return;
      f.s.appendChild(svg("line", { x1: X(v), x2: X(v), y1: f.T + f.ih, y2: f.T + f.ih + 5, class: "ss-axis" }));
      f.s.appendChild(svg("text", { x: X(v), y: f.T + f.ih + 20, "text-anchor": "middle", class: "ss-tick" }, tickText(v, xt.step)));
    });
    series.forEach(function (s, i) {
      var cls = "ss-s" + ((i % 4) + 1);
      var pts = (s.points || [])
        .filter(function (p) {
          return p.x != null && p.y != null;
        })
        .sort(function (a, b) {
          return a.x - b.x;
        });
      if (pts.length > 1)
        f.s.appendChild(
          svg("polyline", {
            points: pts
              .map(function (p) {
                return X(p.x) + "," + f.Y(p.y);
              })
              .join(" "),
            class: "ss-line " + cls,
          })
        );
      pts.forEach(function (p) {
        var m = marker(MARKERS[i % 4], X(p.x), f.Y(p.y), "ss-dot " + cls);
        m.appendChild(svg("title", {}, (s.name ? s.name + ": " : "") + fmt(p.x, o.xDigits) + (o.xUnit || "") + ", " + fmt(p.y, o.digits) + (o.yUnit || "")));
        f.s.appendChild(m);
        if (o.showValues) f.s.appendChild(svg("text", { x: X(p.x), y: f.Y(p.y) - 10, "text-anchor": "middle", class: "ss-val" }, fmt(p.y, o.digits)));
      });
    });
    finish(root, o, f, "line", series);
  }

  function renderCategoryLine(root, o, cats, series) {
    var ys = [];
    series.forEach(function (s) {
      s.values.forEach(function (v) {
        if (v != null) ys.push(v);
      });
    });
    var f = frame(o, [], ys);
    var step = cats.length ? f.iw / cats.length : f.iw;
    cats.forEach(function (c, j) {
      f.s.appendChild(svg("text", { x: f.L + step * j + step / 2, y: f.T + f.ih + 20, "text-anchor": "middle", class: "ss-tick" }, c));
    });
    series.forEach(function (s, i) {
      var cls = "ss-s" + ((i % 4) + 1);
      var pts = [];
      s.values.forEach(function (v, j) {
        if (v == null) return;
        var x = f.L + step * j + step / 2;
        pts.push(x + "," + f.Y(v));
        f.s.appendChild(marker(MARKERS[i % 4], x, f.Y(v), "ss-dot " + cls));
        f.s.appendChild(svg("text", { x: x, y: f.Y(v) - 10, "text-anchor": "middle", class: "ss-val" }, fmt(v, o.digits) + (o.unit || "")));
      });
      if (pts.length > 1) f.s.appendChild(svg("polyline", { points: pts.join(" "), class: "ss-line " + cls }));
    });
    finish(root, o, f, "line", series.length > 1 ? series : []);
  }

  function renderBar(root, o) {
    root.textContent = "";
    var cats = o.categories;
    var series = o.series;
    if (o.data && !o.series) {
      cats = o.data.map(function (d) {
        return d.label;
      });
      series = [{ name: o.yLabel || "", values: o.data.map(function (d) { return d.value; }) }];
    }
    cats = cats || [];
    series = series || [];
    var ys = [];
    series.forEach(function (s) {
      s.values.forEach(function (v) {
        if (v != null) ys.push(v);
      });
    });
    var f = frame(o, [], ys);
    var step = cats.length ? f.iw / cats.length : f.iw;
    var groupW = step * 0.72;
    var bw = series.length ? groupW / series.length : groupW;
    cats.forEach(function (c, j) {
      var gx = f.L + step * j + (step - groupW) / 2;
      series.forEach(function (s, i) {
        var v = s.values[j];
        if (v == null) return;
        var y0 = f.Y(Math.max(f.yt.min, 0));
        var y1 = f.Y(v);
        var cls = "ss-bar ss-s" + ((i % 4) + 1) + " ss-pat" + ((i % 4) + 1);
        var r = svg("rect", { x: gx + bw * i + 1, y: Math.min(y0, y1), width: Math.max(bw - 2, 2), height: Math.abs(y0 - y1), rx: 3, class: cls });
        r.appendChild(svg("title", {}, (s.name ? s.name + " · " : "") + c + ": " + fmt(v, o.digits) + (o.yUnit || o.unit || "")));
        f.s.appendChild(r);
        f.s.appendChild(svg("text", { x: gx + bw * i + bw / 2, y: Math.min(y0, y1) - 6, "text-anchor": "middle", class: "ss-val" }, fmt(v, o.digits) + (series.length > 1 ? "" : o.unit || "")));
      });
      f.s.appendChild(svg("text", { x: f.L + step * j + step / 2, y: f.T + f.ih + 20, "text-anchor": "middle", class: "ss-tick" }, c));
    });
    finish(root, o, f, "bar", series);
  }

  SciSim.TableChart = {
    renderMatrix: renderMatrix,
    renderTable: renderTable,
    renderBar: renderBar,
    renderLine: renderLine,
    niceTicks: niceTicks,
    textOn: textOn,
  };
})();
