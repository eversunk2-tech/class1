"use client";

import { Fragment, useCallback, useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, ChevronDownIcon, CircleDashedIcon, ExternalLinkIcon, HeartIcon, MessageSquareIcon } from "lucide-react";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { FeedbackDialogButton } from "@/components/feedback/feedback-center";
import {
  AsyncView,
  LateBadge,
  SectionTitle,
  SubmissionStatusBadge,
  TableWrap,
  tdClass,
  thClass,
} from "@/components/learning/learning-ui";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { ResponsePanel } from "@/components/learning/response-panel";
import { postHref } from "@/components/post-card";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { Mascot } from "@/components/illustrations/mascot";
import { EmptyOwl, EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  appLabel,
  appLabelAdmin,
  appTitle,
  fetchUserAppResults,
  fetchUserComments,
  fetchUserLikes,
  fetchUserPostReads,
  fetchUserSubmissions,
  formatDuration,
  formatScore,
  isLate,
  isSuspiciousResult,
  type SubmissionWithAssignment,
} from "@/lib/learning";
import { isHttpUrl } from "@/lib/slug";
import type { AppResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Audience = "admin" | "student";

/** 완료 여부 표시 */
export function CompletedMark({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="inline-flex items-center gap-1 text-science-strong">
      <CheckCircle2Icon className="size-4" aria-hidden />
      완료
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <CircleDashedIcon className="size-4" aria-hidden />
      미완료
    </span>
  );
}

/** 이상치 표시(관리자) — 점수·시간은 클라이언트가 보내는 값이라 조작될 수 있다(spec §8). */
export function SuspiciousMark({ result }: { result: Pick<AppResult, "score" | "max_score" | "duration_seconds"> }) {
  if (!isSuspiciousResult(result)) return null;
  return (
    <span title="만점 초과 · 0초 만점 등 확인이 필요한 기록" className="ml-1 inline-flex align-middle text-board-strong">
      <AlertTriangleIcon className="size-3.5" aria-hidden />
      <span className="sr-only">확인 필요</span>
    </span>
  );
}

/** 웹앱 결과 탭: 한 회원의 app_results */
export function UserAppResults({ userId, audience, studentName }: { userId: string; audience: Audience; studentName?: string }) {
  const load = useCallback(() => fetchUserAppResults(userId), [userId]);
  const { state, reload } = useAsyncData(load);
  // 관리자만: 행마다 "응답 보기"로 학생이 적고 고른 내용을 펼친다(docs/admin/responses-spec.md §4.6). 학생 화면에는 넣지 않는다(Q6).
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <AsyncView
      state={state}
      onRetry={reload}
      audience={audience}
      errorText="웹앱 결과를 불러오지 못했어요."
      isEmpty={(rows) => !rows.length}
      empty={
        <EmptyState
          title="아직 기록이 없어요"
          description={audience === "student" ? "로그인한 상태로 학습 게임을 끝까지 하면 결과가 여기에 쌓여요." : "이 회원은 아직 웹앱 결과가 없습니다."}
          illustration={audience === "student" ? <EmptyOwl /> : undefined}
        />
      }
    >
      {(rows) =>
        audience === "student" ? (
          <StudentAppResults rows={rows} userId={userId} />
        ) : (
          <TableWrap label="웹앱 결과">
            <thead>
              <tr>
                <th className={thClass}>앱</th>
                <th className={thClass}>점수</th>
                <th className={thClass}>완료</th>
                <th className={thClass}>소요 시간</th>
                <th className={thClass}>일시</th>
                <th className={thClass}>
                  <span className="sr-only">피드백</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td className={tdClass}>
                      <span className={appTitle(r.app_id) ? "font-medium" : "text-muted-foreground"}>
                        {audience === "admin" ? appLabelAdmin(r.app_id) : appLabel(r.app_id)}
                      </span>
                      {!appTitle(r.app_id) ? (
                        <span className="ml-1 text-xs text-muted-foreground">({audience === "admin" ? "목록에 없는 앱" : r.app_id})</span>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      {formatScore(r.score, r.max_score)}
                      {audience === "admin" ? <SuspiciousMark result={r} /> : null}
                    </td>
                    <td className={tdClass}>
                      <CompletedMark completed={r.completed} />
                    </td>
                    <td className={tdClass}>{formatDuration(r.duration_seconds)}</td>
                    <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.created_at)}</td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      {audience === "admin" ? (
                        <Button type="button" variant="ghost" size="xs" onClick={() => toggle(r.id)} aria-expanded={openIds.has(r.id)}>
                          <ChevronDownIcon className={openIds.has(r.id) ? "rotate-180 transition-transform" : "transition-transform"} />
                          {openIds.has(r.id) ? "응답 접기" : "응답 보기"}
                        </Button>
                      ) : null}
                      <FeedbackDialogButton
                        studentId={userId}
                        context={{ type: "app_result", id: r.id }}
                        audience={audience}
                        studentName={studentName}
                        title={`${audience === "admin" ? appLabelAdmin(r.app_id) : appLabel(r.app_id)} · ${formatDateTime(r.created_at)}`}
                        size="xs"
                        variant="ghost"
                        label={audience === "admin" ? "피드백" : "대화"}
                      />
                    </td>
                  </tr>
                  {audience === "admin" && openIds.has(r.id) ? (
                    <tr>
                      <td colSpan={6} className="border-b bg-muted/20 px-3 py-3">
                        <ResponsePanel appId={r.app_id} details={r.details} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </TableWrap>
        )
      }
    </AsyncView>
  );
}

/**
 * 학생 화면의 웹앱 결과(디자인 개편 2단계): 요약 카드(완료하면 응원하는 부엉이 owl-cheer) + 둥근 기록 카드 목록.
 * 관리자 화면은 위의 표 그대로다. 보여 주는 값(앱 이름·점수·완료·시간·일시)과 "대화" 버튼은 표와 같다.
 */
function StudentAppResults({ rows, userId }: { rows: AppResult[]; userId: string }) {
  const completed = rows.filter((r) => r.completed).length;
  const totalSeconds = rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative isolate flex items-center gap-4 overflow-hidden rounded-[2rem] bg-grad-science p-5 shadow-(--shadow-md) ring-1 ring-science-strong/15 sm:gap-5 sm:px-7 dark:shadow-none">
        <span className="pointer-events-none absolute -top-10 -right-8 -z-10 size-40 rounded-full bg-card/45 dark:bg-card/20" aria-hidden />
        {completed > 0 ? (
          <Mascot pose="cheer" width={104} className="w-20 shrink-0 drop-shadow-[0_10px_14px_oklch(0.35_0.12_288/0.25)] sm:w-26" />
        ) : (
          <Icon3D name="test-tube" size={72} className="size-16 shrink-0 sm:size-18" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-heading text-2xl leading-tight sm:text-3xl">
            완료한 학습 <span className="text-science-ink">{completed}</span>개
          </p>
          <p className="text-sm text-foreground/75">
            기록 {rows.length}개 · 모두 {formatDuration(totalSeconds)} 동안 탐구했어요
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-3" aria-label="웹앱 결과">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-[1.5rem] bg-card p-4 shadow-(--shadow-sm) ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:gap-4 sm:p-5 dark:shadow-none dark:ring-foreground/10"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad-science" aria-hidden>
                <Icon3D name="test-tube" size={32} className="size-8" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="leading-snug font-semibold">
                  <span className={appTitle(r.app_id) ? undefined : "text-muted-foreground"}>{appLabel(r.app_id)}</span>
                  {!appTitle(r.app_id) ? <span className="ml-1 text-xs font-normal text-muted-foreground">({r.app_id})</span> : null}
                </p>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>점수 {formatScore(r.score, r.max_score)}</span>
                  <span>소요 {formatDuration(r.duration_seconds)}</span>
                  <time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <CompletedPill completed={r.completed} />
              <FeedbackDialogButton
                studentId={userId}
                context={{ type: "app_result", id: r.id }}
                audience="student"
                title={`${appLabel(r.app_id)} · ${formatDateTime(r.created_at)}`}
                size="sm"
                variant="outline"
                label="대화"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 학생 기록 카드의 완료 표시: 아이콘 + 글자(색만으로 구분하지 않음) */
function CompletedPill({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-science-soft px-2.5 py-1 text-xs font-semibold text-science-ink">
      <CheckCircle2Icon className="size-3.5" aria-hidden />
      완료
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <CircleDashedIcon className="size-3.5" aria-hidden />
      미완료
    </span>
  );
}

function PostTitleLink({ post }: { post: { title: string; slug: string; published?: boolean } | null }) {
  if (!post) return <span className="text-muted-foreground">비공개이거나 삭제된 글</span>;
  return (
    <Link href={postHref(post.slug)} className="font-medium hover:underline">
      {post.title}
      {post.published === false ? <span className="ml-1 text-xs font-normal text-muted-foreground">(비공개)</span> : null}
    </Link>
  );
}

/** 목록 틀: 학생 화면은 흰 둥근 카드(디자인 개편 2단계), 관리자 화면은 흰 판 + 작은 그림자(4단계, adminSurfaceClass) */
function listShell(audience: Audience) {
  return audience === "student"
    ? "overflow-hidden rounded-[1.5rem] bg-card shadow-(--shadow-sm) ring-1 ring-foreground/5 dark:shadow-none dark:ring-foreground/10"
    : cn("rounded-xl", adminSurfaceClass);
}

/** 읽은 글 탭 */
export function UserPostReads({ userId, audience }: { userId: string; audience: Audience }) {
  const load = useCallback(() => fetchUserPostReads(userId), [userId]);
  const { state, reload } = useAsyncData(load);
  return (
    <AsyncView
      state={state}
      onRetry={reload}
      audience={audience}
      errorText="읽은 글을 불러오지 못했어요."
      isEmpty={(rows) => !rows.length}
      empty={
        <EmptyState
          title="아직 읽은 글이 없어요"
          description={audience === "student" ? "로그인한 상태로 글을 열면 여기에 기록돼요." : undefined}
          illustration={audience === "student" ? <EmptyOwl /> : undefined}
        />
      }
    >
      {(rows) => (
        <ul className={cn("flex flex-col divide-y", listShell(audience))} aria-label="읽은 글">
          {rows.map((r) => (
            <li key={r.post_id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="min-w-0 flex-1 truncate">
                <PostTitleLink post={r.posts} />
              </span>
              <span className="flex shrink-0 flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{formatCount(r.read_count)}번 읽음</span>
                <span>처음 {formatDateTime(r.first_read_at)}</span>
                <span>최근 {formatDateTime(r.last_read_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </AsyncView>
  );
}

/** 댓글·좋아요 탭 */
export function UserSocial({ userId, audience }: { userId: string; audience: Audience }) {
  const loadComments = useCallback(() => fetchUserComments(userId), [userId]);
  const loadLikes = useCallback(() => fetchUserLikes(userId), [userId]);
  const comments = useAsyncData(loadComments);
  const likes = useAsyncData(loadLikes);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-labelledby={`comments-${userId}`}>
        <h3 id={`comments-${userId}`} className="flex items-center gap-2 font-medium">
          <MessageSquareIcon className="size-4 text-muted-foreground" aria-hidden />
          {audience === "student" ? "내가 쓴 댓글" : "쓴 댓글"}
          {comments.state.status === "ready" ? <Badge variant="secondary">{comments.state.data.length}</Badge> : null}
        </h3>
        {audience === "student" ? (
          <p className="text-xs text-muted-foreground">댓글 수정·삭제는 글 화면에서 할 수 있어요.</p>
        ) : null}
        <AsyncView
          state={comments.state}
          onRetry={comments.reload}
          audience={audience}
          errorText="댓글을 불러오지 못했어요."
          isEmpty={(rows) => !rows.length}
          empty={<EmptyState title="아직 쓴 댓글이 없어요" illustration={audience === "student" ? <EmptyOwl /> : undefined} />}
        >
          {(rows) => (
            <ul className={cn("flex flex-col divide-y", listShell(audience))}>
              {rows.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 p-3">
                  <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate text-sm">
                      <PostTitleLink post={c.posts} />
                    </span>
                    <time dateTime={c.created_at}>{formatDateTime(c.created_at)}</time>
                  </span>
                  <p className="line-clamp-3 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </AsyncView>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={`likes-${userId}`}>
        <h3 id={`likes-${userId}`} className="flex items-center gap-2 font-medium">
          <HeartIcon className="size-4 text-muted-foreground" aria-hidden />
          {audience === "student" ? "내가 좋아요한 글" : "좋아요한 글"}
          {likes.state.status === "ready" ? <Badge variant="secondary">{likes.state.data.length}</Badge> : null}
        </h3>
        <AsyncView
          state={likes.state}
          onRetry={likes.reload}
          audience={audience}
          errorText="좋아요한 글을 불러오지 못했어요."
          isEmpty={(rows) => !rows.length}
          empty={<EmptyState title="아직 좋아요한 글이 없어요" illustration={audience === "student" ? <EmptyOwl /> : undefined} />}
        >
          {(rows) => (
            <ul className={cn("flex flex-col divide-y", listShell(audience))}>
              {rows.map((l) => (
                <li key={l.post_id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0 truncate">
                    <PostTitleLink post={l.posts} />
                  </span>
                  <time dateTime={l.created_at} className="text-xs text-muted-foreground">
                    {formatDateTime(l.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </AsyncView>
      </section>
    </div>
  );
}

/** 제출 내용(본문 마크다운 + 링크) 펼쳐 보기 */
export function SubmissionContent({ body, link }: { body: string; link: string | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-3">
      {link ? (
        isHttpUrl(link) ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex max-w-full items-center gap-1 text-sm font-medium break-all text-primary underline-offset-4 hover:underline"
          >
            <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
            {link}
          </a>
        ) : (
          <span className="text-sm break-all text-muted-foreground">{link}</span>
        )
      ) : null}
      {body.trim() ? (
        <MarkdownViewer content={body} className="text-sm" />
      ) : (
        <p className="text-sm text-muted-foreground">본문 없음</p>
      )}
    </div>
  );
}

function SubmissionRow({ s, userId, studentName }: { s: SubmissionWithAssignment; userId: string; studentName?: string }) {
  const [open, setOpen] = useState(false);
  const title = s.assignments?.title ?? "삭제되었거나 비공개인 과제";
  return (
    <li className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        <SubmissionStatusBadge status={s.status} />
        {isLate(s.submitted_at, s.assignments?.due_at) ? <LateBadge /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>제출 {formatDateTime(s.submitted_at)}</span>
        {s.updated_at !== s.submitted_at ? <span>최근 변경 {formatDateTime(s.updated_at)}</span> : null}
        {s.assignments?.due_at ? <span>마감 {formatDateTime(s.assignments.due_at)}</span> : <span>마감 없음</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDownIcon className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          {open ? "내용 접기" : "내용 보기"}
        </Button>
        {s.assignments ? (
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/admin/learning/?tab=assignments&assignment=${s.assignment_id}`} />}
            nativeButton={false}
          >
            제출 현황에서 검토
          </Button>
        ) : null}
        <FeedbackDialogButton
          studentId={userId}
          context={{ type: "assignment_submission", id: s.id }}
          audience="admin"
          studentName={studentName}
          title={`과제 · ${title}`}
        />
      </div>
      {open ? <SubmissionContent body={s.body_md} link={s.link_url} /> : null}
    </li>
  );
}

/** 회원 상세의 과제 제출 탭(관리자, 읽기 + 피드백. 상태 변경은 제출 현황 화면에서) */
export function UserSubmissions({ userId, studentName }: { userId: string; studentName?: string }) {
  const load = useCallback(() => fetchUserSubmissions(userId), [userId]);
  const { state, reload } = useAsyncData(load);
  return (
    <AsyncView
      state={state}
      onRetry={reload}
      errorText="과제 제출을 불러오지 못했습니다."
      isEmpty={(rows) => !rows.length}
      empty={<EmptyState title="제출한 과제가 없습니다" />}
    >
      {(rows) => (
        <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)}>
          {rows.map((s) => (
            <SubmissionRow key={s.id} s={s} userId={userId} studentName={studentName} />
          ))}
        </ul>
      )}
    </AsyncView>
  );
}

export { SectionTitle };
