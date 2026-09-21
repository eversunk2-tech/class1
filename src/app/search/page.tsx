import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchView, SearchViewSkeleton } from "./search-view";

export const metadata: Metadata = { title: "검색" };

// useSearchParams(q, tag)를 쓰는 SearchView는 Suspense 경계 안에 둬야 정적 빌드가 통과한다.
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchViewSkeleton />}>
      <SearchView />
    </Suspense>
  );
}
