import { getResponseSchema } from "@/data/app-responses";
import { cell, isObj } from "@/data/app-responses/helpers";
import type { Answer, Detail, ResponseItem, ResponseSchema, ResponseVariant } from "@/data/app-responses/types";

/**
 * 학생 응답 추출 (docs/admin/responses-spec.md §3.4, 표시 우선순위는 Build 지침):
 *   1) detail.qa(공통 틀이 만든 질문-답 표준 목록) → 2) 앱별 매핑(src/data/app-responses) → 3) 원본 JSON.
 * 결과의 모든 문자열은 학생 입력일 수 있다 — 화면은 텍스트 노드로만 그린다(innerHTML 금지).
 */

export type ResponseSource = "qa" | "mapping" | "raw";

export type ExtractedResponses = {
  source: ResponseSource;
  /** 매핑을 썼을 때 고른 버전 이름 */
  variantLabel?: string;
  items: ResponseItem[];
  /** 질문-답으로 정리하지 못한 최상위 값(원본 그대로) */
  extras: { key: string; value: unknown }[];
  notes: string[];
};

/** 단계 id → 이름(매핑에 없는 단계 · detail.qa용 기본값) */
export const DEFAULT_STAGE_LABELS: Record<string, string> = {
  predict: "예상하기",
  intro: "도입",
  experiment: "실험하기",
  analyze: "기록·분석하기",
  analysis: "기록·분석하기",
  research: "조사하기",
  worksheet: "조사하기",
  share: "발표 준비",
  quiz: "확인 문제",
  conclude: "정리하기",
  curiosity: "궁금한 점",
};

export function stageLabel(stage: string, schema: ResponseSchema | null): string {
  return schema?.stages.find((s) => s.id === stage)?.label ?? DEFAULT_STAGE_LABELS[stage] ?? stage;
}

function asDetail(details: unknown): Detail {
  return isObj(details) ? details : {};
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : cell(x))) : [];
}

/** detail.qa의 answer 하나를 화면용 Answer로(모양이 어긋나면 raw) */
function normalizeQaAnswer(kind: string, a: unknown, entry: Record<string, unknown>): Answer {
  if (kind === "text") {
    if (typeof a === "string") {
      return typeof entry.submitted === "boolean" ? { kind: "text", text: a, submitted: entry.submitted } : { kind: "text", text: a };
    }
  } else if (kind === "choice") {
    if (isObj(a) && (Array.isArray(a.chosen) || Array.isArray(a.choice))) {
      const tries = typeof a.tries === "number" ? a.tries : null;
      return {
        kind: "choice",
        chosen: strList(Array.isArray(a.chosen) ? a.chosen : a.choice),
        // 공통 틀 quiz.qa()는 '확인하기'를 한 번도 누르지 않은 문항도 correct:false로 저장한다(review L2).
        // 확인 0번이면 채점 전이므로 "오답"이 아니라 채점 없음(null)으로 본다.
        correct: typeof a.correct === "boolean" && !(a.correct === false && tries === 0) ? a.correct : null,
        tries,
        options: Array.isArray(entry.options) ? strList(entry.options) : undefined,
      };
    }
  } else if (kind === "table") {
    if (isObj(a) && Array.isArray(a.rows)) {
      const cols = Array.isArray(a.columns)
        ? a.columns.flatMap((c) => {
            if (isObj(c) && str(c.key) != null) return [{ key: String(c.key), label: str(c.label) ?? String(c.key) }];
            if (typeof c === "string") return [{ key: c, label: c }];
            return [];
          })
        : [];
      const columns = cols.length
        ? cols
        : [...new Set(a.rows.flatMap((r) => (isObj(r) ? Object.keys(r) : [])))].map((k) => ({ key: k, label: k }));
      return {
        kind: "table",
        columns,
        rows: a.rows.map((r) => {
          const o = isObj(r) ? r : {};
          return Object.fromEntries(columns.map((c) => [c.key, cell(o[c.key])]));
        }),
      };
    }
  } else if (kind === "groups") {
    if (isObj(a) && (Array.isArray(a.groups) || isObj(a.groups))) {
      const groups = Array.isArray(a.groups)
        ? a.groups.flatMap((g) => (isObj(g) ? [{ label: str(g.label) ?? "무리", items: strList(g.items) }] : []))
        : Object.entries(a.groups as Record<string, unknown>).map(([label, items]) => ({ label, items: strList(items) }));
      return {
        kind: "groups",
        groups,
        correct: typeof a.correct === "boolean" ? a.correct : null,
        tries: typeof a.tries === "number" ? a.tries : null,
      };
    }
  } else if (kind === "value") {
    if (a == null || typeof a !== "object") return { kind: "value", text: cell(a) };
  }
  if (typeof a === "string") return { kind: "text", text: a };
  if (typeof a === "number" || typeof a === "boolean") return { kind: "value", text: cell(a) };
  return { kind: "raw", value: a };
}

