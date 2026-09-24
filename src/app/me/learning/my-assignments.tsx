"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { CalendarClockIcon, ChevronDownIcon, Loader2Icon, PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { FeedbackDialogButton } from "@/components/feedback/feedback-center";
import { SubmissionContent } from "@/components/learning/activity-panels";
import { ConfirmDialog } from "@/components/learning/confirm-dialog";
import { AsyncView, LateBadge, SubmissionStatusBadge } from "@/components/learning/learning-ui";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { EmptyOwl, EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatDateTime } from "@/lib/format";
import {
  createSubmission,
  deleteSubmission,
  errorMessage,
  fetchPublishedAssignments,
  fetchUserSubmissions,
  isLate,
  isMissingSchemaError,
  isPastDue,
  studentDeleteBlockReason,
  SUBMISSION_BODY_MAX,
  SUBMISSION_LINK_MAX,
  updateSubmissionContent,
} from "@/lib/learning";
import { isHttpUrl } from "@/lib/slug";
import type { Assignment, AssignmentSubmission } from "@/lib/types";
import { primaryPillClass } from "@/lib/pill";
import { cn } from "@/lib/utils";

type Item = { assignment: Assignment; submission: AssignmentSubmission | null };

/** 학생 과제 탭: 공개된 과제 + 내 제출 상태, 제출/수정/삭제(spec §3.8, §14 Q1·Q8). */
export function MyAssignments({ userId }: { userId: string }) {
  const load = useCallback(async (): Promise<Item[]> => {
    const [assignments, submissions] = await Promise.all([fetchPublishedAssignments(), fetchUserSubmissions(userId)]);
    const byAssignment = new Map(submissions.map((s) => [s.assignment_id, s]));
    return assignments.map((a) => {
      const s = byAssignment.get(a.id);
      if (!s) return { assignment: a, submission: null };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { assignments: _joined, ...submission } = s;
      return { assignment: a, submission };
    });
  }, [userId]);
  const { state, reload, setData } = useAsyncData(load);

  function replaceSubmission(assignmentId: string, submission: AssignmentSubmission | null) {
    setData((items) => items.map((it) => (it.assignment.id === assignmentId ? { ...it, submission } : it)));
  }

  return (
    <AsyncView
      state={state}
      onRetry={reload}
      audience="student"
      errorText="과제를 불러오지 못했어요."
      isEmpty={(items) => !items.length}
      empty={
        <EmptyState
          title="아직 올라온 과제가 없어요"
          description="선생님이 과제를 올리면 여기에서 제출할 수 있어요."
          illustration={<EmptyOwl />}
        />
      }
    >
      {(items) => (
        <ul className="flex flex-col gap-4">
          {items.map((it) => (
            <AssignmentCard key={it.assignment.id} item={it} userId={userId} onChange={replaceSubmission} />
          ))}
        </ul>
      )}
    </AsyncView>
  );
}

