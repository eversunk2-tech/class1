import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin-guard";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * 전 /admin/* 공통 레이아웃: 관리자 가드만 담당한다(docs/admin/spec.md §3.0).
 * 대시보드 크롬(사이드 내비)은 (dashboard)/layout.tsx가, 에디터(/admin/write/)는 자체 폭을 쓴다.
 * 가드는 UX용이며 실제 보호는 RLS가 담당한다.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <AdminGuard>{children}</AdminGuard>
    </div>
  );
}
