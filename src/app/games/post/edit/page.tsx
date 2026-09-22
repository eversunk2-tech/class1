import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityDetailSkeleton } from "@/components/community/community-post-detail";
import { CommunityEditPost } from "@/components/community/community-post-form";

export const metadata: Metadata = { title: "게임 고치기 | 학습게임활동", robots: { index: false } };

export default function GamesEditPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Suspense fallback={<CommunityDetailSkeleton />}>
        <CommunityEditPost kind="game" />
      </Suspense>
    </div>
  );
}
