"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2Icon, MessageCircleIcon, SendIcon } from "lucide-react";
import { EmptyOwl, ErrorState } from "@/components/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/hooks/use-session";
import { adminDisplayName, profileDisplayName } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import {
  errorMessage,
  FEEDBACK_BODY_MAX,
  fetchFeedbackMessages,
  findFeedbackThread,
  getOrCreateFeedbackThread,
  isMissingSchemaError,
  markThreadRead,
  notifyFeedbackChanged,
  sendFeedbackMessage,
  type FeedbackContext,
  type FeedbackMessageWithSender,
} from "@/lib/learning";
import { primaryPillClass } from "@/lib/pill";
import { cn } from "@/lib/utils";

type ThreadData = { threadId: string | null; messages: FeedbackMessageWithSender[]; total: number };

/** 화면에 보이는 마지막 메시지 시각(읽음 표시 기준, review #5) */
function lastShownAt(messages: FeedbackMessageWithSender[]): string | null {
  return messages.length ? messages[messages.length - 1].created_at : null;
}

/**
 * 관리자 ↔ 학생 피드백 대화(docs/admin/spec.md §3.9).
 * - 스레드는 첫 메시지를 보낼 때 만든다(get_or_create_feedback_thread) — 열어 보기만 해서는 빈 스레드가 생기지 않는다.
 * - 마운트 · 새 메시지 확인 시 mark_thread_read로 "화면에 보여 준 마지막 메시지까지만" 읽음 표시 → 안 읽음 배지 갱신.
 * - 보낸 뒤에는 목록을 다시 불러와, 그사이 상대가 보낸 메시지도 화면에 보인 다음에 읽음 처리한다.
 * - 실시간 구독 없이 창 포커스/탭 복귀 때 다시 불러온다(§14 Q6).
 * - 본문은 텍스트만(마크다운 아님). 학생 화면에서 상대는 "선생님"으로 표시한다.
 */
