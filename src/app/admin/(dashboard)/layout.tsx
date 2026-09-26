import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminContextProvider } from "@/hooks/use-admin-context";

/**
 * 개요 · 선생님 글 · 회원 관리 · 학습 현황 · 커뮤니티(와 메뉴에서 뺀 블로그 글 관리)에 씌우는 대시보드 크롬(Route Group이라 URL에는 영향이 없다).
 * AdminContextProvider: 총괄 여부·내 학급을 한 번 읽어 대시보드 화면들이 함께 쓴다(docs/classes/spec.md 개정 1).
 */
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AdminContextProvider>
      <AdminShell>{children}</AdminShell>
    </AdminContextProvider>
  );
}
