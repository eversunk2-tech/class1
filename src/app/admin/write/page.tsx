import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminGuard } from "@/components/admin-guard";
import { PostEditorLoader, PostEditorSkeleton } from "./post-editor";

export const metadata: Metadata = { title: "글 작성", robots: { index: false, follow: false } };

// /admin/write/ (신규) · /admin/write/?slug=... (수정). useSearchParams 때문에 Suspense가 필요하다.
export default function AdminWritePage() {
  return (
    <AdminGuard>
      <Suspense fallback={<PostEditorSkeleton />}>
        <PostEditorLoader />
      </Suspense>
    </AdminGuard>
  );
}
