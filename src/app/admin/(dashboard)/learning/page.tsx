import { Suspense } from "react";
import type { Metadata } from "next";
import { LearningView, LearningViewSkeleton } from "./learning-view";

export const metadata: Metadata = { title: "학습 현황" };

// /admin/learning/?tab={overview|apps|assignments|engagement}[&assignment={id}] (docs/admin/spec.md §3.6).
// useSearchParams 때문에 Suspense가 필요하다.
export default function AdminLearningPage() {
  return (
    <Suspense fallback={<LearningViewSkeleton />}>
      <LearningView />
    </Suspense>
  );
}
