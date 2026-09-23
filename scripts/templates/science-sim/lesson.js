/*
 * science-sim/lesson.js — 차시 앱의 뼈대(알림, 학습 시간, 단계 이동, 마치기·결과 저장, 처음부터 다시) (정본: scripts/templates/science-sim/)
 * 모든 차시 앱이 똑같이 반복하던 코드를 모았다. 차시 앱은 단계별 "다 했는지"와 "저장할 detail"만 알려 주면 된다.
 *
 *   var lesson = SciSim.Lesson.create({ appId: C.appId, store: store, toastEl: document.getElementById("toast") });
 *   lesson.toast("메시지", 3000);
 *   lesson.activeSec()                          → 화면을 보고 있던 시간(초)
 *   lesson.nav({
 *     el: document.getElementById("stage-nav"), stages: C.stages,
 *     prevBtn, nextBtn,                         // 아래쪽 이전/다음 버튼
 *     gates: { experiment: function () { return true | "막는 까닭"; }, … },   // 그 단계로 들어가는 조건
 *     done:  { predict: function () { return bool; }, … },                  // 단계 완료 표시
 *     onEnter: { experiment: function () {}, … },                           // 그 단계를 열 때
 *   });                                         → StageNav(api). 새로고침하면 들어갈 수 있는 곳까지 복원한다.
 *   lesson.finish({
 *     button, msgEl, loginHintEl, doneEl,       // index.html의 요소
 *     canFinish: function () { return true | "먼저 할 일"; },
 *     detail: function () { return {...}; },    // class1-record.js로 저장할 detail
 *     summary: function () { return ["기록한 실험: 24칸", …]; },
 *   });
 *   lesson.restart(button)                      → "처음부터 다시 하기"(이 앱의 로컬 기록 + DB 진행 상황(app_progress)을 지운다)
 *   로그인 필수·진행 상황 DB 저장은 Lesson.create가 SciSim.Sync.start()로 켠다(persist.js 맨 위 주석).
 *   lesson.meta                                 → { startedAt, activeSec, finishedAt, savedAt }
 *
 * 저장 실패 문구는 까닭(reason)에 따라 다르게 보여 준다: 로그인 안 함 / 적은 글이 너무 김(invalid) / 네트워크 등.
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});
  var el = SciSim.el;

  SciSim.Lesson = {
    create: function (o) {
      var store = o.store;
      var toastTimer = null;
      function toast(msg, ms) {
        var t = o.toastEl;
        if (!t) return;
        t.textContent = msg;
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
          t.hidden = true;
        }, ms || 2600);
      }

      /* 고정 머리말 높이 → CSS 변수(--ss-header-h). 가로 화면에서 실험 화면이 머리말 아래에 붙어 있게 한다. */
      var header = document.querySelector(".ss-header");
      if (header) {
        var setH = function () {
          document.documentElement.style.setProperty("--ss-header-h", Math.round(header.getBoundingClientRect().height) + "px");
        };
        setH();
        if ("ResizeObserver" in window) new ResizeObserver(setH).observe(header);
      }
      /* 아래쪽 이동 막대 높이 → CSS 변수(--ss-footer-h). 본문 아래 여백·scroll-margin에 쓴다(버튼이 막대에 가리지 않게). */
      var footerNav = document.querySelector(".ss-footer-nav");
      if (footerNav) {
        var setF = function () {
          document.documentElement.style.setProperty("--ss-footer-h", Math.round(footerNav.getBoundingClientRect().height) + "px");
        };
        setF();
        if ("ResizeObserver" in window) new ResizeObserver(setF).observe(footerNav);
      }

      /* 답 되짚기·차단(answer-check.js를 불러온 앱에서만). 앱 코드는 바꿀 필요가 없다. */
      if (SciSim.AnswerCheck) SciSim.AnswerCheck.configure({ appId: o.appId, store: store });

      /* 학습 시간(화면을 보고 있는 동안만 셈) */
      var meta = store.get("meta", null);
      if (!meta || typeof meta !== "object") meta = { startedAt: Date.now(), activeSec: 0, finishedAt: null, savedAt: null };
      store.set("meta", meta);
      var resetting = false;
      setInterval(function () {
        if (document.hidden || resetting) return;
        meta.activeSec = (meta.activeSec || 0) + 1;
        if (meta.activeSec % 10 === 0) store.set("meta", meta);
      }, 1000);
      window.addEventListener("pagehide", function () {
        if (!resetting) store.set("meta", meta);
      });

      /* 결과 저장 준비(class1-record.js) */
      var recordReady = false;
      try {
        if (window.Class1Record && window.CLASS1_CONFIG) {
          window.Class1Record.init({ url: window.CLASS1_CONFIG.SUPABASE_URL, anonKey: window.CLASS1_CONFIG.SUPABASE_ANON_KEY, appId: o.appId });
          recordReady = true;
        }
      } catch (e) {
        console.warn("[science-sim] 결과 저장 기능을 준비하지 못했습니다(학습은 계속할 수 있어요).", e);
      }
      /* 로그인 필수 · 진행 상황 DB 동기화 시작(persist.js의 SciSim.Sync). 비로그인이면 이미 로그인 안내가 떠 있다. */
      if (SciSim.Sync) SciSim.Sync.start({ recordReady: recordReady, appId: o.appId });

      var navApi = null;
      var navOpts = null;
      var hooks = [];
      function refresh() {
        if (!navApi) return;
        navApi.refresh();
        var ids = navOpts.stages.map(function (s) {
          return s.id;
        });
        var i = ids.indexOf(navApi.current());
        if (navOpts.prevBtn) navOpts.prevBtn.disabled = i <= 0;
        if (navOpts.nextBtn) navOpts.nextBtn.hidden = i >= ids.length - 1;
      }

      var api = {
        meta: meta,
        store: store,
        toast: toast,
        recordReady: function () {
          return recordReady;
        },
        activeSec: function () {
          return meta.activeSec || 0;
        },
        refresh: refresh,
        nav: function (n) {
          navOpts = n;
          var gates = n.gates || {};
          var done = n.done || {};
          var onEnter = n.onEnter || {};
          function canEnter(id) {
            return gates[id] ? gates[id]() : true;
          }
          navApi = SciSim.StageNav({
            el: n.el,
            stages: n.stages,
            current: store.get("step", n.stages[0].id),
            canEnter: canEnter,
            isDone: function (id) {
              return done[id] ? !!done[id]() : false;
            },
            onBlocked: function (m) {
              toast(m, 3400);
            },
            /* 다음 단계로 넘어가기 직전에 지금 화면의 답을 한 번 살펴본다(answer-check.js가 없으면 늘 통과). */
            beforeLeave: function (targetId, fromId) {
              return SciSim.AnswerCheck ? SciSim.AnswerCheck.checkStage(fromId) : true;
            },
            onChange: function (id) {
              store.set("step", id);
              if (onEnter[id]) onEnter[id]();
              hooks.forEach(function (h) {
                h(id);
              });
              refresh();
            },
          });
          // 저장된 단계가 아직 들어갈 수 없는 단계면 들어갈 수 있는 곳까지 되돌린다
          var want = store.get("step", n.stages[0].id);
          var ids = n.stages.map(function (s) {
            return s.id;
          });
          var target = ids[0];
          for (var i = 1; i < ids.length && i <= ids.indexOf(want); i++) {
            if (canEnter(ids[i]) !== true) break;
            target = ids[i];
          }
          navApi.go(target, { silent: true }); // 복원 이동은 학생이 누른 것이 아니므로 답 확인을 건너뛴다
          if (n.prevBtn)
            n.prevBtn.addEventListener("click", function () {
              navApi.prev();
            });
          if (n.nextBtn)
            n.nextBtn.addEventListener("click", function () {
              navApi.next();
            });
          refresh();
          return navApi;
        },
        onStage: function (fn) {
          hooks.push(fn);
        },
        finish: function (f) {
          var saving = false;
          var loginChecked = false;
          function drawDone(saveText) {
            var card = f.doneEl;
            card.textContent = "";
            card.appendChild(el("h3", { text: f.doneTitle || "🎉 수고했어요! 오늘의 실험 학습을 마쳤어요." }));
            var lines = (f.summary ? f.summary() : []).concat(["학습한 시간: 약 " + Math.max(1, Math.round((meta.activeSec || 0) / 60)) + "분"]);
            card.appendChild(
              el(
                "ul",
                null,
                lines.map(function (l) {
                  return el("li", { text: l });
                })
              )
            );
            if (saveText) card.appendChild(el("p", { class: "ss-help", text: saveText }));
            card.appendChild(el("p", { class: "ss-help", text: "앞 단계로 돌아가 다시 보거나, 실험을 다시 해 봐도 좋아요." }));
            card.hidden = false;
          }
          function failText(res) {
            if (res.reason === "not_logged_in") {
              if (f.loginHintEl) window.Class1Record.renderLoginHint(f.loginHintEl, "로그인한 뒤 다시 '학습 마치기'를 누르면 저장돼요.");
              return res.message && res.message.indexOf("만료") >= 0 ? res.message : "로그인하지 않아서 결과는 저장되지 않았어요.";
            }
            if (res.reason === "invalid")
              return "적은 글이 너무 길어서 저장하지 못했어요. 예상·결론·궁금한 점 가운데 긴 글을 조금 줄인 뒤 다시 '학습 마치기'를 눌러 주세요.";
            if (res.reason === "user_changed") return "다른 사람으로 로그인되어 있어서 저장하지 않았어요. 화면을 새로 불러와 주세요.";
            if (res.reason === "not_initialized") return "결과 저장 기능을 불러오지 못해 저장하지 않았어요. 학습은 모두 마쳤어요.";
            return "인터넷 연결 문제 등으로 결과를 저장하지 못했어요. 잠시 뒤 다시 '학습 마치기'를 눌러 주세요.";
          }
          f.button.addEventListener("click", function () {
            if (saving) return;
            var ok = f.canFinish ? f.canFinish() : true;
            if (ok !== true) {
              f.msgEl.textContent = typeof ok === "string" ? ok : "앞의 활동을 먼저 마쳐 주세요.";
              return;
            }
            meta.finishedAt = Date.now();
            store.set("meta", meta);
            refresh();
            if (!recordReady) {
              f.msgEl.textContent = "";
              drawDone("결과 저장 기능을 불러오지 못해 저장하지 않았어요. 학습은 모두 마쳤어요.");
              return;
            }
            saving = true;
            f.button.disabled = true;
            f.msgEl.textContent = "결과를 저장하고 있어요…";
            window.Class1Record.save({
              completed: true,
              durationSec: meta.activeSec || 0,
              detail: f.detail(),
              // 이 화면의 기록 주인으로만 저장한다(다른 학생이 로그인해 있으면 저장하지 않음)
              expectedUserId: SciSim.Sync && SciSim.Sync.owner ? SciSim.Sync.owner() : undefined,
            })
              .then(function (res) {
                var text;
                if (res.ok) {
                  meta.savedAt = Date.now();
                  store.set("meta", meta);
                  text = "✅ 결과를 저장했어요! '내 학습 활동'에서 볼 수 있어요.";
                } else text = failText(res);
                f.msgEl.textContent = "";
                drawDone(text);
              })
              .catch(function () {
                f.msgEl.textContent = "";
                drawDone("인터넷 연결 문제 등으로 결과를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
              })
              .then(function () {
                saving = false;
                f.button.disabled = false;
                f.button.textContent = "🎉 학습 마치기 (다시 저장)";
              });
          });
          api.onStage(function (id) {
            if (id !== (f.stage || "curiosity")) return;
            if (meta.finishedAt && f.doneEl.hidden) drawDone(meta.savedAt ? "✅ 결과를 저장했어요." : "");
            if (!loginChecked && recordReady && f.loginHintEl) {
              loginChecked = true;
              window.Class1Record.getUser().then(function (u) {
                if (!u) window.Class1Record.renderLoginHint(f.loginHintEl, "로그인이 풀렸어요. 다시 로그인하면 이어서 하고 결과도 저장돼요.");
              });
            }
          });
        },
        restart: function (button) {
          button.addEventListener("click", function () {
            if (!window.confirm("처음부터 다시 할까요? 적은 내용과 실험 기록이 모두 지워져요.")) return;
            resetting = true;
            button.disabled = true;
            // 로컬 삭제 + DB 진행 상황 삭제(clearProgress). DB 삭제가 실패해도 다음에 열 때 다시 시도한다.
            var done = function () {
              location.reload();
            };
            if (SciSim.Sync) SciSim.Sync.reset(store).then(done, done);
            else {
              store.clearAll();
              done();
            }
          });
        },
      };
      return api;
    },
  };
})();
