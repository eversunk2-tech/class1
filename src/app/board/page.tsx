import type { Metadata } from "next";
import Link from "next/link";
import { PencilLineIcon } from "lucide-react";
import { CommunityPostList } from "@/components/community/community-post-list";
import { BoardIllustration } from "@/components/illustrations/board-illustration";
import { PageHero } from "@/components/layout/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "자유게시판",
  description: "우리 반 친구들과 자유롭게 이야기를 나눠요.",
};

// 자유게시판 목록(docs/community/spec.md §2·§3). 누구나 읽고, 로그인하면 글을 쓸 수 있다.
export default function BoardPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHero
        color="board"
        eyebrow="자유게시판"
        title="무엇이든 이야기해요"
        description="궁금한 것, 자랑하고 싶은 것, 함께 나누고 싶은 이야기를 자유롭게 올려요."
        illustration={BoardIllustration}
      />
      <section aria-labelledby="board-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="board-heading" className="font-heading text-2xl font-normal">
            글 목록
          </h2>
          <Link href="/board/new/" className={cn(buttonVariants(), "h-9 px-4")}>
            <PencilLineIcon />
            글쓰기
          </Link>
        </div>
        <CommunityPostList kind="board" />
      </section>
    </div>
  );
}
