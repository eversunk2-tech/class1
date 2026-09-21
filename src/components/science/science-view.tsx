"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ClockIcon,
  FlaskConicalIcon,
  NotebookPenIcon,
  SearchXIcon,
} from "lucide-react";
import { TaggedPostList } from "@/components/class/tagged-post-list";
import { EmptyBoxIllustration } from "@/components/illustrations/empty-box-illustration";
import { ScienceIllustration } from "@/components/illustrations/science-illustration";
import { PageHero } from "@/components/layout/page-hero";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import {
  findLesson,
  findTerm,
  findUnit,
  scienceHref,
  scienceTerms,
  type Lesson,
  type Term,
  type Unit,
} from "@/data/science-curriculum";
import { withBasePath } from "@/lib/base-path";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

const colors = menuColorClasses.science;

/** 카드 공통 스타일(홈 바로가기 카드와 같은 계열: 둥근 모서리 · soft 테두리 · hover 강조) */
const cardLink = cn(
  "group/card flex rounded-3xl border bg-card outline-none transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:shadow-none",
  colors.border,
  colors.hoverBorder,
  colors.focusRing,
);

/** "1. 산과 염기" */
export function unitLabel(unit: Unit) {
  return `${unit.number}. ${unit.title}`;
}

/** "3. 같은 시간 동안 …" */
export function lessonLabel(lesson: Lesson) {
  return `${lesson.inquiry}. ${lesson.title}`;
}

/**
 * 과학수업 화면(학기 → 단원 → 차시). 정적 export라 `/science/?term=6-1&unit=2&lesson=3` 쿼리스트링으로 단계를 나눈다.
 * useSearchParams를 쓰므로 page.tsx에서 Suspense 경계 안에 둔다.
 */
export function ScienceView() {
  const params = useSearchParams();
  const termParam = params.get("term");
  const unitParam = params.get("unit");
  const lessonParam = params.get("lesson");

  if (termParam == null) return <ScienceHome />;

  const term = findTerm(termParam);
  if (!term) {
    return (
      <NotFound
        crumbs={[]}
        title="학기를 찾을 수 없어요"
        description="주소가 잘못되었거나 없는 학기예요."
        backHref={scienceHref()}
        backLabel="과학수업 처음으로"
      />
    );
  }

  if (unitParam == null) return <TermView term={term} />;

  const unit = findUnit(term, unitParam);
  if (!unit) {
    return (
      <NotFound
        crumbs={[{ label: term.label, href: scienceHref(term.id) }]}
        title="단원을 찾을 수 없어요"
        description={`${term.label}에 없는 단원이에요.`}
        backHref={scienceHref(term.id)}
        backLabel={`${term.label} 단원 보기`}
      />
    );
  }

  if (lessonParam == null) return <UnitView term={term} unit={unit} />;

  const lesson = findLesson(unit, lessonParam);
  if (!lesson) {
    return (
      <NotFound
        crumbs={[
          { label: term.label, href: scienceHref(term.id) },
          { label: unitLabel(unit), href: scienceHref(term.id, unit.number) },
        ]}
        title="차시를 찾을 수 없어요"
        description={`${unitLabel(unit)} 단원에 없는 차시예요.`}
        backHref={scienceHref(term.id, unit.number)}
        backLabel="단원 차시 목록 보기"
      />
    );
  }

  return <LessonView term={term} unit={unit} lesson={lesson} />;
}

/* ─────────────────────────────── 공통 조각 ─────────────────────────────── */

type Crumb = { label: string; href?: string };

/** 과학수업 › 6학년 1학기 › 2. 물체의 운동 › 3. … (마지막 항목은 현재 위치) */
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const all: Crumb[] = [{ label: "과학수업", href: scienceHref() }, ...crumbs];
  return (
    <nav aria-label="현재 위치" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-muted-foreground">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className="line-clamp-1 font-medium text-foreground">
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="rounded-md px-0.5 underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {c.label}
                </Link>
              )}
              {!last ? <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** 하위 단계 화면 머리글(히어로보다 작게: 모바일에서 목록이 바로 보이도록) */
function SectionHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: ReactNode }) {
  return (
    <header className={cn("flex flex-col gap-2 rounded-3xl border px-5 py-5 sm:px-6", colors.softBg, colors.border)}>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", colors.strongBg)} aria-hidden />
        {eyebrow}
      </span>
      <h1 className="font-heading text-2xl leading-tight font-normal sm:text-3xl">{title}</h1>
      {meta ? <p className="text-sm text-foreground/75">{meta}</p> : null}
    </header>
  );
}

function pagesText(pages: string) {
  return pages ? `${pages}쪽` : "없음";
}

function NotFound({
  crumbs,
  title,
  description,
  backHref,
  backLabel,
}: {
  crumbs: Crumb[];
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb crumbs={[...crumbs, { label: "찾을 수 없음" }]} />
      <EmptyState
        title={title}
        description={description}
        illustration={<SearchXIcon className={cn("size-10", colors.strongText)} aria-hidden />}
        action={
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
            <ArrowLeftIcon aria-hidden />
            {backLabel}
          </Link>
        }
      />
    </div>
  );
}

