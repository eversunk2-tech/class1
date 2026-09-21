/*
 * science-guide/persist.js — localStorage 임시 저장 공통 유틸 (정본: scripts/templates/science-guide/, science-sim에서 복사)
 * 모든 접근은 try/catch로 감싼다(사생활 보호 모드·저장 공간 부족·차단 시에도 앱이 멈추지 않게).
 *
 *   var store = SciSim.createStore("sci611sim2:v1");
 *   store.get("predict", {});      // 없거나 읽기 실패 → 기본값
 *   store.set("predict", { q1: "..." });
 *   store.remove("predict");
 *   store.clearAll();               // 이 접두사로 시작하는 키만 지운다
 *   store.available                 // localStorage를 쓸 수 있는지(false면 새로고침 시 사라진다는 안내에 사용)
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});

  function testStorage() {
    try {
      var k = "__scisim_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  SciSim.createStore = function (prefix) {
    if (!prefix || typeof prefix !== "string") throw new Error("[science-sim] storageKey가 필요합니다.");
    var memory = {}; // localStorage를 못 쓸 때의 대체(이번 화면에서만 유지)
    var ok = testStorage();

    function full(key) {
      return prefix + ":" + key;
    }

    return {
      available: ok,
      get: function (key, def) {
        var raw = null;
        try {
          raw = ok ? window.localStorage.getItem(full(key)) : memory[full(key)] || null;
        } catch (e) {
          raw = null;
        }
        if (raw == null) return def;
        try {
          return JSON.parse(raw);
        } catch (e) {
          return def;
        }
      },
      set: function (key, value) {
        var raw;
        try {
          raw = JSON.stringify(value);
        } catch (e) {
          return false;
        }
        memory[full(key)] = raw;
        if (!ok) return false;
        try {
          window.localStorage.setItem(full(key), raw);
          return true;
        } catch (e) {
          return false;
        }
      },
      remove: function (key) {
        delete memory[full(key)];
        try {
          if (ok) window.localStorage.removeItem(full(key));
        } catch (e) {
          /* 무시 */
        }
      },
      clearAll: function () {
        Object.keys(memory).forEach(function (k) {
          if (k.indexOf(prefix + ":") === 0) delete memory[k];
        });
        if (!ok) return;
        try {
          var keys = [];
          for (var i = 0; i < window.localStorage.length; i++) {
            var k = window.localStorage.key(i);
            if (k && k.indexOf(prefix + ":") === 0) keys.push(k);
          }
          keys.forEach(function (k) {
            window.localStorage.removeItem(k);
          });
        } catch (e) {
          /* 무시 */
        }
      },
    };
  };

  /* 작은 DOM 도우미(다른 science-sim 파일이 함께 쓴다) */
  SciSim.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  /* "**굵게**" 표시만 지원하는 안전한 글 → DOM(innerHTML을 쓰지 않는다)
   *   SciSim.rich("지시약은 **색깔**이 변해요") → <span>지시약은 <strong>색깔</strong>이 변해요</span> */
  SciSim.rich = function (text, tag) {
    var node = document.createElement(tag || "span");
    String(text == null ? "" : text)
      .split("**")
      .forEach(function (part, i) {
        if (!part) return;
        if (i % 2) {
          var b = document.createElement("strong");
          b.textContent = part;
          node.appendChild(b);
        } else node.appendChild(document.createTextNode(part));
      });
    return node;
  };

  /* 받침에 따라 조사 붙이기: SciSim.josa("식초", "을", "를") → "식초를"
   * 한글이 아닌 글자(A, B 등)로 끝나면 받침 없는 쪽을 쓴다("실험 A를"). */
  SciSim.josa = function (word, a, b) {
    word = String(word);
    var ch = word.charCodeAt(word.length - 1);
    if (ch < 0xac00 || ch > 0xd7a3) return word + b;
    return word + ((ch - 0xac00) % 28 ? a : b);
  };

  /* 입력이 멈춘 뒤 저장(너무 자주 쓰지 않게) */
  SciSim.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(self, args);
      }, ms || 300);
    };
  };
})();
