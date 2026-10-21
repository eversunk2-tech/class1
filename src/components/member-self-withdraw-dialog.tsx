"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { PolicyText } from "@/components/privacy-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GATE_MESSAGES, SELF_WITHDRAW_TEXT } from "@/data/privacy-policy";
import { useSession } from "@/hooks/use-session";
import { LOGIN_EMAIL_DOMAIN } from "@/lib/auth";
import { dangerSolidClass } from "@/lib/danger-button";
import {
  fetchIsSuperAdmin,
  localSignOut,
  PRIVACY_EXTRA_TEXT,
  PrivacyActionError,
  selfDeleteMember,
} from "@/lib/privacy";
import { cn } from "@/lib/utils";

/*
 * 구글 선생님 스스로 회원 탈퇴(docs/privacy/spec.md 4.7-2, 글은 privacy-policy.md 8-6절 원문 그대로).
 * Edge Function member-self-delete(mode 'withdraw')가 조건을 다시 확인한다: 구글 전용 · 인증을 마쳤거나 교사 · 총괄 아님 ·
 * 담임인 학급에 학생이 남아 있지 않음(남아 있으면 학급 이름 목록 → "먼저 [학급 정리]" 안내).
 */

/** 사전 발급(아이디) 계정인가 — 그 계정은 회원 탈퇴 메뉴가 없다(탈퇴는 선생님이 처리) */
function isIdAccount(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith(`@${LOGIN_EMAIL_DOMAIN}`);
}

/**
 * 사용자 메뉴에 '회원 탈퇴'를 보일지: 구글(아이디가 아닌) 계정 · 교사(role admin — 인증을 마친 구글 선생님 포함) ·
 * 개인정보 기능이 서버에 있음(SQL ①) · 인증 전이 아님 · 총괄이 아님(모르면 숨김).
 */
export function useSelfWithdrawAvailable(): boolean {
  const { user, profile, gate } = useSession();
  const userId = user?.id ?? null;
  const candidate =
    !!userId &&
    !isIdAccount(user?.email) &&
    !(user?.identities ?? []).some((i) => i.provider === "email") &&
    profile?.role === "admin" &&
    !!gate?.ready &&
    gate.state !== "need_code";
  const [superFor, setSuperFor] = useState<{ userId: string; value: boolean | null } | null>(null);

  useEffect(() => {
    if (!candidate || !userId) return;
    let active = true;
    fetchIsSuperAdmin().then((value) => {
      if (active) setSuperFor({ userId, value });
    });
    return () => {
      active = false;
    };
  }, [candidate, userId]);

  return candidate && superFor?.userId === userId && superFor.value === false;
}

export function MemberSelfWithdrawDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-5 rounded-3xl p-5 sm:max-w-md" showCloseButton={!busy}>
        {/* 닫히면 내용이 언마운트되어, 열 때마다 입력칸이 새로 비워진다 */}
        <WithdrawForm onDone={() => onOpenChange(false)} busy={busy} setBusy={setBusy} />
      </DialogContent>
    </Dialog>
  );
}

function WithdrawForm({
  onDone,
  busy,
  setBusy,
}: {
  onDone: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const router = useRouter();
  const ids = useId();
  const inputId = `${ids}-confirm`;
  const [typed, setTyped] = useState("");
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 총괄인가: undefined = 확인 중, null = 모름(서버가 다시 확인한다), true/false
  const [isSuper, setIsSuper] = useState<boolean | null | undefined>(undefined);

  // 총괄 선생님은 이 화면에서 탈퇴할 수 없다(메뉴에서도 숨기지만, 확인을 못 한 채 열렸을 때 대비)
  useEffect(() => {
    let active = true;
    fetchIsSuperAdmin().then((v) => {
      if (active) setIsSuper(v);
    });
    return () => {
      active = false;
    };
  }, []);

  const ready = typed.trim() === SELF_WITHDRAW_TEXT.confirmWord;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy || isSuper === true || isSuper === undefined) return;
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      const result = await selfDeleteMember("withdraw");
      if (!result.ok) {
        setBlocked(result.blocked);
        setBusy(false);
        return;
      }
      await localSignOut();
      setBusy(false);
      onDone();
      toast.success(PRIVACY_EXTRA_TEXT.withdrawDone);
      router.replace("/");
    } catch (err) {
      setError(err instanceof PrivacyActionError ? err.message : GATE_MESSAGES.network);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-normal">{SELF_WITHDRAW_TEXT.title}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-foreground/85 break-keep">
          <PolicyText text={SELF_WITHDRAW_TEXT.lead} />
        </DialogDescription>
      </DialogHeader>

      {isSuper ? (
        <p role="alert" className="rounded-xl bg-muted px-3 py-2 text-sm font-medium break-keep">
          {SELF_WITHDRAW_TEXT.superAdmin}
        </p>
      ) : (
        <>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 marker:text-primary">
            {SELF_WITHDRAW_TEXT.bullets.map((b, i) => (
              <li key={i} className="pl-1 break-keep">
                <PolicyText text={b} />
              </li>
            ))}
          </ul>
          <div className="grid gap-2">
            <label htmlFor={inputId} className="text-sm font-medium">
              {SELF_WITHDRAW_TEXT.confirmLabel}
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
            />
          </div>
        </>
      )}

      {blocked ? (
        <p role="alert" className="rounded-xl bg-destructive/8 px-3 py-2 text-sm leading-6 text-destructive break-keep">
          <PolicyText text={SELF_WITHDRAW_TEXT.blocked} values={{ "학급 이름들": blocked.join(", ") }} />
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive break-keep">
          {error}
        </p>
      ) : null}

      <DialogFooter className="-mx-5 -mb-5 rounded-b-3xl p-4">
        <Button type="button" variant="outline" className="h-11 rounded-full px-5" disabled={busy} onClick={onDone}>
          {SELF_WITHDRAW_TEXT.cancel}
        </Button>
        {isSuper ? null : (
          <Button
            type="submit"
            variant="destructive"
            className={cn("h-11 rounded-full px-5", dangerSolidClass)}
            disabled={!ready || busy || isSuper === undefined}
          >
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {SELF_WITHDRAW_TEXT.submit}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
