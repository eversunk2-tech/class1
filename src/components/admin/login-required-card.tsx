"use client";

import { useEffect, useState } from "react";
import { LockIcon, LockOpenIcon } from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AdminActionError,
  fetchSiteSettings,
  LOGIN_REQUIRED_MISSING_MESSAGE,
  setLoginRequired,
  SITE_SETTINGS_FALLBACK,
  type SiteSettings,
} from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "로그인해야만 이용" 토글 (docs/admin/admin-tools/spec.md §2.4).
 * 켤 때만 확인 다이얼로그를 거치고, 끄는 방향(원복)은 바로 반영한다 — 실수로 켜는 것만 막는다.
 * 설정을 읽지 못하면 "꺼짐"으로 보여 준다(절대 잠긴 것처럼 굴지 않는다).
 */
export function LoginRequiredCard() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 값을 바꾼 뒤 "마지막 변경" 표시를 서버 값으로 다시 맞추기 위한 재조회 신호
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchSiteSettings().then(
      (s) => {
        if (active) setSettings(s);
      },
      () => {
        // 읽지 못해도 "꺼짐"으로 보여 준다(잠긴 것처럼 굴지 않는다).
        if (active) setSettings(SITE_SETTINGS_FALLBACK);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const loading = settings === null;
  const on = settings?.login_required === true;

  async function apply(next: boolean) {
    setBusy(true);
    // 먼저 화면을 바꾸고, 실패하면 되돌린다.
    setSettings((s) => ({ ...(s ?? SITE_SETTINGS_FALLBACK), login_required: next }));
    try {
      await setLoginRequired(next);
      toast.success(next ? "이제 로그인해야 사이트를 볼 수 있습니다." : "누구나 사이트를 볼 수 있게 되돌렸습니다.");
      setAttempt((n) => n + 1);
    } catch (e) {
      setSettings((s) => ({ ...(s ?? SITE_SETTINGS_FALLBACK), login_required: !next }));
      toast.error(e instanceof AdminActionError ? e.message : LOGIN_REQUIRED_MISSING_MESSAGE);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  function onToggle(next: boolean) {
    if (busy) return;
    if (next) setConfirmOpen(true); // 켜기 = 파급이 큰 방향이라 한 번 더 확인
    else void apply(false); // 끄기 = 원복이라 바로 반영
  }

  return (
    <section
      aria-labelledby="login-required-heading"
      className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            on ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {on ? <LockIcon className="size-5" /> : <LockOpenIcon className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="login-required-heading" className="font-heading text-lg leading-tight font-normal">
            로그인해야만 이용
          </h2>
          {loading ? (
            <Skeleton className="mt-1 h-4 w-64" />
          ) : (
            <p id="login-required-state" className="text-sm text-muted-foreground">
              {on
                ? "켜짐 — 로그인하지 않은 방문자는 글·댓글·게시판·학습게임을 볼 수 없습니다."
                : "꺼짐 — 누구나 글을 읽을 수 있습니다."}
            </p>
          )}
        </div>
        <Switch
          checked={on}
          disabled={loading || busy}
          onCheckedChange={onToggle}
          aria-label="로그인해야만 이용"
          aria-describedby="login-required-state"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {settings?.updated_at
          ? `마지막 변경: ${formatDateTime(settings.updated_at)}${settings.updated_by_name ? ` · ${settings.updated_by_name}` : ""}`
          : "아직 바꾼 적이 없습니다."}{" "}
        바뀐 설정은 방문자가 화면을 새로 고치거나 다음 데이터를 불러올 때부터 적용됩니다. 메뉴·제목 같은 정적 화면과
        검색엔진에 이미 색인된 내용은 그대로 남습니다.
      </p>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!busy) setConfirmOpen(next);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>사이트를 로그인 전용으로 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>
              로그인하지 않은 방문자는 글·댓글·자유게시판·학습게임을 볼 수 없게 됩니다. 관리자와 로그인한 학생은 그대로
              이용할 수 있고, 이 화면에서 스위치를 다시 끄면 즉시 원래대로 돌아옵니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void apply(true)}>
              켜기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