/* ─────────────────────────────── 1단계: 학기 선택 ─────────────────────────────── */

function ScienceHome() {
  return (
    <div className="flex flex-col gap-8">
      <PageHero
        color="science"
        eyebrow="과학수업"
        title="궁금한 건 실험으로 알아봐요"
        description="학기와 단원을 골라 차시별 탐구 주제와 교과서 쪽수를 확인해요."
        illustration={ScienceIllustration}
      />

      <section aria-labelledby="science-terms-heading" className="flex flex-col gap-4">
        <h2 id="science-terms-heading" className="font-heading text-2xl font-normal">
          학기별 단원
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {scienceTerms.map((term) => (
            <li key={term.id}>
              <TermCard term={term} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="science-heading" className="flex flex-col gap-4">
        <h2 id="science-heading" className="font-heading text-2xl font-normal">
          과학 수업 글
        </h2>
        <TaggedPostList tag="과학" accent="science" />
      </section>
    </div>
  );
}

function TermCard({ term }: { term: Term }) {
  const ready = term.units.length > 0;
  return (
    <Link href={scienceHref(term.id)} className={cn(cardLink, "h-full flex-col gap-3 p-5")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-xl">{term.label}</span>
        {ready ? (
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground", colors.softBg)}>
            단원 {term.units.length}개
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">준비 중</span>
        )}
      </div>
      {ready ? (
        <ol className="flex flex-col gap-1.5 text-sm">
          {term.units.map((u) => (
            <li key={u.number} className="flex items-center gap-2">
              <span
                className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", colors.chip)}
                aria-hidden
              >
                {u.number}
              </span>
              <span className="sr-only">{u.number}. </span>
              <span className="truncate">{u.title}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">단원을 준비하고 있어요. 조금만 기다려 주세요!</p>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-muted-foreground group-hover/card:text-foreground">
        {ready ? "단원 보기" : "자세히"}
        <ArrowRightIcon className={cn("size-3.5 transition-transform group-hover/card:translate-x-0.5", colors.strongText)} aria-hidden />
      </span>
    </Link>
  );
}

/* ─────────────────────────────── 2단계: 단원 목록 ─────────────────────────────── */

function TermView({ term }: { term: Term }) {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb crumbs={[{ label: term.label }]} />
      <SectionHeader
        eyebrow="과학수업"
        title={term.label}
        meta={term.units.length ? `단원 ${term.units.length}개 · 단원을 골라 탐구 차시를 확인해요.` : "단원을 준비하고 있어요."}
      />
      {term.units.length ? (
        <ol className="grid gap-3 sm:grid-cols-2">
          {term.units.map((unit) => (
            <li key={unit.number}>
              <Link href={scienceHref(term.id, unit.number)} className={cn(cardLink, "h-full items-center gap-4 p-4")}>
                <span
                  className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl font-heading text-2xl", colors.chip)}
                  aria-hidden
                >
                  {unit.number}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-heading text-lg leading-snug">
                    <span className="sr-only">{unit.number}. </span>
                    {unit.title}
                  </span>
                  <span className="text-sm text-muted-foreground">탐구 {unit.lessons.length}개</span>
                </span>
                <ChevronRightIcon
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={`${term.label} 단원은 준비 중이에요`}
          description="단원이 올라오면 여기에 나타나요."
          illustration={<EmptyBoxIllustration accent="science" className="h-28 w-36" />}
          className="py-8"
          action={
            <Link href={scienceHref()} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
              <ArrowLeftIcon aria-hidden />
              과학수업 처음으로
            </Link>
          }
        />
      )}
    </div>
  );
}

/* ─────────────────────────────── 3단계: 차시 목록 ─────────────────────────────── */

function LessonMeta({ lesson, className }: { lesson: Lesson; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1">
        <ClockIcon className="size-3.5" aria-hidden />
        {lesson.period}차시
      </span>
      <span className="inline-flex items-center gap-1">
        <BookOpenIcon className="size-3.5" aria-hidden />
        교과서 {pagesText(lesson.science)}
      </span>
      <span className="inline-flex items-center gap-1">
        <NotebookPenIcon className="size-3.5" aria-hidden />
        실험관찰 {pagesText(lesson.workbook)}
      </span>
      {lesson.app ? (
        <span className={cn("inline-flex items-center gap-1 font-medium", colors.strongText)}>
          <FlaskConicalIcon className="size-3.5" aria-hidden />
          {appLabel(lesson.app.kind)}
        </span>
      ) : null}
    </span>
  );
}

function appLabel(kind: "sim" | "guide") {
  return kind === "sim" ? "실험 앱" : "조사 도우미";
}

function UnitView({ term, unit }: { term: Term; unit: Unit }) {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb crumbs={[{ label: term.label, href: scienceHref(term.id) }, { label: unitLabel(unit) }]} />
      <SectionHeader eyebrow={term.label} title={unitLabel(unit)} meta={`탐구 ${unit.lessons.length}개`} />
      <ol className="flex flex-col gap-3" aria-label={`${unitLabel(unit)} 차시 목록`}>
        {unit.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link href={scienceHref(term.id, unit.number, lesson.id)} className={cn(cardLink, "items-center gap-3 p-4 sm:px-5")}>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                {/* 제목은 "탐구 번호. 주제" */}
                <span className="leading-snug font-semibold">
                  <span className="font-heading text-lg font-normal">{lesson.inquiry}.</span>{" "}
                  {lesson.title}
                </span>
                <LessonMeta lesson={lesson} />
              </span>
              <ChevronRightIcon
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─────────────────────────────── 4단계: 차시 상세 ─────────────────────────────── */

function LessonView({ term, unit, lesson }: { term: Term; unit: Unit; lesson: Lesson }) {
  const index = unit.lessons.findIndex((l) => l.id === lesson.id);
  const prev = index > 0 ? unit.lessons[index - 1] : undefined;
  const next = index < unit.lessons.length - 1 ? unit.lessons[index + 1] : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb
        crumbs={[
          { label: term.label, href: scienceHref(term.id) },
          { label: unitLabel(unit), href: scienceHref(term.id, unit.number) },
          { label: lessonLabel(lesson) },
        ]}
      />

      <article className={cn("flex flex-col gap-5 rounded-3xl border p-5 sm:p-6", colors.softBg, colors.border)}>
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", colors.strongBg)} aria-hidden />
            {unitLabel(unit)} · 탐구 {lesson.inquiry} / {unit.lessons.length}
          </span>
          <h1 className="font-heading text-2xl leading-snug font-normal sm:text-3xl">{lessonLabel(lesson)}</h1>
          <p className="inline-flex items-center gap-1 text-sm text-foreground/75">
            <ClockIcon className="size-4" aria-hidden />
            지도서 {lesson.period}차시
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <PageTile icon={<BookOpenIcon className="size-5" aria-hidden />} label="교과서" pages={lesson.science} />
          <PageTile icon={<NotebookPenIcon className="size-5" aria-hidden />} label="실험관찰" pages={lesson.workbook} />
        </dl>

        {lesson.app ? (
          // 차시 앱은 public/ 아래 정적 앱이라 next/link가 아닌 <a>로 연다(basePath 수동 부착).
          <a
            href={withBasePath(`/apps/${lesson.app.id}/`)}
            className={cn(buttonVariants(), "h-12 rounded-2xl px-5 text-base")}
          >
            <FlaskConicalIcon aria-hidden />
            {lesson.app.kind === "sim" ? "실험 시뮬레이션 시작하기" : "조사 도우미 열기"}
          </a>
        ) : null}
      </article>

      <nav aria-label="차시 이동" className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <SiblingLink direction="prev" href={scienceHref(term.id, unit.number, prev.id)} lesson={prev} />
        ) : (
          <span className="hidden sm:block" aria-hidden />
        )}
        {next ? <SiblingLink direction="next" href={scienceHref(term.id, unit.number, next.id)} lesson={next} /> : null}
      </nav>

      <Link
        href={scienceHref(term.id, unit.number)}
        className={cn(buttonVariants({ variant: "outline" }), "mx-auto h-10 rounded-xl px-4")}
      >
        <ArrowLeftIcon aria-hidden />
        {unit.title} 차시 목록으로
      </Link>
    </div>
  );
}

function PageTile({ icon, label, pages }: { icon: ReactNode; label: string; pages: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className={colors.strongText}>{icon}</span>
        {label}
      </dt>
      <dd className={cn("font-heading text-2xl", !pages && "text-muted-foreground")}>{pagesText(pages)}</dd>
    </div>
  );
}

function SiblingLink({ direction, href, lesson }: { direction: "prev" | "next"; href: string; lesson: Lesson }) {
  const isPrev = direction === "prev";
  return (
    <Link
      href={href}
      rel={direction}
      className={cn(cardLink, "items-center gap-3 p-4", isPrev ? "flex-row" : "flex-row-reverse text-right")}
    >
      {isPrev ? (
        <ArrowLeftIcon className={cn("size-5 shrink-0", colors.strongText)} aria-hidden />
      ) : (
        <ArrowRightIcon className={cn("size-5 shrink-0", colors.strongText)} aria-hidden />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{isPrev ? "이전 차시" : "다음 차시"}</span>
        <span className="line-clamp-2 text-sm leading-snug font-semibold">{lessonLabel(lesson)}</span>
      </span>
    </Link>
  );
}

/** Suspense fallback: 정적 HTML에 먼저 그려지는 자리표시(히어로 + 카드 뼈대) */
export function ScienceViewSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="과학수업을 불러오는 중">
      <div className="h-56 animate-pulse rounded-3xl bg-muted sm:h-48" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-44 animate-pulse rounded-3xl bg-muted" />
        <div className="h-44 animate-pulse rounded-3xl bg-muted" />
      </div>
    </div>
  );
}