/** detail.qa → ResponseItem[]. 배열이 아니거나 쓸 만한 항목이 없으면 null */
export function normalizeQa(qa: unknown): ResponseItem[] | null {
  if (!Array.isArray(qa)) return null;
  const items: ResponseItem[] = [];
  const seen = new Map<string, number>();
  qa.forEach((entry, i) => {
    if (!isObj(entry)) return;
    const question = str(entry.question);
    if (question == null) return;
    const stage = str(entry.stage) ?? "etc";
    const id = str(entry.id) ?? String(i);
    let key = `${stage}:${id}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n) key = `${key}#${n + 1}`;
    items.push({
      key,
      stage,
      label: str(entry.label) ?? undefined,
      question,
      answer: normalizeQaAnswer(str(entry.kind) ?? "", entry.answer, entry),
    });
  });
  return items.length ? items : null;
}

/** details에 맞는 매핑 변형(위에서부터 첫 번째) */
function matchVariant(schema: ResponseSchema | null, d: Detail): ResponseVariant | null {
  if (!schema) return null;
  return (
    schema.variants.find((v) => {
      try {
        return v.match(d);
      } catch {
        return false;
      }
    }) ?? null
  );
}

/** 매핑 변형으로 질문-답 목록 + 매핑이 읽은 최상위 키 */
function readVariant(variant: ResponseVariant, d: Detail): { items: ResponseItem[]; used: Set<string> } {
  const used = new Set<string>(["qa", "kind", ...(variant.ignore ?? [])]);
  const items: ResponseItem[] = [];
  for (const spec of variant.items) {
    spec.uses.forEach((u) => used.add(u));
    let answer: Answer | null = null;
    try {
      answer = spec.read(d);
    } catch {
      answer = null;
    }
    if (!answer) continue;
    items.push({
      key: `${spec.stage}:${spec.id}`,
      stage: spec.stage,
      label: spec.label,
      question: spec.question,
      answer,
      note: spec.note,
      version: variant.id,
    });
  }
  return { items, used };
}

/** 한 결과의 details를 질문-답 목록으로 */
export function extractResponses(appId: string, details: unknown): ExtractedResponses {
  const d = asDetail(details);
  const schema = getResponseSchema(appId);
  const notes = schema?.notes ?? [];
  const variant = matchVariant(schema, d);

  const qaItems = normalizeQa(d.qa);
  if (qaItems) {
    const version = schema?.qaVersion ?? "qa";
    const items: ResponseItem[] = qaItems.map((it) => ({ ...it, version }));
    let extras: ExtractedResponses["extras"] = [];
    // qa가 다루지 않은 값(예: 열어 본 힌트 수)과 매핑의 항목 주석(예: 자기 기록 채점)은 매핑에서 보탠다(review L1).
    // qa와 같은 앱 버전의 변형일 때만 — 다른 버전의 질문 문구를 섞지 않는다.
    if (variant && schema?.qaVersion === variant.id) {
      const mapped = readVariant(variant, d);
      const byKey = new Map(mapped.items.map((m) => [m.key, m]));
      for (const it of items) {
        const m = byKey.get(it.key);
        if (m?.note && !it.note) it.note = m.note;
      }
      // 보태는 것은 짧은 값(힌트 수 같은 보조 정보)만 — 기록 표·질문은 qa가 이미 자기 모양으로 담고 있어 겹쳐 보이지 않게 한다.
      const have = new Set(items.map((it) => it.key));
      for (const m of mapped.items) if (!have.has(m.key) && m.answer.kind === "value") items.push({ ...m, version });
      extras = Object.keys(d)
        .filter((k) => !mapped.used.has(k))
        .map((k) => ({ key: k, value: d[k] }));
    }
    return { source: "qa", variantLabel: variant && schema?.qaVersion === variant.id ? variant.label : undefined, items, extras, notes };
  }

  if (variant) {
    const { items, used } = readVariant(variant, d);
    const extras = Object.keys(d)
      .filter((k) => !used.has(k))
      .map((k) => ({ key: k, value: d[k] }));
    return { source: "mapping", variantLabel: variant.label, items, extras, notes };
  }

  return { source: "raw", items: [], extras: Object.keys(d).map((k) => ({ key: k, value: d[k] })), notes };
}

