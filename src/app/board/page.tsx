import type { Metadata } from "next";
import Link from "next/link";
import { PencilLineIcon } from "lucide-react";
import { CommunityPostList } from "@/components/community/community-post-list";
import { PropStage, StageIcon, type StageProp } from "@/components/illustrations/prop-stage";
import { Highlight, SectionHeading } from "@/components/layout/highlight";
import { PageHero } from "@/components/layout/page-hero";
import { primaryPillClass } from "@/lib/pill";

export const metadata: Metadata = {
  title: "자유게시판",
  description: "우리 반 친구들과 자유롭게 이야기를 나눠요.",
};

/** 자유게시판 히어로 무대: 큰 말풍선 + 반짝이·별·전구 */
const BOARD_PROPS: StageProp[] = [
  { name: "sparkles", size: 48, className: "top-[4%] left-[4%] w-9 @4xl:w-12", tilt: -8, dur: 4.6, delay: -1.4, always: true },
  { name: "star", size: 56, className: "top-[2%] right-[2%] w-10 @4xl:w-13", tilt: 12, dur: 5.4, delay: -2.6, always: true },
  { name: "light-bulb", size: 48, className: "bottom-[10%] left-[2%] w-9 @4xl:w-11", tilt: -12, dur: 5, delay: -0.3, always: true },
];

// 자유게시판 목록(docs/community/spec.md §2·§3). 누구나 읽고, 로그인하면 글을 쓸 수 있다.
export default function BoardPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <PageHero
        color="board"
        variant="gradient"
        eyebrow="자유게시판"
        title={
          <>
            무엇이든 <Highlight>이야기</Highlight>해요
          </>
        }
        description="궁금한 것, 자랑하고 싶은 것, 함께 나누고 싶은 이야기를 자유롭게 올려요."
        media={
          <PropStage props={BOARD_PROPS} className="aspect-square w-[11rem] @2xl:w-[12.5rem]">
            <StageIcon name="speech-balloon" />
          </PropStage>
        }
      />
      <section aria-labelledby="board-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading id="board-heading">글 목록</SectionHeading>
          <Link href="/board/new/" className={primaryPillClass}>
            <PencilLineIcon className="size-4.5" aria-hidden />
            글쓰기
          </Link>
        </div>
        <CommunityPostList kind="board" />
      </section>
    </div>
  );
}
