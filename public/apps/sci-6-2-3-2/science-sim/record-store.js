/*
 * science-sim/record-store.js — 기록 버튼으로 모은 측정 기록 관리 (정본: scripts/templates/science-sim/)
 *
 * ▶ 한 조건에 기록 하나(색 관찰형): 같은 칸(keyOf가 같은 기록)을 다시 기록하면 마지막 기록으로 덮어쓴다.
 *   var records = SciSim.RecordStore(store, {
 *     key: "records",                                            // localStorage 키(접두사 뒤)
 *     keyOf: function (r) { return r.solution + "|" + r.indicator; },
 *     onChange: function (list) { ... },                         // 선택
 *   });
 *   records.upsert({ phase: "A", solution: "식초", indicator: "리트머스파랑", result: "…" }); // recordedAt 자동
 *
 * ▶ 같은 조건 여러 번 측정(수치 측정형): 기록에 trial(1, 2, 3…)을 넣으면 회차마다 따로 저장된다.
 *   records.upsert({ object: "장난감 자동차", distance: 1, time: 2.4, trial: records.nextTrial("장난감 자동차", 3) });
 *   records.trials("장난감 자동차")        → 그 조건의 기록 배열(회차 순)
 *   records.countOf("장난감 자동차")       → 그 조건의 기록 수
 *   records.mean("장난감 자동차", "time")  → 평균(기록 없으면 null)
 *   records.nextTrial(baseKey, max)       → 다음에 쓸 회차 번호(모두 찼으면 가장 오래전에 잰 회차를 다시 쓴다)
 *
 * ▶ 공통
 *   records.list()                → 기록 배열(복사본)
 *   records.get(key) / has(key)   → key는 keyOf(r) (회차가 있으면 가장 최근 회차)
 *   records.count(filterFn)       → 개수(진행률 계산용)
 *   records.clear()
 *   SciSim.RecordStore.mean([1, 2, 3])            → 2
 *   SciSim.RecordStore.round(3.14159, 2)          → 3.14
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});

  function mean(values) {
    var v = (values || []).filter(function (x) {
      return typeof x === "number" && isFinite(x);
    });
    if (!v.length) return null;
    return (
      v.reduce(function (a, b) {
        return a + b;
      }, 0) / v.length
    );
  }
  function round(x, digits) {
    if (typeof x !== "number" || !isFinite(x)) return x;
    var p = Math.pow(10, digits == null ? 2 : digits);
    return Math.round(x * p) / p;
  }

  SciSim.RecordStore = function (store, opts) {
    var key = opts.key || "records";
    var keyOf = opts.keyOf;
    var list = store.get(key, []);
    if (!Array.isArray(list)) list = [];

    function fullKey(r) {
      return keyOf(r) + (r.trial != null ? "#" + r.trial : "");
    }
    function persist() {
      store.set(key, list);
      if (opts.onChange) opts.onChange(list.slice());
    }
    function findFull(fk) {
      for (var i = 0; i < list.length; i++) if (fullKey(list[i]) === fk) return i;
      return -1;
    }
    function trials(base) {
      return list
        .filter(function (r) {
          return keyOf(r) === base;
        })
        .sort(function (a, b) {
          return (a.trial || 0) - (b.trial || 0);
        });
    }

    return {
      list: function () {
        return list.slice();
      },
      get: function (k) {
        var t = trials(k);
        if (!t.length) return null;
        return t.reduce(function (a, b) {
          return (b.recordedAt || 0) >= (a.recordedAt || 0) ? b : a;
        });
      },
      has: function (k) {
        return trials(k).length > 0;
      },
      trials: trials,
      countOf: function (k) {
        return trials(k).length;
      },
      mean: function (k, field) {
        return mean(
          trials(k).map(function (r) {
            return r[field];
          })
        );
      },
      nextTrial: function (k, max) {
        var t = trials(k);
        max = max || Infinity;
        for (var n = 1; n <= Math.min(max, t.length + 1); n++) {
          if (
            !t.some(function (r) {
              return r.trial === n;
            })
          )
            return n;
        }
        // 모두 찼으면 가장 오래전에 잰 회차를 다시 쓴다
        var oldest = t.reduce(function (a, b) {
          return (b.recordedAt || 0) < (a.recordedAt || 0) ? b : a;
        });
        return oldest.trial;
      },
      upsert: function (rec) {
        var r = Object.assign({}, rec, { recordedAt: Date.now() });
        var i = findFull(fullKey(r));
        if (i >= 0) list[i] = r;
        else list.push(r);
        persist();
        return { replaced: i >= 0, record: r };
      },
      count: function (filter) {
        return filter ? list.filter(filter).length : list.length;
      },
      clear: function () {
        list = [];
        persist();
      },
    };
  };
  SciSim.RecordStore.mean = mean;
  SciSim.RecordStore.round = round;
})();
