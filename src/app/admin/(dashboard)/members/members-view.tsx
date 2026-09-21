"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberDetail } from "./member-detail";
import { MemberList } from "./member-list";

/** ?id= 가 있으면 회원 상세, 없으면 목록(정적 export라 동적 세그먼트 대신 쿼리스트링을 쓴다). */
export function MembersView() {
  const id = useSearchParams().get("id");
  // key로 id가 바뀔 때마다 상세 상태를 새로 만든다.
  return id ? <MemberDetail key={id} id={id} /> : <MemberList />;
}

export function MembersViewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="회원 정보를 불러오는 중">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
