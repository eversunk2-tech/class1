"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarClockIcon, EyeIcon, Loader2Icon, PencilIcon, PencilLineIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { ConfirmDialog } from "@/components/learning/confirm-dialog";
import { AsyncView, SectionTitle } from "@/components/learning/learning-ui";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  createAssignment,
  deleteAssignment,
  errorMessage,
  fetchAssignments,
  fetchStudents,
  fromDateTimeLocal,
  isMissingSchemaError,
  isPastDue,
  toDateTimeLocal,
  updateAssignment,
  type AssignmentInput,
  type AssignmentWithCount,
} from "@/lib/learning";
import type { Assignment } from "@/lib/types";
import { cn } from "@/lib/utils";

const TITLE_MAX = 200;

type Data = { assignments: AssignmentWithCount[]; studentCount: number | null };

/** 학습 현황 > 과제 관리: 목록 · 새 과제 · 수정 · 공개 전환 · 삭제(spec §3.6). */
export function AssignmentManager() {
  const load = useCallback(async (): Promise<Data> => {
    const [assignments, students] = await Promise.all([
      fetchAssignments(),
      // 학생 수는 보조 정보라 실패해도 목록은 보여 준다.
      fetchStudents().catch(() => null),
    ]);
    return { assignments, studentCount: students ? students.length : null };
  }, []);
  const { state, reload, setData } = useAsyncData(load);

  const [editing, setEditing] = useState<Assignment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AssignmentWithCount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function upsert(a: Assignment) {
    setData((d) => {
      const exists = d.assignments.some((x) => x.id === a.id);
      return {
        ...d,
        assignments: exists
          ? d.assignments.map((x) => (x.id === a.id ? { ...x, ...a } : x))
          : [{ ...a, submission_count: 0 }, ...d.assignments],
      };
    });
  }

  async function togglePublished(a: AssignmentWithCount, next: boolean) {
    if (busyIds.has(a.id)) return;
    setBusyIds((prev) => new Set(prev).add(a.id));
    try {
      upsert(await updateAssignment(a.id, { published: next }));
      toast.success(next ? "과제를 공개했습니다." : "과제를 비공개로 바꿨습니다.");
    } catch {
      toast.error("공개 상태를 바꾸지 못했습니다.");
    } finally {
      setBusyIds((prev) => {
        const s = new Set(prev);
        s.delete(a.id);
        return s;
      });
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteAssignment(deleting.id);
      const id = deleting.id;
      setData((d) => ({ ...d, assignments: d.assignments.filter((x) => x.id !== id) }));
      setDeleteOpen(false);
      toast.success("과제를 삭제했습니다.");
    } catch {
      toast.error("과제를 삭제하지 못했습니다.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        actions={
          <Button className="h-9 px-4" onClick={openNew} disabled={state.status !== "ready"}>
            <PlusIcon />새 과제
          </Button>
        }
      >
        과제 목록
      </SectionTitle>

      <AsyncView
        state={state}
        onRetry={reload}
        errorText="과제 목록을 불러오지 못했습니다."
        isEmpty={(d) => !d.assignments.length}
        empty={
          <EmptyState
            title="아직 만든 과제가 없습니다"
            action={
              <Button variant="outline" onClick={openNew}>
                첫 과제 만들기
              </Button>
            }
          />
        }
      >
        {({ assignments, studentCount }) => (
          <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)} aria-label="과제 목록">
            {assignments.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant={a.published ? "default" : "outline"} className="shrink-0">
                      {a.published ? "공개" : "비공개"}
                    </Badge>
                    <Link
                      href={`/admin/learning/?tab=assignments&assignment=${a.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClockIcon className="size-3.5" aria-hidden />
                      {a.due_at ? `마감 ${formatDateTime(a.due_at)}` : "마감 없음"}
                      {isPastDue(a.due_at) ? " (지남)" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="size-3.5" aria-hidden />
                      제출 {formatCount(a.submission_count)}
                      {studentCount != null ? ` / ${formatCount(studentCount)}명` : "건"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <label className="mr-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={a.published}
                      disabled={busyIds.has(a.id)}
                      onCheckedChange={(v) => togglePublished(a, v)}
                      aria-label={`${a.title} 공개`}
                    />
                    공개
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/learning/?tab=assignments&assignment=${a.id}`} />}
                    nativeButton={false}
                  >
                    <EyeIcon />
                    제출 현황
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(a);
                      setFormOpen(true);
                    }}
                  >
                    <PencilIcon />
                    수정
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      setDeleting(a);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2Icon />
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          {formOpen ? (
            <AssignmentForm
              assignment={editing}
              onDone={(saved) => {
                if (saved) upsert(saved);
                setFormOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="과제를 삭제할까요?"
        description={
          deleting
            ? `“${deleting.title}”과 학생 제출물 ${formatCount(deleting.submission_count)}건이 함께 삭제되며 되돌릴 수 없습니다. 학생에게서 숨기기만 하려면 비공개로 바꾸세요.`
            : ""
        }
        confirmLabel="삭제"
        destructive
        busy={deleteBusy}
        onConfirm={onDelete}
      />
    </div>
  );
}

/** 새 과제 / 수정 폼(제목 · 설명 마크다운 + 미리보기 · 마감일 · 공개 여부) */
export function AssignmentForm({
  assignment,
  onDone,
}: {
  assignment: Assignment | null;
  onDone: (saved: Assignment | null) => void;
}) {
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [description, setDescription] = useState(assignment?.description_md ?? "");
  const [due, setDue] = useState(toDateTimeLocal(assignment?.due_at));
  const [published, setPublished] = useState(assignment?.published ?? false);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; due?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const next: typeof errors = {};
    if (!t) next.title = "제목을 입력하세요.";
    else if (t.length > TITLE_MAX) next.title = `제목은 ${TITLE_MAX}자 이하로 입력하세요.`;
    const dueIso = due ? fromDateTimeLocal(due) : null;
    if (due && !dueIso) next.due = "마감일 형식이 올바르지 않습니다.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    const input: AssignmentInput = { title: t, description_md: description, due_at: dueIso, published };
    try {
      const saved = assignment ? await updateAssignment(assignment.id, input) : await createAssignment(input);
      toast.success(assignment ? "과제를 수정했습니다." : published ? "과제를 만들고 공개했습니다." : "과제를 비공개로 저장했습니다.");
      onDone(saved);
    } catch (err) {
      setErrors({ form: isMissingSchemaError(err) ? errorMessage(true, "") : "과제를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{assignment ? "과제 수정" : "새 과제"}</DialogTitle>
        <DialogDescription>공개한 과제만 학생의 “내 학습 활동 &gt; 과제”에 보입니다.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="assignment-title">제목</Label>
        <Input
          id="assignment-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          className="h-9"
          aria-invalid={Boolean(errors.title)}
          disabled={saving}
        />
        {errors.title ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="assignment-desc">설명 (마크다운)</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
            {preview ? <PencilLineIcon /> : <EyeIcon />}
            {preview ? "편집" : "미리보기"}
          </Button>
        </div>
        {preview ? (
          <div className="min-h-40 rounded-lg border p-3">
            {description.trim() ? (
              <MarkdownViewer content={description} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">미리 볼 내용이 없습니다.</p>
            )}
          </div>
        ) : (
          <Textarea
            id="assignment-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="max-h-[45dvh] min-h-40 font-mono text-sm"
            placeholder="과제 안내, 제출 방법 등을 적어 주세요."
            disabled={saving}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="assignment-due">마감일 (선택)</Label>
          <Input
            id="assignment-due"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-9"
            aria-invalid={Boolean(errors.due)}
            disabled={saving}
          />
          {errors.due ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.due}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">마감 후에도 제출은 되고 “지각”으로 표시됩니다.</p>
          )}
        </div>
        <div className="grid content-start gap-2">
          <span className="text-sm leading-none font-medium">공개 여부</span>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={published} onCheckedChange={setPublished} disabled={saving} />
            {published ? "학생에게 공개" : "비공개(초안)"}
          </label>
        </div>
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
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
