"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { ClipboardCheckIcon, Gamepad2Icon, MessageCircleIcon } from "lucide-react";
import { CompletedMark } from "@/components/learning/activity-panels";
import {
  AsyncView,
  LateBadge,
  SectionTitle,
  StudentLink,
  SubmissionStatusBadge,
  TableWrap,
  tdClass,
  thClass,
  UnreadCount,
} from "@/components/learning/learning-ui";
import { EmptyState } from "@/components/states";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/hooks/use-session";
import { adminDisplayName } from "@/lib/admin";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  appLabelAdmin,
  FEEDBACK_CHANGED_EVENT,
  fetchAppSummaries,
  fetchRecentActivity,
  fetchThreadSummaries,
  formatScore,
  isLate,
  type ActivityItem,
} from "@/lib/learning";

function percent(n: number | null): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

/** 학습 현황 > 개요: 전체 시도 수 · 앱별 완료율/평균 점수 · 최근 활동 20건 · 피드백 대화 */
export function LearningOverview() {
  return (
    <div className="flex flex-col gap-10">
      <AppSummarySection />
      <FeedbackInbox />
      <RecentActivitySection limit={20} />
    </div>
  );
}

function AppSummarySection() {
  // 서버 집계(app_result_stats RPC)라 기록 수와 관계없이 전체 기준이다(review #4).
  const load = useCallback(() => fetchAppSummaries(), []);
  const { state, reload } = useAsyncData(load);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="app-summary">
      <SectionTitle>
        <span id="app-summary" className="inline-flex items-center gap-2">
          <Gamepad2Icon className="size-5 text-games-strong" aria-hidden />
          웹앱별 현황
        </span>
      </SectionTitle>
      <AsyncView state={state} onRetry={reload} errorText="웹앱 결과를 불러오지 못했습니다.">
        {({ total, apps }) => (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              전체 웹앱 시도 <span className="font-heading text-2xl text-foreground">{formatCount(total)}</span>회
              <span className="ml-2 text-xs">(전체 기록 기준)</span>
            </p>
            {!apps.length ? (
              <EmptyState
                title="등록된 웹앱과 기록이 없습니다"
                description="src/data/apps.ts에 웹앱을 등록하고, 앱에서 class1-record.js로 결과를 저장하면 여기에 집계됩니다."
              />
            ) : (
              <TableWrap label="웹앱별 현황">
                <thead>
                  <tr>
                    <th className={thClass}>앱</th>
                    <th className={thClass}>시도</th>
                    <th className={thClass}>참여 학생</th>
                    <th className={thClass}>완료율</th>
                    <th className={thClass}>평균 점수</th>
                    <th className={thClass}>최근 기록</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.appId}>
                      <td className={tdClass}>
                        <Link href={`/admin/learning/?tab=apps&app=${encodeURIComponent(a.appId)}`} className="font-medium hover:underline">
                          {a.title}
                        </Link>
                        {!a.registered ? <span className="block text-xs text-muted-foreground">목록에 없는 앱</span> : null}
                      </td>
                      <td className={tdClass}>{formatCount(a.attempts)}</td>
                      <td className={tdClass}>{formatCount(a.students)}명</td>
                      <td className={tdClass}>{a.attempts ? percent(a.completed / a.attempts) : "—"}</td>
                      <td className={tdClass}>{percent(a.avgRatio)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>
                        {a.lastAt ? formatDateTime(a.lastAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
        )}
      </AsyncView>
    </section>
  );
}

/** 학생과의 피드백 대화 목록(안 읽은 대화 먼저). 행을 누르면 회원 상세의 해당 대화로 간다. */
function FeedbackInbox() {
  const { user } = useSession();
  const me = user?.id ?? "";
  const load = useCallback(async () => {
    const all = await fetchThreadSummaries(undefined, "admin");
    return all
      .filter((t) => t.messageCount > 0)
      .sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0))
      .slice(0, 10);
  }, []);
  const { state, reload, refresh } = useAsyncData(load);

  useEffect(() => {
    window.addEventListener(FEEDBACK_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="feedback-inbox">
      <SectionTitle>
        <span id="feedback-inbox" className="inline-flex items-center gap-2">
          <MessageCircleIcon className="size-5 text-science-strong" aria-hidden />
          피드백 대화
        </span>
      </SectionTitle>
      <AsyncView
        state={state}
        onRetry={reload}
        errorText="피드백 대화를 불러오지 못했습니다."
        isEmpty={(rows) => !rows.length}
        empty={<EmptyState title="아직 주고받은 피드백이 없습니다" description="회원 상세나 과제 제출 현황에서 피드백을 남길 수 있습니다." />}
      >
        {(rows) => (
          <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/members/?id=${t.student_id}&tab=feedback&thread=${encodeURIComponent(t.context_key)}`}
                  className="flex items-center gap-3 p-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{adminDisplayName(t.student, "이름 없음")}</span>
                      <span className="truncate text-xs text-muted-foreground">{t.context.label}</span>
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {t.lastSenderId === me ? "나: " : ""}
                      {t.lastMessage}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <UnreadCount count={t.unread} />
                    {t.lastMessageAt ? <span className="text-xs text-muted-foreground">{formatDateTime(t.lastMessageAt)}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </section>
  );
}

/** 최근 학습활동(웹앱 결과 + 과제 제출, 시간순). /admin/ 개요에서도 재사용한다. */
export function RecentActivitySection({ limit, compact = false }: { limit: number; compact?: boolean }) {
  const load = useCallback(() => fetchRecentActivity(limit), [limit]);
  const { state, reload } = useAsyncData(load);
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={`recent-activity-${limit}`}>
      <SectionTitle
        actions={
          compact ? (
            <Link
              href="/admin/learning/"
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              학습 현황
            </Link>
          ) : null
        }
      >
        <span id={`recent-activity-${limit}`} className="inline-flex items-center gap-2">
          <ClipboardCheckIcon className="size-5 text-board-strong" aria-hidden />
          최근 학습활동
        </span>
      </SectionTitle>
      <AsyncView
        state={state}
        onRetry={reload}
        errorText="최근 학습활동을 불러오지 못했습니다."
        isEmpty={(rows) => !rows.length}
        empty={<EmptyState title="아직 활동이 없습니다" />}
      >
        {(rows) => (
          <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/10">
            {rows.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </AsyncView>
    </section>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-center sm:gap-3">
      <span className="min-w-0 sm:w-40 sm:shrink-0">
        <StudentLink id={item.userId} profile={item.student} tab={item.kind === "app_result" ? "apps" : "assignments"} />
      </span>
      {item.kind === "app_result" ? (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Gamepad2Icon className="size-4 text-games-strong" aria-hidden />
            <span className="font-medium">{appLabelAdmin(item.result.app_id)}</span>
          </span>
          <span>{formatScore(item.result.score, item.result.max_score)}</span>
          <CompletedMark completed={item.result.completed} />
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ClipboardCheckIcon className="size-4 shrink-0 text-board-strong" aria-hidden />
            {item.assignment ? (
              <Link
                href={`/admin/learning/?tab=assignments&assignment=${item.assignment.id}`}
                className="truncate font-medium hover:underline"
              >
                {item.assignment.title}
              </Link>
            ) : (
              <span className="text-muted-foreground">삭제된 과제</span>
            )}
          </span>
          <SubmissionStatusBadge status={item.submission.status} />
          {isLate(item.submission.submitted_at, item.assignment?.due_at) ? <LateBadge /> : null}
        </span>
      )}
      <time dateTime={item.at} className="shrink-0 text-xs text-muted-foreground">
        {formatDateTime(item.at)}
      </time>
    </li>
  );
}
