import { Suspense } from "react";
import type { Metadata } from "next";
import { ScienceView, ScienceViewSkeleton } from "@/components/science/science-view";

export const metadata: Metadata = {
  title: "과학수업",
  description: "학기와 단원별 과학 탐구 차시, 교과서·실험관찰 쪽수, 과학 수업 글을 모아 두었어요.",
};

// 과학수업(spec §4.3): 학기 → 단원 → 차시.
// 정적 export라 동적 세그먼트 대신 /science/?term=6-1&unit=2&lesson=3 쿼리스트링을 쓴다(scienceHref).
// useSearchParams를 쓰는 ScienceView는 Suspense 경계 안에 둬야 정적 빌드가 통과한다.
export default function SciencePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Suspense fallback={<ScienceViewSkeleton />}>
        <ScienceView />
      </Suspense>
    </div>
  );
}
