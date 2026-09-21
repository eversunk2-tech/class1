import { Suspense } from "react";
import type { Metadata } from "next";
import { PostDetail, PostDetailSkeleton } from "./post-detail";

export const metadata: Metadata = { title: "글" };

// 정적 export: 동적 세그먼트 대신 /post/?slug=... 쿼리스트링을 쓴다.
// useSearchParams를 쓰는 PostDetail은 Suspense 경계 안에 둬야 빌드가 통과한다.
export default function PostPage() {
  return (
    // 전역 레이아웃이 본문 폭을 정하지 않으므로 읽기 폭(max-w-3xl)을 직접 지킨다.
    <div className="mx-auto w-full max-w-3xl">
      <Suspense fallback={<PostDetailSkeleton />}>
        <PostDetail />
      </Suspense>
    </div>
  );
}
