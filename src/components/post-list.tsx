"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { PostCard, PostCardSkeleton } from "@/components/post-card";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { POST_SUMMARY_COLUMNS, type PostSummary } from "@/lib/types";

const PAGE_SIZE = 10;

type Status = "loading" | "ready" | "error";

async function fetchPage(offset: number) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SUMMARY_COLUMNS)
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as PostSummary[];
}

/** post_id → 조회수. 실패해도 목록 표시는 계속한다. */
export async function fetchViewCounts(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("views").select("post_id,count").in("post_id", ids);
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.post_id as string, Number(r.count)]));
}

/** 발행된 글 목록 + "더 보기" 페이지네이션 */
export function PostList() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [views, setViews] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadFirst = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchPage(0);
      setPosts(page);
      setHasMore(page.length === PAGE_SIZE);
      setStatus("ready");
      const counts = await fetchViewCounts(page.map((p) => p.id));
      setViews(counts);
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchPage(0)
      .then(async (page) => {
        if (!active) return;
        setPosts(page);
        setHasMore(page.length === PAGE_SIZE);
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
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchPage(posts.length);
      const known = new Set(posts.map((p) => p.id));
      const fresh = page.filter((p) => !known.has(p.id));
      setPosts((prev) => [...prev, ...fresh]);
      setHasMore(page.length === PAGE_SIZE);
      const counts = await fetchViewCounts(fresh.map((p) => p.id));
      setViews((prev) => ({ ...prev, ...counts }));
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="글 목록을 불러오는 중">
        {Array.from({ length: 3 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return <ErrorState message="글 목록을 불러오지 못했습니다." onRetry={loadFirst} />;
  }

  if (!posts.length) {
    return <EmptyState title="아직 작성된 글이 없습니다" description="첫 글이 곧 올라올 예정입니다." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} views={views[p.id] ?? 0} />
      ))}
      {moreError ? (
        <p role="alert" className="text-center text-sm text-destructive">
          글을 더 불러오지 못했습니다.
        </p>
      ) : null}
      {hasMore ? (
        <Button variant="outline" className="mx-auto mt-2 h-9 px-4" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
        </Button>
      ) : null}
    </div>
  );
}
