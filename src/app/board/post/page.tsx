import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityDetailSkeleton, CommunityPostDetail } from "@/components/community/community-post-detail";

export const metadata: Metadata = { title: "자유게시판" };

// 정적 export: /board/post/?id=<uuid>. useSearchParams를 쓰므로 Suspense 경계 안에 둔다.
export default function BoardPostPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<CommunityDetailSkeleton />}>
        <CommunityPostDetail kind="board" />
      </Suspense>
    </div>
  );
}
