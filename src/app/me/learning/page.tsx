import { Suspense } from "react";
import type { Metadata } from "next";
import { MyLearningSkeleton, MyLearningView } from "./my-learning-view";

export const metadata: Metadata = { title: "내 학습 활동", robots: { index: false, follow: false } };

// /me/learning/?tab={apps|posts|social|assignments|feedback} (docs/admin/spec.md §3.8).
// useSearchParams 때문에 Suspense가 필요하다.
export default function MyLearningPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <Suspense fallback={<MyLearningSkeleton />}>
        <MyLearningView />
      </Suspense>
    </div>
  );
}
