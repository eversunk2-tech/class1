"use client";

import { useMemo, useState } from "react";
import { CheckCircle2Icon, ChevronDownIcon, CircleAlertIcon, InfoIcon, XCircleIcon } from "lucide-react";
import { getResponseSchema } from "@/data/app-responses";
import type { Answer, ResponseItem } from "@/data/app-responses/types";
import { extractResponses, groupByStage, type ExtractedResponses } from "@/lib/app-responses";
import { cn } from "@/lib/utils";

/**
 * 학생 한 명의 웹앱 결과(app_results.details)를 단계별 "질문 + 답"으로 보여 준다(docs/admin/responses-spec.md §4.4).
 * 우선순위: detail.qa → 앱별 매핑 → 원본 JSON(접기).
 * 학생 입력은 신뢰할 수 없는 값이라 모두 React 텍스트 노드로만 그린다(innerHTML · dangerouslySetInnerHTML · 마크다운 금지).
 */

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}

/** 원본 JSON 접기(텍스트로만) */
export function RawJson({ value, label = "원본 데이터 보기", defaultOpen = false }: { value: unknown; label?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex w-fit items-center gap-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        {open ? "원본 데이터 접기" : label}
      </button>
      {open ? (
        <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-5 break-words whitespace-pre-wrap">{pretty(value)}</pre>
      ) : null}
    </div>
  );
}

function CorrectMark({ correct, tries }: { correct: boolean | null; tries: number | null }) {
  if (correct == null && tries == null) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      {correct == null ? null : correct ? (
        <span className="inline-flex items-center gap-1 font-medium text-science-strong">
          <CheckCircle2Icon className="size-3.5" aria-hidden />
          정답
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 font-medium text-destructive">
          <XCircleIcon className="size-3.5" aria-hidden />
          오답
        </span>
      )}
      {tries != null ? <span className="text-muted-foreground">확인 {tries}번</span> : null}
    </span>
  );
}

