/*
 * app.js — sci-6-1-2-2 "물체의 운동을 표현해 볼까?" 차시 전용 로직
 * 공통 틀(science-sim/)이 단계 이동·실험 패널·기록·저장을 맡고, 이 파일은
 *   ① 3D/2D 정원판 장면(분수, 꽃 4종, 꿀벌, 발자국, 처음 위치·나중 위치 표시)
 *   ② 실험 전 활동: 분수를 기준으로 꽃 세 개의 위치(방향 + 칸 수)를 학생이 직접 적고 확인(활동해요 2, 199쪽)
 *   ③ 관찰 카드: 걸린 시간과 "꿀벌은 N초 동안 A에서 B로 이동했습니다" 문장을 학생이 직접 쓰고,
 *      공통 틀의 check 훅(observe().check)으로 검증만 한다(앱이 문장을 대신 만들지 않는다, 200·205쪽)
 *   ④ 분석 표·막대그래프·퀴즈 연결  만 만든다.
 * 걸린 시간은 지도서 규칙(한 칸 = 1초, 위·아래·왼쪽·오른쪽으로만)대로 "가장 짧은 칸 수"에서만 나온다.
 * 화면에는 칸 번호(숫자쌍)나 두 위치 사이의 거리를 보여 주지 않는다(지도서 198쪽 유의점).
 */