function AssignmentCard({
  item,
  userId,
  onChange,
}: {
  item: Item;
  userId: string;
  onChange: (assignmentId: string, submission: AssignmentSubmission | null) => void;
}) {
  const { assignment: a, submission: s } = item;
  const [showDesc, setShowDesc] = useState(!s);
  const [showMine, setShowMine] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  // 저장 중에는 다이얼로그를 닫지 못하게 한다(닫았다 다시 열어 중복 제출되는 것 방지, review #15).
  const [formSaving, setFormSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pastDue = isPastDue(a.due_at);
  const blockReason = s ? studentDeleteBlockReason(s, a.due_at) : null;
  // 검토 완료된 제출물은 학생이 고칠 수 없다(DB 트리거가 강제, review #3).
  const editBlockReason = s?.status === "reviewed" ? "선생님이 검토를 마친 제출물은 수정할 수 없어요." : null;

  async function onDelete() {
    if (!s) return;
    setDeleting(true);
    try {
      await deleteSubmission(s.id);
      onChange(a.id, null);
      setDeleteOpen(false);
      toast.success("제출을 삭제했어요. 다시 제출할 수 있어요.");
    } catch {
      // RLS가 0건으로 막은 경우(마감 · 검토 완료가 그사이 바뀜)도 여기로 온다.
      toast.error("제출을 삭제하지 못했어요. 마감이 지났거나 선생님이 검토를 마쳤을 수 있어요.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-[1.75rem] bg-card p-5 shadow-(--shadow-md) ring-1 ring-foreground/5 sm:p-6 dark:shadow-none dark:ring-foreground/10">
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="min-w-0 flex-1 font-heading text-xl leading-snug font-normal break-keep">{a.title}</h3>
        <SubmissionStatusBadge status={s?.status ?? null} />
        {s && isLate(s.submitted_at, a.due_at) ? <LateBadge /> : null}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClockIcon className="size-3.5" aria-hidden />
          {a.due_at ? `마감 ${formatDateTime(a.due_at)}` : "마감 없음"}
        </span>
        {pastDue ? <Badge variant="outline">마감 지남</Badge> : null}
        {s ? <span>제출 {formatDateTime(s.submitted_at)}</span> : null}
        {s && s.updated_at !== s.submitted_at ? <span>최근 변경 {formatDateTime(s.updated_at)}</span> : null}
      </p>

      {s?.status === "needs_revision" ? (
        <p className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
          선생님이 수정을 요청했어요. 피드백을 확인하고 내용을 고쳐 주세요. 수정하면 다시 “검토 대기”로 바뀌어요.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowDesc((v) => !v)} aria-expanded={showDesc}>
          <ChevronDownIcon className={showDesc ? "rotate-180 transition-transform" : "transition-transform"} />
          과제 설명
        </Button>
        {s ? (
          <Button variant="ghost" size="sm" onClick={() => setShowMine((v) => !v)} aria-expanded={showMine}>
            <ChevronDownIcon className={showMine ? "rotate-180 transition-transform" : "transition-transform"} />
            내 제출 내용
          </Button>
        ) : null}
      </div>

      {showDesc ? (
        a.description_md.trim() ? (
          <MarkdownViewer content={a.description_md} className="rounded-2xl bg-muted/40 p-4 text-sm" />
        ) : (
          <p className="text-sm text-muted-foreground">설명이 없는 과제예요.</p>
        )
      ) : null}
      {s && showMine ? <SubmissionContent body={s.body_md} link={s.link_url} /> : null}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {s ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(true)}
              disabled={!!editBlockReason}
              title={editBlockReason ?? undefined}
            >
              <PencilIcon />
              수정
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={!!blockReason}
              title={blockReason ?? undefined}
            >
              <Trash2Icon />
              삭제
            </Button>
            <FeedbackDialogButton
              studentId={userId}
              context={{ type: "assignment_submission", id: s.id }}
              audience="student"
              title={`과제 · ${a.title}`}
            />
            {editBlockReason ? (
              <span className="text-xs text-muted-foreground">{editBlockReason} 삭제도 할 수 없어요.</span>
            ) : blockReason ? (
              <span className="text-xs text-muted-foreground">{blockReason}</span>
            ) : null}
          </>
        ) : (
          <Button className={cn(primaryPillClass, "h-10")} onClick={() => setFormOpen(true)}>
            <SendIcon />
            제출하기
          </Button>
        )}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(next) => {
          if (!formSaving) setFormOpen(next);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {formOpen ? (
            <SubmissionForm
              assignment={a}
              submission={s}
              onSavingChange={setFormSaving}
              onDone={(next) => {
                if (next) onChange(a.id, next);
                setFormOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="제출을 삭제할까요?"
        description="삭제한 뒤 다시 제출할 수 있어요. 이 제출에 대한 선생님과의 대화는 남아 있어요."
        confirmLabel="삭제"
        destructive
        busy={deleting}
        onConfirm={onDelete}
      />
    </li>
  );
}

function SubmissionForm({
  assignment,
  submission,
  onDone,
  onSavingChange,
}: {
  assignment: Assignment;
  submission: AssignmentSubmission | null;
  onDone: (next: AssignmentSubmission | null) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [body, setBody] = useState(submission?.body_md ?? "");
  const [link, setLink] = useState(submission?.link_url ?? "");
  const [errors, setErrors] = useState<{ body?: string; link?: string; form?: string }>({});
  const [saving, setSavingState] = useState(false);
  const savingRef = useRef(false); // 빠른 연타로 두 번 제출되지 않게(review #14)
  const pastDue = isPastDue(assignment.due_at);

  function setSaving(v: boolean) {
    savingRef.current = v;
    setSavingState(v);
    onSavingChange(v);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    const text = body.trim();
    const url = link.trim();
    const next: typeof errors = {};
    if (!text && !url) next.body = "내용이나 링크 중 하나는 입력해 주세요.";
    if (text.length > SUBMISSION_BODY_MAX) next.body = `${SUBMISSION_BODY_MAX.toLocaleString()}자까지 쓸 수 있어요.`;
    if (url && !isHttpUrl(url)) next.link = "http:// 또는 https://로 시작하는 주소를 입력해 주세요.";
    else if (url.length > SUBMISSION_LINK_MAX) next.link = "주소가 너무 길어요.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const input = { body_md: text, link_url: url || null };
      const saved = submission ? await updateSubmissionContent(submission.id, input) : await createSubmission(assignment.id, input);
      toast.success(
        !submission
          ? "과제를 제출했어요."
          : submission.status === "needs_revision" && saved.status === "submitted"
            ? "수정했어요. 다시 선생님의 검토를 기다려요."
            : "제출 내용을 수정했어요.",
      );
      setSaving(false);
      onDone(saved);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setErrors({
        form: isMissingSchemaError(err)
          ? errorMessage(true, "", "student")
          : code === "23505"
            ? "이미 제출한 과제예요. 화면을 새로고침한 뒤 수정해 주세요."
            : code === "42501"
              ? "지금은 제출할 수 없는 과제예요. 선생님께 문의해 주세요."
              : /검토 완료/.test((err as { message?: string } | null)?.message ?? "")
                ? "선생님이 검토를 마친 제출물이라 수정할 수 없어요. 화면을 새로고침해 주세요."
                : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{submission ? "제출 내용 수정" : "과제 제출"}</DialogTitle>
        <DialogDescription>{assignment.title}</DialogDescription>
      </DialogHeader>

      {pastDue ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          마감이 지났어요. {submission ? "수정은 할 수 있어요." : "제출은 되지만 “지각”으로 표시돼요."}
        </p>
      ) : null}
      {submission?.status === "needs_revision" ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          수정해서 저장하면 다시 “검토 대기”로 바뀌어 선생님이 확인해요.
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="submission-body">내용</Label>
        <Textarea
          id="submission-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={SUBMISSION_BODY_MAX}
          placeholder="과제 내용을 적어 주세요. 마크다운을 쓸 수 있어요."
          className="max-h-[50dvh] min-h-40"
          aria-invalid={Boolean(errors.body)}
          disabled={saving}
        />
        {errors.body ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.body}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {body.length.toLocaleString()} / {SUBMISSION_BODY_MAX.toLocaleString()}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="submission-link">링크 (선택)</Label>
        <Input
          id="submission-link"
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
          className="h-9"
          aria-invalid={Boolean(errors.link)}
          disabled={saving}
        />
        {errors.link ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.link}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)} disabled={saving}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          {submission ? "저장" : "제출"}
        </Button>
      </DialogFooter>
    </form>
  );
}
