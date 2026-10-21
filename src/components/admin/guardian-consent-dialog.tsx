"use client";

import { useRef, useState } from "react";
import { FileCheck2Icon, Loader2Icon } from "lucide-react";
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
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import { AdminActionError } from "@/lib/admin";
import { setGuardianConsent, setGuardianConsentForClass } from "@/lib/admin-privacy";

export type GuardianConsentTarget =
  | { kind: "student"; studentId: string; name: string }
  | { kind: "class"; classId: string; className: string; count: number };

type Stage = { kind: "confirm"; error?: string } | { kind: "working" };

/**
 * 보호자 동의서를 받았다고 기록하기(privacy-policy.md 8-2, spec 4.8) — 그 학생의 담임만(서버가 다시 본다).
 * - 학생 한 명: [동의서 받음으로 기록] → admin_set_guardian_consent(학생, true)
 * - 학급 모두: [이 학급 모두 동의서 받음으로 기록] → admin_set_guardian_consent_class(학급) — 기록 없는 학생만 표시
 * "받았다고 표시"일 뿐 법적 확인을 대신하지 않는다(문구가 실제로 받았을 때만 누르라고 알린다).
 */
export function GuardianConsentDialog({
  target,
  open,
  onOpenChange,
  onRecorded,
}: {
  target: GuardianConsentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 성공 뒤: 학생 한 명이면 그 id, 학급이면 바뀐 수 */
  onRecorded?: (result: { studentIds: string[]; classId: string | null; changed: number }) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const working = useRef(false);
  // 대상은 열 때 고정한다(닫히는 동안 문구가 바뀌지 않게).
  const [shown, setShown] = useState<GuardianConsentTarget | null>(target);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setShown(target);
    }
  }

  const t = shown;
  const isClass = t?.kind === "class";
  const title = isClass ? T.consentColumn.classButton : T.consentColumn.recordButton;
  const description = !t
    ? ""
    : t.kind === "class"
      ? fillText(T.consentColumn.classConfirm, { n: t.count })
      : fillText(T.consentColumn.recordConfirm, { 이름: t.name });

  async function onConfirm() {
    if (!t || working.current) return;
    working.current = true;
    setStage({ kind: "working" });
    try {
      if (t.kind === "student") {
        await setGuardianConsent(t.studentId, true);
        onRecorded?.({ studentIds: [t.studentId], classId: null, changed: 1 });
        toast.success(EXTRA.consentRecorded);
      } else {
        const changed = await setGuardianConsentForClass(t.classId);
        onRecorded?.({ studentIds: [], classId: t.classId, changed });
        toast.success(fillText(EXTRA.consentClassRecorded, { n: changed }));
      }
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
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <FileCheck2Icon />
          </AlertDialogMedia>
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
            {T.consentColumn.cancel}
          </AlertDialogCancel>
          <AlertDialogAction className="h-11 px-4" disabled={busy || !t} onClick={onConfirm}>
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
            {stage.kind === "confirm" && stage.error ? "다시 시도" : isClass ? T.consentColumn.classOk : T.consentColumn.recordOk}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
