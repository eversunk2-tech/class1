"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { ErrorFaceIllustration } from "@/components/illustrations/error-face-illustration";
import { LinkifiedText } from "@/components/linkified-text";
import { LoginNeededNotice } from "@/components/login-gate";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { useSession } from "@/hooks/use-session";
import { fetchLoginRequired } from "@/lib/admin";
import { fetchVisibleNotices, type NoticeSummary } from "@/lib/notices";
import { outlinePillClass, primaryPillClass } from "@/lib/pill";
import { cn } from "@/lib/utils";

/** 한 번에 불러오는 글 수 — 선생님 글은 많지 않아 한 번에 받아 화면에서 쪽을 나눈다(이보다 오래된 글은 홈에 보이지 않는다). */
const FETCH_LIMIT = 100;
/** 위아래로 쌓일 때(옆 칸이 없을 때) 한 쪽의 글 수 */
const STACKED_PAGE_SIZE = 5;
/** 옆 칸에 맞춰 나눌 때도 한 쪽에 적어도 이만큼은 보인다(옆 칸이 아주 짧아도) */
const MIN_PER_PAGE = 3;
/** 높이 비교 여유(px) — 소수점 반올림 때문에 한 글이 쪽을 오가지 않게 */
const EPS = 0.5;

// 쪽 넘기기 요소 폭(rem) — 아래 클래스와 같은 값. 한 줄에 들어가는 모양을 고를 때 쓴다(pickPager).
const BTN_REM = 2.75; // 번호·화살표 버튼 w-11(누르는 곳 44px)
const ARROW_REM = 5; // '이전'·'다음' 글자가 있는 버튼 w-20
const ELLIPSIS_REM = 1.25; // … w-5
const STATUS_REM = 4; // "2 / 5" w-16
const NUM_GAP_REM = 0.25; // 번호 사이 gap-1
const GROUP_GAP_REM = 0.5; // 이전 · 번호 · 다음 사이 최소 gap-2

/** 글 한 줄(li)과 그 제목 줄(버튼). 높이 재기용 사본도 같은 클래스를 써서 접은 높이가 똑같다. */
const ITEM_CLASS = "rounded-[1.5rem] bg-card shadow-(--shadow-sm) ring-1 ring-foreground/5 dark:shadow-none dark:ring-foreground/10";
const TITLE_ROW_CLASS = "flex min-h-14 w-full items-center gap-3 rounded-[1.5rem] px-5 py-4 text-left text-base leading-snug font-semibold";

/** 쪽 넘기기 모양: 번호 칸 수(0이면 번호 대신 "2 / 5" 글자)와 '이전'·'다음' 글자를 보일지 */
type PagerStyle = { labels: boolean; slots: 0 | 5 | 7 };

type PageLayout = {
  /** 쪽마다 첫 글의 순번(0부터). 길이 = 쪽 수 */
  starts: number[];
  /** 여러 쪽일 때 목록 칸의 최소 높이(px, 가장 높은 쪽) — 쪽을 넘겨도 쪽 넘기기 버튼이 제자리에 있다 */
  listMinHeight: number;
  pager: PagerStyle;
};

type View = { layout: PageLayout | null; page: number };

const px = (v: string) => parseFloat(v) || 0;

/** n개를 size개씩 나눈 쪽의 첫 순번들 */
function chunkStarts(n: number, size: number): number[] {
  const starts: number[] = [];
  for (let i = 0; i < n; i += size) starts.push(i);
  return starts.length ? starts : [0];
}

/**
 * 재 둔 높이로 쪽을 나눈다: 모두 `space` 안에 들어가면 한 쪽(쪽 넘기기 없음),
 * 아니면 쪽 넘기기 자리(`pagerBlock`)를 빼고 들어가는 만큼 차례로 한 쪽에 담는다(적어도 MIN_PER_PAGE개).
 */
