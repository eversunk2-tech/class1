import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

/** 개요 · 글 관리 · 회원 관리 · 학습 현황 · 커뮤니티에만 씌우는 대시보드 크롬(Route Group이라 URL에는 영향이 없다). */
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
