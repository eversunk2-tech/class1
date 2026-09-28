"use client";

import { useId } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PencilLineIcon } from "lucide-react";
import { CommunityPostList } from "@/components/community/community-post-list";
import { SectionHeading } from "@/components/layout/highlight";
import { NativeSelect } from "@/components/learning/learning-ui";
import { PostCardSkeleton } from "@/components/post-card";
import { useBoardAccess } from "@/hooks/use-board-access";
import { useSession } from "@/hooks/use-session";
import { boardLabel, boardListHref, boardNewHref } from "@/lib/boards";
import { primaryPillClass } from "@/lib/pill";

/**
 * 자유게시판 목록 칸(/board/) — 담임교사별 게시판(docs/community/teacher-boards/spec.md 개정 1).
 * - 학생: 자기 학급의 먼저 맡은 담임 게시판 하나 — 고르기 없이 바로 그 게시판(예전 화면과 같다).
 * - 교사: 게시판이 둘 이상(자기가 개설한 학급의 게시판 + 보조로 맡은 학급의 게시판 등)이면 **교사 화면에만** "게시판" 고르기.
 *   고른 게시판은 주소(`?board=`)에 남아 글쓰기·뒤로 가기에서 이어진다.
 * - 학급이 없는 계정: 목록 대신 "아직 배정된 담임 선생님이 없어요"(교사는 "아직 맡은 학급이 없어요" — 목록이 보여 준다), 글쓰기 버튼 없음.
 * - SQL 적용 전(my_boards() 없음): 예전처럼 하나의 게시판(거르지 않음).
 * 누가 어떤 글을 보는지는 RLS가 정한다 — 이 칸은 고른 게시판만 남겨 보여 줄 뿐이다.
 */
export function BoardListSection() {
  const { isAdmin } = useSession();
  const access = useBoardAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickerId = useId();
  const wanted = searchParams.get("board");

  const boards = access.status === "ready" && access.access.mode === "boards" ? access.access.boards : null;
  const pickable = !!boards && isAdmin && boards.length > 1;
  const current = boards ? ((pickable ? boards.find((b) => b.ownerId === wanted) : undefined) ?? boards[0] ?? null) : null;
  const noBoard = !!boards && boards.length === 0;

  return (
    <section aria-labelledby="board-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading id="board-heading">글 목록</SectionHeading>
        {noBoard ? null : (
          <Link href={boardNewHref(pickable ? current?.ownerId : null)} className={primaryPillClass}>
            <PencilLineIcon className="size-4.5" aria-hidden />
            글쓰기
          </Link>
        )}
      </div>
      {pickable && current ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label htmlFor={pickerId} className="text-sm font-semibold">
            게시판
          </label>
          <NativeSelect
            id={pickerId}
            value={current.ownerId}
            onChange={(e) => router.replace(boardListHref(e.target.value), { scroll: false })}
            aria-describedby={`${pickerId}-help`}
            className="h-11 max-w-full min-w-[13rem] rounded-full bg-card px-4 text-sm font-medium shadow-(--shadow-sm) dark:bg-card dark:shadow-none"
          >
            {boards.map((b) => (
              <option key={b.ownerId} value={b.ownerId}>
                {boardLabel(b)}
              </option>
            ))}
          </NativeSelect>
          <p id={`${pickerId}-help`} className="w-full text-xs text-muted-foreground">
            학생은 자기 학급 담임 선생님(먼저 맡은 담임)의 게시판 하나만 봐요.
          </p>
        </div>
      ) : null}
      <CommunityPostList kind="board" boardOwner={current?.ownerId ?? null} />
    </section>
  );
}

/** 주소(useSearchParams)를 읽기 전 잠깐 보이는 자리(정적 export — Suspense 대체 화면) */
export function BoardListSectionSkeleton() {
  return (
    <section aria-labelledby="board-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading id="board-heading">글 목록</SectionHeading>
      </div>
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="자유게시판 목록을 불러오는 중">
        {[0, 1, 2].map((i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
