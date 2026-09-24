"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRightIcon, EyeOffIcon, HeartIcon, Loader2Icon, MessageSquareIcon } from "lucide-react";
import { CommunitySetupNotice } from "@/components/community/community-setup-notice";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { PostCardSkeleton } from "@/components/post-card";
import { LoginNeededNotice } from "@/components/login-gate";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { outlinePillClass } from "@/lib/pill";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { useSession } from "@/hooks/use-session";
import {
  authorName,
  communityPostHref,
  embeddedCount,
  fetchCommunityPosts,
  isSetupMissing,
  KIND_META,
  type CommunityKind,
  type CommunityPostSummary,
} from "@/lib/community";
import { formatCount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type Status = "loading" | "ready" | "error" | "setup";

/**
 * 자유게시판 · 학습게임 목록(TaggedPostList 패턴, spec §3).
 * - `limit`이 없으면 "더 보기" 페이지네이션, 있으면 위에서 N개만(홈 미리보기).
 * - 숨긴 글은 RLS가 작성자 본인·관리자에게만 돌려주므로 "숨김" 배지를 붙여 보여 준다.
 */
export function CommunityPostList({ kind, limit }: { kind: CommunityKind; limit?: number }) {
  const { loading: sessionLoading, user } = useSession();
  // "로그인해야만 이용"이 켜져 있으면 RLS가 글을 돌려주지 않는다 → 빈 목록 대신 까닭을 알려 준다.
  const locked = useLoginLocked();
  const userId = user?.id ?? null;
  const pageSize = limit ?? PAGE_SIZE;
  const meta = KIND_META[kind];
  const [posts, setPosts] = useState<CommunityPostSummary[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // 로그인 사용자가 바뀌면(내 숨김 글 노출 여부) 다시 조회한다.
  useEffect(() => {
    if (sessionLoading) return;
    let active = true;
    fetchCommunityPosts(kind, 0, pageSize)
      .then((page) => {
        if (!active) return;
        setPosts(page);
        setHasMore(page.length === pageSize);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (active) setStatus(isSetupMissing(error) ? "setup" : "error");
      });
    return () => {
      active = false;
    };
  }, [kind, pageSize, userId, sessionLoading, attempt]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchCommunityPosts(kind, posts.length, pageSize);
      const known = new Set(posts.map((p) => p.id));
      setPosts((prev) => [...prev, ...page.filter((p) => !known.has(p.id))]);
      setHasMore(page.length === pageSize);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (locked) return <LoginNeededNotice what={meta.label} className="py-8" />;

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label={`${meta.label} 목록을 불러오는 중`}>
        {Array.from({ length: Math.min(pageSize, 3) }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (status === "setup") return <CommunitySetupNotice />;

  if (status === "error") {
    return (
      <ErrorState
        message={`${meta.label}을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.`}
        onRetry={retry}
        illustration={<ErrorFaceIllustration className="size-24" />}
      />
    );
  }

  if (!posts.length) {
    return (
      <EmptyState
        title={kind === "board" ? "아직 올라온 글이 없어요" : "아직 올라온 게임이 없어요"}
        description={kind === "board" ? "첫 번째 글을 남겨 볼까요?" : "직접 만든 게임을 첫 번째로 올려 볼까요?"}
        illustration={<EmptyOwl />}
        className="py-8"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id}>
            <CommunityPostCard post={p} />
          </li>
        ))}
      </ul>
      {limit == null ? (
        <>
          {moreError ? (
            <p role="alert" className="text-center text-sm text-destructive">
              더 불러오지 못했어요.
            </p>
          ) : null}
          {hasMore ? (
            <Button variant="outline" className={cn(outlinePillClass, "mx-auto mt-2 h-10")} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
            </Button>
          ) : null}
        </>
      ) : hasMore ? (
        <Link href={meta.listHref} className={cn(buttonVariants({ variant: "ghost" }), "mx-auto h-9 rounded-full px-4 text-muted-foreground")}>
          더 보기
          <ArrowRightIcon />
        </Link>
      ) : null}
    </div>
  );
}

function CommunityPostCard({ post }: { post: CommunityPostSummary }) {
  const comments = embeddedCount(post.community_comments);
  const likes = embeddedCount(post.community_likes);
  const isGame = post.kind === "game";
  return (
    // 흰 둥근 카드(디자인 개편 2단계): 3D 아이콘 칩, 올리면 살짝 떠오름. 카드 전체가 링크(after:inset-0)라
    // 키보드 초점은 카드 테두리 링으로 보여 준다.
    <article className="group relative flex gap-3.5 rounded-[1.5rem] bg-card p-4 shadow-(--shadow-sm) ring-1 ring-foreground/5 transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-md) motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5 dark:shadow-none dark:ring-foreground/10">
      <span
        className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", isGame ? "bg-grad-games" : "bg-grad-board")}
        aria-hidden
      >
        <Icon3D name={isGame ? "video-game" : "speech-balloon"} size={32} className="size-8" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="flex min-w-0 items-center gap-2 text-base leading-snug font-semibold">
          {post.hidden ? (
            <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
              <EyeOffIcon className="size-3" aria-hidden />
              숨김
            </Badge>
          ) : null}
          <Link
            href={communityPostHref(post.kind, post.id)}
            className="min-w-0 truncate outline-none after:absolute after:inset-0 after:rounded-[1.5rem] focus-visible:underline focus-visible:after:ring-3 focus-visible:after:ring-ring/60"
          >
            {post.title}
          </Link>
        </h3>
        {post.body ? <p className="line-clamp-1 text-sm break-all text-muted-foreground">{post.body}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{authorName(post)}</span>
          <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
          <span className="inline-flex items-center gap-1">
            <HeartIcon className="size-3.5" aria-hidden />
            <span className="sr-only">좋아요</span>
            {formatCount(likes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquareIcon className="size-3.5" aria-hidden />
            <span className="sr-only">댓글</span>
            {formatCount(comments)}
          </span>
        </div>
      </div>
    </article>
  );
}
