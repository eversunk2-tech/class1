import type { Answer, Detail, ItemSpec } from "./types";

/**
 * 앱별 응답 매핑을 짧게 쓰기 위한 도우미.
 * 모든 read 함수는 detail이 예상과 다르게 생겨도(오래된 버전 · 잘린 값 · 조작된 값) 예외 없이 null 또는 raw로 돌려준다.
 */

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** "a.b.c" 경로로 값 꺼내기(없으면 undefined) */
export function getPath(d: unknown, path: string): unknown {
  let cur: unknown = d;
  for (const part of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** detail에 이 최상위 키가 있는지 */
export function has(d: Detail, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(d, key);
}

const numberFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

/** 표 셀 · 짧은 값 표시용 문자열 */
export function cell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? numberFormatter.format(v) : "—";
  if (typeof v === "boolean") return v ? "예" : "아니요";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : cell(x))).join(", ");
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** 소수 첫째 자리 숫자 */
export function fixed1(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n.toFixed(1) : cell(v);
}

type Base = { label?: string; note?: string };

function base(stage: string, id: string, question: string, path: string, opts?: Base) {
  return { stage, id, question, label: opts?.label, note: opts?.note, uses: [path.split(".")[0]] };
}

/** 서술형 답(문자열) */
export function textItem(stage: string, id: string, path: string, question: string, opts?: Base): ItemSpec {
  return {
    ...base(stage, id, question, path, opts),
    read: (d) => {
      const v = getPath(d, path);
      if (v === undefined || v === null) return null;
      if (typeof v === "string") return { kind: "text", text: v };
      if (typeof v === "number" || typeof v === "boolean") return { kind: "value", text: cell(v) };
      return { kind: "raw", value: v };
    },
  };
}

/** 보기 고르기 퀴즈 결과 { choice: [라벨 또는 id], correct, tries } */
export function choiceItem(
  stage: string,
  id: string,
  path: string,
  question: string,
  opts?: Base & {
    /** 보기 전체(라벨) */
    options?: string[];
    /** choice가 보기 id로 저장된 앱이면 id → 라벨 */
    resolve?: Record<string, string>;
  },
): ItemSpec {
  return {
    ...base(stage, id, question, path, opts),
    read: (d) => {
      const v = getPath(d, path);
      if (v === undefined || v === null) return null;
      if (!isObj(v) || !Array.isArray(v.choice)) return { kind: "raw", value: v };
      const chosen = v.choice.map((c) => {
        const s = typeof c === "string" ? c : cell(c);
        return opts?.resolve?.[s] ?? s;
      });
      return {
        kind: "choice",
        chosen,
        correct: typeof v.correct === "boolean" ? v.correct : null,
        tries: typeof v.tries === "number" ? v.tries : null,
        options: opts?.options,
      };
    },
  };
}

export type Column = {
  key: string;
  label: string;
  /** 저장값 → 표시값(예: 원본 id → 이름) */
  map?: Record<string, string>;
  format?: (v: unknown, row: Record<string, unknown>) => string;
};

function toRow(obj: unknown, columns: Column[]): Record<string, string> {
  const o = isObj(obj) ? obj : {};
  const row: Record<string, string> = {};
  for (const c of columns) {
    const raw = o[c.key];
    if (c.format) row[c.key] = c.format(raw, o);
    else if (c.map && typeof raw === "string" && c.map[raw]) row[c.key] = c.map[raw];
    else row[c.key] = cell(raw);
  }
  return row;
}

/** 객체 배열(기록 표 · 조사 정리 틀). 객체 하나(줄 1개 고정 틀)도 한 줄 표로 보여 준다. */
export function tableItem(stage: string, id: string, path: string, question: string, columns: Column[], opts?: Base): ItemSpec {
  return {
    ...base(stage, id, question, path, opts),
    read: (d) => {
      const v = getPath(d, path);
      if (v === undefined || v === null) return null;
      const list = Array.isArray(v) ? v : isObj(v) ? [v] : null;
      if (!list) return { kind: "raw", value: v };
      return { kind: "table", columns: columns.map(({ key, label }) => ({ key, label })), rows: list.map((r) => toRow(r, columns)) };
    },
  };
}

/** 키 자체가 데이터인 객체(예: { "제비꽃→유채꽃": 12 })를 2열 표로 */
export function entriesItem(
  stage: string,
  id: string,
  path: string,
  question: string,
  labels: { key: string; value: string; format?: (v: unknown) => string },
  opts?: Base,
): ItemSpec {
  return {
    ...base(stage, id, question, path, opts),
    read: (d) => {
      const v = getPath(d, path);
      if (v === undefined || v === null) return null;
      if (!isObj(v)) return { kind: "raw", value: v };
      return {
        kind: "table",
        columns: [
          { key: "k", label: labels.key },
          { key: "v", label: labels.value },
        ],
        rows: Object.entries(v).map(([k, x]) => ({ k, v: labels.format ? labels.format(x) : cell(x) })),
      };
    },
  };
}

/** 분류하기 결과 { groups: { binId: [항목…] }, correct, tries } */
export function groupsItem(
  stage: string,
  id: string,
  path: string,
  question: string,
  bins: { id: string; label: string }[],
  opts?: Base & { itemLabels?: Record<string, string> },
): ItemSpec {
  return {
    ...base(stage, id, question, path, opts),
    read: (d) => {
      const v = getPath(d, path);
      if (v === undefined || v === null) return null;
      if (!isObj(v) || !isObj(v.groups)) return { kind: "raw", value: v };
      const g = v.groups;
      const known = new Set(bins.map((b) => b.id));
      const list = [
        ...bins.map((b) => ({ id: b.id, label: b.label })),
        ...Object.keys(g)
          .filter((k) => !known.has(k))
          .map((k) => ({ id: k, label: k })),
      ];
      return {
        kind: "groups",
        groups: list.map((b) => {
          const items = g[b.id];
          return {
            label: b.label,
            items: Array.isArray(items) ? items.map((x) => (typeof x === "string" ? (opts?.itemLabels?.[x] ?? x) : cell(x))) : [],
          };
        }),
        correct: typeof v.correct === "boolean" ? v.correct : null,
        tries: typeof v.tries === "number" ? v.tries : null,
      };
    },
  };
}

/** 짧은 값(숫자 · 예/아니요 · 개수) */
export function valueItem(
  stage: string,
  id: string,
  path: string,
  question: string,
  format?: (v: unknown) => string | null,
  opts?: Base,
): ItemSpec {
  return {
    ...base(stage, id, question, path, opts),
    read: (d) => {
      const v = getPath(d, path);
      if (v === undefined || v === null) return null;
      const text = format ? format(v) : cell(v);
      return text == null ? null : ({ kind: "value", text } satisfies Answer);
    },
  };
}

/** 여러 경로를 읽어 직접 만드는 항목(앱 전용 필드용) */
export function customItem(
  stage: string,
  id: string,
  question: string,
  uses: string[],
  read: (d: Detail) => Answer | null,
  opts?: Base,
): ItemSpec {
  return { stage, id, question, label: opts?.label, note: opts?.note, uses, read };
}

/** 열어 본 힌트 수 */
export function hintsText(v: unknown): string | null {
  return typeof v === "number" ? `${v}개` : null;
}

/** true/false → 예/아니요 */
export function yesNo(v: unknown): string | null {
  return typeof v === "boolean" ? (v ? "예" : "아니요") : null;
}

/** config의 보기 배열 → 라벨 목록 */
export function labels(options: { label: string }[]): string[] {
  return options.map((o) => o.label);
}
