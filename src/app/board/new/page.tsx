import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityDetailSkeleton } from "@/components/community/community-post-detail";
import { CommunityNewPost } from "@/components/community/community-post-form";

export const metadata: Metadata = { title: "글쓰기 | 자유게시판", robots: { index: false } };

// 교사가 목록에서 고른 게시판(?board=)을 읽으므로 Suspense 경계 안에 둔다(정적 export — 담임교사별 게시판).
export default function BoardNewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<CommunityDetailSkeleton />}>
        <CommunityNewPost kind="board" />
      </Suspense>
    </div>
  );
}