export function FeedbackThread({
  studentId,
  context,
  audience,
  studentName,
  studentWithdrawn,
  className,
  autoFocus,
}: {
  studentId: string;
  context: FeedbackContext;
  audience: "admin" | "student";
  /** 관리자 화면에서 학생 메시지에 붙일 이름 */
  studentName?: string;
  /** 탈퇴 처리된 학생인지(관리자 화면). 새 메시지를 보내도 학생이 읽을 수 없으므로 안내한다(review U6). */
  studentWithdrawn?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const { user } = useSession();
  const me = user?.id ?? null;
  const contextType = context.type;
  const contextId = context.id;

  const load = useCallback(async (): Promise<ThreadData> => {
    const thread = await findFeedbackThread(studentId, { type: contextType, id: contextId });
    if (!thread) return { threadId: null, messages: [], total: 0 };
    const { messages, total } = await fetchFeedbackMessages(thread.id);
    // 열어 본 것 자체가 "읽음"이다 — 단, 지금 불러온(화면에 보일) 마지막 메시지까지만. 실패해도 대화는 보여 준다.
    void markThreadRead(thread.id, lastShownAt(messages));
    return { threadId: thread.id, messages, total };
  }, [studentId, contextType, contextId]);

  const { state, reload, refresh, setData } = useAsyncData(load);

  // 창 포커스 · 탭 복귀 시 조용히 다시 불러온다.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const listRef = useRef<HTMLOListElement>(null);
  const messageCount = state.status === "ready" ? state.data.messages.length : 0;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // state 기반 확인만으로는 Ctrl+Enter 연타 때 두 번 보내진다 → ref로 막는다(review #14).
  const sendingRef = useRef(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status !== "ready" || sendingRef.current) return;
    const text = body.trim();
    if (!text) {
      setFormError("내용을 입력해 주세요.");
      return;
    }
    if (text.length > FEEDBACK_BODY_MAX) {
      setFormError(`${FEEDBACK_BODY_MAX.toLocaleString()}자까지 쓸 수 있어요.`);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setFormError(null);
    const shownBefore = lastShownAt(state.data.messages);
    try {
      const threadId = state.data.threadId ?? (await getOrCreateFeedbackThread(studentId, context));
      const msg = await sendFeedbackMessage(threadId, text);
      setBody("");
      try {
        // 보낸 뒤 다시 불러와 그사이 상대가 보낸 메시지까지 보여 주고, 보여 준 것까지만 읽음 처리한다.
        const fresh = await fetchFeedbackMessages(threadId);
        setData(() => ({ threadId, ...fresh }));
        void markThreadRead(threadId, lastShownAt(fresh.messages));
      } catch {
        // 다시 불러오기에 실패하면 내 메시지만 붙이고, 읽음 기준은 앞서 보여 준 마지막 메시지에서 옮기지 않는다.
        setData((d) => ({ threadId, messages: [...d.messages, msg], total: d.total + 1 }));
        void markThreadRead(threadId, shownBefore);
      }
      notifyFeedbackChanged();
    } catch (err) {
      setFormError(
        isMissingSchemaError(err)
          ? errorMessage(true, "", audience)
          : "메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function senderLabel(m: FeedbackMessageWithSender): string {
    if (m.sender_id === me) return "나";
    if (audience === "student") return "선생님";
    // 관리자 화면에서는 탈퇴 학생도 "탈퇴한 학생(원래 이름)"으로 구분한다(review U2).
    if (m.sender_id === studentId) {
      return studentName || (audience === "admin" ? adminDisplayName : profileDisplayName)(m.profiles, "학생");
    }
    // 선생님(관리자)은 탈퇴 대상이 아니지만, 표시는 같은 헬퍼로 통일한다.
    const teacher = m.profiles?.display_name ? profileDisplayName(m.profiles, "") : "";
    return `선생님${teacher ? ` (${teacher})` : ""}`;
  }

  const student = audience === "student";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {state.status === "loading" ? (
        <div className="flex flex-col gap-3 py-2" aria-busy="true" aria-label="대화를 불러오는 중">
          <Skeleton className="h-12 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message={errorMessage(state.missing, "대화를 불러오지 못했어요.", audience)} onRetry={reload} />
      ) : state.data.messages.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground",
            student && "rounded-3xl border-2 border-primary/15 bg-card/60",
          )}
        >
          {student ? <EmptyOwl className="w-18 sm:w-20" /> : <MessageCircleIcon className="size-5" aria-hidden />}
          {audience === "student"
            ? "아직 대화가 없어요. 궁금한 점을 선생님께 남겨 보세요."
            : "아직 대화가 없습니다. 첫 피드백을 남겨 보세요."}
        </div>
      ) : (
        <>
        {state.data.total > state.data.messages.length ? (
          <p className="text-xs text-muted-foreground">
            최근 메시지 {state.data.messages.length.toLocaleString()}개만 보여 줘요(전체 {state.data.total.toLocaleString()}개).
          </p>
        ) : null}
        <ol
          ref={listRef}
          className={cn(
            "flex max-h-[28rem] flex-col gap-3 overflow-y-auto rounded-xl bg-muted/30 p-3",
            // 학생 화면: 옅은 보라 대화 판 + 둥근 말풍선(디자인 개편 2단계)
            student && "rounded-3xl bg-primary/5 p-4 ring-1 ring-primary/10 dark:bg-primary/10",
          )}
          aria-label="대화 내용"
        >
          {state.data.messages.map((m) => {
            const mine = m.sender_id === me;
            const label = senderLabel(m);
            return (
              <li key={m.id} className={cn("flex max-w-[85%] gap-2", mine ? "ml-auto flex-row-reverse" : "")}>
                {!mine ? (
                  <Avatar size="sm" className="mt-5">
                    {m.profiles?.avatar_url ? <AvatarImage src={m.profiles.avatar_url} alt="" /> : null}
                    <AvatarFallback>{label.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ) : null}
                <div className={cn("flex min-w-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{label}</span>
                    <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                  </span>
                  <p
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm leading-6 break-words whitespace-pre-wrap",
                      mine ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-foreground/10",
                      student && (mine ? "rounded-3xl rounded-br-md px-4 py-2.5" : "rounded-3xl rounded-bl-md px-4 py-2.5 shadow-(--shadow-sm) dark:shadow-none"),
                    )}
                  >
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        </>
      )}

      {state.status === "ready" && studentWithdrawn && audience === "admin" ? (
        <p role="note" className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
          탈퇴 처리된 학생이라 계정이 없습니다. 지금 보내는 메시지는 <strong>학생이 읽을 수 없고</strong> 기록으로만 남습니다.
        </p>
      ) : null}

      {state.status === "ready" ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor={`feedback-body-${contextType}-${contextId ?? "general"}`} className="sr-only">
            메시지 작성
          </label>
          <Textarea
            id={`feedback-body-${contextType}-${contextId ?? "general"}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={FEEDBACK_BODY_MAX}
            placeholder={audience === "student" ? "선생님께 메시지를 남겨 보세요" : "피드백을 입력하세요"}
            disabled={sending}
            autoFocus={autoFocus}
            className={cn("min-h-20", student ? "rounded-2xl" : "bg-card")}
            onKeyDown={(e) => {
              // Ctrl/⌘ + Enter로 전송
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : (
              <span className="text-xs text-muted-foreground">
                {body.length.toLocaleString()} / {FEEDBACK_BODY_MAX.toLocaleString()}
              </span>
            )}
            <Button type="submit" className={student ? cn(primaryPillClass, "h-10") : "h-9 px-4"} disabled={sending || !body.trim()}>
              {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              보내기
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
