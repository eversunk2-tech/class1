import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityDetailSkeleton, CommunityPostDetail } from "@/components/community/community-post-detail";

export const metadata: Metadata = { title: "학습게임활동" };

// 정적 export: /games/post/?id=<uuid>. useSearchParams를 쓰므로 Suspense 경계 안에 둔다.
export default function GamesPostPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Suspense fallback={<CommunityDetailSkeleton />}>
        <CommunityPostDetail kind="game" />
      </Suspense>
    </div>
  );
}
