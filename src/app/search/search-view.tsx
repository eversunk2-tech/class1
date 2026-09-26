"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRightIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { CommunityPostCard } from "@/components/community/community-post-list";
import { scienceAppEntries } from "@/components/dashboard/science-app-status";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { PostCardSkeleton } from "@/components/post-card";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { scienceHref } from "@/data/science-curriculum";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { useSession } from "@/hooks/use-session";
import { loginHrefHere, POST_SUMMARY_COLUMNS, type CommunityKind, type CommunityPostSummary } from "@/lib/community";
import { menuColorClasses } from "@/lib/menu-colors";
import { outlinePillClass, primaryPillClass } from "@/lib/pill";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/*
 * 검색(2026-09-26 사용자 결정): 블로그 글이 아니라 **실험 앱·자유게시판·학습게임**을 함께 찾는다.
 *  - 실험 앱: 사이트에 들어 있는 과학 차시 자료(src/data/science-curriculum.ts)에서 찾는다(DB 조회 없음) — 차시 제목·단원·학기.
 *  - 자유게시판: 로그인한 사람만(게시판 자체가 로그인 전용 — RLS도 비로그인에게 돌려주지 않음).
 *  - 학습게임: "로그인해야만 이용" 스위치대로(RLS).
 *  태그 칩은 종류(실험 앱·자유게시판·학습게임) 고르기다. 주소: /search/?q=…&kind=app|board|game
 */

const PAGE_SIZE = 10;
const MAX_QUERY_LENGTH = 100;

type Kind = "app" | "board" | "game";
const KINDS: { id: Kind; label: string }[] = [
  { id: "app", label: "실험 앱" },
  { id: "board", label: "자유게시판" },
  { id: "game", label: "학습게임" },
];
const isKind = (v: string): v is Kind => v === "app" || v === "board" || v === "game";

type Filters = { q: string; kind: Kind | "" };

function searchHref({ q, kind }: Filters) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
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

/** 띄어쓰기·대소문자를 무시하고 비교할 글자(실험 앱 찾기용) */
function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** 실험 앱(과학 차시 앱) 찾기 — 로컬 자료. q가 비면 전부. */
function searchApps(q: string) {
  const needle = norm(q);
  return scienceAppEntries().filter(({ term, unit, lesson }) => {
    if (!needle) return true;
    const hay = norm(`${term.label} ${unit.number}. ${unit.title} ${lesson.inquiry}. ${lesson.title} ${lesson.app.kind === "sim" ? "실험" : "조사"}`);
    return hay.includes(needle);
  });
}

/** 자유게시판·학습게임 글 찾기(제목·내용). RLS가 볼 수 있는 글만 돌려준다. */
async function searchCommunity(kind: CommunityKind, q: string, offset: number) {
  let query = supabase.from("community_posts").select(POST_SUMMARY_COLUMNS).eq("kind", kind);
  if (q) query = query.or(`title.ilike.${ilikeValue(q)},body.ilike.${ilikeValue(q)}`);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as unknown as CommunityPostSummary[];
}

export function SearchView() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const rawKind = (searchParams.get("kind") ?? "").trim();
  const kind: Kind | "" = isKind(rawKind) ? rawKind : "";
  const key = `${q}\n${kind}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 머리 판: 연보라 그라데이션 + 돋보기 3D 아이콘 + 큰 둥근 검색창(디자인 개편 2단계) */}
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-hero-home p-5 ring-1 ring-primary/10 shadow-(--shadow-md) sm:p-8 dark:shadow-none">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-heading text-3xl leading-tight font-normal sm:text-4xl">검색</h1>
            <p className="text-sm text-foreground/75">필요한 글의 제목, 요약, 태그로 찾아요</p>
          </div>
          <Icon3D
            name="magnifying-glass"
            size={88}
            loading="eager"
            className="mascot-float size-16 drop-shadow-[0_12px_14px_oklch(0.3_0.1_288/0.22)] sm:size-20"
          />
        </div>
        {/* key로 URL이 바뀔 때 입력창을 URL 값으로 다시 초기화한다. */}
        <SearchForm key={`form:${key}`} q={q} kind={kind} />
        <KindFilter kind={kind} q={q} />
      </div>
      <SearchResults key={`results:${key}`} q={q} kind={kind} />
    </div>
  );
}

function SearchForm({ q, kind }: Filters) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    router.push(searchHref({ q: value.trim().slice(0, MAX_QUERY_LENGTH), kind }));
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
          placeholder="제목이나 내용으로 검색"
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

/** 태그 = 종류 고르기(실험 앱 · 자유게시판 · 학습게임). 다시 누르면 해제. */
function KindFilter({ kind, q }: Filters) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-foreground/75">태그</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="태그 필터">
        {KINDS.map((k) => {
          const active = k.id === kind;
          return (
            <li key={k.id}>
              <Badge
                variant={active ? "default" : "secondary"}
                className={cn(
                  "h-auto rounded-full px-2.5 py-1 text-xs",
                  active ? "font-semibold" : "bg-card font-medium text-foreground ring-1 ring-foreground/10 hover:bg-muted",
                )}
                aria-current={active ? "true" : undefined}
                render={<Link href={searchHref({ q, kind: active ? "" : k.id })} />}
              >
                #{k.label}
                {active ? <XIcon aria-label="태그 선택 해제" /> : null}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SearchResults({ q, kind }: Filters) {
  if (!q && !kind) {
    return (
      <EmptyState
        title="검색어를 입력하거나 태그를 고르세요"
        description="실험 앱, 자유게시판, 학습게임에서 함께 찾아요."
        illustration={<EmptyOwl />}
      />
    );
  }
  const show = (k: Kind) => !kind || kind === k;
  const summary = [q ? `“${q}”` : null, kind ? `#${KINDS.find((k) => k.id === kind)?.label}` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col gap-8" aria-label="검색 결과">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {summary} 검색 결과
      </p>
      {show("app") ? <AppResults q={q} /> : null}
      {show("board") ? <CommunityResults kind="board" q={q} /> : null}
      {show("game") ? <CommunityResults kind="game" q={q} /> : null}
    </div>
  );
}