function fitStarts(heights: number[], gap: number, space: number, pagerBlock: number): number[] {
  const n = heights.length;
  const all = heights.reduce((sum, h) => sum + h, 0) + gap * Math.max(0, n - 1);
  if (all <= space + EPS) return [0];
  const budget = space - pagerBlock;
  const starts: number[] = [];
  for (let i = 0; i < n; ) {
    starts.push(i);
    let used = 0;
    let count = 0;
    while (i < n) {
      const add = heights[i] + (count > 0 ? gap : 0);
      if (count >= MIN_PER_PAGE && used + add > budget + EPS) break;
      used += add;
      count += 1;
      i += 1;
    }
  }
  return starts;
}

/**
 * 옆 칸과 좌우로 나란히 있으면, 이 목록(root: 접은 제목 + 쪽 넘기기)이 쓸 수 있는 높이(px).
 * 위아래로 쌓였거나 옆 칸이 없으면 null.
 * 옆 칸의 높이는 그리드가 늘인 높이가 아니라 **자기 내용 높이**다 — 내용(자식)의 아래 끝 + 아래 안쪽 여백·테두리.
 * (그리드는 두 칸 높이를 맞춰 늘이므로, 이 칸이 길면 옆 칸도 따라 늘어난다. 자식은 늘어나지 않는다.)
 */
function spaceBeside(root: HTMLElement, besideHeadingId: string | undefined): number | null {
  if (!besideHeadingId) return null;
  const mine = root.closest("section");
  const beside = document.getElementById(besideHeadingId)?.closest("section");
  if (!mine || !beside || mine === beside) return null;
  const a = beside.getBoundingClientRect();
  const b = mine.getBoundingClientRect();
  if (!a.height || !b.height || Math.abs(a.top - b.top) > 1) return null; // 같은 줄이 아니다(위아래로 쌓임)
  const bs = getComputedStyle(beside);
  let contentBottom = a.top + px(bs.borderTopWidth) + px(bs.paddingTop);
  for (const child of Array.from(beside.children)) contentBottom = Math.max(contentBottom, child.getBoundingClientRect().bottom);
  const besideHeight = contentBottom - a.top + px(bs.paddingBottom) + px(bs.borderBottomWidth);
  const ms = getComputedStyle(mine);
  const chrome = root.getBoundingClientRect().top - b.top + px(ms.paddingBottom) + px(ms.borderBottomWidth);
  return besideHeight - chrome;
}

/** 쪽 넘기기가 한 줄에 들어가게 칸 폭에 맞춰 모양을 고른다(버튼 44px은 줄이지 않고, 번호 수·글자를 줄인다). */
function pickPager(width: number, count: number, rem: number): PagerStyle {
  const numbers = (slots: number) =>
    count <= slots ? count * BTN_REM + (count - 1) * NUM_GAP_REM : (slots - 1) * BTN_REM + ELLIPSIS_REM + (slots - 1) * NUM_GAP_REM;
  const fits = (labels: boolean, middle: number) => (2 * (labels ? ARROW_REM : BTN_REM) + middle + 2 * GROUP_GAP_REM) * rem <= width + EPS;
  const choices: [boolean, 5 | 7][] = [
    [true, 7],
    [true, 5],
    [false, 5],
  ];
  for (const [labels, slots] of choices) if (fits(labels, numbers(slots))) return { labels, slots };
  return { labels: fits(true, STATUS_REM), slots: 0 };
}

/**
 * 보이지 않는 사본(접은 제목들)의 높이를 재서 쪽을 나눈다.
 * 좌우 반씩이면 옆 칸 높이에 맞추고, 위아래로 쌓이면 5개씩.
 */
