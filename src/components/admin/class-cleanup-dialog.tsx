"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, CircleXIcon, Loader2Icon, SchoolIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { dangerSolidClass } from "@/components/admin/admin-styles";
import { ClassDeleteDialog, useClassDeleteAvailable, type ClassDeleteTarget } from "@/components/admin/class-delete-dialog";
import { RichText } from "@/components/admin/member-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import { AdminActionError } from "@/lib/admin";
import { clearClassStudents, fetchClassCleanupPreview, PrivacyMissingError, type CleanupPreview } from "@/lib/admin-privacy";

export type ClassCleanupTarget = { classId: string; className: string };

type Preview =
  | { status: "loading" }
  | { status: "error"; message: string; missing: boolean }
  | { status: "ready"; data: CleanupPreview };

type Phase =
  | { kind: "idle" }
  | { kind: "working"; done: number; total: number }
  | { kind: "done"; deleted: number }
  | { kind: "partial"; left: number }
  | { kind: "error"; message: string };

/**
 * 학급 정리(privacy-policy.md 8-4, spec 4.7-3) — 그 학급의 담임 또는 총괄.
 * 학급 학생 계정(탈퇴 처리된 학생 포함)과 그 학생들의 모든 기록을 지운다. 되돌릴 수 없다(무료 요금제 — 백업 없음).
 * - 미리보기(admin_class_cleanup_preview)로 인원수를 먼저 보여 주고, 학생이 0이면 단추를 끈다.
 *   (AlertDialogAction은 누르기만 해서는 창을 닫지 않는다 — 진행 중에도 창이 그대로 있다.)
 * - 학급 이름을 그대로 입력해야 단추가 켜진다(서버 admin-clear-students도 이름을 다시 맞춰 본다).
 * - 함수는 한 번에 20명씩 지운다 → 남은 학생이 0이 될 때까지 되풀이하며 "n/m명" 진행을 보인다. 처리 중에는 닫히지 않는다.
 * - 일부 실패면 남은 수를 알리고 같은 단추로 다시 시도한다(멱등).
 * - 학생이 0명이 되면(정리를 마쳤거나 처음부터 없음) [이어서 학급 삭제] → 이 창을 닫고 학급 삭제 창(privacy-policy.md 8-9)을 연다.
 *   학급 삭제 SQL이 없으면 단추를 숨긴다. 학급 삭제 창은 이 컴포넌트가 함께 그린다(부르는 쪽은 onDeleted만 받는다).
 */
