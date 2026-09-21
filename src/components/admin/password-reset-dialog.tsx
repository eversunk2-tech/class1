"use client";

import { useRef, useState } from "react";
import { AlertTriangleIcon, CheckIcon, CopyIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
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
import { AdminActionError, accountLabel, memberName, resetMemberPassword } from "@/lib/admin";
import type { MemberRow } from "@/lib/types";

type Stage =
  | { kind: "confirm"; error?: string }
  | { kind: "working" }
  | { kind: "result"; tempPassword: string; warning?: string };

/**
 * 비밀번호 초기화 흐름(docs/admin/spec.md §3.4).
 * 확인 → Edge Function 호출 → 임시 비밀번호를 한 번만 보여 준다.
 * 결과 화면은 바깥 클릭/Esc로 닫히지 않고 "확인했어요, 닫기" 버튼으로만 닫힌다.
 * 임시 비밀번호는 이 컴포넌트 state에만 있고, 닫힘 애니메이션이 끝나면 state에서도 지운다(review #12).
 *
 * 부모는 `target`(대상 회원)과 `open`을 관리한다. 성공하면 onReset(대상 id)을 호출한다.
 */
export function PasswordResetDialog({
  target,
  open,
  onOpenChange,
  onReset,
}: {
  target: MemberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset?: (userId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const [copied, setCopied] = useState(false);
  // 열릴 때마다 확인 단계부터 시작한다(렌더 중 상태 보정 — 이전 값과 비교).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setCopied(false);
    }
  }

  const name = target ? memberName(target) : "";
  const working = useRef(false);

  async function onConfirm() {
    if (!target || working.current) return; // 빠른 연타로 두 번 초기화하지 않게
    working.current = true;
    setStage({ kind: "working" });
    try {
      const result = await resetMemberPassword(target.id);
      setStage({ kind: "result", ...result });
      onReset?.(target.id);
    } catch (e) {
      setStage({
        kind: "confirm",
        error: e instanceof AdminActionError ? e.message : "비밀번호를 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      working.current = false;
    }
  }

  async function onCopy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("임시 비밀번호를 복사했습니다.");
    } catch {
      toast.error("복사하지 못했습니다. 비밀번호를 직접 선택해 복사해 주세요.");
    }
  }

  function close() {
    // 닫는 애니메이션 동안 내용이 바뀌지 않도록 여기서는 단계를 그대로 두고, 애니메이션이 끝나면(onOpenChangeComplete) 지운다.
    onOpenChange(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // 처리 중이거나 결과를 보여 주는 중에는 바깥 클릭/Esc로 닫지 않는다.
        if (!next && (stage.kind === "working" || stage.kind === "result")) return;
        onOpenChange(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        // 완전히 닫히면 임시 비밀번호를 메모리(state)에서도 지운다.
        if (!isOpen) {
          setStage({ kind: "confirm" });
          setCopied(false);
        }
      }}
    >
      <AlertDialogContent>
        {stage.kind === "result" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-science-soft text-science-strong">
                <KeyRoundIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>임시 비밀번호가 발급되었습니다</AlertDialogTitle>
              <AlertDialogDescription>
                {name}({target ? accountLabel(target.email) : ""}) 학생에게 아래 비밀번호를 직접 전달해 주세요. 학생은
                이 비밀번호로 로그인한 뒤 새 비밀번호를 설정하게 됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
              <code
                className="min-w-0 flex-1 font-mono text-lg tracking-wider break-all select-all"
                aria-label="임시 비밀번호"
              >
                {stage.tempPassword}
              </code>
              <Button variant="outline" size="sm" onClick={() => onCopy(stage.tempPassword)}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "복사됨" : "복사"}
              </Button>
            </div>

            <p className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="note">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span>
                이 창을 닫으면 비밀번호를 <strong>다시 볼 수 없습니다.</strong> 잊어버렸다면 다시 초기화하면 새
                비밀번호가 발급됩니다.
              </span>
            </p>
            {stage.warning ? (
              <p className="text-sm text-destructive" role="alert">
                {stage.warning}
              </p>
            ) : null}

            <AlertDialogFooter>
              <Button onClick={close}>확인했어요, 닫기</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{name} 학생의 비밀번호를 초기화할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                기존 비밀번호는 즉시 쓸 수 없게 되고, 임시 비밀번호가 한 번만 표시됩니다. 학생은 다음 로그인 때 새
                비밀번호를 설정해야 합니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {stage.kind === "confirm" && stage.error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
                {stage.error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={stage.kind === "working"}>취소</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={stage.kind === "working"} onClick={onConfirm}>
                {stage.kind === "working" ? <Loader2Icon className="animate-spin" /> : null}
                {stage.kind === "confirm" && stage.error ? "다시 시도" : "초기화"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