/** 버전 id → 관리자에게 보여 줄 이름 */
export function versionLabel(version: string | undefined, schema: ResponseSchema | null): string {
  if (!version) return "알 수 없는 버전";
  const v = schema?.variants.find((x) => x.id === version);
  if (v) return v.label;
  if (version === "qa") return "질문-답 표준 목록으로 저장한 버전";
  return version;
}

/** 짧은 문자열 해시(질문 문구를 URL에 넣지 않으려고) — FNV-1a 32비트, 36진수 */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 질문별 보기에서 "같은 질문"을 가르는 키: (앱 버전 + 질문 key + 질문 문구). review H1.
 * 예전 버전과 새 버전이 같은 id(예: analyze:q1)를 다른 질문에 쓴 앱이 있어 key만으로 묶으면 답이 섞인다.
 */
export function questionIdentity(item: Pick<ResponseItem, "key" | "question" | "version">): string {
  return `${item.key}~${item.version ?? "?"}~${shortHash(item.question)}`;
}

/** 스테이지 순서대로 묶기(매핑의 stages 순서 → 처음 나온 순서) */
export function groupByStage<T extends { stage: string }>(items: T[], schema: ResponseSchema | null): { stage: string; label: string; items: T[] }[] {
  const order = new Map<string, number>();
  (schema?.stages ?? []).forEach((s, i) => order.set(s.id, i));
  const groups = new Map<string, T[]>();
  for (const it of items) {
    if (!groups.has(it.stage)) groups.set(it.stage, []);
    groups.get(it.stage)!.push(it);
  }
  const firstIdx = (stage: string) => items.findIndex((it) => it.stage === stage);
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 100 + firstIdx(a)) - (order.get(b) ?? 100 + firstIdx(b)))
    .map(([stage, list]) => ({ stage, label: stageLabel(stage, schema), items: list }));
}

/** 답을 한 줄 요약 문자열로(질문별 보기 정렬 · 선택 분포 · 검색용) */
export function answerText(a: Answer): string {
  switch (a.kind) {
    case "text":
    case "value":
      return a.text;
    case "choice":
      return a.chosen.join(", ");
    case "groups":
      return a.groups.map((g) => `${g.label}: ${g.items.join(", ")}`).join(" / ");
    case "table":
      return a.rows.map((r) => Object.values(r).join(" ")).join(" / ");
    default:
      return "";
  }
}

// ─────────────────────────────────────────────
// 진행 중(app_progress) — 진행률(단계)과 마지막 저장 시각만 보여 준다(spec §12 Q3)
// ─────────────────────────────────────────────

export type ProgressInfo = {
  /** 지금 머문 단계 이름(모르면 null) */
  stageLabel: string | null;
  /** 1부터. 단계를 모르면 null */
  index: number | null;
  total: number | null;
  /** 앱이 마치기를 눌렀다고 기록했는지(meta.finishedAt) */
  finished: boolean;
};

export function progressInfo(schema: ResponseSchema | null, state: unknown): ProgressInfo {
  const keys = isObj(state) && isObj(state.keys) ? state.keys : {};
  const step = typeof keys.step === "string" ? keys.step : null;
  const meta = isObj(keys.meta) ? keys.meta : {};
  const stages = schema?.stages ?? [];
  const idx = step ? stages.findIndex((s) => s.id === step) : -1;
  return {
    stageLabel: step ? (idx >= 0 ? stages[idx].label : (DEFAULT_STAGE_LABELS[step] ?? step)) : null,
    index: idx >= 0 ? idx + 1 : null,
    total: stages.length || null,
    finished: meta.finishedAt != null,
  };
}
