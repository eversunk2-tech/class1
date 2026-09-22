import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityDetailSkeleton } from "@/components/community/community-post-detail";
import { CommunityEditPost } from "@/components/community/community-post-form";

export const metadata: Metadata = { title: "글 고치기 | 자유게시판", robots: { index: false } };

export default function BoardEditPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<CommunityDetailSkeleton />}>
        <CommunityEditPost kind="board" />
      </Suspense>
    </div>
  );
}
