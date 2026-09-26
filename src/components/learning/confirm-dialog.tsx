"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
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
import { dangerSolidClass } from "@/lib/danger-button";

/**
 * 확인 다이얼로그(삭제 등). 처리 중에는 닫히지 않는다.
 * 더블클릭으로 onConfirm이 두 번 불리지 않도록 ref로 막는다(review #14) — busy가 false로 돌아오거나 다시 열 때 풀린다.
 * `destructive`면 확인 버튼을 진한 빨강 + 흰 글자(dangerSolidClass)로 그린다 — 관리자·학생 화면 공통(디자인 개편 4단계 개정 1).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  const firing = useRef(false);
  useEffect(() => {
    if (!busy) firing.current = false;
  }, [busy, open]);

  function confirm() {
    if (busy || firing.current) return;
    firing.current = true;
    onConfirm();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* 누르는 곳 44px 이상(CLAUDE.md 접근성 — 교사도 태블릿에서 누른다) */}
          <AlertDialogCancel disabled={busy} className="h-11 px-4">
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            className={destructive ? `h-11 px-4 ${dangerSolidClass}` : "h-11 px-4"}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
