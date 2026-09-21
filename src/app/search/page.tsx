import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchView, SearchViewSkeleton } from "./search-view";

export const metadata: Metadata = { title: "검색" };

// useSearchParams(q, tag)를 쓰는 SearchView는 Suspense 경계 안에 둬야 정적 빌드가 통과한다.
export default function SearchPage() {
  return (
    // 전역 레이아웃이 본문 폭을 정하지 않으므로 읽기 폭(max-w-3xl)을 직접 지킨다.
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<SearchViewSkeleton />}>
        <SearchView />
      </Suspense>
    </div>
  );
}
