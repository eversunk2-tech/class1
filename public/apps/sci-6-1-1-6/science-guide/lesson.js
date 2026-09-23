/*
 * science-guide/lesson.js — 차시 앱의 뼈대(알림, 학습 시간, 단계 이동, 마치기·결과 저장, 처음부터 다시) (정본: scripts/templates/science-guide/)
 * science-sim/lesson.js를 복사해 **문구 바꾸기(texts)만 더했다**(나머지는 같다). 조사 앱에는 "실험" 대신 "조사"라는 말이 나와야 해서다.
 * 모든 차시 앱이 똑같이 반복하던 코드를 모았다. 차시 앱은 단계별 "다 했는지"와 "저장할 detail"만 알려 주면 된다.
 *
 *   var lesson = SciSim.Lesson.create({ appId: C.appId, store: store, toastEl: document.getElementById("toast"),
 *     texts: { doneTitle, doneNote, restartConfirm, tooLong } });   // 선택: 화면 문구 바꾸기(기본값은 조사 앱 문구, 아래 T 참고)
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
 *     // '학습 마치기'를 누르면 canFinish 뒤에 답을 한 번 더 본다(answer-check.js가 있을 때):
 *     //   ① 정리하기 답이 block이면 마치지 못한다(정리하기 화면에서 카드로 까닭을 알려 준다).
 *     //   ② '더 탐구하고 싶은 점'(#ss-curiosity)은 **비워 두면 마치지 못한다**. 내용은 느슨하게만 본다
 *     //      (무의미·완전히 딴 이야기만 막고, 아쉽다는 이유로는 되짚지 않는다).
 *     // 버튼 위에는 "'학습 마치기'를 눌러야 선생님에게 제출돼요" 안내가 늘 보이고, 마친 뒤에는 제출 상태로 바뀐다.
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
      var T = Object.assign(
        {
          doneTitle: "🎉 수고했어요! 오늘의 조사 학습을 마쳤어요.",
          doneNote: "앞 단계로 돌아가 조사 기록을 고치거나 다시 봐도 좋아요.",
          restartConfirm: "처음부터 다시 할까요? 적은 내용과 조사 기록이 모두 지워져요.",
          tooLong: "적은 글이 너무 길어서 저장하지 못했어요. 긴 글을 조금 줄인 뒤 다시 '학습 마치기'를 눌러 주세요.",
        },
        o.texts || {}
      );
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
        console.warn("[science-guide] 결과 저장 기능을 준비하지 못했습니다(학습은 계속할 수 있어요).", e);
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
          var gating = false; /* 마치기 전 답 검사 중 */
          var loginChecked = false;

          /* ── "제출" 안내: 버튼 바로 위에 늘 보인다(색만이 아니라 글자로도 구분된다) ── */
          var noteTag = el("span", { class: "ss-submit-note-tag" });
          var noteText = el("span", { class: "ss-submit-note-text" });
          var submitNote = el("p", { class: "ss-submit-note", role: "note" }, [noteTag, noteText]);
          if (f.button.parentNode) f.button.parentNode.insertBefore(submitNote, f.button);
          /** kind: "todo"(아직 안 냄) | "done"(제출함) | "warn"(마쳤지만 저장되지 않음) */
          function setNote(kind) {
            submitNote.classList.toggle("is-done", kind === "done");
            submitNote.classList.toggle("is-warn", kind === "warn");
            if (kind === "done") {
              noteTag.textContent = "제출 완료";
              noteText.textContent = "✅ 선생님에게 제출했어요. 고친 내용이 있으면 다시 눌러 주세요.";
            } else if (kind === "warn") {
              noteTag.textContent = "제출 안 됨";
              noteText.textContent = "⚠️ 아직 선생님에게 제출되지 않았어요. 아래 안내를 읽고 다시 눌러 주세요.";
            } else {
              noteTag.textContent = "제출";
              noteText.textContent = "'🎉 학습 마치기'를 눌러야 선생님에게 제출돼요.";
            }
          }
          setNote("todo");

          /* ── '더 탐구하고 싶은 점'(#ss-curiosity)은 이제 필수 ──
           * 앱 파일을 고치지 않고 화면 문구만 다듬는다(저장 구조·질문 내용은 그대로). */
          var OPTIONAL_RE = /\s*[(（]\s*(?:선택|비워\s*두어도[^)）]*|비워도[^)）]*|안\s*적어도[^)）]*)\s*[)）]\s*/g;
          var curEl = document.getElementById("ss-curiosity");
          var curHost = null;
          function curiosityLabel() {
            try {
              return document.querySelector('label[for="ss-curiosity"]');
            } catch (e) {
              return null;
            }
          }
          function curiosityQuestion() {
            var label = curiosityLabel();
            var q = "";
            if (label) {
              var clone = label.cloneNode(true);
              var tag = clone.querySelector(".ss-q-num");
              if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
              q = (clone.textContent || "").replace(/\s+/g, " ").trim();
            }
            return q || "더 탐구하고 싶은 점(또는 궁금한 점)을 적어 보세요.";
          }
          if (curEl) {
            curHost = el("div", { class: "ss-ac-host" });
            if (curEl.parentNode) curEl.parentNode.insertBefore(curHost, curEl.nextSibling);
            var curLabel = curiosityLabel();
            if (curLabel) {
              var curTag = curLabel.querySelector(".ss-q-num");
              if (curTag && /선택/.test(curTag.textContent || "")) curTag.textContent = "궁금한 점";
              for (var ci = 0; ci < curLabel.childNodes.length; ci++) {
                var cn = curLabel.childNodes[ci];
                if (cn.nodeType !== 3) continue;
                var tidy = cn.nodeValue.replace(OPTIONAL_RE, " ").replace(/\s+/g, " ").trim();
                if (tidy !== cn.nodeValue) cn.nodeValue = tidy;
              }
            }
            if (curEl.parentNode) curEl.parentNode.insertBefore(el("p", { class: "ss-help ss-req-note", text: "한 줄이라도 적어야 '학습 마치기'를 할 수 있어요." }), curHost);
          }

          function goStage(id) {
            if (navApi && id && navApi.current() !== id) navApi.go(id, { silent: true });
          }
          /** 궁금한 점: 비어 있으면 막고, 내용은 느슨하게만 본다(무의미·완전히 딴 이야기만). → Promise<bool> */
          function checkCuriosity() {
            if (!curEl) return Promise.resolve(true);
            var t = (curEl.value || "").trim();
            if (!t) {
              f.msgEl.textContent = "'더 탐구하고 싶은 점'을 한 줄이라도 적어야 마칠 수 있어요.";
              try {
                curEl.focus();
                curEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
              } catch (e) {
                /* 무시 */
              }
              return Promise.resolve(false);
            }
            var AC = SciSim.AnswerCheck;
            if (!AC || !AC.verify) return Promise.resolve(true);
            var q = curiosityQuestion();
            if (AC.settled && AC.settled("curiosity", t, q, { stage: "curiosity" })) return Promise.resolve(true);
            return AC.verify({ key: "curiosity", stage: "curiosity", question: q, answer: t, mount: curHost, focus: curEl });
          }
          /** 정리하기 답 → 궁금한 점 차례로 본다. → Promise<bool> */
          function checkAnswers() {
            var AC = SciSim.AnswerCheck;
            var first = AC && AC.checkFinish ? AC.checkFinish({ goTo: goStage }) : true;
            return Promise.resolve(first).then(function (okv) {
              return okv === false ? false : checkCuriosity();
            });
          }

          function drawDone(saveText) {
            var card = f.doneEl;
            card.textContent = "";
            card.appendChild(el("h3", { text: f.doneTitle || T.doneTitle }));
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
            card.appendChild(el("p", { class: "ss-help", text: T.doneNote }));
            card.hidden = false;
          }
          function failText(res) {
            if (res.reason === "not_logged_in") {
              if (f.loginHintEl) window.Class1Record.renderLoginHint(f.loginHintEl, "로그인한 뒤 다시 '학습 마치기'를 누르면 저장돼요.");
              return res.message && res.message.indexOf("만료") >= 0 ? res.message : "로그인하지 않아서 결과는 저장되지 않았어요.";
            }
            if (res.reason === "invalid") return T.tooLong;
            if (res.reason === "user_changed") return "다른 사람으로 로그인되어 있어서 저장하지 않았어요. 화면을 새로 불러와 주세요.";
            if (res.reason === "not_initialized") return "결과 저장 기능을 불러오지 못해 저장하지 않았어요. 학습은 모두 마쳤어요.";
            return "인터넷 연결 문제 등으로 결과를 저장하지 못했어요. 잠시 뒤 다시 '학습 마치기'를 눌러 주세요.";
          }
          f.button.addEventListener("click", function () {
            if (saving || gating) return;
            var ok = f.canFinish ? f.canFinish() : true;
            if (ok !== true) {
              f.msgEl.textContent = typeof ok === "string" ? ok : "앞의 활동을 먼저 마쳐 주세요.";
              return;
            }
            /* 답을 한 번 더 보고 나서 마친다. 막히면 카드가 뜬 단계에 그대로 둔다(학생이 고쳐 쓰고 다시 누를 수 있다). */
            var back = navApi ? navApi.current() : null;
            gating = true;
            f.button.disabled = true;
            f.msgEl.textContent = "";
            var after = function (okv) {
              gating = false;
              f.button.disabled = false;
              if (okv === false) return;
              if (back) goStage(back);
              doFinish();
            };
            try {
              checkAnswers().then(after, function () {
                after(true); /* 검사 자체가 실패하면 막지 않는다 */
              });
            } catch (e) {
              after(true);
            }
          });

          function doFinish() {
            meta.finishedAt = Date.now();
            store.set("meta", meta);
            refresh();
            if (!recordReady) {
              f.msgEl.textContent = "";
              setNote("warn");
              drawDone("결과 저장 기능을 불러오지 못해 저장하지 않았어요. 학습은 모두 마쳤어요.");
              return;
            }
            // 체험 모드(비로그인 + 사이트 잠금 꺼짐): 서버에 아무것도 보내지 않는다(persist.js 맨 위 주석 ⑦).
            if (SciSim.Sync && SciSim.Sync.isTrial && SciSim.Sync.isTrial()) {
              f.msgEl.textContent = "";
              setNote("warn");
              if (f.loginHintEl) window.Class1Record.renderLoginHint(f.loginHintEl, "로그인한 뒤 다시 '학습 마치기'를 누르면 결과가 저장돼요.");
              drawDone("체험 모드라서 결과는 저장되지 않았어요. 로그인하면 기록이 남아요.");
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
                setNote(res.ok ? "done" : "warn");
                f.msgEl.textContent = "";
                drawDone(text);
              })
              .catch(function () {
                f.msgEl.textContent = "";
                setNote("warn");
                drawDone("인터넷 연결 문제 등으로 결과를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
              })
              .then(function () {
                saving = false;
                f.button.disabled = false;
                f.button.textContent = "🎉 학습 마치기 (다시 저장)";
              });
          }
          api.onStage(function (id) {
            if (id !== (f.stage || "curiosity")) return;
            if (meta.finishedAt) setNote(meta.savedAt ? "done" : "warn");
            if (meta.finishedAt && f.doneEl.hidden) drawDone(meta.savedAt ? "✅ 결과를 저장했어요." : "");
            if (!loginChecked && recordReady && f.loginHintEl) {
              loginChecked = true;
              var trial = SciSim.Sync && SciSim.Sync.isTrial && SciSim.Sync.isTrial();
              window.Class1Record.getUser().then(function (u) {
                if (u) return;
                window.Class1Record.renderLoginHint(
                  f.loginHintEl,
                  trial ? "지금은 체험 모드예요. 로그인하면 결과가 저장돼요." : "로그인이 풀렸어요. 다시 로그인하면 이어서 하고 결과도 저장돼요."
                );
              });
            }
          });
        },
        restart: function (button) {
          button.addEventListener("click", function () {
            if (!window.confirm(T.restartConfirm)) return;
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
