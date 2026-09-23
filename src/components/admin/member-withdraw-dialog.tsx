"use client";

import { useRef, useState } from "react";
import { AlertTriangleIcon, Loader2Icon, UserMinusIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { AdminActionError, accountLabel, memberRealName, withdrawMember } from "@/lib/admin";
import type { MemberRow } from "@/lib/types";

type Stage = { kind: "confirm"; error?: string } | { kind: "working" };

/**
 * 회원 완전 탈퇴 확인 다이얼로그 (docs/admin/admin-tools/spec.md §1.3 + 개정 1).
 * 되돌릴 수 없는 동작이므로 학생 이름을 그대로 다시 입력해야 실행 버튼이 켜진다.
 * 부모가 `target`과 `open`을 관리하고, 성공하면 onWithdrawn(대상 id, 탈퇴 시각)을 호출한다.
 */
export function MemberWithdrawDialog({
  target,
  open,
  onOpenChange,
  onWithdrawn,
}: {
  target: MemberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWithdrawn?: (userId: string, withdrawnAt: string) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const [typed, setTyped] = useState("");
  // 열릴 때마다 처음부터 시작한다(렌더 중 상태 보정 — 이전 값과 비교).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setTyped("");
    }
  }

  // 확인 입력은 가려진 "탈퇴한 학생"이 아니라 실제 이름과 비교한다.
  const name = target ? memberRealName(target) : "";
  const matches = typed.trim() === name && name.length > 0;
  const working = useRef(false);

  async function onConfirm() {
    if (!target || !matches || working.current) return; // 연타로 두 번 호출하지 않게
    working.current = true;
    setStage({ kind: "working" });
    try {
      const { withdrawnAt, warning } = await withdrawMember(target.id);
      onWithdrawn?.(target.id, withdrawnAt ?? new Date().toISOString());
      onOpenChange(false);
      if (warning) toast.warning(warning, { duration: 12000 });
      else toast.success(`${name} 학생을 탈퇴 처리했습니다.`);
    } catch (e) {
      setStage({
        kind: "confirm",
        error: e instanceof AdminActionError ? e.message : "탈퇴 처리를 하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      working.current = false;
    }
  }

  const busy = stage.kind === "working";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return; // 처리 중에는 바깥 클릭/Esc로 닫지 않는다.
        onOpenChange(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setStage({ kind: "confirm" });
          setTyped("");
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <UserMinusIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{name} 학생을 탈퇴 처리할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {name}({target ? accountLabel(target.email) : ""}) 학생의 <strong>계정이 삭제되어 더 이상 로그인할 수
            없게 됩니다.</strong> 작성한 글·댓글·학습 기록은 그대로 남고 이름만 “탈퇴한 학생”으로 보입니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="note">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            계정은 삭제되고 기록만 남습니다. <strong>복구할 수 없습니다.</strong> 다시 쓰게 하려면 계정을 새로 만들어야
            합니다.
          </span>
        </p>

        <label className="flex flex-col gap-1.5 text-sm">
          <span>
            계속하려면 학생 이름 <strong className="font-mono">{name}</strong> 을(를) 그대로 입력하세요.
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            autoComplete="off"
            aria-label="확인을 위해 학생 이름 입력"
            placeholder={name}
          />
        </label>

        {stage.kind === "confirm" && stage.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            {stage.error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy || !matches} onClick={onConfirm}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            {stage.kind === "confirm" && stage.error ? "다시 시도" : "탈퇴 처리"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
