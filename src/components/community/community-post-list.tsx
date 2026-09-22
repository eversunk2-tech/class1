"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRightIcon, EyeOffIcon, Gamepad2Icon, HeartIcon, Loader2Icon, MessageSquareIcon } from "lucide-react";
import { CommunitySetupNotice } from "@/components/community/community-setup-notice";
import { EmptyBoxIllustration } from "@/components/illustrations/empty-box-illustration";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { PostCardSkeleton } from "@/components/post-card";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
        illustration={<EmptyBoxIllustration accent={kind === "board" ? "board" : "games"} className="h-28 w-36" />}
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
            <Button variant="outline" className="mx-auto mt-2 h-9 px-4" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
            </Button>
          ) : null}
        </>
      ) : hasMore ? (
        <Link href={meta.listHref} className={cn(buttonVariants({ variant: "ghost" }), "mx-auto h-9 px-4 text-muted-foreground")}>
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
    <article className="group relative flex gap-3 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40">
      {isGame ? (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-games-soft text-games-strong" aria-hidden>
          <Gamepad2Icon className="size-5.5" />
        </span>
      ) : null}
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
            className="min-w-0 truncate after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
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
