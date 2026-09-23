"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareTextIcon } from "lucide-react";
import { FeedbackThread } from "@/components/feedback/feedback-thread";
import { AsyncView, UnreadCount } from "@/components/learning/learning-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/hooks/use-session";
import { formatDateTime } from "@/lib/format";
import {
  FEEDBACK_CHANGED_EVENT,
  fetchThreadSummaries,
  type FeedbackContext,
  type ThreadSummary,
} from "@/lib/learning";
import { cn } from "@/lib/utils";

type Entry = {
  key: string;
  context: FeedbackContext;
  label: string;
  deleted: boolean;
  summary: ThreadSummary | null;
};

const GENERAL_KEY = "general:";

const CONTEXT_KEY_RE = /^(app_result|assignment_submission):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** "assignment_submission:<uuid>" 같은 키를 컨텍스트로 바꾼다. 형식이 틀리면 null */
function parseContextKey(key: string): FeedbackContext | null {
  const m = CONTEXT_KEY_RE.exec(key);
  return m ? { type: m[1] as FeedbackContext["type"], id: m[2].toLowerCase() } : null;
}

const NEW_THREAD_LABELS: Record<string, string> = {
  app_result: "웹앱 결과 대화",
  assignment_submission: "과제 제출 대화",
};

/**
 * @param selectedKey 지금 고른 키. 메시지가 없는 스레드나 아직 없는 스레드라도 고른 것이면 목록에 넣어
 *   "일반 대화"로 조용히 바뀌지 않게 한다(review #24).
 */
function toEntries(summaries: ThreadSummary[], selectedKey: string): Entry[] {
  const general = summaries.find((s) => s.context_type === "general") ?? null;
  const entries: Entry[] = [
    { key: GENERAL_KEY, context: { type: "general", id: null }, label: "일반 대화", deleted: false, summary: general },
  ];
  for (const s of summaries) {
    if (s.context_type === "general") continue;
    // 메시지 없는 빈 스레드(예전에 만들어졌지만 대화가 없는 것)는 목록에서 뺀다(지금 고른 것은 예외).
    if (!s.messageCount && s.context_key !== selectedKey) continue;
    entries.push({
      key: s.context_key,
      context: { type: s.context_type, id: s.context_id },
      label: s.context.label,
      deleted: "deleted" in s.context ? s.context.deleted : false,
      summary: s,
    });
  }
  if (!entries.some((e) => e.key === selectedKey)) {
    const ctx = parseContextKey(selectedKey);
    if (ctx) {
      entries.push({ key: selectedKey, context: ctx, label: NEW_THREAD_LABELS[ctx.type] ?? "대화", deleted: false, summary: null });
    }
  }
  return entries;
}

/**
 * 한 학생의 피드백 대화 모음: 일반 대화 1개 + 결과/제출에 연결된 대화들(spec §3.5, §3.8).
 * 왼쪽(모바일은 위) 목록에서 고르면 오른쪽에 FeedbackThread를 연다.
 */
export function FeedbackCenter({
  studentId,
  audience,
  studentName,
  studentWithdrawn,
  initialKey,
}: {
  studentId: string;
  audience: "admin" | "student";
  studentName?: string;
  /** 탈퇴 처리된 학생인지(review U6) */
  studentWithdrawn?: boolean;
  /** 처음 열 스레드의 context_key(예: "assignment_submission:<id>") */
  initialKey?: string | null;
}) {
  const { user } = useSession();
  const me = user?.id ?? "";
  const load = useCallback(() => fetchThreadSummaries(studentId, audience), [studentId, audience]);
  const { state, reload, refresh } = useAsyncData(load);
  // 선택은 URL(?thread=)을 따라간다: URL이 바뀌면 그 값으로 다시 맞춘다(렌더 중 상태 보정, review #24).
  const urlKey = initialKey || GENERAL_KEY;
  const [selection, setSelection] = useState<{ urlKey: string; key: string }>({ urlKey, key: urlKey });
  if (selection.urlKey !== urlKey) setSelection({ urlKey, key: urlKey });
  const selected = selection.urlKey === urlKey ? selection.key : urlKey;
  const setSelected = (key: string) => setSelection({ urlKey, key });

  // 읽음 표시 · 새 메시지 후 목록의 안 읽은 수 · 마지막 메시지를 갱신한다.
  useEffect(() => {
    window.addEventListener(FEEDBACK_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FEEDBACK_CHANGED_EVENT, refresh);
  }, [refresh]);

  return (
    <AsyncView state={state} onRetry={reload} errorText="피드백 대화를 불러오지 못했어요." audience={audience}>
      {(summaries) => {
        const entries = toEntries(summaries, selected);
        const current = entries.find((e) => e.key === selected) ?? entries[0];
        return (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]">
            <nav aria-label="대화 목록" className="min-w-0">
              <ul className="relative flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
                {entries.map((e) => {
                  const active = e.key === current.key;
                  return (
                    <li key={e.key} className="shrink-0 xl:shrink">
                      <button
                        type="button"
                        onClick={() => setSelected(e.key)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-60 items-start gap-2 rounded-xl px-3 py-2 text-left text-sm outline-none ring-1 ring-foreground/10 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 xl:w-full",
                          active ? "bg-muted font-medium" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className={cn("truncate", e.deleted && "text-muted-foreground line-through")}>{e.label}</span>
                          <span className="truncate text-xs font-normal text-muted-foreground">
                            {e.summary?.lastMessage
                              ? `${e.summary.lastSenderId === me ? "나: " : ""}${e.summary.lastMessage}`
                              : "아직 대화 없음"}
                          </span>
                        </span>
                        <UnreadCount count={e.summary?.unread ?? 0} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <section aria-label={current.label} className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{current.label}</h3>
                {current.summary?.lastMessageAt ? (
                  <span className="text-xs text-muted-foreground">마지막 메시지 {formatDateTime(current.summary.lastMessageAt)}</span>
                ) : null}
              </div>
              {current.deleted ? (
                <p className="text-xs text-muted-foreground">
                  연결된 원본이 삭제되었어요. 대화 기록은 그대로 남아 있어요.
                </p>
              ) : null}
              <FeedbackThread
                key={current.key}
                studentId={studentId}
                context={current.context}
                audience={audience}
                studentName={studentName}
                studentWithdrawn={studentWithdrawn}
              />
            </section>
          </div>
        );
      }}
    </AsyncView>
  );
}

/** 결과/제출 옆 "피드백" 버튼 → 해당 컨텍스트 대화를 다이얼로그로 연다. */
export function FeedbackDialogButton({
  studentId,
  context,
  audience,
  title,
  studentName,
  studentWithdrawn,
  label,
  size = "sm",
  variant = "outline",
}: {
  studentId: string;
  context: FeedbackContext;
  audience: "admin" | "student";
  title: string;
  studentName?: string;
  /** 탈퇴 처리된 학생인지 — 대화창에 "학생이 읽을 수 없음" 안내를 띄운다(review U6). */
  studentWithdrawn?: boolean;
  label?: string;
  size?: "sm" | "xs" | "default";
  variant?: "outline" | "ghost" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <MessageSquareTextIcon />
        {label ?? (audience === "admin" ? "피드백" : "선생님과 대화")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {audience === "admin"
                ? `${studentName ?? "학생"}에게 보이는 대화입니다.`
                : "선생님과 나만 볼 수 있는 대화예요."}
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <FeedbackThread
              studentId={studentId}
              context={context}
              audience={audience}
              studentName={studentName}
              studentWithdrawn={studentWithdrawn}
              autoFocus
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
