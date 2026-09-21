import type { Metadata } from "next";
import { TaggedPostList } from "@/components/class/tagged-post-list";
import { ScienceIllustration } from "@/components/illustrations/science-illustration";
import { PageHero } from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "과학수업",
  description: "과학 시간에 배우고 실험한 내용을 모아 두었어요.",
};

// 과학수업(spec §4.3). "과학" 태그가 달린 글만 모아 보여 준다.
export default function SciencePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHero
        color="science"
        eyebrow="과학수업"
        title="궁금한 건 실험으로 알아봐요"
        description="과학 시간에 배우고 실험한 내용을 모아 두었어요."
        illustration={ScienceIllustration}
      />
      <section aria-labelledby="science-heading" className="flex flex-col gap-4">
        <h2 id="science-heading" className="font-heading text-2xl font-normal">
          과학 수업 글
        </h2>
        <TaggedPostList tag="과학" accent="science" />
      </section>
    </div>
  );
}
