import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPostList } from "./admin-post-list";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    // 전역 레이아웃이 본문 폭을 정하지 않으므로 기존 폭(max-w-3xl)을 직접 지킨다.
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <AdminGuard>
        <AdminPostList />
      </AdminGuard>
    </div>
  );
}
