import type { Metadata } from "next";
import { PrivacyView } from "./privacy-view";

export const metadata: Metadata = { title: "개인정보 처리방침" };

// 개인정보 처리방침(docs/privacy/spec.md 6절, 글은 privacy-policy.md 5·6절 원문 그대로).
// 로그인 없이, 로그인 잠금 스위치와 상관없이 읽힌다(LoginGate의 잠금 경로가 아니다 — src/components/login-gate.tsx).
// 강제 비밀번호 변경 중에도 열린다(ForcePasswordChangeGate 허용 경로), 구글 확인 창도 이 화면에서는 뜨지 않는다(PrivacyGate).
// 시행 전(site_settings.policy_effective_at 없음)에는 "준비하고 있어요"만 보인다.
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PrivacyView />
    </div>
  );
}
