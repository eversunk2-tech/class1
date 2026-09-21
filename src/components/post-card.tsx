import Link from "next/link";
import { EyeIcon } from "lucide-react";
import { TagList } from "@/components/tag-chip";
import { formatCount, formatDate } from "@/lib/format";
import type { PostSummary } from "@/lib/types";

export function postHref(slug: string) {
  return `/post/?slug=${encodeURIComponent(slug)}`;
}

/** 관리자 에디터(수정 모드) 경로 */
export function editPostHref(slug: string) {
  return `/admin/write/?slug=${encodeURIComponent(slug)}`;
}

export function PostCard({ post, views }: { post: PostSummary; views?: number | null }) {
  return (
    <article className="group relative flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:gap-5">
      {post.cover_url ? (
        // 외부 URL 커버 이미지이므로 next/image 대신 img 사용(정적 export, 최적화 비활성)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.cover_url}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full rounded-lg bg-muted object-cover sm:w-40 sm:shrink-0"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="text-base leading-snug font-semibold sm:text-lg">
          <Link href={postHref(post.slug)} className="after:absolute after:inset-0 focus-visible:underline">
            {post.title}
          </Link>
        </h2>
        {post.summary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{post.summary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {post.published_at ? <time dateTime={post.published_at}>{formatDate(post.published_at)}</time> : null}
          {views != null ? (
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="size-3.5" aria-hidden />
              <span className="sr-only">조회수</span>
              {formatCount(views)}
            </span>
          ) : null}
          {/* 태그 링크만 카드 전체 링크 오버레이 위로 올린다(날짜·조회수를 눌러도 글로 이동). */}
          <TagList tags={post.tags} className="relative z-10" />
        </div>
      </div>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10" aria-hidden>
      <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
    </div>
  );
}
