import type { Metadata } from "next";
import Link from "next/link";
import { UploadIcon } from "lucide-react";
import { CommunityPostList } from "@/components/community/community-post-list";
import { GameIllustration } from "@/components/illustrations/game-illustration";
import { PageHero } from "@/components/layout/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "학습게임활동",
  description: "직접 만든 학습 게임을 올리고 함께 해 봐요.",
};

// 학습게임활동(docs/community/spec.md §3·§4). 업로드 게시판: 게임은 상세 화면의 sandbox 실행기에서만 돌아간다.
export default function GamesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHero
        color="games"
        eyebrow="학습게임활동"
        title="놀면서 배우는 게임 놀이터"
        description="생성형 AI로 만든 게임(index.html)을 올리면 친구들이 바로 해 볼 수 있어요!"
        illustration={GameIllustration}
      />
      <section aria-labelledby="games-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="games-heading" className="font-heading text-2xl font-normal">
            게임 목록
          </h2>
          <Link href="/games/new/" className={cn(buttonVariants(), "h-9 px-4")}>
            <UploadIcon />
            게임 올리기
          </Link>
        </div>
        <CommunityPostList kind="game" />
      </section>
    </div>
  );
}
