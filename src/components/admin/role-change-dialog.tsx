"use client";

import { useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { dangerSolidClass } from "@/components/admin/admin-styles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import { useAdminContext } from "@/hooks/use-admin-context";
import { AdminActionError, memberName, setMemberRole } from "@/lib/admin";
import { setTeacherScope, type TeacherScope } from "@/lib/admin-privacy";
import type { MemberRow, Role } from "@/lib/types";

type Stage = { kind: "confirm"; error?: string } | { kind: "working" };

/** 지금 역할에서 바꿀 역할(교사 ↔ 학생) */
export function nextRoleOf(member: Pick<MemberRow, "profiles">): Role {
  return member.profiles?.role === "admin" ? "user" : "admin";
}

/**
 * 담임교사 지정 / 해제 확인(총괄만 — admin_set_role, docs/classes/spec.md 개정 1-2).
 * - 지정: 역할을 교사(admin)로 바꾸고 그 계정의 학생 소속(학급)은 서버가 비운다.
 * - 해제: 그 교사가 담임인 학급이 남아 있으면 서버가 거부한다 → 사유(한국어)를 이 창 안에 그대로 보여 준다.
 * 처리 중에는 닫히지 않는다. 성공하면 onChanged(대상 id, 새 역할).
 */
export function RoleChangeDialog({
  target,
  open,
  onOpenChange,
  onChanged,
}: {
  target: MemberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (userId: string, role: Role) => void;
}) {
  const ctx = useAdminContext();
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const working = useRef(false);
  // 바꿀 역할은 열 때 정해 둔다 — 성공 뒤 부모가 역할을 고쳐도, 닫히는 동안 문구가 뒤집히지 않게.
  const [next, setNext] = useState<Role>(target ? nextRoleOf(target) : "admin");
  // 열 때마다 확인 단계부터(렌더 중 상태 보정)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setNext(target ? nextRoleOf(target) : "admin");
    }
  }

  const name = target ? memberName(target) : "";
  const promote = next === "admin";
  // 학급 SQL 적용 전(예전 방식): 예전 문구(관리자 지정/해제)를 쓴다.
  const legacy = ctx.status === "missing";
  const title = legacy
    ? promote
      ? `${name}님을 관리자로 지정할까요?`
      : `${name}님의 관리자 권한을 해제할까요?`
    : promote
      ? `${name}님을 담임교사로 지정할까요?`
      : `${name}님의 담임교사 지정을 해제할까요?`;
  const description = legacy
    ? promote
      ? `${name}님이 글 작성·삭제, 회원 비밀번호 초기화 등 모든 관리자 기능을 쓸 수 있게 됩니다.`
      : `${name}님은 더 이상 글 관리·회원 관리 화면을 쓸 수 없게 됩니다.`
    : promote
      ? "지정하면 이 계정으로 관리자 대시보드에 들어와 자기 학급을 개설하고, 그 학급에 학생을 등록할 수 있어요. 다른 학급 학생의 기록은 볼 수 없어요."
      : "해제하면 관리자 대시보드를 쓸 수 없게 되고 일반 회원(학생)이 됩니다. 이 선생님이 혼자 맡은 학급에 학생이 있으면 해제되지 않아요 — 학급을 먼저 다른 담임에게 넘기거나 학생을 옮겨 학급을 비워 주세요. 학생이 없는 빈 학급은 보관됩니다.";
  const studentClass = target && promote ? ctx.classNameOf(target.class_id) : null;
  const taughtClasses =
    target && !promote
      ? (ctx.teacherClasses?.get(target.id) ?? []).map((id) => ctx.classNameOf(id) ?? "이름 없는 학급")
      : [];

  async function onConfirm() {
    if (!target || working.current) return;
    working.current = true;
    setStage({ kind: "working" });
    try {
      await setMemberRole(target.id, next);
      onChanged?.(target.id, next);
      toast.success(
        legacy
          ? promote
            ? `${name}님을 관리자로 지정했습니다.`
            : `${name}님의 관리자 권한을 해제했습니다.`
          : promote
            ? `${name}님을 담임교사로 지정했습니다.`
            : `${name}님의 담임교사 지정을 해제했습니다.`,
      );
      onOpenChange(false);
      setStage({ kind: "confirm" });
      void ctx.refresh();
    } catch (e) {
      setStage({ kind: "confirm", error: e instanceof AdminActionError ? e.message : "역할을 바꾸지 못했습니다." });
    } finally {
      working.current = false;
    }
  }

  const busy = stage.kind === "working";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {promote && studentClass ? (
          <p className="rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm" role="note">
            이 계정은 지금 ‘{studentClass}’ 학생으로 등록되어 있어요. 지정하면 학생 소속이 비워져, 이 계정의 학습 기록은 어느 담임
            화면에도 보이지 않게 됩니다.
          </p>
        ) : null}
        {!promote && taughtClasses.length ? (
          <p className="rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm" role="note">
            이 선생님이 담임인 학급: <strong>{taughtClasses.join(", ")}</strong>
          </p>
        ) : null}
        {stage.kind === "confirm" && stage.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            {stage.error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 px-4" disabled={busy}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            variant={promote ? "default" : "destructive"}
            className={promote ? "h-11 px-4" : `h-11 px-4 ${dangerSolidClass}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
            {stage.kind === "confirm" && stage.error ? "다시 시도" : promote ? "지정" : "해제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 교사 권한 넓히기·줄이기 확인(총괄만 — admin_set_teacher_scope, docs/privacy/spec.md 4.2·6절, 문구 privacy-policy.md 8-3).
 * - next = "full": [모든 권한 주기] — 학습게임 관리·신고 처리·블로그 글쓰기·함께 쓰는 칭찬 문구 고치기
 * - next = "class": [내 학급 일만으로 줄이기]
 * 처리 중에는 닫히지 않는다. 서버가 거부하면 사유(한국어)를 창 안에 보여 준다. 성공하면 onChanged(대상 id, 새 범위).
 */
export function TeacherScopeDialog({
  target,
  next,
  open,
  onOpenChange,
  onChanged,
}: {
  target: MemberRow | null;
  next: TeacherScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (userId: string, scope: TeacherScope) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const working = useRef(false);
  // 바꿀 범위는 열 때 정해 둔다 — 성공 뒤 부모가 값을 고쳐도 닫히는 동안 문구가 뒤집히지 않게.
  const [scope, setScope] = useState<TeacherScope>(next);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setScope(next);
    }
  }

  const nickname = target ? memberName(target) : "";
  const widen = scope === "full";
  const title = widen ? T.googleTeacher.widenMenu : T.googleTeacher.narrowMenu;
  const description = fillText(widen ? T.googleTeacher.widenConfirm : T.googleTeacher.narrowConfirm, { 별명: nickname });

  async function onConfirm() {
    if (!target || working.current) return;
    working.current = true;
    setStage({ kind: "working" });
    try {
      await setTeacherScope(target.id, scope);
      onChanged?.(target.id, scope);
      toast.success(fillText(widen ? EXTRA.widened : EXTRA.narrowed, { 별명: nickname }));
      onOpenChange(false);
      setStage({ kind: "confirm" });
    } catch (e) {
      setStage({ kind: "confirm", error: e instanceof AdminActionError ? e.message : EXTRA.saveFailed });
    } finally {
      working.current = false;
    }
  }

  const busy = stage.kind === "working";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {stage.kind === "confirm" && stage.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            {stage.error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 px-4" disabled={busy}>
            {T.googleTeacher.cancel}
          </AlertDialogCancel>
          <AlertDialogAction className="h-11 px-4" disabled={busy} onClick={onConfirm}>
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
            {stage.kind === "confirm" && stage.error ? "다시 시도" : widen ? T.googleTeacher.widenOk : T.googleTeacher.narrowOk}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
