import type { Metadata } from "next";
import { TaggedPostList } from "@/components/class/tagged-post-list";
import { MathIllustration } from "@/components/illustrations/math-illustration";
import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "수학수업",
  description: "수학 시간에 배운 개념과 풀이를 모아 두었어요.",
};

// 수학수업(spec §4.3). "수학" 태그가 달린 글만 모아 보여 준다.
export default function MathPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHero
        color="math"
        eyebrow="수학수업"
        title="차근차근 풀어 보는 수학"
        description="수학 시간에 배운 개념과 풀이를 모아 두었어요."
        illustration={MathIllustration}
      />
      <section aria-labelledby="math-heading" className="flex flex-col gap-4">
        <h2 id="math-heading" className="font-heading text-2xl font-normal">
          수학 수업 글
        </h2>
        <TaggedPostList tag="수학" accent="math" />
      </section>
    </div>
  );
}
