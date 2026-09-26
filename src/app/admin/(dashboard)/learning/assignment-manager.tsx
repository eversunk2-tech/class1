"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarClockIcon,
  EyeIcon,
  Loader2Icon,
  LockIcon,
  PencilIcon,
  PencilLineIcon,
  PlusIcon,
  SchoolIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { ClassNameDialog } from "@/components/admin/class-card";
import { ClassSelectField, WholeScopeNote } from "@/components/admin/class-controls";
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
import {
  canModifyContent,
  isPermissionRejection,
  OWNER_ONLY_DELETE,
  OWNER_ONLY_EDIT,
  useAdminContext,
  useStudentScope,
} from "@/hooks/use-admin-context";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  ASSIGNMENT_CLASS_MISSING_MESSAGE,
  createAssignment,
  deleteAssignment,
  errorMessage,
  fetchAssignments,
  fetchProfileNames,
  fetchStudents,
  fromDateTimeLocal,
  isMissingSchemaError,
  isPastDue,
  toDateTimeLocal,
  updateAssignment,
  type AdminAssignment,
  type AssignmentInput,
  type AssignmentWithCount,
} from "@/lib/learning";
import { cn } from "@/lib/utils";

const TITLE_MAX = 200;

type Data = {
  assignments: AssignmentWithCount[];
  /** 과제에 학급 열이 있음(20260927040000_class_assignments.sql 적용 뒤) — 목록은 학급 범위, 새 과제는 학급을 골라 만든다 */
  classColumn: boolean;
  /** 학급 id → 학생 수(학급별 과제의 "제출 N / M명"). 학급 기능 전이거나 못 읽으면 null */
  studentsByClass: Map<string, number> | null;
  /** 내 학급 전체 학생 수(학급 없는 예전 과제의 "제출 N / M명"). 못 읽으면 null */
  studentTotal: number | null;
  /** 다른 선생님이 만든 과제의 만든 사람 이름(id → 이름). 못 읽으면 null(목록은 그대로). */
  creatorNames: Map<string, string> | null;
};

/** 과제의 학급 id(학급별 과제일 때만 — 학급 열이 없던 예전 과제는 null) */
function classIdOf(a: AdminAssignment): string | null {
  return typeof a.class_id === "string" && a.class_id ? a.class_id : null;
}

/**
 * 학습 현황 > 과제 관리: 목록 · 새 과제 · 수정 · 공개 전환 · 삭제(spec §3.6).
 * 과제는 학급별이다(docs/classes/spec.md 개정 3-2, 20260927040000_class_assignments.sql):
 * - 목록 = 학습 현황의 학급 범위(내 학급 전체 / 학급 고르기로 고른 학급). 내 학급이 여럿이면 과제마다 학급 이름.
 * - 새 과제 = 내 학급에만(하나면 자동, 여럿이면 고름, 없으면 "먼저 학급을 개설해 주세요"). 만든 뒤 학급은 바꿀 수 없다.
 * - ⑥ SQL 전(과제에 학급 열 없음)에는 예전처럼 모든 과제를 보이고 학급 없이 만든다 + "SQL 실행 필요" 안내.
 * 고치기·공개 전환·지우기는 쓴 선생님과 총괄만(20260927030000_content_owner_only.sql — 남의 과제는 버튼을 끄고 까닭을 보인다).
 * 학급 이름은 관리자 화면에서만 보인다(학생 화면에는 학급 정보 없음).
 */