(function () {
  "use strict";
  var C = window.LessonConfig;
  var S = window.SciSim;
  var el = S.el;
  var $ = function (id) {
    return document.getElementById(id);
  };

  var store = S.createStore(C.storageKey);
  if (!store.available) $("storage-warning").hidden = false;
  var lesson = S.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
  var toast = lesson.toast;

  /* ───────── 꽃·규칙 계산 ───────── */
  var F = {};
  C.flowers.forEach(function (f) {
    F[f.id] = f;
  });
  var FOUNTAIN = { x: 0, y: 0 };
  function pairKey(a, b) {
    return [a, b].sort().join("|");
  }
  function dirKey(a, b) {
    return a + ">" + b;
  }
  // 규칙대로 움직일 때의 칸 수 = 걸린 시간(초): 가로 칸 차 + 세로 칸 차(대각선 없음)
  function cellsBetween(a, b) {
    return Math.abs(F[a].x - F[b].x) + Math.abs(F[a].y - F[b].y);
  }
  function secondsOf(a, b) {
    return cellsBetween(a, b) * C.rule.stepSeconds;
  }
  function isObstacle(x, y, endId) {
    if (x === FOUNTAIN.x && y === FOUNTAIN.y) return true;
    return C.flowers.some(function (f) {
      return f.id !== endId && f.x === x && f.y === y;
    });
  }
  // 가장 짧은 길(가로 먼저 또는 세로 먼저). 분수·다른 꽃 칸을 지나지 않는 쪽을 고른다. 반환: 지나는 칸들(출발 칸 제외, 도착 칸 포함)
  function pathOf(a, b) {
    var s = F[a];
    var e = F[b];
    function build(hFirst) {
      var out = [];
      var x = s.x;
      var y = s.y;
      var sx = Math.sign(e.x - s.x);
      var sy = Math.sign(e.y - s.y);
      function stepX() {
        while (x !== e.x) {
          x += sx;
          out.push({ x: x, y: y });
        }
      }
      function stepY() {
        while (y !== e.y) {
          y += sy;
          out.push({ x: x, y: y });
        }
      }
      if (hFirst) {
        stepX();
        stepY();
      } else {
        stepY();
        stepX();
      }
      return out;
    }
    var cands = [build(true), build(false)];
    for (var i = 0; i < cands.length; i++) {
      var ok = cands[i].every(function (c) {
        return !isObstacle(c.x, c.y, b);
      });
      if (ok) return cands[i];
    }
    return cands[0];
  }
  function toJosa(word) {
    return S.josa(word, "으로", "로");
  }
  function sentence(a, b, sec) {
    return "꿀벌은 " + sec + "초 동안 " + F[a].name + "에서 " + toJosa(F[b].name) + " 이동했습니다.";
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function escRe(t) {
    return String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  // 꽃 이름(수선화꽃/수선화처럼 줄인 이름도 인정) 정규식 조각
  function nameRe(id) {
    var f = F[id];
    var names = [f.name];
    var shortName = f.name.replace(/꽃$/, "");
    if (shortName.length >= 2 && names.indexOf(shortName) < 0) names.push(shortName);
    return "(?:" + names.map(escRe).join("|") + ")(?:꽃)?";
  }
  // 학생이 쓴 운동 문장 검사: 걸린 시간(N초)·처음 위치(A에서)·나중 위치(B로/으로/까지)·움직임 말.
  // 반환: null(통과) 또는 고칠 점 안내. 답(초 수·꽃 이름)을 대신 알려 주지 않는다.
  function checkSentence(text, a, b, n) {
    var t = String(text || "").replace(/\s+/g, "");
    if (t.length < 8) return "꿀벌의 운동을 한 문장으로 끝까지 써 주세요.";
    var secs = (t.match(/\d+(?:\.\d+)?초/g) || []).map(function (x) {
      return Number(x.replace("초", ""));
    });
    var fromRe = new RegExp(nameRe(a) + "(?:에서|부터)");
    var toRe = new RegExp(nameRe(b) + "(?:으로|로|까지|쪽으로)");
    var swapped = new RegExp(nameRe(b) + "(?:에서|부터)").test(t) && new RegExp(nameRe(a) + "(?:으로|로|까지)").test(t);
    var miss = [];
    if (!secs.length) miss.push("걸린 시간(몇 초 동안)");
    else if (secs.indexOf(n) < 0) return "문장에 쓴 걸린 시간이 위 칸에 적은 시간과 달라요. 문장 속 시간을 다시 확인해 보세요.";
    if (swapped) return "처음 위치와 나중 위치가 서로 바뀌었어요. 꿀벌이 어느 꽃에서 출발해 어느 꽃에 도착했는지 다시 보세요.";
    if (!fromRe.test(t)) miss.push("처음 위치(어느 꽃에서)");
    if (!toRe.test(t)) miss.push("나중 위치(어느 꽃으로)");
    if (miss.length) return "문장에 " + miss.join(", ") + SciSim_josa(miss[miss.length - 1]) + " 빠졌거나 알아보기 어려워요. 위의 예처럼 고쳐 써 보세요.";
    if (!/(이동|움직|갔|간다|가요|날아|날았|왔)/.test(t)) return "꿀벌이 어떻게 했는지(예: 이동했습니다)까지 써서 문장을 끝맺어 보세요.";
    return null;
  }
  function SciSim_josa(phrase) {
    // "…(어느 꽃에서)" 처럼 괄호로 끝나면 괄호 앞 낱말로 조사를 고른다
    var w = String(phrase).replace(/\([^)]*\)$/, "");
    return S.josa(w, "이", "가").slice(w.length);
  }
  function flowerIcon(f) {
    var i = el("span", { class: "fl-icon", "aria-hidden": "true", text: f.mark });
    i.style.setProperty("--c", f.color);
    return i;
  }

  /* ───────── 기록 ───────── */
  var records = S.RecordStore(store, {
    key: "records",
    keyOf: function (r) {
      return pairKey(r.from, r.to);
    },
    onChange: function () {
      lesson.refresh();
    },
  });

  /* ───────── 1. 예상하기 / 3. 분석 / 4. 정리 / 5. 궁금한 점 ───────── */
  var predict = S.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
  var quiz = S.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
  var conclude = S.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
  var curiosity = S.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);

  // 발전 질문 2: 그림만 보고 버스의 운동을 쓴다(지도서 201쪽 평가 2 — 그림에 "처음"·"5분 뒤"만 적는다. 질문 글에 답 문장을 넣지 않는다)
  (function addBusFigure() {
    var ta = $("ss-conclude-ext2");
    if (!ta || !ta.parentNode) return;
    function scene(label, busAt) {
      var stops = ["가", "나"].map(function (nm, i) {
        return el("div", { class: "bus-stop" + (busAt === i ? " has-bus" : "") }, [
          el("span", { class: "bus-ico", "aria-hidden": "true", text: busAt === i ? "🚌" : "　" }),
          el("span", { class: "bus-ico", "aria-hidden": "true", text: "🚏" }),
          el("span", { text: nm + " 정류장" }),
        ]);
      });
      return el("div", { class: "bus-scene" }, [el("span", { class: "bus-time", text: label }), el("div", { class: "bus-road" }, [stops[0], el("span", { class: "bus-gap", "aria-hidden": "true" }), stops[1]])]);
    }
    var fig = el("figure", { class: "bus-fig", role: "img", "aria-label": "그림: 위 칸은 '처음' 모습으로 버스가 가 정류장 앞에 있고, 아래 칸은 '5분 뒤' 모습으로 버스가 나 정류장 앞에 있어요." }, [
      scene("처음", 0),
      scene("5분 뒤", 1),
    ]);
    ta.parentNode.insertBefore(fig, ta);
  })();

  /* ───────── 2. 실험하기 ───────── */
  /* ── 실험 전 활동: 분수를 기준으로 꽃의 위치 나타내기(활동해요 2, 지도서 199·204쪽) ──
   * 한 꽃(C.positionExample)만 예시로 보여 주고, 나머지 꽃은 학생이 방향과 칸 수를 골라 적은 뒤 확인한다.
   * 확인하기 전에는 그 꽃의 위치 문장을 화면 어디에도 보여 주지 않는다. */
  var positions = store.get("positions", {}) || {};
  function posKnown(id) {
    return id === C.positionExample || !!(positions[id] && positions[id].ok);
  }
  function descOf(id) {
    return posKnown(id) ? F[id].desc : "";
  }
  function positionsDone() {
    return C.flowers.every(function (f) {
      return posKnown(f.id);
    });
  }
  var posUI = { rows: {}, box: null, msg: null };
  function positionTask() {
    var box = el("div", { class: "pos-task", id: "pos-task" });
    posUI.box = box;
    box.appendChild(el("p", { class: "pos-task-h" }, [S.rich("📍 **분수를 기준으로 꽃의 위치 나타내기**", "span")]));
    box.appendChild(
      S.rich(
        "아래 정원판에서 **분수 칸**부터 꽃이 있는 칸까지 세어 보세요. 가로(왼쪽·오른쪽)와 세로(위쪽·아래쪽)로 나누어 방향과 칸 수를 적어요.",
        "p"
      )
    );
    var ul = el("ul", { class: "pos-list" });
    C.flowers.forEach(function (f) {
      if (f.id === C.positionExample) {
        ul.appendChild(el("li", { class: "pos-ex" }, [flowerIcon(f), S.rich("**" + f.name + "**: " + f.desc + " (예시)", "span")]));
        return;
      }
      var li = el("li", { class: "pos-item" });
      posUI.rows[f.id] = li;
      ul.appendChild(li);
    });
    box.appendChild(ul);
    posUI.btn = el("button", { type: "button", class: "ss-btn ss-btn-primary", text: "✔️ 꽃 위치 확인하기" });
    posUI.msg = el("p", { class: "ss-feedback", "aria-live": "polite", hidden: true });
    posUI.btn.addEventListener("click", checkPositions);
    box.appendChild(el("div", { class: "ss-row" }, [posUI.btn]));
    box.appendChild(posUI.msg);
    C.flowers.forEach(function (f) {
      if (posUI.rows[f.id]) drawPosRow(f);
    });
    drawPosDone();
    return box;
  }
  function dirSelect(id, axis, value) {
    var opts = axis === "h" ? [["", "가로 방향"], ["left", "왼쪽으로"], ["right", "오른쪽으로"], ["none", "가로로는 0칸"]] : [["", "세로 방향"], ["up", "위쪽으로"], ["down", "아래쪽으로"], ["none", "세로로는 0칸"]];
    var sel = el("select", { id: id, class: "pos-sel", "aria-label": axis === "h" ? "가로 방향" : "세로 방향" });
    opts.forEach(function (o) {
      var op = el("option", { value: o[0], text: o[1] });
      if (o[0] === (value || "")) op.selected = true;
      sel.appendChild(op);
    });
    return sel;
  }
  function drawPosRow(f) {
    var li = posUI.rows[f.id];
    li.textContent = "";
    var st = positions[f.id] || {};
    if (st.ok) {
      li.classList.add("is-ok");
      li.appendChild(el("span", { class: "pos-name" }, [flowerIcon(f), el("strong", { text: f.name })]));
      li.appendChild(el("span", { class: "pos-ok", text: "✔ " + f.desc }));
      return;
    }
    var a = st.answer || {};
    var hs = dirSelect("pos-" + f.id + "-h", "h", a.h);
    var hn = el("input", { type: "number", inputmode: "numeric", min: "0", max: "9", step: "1", class: "pos-num", "aria-label": f.name + " 가로 칸 수" });
    var vs = dirSelect("pos-" + f.id + "-v", "v", a.v);
    var vn = el("input", { type: "number", inputmode: "numeric", min: "0", max: "9", step: "1", class: "pos-num", "aria-label": f.name + " 세로 칸 수" });
    if (a.hn != null) hn.value = String(a.hn);
    if (a.vn != null) vn.value = String(a.vn);
    hs.setAttribute("aria-label", f.name + " 가로 방향");
    vs.setAttribute("aria-label", f.name + " 세로 방향");
    function sync() {
      hn.disabled = hs.value === "none";
      vn.disabled = vs.value === "none";
      if (hn.disabled) hn.value = "";
      if (vn.disabled) vn.value = "";
      var cur = positions[f.id] || {};
      cur.answer = { h: hs.value, hn: hn.value === "" ? null : Number(hn.value), v: vs.value, vn: vn.value === "" ? null : Number(vn.value) };
      positions[f.id] = cur;
      store.set("positions", positions);
      fb.textContent = "";
      fb.hidden = true;
    }
    [hs, vs].forEach(function (x) {
      x.addEventListener("change", sync);
    });
    [hn, vn].forEach(function (x) {
      x.addEventListener("input", sync);
    });
    var fb = el("span", { class: "pos-fb", "aria-live": "polite", hidden: true });
    li.appendChild(el("span", { class: "pos-name" }, [flowerIcon(f), el("strong", { text: f.name })]));
    li.appendChild(
      el("span", { class: "pos-inputs" }, [
        el("span", { class: "pos-part" }, ["분수에서 ", hs, hn, " 칸,"]),
        el("span", { class: "pos-part" }, [vs, vn, " 칸 떨어진 곳"]),
      ])
    );
    li.appendChild(fb);
    li._fb = fb;
    hn.disabled = hs.value === "none";
    vn.disabled = vs.value === "none";
  }
  function judgePos(f) {
    var a = (positions[f.id] || {}).answer || {};
    var wantH = f.x > 0 ? "right" : f.x < 0 ? "left" : "none";
    var wantV = f.y > 0 ? "up" : f.y < 0 ? "down" : "none";
    if (!a.h || !a.v || (a.h !== "none" && a.hn == null) || (a.v !== "none" && a.vn == null)) return { ok: false, blank: true, msg: "가로와 세로의 방향을 고르고 칸 수를 적어 주세요." };
    var hN = a.h === "none" ? 0 : a.hn;
    var vN = a.v === "none" ? 0 : a.vn;
    // 0칸으로 적었으면 방향이 없는 것과 같다
    var h = hN === 0 ? "none" : a.h;
    var v = vN === 0 ? "none" : a.v;
    var dirOk = h === wantH && v === wantV;
    var numOk = hN === Math.abs(f.x) && vN === Math.abs(f.y);
    if (dirOk && numOk) return { ok: true };
    if (dirOk) return { ok: false, msg: "방향은 맞아요. 칸 수를 다시 세어 보세요." };
    return { ok: false, msg: "분수 칸에서 출발해 가로로 몇 칸, 세로로 몇 칸 가야 하는지 정원판에서 다시 세어 보세요." };
  }
  function checkPositions() {
    var wrong = 0;
    var blank = 0;
    C.flowers.forEach(function (f) {
      var li = posUI.rows[f.id];
      if (!li || posKnown(f.id)) return;
      var st = positions[f.id] || {};
      var r = judgePos(f);
      var key = JSON.stringify(st.answer || {});
      if (r.ok) {
        st.ok = true;
      } else if (r.blank) {
        blank++;
      } else {
        wrong++;
        if (st.lastWrong !== key) st.tries = (st.tries || 0) + 1; // 같은 답을 다시 확인하면 세지 않는다
        st.lastWrong = key;
      }
      positions[f.id] = st;
      if (r.ok) drawPosRow(f);
      else if (li._fb) {
        li._fb.hidden = false;
        li._fb.textContent = (r.blank ? "✏️ " : "❌ ") + r.msg;
      }
    });
    store.set("positions", positions);
    posUI.msg.hidden = false;
    if (positionsDone()) {
      posUI.msg.className = "ss-feedback is-correct";
      posUI.msg.textContent = "⭕ 꽃의 위치를 모두 바르게 나타냈어요! 이제 아래에서 출발 꽃과 도착 꽃을 골라 꿀벌을 움직여 보세요.";
    } else {
      posUI.msg.className = "ss-feedback is-wrong";
      posUI.msg.textContent = blank && !wrong ? "아직 적지 않은 칸이 있어요." : "다시 세어 볼 꽃이 있어요. 표시된 꽃을 고쳐 보세요.";
    }
    drawPosDone();
    if (typeof exp !== "undefined" && exp) exp.refresh();
    lesson.refresh();
  }
  function drawPosDone() {
    var done = positionsDone();
    posUI.box.classList.toggle("is-done", done);
    posUI.btn.hidden = done;
    if (done && posUI.msg.hidden) {
      posUI.msg.hidden = false;
      posUI.msg.className = "ss-feedback is-correct";
      posUI.msg.textContent = "✔ 세 꽃의 위치를 모두 바르게 나타냈어요.";
    }
  }

  function introNode() {
    var box = el("div");
    C.intro.paragraphs.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    box.appendChild(positionTask());
    box.appendChild(
      el("div", { class: "rule-box" }, [
        el("p", { class: "rule-title", text: "🐝 규칙" }),
        el(
          "ul",
          null,
          C.rule.lines.map(function (t) {
            return el("li", { text: t });
          })
        ),
      ])
    );
    C.intro.after.forEach(function (p) {
      box.appendChild(S.rich(p, "p"));
    });
    return box;
  }

  // 방향별로 정한 걸린 시간(반대 방향 실험 비교용)과 확인 오답 수
  var dirTimes = store.get("dirTimes", {}) || {};
  var checks = store.get("checks", {}) || {};

  /* ── 관찰·기록 카드: 처음 위치 → 나중 위치, 걸린 시간과 운동 문장을 학생이 직접 쓰기 + 확인(공통 틀 check 훅) ── */
  function posRow(icon, title, f) {
    var d = descOf(f.id);
    return el("div", { class: "obs-pos-row" }, [
      el("span", { class: "obs-pos-title", text: icon + " " + title }),
      el("span", { class: "obs-pos-val" }, [flowerIcon(f), el("strong", { text: f.name }), d ? el("small", { text: " (" + d + ")" }) : null]),
    ]);
  }
  function observeCard(sel) {
    var a = sel.from;
    var b = sel.to;
    var n = secondsOf(a, b);
    var pk = pairKey(a, b);
    var secWrong = 0; // 이 카드에서 걸린 시간을 틀린 횟수(같은 답 반복은 틀이 세지 않음)
    var body = el("div", null, [
      el("div", { class: "obs-pos" }, [posRow("📍", "처음 위치", F[a]), posRow("🏁", "나중 위치", F[b])]),
      el("p", { class: "obs-example" }, [el("span", { class: "sp-label", text: "✏️ 이렇게 써요 " }), S.rich(C.sentenceExample, "span")]),
    ]);
    return {
      question: "꿀벌이 이동하는 데 몇 초가 걸렸는지 적고, 꿀벌의 운동을 아래 예처럼 한 문장으로 써 보세요. 다 쓰면 '확인하기'를 눌러요.",
      body: body,
      type: "numeric",
      fields: [
        { id: "seconds", label: "걸린 시간", unit: "초", step: 1, min: 1, max: 20 },
        { id: "sentence", kind: "text", label: "꿀벌의 운동을 문장으로 쓰기", placeholder: "꿀벌은 …", minLength: 1, maxLength: 80 },
      ],
      checkLabel: "✔️ 확인하기",
      retryLabel: "🔁 꿀벌 다시 움직여 보기",
      check: function (v) {
        if (v.seconds !== n) {
          secWrong++;
          checks[pk] = (checks[pk] || 0) + 1;
          store.set("checks", checks);
          return (
            "❌ 걸린 시간을 다시 한 번 움직이며 세어 볼까요?" +
            (v.seconds !== Math.round(v.seconds) ? " 규칙에서는 한 칸에 1초씩 세어요." : "") +
            (secWrong >= 2 ? " 💡 꿀벌이 지나간 칸에 남은 발자국(●)을 하나씩 짚으며 세어 보세요. 발자국 하나가 한 칸이에요." : "")
          );
        }
        var bad = checkSentence(v.sentence, a, b, n);
        if (bad) return "✏️ 걸린 시간은 맞아요. " + bad;
        return { ok: true, message: "⭕ 맞아요! 걸린 시간을 바르게 세고, 꿀벌의 운동을 문장으로 잘 표현했어요. '기록하기'를 눌러요." };
      },
    };
  }

  /* ── 현재 고른 꽃을 새로고침 뒤에도 되살린다(공통 틀은 선택을 저장하지 않음) ── */
  var curSel = {};
  function rememberSel(s) {
    curSel = { from: s.from || null, to: s.to || null };
    if (s.from == null && s.to == null) return;
    store.set("curSel", curSel);
  }
  var selRestored = false;
  function activateExperiment() {
    exp.activate();
    if (selRestored) return;
    selRestored = true;
    var saved = store.get("curSel", null);
    if (!saved) return;
    var s = {};
    if (saved.from && F[saved.from]) s.from = saved.from;
    if (saved.to && F[saved.to]) s.to = saved.to;
    if (s.from || s.to) exp.select(s);
  }
  // 정원판의 꽃을 눌렀을 때: 출발 꽃이 없으면 출발 꽃, 있으면 도착 꽃으로 고른다
  function onFlowerTap(ctx, id) {
    if (!F[id]) return;
    if (!curSel.from) ctx.onPick({ from: id });
    else if (curSel.from === id) toast("여기는 출발 꽃이에요. 도착할 꽃을 눌러 주세요. (출발 꽃을 바꾸려면 ① 버튼을 눌러요)", 3200);
    else ctx.onPick({ to: id });
  }

  // 마지막으로 움직인 꽃 짝(반대 방향 포함). 새로고침·화면 전환 뒤 같은 짝을 고르고 있으면 결과를 다시 보여 준다.
  // (공통 틀의 scene 복원은 phases에 적은 방향만 되살리므로 앱에서 보완)
  function saveLastRun(a, b) {
    if (a) store.set("lastRun", { from: a, to: b });
    else store.remove("lastRun");
  }
  function isLastRun(s) {
    var lr = store.get("lastRun", null);
    return !!(lr && s.from && s.to && lr.from === s.from && lr.to === s.to && F[lr.from] && F[lr.to]);
  }

  function counterNodes(container) {
    var rule = el("div", { class: "rule-badge", text: "⏱ 규칙: 1칸 = 1초" });
    var counter = el("div", { class: "bee-counter", "aria-live": "polite", hidden: true });
    container.appendChild(rule);
    container.appendChild(counter);
    return { rule: rule, counter: counter };
  }
  function setCounter(c, text) {
    c.hidden = !text;
    c.textContent = text || "";
  }

  /* ── 2D 대체 화면: 정원판을 위에서 본 모형 ── */
  function build2D(root, ctx) {
    var B = C.board;
    var cols = B.xMax - B.xMin + 1;
    var rows = B.yMax - B.yMin + 1;
    var token = 0;
    var beeAt = null;
    var shown = null; // 화면에 남아 있는 결과(출발·도착)
    var cells = {};
    var flowerBtns = {};
    var board = el("div", { class: "g2-board", role: "group", "aria-label": "정원판(2D 모형, 가로 " + cols + "칸 세로 " + rows + "칸)" });
    board.style.setProperty("--cols", cols);
    board.style.setProperty("--rows", rows);
    for (var y = B.yMax; y >= B.yMin; y--) {
      for (var x = B.xMin; x <= B.xMax; x++) {
        var fl = C.flowers.filter(function (f) {
          return f.x === x && f.y === y;
        })[0];
        var cell;
        if (fl) {
          cell = el(
            "button",
            {
              type: "button",
              class: "g2-cell g2-flower",
              "aria-label": fl.name + (descOf(fl.id) ? ", " + descOf(fl.id) : ""),
              onclick: (function (id) {
                return function () {
                  onFlowerTap(ctx, id);
                };
              })(fl.id),
            },
            [flowerIcon(fl), el("span", { class: "g2-name", text: fl.short })]
          );
          flowerBtns[fl.id] = cell;
        } else if (x === FOUNTAIN.x && y === FOUNTAIN.y) {
          cell = el("div", { class: "g2-cell g2-fountain", role: "img", "aria-label": "분수" }, [el("span", { class: "g2-ico", "aria-hidden": "true", text: "⛲" }), el("span", { class: "g2-name", "aria-hidden": "true", text: "분수" })]);
        } else {
          cell = el("div", { class: "g2-cell" + (Math.abs(x + y) % 2 ? " is-alt" : ""), "aria-hidden": "true" });
        }
        cells[x + "," + y] = cell;
        board.appendChild(cell);
      }
    }
    var ghost = el("div", { class: "g2-bee is-ghost", "aria-hidden": "true", hidden: true }, [el("span", { text: "🐝" })]);
    var bee = el("div", { class: "g2-bee", "aria-hidden": "true", hidden: true }, [el("span", { text: "🐝" })]);
    board.appendChild(ghost);
    board.appendChild(bee);

    var viewBox = el("div", { class: "g2-view" });
    var nodes = counterNodes(viewBox);
    viewBox.appendChild(
      el("div", { class: "g2-frame" }, [
        el("span", { class: "g2-dir g2-up", text: "↑ 위쪽" }),
        el("span", { class: "g2-dir g2-left" }, [el("span", { text: "←" }), el("span", { text: "왼쪽" })]),
        board,
        el("span", { class: "g2-dir g2-right" }, [el("span", { text: "→" }), el("span", { text: "오른쪽" })]),
        el("span", { class: "g2-dir g2-down", text: "↓ 아래쪽" }),
      ])
    );
    viewBox.appendChild(
      el("p", { class: "g2-legend" }, [
        el("span", { class: "lg-item" }, [el("span", { class: "lg-ghost", "aria-hidden": "true", text: "🐝" }), " 흐린 꿀벌: 처음 위치"]),
        el("span", { class: "lg-item" }, [el("span", { "aria-hidden": "true", text: "🐝" }), " 진한 꿀벌: 나중 위치"]),
        el("span", { class: "lg-item" }, [el("span", { class: "g2-foot-sample", "aria-hidden": "true", text: "●" }), " 발자국: 꿀벌이 지나간 칸"]),
      ])
    );
    root.appendChild(viewBox);

    function place(node, x, y, instant) {
      node.classList.toggle("no-anim", !!instant);
      node.style.left = (((x - B.xMin) + 0.5) / cols) * 100 + "%";
      node.style.top = (((B.yMax - y) + 0.5) / rows) * 100 + "%";
      node.hidden = false;
      if (instant) void node.offsetWidth; // 바로 옮긴 뒤 다시 애니메이션 켜기
    }
    function clearTrail() {
      board.querySelectorAll(".g2-foot").forEach(function (f) {
        f.parentNode.removeChild(f);
      });
      ghost.hidden = true;
      shown = null;
      Object.keys(flowerBtns).forEach(function (id) {
        flowerBtns[id].classList.remove("is-start-pos", "is-end-pos");
      });
    }
    function foot(c) {
      var cell = cells[c.x + "," + c.y];
      if (cell) cell.appendChild(el("span", { class: "g2-foot", "aria-hidden": "true", text: "●" }));
    }
    function moveBeeTo(id, instant) {
      place(bee, F[id].x, F[id].y, instant);
      beeAt = id;
    }
    function showResult(a, b) {
      clearTrail();
      shown = { from: a, to: b };
      pathOf(a, b).forEach(foot);
      place(ghost, F[a].x, F[a].y, true);
      moveBeeTo(b, true);
      flowerBtns[a].classList.add("is-start-pos");
      flowerBtns[b].classList.add("is-end-pos");
    }

    return {
      highlight: function (s) {
        rememberSel(s);
        Object.keys(flowerBtns).forEach(function (id) {
          flowerBtns[id].classList.toggle("is-from", s.from === id);
          flowerBtns[id].classList.toggle("is-to", s.to === id && s.to !== s.from);
          flowerBtns[id].setAttribute("aria-label", F[id].name + (descOf(id) ? ", " + descOf(id) : "") + (s.from === id ? ", 출발 꽃" : s.to === id ? ", 도착 꽃" : ""));
        });
        // 마지막으로 움직인 짝을 고르고 있으면(반대 방향 포함) 다른 결과가 그려져 있어도 그 결과로 되살린다
        if (isLastRun(s) && !(shown && shown.from === s.from && shown.to === s.to)) showResult(s.from, s.to);
        else if (s.from && beeAt !== s.from && !(shown && shown.from === s.from && shown.to === s.to)) {
          token++;
          clearTrail();
          setCounter(nodes.counter, "");
          moveBeeTo(s.from, beeAt == null);
        }
      },
      run: async function (sel) {
        var my = ++token;
        var a = sel.from;
        var b = sel.to;
        var path = pathOf(a, b);
        var ms = C.animation.msPerCell;
        clearTrail();
        moveBeeTo(a, true);
        setCounter(nodes.counter, "⏱ 0초 · 출발! (⏩ 빨리 감기)");
        await sleep(650);
        if (my !== token) return;
        place(ghost, F[a].x, F[a].y, true);
        flowerBtns[a].classList.add("is-start-pos");
        for (var i = 0; i < path.length; i++) {
          place(bee, path[i].x, path[i].y, false);
          await sleep(ms);
          if (my !== token) return;
          foot(path[i]);
          setCounter(nodes.counter, "⏱ " + (i + 1) + "초 (⏩ 빨리 감기)");
        }
        beeAt = b;
        shown = { from: a, to: b };
        saveLastRun(a, b);
        flowerBtns[b].classList.add("is-end-pos");
        await sleep(450);
        if (my !== token) return;
        setCounter(nodes.counter, "🏁 도착! 몇 초가 걸렸나요?");
      },
      showInstant: function (sel) {
        showResult(sel.from, sel.to);
      },
      clear: function () {
        token++;
        clearTrail();
        saveLastRun(null);
        setCounter(nodes.counter, "");
        if (curSel.from) moveBeeTo(curSel.from, true);
        else {
          bee.hidden = true;
          beeAt = null;
        }
      },
      resetView: function () {},
      dispose: function () {
        token++;
      },
    };
  }

  /* ── 3D 화면 ── */
  function build3D(container, ctx) {
    var B = C.board;
    var CS = 1.6; // 한 칸 크기(장면 단위)
    function X(x) {
      return x * CS;
    }
    function Z(y) {
      return -y * CS; // 정원판의 '위쪽' = 화면 안쪽
    }
    var W = (B.xMax - B.xMin + 1) * CS;
    var D = (B.yMax - B.yMin + 1) * CS;
    var cx = ((B.xMin + B.xMax) / 2) * CS;
    var cz = (-(B.yMin + B.yMax) / 2) * CS;
    return S.Sim3D.create({
      container: container,
      frame: { width: W + 3.2, depth: D + 3.2, center: [cx, 0, cz + 0.8] }, // 아래쪽 도움말 글자에 정원판이 덜 가리도록 조금 위로
      onPick: function (id) {
        onFlowerTap(ctx, id);
      },
      onLost: ctx.onLost,
    }).then(function (v) {
      if (!v) return null;
      var T = v.THREE;
      var M = v.make;
      var mat = M.material;
      var nodes = counterNodes(container);
      var anim = 0;
      var beeAt = null;
      var shown = null; // 화면에 남아 있는 결과(출발·도착)
      var BEE_Y = 1.6;
      var BEE_S = 1.5;

      /* 바닥·정원판 */
      var ground = new T.Mesh(new T.BoxGeometry(W + 3, 0.3, D + 3), mat(0x86bf62, { roughness: 0.95 }));
      ground.position.set(cx, -0.16, cz);
      v.root.add(ground);
      var boardBase = new T.Mesh(new T.BoxGeometry(W + 0.12, 0.06, D + 0.12), mat(0x4f7d3c, { roughness: 0.9 }));
      boardBase.position.set(cx, 0.0, cz);
      v.root.add(boardBase);
      var tileGeo = new T.BoxGeometry(CS * 0.93, 0.05, CS * 0.93);
      var tileA = mat(0xd7eebb, { roughness: 0.9 });
      var tileB = mat(0xc6e4a3, { roughness: 0.9 });
      for (var gy = B.yMin; gy <= B.yMax; gy++) {
        for (var gx = B.xMin; gx <= B.xMax; gx++) {
          var t = new T.Mesh(tileGeo, (gx + gy) % 2 === 0 ? tileA : tileB);
          t.position.set(X(gx), 0.05, Z(gy));
          v.root.add(t);
        }
      }
      var TOP = 0.08;

      /* 방향 이름표(정원판을 돌려 봐도 위·아래·왼쪽·오른쪽을 알 수 있게) */
      function dirLabel(text, x, z) {
        var s = M.label(text, { height: 0.78, bg: "rgba(31,39,51,0.78)", color: "#ffffff" });
        s.position.set(x, 0.4, z);
        v.root.add(s);
      }
      dirLabel("↑ 위쪽", cx, Z(B.yMax) - CS * 0.95);
      dirLabel("↓ 아래쪽", cx, Z(B.yMin) + CS * 0.95);
      dirLabel("← 왼쪽", X(B.xMin) - CS * 0.95, cz);
      dirLabel("오른쪽 →", X(B.xMax) + CS * 0.95, cz);

      /* 분수 */
      (function fountain() {
        var g = new T.Group();
        var stone = mat(0xb9c2cc, { roughness: 0.7 });
        var basin = new T.Mesh(new T.CylinderGeometry(0.66, 0.7, 0.3, 28), stone);
        basin.position.y = 0.15;
        var water = new T.Mesh(new T.CylinderGeometry(0.56, 0.56, 0.04, 28), mat(0x6fb8ea, { roughness: 0.15 }));
        water.position.y = 0.29;
        var pillar = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 0.6, 16), stone);
        pillar.position.y = 0.55;
        var bowl = new T.Mesh(new T.CylinderGeometry(0.3, 0.18, 0.12, 20), stone);
        bowl.position.y = 0.86;
        var jet = new T.Mesh(new T.ConeGeometry(0.1, 0.55, 12), mat(0xbfe6ff, { transparent: true, opacity: 0.7 }));
        jet.position.y = 1.18;
        g.add(basin, water, pillar, bowl, jet);
        for (var i = 0; i < 6; i++) {
          var dr = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), mat(0xbfe6ff, { transparent: true, opacity: 0.8 }));
          var ang = (i / 6) * Math.PI * 2;
          dr.position.set(Math.cos(ang) * 0.34, 0.72 - (i % 2) * 0.12, Math.sin(ang) * 0.34);
          g.add(dr);
        }
        g.position.set(X(FOUNTAIN.x), TOP, Z(FOUNTAIN.y));
        g.scale.setScalar(1.25);
        v.root.add(g);
        var lb = M.label("분수", { height: 0.7, bold: true });
        lb.position.set(X(FOUNTAIN.x), TOP + 2.3, Z(FOUNTAIN.y));
        v.root.add(lb);
      })();

      /* 꽃 모형(실제 꽃을 단순화) — 색이 비슷한 수선화꽃·유채꽃은 모양으로도 확실히 구분한다 */
      function petalRing(g, n, len, wid, color, y, tilt, r0) {
        var geo = new T.SphereGeometry(1, 12, 8);
        var m = mat(color);
        for (var i = 0; i < n; i++) {
          var p = new T.Mesh(geo, m);
          p.scale.set(len, 0.035, wid);
          var ang = (i / n) * Math.PI * 2;
          var pv = new T.Group();
          pv.rotation.y = ang;
          p.position.x = r0 + len * 0.85;
          p.rotation.z = tilt;
          pv.add(p);
          pv.position.y = y;
          g.add(pv);
        }
      }
      function stem(g, h, color) {
        var s = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, h, 8), mat(color || 0x3f8a3a));
        s.position.y = h / 2;
        g.add(s);
        var leafGeo = new T.SphereGeometry(1, 10, 6);
        var lm = mat(0x4f9a45);
        [-1, 1].forEach(function (sd) {
          var lf = new T.Mesh(leafGeo, lm);
          lf.scale.set(0.24, 0.03, 0.08);
          lf.position.set(sd * 0.18, h * 0.3, 0);
          lf.rotation.z = sd * 0.5;
          g.add(lf);
        });
      }
      var makeFlower = {
        susun: function (g) {
          // 수선화: 연노랑 꽃잎 6장 + 가운데 진노랑 나팔
          stem(g, 0.72);
          petalRing(g, 6, 0.2, 0.1, 0xfff1a0, 0.74, 0.12, 0.02);
          var tr = new T.Mesh(new T.CylinderGeometry(0.13, 0.08, 0.2, 16, 1, true), mat(0xf5a300, { side: T.DoubleSide }));
          tr.position.y = 0.84;
          g.add(tr);
        },
        jebi: function (g) {
          // 제비꽃: 키가 작고 보라색 작은 꽃잎 5장
          stem(g, 0.42);
          petalRing(g, 5, 0.15, 0.1, 0x7b4fc9, 0.44, 0.2, 0.02);
          var c = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), mat(0xf6e27a));
          c.position.y = 0.47;
          g.add(c);
        },
        yuchae: function (g) {
          // 유채꽃: 키가 크고 작은 노란 꽃이 여러 송이 모여 핀다
          stem(g, 0.95);
          var bm = mat(0xf2d000);
          var bg = new T.SphereGeometry(0.085, 10, 8);
          var spots = [
            [0, 1.02, 0],
            [0.13, 0.96, 0.05],
            [-0.12, 0.95, -0.05],
            [0.05, 0.9, -0.13],
            [-0.06, 0.9, 0.13],
            [0.15, 0.84, -0.08],
            [-0.14, 0.83, 0.07],
            [0.02, 1.12, 0.02],
          ];
          spots.forEach(function (p) {
            var b = new T.Mesh(bg, bm);
            b.position.set(p[0], p[1], p[2]);
            g.add(b);
          });
        },
        jindal: function (g) {
          // 진달래: 갈색 줄기 + 분홍 꽃잎 5장(깔때기 모양)
          stem(g, 0.66, 0x7a5a3a);
          petalRing(g, 5, 0.22, 0.14, 0xe86fa3, 0.7, -0.45, 0.02);
          var c = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), mat(0xb8386e));
          c.position.y = 0.7;
          g.add(c);
        },
      };
      var flowerObjs = {};
      var ringGeo = new T.TorusGeometry(0.68, 0.07, 10, 40);
      C.flowers.forEach(function (f) {
        var g = new T.Group();
        var sticker = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.02, 32), mat(0xfbfbf4, { roughness: 0.6 }));
        sticker.position.y = 0.01;
        g.add(sticker);
        makeFlower[f.id](g);
        g.position.set(X(f.x), TOP, Z(f.y));
        g.scale.setScalar(1.45);
        v.root.add(g);
        v.pickable(g, f.id);
        var lb = M.label(f.name, { height: 0.72, bold: true });
        lb.position.set(X(f.x), TOP + 2.55, Z(f.y));
        v.root.add(lb);
        flowerObjs[f.id] = g;
      });
      var startRing = new T.Mesh(ringGeo, mat(0x2f6fd6, { emissive: 0x10306a }));
      startRing.rotation.x = -Math.PI / 2;
      startRing.visible = false;
      v.root.add(startRing);
      var targetRing = new T.Mesh(ringGeo, mat(0xf2a93b, { emissive: 0x6a3a00 }));
      targetRing.rotation.x = -Math.PI / 2;
      targetRing.visible = false;
      v.root.add(targetRing);

      /* 꿀벌 모형: 노랑·검정 줄무늬 몸통, 머리, 날개(+x 쪽이 앞) */
      function makeBee(opacity) {
        var tr = opacity < 1 ? { transparent: true, opacity: opacity, depthWrite: false } : {};
        var g = new T.Group();
        var body = new T.Mesh(new T.SphereGeometry(1, 18, 14), mat(0xf5c518, tr));
        body.scale.set(0.32, 0.24, 0.24);
        g.add(body);
        var stripeM = mat(0x1f1f1f, tr);
        [-0.1, 0.07].forEach(function (x) {
          var s = new T.Mesh(new T.TorusGeometry(0.225, 0.045, 8, 24), stripeM);
          s.rotation.y = Math.PI / 2;
          s.position.x = x;
          s.scale.set(1, 1, 1);
          g.add(s);
        });
        var head = new T.Mesh(new T.SphereGeometry(0.15, 14, 10), stripeM);
        head.position.x = 0.36;
        g.add(head);
        var sting = new T.Mesh(new T.ConeGeometry(0.05, 0.14, 8), stripeM);
        sting.rotation.z = Math.PI / 2;
        sting.position.x = -0.37;
        g.add(sting);
        var wingM = mat(0xffffff, { transparent: true, opacity: 0.55 * opacity, depthWrite: false });
        var wings = [];
        [-1, 1].forEach(function (sd) {
          var pv = new T.Group();
          pv.position.set(0.02, 0.18, sd * 0.08);
          var w = new T.Mesh(new T.SphereGeometry(1, 12, 8), wingM);
          w.scale.set(0.16, 0.02, 0.26);
          w.position.z = sd * 0.22;
          pv.add(w);
          g.add(pv);
          wings.push({ pv: pv, sd: sd });
        });
        g.userData.wings = wings;
        return g;
      }
      var bee = makeBee(1);
      bee.scale.setScalar(BEE_S);
      bee.visible = false;
      v.root.add(bee);
      var ghost = makeBee(0.35);
      ghost.scale.setScalar(BEE_S);
      ghost.visible = false;
      v.root.add(ghost);
      function flap(g, t) {
        g.userData.wings.forEach(function (w) {
          w.pv.rotation.x = w.sd * Math.sin(t * Math.PI * 8) * 0.6;
        });
      }
      function beePos(x, y) {
        return [X(x), TOP + BEE_Y, Z(y)];
      }
      function face(g, dx, dy) {
        // 모형은 +x를 향한다. 정원판에서 위쪽(+y)은 화면 안쪽(-z)
        g.rotation.y = Math.atan2(dy, dx);
      }

      /* 발자국·처음/나중 위치 이름표·초 말풍선(잠깐 쓰는 물체는 discard로 해제) */
      var temps = [];
      var footGeo = new T.CylinderGeometry(0.18, 0.18, 0.03, 16);
      var footMat = mat(0x8a4f0a); // 짙은 갈색: 주황 고리(도착 꽃)와 구별되게
      function isFlowerCell(c) {
        return C.flowers.some(function (f) {
          return f.x === c.x && f.y === c.y;
        });
      }
      function footAt(c) {
        var m = new T.Mesh(footGeo, footMat);
        // 발자국은 칸 앞쪽 오른쪽 모서리(화면 앞쪽)에 둔다. 꽃 칸에서는 흰 받침(반지름 약 0.73)과
        // 파란·주황 고리(반지름 0.68 + 굵기 0.07) 바깥(중심에서 약 0.93), 받침 윗면보다 높게 두어
        // 도착 칸 발자국도 가리거나 고리 색에 묻히지 않게 한다(발자국 수 = 칸 수 = 걸린 초).
        var flower = isFlowerCell(c);
        var off = flower ? CS * 0.41 : CS * 0.3;
        m.position.set(X(c.x) + off, flower ? TOP + 0.16 : TOP + 0.02, Z(c.y) + off);
        if (flower) m.scale.set(0.85, 1, 0.85);
        m.renderOrder = 2;
        v.root.add(m);
        temps.push(m);
      }
      function tag(text, pos, dark) {
        var s = M.label(text, { height: 0.6, bold: true, bg: dark ? "rgba(31,39,51,0.9)" : "rgba(255,255,255,0.8)", color: dark ? "#ffffff" : "#5b6676", depthTest: false });
        // 꽃 이름표보다 높이 띄워 발자국·꽃 이름을 덮지 않게 한다
        s.position.set(pos[0], pos[1] + 2.4, pos[2]);
        v.root.add(s);
        temps.push(s);
        return s;
      }
      var bubble = null;
      function setBubble(text) {
        if (bubble) {
          v.discard(bubble);
          bubble = null;
        }
        if (!text) return;
        bubble = M.label(text, { height: 0.5, bold: true, bg: "rgba(255,248,214,0.96)", border: "#f2a93b", depthTest: false });
        bubble.position.set(0, 0.75, 0);
        bee.add(bubble);
      }
      function clearTrail() {
        temps.splice(0).forEach(function (o) {
          v.discard(o);
        });
        setBubble(null);
        ghost.visible = false;
        shown = null;
      }
      function placeBee(id) {
        var p = beePos(F[id].x, F[id].y);
        bee.position.set(p[0], p[1], p[2]);
        bee.visible = true;
        beeAt = id;
      }
      function showResult(a, b) {
        clearTrail();
        shown = { from: a, to: b };
        var path = pathOf(a, b);
        path.forEach(footAt);
        var pa = beePos(F[a].x, F[a].y);
        ghost.position.set(pa[0], pa[1], pa[2]);
        ghost.visible = true;
        var last = path.length > 1 ? path[path.length - 2] : F[a];
        face(ghost, path[0].x - F[a].x, path[0].y - F[a].y);
        placeBee(b);
        face(bee, F[b].x - last.x, F[b].y - last.y);
        tag("처음 위치", pa, false);
        tag("나중 위치", beePos(F[b].x, F[b].y), true);
      }
      v.onThemeChange(function (dark) {
        ground.material.color.set(dark ? 0x6f9f52 : 0x86bf62);
      });

      v.render();
      return {
        whenVisible: v.whenVisible,
        highlight: function (s) {
          rememberSel(s);
          if (s.from) {
            startRing.position.set(X(F[s.from].x), TOP + 0.05, Z(F[s.from].y));
            startRing.visible = true;
          } else startRing.visible = false;
          if (s.to && s.to !== s.from) {
            targetRing.position.set(X(F[s.to].x), TOP + 0.06, Z(F[s.to].y));
            targetRing.visible = true;
          } else targetRing.visible = false;
          // 마지막으로 움직인 짝을 고르고 있으면(반대 방향 포함) 다른 결과가 그려져 있어도 그 결과로 되살린다
          if (isLastRun(s) && !(shown && shown.from === s.from && shown.to === s.to)) showResult(s.from, s.to);
          else if (s.from && beeAt !== s.from && !(shown && shown.from === s.from && shown.to === s.to)) {
            var my = ++anim;
            clearTrail();
            setCounter(nodes.counter, "");
            if (beeAt == null || !bee.visible) {
              placeBee(s.from);
            } else {
              // 출발 꽃 위로 날아가 기다린다
              var from = bee.position.clone();
              var p = beePos(F[s.from].x, F[s.from].y);
              var to = new T.Vector3(p[0], p[1], p[2]);
              beeAt = s.from;
              face(bee, to.x - from.x, from.z - to.z);
              v.tween(420, function (e, raw) {
                if (my !== anim) return;
                bee.position.lerpVectors(from, to, e);
                bee.position.y = to.y + Math.sin(Math.PI * e) * 0.8;
                flap(bee, raw);
              });
            }
          }
          v.render();
        },
        run: async function (sel) {
          var my = ++anim;
          var a = sel.from;
          var b = sel.to;
          var path = pathOf(a, b);
          var ms = C.animation.msPerCell;
          clearTrail();
          placeBee(a);
          face(bee, path[0].x - F[a].x, path[0].y - F[a].y);
          await v.flyHome(350);
          setCounter(nodes.counter, "⏱ 0초 · 출발! (⏩ 빨리 감기)");
          setBubble("출발!");
          await v.wait(600);
          if (my !== anim || v.isDisposed()) return;
          var pa = beePos(F[a].x, F[a].y);
          ghost.position.set(pa[0], pa[1], pa[2]);
          ghost.rotation.y = bee.rotation.y;
          ghost.visible = true;
          tag("처음 위치", pa, false);
          var prev = { x: F[a].x, y: F[a].y };
          for (var i = 0; i < path.length; i++) {
            var c = path[i];
            face(bee, c.x - prev.x, c.y - prev.y);
            var f0 = bee.position.clone();
            var q = beePos(c.x, c.y);
            var f1 = new T.Vector3(q[0], q[1], q[2]);
            await v.tween(ms, function (e, raw) {
              if (my !== anim) return;
              bee.position.lerpVectors(f0, f1, e);
              bee.position.y = f1.y + Math.sin(Math.PI * raw) * 0.55; // 통통 튀며 한 칸
              flap(bee, raw);
            });
            if (my !== anim || v.isDisposed()) return;
            footAt(c);
            setCounter(nodes.counter, "⏱ " + (i + 1) + "초 (⏩ 빨리 감기)");
            setBubble(i + 1 + "초");
            prev = c;
          }
          beeAt = b;
          shown = { from: a, to: b };
          saveLastRun(a, b);
          // 도착: 살짝 반짝(크기 변화)
          await v.tween(420, function (e, raw) {
            if (my !== anim) return;
            var k = BEE_S * (1 + Math.sin(Math.PI * raw) * 0.25);
            bee.scale.set(k, k, k);
          });
          bee.scale.setScalar(BEE_S);
          if (my !== anim || v.isDisposed()) return;
          setBubble(null);
          tag("나중 위치", beePos(F[b].x, F[b].y), true);
          setCounter(nodes.counter, "🏁 도착! 몇 초가 걸렸나요?");
          v.render();
        },
        showInstant: function (sel) {
          showResult(sel.from, sel.to);
          v.render();
        },
        clear: function () {
          anim++;
          clearTrail();
          saveLastRun(null);
          setCounter(nodes.counter, "");
          if (curSel.from) placeBee(curSel.from);
          else {
            bee.visible = false;
            beeAt = null;
          }
          v.render();
        },
        resetView: v.resetView,
        dispose: function () {
          anim++;
          [nodes.rule, nodes.counter].forEach(function (n) {
            if (n.parentNode) n.parentNode.removeChild(n);
          });
          v.dispose();
        },
      };
    });
  }

  var exp = S.Experiment.create({
    root: $("experiment-root"),
    store: store,
    records: records,
    toast: toast,
    intro: introNode(),
    introTitle: C.intro.title,
    modelNote: C.modelNote,
    loadingText: "3D 정원을 준비하고 있어요…",
    clearLabel: "🧽 정원판 비우기",
    clearMessage: "정원판을 비웠어요. 기록은 그대로 남아 있어요.",
    runTitle: "꿀벌 움직이기",
    factors: [
      {
        id: "from",
        title: "출발 꽃(처음 위치) 고르기",
        short: "출발 꽃",
        options: C.flowers.map(function (f) {
          return {
            id: f.id,
            label: f.name,
            icon: function () {
              return flowerIcon(f);
            },
          };
        }),
        note: function (s) {
          return s.from ? "📍 처음 위치: " + F[s.from].name + (descOf(s.from) ? " — " + descOf(s.from) : "") : null;
        },
      },
      {
        id: "to",
        title: "도착 꽃(나중 위치) 고르기",
        short: "도착 꽃",
        options: C.flowers.map(function (f) {
          return {
            id: f.id,
            label: f.name,
            icon: function () {
              return flowerIcon(f);
            },
          };
        }),
        note: function (s) {
          return s.to && s.to !== s.from ? "🏁 나중 위치: " + F[s.to].name + (descOf(s.to) ? " — " + descOf(s.to) : "") : null;
        },
      },
    ],
    phases: [
      {
        id: "M",
        name: "꽃 짝",
        lead: "출발 꽃과 도착 꽃을 고르고 꿀벌을 출발시켜요. 서로 다른 꽃 짝 6개를 모두 기록해요(어느 꽃에서 출발할지는 자유예요).",
        cells: C.pairs.map(function (p) {
          return { from: p[0], to: p[1] };
        }),
      },
    ],
    doneLead: C.doneLead,
    cellKey: function (s) {
      return pairKey(s.from, s.to);
    },
    runLabel: function (s) {
      return "▶ 꿀벌 출발! (" + F[s.from].name + " → " + F[s.to].name + ")";
    },
    view: {
      build3D: build3D,
      build2D: build2D,
      tip3D: "👆 드래그: 돌려 보기 · 두 손가락: 확대/축소 · 두 번 탭: 처음 방향 · 꽃을 눌러 고를 수도 있어요",
      tip2D: "2D 화면(모형)이에요. 꽃을 눌러 고를 수 있어요(처음 누른 꽃 = 출발 꽃).",
    },
    observe: observeCard,
    // 실행 전: 꽃 위치 나타내기를 먼저 마친다(위치 활동이 빠지지 않게)
    canRun: function () {
      return positionsDone() || "먼저 '실험 전에 알아 두기'에서 분수를 기준으로 꽃의 위치를 적고 '꽃 위치 확인하기'를 눌러 주세요.";
    },
    onRunBlocked: function () {
      var det = posUI.box && posUI.box.closest("details");
      if (det) det.open = true;
      if (posUI.box) S.Experiment.scrollIntoView(posUI.box);
    },
    // 기록 직전 마지막 검사(fail-closed): 걸린 시간이 규칙과 같고 문장 검사를 통과한 값만 기록한다
    beforeRecord: function (s, v) {
      if (v.seconds !== secondsOf(s.from, s.to) || checkSentence(v.sentence, s.from, s.to, v.seconds)) return "'확인하기'를 통과한 뒤에 기록할 수 있어요.";
      return true;
    },
    makeRecord: function (s, v) {
      return { from: s.from, to: s.to, seconds: v.seconds, sentence: String(v.sentence).slice(0, 80) };
    },
    describeRecord: function (r) {
      return r.sentence || sentence(r.from, r.to, r.seconds);
    },
    miniTable: {
      title: "기록한 꽃 짝 한눈에 보기 (왼쪽: 출발 꽃 · 위쪽: 도착 꽃)",
      rows: C.flowers.map(function (f) {
        return { id: f.id, label: f.short };
      }),
      cols: C.flowers.map(function (f) {
        return { id: f.id, label: f.short };
      }),
      sel: function (r, c) {
        return { from: r.id, to: c.id };
      },
    },
    skipCells: C.flowers.map(function (f) {
      return {
        cell: { from: f.id, to: f.id },
        title: "🐝 출발 꽃과 도착 꽃이 같아요",
        text: "이대로는 꿀벌이 움직이지 않아요. **도착 꽃**을 다른 꽃으로 골라 보세요.",
        runLabel: "도착 꽃을 다른 꽃으로 골라요",
        short: "같은 꽃",
      };
    }),
    onRecorded: function (info) {
      var r = info.record;
      dirTimes[dirKey(r.from, r.to)] = r.seconds;
      store.set("dirTimes", dirTimes);
    },
    onChange: lesson.refresh,
  });

  /* ───────── 3. 기록·분석하기: 표 + 막대그래프 ───────── */
  var T = S.TableChart;
  function pairLabel(p) {
    return F[p[0]].short + "~" + F[p[1]].short;
  }
  function drawResults() {
    var card = $("result-table");
    card.textContent = "";
    card.appendChild(el("h3", { class: "sub-h first", text: "📋 꿀벌의 운동 기록" }));
    var tbox = el("div");
    card.appendChild(tbox);
    // 짝마다 마지막 기록 하나. 기록한 시각 순서로 번호를 매긴다(반대 방향으로 다시 기록하면 그 시각으로 옮겨 간다)
    var list = records.list().sort(function (x, y) {
      return String(x.recordedAt || "").localeCompare(String(y.recordedAt || ""));
    });
    T.renderTable(tbox, {
      caption: "꿀벌의 운동 기록(꽃 짝마다 마지막 기록, 기록한 시각 순서)",
      columns: [
        { id: "no", label: "번호" },
        { id: "from", label: "처음 위치(출발 꽃)" },
        { id: "to", label: "나중 위치(도착 꽃)" },
        { id: "sec", label: "걸린 시간", unit: "초", digits: 0 },
        { id: "sentence", label: "내가 쓴 꿀벌의 운동 문장" },
      ],
      rows: list.map(function (r, i) {
        return { no: String(i + 1), from: F[r.from].name, to: F[r.to].name, sec: r.seconds, sentence: r.sentence || sentence(r.from, r.to, r.seconds) };
      }),
    });

    var cc = $("chart-card");
    cc.textContent = "";
    cc.appendChild(el("h3", { class: "sub-h first", text: "📊 꽃 짝별 걸린 시간" }));
    var cbox = el("div");
    cc.appendChild(cbox);
    T.renderBar(cbox, {
      caption: "꽃 짝별 꿀벌이 이동하는 데 걸린 시간",
      xLabel: "꽃 짝",
      yLabel: "걸린 시간",
      yUnit: "초",
      unit: "초",
      digits: 0,
      yMin: 0,
      categories: C.pairs.map(pairLabel),
      series: [
        {
          name: "걸린 시간",
          values: C.pairs.map(function (p) {
            var r = records.get(pairKey(p[0], p[1]));
            return r ? r.seconds : null;
          }),
        },
      ],
    });
    cc.appendChild(el("p", { class: "ss-help", text: "막대 위의 숫자가 걸린 시간이에요. 꽃 짝 이름은 두 꽃을 줄여 쓴 것이에요(어느 쪽에서 출발했는지는 위 표에서 확인해요)." }));

    var dn = $("dir-note");
    dn.textContent = "";
    var both = C.pairs.filter(function (p) {
      return dirTimes[dirKey(p[0], p[1])] != null && dirTimes[dirKey(p[1], p[0])] != null;
    });
    if (both.length) {
      dn.appendChild(el("strong", { text: "🔁 반대 방향으로도 움직여 본 짝" }));
      var ul = el("ul");
      both.forEach(function (p) {
        ul.appendChild(el("li", { text: F[p[0]].name + " → " + F[p[1]].name + ": " + dirTimes[dirKey(p[0], p[1])] + "초 / " + F[p[1]].name + " → " + F[p[0]].name + ": " + dirTimes[dirKey(p[1], p[0])] + "초" }));
      });
      dn.appendChild(ul);
      dn.appendChild(el("p", { class: "ss-help", text: "두 방향의 걸린 시간을 비교해 보세요. 문장에서는 무엇이 달라지나요?" }));
    } else {
      dn.appendChild(el("span", { text: "💡 궁금하면 실험하기로 돌아가 출발 꽃과 도착 꽃을 서로 바꾸어 움직여 보세요. 걸린 시간과 운동을 표현한 문장은 어떻게 될까요?" }));
    }
  }

  /* ───────── 5. 마치기(결과 저장) ───────── */
  function buildDetail() {
    var q = quiz.result();
    var analysis = {};
    C.quiz.forEach(function (qq) {
      var r = q[qq.id];
      analysis[qq.id] = {
        choice: r.choice.map(function (id) {
          var o = qq.options.filter(function (x) {
            return x.id === id;
          })[0];
          return o ? o.label : id;
        }),
        correct: r.correct,
        tries: r.tries,
      };
    });
    var cv = conclude.values();
    var dt = {};
    Object.keys(dirTimes).forEach(function (k) {
      var ab = k.split(">");
      if (F[ab[0]] && F[ab[1]]) dt[F[ab[0]].name + "→" + F[ab[1]].name] = dirTimes[k];
    });
    var wrong = {};
    Object.keys(checks).forEach(function (k) {
      var ab = k.split("|");
      if (F[ab[0]] && F[ab[1]]) wrong[F[ab[0]].name + "~" + F[ab[1]].name] = checks[k];
    });
    return {
      predict: predict.values(),
      records: records.list().map(function (r) {
        return { from: F[r.from].name, to: F[r.to].name, seconds: r.seconds, sentence: r.sentence || null, recordedAt: r.recordedAt };
      }),
      positions: positionDetail(),
      directions: dt,
      countRetries: wrong,
      analysis: analysis,
      conclusion: cv.conclusion,
      extension: { q1: cv.ext1, q2: cv.ext2 },
      curiosity: curiosity.value(),
    };
  }

  function positionDetail() {
    var out = {};
    C.flowers.forEach(function (f) {
      if (f.id === C.positionExample) return;
      var st = positions[f.id] || {};
      out[f.name] = { ok: !!st.ok, wrongTries: st.tries || 0 };
    });
    return out;
  }

  lesson.finish({
    button: $("btn-finish"),
    msgEl: $("finish-msg"),
    loginHintEl: $("login-hint"),
    doneEl: $("done-card"),
    canFinish: function () {
      return curiosity.isDone() || "더 탐구하고 싶은 점(또는 궁금한 점)을 " + (C.curiosity.minLength || 2) + "글자 이상 먼저 적어 주세요.";
    },
    detail: buildDetail,
    summary: function () {
      var q = quiz.result();
      var correct = C.quiz.filter(function (qq) {
        return q[qq.id].correct;
      }).length;
      var p = exp.progress();
      return ["기록한 꽃 짝: " + p.done + "/" + p.total + "짝", "분석 질문: " + correct + "/" + C.quiz.length + " 맞힘"];
    },
  });
  lesson.restart($("btn-restart"));

  /* ───────── 단계 이동 ───────── */
  lesson.nav({
    el: $("stage-nav"),
    stages: C.stages,
    prevBtn: $("btn-prev"),
    nextBtn: $("btn-next"),
    gates: {
      experiment: function () {
        return predict.isDone() || "예상하기의 두 질문에 내 생각을 " + predict.minLength + "글자 이상 먼저 적어 주세요.";
      },
      analyze: function () {
        var p = exp.progress();
        return exp.allDone() || "꽃 짝 6개를 모두 기록해야 넘어갈 수 있어요. (지금 " + p.done + "/" + p.total + "짝)";
      },
      conclude: function () {
        return quiz.isDone() || "분석 질문 " + C.quiz.length + "개에서 모두 보기를 고르고 '확인하기'를 눌러 주세요.";
      },
      curiosity: function () {
        return conclude.isDone() || "결론과 발전 질문 2개를 모두 제출해 주세요.";
      },
    },
    done: {
      predict: predict.isDone,
      experiment: exp.allDone,
      analyze: quiz.isDone,
      conclude: conclude.isDone,
      curiosity: function () {
        return !!lesson.meta.finishedAt;
      },
    },
    onEnter: {
      experiment: activateExperiment,
      analyze: drawResults,
    },
  });
})();
