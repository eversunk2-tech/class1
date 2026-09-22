import type { Metadata } from "next";
import { CommunityNewPost } from "@/components/community/community-post-form";

export const metadata: Metadata = { title: "글쓰기 | 자유게시판", robots: { index: false } };

export default function BoardNewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <CommunityNewPost kind="board" />
    </div>
  );
}
