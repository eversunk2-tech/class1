"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { LoginNeededNotice } from "@/components/login-gate";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { useSession } from "@/hooks/use-session";
import { outlinePillClass } from "@/lib/pill";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

type TeacherPost = { id: string; title: string; content_md: string };

async function fetchTeacherPosts(offset: number, size: number): Promise<TeacherPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,content_md")
    .eq("published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, offset + size - 1);
  if (error) throw error;
  return (data ?? []) as TeacherPost[];
}

/**
 * 홈 '선생님 글'(2026-09-26 사용자 결정): 관리자 화면에서 쓴 공개 글(posts)을 **제목만** 목록으로 보여 주고,
 * 제목을 누르면 접혀 있던 본문이 그 자리에서 펼쳐진다. 날짜는 보이지 않는다(사용자 결정 — 제목과 본문만).
 * 왼쪽 메뉴에는 없고 홈에서만 보인다. 본문은 처음 펼칠 때 그린다(marked + DOMPurify — MarkdownViewer).
 * 조회수·읽음 기록은 남기지 않는다(사용자 결정). **로그인한 사람에게만** 보이고, 로그인하지 않았으면 "로그인하면 확인할 수 있어요" 안내만
 * (사용자 결정 — 학급별 '선생님 글'(자기 담임 선생님 글만)은 반별 구분 기능과 함께 바뀐다: docs/classes/spec.md 개정 2).
 */
export function TeacherPosts() {
  const locked = useLoginLocked();
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const guest = !sessionLoading && !userId;
  const [posts, setPosts] = useState<TeacherPost[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set()); // 한 번이라도 펼친 글(본문을 그려 둠)
  const [attempt, setAttempt] = useState(0);
  const baseId = useId();

  useEffect(() => {
    if (locked || sessionLoading || !userId) return; // 로그인하지 않았으면 불러오지 않는다
    let active = true;
    fetchTeacherPosts(0, PAGE_SIZE).then(
      (page) => {
        if (!active) return;
        setPosts(page);
        setHasMore(page.length === PAGE_SIZE);
        setStatus("ready");
      },
      () => {
        if (active) setStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, locked, sessionLoading, userId]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchTeacherPosts(posts.length, PAGE_SIZE);
      const known = new Set(posts.map((p) => p.id));
      setPosts((prev) => [...prev, ...page.filter((p) => !known.has(p.id))]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(post: TeacherPost) {
    const willOpen = !open.has(post.id);
    setOpen((prev) => {
      const next = new Set(prev);
      if (willOpen) next.add(post.id);
      else next.delete(post.id);
      return next;
    });
    if (willOpen && !opened.has(post.id)) setOpened((prev) => new Set(prev).add(post.id));
  }

  if (locked || guest) {
    return <LoginNeededNotice what="선생님 글" description="로그인하면 담임 선생님 글을 확인할 수 있어요." className="py-8" />;
  }

  if (status === "loading") {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true" aria-label="선생님 글을 불러오는 중">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="rounded-[1.5rem] bg-card px-5 py-4 ring-1 ring-foreground/5 dark:ring-foreground/10">
            <Skeleton className="h-6 w-2/3" />
          </li>
        ))}
      </ul>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        message="선생님 글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        onRetry={retry}
        illustration={<ErrorFaceIllustration className="size-24" />}
      />
    );
  }

  if (!posts.length) {
    return (
      <EmptyState
        title="아직 선생님 글이 없어요"
        description="선생님이 글을 올리면 여기에 나타나요."
        illustration={<EmptyOwl />}
        className="py-8"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {posts.map((p) => {
          const isOpen = open.has(p.id);
          const panelId = `${baseId}-${p.id}`;
          return (
            <li
              key={p.id}
              className={cn(
                "rounded-[1.5rem] bg-card shadow-(--shadow-sm) ring-1 ring-foreground/5 dark:shadow-none dark:ring-foreground/10",
                isOpen && "ring-primary/25",
              )}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(p)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[1.5rem] px-5 py-4 text-left text-base leading-snug font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  <span className="min-w-0 flex-1 break-keep">{p.title}</span>
                  <ChevronDownIcon
                    className={cn("size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              </h3>
              <div id={panelId} role="region" aria-label={p.title} hidden={!isOpen} className="border-t border-foreground/5 px-5 pt-4 pb-5">
                {opened.has(p.id) ? <MarkdownViewer content={p.content_md} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {moreError ? (
        <p role="alert" className="text-center text-sm text-destructive">
          더 불러오지 못했어요.
        </p>
      ) : null}
      {hasMore ? (
        <Button variant="outline" className={cn(outlinePillClass, "mx-auto mt-1 h-10")} onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
        </Button>
      ) : null}
    </div>
  );
}
