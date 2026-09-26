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
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { adminPermissions, useAdminContext } from "@/hooks/use-admin-context";
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
 * 사이트 전체 설정이라 **총괄만** 켜고 끈다(docs/classes/spec.md 개정 1-1 — admin_set_login_required도 총괄만).
 * 담임에게는 지금 상태만 읽기 전용으로 보여 준다.
 */
export function LoginRequiredCard() {
  const ctx = useAdminContext();
  const { canToggleLogin } = adminPermissions(ctx);
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
    if (busy || !canToggleLogin) return;
    if (next) setConfirmOpen(true); // 켜기 = 파급이 큰 방향이라 한 번 더 확인
    else void apply(false); // 끄기 = 원복이라 바로 반영
  }

  return (
    <section
      aria-labelledby="login-required-heading"
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4 transition-shadow sm:p-5",
        adminSurfaceClass,
        // 켜짐(방문자 잠김)은 눈에 띄게: 빨간 자물쇠 칩 + 옅은 빨간 윤곽(글자·스위치 상태로도 알 수 있어 색만으로 구분하지 않는다)
        on && "ring-destructive/35",
      )}
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
                ? "켜짐 — 로그인하지 않은 방문자는 블로그 글·댓글, 학습게임, 과학 앱을 볼 수 없습니다. 홈·메뉴·과학 차시 목록은 그대로 보입니다. 자유게시판은 이 스위치와 상관없이 늘 로그인한 사람만 봅니다."
                : "꺼짐 — 누구나 블로그 글과 학습게임을 읽을 수 있고, 과학 앱도 로그인 없이 체험할 수 있습니다(체험 기록은 저장되지 않습니다). 자유게시판은 이 스위치와 상관없이 늘 로그인한 사람만 봅니다."}
            </p>
          )}
        </div>
        <Switch
          checked={on}
          disabled={loading || busy || !canToggleLogin}
          onCheckedChange={onToggle}
          aria-label="로그인해야만 이용"
          aria-describedby={canToggleLogin ? "login-required-state" : "login-required-state login-required-readonly"}
        />
      </div>

      {!canToggleLogin ? (
        <p id="login-required-readonly" className="flex items-center gap-1.5 text-sm font-medium" role="note">
          <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {ctx.status === "loading"
            ? "권한을 확인하는 중…"
            : ctx.status === "error"
              ? "권한을 확인하지 못해 지금은 바꿀 수 없어요. 화면을 새로 고쳐 주세요."
              : "총괄 선생님만 바꿀 수 있어요. 지금 상태만 보여 드려요."}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {settings?.updated_at
          ? `마지막 변경: ${formatDateTime(settings.updated_at)}${settings.updated_by_name ? ` · ${settings.updated_by_name}` : ""}`
          : "아직 바꾼 적이 없습니다."}{" "}
        바뀐 설정은 방문자가 화면을 새로 고치거나 다음 데이터를 불러올 때부터 적용됩니다(이미 열어 둔 과학 앱은
        새로고침해야 반영됩니다). 메뉴·제목 같은 정적 화면과 검색엔진에 이미 색인된 내용은 그대로 남습니다.
      </p>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!busy) setConfirmOpen(next);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>글과 학습게임을 로그인 전용으로 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>
              막히는 것: 블로그 글·댓글, 학습게임, 과학 앱(로그인 안내만 보입니다). 자유게시판은 이 스위치와 상관없이 늘
              로그인한 사람만 봅니다. 그대로 열리는 것: 홈
              화면과 메뉴, 과학 차시 목록, 로그인·비밀번호 재설정. 관리자와 로그인한 학생은 지금과 똑같이 이용할 수
              있고, 이 화면에서 스위치를 다시 끄면 즉시 원래대로 돌아옵니다.
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
