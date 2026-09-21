import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  // 전역 레이아웃이 본문 폭을 정하지 않으므로 기존 폭(max-w-3xl)을 직접 지킨다.
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <LoginForm />
    </div>
  );
}
