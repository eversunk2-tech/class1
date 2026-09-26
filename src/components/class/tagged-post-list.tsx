"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { PostCard, PostCardSkeleton } from "@/components/post-card";
import { fetchViewCounts } from "@/components/post-list";
import { LoginNeededNotice } from "@/components/login-gate";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { outlinePillClass } from "@/lib/pill";
import type { MenuColor } from "@/data/menu";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { supabase } from "@/lib/supabase";
import { POST_SUMMARY_COLUMNS, type PostSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type Status = "loading" | "ready" | "error";

/** 발행된 글을 최신순으로 가져온다. tag가 있으면 그 태그가 달린 글만(search-view와 같은 contains 필터). */
async function fetchPosts(tag: string | undefined, offset: number, size: number) {
  let query = supabase.from("posts").select(POST_SUMMARY_COLUMNS).eq("published", true);
  if (tag) query = query.contains("tags", [tag]);
  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + size - 1);
  if (error) throw error;
  return (data ?? []) as PostSummary[];
}

/**
 * 태그별 글 목록(과학수업 · 홈 대시보드 미리보기 공용, spec §4.3).
 * - `tag`가 없으면 태그와 상관없이 전체 글("최근 소식").
 * - `limit`이 없으면 "더 보기" 페이지네이션, 있으면 위에서 N개만 보여 주고 `moreHref` 링크를 단다.
 */
export function TaggedPostList({
  tag,
  limit,
  moreHref,
  emptyTitle,
  emptyDescription,
}: {
  tag?: string;
  limit?: number;
  moreHref?: string;
  /** (예전 빈 상태 상자 그림의 리본 색. 지금은 빈 화면이 생각하는 부엉이라 쓰지 않지만 호출부 호환을 위해 남겨 둔다.) */
  accent?: MenuColor;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const pageSize = limit ?? PAGE_SIZE;
  // "로그인해야만 이용"이 켜져 있으면 RLS가 글을 돌려주지 않는다 → 빈 목록 대신 까닭을 알려 준다.
  const locked = useLoginLocked();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [views, setViews] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadFirst = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchPosts(tag, 0, pageSize);
      setPosts(page);
      setHasMore(page.length === pageSize);
      setStatus("ready");
      const counts = await fetchViewCounts(page.map((p) => p.id));
      setViews(counts);
    } catch {
      setStatus("error");
    }
  }, [tag, pageSize]);

  useEffect(() => {
    let active = true;
    fetchPosts(tag, 0, pageSize)
      .then(async (page) => {
        if (!active) return;
        setPosts(page);
        setHasMore(page.length === pageSize);
        setStatus("ready");
        const counts = await fetchViewCounts(page.map((p) => p.id));
        if (active) setViews(counts);
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [tag, pageSize]);

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchPosts(tag, posts.length, pageSize);
      const known = new Set(posts.map((p) => p.id));
      const fresh = page.filter((p) => !known.has(p.id));
      setPosts((prev) => [...prev, ...fresh]);
      setHasMore(page.length === pageSize);
      const counts = await fetchViewCounts(fresh.map((p) => p.id));
      setViews((prev) => ({ ...prev, ...counts }));
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const name = tag ? `${tag} 수업 글` : "글";

  if (locked) return <LoginNeededNotice what={name} className="py-8" />;

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label={`${name} 목록을 불러오는 중`}>
        {Array.from({ length: Math.min(pageSize, 3) }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        message={`${name}을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.`}
        onRetry={loadFirst}
        illustration={<ErrorFaceIllustration className="size-24" />}
      />
    );
  }

  if (!posts.length) {
    return (
      <EmptyState
        title={emptyTitle ?? `아직 ${name}이 없어요`}
        description={emptyDescription ?? "새 글이 올라오면 여기에 나타나요."}
        illustration={<EmptyOwl />}
        className="py-8"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} views={views[p.id] ?? 0} />
      ))}
      {limit == null ? (
        <>
          {moreError ? (
            <p role="alert" className="text-center text-sm text-destructive">
              글을 더 불러오지 못했어요.
            </p>
          ) : null}
          {hasMore ? (
            <Button variant="outline" className={cn(outlinePillClass, "mx-auto mt-2 h-11")} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
            </Button>
          ) : null}
        </>
      ) : moreHref && hasMore ? (
        <Link href={moreHref} className={cn(buttonVariants({ variant: "ghost" }), "mx-auto h-9 rounded-full px-4 text-muted-foreground")}>
          더 보기
          <ArrowRightIcon />
        </Link>
      ) : null}
    </div>
  );
}
