import { Suspense } from "react";
import type { Metadata } from "next";
import { PostEditorLoader, PostEditorSkeleton } from "./post-editor";

export const metadata: Metadata = { title: "글 작성", robots: { index: false, follow: false } };

// /admin/write/ (신규) · /admin/write/?slug=... (수정). useSearchParams 때문에 Suspense가 필요하다.
export default function AdminWritePage() {
  return (
    // 전역 레이아웃이 본문 폭을 정하지 않으므로 기존 폭을 직접 지킨다(spec §12 Q5):
    // 기본 max-w-3xl, 넓은 화면(lg 이상)에서는 기존 에디터와 같이 72rem까지(나란히 보기용).
    // 사이드바를 뺀 본문 컬럼 안에서만 넓어지므로 화면 밖으로 넘치지 않는다.
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col lg:max-w-6xl">
      {/* 관리자 가드는 상위 admin/layout.tsx가 담당한다. */}
      <Suspense fallback={<PostEditorSkeleton />}>
        <PostEditorLoader />
      </Suspense>
    </div>
  );
}
