import { Suspense } from "react";
import type { Metadata } from "next";
import { PostDetail, PostDetailSkeleton } from "./post-detail";

export const metadata: Metadata = { title: "글" };

// 정적 export: 동적 세그먼트 대신 /post/?slug=... 쿼리스트링을 쓴다.
// useSearchParams를 쓰는 PostDetail은 Suspense 경계 안에 둬야 빌드가 통과한다.
export default function PostPage() {
  return (
    <Suspense fallback={<PostDetailSkeleton />}>
      <PostDetail />
    </Suspense>
  );
}
