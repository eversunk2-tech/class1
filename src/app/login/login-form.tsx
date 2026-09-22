"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/hooks/use-session";
import { authErrorMessage, signInWithId, signInWithOAuth, type OAuthProvider } from "@/lib/auth";
import { goAfterLogin, nextFromLocation, rememberedLoginNext, rememberLoginNext } from "@/lib/login-redirect";

type Pending = null | "password" | OAuthProvider;

/** OAuth 실패·취소 시 Supabase가 URL 쿼리/해시에 붙여 보내는 오류를 읽는다. */
function readOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const desc =
    params.get("error_description") ?? hash.get("error_description") ?? params.get("error") ?? hash.get("error");
  return desc ? desc.replace(/\+/g, " ") : null;
}

export function LoginForm() {
  const router = useRouter();
  const { loading, user } = useSession();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  // 로그인 후 돌아갈 곳(?next=, 같은 사이트 경로만). OAuth에서 돌아오면 떠나기 전에 기억해 둔 값을 쓴다.
  // 오류 표시 effect가 주소창의 쿼리를 지우기 전에, 첫 렌더에서 한 번만 읽는다.
  // (정적 프리렌더 때는 window가 없어 null — 화면에 그리지 않는 값이라 하이드레이션 차이가 없다.)
  // OAuth에서 기억해 둔 값은 OAuth로 돌아왔을 때만 쓴다. 이 화면에서 비밀번호로 로그인하면 주소의 ?next=만 쓴다
  // (OAuth를 취소한 뒤 같은 탭에서 다른 사람이 비밀번호로 로그인해도 앞 사람이 가려던 곳으로 가지 않게).
  const [urlNext] = useState<string | null>(() => (typeof window === "undefined" ? null : nextFromLocation()));
  const [next] = useState<string | null>(() =>
    typeof window === "undefined" ? null : (nextFromLocation() ?? rememberedLoginNext()),
  );
  const viaPassword = useRef(false);

  // 이미 로그인했거나 OAuth 리다이렉트로 세션이 생기면 돌아갈 곳(없으면 메인)으로 이동
  useEffect(() => {
    if (!loading && user) goAfterLogin(viaPassword.current ? urlNext : next, (href) => router.replace(href));
  }, [loading, user, router, next, urlNext]);

  useEffect(() => {
    const oauthError = readOAuthError();
    if (!oauthError) return;
    // 외부(리다이렉트 URL) 상태를 한 번 읽어 표시하는 용도
    queueMicrotask(() => setError(authErrorMessage(oauthError)));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setPending("password");
    setError(null);
    viaPassword.current = true;
    rememberLoginNext(null);
    try {
      const { error } = await signInWithId(loginId, password);
      if (error) {
        setError(authErrorMessage(error.message));
        setPending(null);
      }
      // 성공 시 SessionProvider가 세션을 받아 위 effect에서 이동한다.
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : null));
      setPending(null);
    }
  }

  async function onOAuth(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    viaPassword.current = false;
    // 공급자 화면을 다녀와도 돌아갈 곳을 잃지 않게 잠깐 기억해 둔다(redirectTo는 /login/ 그대로).
    rememberLoginNext(next);
    try {
      const { error } = await signInWithOAuth(provider);
      if (error) {
        setError(authErrorMessage(error.message));
        setPending(null);
      }
      // 성공 시 브라우저가 공급자 로그인 화면으로 이동한다.
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : null));
      setPending(null);
    }
  }

  const busy = pending !== null || (!loading && !!user);

  return (
    <div className="mx-auto w-full max-w-sm py-4 sm:py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">로그인</CardTitle>
          <CardDescription>계정은 관리자가 미리 발급합니다. 별도의 회원가입은 없습니다.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-id">아이디</Label>
              <Input
                id="login-id"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                disabled={busy}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">비밀번호</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className="h-10"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="h-10" disabled={busy}>
              {pending === "password" ? <Loader2Icon className="animate-spin" /> : null}
              로그인
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            또는
            <Separator className="flex-1" />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-10"
              disabled={busy}
              onClick={() => onOAuth("github")}
            >
              {pending === "github" ? <Loader2Icon className="animate-spin" /> : <GitHubIcon />}
              GitHub로 로그인
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-10"
              disabled={busy}
              onClick={() => onOAuth("google")}
            >
              {pending === "google" ? <Loader2Icon className="animate-spin" /> : <GoogleIcon />}
              Google로 로그인
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}
