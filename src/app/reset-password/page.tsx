import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "새 비밀번호 설정", robots: { index: false, follow: false } };

// 관리자가 비밀번호를 초기화한 계정이 강제로 거치는 화면이자, 로그인 사용자의 자발적 비밀번호 변경 화면(spec §3.7).
// 로그아웃 버튼(헤더 사용자 메뉴)에 닿을 수 있도록 기존 레이아웃 안에 둔다.
export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <ResetPasswordForm />
    </div>
  );
}
