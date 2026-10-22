"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { AlertTriangleIcon, CircleXIcon, Loader2Icon, SchoolIcon } from "lucide-react";
import { toast } from "sonner";
import { dangerSolidClass } from "@/components/admin/admin-styles";
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
import { useAdminContext } from "@/hooks/use-admin-context";
import { AdminActionError } from "@/lib/admin";
import {
  ClassDeleteMissingError,
  classDeleteAvailable,
  deleteClass,
  fetchClassDeletePreview,
  markClassDeleteMissing,
  probeClassDelete,
  subscribeClassDelete,
  type ClassDeletePreview,
} from "@/lib/classes";

export type ClassDeleteTarget = { classId: string; className: string };

/** 서버가 학급이 없다고 할 때의 문구(기존 RPC 문구 — 다른 창에서 이미 지운 경우) */
const CLASS_NOT_FOUND = "학급을 찾을 수 없습니다.";

/**
 * 학급 삭제 기능(SQL 20261022000000_class_delete.sql)이 있는가. 모르는 동안·없으면 false → 단추를 숨긴다(오류 화면 없음).
 * probeClassId: 알아볼 때 미리보기를 불러 볼 내 학급 하나(없으면 묻지 않는다 — 학급이 없으면 단추도 없다).
 */
export function useClassDeleteAvailable(probeClassId: string | null | undefined): boolean {
  const available = useSyncExternalStore(subscribeClassDelete, classDeleteAvailable, () => null);
  useEffect(() => {
    if (probeClassId) probeClassDelete(probeClassId);
  }, [probeClassId]);
  return available === true;
}

type Preview =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ClassDeletePreview };

type Phase = { kind: "idle" } | { kind: "working" } | { kind: "error"; message: string };

/**
 * 학급 삭제(privacy-policy.md 8-9, docs/classes/delete-class/spec.md) — 그 학급의 담임 또는 총괄.
 * 학급을 목록에서 완전히 지운다. 그 학급의 과제(제출물 포함)·선생님 글도 함께 지워진다. 되돌릴 수 없다(무료 요금제 — 백업 없음).
 * - 열 때 미리보기(admin_class_delete_preview)로 과제·선생님 글 수를 보여 준다. 학생이 남아 있으면(탈퇴 처리된 학생 포함)
 *   서버 거부와 같은 원문 문구를 미리 보이고 단추를 끈다.
 * - 학급 이름을 그대로 입력해야 빨간 단추가 켜진다(서버 admin_delete_class도 이름을 다시 맞춰 본다).
 * - 처리 중에는 닫히지 않는다. 끝나면 원문 알림을 띄우고, 관리자 화면의 학급 목록에서 그 학급을 빼고(낙관적) 다시 읽는다.
 * - 서버가 거부하면 그 문구(원문 8-9)를 그대로 보인다.
 * finalFocusRef: 지운 뒤에는 누른 단추가 없어지므로 초점을 옮길 곳(예: 카드의 '학급 개설' 단추).
 */
export function ClassDeleteDialog({
  target,
  open,
  onOpenChange,
  onDeleted,
  finalFocusRef,
}: {
  target: ClassDeleteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 지운 뒤(목록·회원 명단을 다시 읽는 데 쓴다) */
  onDeleted?: (classId: string) => void;
  finalFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ctx = useAdminContext();
  const [shown, setShown] = useState<ClassDeleteTarget | null>(target);
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [typed, setTyped] = useState("");
  const [attempt, setAttempt] = useState(0);
  const working = useRef(false);
  // 지운 뒤 닫힐 때는 초점을 finalFocusRef로(누른 단추가 목록에서 사라졌다)
  const deleted = useRef(false);

  // 열 때마다 처음부터(대상 고정 · 입력·진행 초기화) — 렌더 중 상태 보정
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setShown(target);
      setPreview({ status: "loading" });
      setPhase({ kind: "idle" });
      setTyped("");
    }
  }

  const classId = shown?.classId ?? null;
  useEffect(() => {
    if (!open || !classId) return;
    deleted.current = false;
    let active = true;
    fetchClassDeletePreview(classId).then(
      (data) => {
        if (active) setPreview({ status: "ready", data });
      },
      (e: unknown) => {
        if (!active) return;
        if (e instanceof ClassDeleteMissingError) markClassDeleteMissing();
        setPreview({ status: "error", message: e instanceof AdminActionError ? e.message : EXTRA.classDeletePreviewError });
      },
    );
    return () => {
      active = false;
    };
  }, [open, classId, attempt]);

  const className = (preview.status === "ready" && preview.data.className) || shown?.className || "";
  const students = preview.status === "ready" ? preview.data.students : 0;
  const blocked = preview.status === "ready" && students > 0;
  const busy = phase.kind === "working";
  const matches = className.trim().length > 0 && typed.trim() === className.trim();
  const canRun = preview.status === "ready" && !blocked && !busy && matches;
  const previewMissing = preview.status === "error" && preview.message === EXTRA.classDeleteMissing;

  async function run() {
    if (!classId || !canRun || working.current) return;
    working.current = true;
    setPhase({ kind: "working" });
    try {
      await deleteClass(classId, typed);
      deleted.current = true;
      ctx.patchClasses((prev) => prev.filter((c) => c.id !== classId));
      void ctx.refresh();
      toast.success(fillText(T.classDelete.done, { "학급 이름": className }));
      onDeleted?.(classId);
      setPhase({ kind: "idle" });
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ClassDeleteMissingError) markClassDeleteMissing();
      const message = e instanceof AdminActionError ? e.message : EXTRA.clearFailed;
      // 다른 창에서 이미 지웠으면 목록을 다시 읽어 그 학급을 뺀다
      if (message === CLASS_NOT_FOUND) void ctx.refresh();
      setPhase({ kind: "error", message });
    } finally {
      working.current = false;
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return; // 처리 중에는 바깥 클릭/Esc로 닫지 않는다.
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto [overflow-wrap:anywhere] data-[size=default]:sm:max-w-lg"
        finalFocus={() => (deleted.current ? (finalFocusRef?.current ?? true) : true)}
      >
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <SchoolIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{fillText(T.classDelete.title, { "학급 이름": className })}</AlertDialogTitle>
          {preview.status === "ready" && !blocked ? (
            <AlertDialogDescription className="text-left">
              <RichText text={T.classDelete.body} values={{ n: preview.data.assignments, m: preview.data.notices }} />
            </AlertDialogDescription>
          ) : blocked ? (
            <AlertDialogDescription className="text-left text-foreground">
              <span className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3" role="alert">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span>{fillText(T.classDelete.studentsLeft, { n: students })}</span>
              </span>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">{T.classDelete.cardButton}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {preview.status === "loading" ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ) : preview.status === "error" ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span className="min-w-0 flex-1">{preview.message}</span>
            {!previewMissing ? (
              <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setAttempt((n) => n + 1)}>
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : blocked ? null : (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-start gap-1.5">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span>
                {T.classDelete.typeName} <strong className="font-mono">{className}</strong>
              </span>
            </span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              aria-label={T.classDelete.typeName}
              placeholder={className}
              className="h-11"
            />
          </label>
        )}

        {phase.kind === "error" ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            {phase.message}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 px-4" disabled={busy}>
            {T.classDelete.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className={`h-11 px-4 ${dangerSolidClass}`}
            disabled={!canRun}
            onClick={() => void run()}
          >
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <CircleXIcon />}
            {T.classDelete.ok}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
