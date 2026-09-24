import type { Metadata } from "next";
import Link from "next/link";
import { UploadIcon } from "lucide-react";
import { CommunityPostList } from "@/components/community/community-post-list";
import { PropStage, StageIcon, type StageProp } from "@/components/illustrations/prop-stage";
import { Highlight, SectionHeading } from "@/components/layout/highlight";
import { PageHero } from "@/components/layout/page-hero";
import { primaryPillClass } from "@/lib/pill";

export const metadata: Metadata = {
  title: "학습게임활동",
  description: "직접 만든 학습 게임을 올리고 함께 해 봐요.",
};

/** 학습게임 히어로 무대: 큰 게임기 + 로켓·별·행성 */
const GAME_PROPS: StageProp[] = [
  { name: "star", size: 56, className: "top-[2%] left-[4%] w-10 @4xl:w-13", tilt: -12, dur: 5.2, delay: -1, always: true },
  { name: "rocket", size: 64, className: "top-[0%] right-[0%] w-11 @4xl:w-15", tilt: 14, dur: 5.8, delay: -2.8, always: true },
  { name: "planet", size: 56, className: "bottom-[8%] left-[0%] w-10 @4xl:w-13", tilt: -10, dur: 6.4, delay: -0.5, always: true },
];

// 학습게임활동(docs/community/spec.md §3·§4). 업로드 게시판: 게임은 상세 화면의 sandbox 실행기에서만 돌아간다.
export default function GamesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <PageHero
        color="games"
        variant="gradient"
        eyebrow="학습게임활동"
        title={
          <>
            놀면서 배우는 <Highlight>게임</Highlight> 놀이터
          </>
        }
        description="생성형 AI로 만든 게임(HTML 파일)을 올리면 친구들이 바로 해 볼 수 있어요!"
        media={
          <PropStage props={GAME_PROPS} className="aspect-square w-[11rem] @2xl:w-[12.5rem]">
            <StageIcon name="video-game" />
          </PropStage>
        }
      />
      <section aria-labelledby="games-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading id="games-heading">게임 목록</SectionHeading>
          <Link href="/games/new/" className={primaryPillClass}>
            <UploadIcon className="size-4.5" aria-hidden />
            게임 올리기
          </Link>
        </div>
        <CommunityPostList kind="game" />
      </section>
    </div>
  );
}