export function AssignmentManager() {
  const ctx = useAdminContext();
  const myId = ctx.userId;
  // 목록은 학급 고르기와 같이 움직인다(classIds). 학생 수는 학급별로 세려고 내 학급 전체(allClassIds)를 읽는다.
  const { classIds, allClassIds, narrowed } = useStudentScope();
  const load = useCallback(async (): Promise<Data> => {
    const [list, students] = await Promise.all([
      fetchAssignments(classIds),
      // 학생 수는 보조 정보라 실패해도 목록은 보여 준다.
      fetchStudents(allClassIds).catch(() => null),
    ]);
    let studentsByClass: Map<string, number> | null = null;
    if (students && allClassIds) {
      studentsByClass = new Map();
      for (const st of students) {
        if (st.class_id) studentsByClass.set(st.class_id, (studentsByClass.get(st.class_id) ?? 0) + 1);
      }
    }
    // 다른 선생님이 만든 과제가 있을 때만 이름을 읽는다(교사가 한 명이면 요청 없음). 보조 정보라 실패해도 목록은 보여 준다.
    const others = list.rows.map((a) => a.created_by).filter((id): id is string => !!id && id !== myId);
    const creatorNames = others.length ? await fetchProfileNames(others).catch(() => null) : new Map<string, string>();
    return {
      assignments: list.rows,
      classColumn: list.classColumn,
      studentsByClass,
      studentTotal: students ? students.length : null,
      creatorNames,
    };
  }, [classIds, allClassIds, myId]);
  const { state, reload, setData } = useAsyncData(load);

  const [editing, setEditing] = useState<AdminAssignment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AssignmentWithCount | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [classDialogOpen, setClassDialogOpen] = useState(false);

  const classColumn = state.status === "ready" && state.data.classColumn;
  const myClassCount = ctx.status === "ready" ? ctx.classes.length : 0;
  // 학급별 과제인데 내 학급이 없음 → 과제를 만들 수 없다(먼저 학급 개설)
  const noClass = classColumn && ctx.status === "ready" && myClassCount === 0;
  // 내 학급이 여럿이면 과제마다 학급 이름을 보인다(관리자 화면에서만)
  const showClassNames = classColumn && myClassCount > 1;

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  /** 저장한 과제를 목록에 반영한다. 새 과제가 지금 고른 학급 밖이면 목록에 넣지 않고 알린다. */
  function onSaved(saved: AdminAssignment, isNew: boolean) {
    const cls = classIdOf(saved);
    if (isNew && cls && classIds && !classIds.includes(cls)) {
      const name = ctx.classNameOf(cls);
      toast.info(`${name ? `‘${name}’` : "고른"} 학급에 만들었어요. 지금 목록은 학습 현황에서 고른 학급만 보여요.`);
      return;
    }
    upsert(saved);
  }

  /** 고친 행은 원래 값과 합친다(고치기 응답에는 class_id가 없다 — 학급은 바뀌지 않는다). */
  function upsert(a: AdminAssignment) {
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
    } catch (err) {
      // 남의 과제(RLS 0행)면 까닭을 함께 알린다 — 버튼을 꺼 두지만 화면 정보가 늦었을 수 있다.
      toast.error(isPermissionRejection(err) ? `공개 상태를 바꾸지 못했습니다. ${OWNER_ONLY_EDIT}` : "공개 상태를 바꾸지 못했습니다.");
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
    } catch (err) {
      toast.error(isPermissionRejection(err) ? `과제를 삭제하지 못했습니다. ${OWNER_ONLY_DELETE}` : "과제를 삭제하지 못했습니다.");
    } finally {
      setDeleteBusy(false);
    }
  }

  /** 만든 선생님 이름(다른 선생님 과제만 — 이름을 못 읽었으면 null) */
  function creatorName(a: AdminAssignment, names: Map<string, string> | null): string | null {
    return a.created_by ? (names?.get(a.created_by) ?? null) : null;
  }

  /**
   * 지우기 확인 문구. 지우면 과제에 걸린 제출물이 함께 지워진다(외래키 연쇄 삭제).
   * - 학급별 과제(⑥ 뒤): 그 과제의 학급 학생만 낼 수 있으므로 "○○반 학생 제출물 N건"(N = RLS가 보여 주는 내 학생 제출 수).
   * - 예전 과제(⑥ 전): 반과 상관없이 모두 지워지므로 "내 학급 N건, 다른 반 학생이 낸 것이 있으면 그것까지".
   * 다른 선생님 과제(총괄)면 누가 만든 과제인지도.
   */
  function deleteDescription(a: AssignmentWithCount, names: Map<string, string> | null, byClass: boolean): string {
    let owner = "";
    if (a.created_by !== myId) {
      const name = creatorName(a, names);
      owner = a.created_by ? `${name ? `${name} 선생님` : "다른 선생님"}이 만든 과제예요. ` : "만든 선생님 정보가 없는 과제예요. ";
    }
    const cls = byClass ? classIdOf(a) : null;
    const clsName = cls ? ctx.classNameOf(cls) : null;
    const scope = cls
      ? `${clsName ? `${clsName} ` : ""}학생 제출물 ${formatCount(a.submission_count)}건도`
      : ctx.status === "ready"
        ? `학생 제출물(내 학급 ${formatCount(a.submission_count)}건, 다른 반 학생이 낸 것이 있으면 그것까지)도`
        : `학생 제출물 ${formatCount(a.submission_count)}건도`;
    // 조사가 제목 끝 글자에 따라 바뀌지 않게 "이 과제(“제목”)를"로 쓴다.
    return `${owner}이 과제(“${a.title}”)를 지우면 ${scope} 함께 삭제되며 되돌릴 수 없습니다. 학생에게서 숨기기만 하려면 비공개로 바꾸세요.`;
  }

  const pickedName = narrowed ? ctx.classNameOf(ctx.selectedClassId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 학급 열이 없는 예전 과제(⑥ 전)의 제출 수는 고른 학급이 아니라 내 학급 전체 기준 — 학급별 과제는 과제마다 그 학급 기준이라 필요 없다 */}
      {state.status === "ready" && !state.data.classColumn ? <WholeScopeNote /> : null}
      {state.status === "ready" && !state.data.classColumn && ctx.status === "ready" ? (
        <p role="note" className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">SQL 실행 필요 · </span>
          {ASSIGNMENT_CLASS_MISSING_MESSAGE}
        </p>
      ) : null}

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
          noClass ? (
            <EmptyState
              title="먼저 학급을 개설해 주세요"
              description="과제는 학급마다 따로 올라가요. 학급을 개설하면 그 학급 학생에게 과제를 낼 수 있어요."
              action={
                <Button className="h-11 px-4" onClick={() => setClassDialogOpen(true)}>
                  <PlusIcon />
                  학급 개설
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={classColumn && pickedName ? `‘${pickedName}’에 아직 과제가 없습니다` : "아직 만든 과제가 없습니다"}
              action={
                <Button variant="outline" onClick={openNew}>
                  첫 과제 만들기
                </Button>
              }
            />
          )
        }
      >
        {({ assignments, classColumn: byClass, studentsByClass, studentTotal, creatorNames }) => (
          <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)} aria-label="과제 목록">
            {assignments.map((a) => {
              // 쓴 선생님과 총괄만 고치고 지운다(화면 표시용 — 실제 판단은 RLS). 남의 과제는 버튼을 끄고 까닭을 보인다.
              const canEdit = canModifyContent(ctx, a.created_by);
              const lockId = `assignment-lock-${a.id}`;
              const describedBy = canEdit ? undefined : lockId;
              const othersName = a.created_by !== myId ? creatorName(a, creatorNames) : null;
              // 학급별 과제는 그 학급 학생 수로, 학급 없는 예전 과제는 내 학급 전체 학생 수로 "제출 N / M명"
              const cls = byClass ? classIdOf(a) : null;
              const studentCount = cls && studentsByClass ? (studentsByClass.get(cls) ?? 0) : studentTotal;
              return (
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
                      {/* 내 학급이 여럿이면 과제마다 학급 이름(관리자 화면에서만 — 학생 화면에는 학급 정보가 없다) */}
                      {cls && showClassNames ? (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <SchoolIcon className="size-3.5 text-muted-foreground" aria-hidden />
                          {ctx.classNameOf(cls) ?? "다른 학급"}
                        </span>
                      ) : null}
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
                      {/* 교사가 여럿일 때 구분: 다른 선생님이 만든 과제에만 만든 사람을 보인다(내 과제는 표시 없음). */}
                      {a.created_by !== myId ? (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="size-3.5" aria-hidden />
                          {a.created_by ? (othersName ? `만든 선생님 ${othersName}` : "다른 선생님이 만든 과제") : "만든 선생님 정보 없음"}
                        </span>
                      ) : null}
                    </div>
                    {!canEdit ? (
                      <p id={lockId} role="note" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <LockIcon className="size-3.5 shrink-0" aria-hidden />
                        {OWNER_ONLY_EDIT}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <label className="mr-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={a.published}
                        disabled={busyIds.has(a.id) || !canEdit}
                        onCheckedChange={(v) => togglePublished(a, v)}
                        aria-label={`${a.title} 공개`}
                        aria-describedby={describedBy}
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
                      disabled={!canEdit}
                      aria-describedby={describedBy}
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
                      disabled={!canEdit}
                      aria-describedby={describedBy}
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
              );
            })}
          </ul>
        )}
      </AsyncView>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          {formOpen ? (
            <AssignmentForm
              assignment={editing}
              classMode={classColumn}
              onDone={(saved) => {
                if (saved) onSaved(saved, !editing);
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
            ? deleteDescription(deleting, state.status === "ready" ? state.data.creatorNames : null, classColumn)
            : ""
        }
        confirmLabel="삭제"
        destructive
        busy={deleteBusy}
        onConfirm={onDelete}
      />

      {/* 학급 개설(학급이 없는 선생님) — 개설하면 내 학급 범위가 바뀌어 목록이 다시 읽힌다. 닫히는 동안 사라지지 않게 조건 밖에 둔다. */}
      <ClassNameDialog target={{ mode: "create" }} open={classDialogOpen} onOpenChange={setClassDialogOpen} />
    </div>
  );
}

/** 저장 실패 문구(서버 오류 코드별) */
function saveErrorMessage(err: unknown, isEdit: boolean, classMode: boolean): string {
  const code = (err as { code?: unknown } | null)?.code;
  // 목록을 연 뒤 ⑥ SQL이 적용됐는데 예전 방식(학급 없이)으로 만들려 한 경우: class_id not null
  if (!isEdit && code === "23502") {
    return "과제를 학급별로 나누는 설정이 방금 적용됐어요. 화면을 새로 고친 뒤 다시 저장해 주세요.";
  }
  if (isMissingSchemaError(err)) return classMode && !isEdit ? ASSIGNMENT_CLASS_MISSING_MESSAGE : errorMessage(true, "");
  if (isEdit && isPermissionRejection(err)) return `과제를 저장하지 못했습니다. ${OWNER_ONLY_EDIT}`;
  // 새 과제의 RLS 거부 = 내가 담임이 아닌 학급(그사이 담임 해제 등)
  if (!isEdit && code === "42501") return "과제를 저장하지 못했습니다. 내가 담임인 학급에만 과제를 만들 수 있어요.";
  return "과제를 저장하지 못했습니다.";
}

/**
 * 새 과제 / 수정 폼(제목 · 설명 마크다운 + 미리보기 · 마감일 · 공개 여부 + 학급별 과제면 학급).
 * classMode(과제를 학급별로 나눈 뒤 — ⑥): 새 과제는 내 학급에만 만든다 — 학급이 하나면 자동(칸 숨김), 여럿이면 반드시 고른다
 * (학습 현황에서 학급을 골라 두었으면 그 학급으로 시작), 없으면 "먼저 학급을 개설해 주세요". 고칠 때 학급은 보여 주기만(바꿀 수 없음).
 */
export function AssignmentForm({
  assignment,
  onDone,
  classMode = false,
}: {
  assignment: AdminAssignment | null;
  onDone: (saved: AdminAssignment | null) => void;
  classMode?: boolean;
}) {
  const ctx = useAdminContext();
  const myClasses = ctx.status === "ready" ? ctx.classes : [];
  const pickClass = classMode && !assignment;
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [description, setDescription] = useState(assignment?.description_md ?? "");
  const [due, setDue] = useState(toDateTimeLocal(assignment?.due_at));
  const [published, setPublished] = useState(assignment?.published ?? false);
  const [pickedClassId, setPickedClassId] = useState<string>(() => ctx.selectedClassId ?? "");
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; due?: string; classId?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  // 학급이 하나면 그 학급(칸 숨김), 여럿이면 고른 학급(내 학급 안에서만)
  const classId =
    myClasses.length === 1 ? myClasses[0].id : myClasses.some((c) => c.id === pickedClassId) ? pickedClassId : "";
  const noClass = pickClass && myClasses.length === 0;
  const fixedClassId = classMode && assignment && typeof assignment.class_id === "string" ? assignment.class_id : null;
  // 고칠 때: 내 학급이 여럿이거나 내 학급이 아닌 과제(총괄)면 학급을 보여 준다(하나뿐이면 숨김 — 새 과제와 같게)
  const showFixedClass = !!fixedClassId && (myClasses.length > 1 || !myClasses.some((c) => c.id === fixedClassId));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (noClass) return;
    const t = title.trim();
    const next: typeof errors = {};
    if (pickClass && !classId) next.classId = "과제를 낼 학급을 골라 주세요.";
    if (!t) next.title = "제목을 입력하세요.";
    else if (t.length > TITLE_MAX) next.title = `제목은 ${TITLE_MAX}자 이하로 입력하세요.`;
    const dueIso = due ? fromDateTimeLocal(due) : null;
    if (due && !dueIso) next.due = "마감일 형식이 올바르지 않습니다.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    const input: AssignmentInput = { title: t, description_md: description, due_at: dueIso, published };
    try {
      const saved = assignment
        ? await updateAssignment(assignment.id, input)
        : await createAssignment(input, pickClass ? classId : null);
      // 내 학급이 여럿이면 어느 학급에 만들었는지 함께 알린다
      const where = pickClass && myClasses.length > 1 ? `‘${ctx.classNameOf(classId) ?? "고른 학급"}’에 ` : "";
      toast.success(
        assignment ? "과제를 수정했습니다." : published ? `${where}과제를 만들고 공개했습니다.` : `${where}과제를 비공개로 저장했습니다.`,
      );
      onDone(saved);
    } catch (err) {
      setErrors({ form: saveErrorMessage(err, !!assignment, classMode) });
    } finally {
      setSaving(false);
    }
  }

  const audience = !classMode
    ? "학생"
    : !pickClass
      ? "이 과제의 학급 학생"
      : myClasses.length > 1
        ? "고른 학급 학생"
        : myClasses.length === 1
          ? "내 학급 학생"
          : "학생";

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{assignment ? "과제 수정" : "새 과제"}</DialogTitle>
        <DialogDescription>공개한 과제만 {audience}의 “내 학습 활동 &gt; 과제”에 보입니다.</DialogDescription>
      </DialogHeader>

      {noClass ? (
        <p role="alert" className="rounded-xl border border-dashed px-3 py-3 text-sm">
          <span className="font-medium">먼저 학급을 개설해 주세요.</span> 과제는 학급마다 따로 올라가요. 관리자 개요나 회원 관리 맨
          위의 ‘내 학급’에서 학급을 개설하면 과제를 만들 수 있어요.
        </p>
      ) : null}

      {pickClass && myClasses.length > 1 ? (
        <ClassSelectField
          classes={myClasses}
          value={classId}
          onChange={(id) => {
            setPickedClassId(id);
            setErrors((prev) => ({ ...prev, classId: undefined }));
          }}
          disabled={saving}
          help="과제는 고른 학급 학생에게만 보여요. 만든 뒤에는 학급을 바꿀 수 없어요."
          pickHelp="과제를 낼 학급을 골라 주세요."
          invalid={Boolean(errors.classId)}
        />
      ) : null}

      {showFixedClass && fixedClassId ? (
        <div className="grid gap-1.5">
          <span className="text-sm leading-none font-medium">학급</span>
          <p className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm">
            <SchoolIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate font-medium">{ctx.classNameOf(fixedClassId) ?? "다른 학급"}</span>
          </p>
          <p className="text-xs text-muted-foreground">만든 뒤에는 학급을 바꿀 수 없어요.</p>
        </div>
      ) : null}

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
        <Button type="submit" disabled={saving || noClass}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
