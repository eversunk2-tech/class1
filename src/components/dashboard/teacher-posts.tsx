"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { LinkifiedText } from "@/components/linkified-text";
import { LoginNeededNotice } from "@/components/login-gate";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { useSession } from "@/hooks/use-session";
import { fetchLoginRequired } from "@/lib/admin";
import { fetchVisibleNotices, type NoticeSummary } from "@/lib/notices";
import { outlinePillClass } from "@/lib/pill";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

/**
 * 홈 '선생님 글' — 학급별 선생님 글(class_notices, docs/classes/spec.md 개정 2).
 * **어떤 글이 보이는지는 RLS가 정한다**(화면은 거르지 않는다):
 *   · 로그인한 학생 = 자기 담임 선생님(자기 학급) 글만, 담임(총괄 포함) = 자기 학급 글
 *   · 로그인하지 않은 방문자 = 총괄 선생님이 쓴 글만(2026-09-26 사용자 결정) — 따로 안내 문구는 두지 않는다
 *   · '로그인해야만 이용'이 켜져 있고 로그인하지 않았으면 → 불러오지 않고 로그인 안내(다른 공개 글과 같은 잠금 규칙)
 * 제목만 목록으로 보여 주고, 제목을 누르면 본문이 그 자리에서 펼쳐진다. **날짜는 보이지 않는다**(사용자 결정).
 * 본문은 **글자 그대로**(줄바꿈 유지, 마크다운·HTML을 해석하지 않는 React 텍스트) — `<script>`도 글자로만 보인다.
 * 다만 인터넷 주소(http·https)는 누르면 새 창에서 열리는 링크로 바꾼다(2026-09-26 사용자 요청, `LinkifiedText`).
 * 조회수·읽음 기록은 남기지 않는다. 표가 아직 없으면(SQL 전) 오류 대신 "아직 선생님 글이 없어요".
 * 왼쪽 메뉴에는 없고 홈에서만 보인다(넓은 화면에서는 '최근 과학 수업' 옆 반 칸).
 */
export function TeacherPosts() {
  const locked = useLoginLocked();
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  // 보는 사람(로그인한 사용자 id 또는 방문자)이 바뀌면 이전 사람의 목록을 곧바로 치운다(로그아웃 직후 반 글이 남아 보이지 않게).
  const viewer = sessionLoading ? null : (userId ?? "guest");
  const [shownFor, setShownFor] = useState<string | null>(viewer);
  const [posts, setPosts] = useState<NoticeSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [attempt, setAttempt] = useState(0);
  // 방문자에게 직접 확인한 잠금 여부(공용 훅 useLoginLocked가 늦거나 실패해도 불러오는 중 화면에 머물지 않게)
  const [guestLocked, setGuestLocked] = useState(false);
  const baseId = useId();
  const viewerRef = useRef(viewer);
  useEffect(() => {
    viewerRef.current = viewer;
  }, [viewer]);

  if (shownFor !== viewer) {
    setShownFor(viewer);
    setPosts([]);
    setOpen(new Set());
    setHasMore(false);
    setMoreError(false);
    setGuestLocked(false);
    setStatus("loading");
  }

  useEffect(() => {
    if (locked || !viewer) return; // 잠금 중인 방문자는 불러오지 않는다 · 로그인 상태를 아는 뒤에만 부른다
    let active = true;
    (async () => {
      // 방문자는 잠금 여부를 먼저 확인한다: 켜져 있으면 목록을 부르지 않고(RLS도 0행) 곧바로 로그인 안내 — 빈 목록이 잠깐 보이지 않게.
      if (viewer === "guest" && (await fetchLoginRequired())) {
        if (active) setGuestLocked(true);
        return;
      }
      const page = await fetchVisibleNotices(0, PAGE_SIZE);
      if (!active) return;
      setPosts(page);
      setHasMore(page.length === PAGE_SIZE);
      setStatus("ready");
    })().catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
    };
  }, [attempt, locked, viewer]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  async function loadMore() {
    const forViewer = viewer;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchVisibleNotices(posts.length, PAGE_SIZE);
      if (viewerRef.current !== forViewer) return; // 불러오는 동안 로그인·로그아웃했으면 버린다
      const known = new Set(posts.map((p) => p.id));
      setPosts((prev) => [...prev, ...page.filter((p) => !known.has(p.id))]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (locked || (guestLocked && viewer === "guest")) {
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
                  onClick={() => toggle(p.id)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[1.5rem] px-5 py-4 text-left text-base leading-snug font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  <span className="min-w-0 flex-1 break-keep [overflow-wrap:anywhere]">{p.title}</span>
                  <ChevronDownIcon
                    className={cn("size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              </h3>
              <div id={panelId} role="region" aria-label={p.title} hidden={!isOpen} className="border-t border-foreground/5 px-5 pt-4 pb-5">
                {/* 글자 그대로: React 텍스트라 HTML·마크다운으로 해석되지 않는다. 줄바꿈·띄어쓰기는 그대로, 긴 주소는 칸 안에서 꺾는다.
                    인터넷 주소(http·https)만 누르면 새 창에서 열리는 링크로(2026-09-26 사용자 요청). */}
                <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                  <LinkifiedText text={p.body} />
                </p>
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
        <Button variant="outline" className={cn(outlinePillClass, "mx-auto mt-1 h-11")} onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
        </Button>
      ) : null}
    </div>
  );
}