function measureLayout(root: HTMLElement, ghost: HTMLElement, besideHeadingId: string | undefined): PageLayout | null {
  const list = ghost.querySelector<HTMLElement>('[data-measure="list"]');
  const probe = ghost.querySelector<HTMLElement>('[data-measure="pager"]');
  if (!list || !probe) return null;
  const heights = Array.from(list.children, (el) => el.getBoundingClientRect().height);
  const n = heights.length;
  if (!n) return null;
  const gap = px(getComputedStyle(list).rowGap);
  const pagerBlock = probe.getBoundingClientRect().height + px(getComputedStyle(root).rowGap);
  const space = spaceBeside(root, besideHeadingId);
  const starts = space === null ? chunkStarts(n, STACKED_PAGE_SIZE) : fitStarts(heights, gap, space, pagerBlock);
  let listMinHeight = 0;
  if (starts.length > 1) {
    starts.forEach((from, i) => {
      const to = starts[i + 1] ?? n;
      let h = gap * (to - from - 1);
      for (let k = from; k < to; k += 1) h += heights[k];
      listMinHeight = Math.max(listMinHeight, h);
    });
  }
  const rem = px(getComputedStyle(document.documentElement).fontSize) || 16;
  return { starts, listMinHeight, pager: pickPager(root.clientWidth, starts.length, rem) };
}

function sameLayout(a: PageLayout, b: PageLayout): boolean {
  return (
    Math.abs(a.listMinHeight - b.listMinHeight) < EPS &&
    a.pager.labels === b.pager.labels &&
    a.pager.slots === b.pager.slots &&
    a.starts.length === b.starts.length &&
    a.starts.every((s, i) => s === b.starts[i])
  );
}

/** 새로 나눈 쪽으로 바꾼다. 창 크기 등으로 다시 나눠도 지금 쪽의 첫 글이 보이는 쪽에 머문다. */
function reconcile(prev: View, next: PageLayout | null): View {
  if (!next) return prev;
  if (prev.layout && sameLayout(prev.layout, next)) return prev;
  if (!prev.layout) return { layout: next, page: Math.min(prev.page, next.starts.length - 1) };
  const anchor = prev.layout.starts[Math.min(prev.page, prev.layout.starts.length - 1)] ?? 0;
  let page = 0;
  next.starts.forEach((start, i) => {
    if (start <= anchor) page = i;
  });
  return { layout: next, page };
}

type Slot = number | "gap-start" | "gap-end";

/** 번호 칸: 쪽이 많으면 첫 쪽·끝 쪽·지금 쪽(7칸이면 그 양옆도)만 보이고 나머지는 …로 줄인다(예: 1 … 4 5 6 … 10). */
function pageSlots(count: number, current: number, slots: 5 | 7): Slot[] {
  if (count <= slots) return Array.from({ length: count }, (_, i) => i);
  const sib = (slots - 5) / 2;
  const last = count - 1;
  const start = Math.max(Math.min(current - sib, last - 2 * sib - 2), 2);
  const end = Math.min(Math.max(current + sib, 2 * sib + 2), last - 2);
  const out: Slot[] = [0, start > 2 ? "gap-start" : 1];
  for (let i = start; i <= end; i += 1) out.push(i);
  out.push(end < last - 2 ? "gap-end" : last - 1, last);
  return out;
}

/** 접은 제목 줄의 안쪽(제목 + 펼침 표시) — 실제 목록과 높이 재기용 사본이 같이 쓴다. */
function TitleRow({ title, open }: { title: string; open: boolean }) {
  return (
    <>
      <span className="min-w-0 flex-1 break-keep [overflow-wrap:anywhere]">{title}</span>
      <ChevronDownIcon
        className={cn("size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")}
        aria-hidden
      />
    </>
  );
}

/**
 * 쪽 넘기기: "‹ 이전 · 1 2 3 · 다음 ›"(사이트 알약 버튼, 누르는 곳 44px).
 * 지금 쪽 = aria-current="page". 끝에서는 이전·다음이 꺼진다 — `disabled` 대신 aria-disabled라 누른 버튼에 초점이 남는다.
 * 칸이 좁으면(휴대폰) '이전'·'다음' 글자를 빼거나 번호 대신 "2 / 5"로 보인다(한 줄에 들어가게).
 */
