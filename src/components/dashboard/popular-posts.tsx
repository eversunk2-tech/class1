"use client";

import { useEffect, useState } from "react";
import { EmptyBoxIllustration } from "@/components/illustrations/empty-box-illustration";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { PostCard, PostCardSkeleton } from "@/components/post-card";
import { EmptyState, ErrorState } from "@/components/states";
import { supabase } from "@/lib/supabase";
import { POST_SUMMARY_COLUMNS, type PostSummary } from "@/lib/types";

type Status = "loading" | "ready" | "error";

type PopularPost = { post: PostSummary; views: number };

/** 조회수 상위 후보를 넉넉히 가져온다(비공개 글의 views 행이 섞여 있을 수 있어 걸러낸 뒤 limit개만 쓴다). */
const CANDIDATE_MULTIPLIER = 4;

/** views 테이블을 count 내림차순으로 먼저 조회한 뒤, 발행된 글 정보와 맞춰 같은 순서로 돌려준다(spec §4.1). */
async function fetchPopular(limit: number): Promise<PopularPost[]> {
  const { data: top, error: viewsError } = await supabase
    .from("views")
    .select("post_id,count")
    .order("count", { ascending: false })
    .limit(limit * CANDIDATE_MULTIPLIER);
  if (viewsError) throw viewsError;
  const rows = (top ?? []) as { post_id: string; count: number }[];
  if (!rows.length) return [];

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select(POST_SUMMARY_COLUMNS)
    .in(
      "id",
      rows.map((r) => r.post_id),
    )
    .eq("published", true);
  if (postsError) throw postsError;

  const byId = new Map(((posts ?? []) as PostSummary[]).map((p) => [p.id, p]));
  return rows
    .flatMap((r) => {
      const post = byId.get(r.post_id);
      return post ? [{ post, views: Number(r.count) }] : [];
    })
    .slice(0, limit);
}

/** 인기 글(조회수 상위 N개). 조회 기록이 없는 글은 자연히 빠진다. */
export function PopularPosts({ limit = 3 }: { limit?: number }) {
  const [items, setItems] = useState<PopularPost[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPopular(limit)
      .then((result) => {
        if (!active) return;
        setItems(result);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [limit, attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="인기 글을 불러오는 중">
        {Array.from({ length: limit }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        message="인기 글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        onRetry={retry}
        illustration={<ErrorFaceIllustration className="size-24" />}
      />
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title="아직 인기 글이 없어요"
        description="글을 많이 읽으면 여기에 나타나요."
        illustration={<EmptyBoxIllustration accent="games" className="h-28 w-36" />}
        className="py-8"
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {items.map(({ post, views }) => (
        <li key={post.id}>
          <PostCard post={post} views={views} />
        </li>
      ))}
    </ol>
  );
}
