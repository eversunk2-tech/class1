import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin-guard";
// 관리자 영역 한정 색 톤(보라 채도 낮춤 · 진한 빨강 · 고정폭 한글). .admin-area 안과 관리자 화면에서 연 대화상자에만 걸린다.
import "./admin-theme.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * 전 /admin/* 공통 레이아웃: 관리자 가드만 담당한다(docs/admin/spec.md §3.0).
 * 대시보드 크롬(사이드 내비)은 (dashboard)/layout.tsx가, 에디터(/admin/write/)는 자체 폭을 쓴다.
 * 가드는 UX용이며 실제 보호는 RLS가 담당한다.
 * `admin-area`: 관리자 화면 색 톤의 적용 범위 표시(./admin-theme.css, 디자인 개편 4단계).
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="admin-area flex w-full flex-1 flex-col">
      <AdminGuard>{children}</AdminGuard>
    </div>
  );
}
