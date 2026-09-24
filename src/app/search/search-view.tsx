"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { PostCard, PostCardSkeleton } from "@/components/post-card";
import { fetchViewCounts } from "@/components/post-list";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { outlinePillClass, primaryPillClass } from "@/lib/pill";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { POST_SUMMARY_COLUMNS, type PostSummary } from "@/lib/types";

const PAGE_SIZE = 10;
/** 태그 칩 목록을 만들 때 살펴보는 최근 글 수(spec §2.3: 별도 테이블 없이 클라이언트에서 구성) */
const TAG_SAMPLE_SIZE = 100;
const MAX_QUERY_LENGTH = 100;

type Filters = { q: string; tag: string };

function searchHref({ q, tag }: Filters) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return qs ? `/search/?${qs}` : "/search/";
}

/**
 * PostgREST or() 필터 값으로 안전하게 쓰도록 큰따옴표로 감싼다.
 * 따옴표 안에서 특수 의미를 갖는 " 와 \ 는 공백으로 바꾼다(%, _ 는 와일드카드로 남아도 결과만 넓어질 뿐 안전).
 */
function ilikeValue(q: string) {
  return `"%${q.replace(/["\\]/g, " ")}%"`;
}

/**
 * 태그 하나를 PostgreSQL 배열 리터럴로 만든다. 요소를 큰따옴표로 감싸야
 * 쉼표·중괄호·NULL 같은 값이 배열 문법으로 해석되지 않는다(" 와 \ 는 백슬래시로 이스케이프).
 */
function tagArrayLiteral(tag: string) {
  return `{"${tag.replace(/["\\]/g, (m) => `\\${m}`)}"}`;
}

async function fetchResults({ q, tag }: Filters, offset: number) {
  let query = supabase.from("posts").select(POST_SUMMARY_COLUMNS).eq("published", true);
  if (q) query = query.or(`title.ilike.${ilikeValue(q)},summary.ilike.${ilikeValue(q)}`);
  if (tag) query = query.filter("tags", "cs", tagArrayLiteral(tag));
  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as PostSummary[];
}

/** 최근 발행 글의 태그를 사용 빈도순으로 모은다. 실패하면 빈 목록(검색 자체는 계속 가능). */
async function fetchTagCloud(): Promise<string[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("tags")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(TAG_SAMPLE_SIZE);
  if (error || !data) return [];
  const freq = new Map<string, number>();
  for (const row of data as { tags: string[] | null }[]) {
    for (const t of row.tags ?? []) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).map(([t]) => t);
}

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; posts: PostSummary[]; hasMore: boolean };

