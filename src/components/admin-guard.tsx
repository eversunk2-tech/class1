"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";

type CheckState = "checking" | "error" | "not-admin";

/**
 * 관리자 화면 가드. is_admin RPC가 true일 때만 children을 렌더링한다. UX용일 뿐 실제 보호는 RLS가 담당한다.
 * - 비로그인: /login/으로 이동
 * - 로그인했지만 관리자가 아님: "관리자만 접근할 수 있습니다" 안내
 * - 한 번 통과한 뒤 세션이 사라지면(토큰 갱신 실패 등) 화면을 유지하고 다시 로그인하라는 안내만 표시한다.
 *   (에디터는 이때 작성 중인 내용을 sessionStorage에 임시 저장한다.)
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { loading, user } = useSession();
  const router = useRouter();
  const userId = user?.id ?? null;
  // 관리자 확인을 통과한 사용자 id. 토큰 갱신으로 session 객체가 바뀌어도 id가 같으면 다시 확인하지 않는다.
  const [allowedUserId, setAllowedUserId] = useState<string | null>(null);
  const [check, setCheck] = useState<{ userId: string | null; state: CheckState }>({
    userId: null,
    state: "checking",
  });
  const [attempt, setAttempt] = useState(0);

  const wasAllowed = allowedUserId !== null;

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      // 이미 통과한 화면에서 세션이 사라졌으면 이동하지 않는다(작성 중인 글 보호).
      if (!wasAllowed) router.replace("/login/");
      return;
    }
    if (userId === allowedUserId) return;

    let active = true;
    const run = async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (!active) return;
      if (error) {
        if (wasAllowed) {
          // 이미 관리자 화면을 쓰던 중이면 화면을 유지하고 알리기만 한다. 실제 쓰기 권한은 RLS가 판단한다.
          toast.error("관리자 권한을 확인하지 못했습니다. 네트워크 상태를 확인해 주세요.");
          setAllowedUserId(userId);
        } else {
          setCheck({ userId, state: "error" });
        }
        return;
      }
      if (data === true) setAllowedUserId(userId);
      else {
        setAllowedUserId(null);
        setCheck({ userId, state: "not-admin" });
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [loading, userId, allowedUserId, wasAllowed, attempt, router]);

  if (wasAllowed && (!userId || userId === allowedUserId)) {
    return (
      <>
        {!loading && !userId ? <SessionLostNotice /> : null}
        {children}
      </>
    );
  }

  if (!loading && !userId) return <Pending message="로그인 화면으로 이동합니다…" />;

  const state = check.userId === userId ? check.state : "checking";
  if (state === "error") {
    return (
      <ErrorState
        className="my-10"
        message="관리자 권한을 확인하지 못했습니다."
        onRetry={() => {
          setCheck({ userId: null, state: "checking" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (state === "not-admin") {
    return (
      <EmptyState
        className="my-10"
        title="관리자만 접근할 수 있습니다"
        description="이 화면은 관리자 계정으로 로그인해야 볼 수 있습니다."
        action={
          <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
            메인으로
          </Button>
        }
      />
    );
  }
  return <Pending message="권한을 확인하는 중…" />;
}

function Pending({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      {message}
    </div>
  );
}

function SessionLostNotice() {
  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        로그인이 만료되었습니다. 지금은 저장할 수 없습니다. 작성 중인 내용은 이 탭에 임시 저장되며,
        다시 로그인한 뒤 이 화면으로 돌아오면 복원할 수 있습니다.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        render={<Link href="/login/" target="_blank" rel="noopener" />}
        nativeButton={false}
      >
        새 탭에서 로그인
      </Button>
    </div>
  );
}
