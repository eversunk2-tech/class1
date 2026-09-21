import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPostList } from "./admin-post-list";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminPostList />
    </AdminGuard>
  );
}
