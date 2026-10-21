"use client";

import { useRef, useState } from "react";
import { AlertTriangleIcon, Loader2Icon, Trash2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import { AdminActionError, memberRealName } from "@/lib/admin";
import { eraseStudent } from "@/lib/admin-privacy";
import type { MemberRow } from "@/lib/types";

type Stage = { kind: "confirm"; error?: string } | { kind: "working" };

/**
 * 학생 한 명 '기록까지 삭제'(privacy-policy.md 8-5, spec 4.7-3) — 보호자·학생이 삭제를 요구할 때.
 * 기존 '탈퇴 처리'는 학습 기록을 "탈퇴한 학생"으로 남기지만, 이 메뉴는 계정과 모든 기록을 지운다(되돌릴 수 없음).
 * Edge Function admin-clear-students `{ userId, confirmName }` — 대상(아이디 계정 학생)·호출자(그 학생의 담임 또는 총괄)는 함수가 다시 본다.
 * 이름을 그대로 다시 입력해야 실행 버튼이 켜진다(관리자 화면이라 "탈퇴한 학생"이 아니라 원래 이름과 비교).
 */
export function MemberEraseDialog({
  target,
  open,
  onOpenChange,
  onErased,
}: {
  target: MemberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onErased?: (userId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const [typed, setTyped] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setTyped("");
    }
  }

  const name = target ? memberRealName(target) : "";
  const matches = name.length > 0 && typed.trim() === name;
  const working = useRef(false);

  async function onConfirm() {
    if (!target || !matches || working.current) return; // 연타로 두 번 부르지 않게
    working.current = true;
    setStage({ kind: "working" });
    try {
      const r = await eraseStudent(target.id, typed.trim());
      if (r.failed > 0 || r.remaining > 0) {
        setStage({ kind: "confirm", error: r.warning ?? EXTRA.clearFailed });
        return;
      }
      onOpenChange(false);
      onErased?.(target.id);
      toast.success(fillText(EXTRA.eraseDone, { 이름: name }));
      if (r.warning) toast.warning(r.warning, { duration: 15000 });
    } catch (e) {
      setStage({ kind: "confirm", error: e instanceof AdminActionError ? e.message : EXTRA.clearFailed });
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
      {/* 작은 화면(화면 키보드 포함)에서는 창 안에서 스크롤한다 */}
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{fillText(T.studentErase.title, { 이름: name })}</AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            <RichText text={T.studentErase.body} />
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="flex items-start gap-1.5">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <span>
              {T.studentErase.typeName} <strong className="font-mono">{name}</strong>
            </span>
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            autoComplete="off"
            aria-label={T.studentErase.typeName}
            placeholder={name}
            className="h-11"
          />
        </label>

        {stage.kind === "confirm" && stage.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            {stage.error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 px-4" disabled={busy}>
            {T.studentErase.cancel}
          </AlertDialogCancel>
          {/* 되돌릴 수 없는 동작이라 진한 빨강(이름을 맞게 입력하기 전에는 꺼져 있다) */}
          <AlertDialogAction
            variant="destructive"
            className={`h-11 px-4 ${dangerSolidClass}`}
            disabled={busy || !matches}
            onClick={onConfirm}
          >
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <Trash2Icon />}
            {stage.kind === "confirm" && stage.error ? "다시 시도" : T.studentErase.ok}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
