"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InfoIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { AuthCardShell, authCardClass, authInputClass } from "@/components/auth-card-shell";
import { EmptyOwl, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { userHasPasswordLogin } from "@/lib/admin";
import { passwordUpdateErrorMessage } from "@/lib/auth";
import { outlinePillClass, primaryPillClass } from "@/lib/pill";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** 화면에서 요구하는 최소 길이(spec §14 Q4: 8자 이상 권장. 서버 정책은 Supabase 기본값). */
const MIN_LENGTH = 8;

/**
 * - saving: 비밀번호 저장 중
 * - confirming: 저장 성공 후 강제 변경 해제가 반영됐는지 프로필을 다시 읽는 중
 * - confirm-failed: 비밀번호는 바뀌었지만 해제 여부를 아직 확인하지 못함("다시 확인")
 *
 * 강제 변경 플래그는 DB 트리거가 비밀번호 변경과 같은 트랜잭션에서 해제한다(review #6/#11).
 * 그래서 저장 직후 탭을 닫아도 플래그가 남지 않는다. 이 화면은 해제가 반영됐는지 확인만 한다.
 */
type Phase = "idle" | "saving" | "confirming" | "confirm-failed";

export function ResetPasswordForm() {
  const router = useRouter();
  const { loading, user, mustChangePassword, refreshProfile } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [phase, setPhase] = useState<Phase>("idle");
  // 한 번이라도 확인에 실패했으면 입력 폼 대신 "다시 확인" 안내를 계속 보여 준다.
  const [needsRecheck, setNeedsRecheck] = useState(false);
  const submitting = useRef(false);

  const forced = mustChangePassword === true;

  // 비로그인 → 로그인 화면으로
  useEffect(() => {
    if (!loading && !user) router.replace("/login/");
  }, [loading, user, router]);

  async function finish() {
    setPhase("confirming");
    const next = await refreshProfile();
    if (!next || next.must_change_password === true) {
      setNeedsRecheck(true);
      setPhase("confirm-failed");
      return;
    }
    toast.success("새 비밀번호를 저장했습니다.");
    router.replace("/");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < MIN_LENGTH) next.password = `비밀번호는 ${MIN_LENGTH}자 이상으로 입력해 주세요.`;
    if (!confirm) next.confirm = "비밀번호를 한 번 더 입력해 주세요.";
    else if (password !== confirm) next.confirm = "두 비밀번호가 서로 달라요.";
    setErrors(next);
    if (Object.keys(next).length) return;
    if (submitting.current) return; // 빠른 연타 방지
    submitting.current = true;

    setPhase("saving");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrors({ form: passwordUpdateErrorMessage(error.message, error.code) });
        setPhase("idle");
        submitting.current = false;
        return;
      }
    } catch (err) {
      setErrors({ form: passwordUpdateErrorMessage(err instanceof Error ? err.message : null) });
      setPhase("idle");
      submitting.current = false;
      return;
    }
    setPassword("");
    setConfirm("");
    submitting.current = false;
    await finish();
  }

  if (loading || !user) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3 py-4 sm:py-10" aria-busy="true">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // GitHub/Google로만 로그인하는 계정은 비밀번호가 없다(강제 변경 대상도 아님).
  if (!forced && !userHasPasswordLogin(user)) {
    return (
      <EmptyState
        className="my-10"
        title="비밀번호가 없는 계정이에요"
        description="GitHub·Google 계정으로 로그인하고 있어서 이 사이트에서 바꿀 비밀번호가 없습니다."
        illustration={<EmptyOwl />}
        action={
          <Link href="/" className={outlinePillClass}>
            메인으로
          </Link>
        }
      />
    );
  }

  const busy = phase === "saving" || phase === "confirming";

  return (
    <AuthCardShell decoration="props">
      <Card className={authCardClass}>
        <CardHeader className="justify-items-center gap-2 text-center">
          <CardTitle className="text-3xl font-normal">새 비밀번호 설정</CardTitle>
          <CardDescription className="break-keep">
            {forced ? "계속하려면 나만 아는 새 비밀번호를 정해 주세요." : "새로 사용할 비밀번호를 입력해 주세요."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {forced ? (
            <div className="flex gap-2.5 rounded-2xl bg-primary/5 p-3.5 text-sm ring-1 ring-primary/15 dark:bg-primary/10" role="note">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-medium">왜 이 화면이 나오나요?</p>
                <p className="text-muted-foreground">
                  선생님이 비밀번호를 초기화해서 지금은 임시 비밀번호로 로그인한 상태예요. 새 비밀번호를 저장해야
                  다른 화면을 쓸 수 있어요.
                </p>
              </div>
            </div>
          ) : null}

          {needsRecheck ? (
            <div className="flex flex-col gap-3" role="alert">
              <p className="text-sm">
                새 비밀번호는 저장됐어요. 변경 완료가 반영됐는지 아직 확인하지 못했어요. 네트워크를 확인한 뒤 다시
                확인해 주세요. (새 비밀번호를 다시 입력할 필요는 없어요.)
              </p>
              <Button className={cn(primaryPillClass, "h-11")} onClick={finish} disabled={phase === "confirming"}>
                {phase === "confirming" ? <Loader2Icon className="animate-spin" /> : null}
                다시 확인
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              {/* 비밀번호 관리자가 계정과 짝지을 수 있도록 숨은 아이디 필드를 둔다. */}
              <input type="text" name="username" autoComplete="username" value={user.email ?? ""} readOnly hidden />
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">새 비밀번호</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby="new-password-hint"
                  className={authInputClass}
                />
                <p id="new-password-hint" className={errors.password ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                  {errors.password ?? `${MIN_LENGTH}자 이상, 영문과 숫자를 섞으면 더 안전해요.`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
                  aria-invalid={errors.confirm ? true : undefined}
                  aria-describedby={errors.confirm ? "confirm-password-error" : undefined}
                  className={authInputClass}
                />
                {errors.confirm ? (
                  <p id="confirm-password-error" className="text-sm text-destructive">
                    {errors.confirm}
                  </p>
                ) : null}
              </div>
              {errors.form ? (
                <p role="alert" className="text-sm text-destructive">
                  {errors.form}
                </p>
              ) : null}
              <Button type="submit" size="lg" className={cn(primaryPillClass, "mt-1 h-12 text-base")} disabled={busy}>
                {busy ? <Loader2Icon className="animate-spin" /> : null}
                새 비밀번호 저장
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthCardShell>
  );
}
