import type { Metadata } from "next";
import { PrivacySettings } from "./privacy-settings";

export const metadata: Metadata = { title: "개인정보 설정" };

// /admin/privacy/ — 총괄 선생님 '개인정보 설정'(교사 인증 코드·문의 이메일·현황, docs/privacy/spec.md 6절).
export default function AdminPrivacyPage() {
  return <PrivacySettings />;
}
