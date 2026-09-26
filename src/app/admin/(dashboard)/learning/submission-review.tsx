"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CalendarClockIcon, ChevronDownIcon, LockIcon, PencilIcon, SchoolIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { FeedbackDialogButton } from "@/components/feedback/feedback-center";
import { SubmissionContent } from "@/components/learning/activity-panels";
import { ConfirmDialog } from "@/components/learning/confirm-dialog";
import { AsyncView, LateBadge, NativeSelect, StudentLink, SubmissionStatusBadge } from "@/components/learning/learning-ui";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { canModifyContent, OWNER_ONLY_EDIT, useAdminContext, useStudentScope } from "@/hooks/use-admin-context";
import { useAsyncData } from "@/hooks/use-async-data";
import { adminDisplayName } from "@/lib/admin";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  deleteSubmission,
  fetchAssignment,
  fetchStudents,
  fetchSubmissionsForAssignment,
  isLate,
  SUBMISSION_STATUS_LABELS,
  updateSubmissionStatus,
  type AdminAssignment,
  type StudentMini,
} from "@/lib/learning";
import type { Assignment, AssignmentSubmission, SubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AssignmentForm } from "./assignment-manager";

type Data = {
  assignment: AdminAssignment | null;
  /** 명단("미제출" 포함): 학급별 과제면 그 과제의 학급 학생, 예전 과제면 학습 현황의 학급 범위 학생 */
  students: StudentMini[];
  /** 내 다른 학급 학생(학급별 과제만) — 반을 옮기기 전에 이 과제를 낸 학생에게 이름을 붙이는 데만 쓴다 */
  others: StudentMini[];
  submissions: AssignmentSubmission[];
  /**
   * 학급별 과제인데 내 학급 과제가 아님(총괄이 주소로 연 다른 학급 과제, 담임을 넘긴 뒤의 내 과제 등).
   * 그 학급 학생의 제출물은 그 학급 담임만 본다(개정 1-1 — 총괄도) → 학생 명단·제출 현황을 보이지 않는다.
   */
  outsideClass: boolean;
};

/** 과제의 학급 id(학급별 과제일 때만 — 학급 열이 없던 예전 과제는 null) */
function classIdOf(a: AdminAssignment): string | null {
  return typeof a.class_id === "string" && a.class_id ? a.class_id : null;
}

type Row = { studentId: string; student: StudentMini | null; submission: AssignmentSubmission | null };

type Filter = "all" | "none" | SubmissionStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "none", label: "미제출" },
  { id: "submitted", label: "검토 대기" },
  { id: "needs_revision", label: "수정 요청" },
  { id: "reviewed", label: "검토 완료" },
];

function BackLink() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      render={<Link href="/admin/learning/?tab=assignments" />}
      nativeButton={false}
    >
      <ArrowLeftIcon />
      과제 목록
    </Button>
  );
}

/**
 * 과제 제출 현황(?tab=assignments&assignment={id}): 학생별 1행(미제출 포함) · 상태 배지 · 지각 배지 ·
 * 제출 내용 펼쳐 보기 · 상태 변경 · 연결된 피드백 대화 · 삭제(spec §3.6).
 */
