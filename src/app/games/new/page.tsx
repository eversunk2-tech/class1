import type { Metadata } from "next";
import { CommunityNewPost } from "@/components/community/community-post-form";

export const metadata: Metadata = { title: "게임 올리기 | 학습게임활동", robots: { index: false } };

export default function GamesNewPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <CommunityNewPost kind="game" />
    </div>
  );
}
