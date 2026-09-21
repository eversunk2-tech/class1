import type { Metadata } from "next";
import { AppGrid } from "@/components/apps/app-grid";
import { GameIllustration } from "@/components/illustrations/game-illustration";
import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "학습게임활동",
  description: "수업에서 직접 만든 학습 게임을 해 볼 수 있어요.",
};

// 학습게임활동(spec §4.2). src/data/apps.ts의 로컬 데이터만 쓰므로 Supabase 호출이 없다.
export default function GamesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <PageHero
        color="games"
        eyebrow="학습게임활동"
        title="놀면서 배우는 게임 놀이터"
        description="수업에서 직접 만든 게임이에요. 카드를 누르면 바로 해 볼 수 있어요!"
        illustration={GameIllustration}
      />
      <section aria-labelledby="games-heading" className="flex flex-col gap-4">
        <h2 id="games-heading" className="font-heading text-2xl font-normal">
          게임 목록
        </h2>
        <AppGrid />
      </section>
    </div>
  );
}