export function ClassCleanupDialog({
  target,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
  finalFocusRef,
}: {
  target: ClassCleanupTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 한 명이라도 지웠을 때(학생 수·목록을 다시 읽는 데 쓴다) */
  onChanged?: () => void;
  /** [이어서 학급 삭제]로 학급을 지웠을 때 */
  onDeleted?: (classId: string) => void;
  /** 학급을 지운 뒤 초점을 옮길 곳(누른 단추가 목록에서 사라지므로) */
  finalFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState<ClassCleanupTarget | null>(target);
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [typed, setTyped] = useState("");
  const [attempt, setAttempt] = useState(0);
  // 이 창에서 지금까지 지운 학생 수(일부 실패 뒤 다시 눌러도 이어서 센다)
  const [deletedBefore, setDeletedBefore] = useState(0);
  const working = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassDeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 열 때마다 처음부터(대상 고정 · 입력·진행 초기화) — 렌더 중 상태 보정
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setShown(target);
      setPreview({ status: "loading" });
      setPhase({ kind: "idle" });
      setTyped("");
      setDeletedBefore(0);
    }
  }

  const classId = shown?.classId ?? null;
  useEffect(() => {
    if (!open || !classId) return;
    let active = true;
    fetchClassCleanupPreview(classId).then(
      (data) => {
        if (active) setPreview({ status: "ready", data });
      },
      (e: unknown) => {
        if (!active) return;
        setPreview({
          status: "error",
          message: e instanceof AdminActionError ? e.message : EXTRA.previewError,
          missing: e instanceof PrivacyMissingError,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [open, classId, attempt]);

  const className = (preview.status === "ready" && preview.data.className) || shown?.className || "";
  const students = preview.status === "ready" ? preview.data.students : 0;
  const withdrawn = preview.status === "ready" ? preview.data.withdrawn : 0;
  const empty = preview.status === "ready" && students === 0;
  const busy = phase.kind === "working";
  const finished = phase.kind === "done";
  const matches = className.length > 0 && typed.trim() === className;
  const canRun = preview.status === "ready" && !empty && !busy && !finished && matches;
  // 학급 삭제 SQL이 있는가(모르는 동안·없으면 [이어서 학급 삭제]를 숨긴다)
  const deleteAvailable = useClassDeleteAvailable(open ? classId : null);
  const canContinueDelete = deleteAvailable && !!classId && preview.status === "ready" && (finished || empty);

  function continueDelete() {
    if (!classId || !canContinueDelete) return;
    setDeleteTarget({ classId, className });
    onOpenChange(false);
    setDeleteOpen(true);
  }

  async function run() {
    if (!classId || !canRun || working.current) return;
    working.current = true;
    // 진행은 미리보기 인원 기준 — 일부 실패 뒤 다시 누르면 앞에서 지운 수부터 이어서 센다.
    const start = deletedBefore;
    const total = Math.max(students, start);
    setPhase({ kind: "working", done: Math.min(start, total), total });
    let deletedNow = 0;
    try {
      const r = await clearClassStudents(classId, typed.trim(), (deleted) => {
        deletedNow = deleted;
        setPhase({ kind: "working", done: Math.min(start + deleted, total), total });
      });
      const deletedAll = start + r.deleted;
      setDeletedBefore(deletedAll);
      if (r.deleted > 0) onChanged?.();
      if (r.remaining > 0) {
        setPhase({ kind: "partial", left: r.remaining });
      } else {
        setPhase({ kind: "done", deleted: deletedAll });
      }
      if (r.warning) toast.warning(r.warning, { duration: 15000 });
    } catch (e) {
      setDeletedBefore(start + deletedNow);
      if (deletedNow > 0) onChanged?.();
      setPhase({ kind: "error", message: e instanceof AdminActionError ? e.message : EXTRA.clearFailed });
    } finally {
      working.current = false;
    }
  }

  const progressPct = phase.kind === "working" && phase.total ? Math.round((phase.done / phase.total) * 100) : 0;

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && busy) return; // 처리 중에는 바깥 클릭/Esc로 닫지 않는다.
          onOpenChange(next);
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto [overflow-wrap:anywhere] data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <SchoolIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>{fillText(T.classCleanup.title, { "학급 이름": className })}</AlertDialogTitle>
            {preview.status === "ready" && !empty ? (
              <AlertDialogDescription className="text-left">
                <RichText text={T.classCleanup.body} values={{ n: students, m: withdrawn }} />
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription className="sr-only">{T.classCleanup.cardButton}</AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {preview.status === "loading" ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : preview.status === "error" ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <span className="min-w-0 flex-1">
                {preview.missing ? <span className="font-medium">{EXTRA.missingPrefix}</span> : null}
                {preview.message}
              </span>
              {!preview.missing ? (
                <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setAttempt((n) => n + 1)}>
                  다시 시도
                </Button>
              ) : null}
            </div>
          ) : empty ? (
            <p className="rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm" role="status">
              {T.classCleanup.empty}
            </p>
          ) : (
            <>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                <li>{T.classCleanup.removed}</li>
                <li>{T.classCleanup.kept}</li>
                <li className="text-destructive marker:text-destructive">
                  <RichText text={T.classCleanup.irreversible} />
                </li>
              </ul>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-start gap-1.5">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <span>
                    {T.classCleanup.typeName} <strong className="font-mono">{className}</strong>
                  </span>
                </span>
                <Input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={busy || finished}
                  autoComplete="off"
                  aria-label={T.classCleanup.typeName}
                  placeholder={className}
                  className="h-11"
                />
              </label>
            </>
          )}

          {phase.kind === "working" ? (
            <div className="flex flex-col gap-1.5" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-destructive transition-[width] motion-reduce:transition-none" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-sm text-muted-foreground">
                {fillText(T.classCleanup.progress, { done: phase.done, total: phase.total })}
              </p>
            </div>
          ) : phase.kind === "done" ? (
            <p className="flex items-start gap-2 rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm" role="status">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
              {fillText(T.classCleanup.done, { n: phase.deleted })}
            </p>
          ) : phase.kind === "partial" ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              {fillText(T.classCleanup.partial, { k: phase.left })}
            </p>
          ) : phase.kind === "error" ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              {phase.message}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 px-4" disabled={busy}>
              {finished ? "닫기" : T.classCleanup.cancel}
            </AlertDialogCancel>
            {canContinueDelete ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 text-destructive hover:text-destructive"
                onClick={continueDelete}
              >
                <CircleXIcon />
                {T.classDelete.continueButton}
              </Button>
            ) : null}
            {/* 학생이 처음부터 없고 [이어서 학급 삭제]가 보이면, 쓸 수 없는 빨간 [학급 정리하기]는 빼서 헷갈리지 않게 한다 */}
            {!finished && !(empty && canContinueDelete) ? (
              <AlertDialogAction
                variant="destructive"
                className={`h-11 px-4 ${dangerSolidClass}`}
                disabled={!canRun}
                onClick={() => void run()}
              >
                {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <Trash2Icon />}
                {T.classCleanup.ok}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ClassDeleteDialog
        target={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
        finalFocusRef={finalFocusRef}
      />
    </>
  );
}