function ResultSection({ id, title, count, children }: { id: string; title: string; count?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="flex items-baseline gap-2 font-heading text-xl font-normal">
        {title}
        {count ? <span className="font-sans text-sm font-medium text-muted-foreground">{count}</span> : null}
      </h2>
      {children}
    </section>
  );
}

const scienceColors = menuColorClasses.science;

function AppResults({ q }: { q: string }) {
  const items = searchApps(q);
  return (
    <ResultSection id="search-apps" title="실험 앱" count={`${items.length}개`}>
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map(({ term, unit, lesson }) => (
            <li key={lesson.app.id}>
              <Link
                href={scienceHref(term.id, unit.number, lesson.id)}
                className="group flex items-center gap-3 rounded-2xl bg-card p-3.5 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                    lesson.app.kind === "sim" ? cn(scienceColors.softBg, scienceColors.ink) : "bg-home-soft text-home-ink",
                  )}
                >
                  {lesson.app.kind === "sim" ? "실험" : "조사"}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium break-keep">
                    {lesson.inquiry}. {lesson.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {term.label} · {unit.number}. {unit.title}
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">맞는 실험 앱이 없어요.</p>
      )}
    </ResultSection>
  );
}

type CommunityState = { status: "loading" } | { status: "error" } | { status: "ready"; posts: CommunityPostSummary[]; hasMore: boolean };

function CommunityResults({ kind, q }: { kind: "board" | "game"; q: string }) {
  const label = kind === "board" ? "자유게시판" : "학습게임";
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const locked = useLoginLocked();
  // 자유게시판은 늘 로그인 전용, 학습게임은 잠금 스위치가 켜졌을 때 로그인 전용
  const needLogin = !sessionLoading && !userId && (kind === "board" || locked);
  const [state, setState] = useState<CommunityState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (sessionLoading || needLogin) return;
    let active = true;
    searchCommunity(kind, q, 0).then(
      (posts) => {
        if (active) setState({ status: "ready", posts, hasMore: posts.length === PAGE_SIZE });
      },
      () => {
        if (active) setState({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [kind, q, sessionLoading, needLogin, userId, attempt]);

  async function loadMore() {
    if (state.status !== "ready") return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await searchCommunity(kind, q, state.posts.length);
      const known = new Set(state.posts.map((p) => p.id));
      setState({ status: "ready", posts: [...state.posts, ...page.filter((p) => !known.has(p.id))], hasMore: page.length === PAGE_SIZE });
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const id = `search-${kind}`;
  if (needLogin) {
    return (
      <ResultSection id={id} title={label}>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {label}은 로그인하면 함께 찾아져요.
          <Link href={loginHrefHere()} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 rounded-full px-3")}>
            로그인하기
          </Link>
        </p>
      </ResultSection>
    );
  }
  if (state.status === "loading") {
    return (
      <ResultSection id={id} title={label}>
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={`${label} 검색 결과를 불러오는 중`}>
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </ResultSection>
    );
  }
  if (state.status === "error") {
    return (
      <ResultSection id={id} title={label}>
        <ErrorState
          message={`${label} 검색 결과를 불러오지 못했어요.`}
          onRetry={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        />
      </ResultSection>
    );
  }
  return (
    <ResultSection id={id} title={label} count={state.hasMore ? `${state.posts.length}개 이상` : `${state.posts.length}개`}>
      {state.posts.length ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {state.posts.map((p) => (
              <li key={p.id}>
                <CommunityPostCard post={p} />
              </li>
            ))}
          </ul>
          {moreError ? (
            <p role="alert" className="text-center text-sm text-destructive">
              결과를 더 불러오지 못했어요.
            </p>
          ) : null}
          {state.hasMore ? (
            <Button variant="outline" className={cn(outlinePillClass, "mx-auto mt-1 h-10")} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">맞는 {label} 글이 없어요.</p>
      )}
    </ResultSection>
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