/** 답 하나(종류별) */
export function AnswerView({ answer, compact = false }: { answer: Answer; compact?: boolean }) {
  switch (answer.kind) {
    case "text":
      return (
        <div className="flex flex-col gap-1">
          {answer.text.trim() ? (
            <p className="text-sm leading-6 break-words whitespace-pre-wrap">{answer.text}</p>
          ) : (
            // 제출하지 않아 빈 글로 저장된 문항은 "(비어 있음)"과 "입력 중이던 글"을 함께 띄우지 않는다(review L3).
            <p className="text-sm text-muted-foreground">{answer.submitted === false ? "(제출하지 않음)" : "(비어 있음)"}</p>
          )}
          {answer.submitted === false && answer.text.trim() ? (
            <span className="text-xs text-muted-foreground">제출하기 전 입력 중이던 글</span>
          ) : null}
        </div>
      );
    case "value":
      return <p className="text-sm break-words whitespace-pre-wrap">{answer.text}</p>;
    case "choice":
      return (
        <div className="flex flex-col gap-1">
          {answer.chosen.length ? (
            <ul className="flex flex-col gap-0.5 text-sm">
              {answer.chosen.map((c, i) => (
                <li key={i} className="break-words">
                  <span aria-hidden className="mr-1 text-muted-foreground">
                    ☑
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">(고르지 않음)</p>
          )}
          <CorrectMark correct={answer.correct} tries={answer.tries} />
        </div>
      );
    case "groups":
      return (
        <div className="flex flex-col gap-1.5">
          <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
            {answer.groups.map((g, i) => (
              <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
                <p className="text-sm break-words">{g.items.length ? g.items.join(", ") : "—"}</p>
              </div>
            ))}
          </div>
          <CorrectMark correct={answer.correct} tries={answer.tries} />
        </div>
      );
    case "table":
      if (!answer.rows.length) return <p className="text-sm text-muted-foreground">(기록 없음)</p>;
      return (
        <div className="max-w-full overflow-x-auto rounded-lg ring-1 ring-foreground/10" role="region" aria-label="기록 표" tabIndex={0}>
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr>
                {answer.columns.map((c) => (
                  <th key={c.key} className="border-b bg-muted/50 px-2 py-1.5 text-left font-medium whitespace-nowrap text-muted-foreground">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.rows.map((r, i) => (
                <tr key={i}>
                  {answer.columns.map((c) => (
                    <td key={c.key} className="border-b px-2 py-1.5 align-top break-words [tr:last-child_&]:border-b-0">
                      {r[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <RawJson value={answer.value} label="값 보기(JSON)" defaultOpen={compact} />;
  }
}

function ItemCard({ item }: { item: ResponseItem }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10">
      <p className="text-xs leading-5 text-muted-foreground">
        {item.label ? <span className="mr-1.5 font-medium text-foreground/80">{item.label}</span> : null}
        {item.question}
      </p>
      <AnswerView answer={item.answer} />
      {item.note ? (
        <p className="inline-flex items-start gap-1 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
          {item.note}
        </p>
      ) : null}
    </li>
  );
}

const SOURCE_LABELS: Record<ExtractedResponses["source"], string> = {
  qa: "질문-답 표준 목록(detail.qa)",
  mapping: "앱별 응답 매핑",
  raw: "원본 데이터",
};

/**
 * @param details app_results.details
 * @param showSource 어떤 방식으로 정리했는지(표준 목록/매핑/원본) 작은 글씨로 보여 줄지
 */
export function ResponsePanel({ appId, details, showSource = true }: { appId: string; details: unknown; showSource?: boolean }) {
  const schema = getResponseSchema(appId);
  const extracted = useMemo(() => extractResponses(appId, details), [appId, details]);
  const groups = useMemo(() => groupByStage(extracted.items, schema), [extracted.items, schema]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {extracted.source === "raw" ? (
        <p className="inline-flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          이 앱의 저장 모양을 알 수 없어 질문별로 정리하지 못했어요. 아래 원본 데이터로 확인해 주세요.
        </p>
      ) : null}
      {extracted.source !== "raw" && !extracted.items.length && !extracted.extras.length ? (
        <p className="text-sm text-muted-foreground">저장된 답이 없어요.</p>
      ) : null}
      {groups.map((g) => (
        <section key={g.stage} className="flex min-w-0 flex-col gap-2" aria-label={g.label}>
          <h4 className="text-sm font-semibold">{g.label}</h4>
          <ul className="flex min-w-0 flex-col gap-2">
            {g.items.map((it) => (
              <ItemCard key={it.key} item={it} />
            ))}
          </ul>
        </section>
      ))}
      {extracted.extras.length ? (
        <section className="flex min-w-0 flex-col gap-2" aria-label="그 밖의 저장 값">
          <h4 className="text-sm font-semibold">{extracted.source === "raw" ? "저장된 값" : "그 밖의 저장 값"}</h4>
          <ul className="flex min-w-0 flex-col gap-2">
            {extracted.extras.map((x) => (
              <li key={x.key} className="flex min-w-0 flex-col gap-1 rounded-xl px-3 py-2 ring-1 ring-foreground/10">
                <p className="font-mono text-xs text-muted-foreground">{x.key}</p>
                {typeof x.value === "string" ? (
                  <p className="text-sm break-words whitespace-pre-wrap">{x.value}</p>
                ) : typeof x.value === "number" || typeof x.value === "boolean" ? (
                  <p className="text-sm">{String(x.value)}</p>
                ) : (
                  <pre className="max-h-60 overflow-auto text-xs leading-5 break-words whitespace-pre-wrap">{pretty(x.value)}</pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {extracted.notes.length && extracted.source !== "raw" ? (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {extracted.notes.map((n, i) => (
            <li key={i} className="inline-flex items-start gap-1">
              <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showSource ? (
          <span className="text-xs text-muted-foreground">
            정리 방식: {SOURCE_LABELS[extracted.source]}
            {extracted.variantLabel ? ` · ${extracted.variantLabel}` : ""}
          </span>
        ) : (
          <span />
        )}
        <RawJson value={details} />
      </div>
    </div>
  );
}