export function SearchView() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const tag = (searchParams.get("tag") ?? "").trim();
  const key = `${q}\n${tag}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 머리 판: 연보라 그라데이션 + 돋보기 3D 아이콘 + 큰 둥근 검색창(디자인 개편 2단계) */}
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-hero-home p-5 ring-1 ring-primary/10 shadow-(--shadow-md) sm:p-8 dark:shadow-none">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-heading text-3xl leading-tight font-normal sm:text-4xl">검색</h1>
            <p className="text-sm text-foreground/75">선생님 글의 제목·요약·태그로 찾아요.</p>
          </div>
          <Icon3D
            name="magnifying-glass"
            size={88}
            loading="eager"
            className="mascot-float size-16 drop-shadow-[0_12px_14px_oklch(0.3_0.1_288/0.22)] sm:size-20"
          />
        </div>
        {/* key로 URL이 바뀔 때 입력창을 URL 값으로 다시 초기화한다. */}
        <SearchForm key={`form:${key}`} q={q} tag={tag} />
        <TagFilter tag={tag} q={q} />
      </div>
      <SearchResults key={`results:${key}`} q={q} tag={tag} />
    </div>
  );
}

function SearchForm({ q, tag }: Filters) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    router.push(searchHref({ q: value.trim().slice(0, MAX_QUERY_LENGTH), tag }));
  }

  return (
    <form role="search" onSubmit={onSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="제목이나 요약으로 검색"
          aria-label="검색어"
          maxLength={MAX_QUERY_LENGTH}
          className="h-12 rounded-full bg-card pl-11 text-base shadow-(--shadow-sm) dark:bg-card dark:shadow-none"
        />
      </div>
      <Button type="submit" className={cn(primaryPillClass, "h-12 px-6")}>
        검색
      </Button>
    </form>
  );
}

function TagFilter({ tag, q }: Filters) {
  const [tags, setTags] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchTagCloud().then((t) => {
      if (active) setTags(t);
    });
    return () => {
      active = false;
    };
  }, []);

  if (tags === null) {
    return (
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-14 rounded-full" />
        ))}
      </div>
    );
  }

  // 현재 선택된 태그가 샘플에 없더라도 칩으로 보여 해제할 수 있게 한다.
  const list = tag && !tags.includes(tag) ? [tag, ...tags] : tags;
  if (!list.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-foreground/75">태그</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="태그 필터">
        {list.map((t) => {
          const active = t === tag;
          return (
            <li key={t}>
              <Badge
                variant={active ? "default" : "secondary"}
                className={cn(
                  "h-auto rounded-full px-2.5 py-1 text-xs",
                  active ? "font-semibold" : "bg-card font-medium text-foreground ring-1 ring-foreground/10 hover:bg-muted",
                )}
                aria-current={active ? "true" : undefined}
                render={<Link href={searchHref({ q, tag: active ? "" : t })} />}
              >
                #{t}
                {active ? <XIcon aria-label="태그 선택 해제" /> : null}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SearchResults({ q, tag }: Filters) {
  const hasFilter = Boolean(q || tag);
  const [state, setState] = useState<ResultState>(hasFilter ? { status: "loading" } : { status: "idle" });
  const [views, setViews] = useState<Record<string, number>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hasFilter) return;
    let active = true;
    fetchResults({ q, tag }, 0)
      .then(async (posts) => {
        if (!active) return;
        setState({ status: "ready", posts, hasMore: posts.length === PAGE_SIZE });
        const counts = await fetchViewCounts(posts.map((p) => p.id));
        if (active) setViews(counts);
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [q, tag, hasFilter, attempt]);

  async function loadMore() {
    if (state.status !== "ready") return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchResults({ q, tag }, state.posts.length);
      const known = new Set(state.posts.map((p) => p.id));
      const fresh = page.filter((p) => !known.has(p.id));
      setState({ status: "ready", posts: [...state.posts, ...fresh], hasMore: page.length === PAGE_SIZE });
      const counts = await fetchViewCounts(fresh.map((p) => p.id));
      setViews((prev) => ({ ...prev, ...counts }));
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status === "idle") {
    return (
      <EmptyState
        title="검색어를 입력하거나 태그를 선택하세요"
        description="발행된 글의 제목과 요약에서 찾습니다."
        illustration={<EmptyOwl />}
      />
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="검색 결과를 불러오는 중">
        {Array.from({ length: 3 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <ErrorState
        message="검색 결과를 불러오지 못했습니다."
        onRetry={() => {
          setState({ status: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const summary = [q ? `“${q}”` : null, tag ? `#${tag}` : null].filter(Boolean).join(" · ");

  if (!state.posts.length) {
    return (
      <EmptyState
        title="검색 결과가 없습니다"
        description={`${summary}에 해당하는 글을 찾지 못했습니다.`}
        illustration={<EmptyOwl />}
      />
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label="검색 결과">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {summary} 검색 결과
      </p>
      {state.posts.map((p) => (
        <PostCard key={p.id} post={p} views={views[p.id] ?? 0} />
      ))}
      {moreError ? (
        <p role="alert" className="text-center text-sm text-destructive">
          결과를 더 불러오지 못했습니다.
        </p>
      ) : null}
      {state.hasMore ? (
        <Button variant="outline" className={cn(outlinePillClass, "mx-auto mt-2 h-10")} onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
        </Button>
      ) : null}
    </section>
  );
}

export function SearchViewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="검색 화면을 불러오는 중">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-full" />
      <div className="flex flex-col gap-3">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </div>
  );
}