export function SubmissionReview({ assignmentId }: { assignmentId: string | null }) {
  // 학생 명단은 내 학급 학생만 — 총괄도 다른 학급 학생은 "미제출"로 섞지 않는다(docs/classes/spec.md 개정 1-1).
  //  - 학급별 과제(⑥ 뒤): 그 과제의 학급 학생(학급 고르기와 상관없이 — 과제가 한 학급 것이다). 내 학급 과제가 아니면 명단 없음.
  //  - 학급 없는 예전 과제(⑥ 전): 학습 현황의 학급 범위(학급을 골랐으면 그 학급).
  const { classIds, allClassIds, narrowed, ready: classMode } = useStudentScope();
  const adminCtx = useAdminContext();
  const load = useCallback(async (): Promise<Data> => {
    if (!assignmentId) return { assignment: null, students: [], others: [], submissions: [], outsideClass: false };
    const [assignment, submissions] = await Promise.all([
      fetchAssignment(assignmentId),
      fetchSubmissionsForAssignment(assignmentId),
    ]);
    if (!assignment) return { assignment: null, students: [], others: [], submissions, outsideClass: false };
    const cls = classIdOf(assignment);
    if (cls && allClassIds) {
      if (!allClassIds.includes(cls)) return { assignment, students: [], others: [], submissions: [], outsideClass: true };
      const mine = await fetchStudents(allClassIds);
      return {
        assignment,
        students: mine.filter((st) => st.class_id === cls),
        others: mine.filter((st) => st.class_id !== cls),
        submissions,
        outsideClass: false,
      };
    }
    const students = await fetchStudents(classIds);
    // 학급을 하나 골랐으면 그 학급 학생의 제출만(제출 기록은 RLS가 내 학급 전체를 돌려준다).
    const roster = new Set(students.map((st) => st.id));
    return {
      assignment,
      students,
      others: [],
      submissions: narrowed ? submissions.filter((sub) => roster.has(sub.user_id)) : submissions,
      outsideClass: false,
    };
  }, [assignmentId, classIds, allClassIds, narrowed]);
  const { state, reload, setData } = useAsyncData(load);
  const [filter, setFilter] = useState<Filter>("all");
  const [editOpen, setEditOpen] = useState(false);

  const rows = useMemo<Row[]>(() => {
    if (state.status !== "ready") return [];
    const { students, others, submissions } = state.data;
    const byUser = new Map(submissions.map((s) => [s.user_id, s]));
    const list: Row[] = students.map((st) => ({ studentId: st.id, student: st, submission: byUser.get(st.id) ?? null }));
    // 학생 목록에 없는 제출자(관리자 계정, 내 다른 학급으로 옮긴 학생 등)도 빠뜨리지 않는다.
    for (const s of submissions) {
      if (!students.some((st) => st.id === s.user_id)) {
        list.push({ studentId: s.user_id, student: others.find((st) => st.id === s.user_id) ?? null, submission: s });
      }
    }
    return list.sort((a, b) => {
      const an = adminDisplayName(a.student, a.student?.email || "");
      const bn = adminDisplayName(b.student, b.student?.email || "");
      return an.localeCompare(bn, "ko");
    });
  }, [state]);

  function replaceSubmission(next: AssignmentSubmission | null, id: string) {
    setData((d) => ({
      ...d,
      submissions: next ? d.submissions.map((s) => (s.id === id ? next : s)) : d.submissions.filter((s) => s.id !== id),
    }));
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink />
      <AsyncView state={state} onRetry={reload} errorText="제출 현황을 불러오지 못했습니다.">
        {({ assignment, outsideClass }) => {
          if (!assignment) {
            return (
              <EmptyState
                title="과제를 찾을 수 없습니다"
                description="주소가 잘못되었거나 삭제된 과제입니다."
                action={
                  <Button variant="outline" render={<Link href="/admin/learning/?tab=assignments" />} nativeButton={false}>
                    과제 목록으로
                  </Button>
                }
              />
            );
          }
          const counts = {
            all: rows.length,
            none: rows.filter((r) => !r.submission).length,
            submitted: rows.filter((r) => r.submission?.status === "submitted").length,
            needs_revision: rows.filter((r) => r.submission?.status === "needs_revision").length,
            reviewed: rows.filter((r) => r.submission?.status === "reviewed").length,
          } satisfies Record<Filter, number>;
          const visible = rows.filter((r) =>
            filter === "all" ? true : filter === "none" ? !r.submission : r.submission?.status === filter,
          );
          const cls = classIdOf(assignment);
          // 과제의 학급 이름: 내 학급이 여럿이거나 내 학급 과제가 아닐 때(관리자 화면에서만)
          const myClassCount = adminCtx.status === "ready" ? adminCtx.classes.length : 0;
          const classLabel = cls && (myClassCount > 1 || outsideClass) ? (adminCtx.classNameOf(cls) ?? "다른 학급") : null;
          return (
            <div className="flex flex-col gap-5">
              <AssignmentHeader
                assignment={assignment}
                classLabel={classLabel}
                canEdit={canModifyContent(adminCtx, assignment.created_by)}
                onEdit={() => setEditOpen(true)}
              />

              {outsideClass ? (
                <p role="note" className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">내 학급 과제가 아니에요 · </span>
                  {classLabel && classLabel !== "다른 학급" ? `‘${classLabel}’` : "다른 학급"} 과제의 제출 현황은 그 학급 담임
                  선생님만 볼 수 있어요.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="상태로 거르기">
                    {FILTERS.map((f) => (
                      <Button
                        key={f.id}
                        size="sm"
                        variant={filter === f.id ? "secondary" : "ghost"}
                        aria-pressed={filter === f.id}
                        onClick={() => setFilter(f.id)}
                      >
                        {f.label}
                        <span className="text-muted-foreground">{formatCount(counts[f.id])}</span>
                      </Button>
                    ))}
                  </div>

                  {!visible.length ? (
                    <EmptyState
                      title={
                        rows.length
                          ? "해당하는 학생이 없습니다"
                          : cls
                            ? "이 학급에 학생이 아직 없어요"
                            : classMode
                              ? "내 학급 학생이 아직 없어요"
                              : "등록된 학생이 없습니다"
                      }
                      description={!rows.length && classMode ? "‘회원 관리’에서 학생을 등록하면 여기에 나타나요." : undefined}
                    />
                  ) : (
                    <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)} aria-label="학생별 제출 현황">
                      {visible.map((r) => (
                        <SubmissionRow
                          key={r.studentId}
                          row={r}
                          assignment={assignment}
                          onChange={(next, id) => replaceSubmission(next, id)}
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}

              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
                  {editOpen ? (
                    <AssignmentForm
                      assignment={assignment}
                      classMode={!!cls}
                      onDone={(saved) => {
                        // 고치기 응답에는 class_id가 없다(학급은 바뀌지 않음) → 원래 값과 합친다
                        if (saved) setData((d) => ({ ...d, assignment: d.assignment ? { ...d.assignment, ...saved } : saved }));
                        setEditOpen(false);
                      }}
                    />
                  ) : null}
                </DialogContent>
              </Dialog>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}

/**
 * canEdit: 과제 내용 고치기는 쓴 선생님과 총괄만(20260927030000_content_owner_only.sql). 제출물 검토는 그대로 담임이 한다.
 * classLabel: 과제의 학급 이름(학급별 과제 — 내 학급이 여럿이거나 내 학급 과제가 아닐 때만, 관리자 화면에서만).
 */
function AssignmentHeader({
  assignment,
  classLabel,
  canEdit,
  onEdit,
}: {
  assignment: Assignment;
  classLabel: string | null;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-(--shadow-md) ring-1 ring-foreground/10 sm:p-5 dark:shadow-none">
      <div className="flex flex-wrap items-start gap-2">
        <h2 className="min-w-0 flex-1 font-heading text-2xl leading-snug font-normal break-keep">{assignment.title}</h2>
        <Badge variant={assignment.published ? "default" : "outline"}>{assignment.published ? "공개" : "비공개"}</Badge>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {classLabel ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <SchoolIcon className="size-4 text-muted-foreground" aria-hidden />
            {classLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <CalendarClockIcon className="size-4" aria-hidden />
          {assignment.due_at ? `마감 ${formatDateTime(assignment.due_at)}` : "마감 없음"}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <ChevronDownIcon className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          과제 설명
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={!canEdit}
          aria-describedby={canEdit ? undefined : "assignment-edit-lock"}
        >
          <PencilIcon />
          과제 수정
        </Button>
      </div>
      {!canEdit ? (
        <p id="assignment-edit-lock" role="note" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LockIcon className="size-3.5 shrink-0" aria-hidden />
          {OWNER_ONLY_EDIT}
        </p>
      ) : null}
      {open ? (
        assignment.description_md.trim() ? (
          <MarkdownViewer content={assignment.description_md} className="rounded-xl bg-muted/30 p-3 text-sm" />
        ) : (
          <p className="text-sm text-muted-foreground">설명이 없습니다.</p>
        )
      ) : null}
    </section>
  );
}

function SubmissionRow({
  row,
  assignment,
  onChange,
}: {
  row: Row;
  assignment: Assignment;
  onChange: (next: AssignmentSubmission | null, id: string) => void;
}) {
  const s = row.submission;
  const [open, setOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 표시 이름이 없으면 아이디(이메일 앞부분)로. 탈퇴 학생은 "탈퇴한 학생(원래 이름)"(관리자 화면 공통 형식).
  const fallbackName = row.student?.email?.split("@")[0] || "이름 없음";
  const name = adminDisplayName(row.student, fallbackName);

  async function onStatus(next: SubmissionStatus) {
    if (!s || next === s.status) return;
    setStatusBusy(true);
    try {
      onChange(await updateSubmissionStatus(s.id, next), s.id);
      toast.success(`${name}: ${SUBMISSION_STATUS_LABELS[next]}(으)로 바꿨습니다.`);
    } catch {
      toast.error("상태를 바꾸지 못했습니다.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function onDelete() {
    if (!s) return;
    setDeleting(true);
    try {
      await deleteSubmission(s.id);
      onChange(null, s.id);
      setDeleteOpen(false);
      toast.success("제출물을 삭제했습니다.");
    } catch {
      toast.error("제출물을 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 basis-40">
          {/* StudentLink가 adminDisplayName으로 한 번만 감싼다 — 이미 감싼 이름(name)을 다시 넘기면
              "탈퇴한 학생(탈퇴한 학생(원래 이름))"처럼 두 번 감싸졌다. 원래 표시 이름과 아이디 대체값을 넘긴다. */}
          <StudentLink
            id={row.studentId}
            profile={
              row.student
                ? { display_name: row.student.display_name, avatar_url: row.student.avatar_url, withdrawn_at: row.student.withdrawn_at }
                : null
            }
            fallback={fallbackName}
            tab="assignments"
          />
        </span>
        <SubmissionStatusBadge status={s?.status ?? null} />
        {s && isLate(s.submitted_at, assignment.due_at) ? <LateBadge /> : null}
        {s ? (
          <span className="text-xs text-muted-foreground">
            제출 {formatDateTime(s.submitted_at)}
            {s.updated_at !== s.submitted_at ? ` · 최근 변경 ${formatDateTime(s.updated_at)}` : ""}
          </span>
        ) : null}
      </div>
      {s ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <ChevronDownIcon className={open ? "rotate-180 transition-transform" : "transition-transform"} />
            {open ? "내용 접기" : "내용 보기"}
          </Button>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="sr-only">{name} 제출 상태</span>
            <NativeSelect
              value={s.status}
              disabled={statusBusy}
              onChange={(e) => onStatus(e.target.value as SubmissionStatus)}
              aria-label={`${name} 제출 상태`}
            >
              {(Object.keys(SUBMISSION_STATUS_LABELS) as SubmissionStatus[]).map((st) => (
                <option key={st} value={st}>
                  {SUBMISSION_STATUS_LABELS[st]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <FeedbackDialogButton
            studentId={row.studentId}
            context={{ type: "assignment_submission", id: s.id }}
            audience="admin"
            studentName={name}
            studentWithdrawn={Boolean(row.student?.withdrawn_at)}
            title={`${name} · ${assignment.title}`}
            label="피드백 남기기"
          />
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            삭제
          </Button>
        </div>
      ) : null}
      {s && open ? <SubmissionContent body={s.body_md} link={s.link_url} /> : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="제출물을 삭제할까요?"
        description={`${name}의 제출물이 삭제되며 되돌릴 수 없습니다. 학생은 다시 제출할 수 있고, 이 제출에 대한 피드백 대화는 남습니다.`}
        confirmLabel="삭제"
        destructive
        busy={deleting}
        onConfirm={onDelete}
      />
    </li>
  );
}
