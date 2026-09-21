import { Suspense } from "react";
import type { Metadata } from "next";
import { MembersView, MembersViewSkeleton } from "./members-view";

export const metadata: Metadata = { title: "회원 관리" };

// /admin/members/ (목록) · /admin/members/?id={uuid} (상세). useSearchParams 때문에 Suspense가 필요하다.
export default function AdminMembersPage() {
  return (
    <Suspense fallback={<MembersViewSkeleton />}>
      <MembersView />
    </Suspense>
  );
}