function NoticePager({
  count,
  current,
  look,
  onGo,
}: {
  count: number;
  current: number;
  look: PagerStyle;
  onGo: (page: number) => void;
}) {
  const atStart = current <= 0;
  const atEnd = current >= count - 1;
  const arrowClass = cn(outlinePillClass, "px-0", look.labels ? "w-20" : "w-11");
  return (
    <nav aria-label="선생님 글 쪽 넘기기" className="mt-auto flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="이전 쪽"
        aria-disabled={atStart || undefined}
        onClick={() => {
          if (!atStart) onGo(current - 1);
        }}
        className={arrowClass}
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
        {look.labels ? "이전" : null}
      </button>
      {look.slots ? (
        <ul className="flex items-center gap-1">
          {pageSlots(count, current, look.slots).map((slot) =>
            typeof slot === "number" ? (
              <li key={slot}>
                <button
                  type="button"
                  aria-label={`선생님 글 ${slot + 1}쪽`}
                  aria-current={slot === current ? "page" : undefined}
                  onClick={() => onGo(slot)}
                  className={cn(slot === current ? primaryPillClass : outlinePillClass, "w-11 px-0 tabular-nums")}
                >
                  {slot + 1}
                </button>
              </li>
            ) : (
              <li key={slot} aria-hidden="true" className="w-5 text-center text-sm font-semibold text-muted-foreground">
                …
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="w-16 text-center text-sm font-semibold tabular-nums">
          <span aria-hidden="true">
            {current + 1} / {count}
          </span>
          <span className="sr-only">{`${count}쪽 중 ${current + 1}쪽`}</span>
        </p>
      )}
      <button
        type="button"
        aria-label="다음 쪽"
        aria-disabled={atEnd || undefined}
        onClick={() => {
          if (!atEnd) onGo(current + 1);
        }}
        className={arrowClass}
      >
        {look.labels ? "다음" : null}
        <ChevronRightIcon className="size-4" aria-hidden />
      </button>
    </nav>
  );
}

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
 *
 * **쪽 나누기**(2026-09-26 사용자 요청, docs/classes/build-notice-pages-instructions.md): 보이는 글을 한 번에(최신 100개) 불러와
 *   · 옆 칸(`besideHeadingId` 제목의 칸)과 좌우로 나란히 있으면 — 접은 제목 + 쪽 넘기기가 옆 칸의 **자기 내용 높이**를
 *     넘지 않게, 제목 높이를 실제로 재서(두 줄 제목도 자르지 않음) 들어가는 만큼 한 쪽에 담는다(적어도 3개). 다 들어가면 쪽 넘기기 없음.
 *   · 위아래로 쌓이면(좁은 화면) 5개씩.
 *   창 크기·사이드바 접기·글꼴 로드·옆 칸 내용이 바뀌면 다시 잰다(ResizeObserver). 쪽을 넘기면 펼친 글은 접는다.
 */
export function TeacherPosts({
  besideHeadingId,
}: {
  /** 좌우 반씩일 때 높이를 맞출 옆 칸의 제목 id(그 제목이 든 <section>의 자기 내용 높이를 넘지 않게 쪽을 나눈다). 없으면 늘 5개씩 */
  besideHeadingId?: string;
}) {
  const locked = useLoginLocked();
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  // 보는 사람(로그인한 사용자 id 또는 방문자)이 바뀌면 이전 사람의 목록을 곧바로 치운다(로그아웃 직후 반 글이 남아 보이지 않게).
  const viewer = sessionLoading ? null : (userId ?? "guest");
  const [shownFor, setShownFor] = useState<string | null>(viewer);
  const [posts, setPosts] = useState<NoticeSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [view, setView] = useState<View>({ layout: null, page: 0 });
  const [announce, setAnnounce] = useState("");
  const [attempt, setAttempt] = useState(0);
  // 방문자에게 직접 확인한 잠금 여부(공용 훅 useLoginLocked가 늦거나 실패해도 불러오는 중 화면에 머물지 않게)
  const [guestLocked, setGuestLocked] = useState(false);
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  if (shownFor !== viewer) {
    setShownFor(viewer);
    setPosts([]);
    setOpen(new Set());
    setView({ layout: null, page: 0 });
    setAnnounce("");
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
      const list = await fetchVisibleNotices(0, FETCH_LIMIT);
      if (!active) return;
      setPosts(list);
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

  const isLocked = locked || (guestLocked && viewer === "guest");
  const listShown = !isLocked && status === "ready" && posts.length > 0;

  // 쪽 나누기: 그리기 직후(화면에 보이기 전) 한 번 재고, 크기가 바뀌면 다시 잰다.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const ghost = ghostRef.current;
    if (!root || !ghost) return;
    const update = () => {
      const next = measureLayout(root, ghost, besideHeadingId);
      setView((prev) => reconcile(prev, next));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(root); // 폭(창 크기·사이드바 접기)
    ghost.querySelectorAll("[data-measure]").forEach((el) => observer.observe(el)); // 제목 높이(글꼴 로드·줄바꿈)
    const header = root.closest("section")?.firstElementChild;
    if (header) observer.observe(header);
    const beside = besideHeadingId ? document.getElementById(besideHeadingId)?.closest("section") : null;
    if (beside) for (const el of [beside, ...Array.from(beside.children)]) observer.observe(el); // 옆 칸 내용 높이
    return () => observer.disconnect();
  }, [posts, listShown, besideHeadingId]);

  if (isLocked) {
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

  // 재기 전(첫 그림)에는 5개씩 — 화면에 보이기 전에 위 useLayoutEffect가 바로 고친다.
  const layout: PageLayout = view.layout ?? {
    starts: chunkStarts(posts.length, STACKED_PAGE_SIZE),
    listMinHeight: 0,
    pager: { labels: true, slots: 5 },
  };
  const pageCount = layout.starts.length;
  const current = Math.min(view.page, pageCount - 1);
  const shown = posts.slice(layout.starts[current] ?? 0, layout.starts[current + 1] ?? posts.length);

  function goTo(target: number) {
    if (target < 0 || target >= pageCount || target === current) return;
    setView((prev) => ({ ...prev, page: target }));
    setOpen(new Set()); // 쪽을 넘기면 펼친 글은 접는다
    setAnnounce(`선생님 글 ${pageCount}쪽 중 ${target + 1}쪽`);
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    // grow: 좌우 반씩일 때 칸이 옆 칸 높이만큼 늘면 쪽 넘기기(mt-auto)가 칸 아래 끝에 붙어 쪽을 넘겨도 제자리에 있다.
    <div ref={rootRef} className="relative flex grow flex-col gap-3">
      <ul className="flex flex-col gap-3" style={layout.listMinHeight ? { minHeight: layout.listMinHeight } : undefined}>
        {shown.map((p) => {
          const isOpen = open.has(p.id);
          const panelId = `${baseId}-${p.id}`;
          return (
            <li key={p.id} className={cn(ITEM_CLASS, isOpen && "ring-primary/25")}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(p.id)}
                  className={cn(TITLE_ROW_CLASS, "outline-none focus-visible:ring-3 focus-visible:ring-ring/60")}
                >
                  <TitleRow title={p.title} open={isOpen} />
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
      {pageCount > 1 ? <NoticePager count={pageCount} current={current} look={layout.pager} onGo={goTo} /> : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      {/* 높이 재기용 사본: 모든 글의 접은 제목을 같은 폭으로 보이지 않게 그려 두고 높이만 잰다(화면·스크린리더·초점에 나오지 않음, 칸 밖으로 넘치지 않음). */}
      <div ref={ghostRef} aria-hidden="true" inert className="pointer-events-none invisible absolute inset-0 overflow-hidden">
        <ul data-measure="list" className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id} className={ITEM_CLASS}>
              <div className={TITLE_ROW_CLASS}>
                <TitleRow title={p.title} open={false} />
              </div>
            </li>
          ))}
        </ul>
        <div data-measure="pager" className="h-11" />
      </div>
    </div>
  );
}
