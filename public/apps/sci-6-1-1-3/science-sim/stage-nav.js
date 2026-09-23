/*
 * science-sim/stage-nav.js — 단계 진행바 + 단계 전환 (정본: scripts/templates/science-sim/)
 *
 *   var nav = SciSim.StageNav({
 *     el: document.getElementById("stage-nav"),
 *     stages: [{ id: "predict", label: "예상하기" }, ...],   // LessonConfig.stages
 *     current: "predict",
 *     // 그 단계로 들어갈 수 있는지. true면 이동, 문자열이면 그 문구를 안내하고 막는다.
 *     canEnter: function (id) { return true; },
 *     isDone: function (id) { return false; },               // 체크 표시용(선택)
 *     onChange: function (id) { ... },                       // 단계가 바뀐 뒤 호출
 *     onBlocked: function (message) { alert(message); },     // 막혔을 때(선택)
 *     // canEnter를 통과한 뒤, 실제로 넘어가기 직전에 한 번 더 확인한다(답 되짚기·차단 — answer-check.js).
 *     // true면 바로 이동, Promise면 기다린 뒤 결과가 false가 아닐 때만 이동한다. 기다리는 동안 다른 이동은 무시한다.
 *     beforeLeave: function (targetId, currentId) { return true | Promise<bool>; },   // 선택
 *     waitingMessage: "…",                                   // 선택: 확인을 기다리는 동안 다시 눌렀을 때 보여 줄 말
 *   });
 *   nav.go("experiment");              // 앞 단계는 언제든, 뒤 단계는 canEnter 통과 시
 *   nav.go("experiment", { silent: true });  // beforeLeave를 건너뛴다(새로고침 복원처럼 학생이 누르지 않은 이동)
 *   nav.next(); nav.prev(); nav.refresh(); nav.current();
 *
 * 각 단계의 화면은 <section data-stage="{id}">로 두고, 현재 단계만 보이게 한다(hidden 속성).
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});

  SciSim.StageNav = function (opts) {
    var stages = opts.stages;
    var cur = stages.some(function (s) {
      return s.id === opts.current;
    })
      ? opts.current
      : stages[0].id;
    var list = SciSim.el("ol", { class: "ss-stepper" });
    opts.el.textContent = "";
    opts.el.appendChild(list);

    function indexOf(id) {
      for (var i = 0; i < stages.length; i++) if (stages[i].id === id) return i;
      return -1;
    }

    // 앞 단계들을 모두 통과해야 들어갈 수 있다(건너뛰기 방지)
    function check(id) {
      var target = indexOf(id);
      for (var i = 1; i <= target; i++) {
        var r = opts.canEnter ? opts.canEnter(stages[i].id) : true;
        if (r !== true) return { ok: false, message: typeof r === "string" ? r : "앞 단계를 먼저 마쳐 주세요." };
      }
      return { ok: true };
    }

    function render() {
      list.textContent = "";
      var ci = indexOf(cur);
      stages.forEach(function (s, i) {
        var reachable = i <= ci || check(s.id).ok;
        var done = opts.isDone ? !!opts.isDone(s.id) : false;
        var btn = SciSim.el(
          "button",
          {
            type: "button",
            class: "ss-step" + (s.id === cur ? " is-current" : "") + (done ? " is-done" : "") + (reachable ? "" : " is-locked"),
            "aria-current": s.id === cur ? "step" : null,
            "aria-label": i + 1 + "단계 " + s.label + (done ? " (완료)" : "") + (reachable ? "" : " (잠김)"),
            onclick: function () {
              api.go(s.id);
            },
          },
          [SciSim.el("span", { class: "ss-step-num", text: done ? "✓" : String(i + 1) }), SciSim.el("span", { class: "ss-step-label", text: s.label })]
        );
        list.appendChild(SciSim.el("li", null, [btn]));
      });
      document.querySelectorAll("[data-stage]").forEach(function (sec) {
        sec.hidden = sec.getAttribute("data-stage") !== cur;
      });
    }

    var waiting = false; /* beforeLeave 응답을 기다리는 중(두 번 눌러도 한 번만) */

    var api = {
      current: function () {
        return cur;
      },
      go: function (id, goOpts) {
        if (indexOf(id) < 0) return false;
        if (waiting) {
          // 답을 확인하는 중이거나 안내 카드가 떠 있다 → 버튼이 고장 난 것처럼 보이지 않게 까닭을 알려 준다
          if (opts.onBlocked) opts.onBlocked(opts.waitingMessage || "지금 적은 답을 확인하고 있어요. 화면의 안내를 먼저 살펴봐 주세요.");
          return false;
        }
        if (indexOf(id) > indexOf(cur)) {
          var c = check(id);
          if (!c.ok) {
            if (opts.onBlocked) opts.onBlocked(c.message);
            return false;
          }
          if (opts.beforeLeave && !(goOpts && goOpts.silent)) {
            var r;
            try {
              r = opts.beforeLeave(id, cur);
            } catch (e) {
              r = true; /* 확인 자체가 실패하면 막지 않는다 */
            }
            if (r && typeof r.then === "function") {
              waiting = true;
              r.then(
                function (okv) {
                  waiting = false;
                  if (okv !== false) move(id);
                },
                function () {
                  waiting = false;
                  move(id); /* 확인하지 못했으면 막지 않는다 */
                }
              );
              return false;
            }
            if (r === false) return false;
          }
        }
        return move(id);
      },
      next: function () {
        var i = indexOf(cur);
        return i < stages.length - 1 ? api.go(stages[i + 1].id) : false;
      },
      prev: function () {
        var i = indexOf(cur);
        return i > 0 ? api.go(stages[i - 1].id) : false;
      },
      refresh: render,
    };

    function move(id) {
      var changed = id !== cur;
      cur = id;
      render();
      if (changed) {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e) {
          window.scrollTo(0, 0);
        }
      }
      if (opts.onChange) opts.onChange(cur);
      return true;
    }
    render();
    return api;
  };
})();
