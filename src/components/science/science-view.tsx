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
} from "lucide-react";
import { Icon3D, type Icon3DName } from "@/components/illustrations/icon-3d";
import { Mascot } from "@/components/illustrations/mascot";
import { PropStage, type StageProp } from "@/components/illustrations/prop-stage";
import { Highlight, SectionHeading } from "@/components/layout/highlight";
import { PageHero } from "@/components/layout/page-hero";
import { EmptyOwl, EmptyState } from "@/components/states";
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

/**
 * 흰 둥근 카드(차시·이전/다음 차시): 과학 민트색 부드러운 그림자, 올리면 떠오름.
 * Tailwind v4는 translate를 별도 CSS 속성으로 움직이므로 transition에 translate를 적어야 부드럽다(1단계에서 찾은 끊김 수정).
 */
const cardLink = cn(
  "group/card flex rounded-[1.75rem] bg-card ring-1 ring-foreground/5 outline-none transition-[translate,box-shadow] duration-200 hover:-translate-y-1 focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:shadow-none dark:ring-foreground/10",
  colors.glowShadow,
  colors.hoverGlow,
  colors.focusRing,
);

/** 그라데이션 카드(학기·단원): 큰 둥근 모서리 + 3D 아이콘 + 흰 반투명 원 장식 */
const gradientCard = cn(
  "group/card relative isolate flex overflow-hidden rounded-[2rem] ring-1 outline-none transition-[translate,box-shadow] duration-300 hover:-translate-y-1 focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0 shadow-(--shadow-md) dark:shadow-none",
  colors.gradientBg,
  colors.softRing,
  colors.hoverGlow,
  colors.focusRing,
);

/** 학기·단원별 3D 아이콘(장식). 없는 단원은 원자 배지. */
const TERM_ICONS: Record<string, Icon3DName> = { "6-1": "microscope", "6-2": "magnet" };
const UNIT_ICONS: Record<string, Icon3DName> = {
  "6-1:1": "test-tube",
  "6-1:2": "rocket",
  "6-1:3": "microscope",
  "6-1:4": "planet",
  "6-2:1": "star",
  "6-2:2": "atom",
  "6-2:3": "light-bulb",
};
function termIcon(term: Term): Icon3DName {
  return TERM_ICONS[term.id] ?? "atom";
}
function unitIcon(term: Term, unit: Unit): Icon3DName {
  return UNIT_ICONS[`${term.id}:${unit.number}`] ?? "atom";
}

/** 카드 오른쪽 아래 동그란 흰 화살표 버튼 + 점선 링(홈 기능 카드와 같은 모양, 장식) */
function RoundArrow() {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center" aria-hidden>
      <span className="absolute inset-0 rounded-full border-2 border-dashed border-card/90 dark:border-foreground/30" />
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full bg-card shadow-(--shadow-sm) transition-colors duration-200 group-hover/card:bg-primary dark:shadow-none",
          colors.strongText,
        )}
      >
        <ArrowRightIcon className="size-4.5 transition-transform duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-primary-foreground motion-reduce:transition-none" />
      </span>
    </span>
  );
}

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

/** 과학수업 › 6학년 1학기 › 2. 물체의 운동 › 3. … (마지막 항목은 현재 위치). 흰 반투명 알약 막대 */
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const all: Crumb[] = [{ label: "과학수업", href: scienceHref() }, ...crumbs];
  return (
    <nav aria-label="현재 위치" className="text-sm">
      <ol className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 rounded-2xl bg-card/80 px-3.5 py-2 text-muted-foreground shadow-(--shadow-sm) ring-1 ring-foreground/5 dark:bg-card/60 dark:shadow-none">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className="line-clamp-1 font-semibold text-foreground">
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

/** 하위 단계 화면 머리글: 과학 그라데이션 판 + 오른쪽 3D 아이콘(히어로보다 작게: 모바일에서 목록이 바로 보이도록) */
function SectionHeader({
  eyebrow,
  title,
  meta,
  icon,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  icon: Icon3DName;
}) {
  return (
    <header
      className={cn(
        "relative isolate flex items-center gap-4 overflow-hidden rounded-[2rem] px-5 py-6 ring-1 shadow-(--shadow-md) sm:px-7 dark:shadow-none",
        colors.gradientBg,
        colors.softRing,
      )}
    >
      <span className="pointer-events-none absolute -top-12 -right-10 -z-10 size-44 rounded-full bg-card/45 dark:bg-card/20" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-sm) dark:shadow-none">
          <span className={cn("size-1.5 rounded-full", colors.strongBg)} aria-hidden />
          {eyebrow}
        </span>
        <h1 className="font-heading text-2xl leading-tight font-normal sm:text-3xl">{title}</h1>
        {meta ? <p className="text-sm text-foreground/75">{meta}</p> : null}
      </div>
      <Icon3D
        name={icon}
        size={96}
        className="mascot-float size-16 drop-shadow-[0_12px_14px_oklch(0_0_0/0.16)] sm:size-22"
      />
    </header>
  );
}

function pagesText(pages: string) {
  return pages ? `${pages}쪽` : "없음";
}

/** 알약 모양 "돌아가기" 링크 */
const backLinkClass = cn(buttonVariants({ variant: "outline" }), "h-10 rounded-full bg-card px-4 shadow-(--shadow-sm) dark:shadow-none");

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
        illustration={<EmptyOwl />}
        action={
          <Link href={backHref} className={backLinkClass}>
            <ArrowLeftIcon aria-hidden />
            {backLabel}
          </Link>
        }
      />
    </div>
  );
}

/* ─────────────────────────────── 1단계: 학기 선택 ─────────────────────────────── */

/** 과학수업 히어로 무대: 태블릿 든 부엉이 + 현미경·원자 배지·자석·전구 */
const SCIENCE_PROPS: StageProp[] = [
  { name: "microscope", size: 64, className: "top-[2%] left-[0%] w-11 @4xl:w-15", tilt: -10, dur: 5.4, delay: -1.2, always: true },
  { name: "atom", size: 48, className: "top-[6%] right-[2%] w-9 @4xl:w-12", tilt: 12, dur: 4.6, delay: -2.4, always: true },
  { name: "light-bulb", size: 48, className: "bottom-[12%] left-[-2%] w-9 @4xl:w-12", tilt: -14, dur: 5, delay: -0.6, always: true },
  { name: "magnet", size: 56, className: "right-[-4%] bottom-[16%] w-10 @4xl:w-14", tilt: 16, dur: 6.2, delay: -3.1 },
];

function ScienceStage() {
  return (
    <PropStage props={SCIENCE_PROPS} className="aspect-[5/6] w-[12.5rem] @2xl:w-[14rem] @4xl:w-[16.5rem]">
      <div className="mascot-float absolute inset-x-[15%] bottom-[3%] drop-shadow-[0_18px_22px_oklch(0.35_0.12_288/0.25)] dark:drop-shadow-[0_0_24px_oklch(0.75_0.15_288/0.4)]">
        <Mascot pose="tablet" width={186} priority className="w-full" />
      </div>
    </PropStage>
  );
}

function ScienceHome() {
  return (
    <div className="flex flex-col gap-10">
      <PageHero
        color="science"
        variant="gradient"
        eyebrow="과학수업"
        title={
          <>
            궁금한 건 <Highlight>실험</Highlight>으로 알아봐요
          </>
        }
        description="학기와 단원을 골라 차시별 탐구 주제와 교과서 쪽수를 확인해요."
        media={<ScienceStage />}
      />

      <section aria-labelledby="science-terms-heading" className="flex flex-col gap-5">
        <SectionHeading id="science-terms-heading">학기별 단원</SectionHeading>
        <div className="@container">
          <ul className="grid gap-5 @xl:grid-cols-2">
            {scienceTerms.map((term) => (
              <li key={term.id}>
                <TermCard term={term} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function TermCard({ term }: { term: Term }) {
  const ready = term.units.length > 0;
  return (
    <Link href={scienceHref(term.id)} className={cn(gradientCard, "h-full flex-col gap-4 p-6")}>
      <span className="pointer-events-none absolute -top-10 -right-10 -z-10 size-44 rounded-full bg-card/45 dark:bg-card/20" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2 pt-1">
          <span className="font-heading text-2xl leading-tight">{term.label}</span>
          {ready ? (
            <span className={cn("w-fit rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold", colors.ink)}>
              단원 {term.units.length}개
            </span>
          ) : (
            <span className="w-fit rounded-full bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">준비 중</span>
          )}
        </div>
        <Icon3D
          name={termIcon(term)}
          size={88}
          className="size-18 drop-shadow-[0_12px_14px_oklch(0_0_0/0.14)] transition-transform duration-300 group-hover/card:scale-110 group-hover/card:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover/card:transform-none sm:size-20"
        />
      </div>
      {ready ? (
        <ol className="flex flex-col gap-2 text-sm">
          {term.units.map((u) => (
            <li key={u.number} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-xl bg-card text-xs font-bold shadow-(--shadow-sm) dark:shadow-none",
                  colors.ink,
                )}
                aria-hidden
              >
                {u.number}
              </span>
              <span className="sr-only">{u.number}. </span>
              <span className="truncate font-medium">{u.title}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-foreground/75">단원을 준비하고 있어요. 조금만 기다려 주세요!</p>
      )}
      <span className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="text-sm font-medium text-foreground/80">{ready ? "단원 보기" : "자세히"}</span>
        <RoundArrow />
      </span>
    </Link>
  );
}

/* ─────────────────────────────── 2단계: 단원 목록 ─────────────────────────────── */

function TermView({ term }: { term: Term }) {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb crumbs={[{ label: term.label }]} />
      <SectionHeader
        eyebrow="과학수업"
        title={term.label}
        icon={termIcon(term)}
        meta={term.units.length ? `단원 ${term.units.length}개 · 단원을 골라 탐구 차시를 확인해요.` : "단원을 준비하고 있어요."}
      />
      {term.units.length ? (
        <div className="@container">
          <ol className="grid gap-4 @xl:grid-cols-2">
            {term.units.map((unit) => (
              <li key={unit.number}>
                <Link href={scienceHref(term.id, unit.number)} className={cn(gradientCard, "h-full items-center gap-4 p-5")}>
                  <span className="pointer-events-none absolute -top-8 -left-8 -z-10 size-32 rounded-full bg-card/40 dark:bg-card/15" aria-hidden />
                  <span className="grid size-18 shrink-0 place-items-center rounded-[1.4rem] bg-card/70 shadow-(--shadow-sm) ring-1 ring-card/60 dark:bg-card/30 dark:shadow-none dark:ring-card/20">
                    <Icon3D
                      name={unitIcon(term, unit)}
                      size={56}
                      className="size-13 drop-shadow-[0_8px_10px_oklch(0_0_0/0.14)] transition-transform duration-300 group-hover/card:scale-110 motion-reduce:transition-none motion-reduce:group-hover/card:transform-none"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={cn("w-fit rounded-full bg-card px-2 py-0.5 text-xs font-semibold", colors.ink)}>
                      {unit.number}단원
                    </span>
                    <span className="font-heading text-xl leading-snug">
                      <span className="sr-only">{unit.number}. </span>
                      {unit.title}
                    </span>
                    <span className="text-sm text-foreground/75">탐구 {unit.lessons.length}개</span>
                  </span>
                  <ChevronRightIcon
                    className="size-5 shrink-0 text-foreground/60 transition-transform group-hover/card:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <EmptyState
          title={`${term.label} 단원은 준비 중이에요`}
          description="단원이 올라오면 여기에 나타나요."
          illustration={<EmptyOwl />}
          className="py-8"
          action={
            <Link href={scienceHref()} className={backLinkClass}>
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

/** "실험 앱"(시험관) · "조사 도우미"(돋보기) 배지: 3D 아이콘 + 글자(색만으로 구분하지 않음) */
function AppBadge({ kind }: { kind: "sim" | "guide" }) {
  const sim = kind === "sim";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1 text-xs font-semibold",
        sim ? cn(colors.softBg, colors.ink) : "bg-home-soft text-home-ink",
      )}
    >
      <Icon3D name={sim ? "test-tube" : "magnifying-glass"} size={20} className="size-5" />
      {appLabel(kind)}
    </span>
  );
}

function LessonMeta({ lesson, className }: { lesson: Lesson; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {lesson.app ? <AppBadge kind={lesson.app.kind} /> : null}
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
    </span>
  );
}

function appLabel(kind: "sim" | "guide") {
  return kind === "sim" ? "실험 앱" : "조사 도우미";
}

function UnitView({ term, unit }: { term: Term; unit: Unit }) {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb crumbs={[{ label: term.label, href: scienceHref(term.id) }, { label: unitLabel(unit) }]} />
      <SectionHeader eyebrow={term.label} title={unitLabel(unit)} icon={unitIcon(term, unit)} meta={`탐구 ${unit.lessons.length}개`} />
      <ol className="flex flex-col gap-3.5" aria-label={`${unitLabel(unit)} 차시 목록`}>
        {unit.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link href={scienceHref(term.id, unit.number, lesson.id)} className={cn(cardLink, "items-center gap-4 p-4 sm:px-5")}>
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl font-heading text-2xl",
                  colors.gradientBg,
                  colors.ink,
                )}
                aria-hidden
              >
                {lesson.inquiry}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                {/* 제목은 "탐구 번호. 주제" */}
                <span className="leading-snug font-semibold">
                  <span className="sr-only">{lesson.inquiry}. </span>
                  {lesson.title}
                </span>
                <LessonMeta lesson={lesson} />
              </span>
              <ChevronRightIcon
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5 motion-reduce:transition-none"
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
  const heroIcon: Icon3DName = lesson.app ? (lesson.app.kind === "sim" ? "test-tube" : "magnifying-glass") : unitIcon(term, unit);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        crumbs={[
          { label: term.label, href: scienceHref(term.id) },
          { label: unitLabel(unit), href: scienceHref(term.id, unit.number) },
          { label: lessonLabel(lesson) },
        ]}
      />

      <article
        className={cn(
          "relative isolate flex flex-col gap-6 overflow-hidden rounded-[2rem] p-6 ring-1 shadow-(--shadow-lg) sm:p-8 dark:shadow-none",
          colors.gradientBg,
          colors.softRing,
        )}
      >
        <span className="pointer-events-none absolute -top-14 -right-12 -z-10 size-56 rounded-full bg-card/45 dark:bg-card/20" aria-hidden />
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-sm) dark:shadow-none">
              <span className={cn("size-1.5 rounded-full", colors.strongBg)} aria-hidden />
              {unitLabel(unit)} · 탐구 {lesson.inquiry} / {unit.lessons.length}
            </span>
            <h1 className="font-heading text-2xl leading-snug font-normal break-keep sm:text-[2rem]">{lessonLabel(lesson)}</h1>
            <p className="inline-flex items-center gap-1 text-sm text-foreground/75">
              <ClockIcon className="size-4" aria-hidden />
              {lesson.period}차시
            </p>
          </div>
          <Icon3D
            name={heroIcon}
            size={104}
            className="mascot-float hidden size-20 shrink-0 drop-shadow-[0_14px_16px_oklch(0_0_0/0.16)] min-[420px]:block sm:size-24"
          />
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <PageTile icon={<BookOpenIcon className="size-5" aria-hidden />} label="교과서" pages={lesson.science} />
          <PageTile icon={<NotebookPenIcon className="size-5" aria-hidden />} label="실험관찰" pages={lesson.workbook} />
        </dl>

        {lesson.app ? (
          // 차시 앱은 public/ 아래 정적 앱이라 next/link가 아닌 <a>로 연다(basePath 수동 부착).
          // 화면에서 가장 중요한 버튼이라 보라 그라데이션 알약(spec §1.3).
          <a
            href={withBasePath(`/apps/${lesson.app.id}/`)}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-grad-primary px-6 text-base font-semibold text-primary-foreground shadow-(--shadow-brand) outline-none transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-10px_color-mix(in_oklch,var(--primary)_55%,transparent)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <FlaskConicalIcon className="size-5" aria-hidden />
            {lesson.app.kind === "sim" ? "실험 시뮬레이션 시작하기" : "조사 도우미 열기"}
          </a>
        ) : null}
      </article>

      <nav aria-label="차시 이동" className="@container">
        <div className="grid gap-3 @lg:grid-cols-2">
          {prev ? (
            <SiblingLink direction="prev" href={scienceHref(term.id, unit.number, prev.id)} lesson={prev} />
          ) : (
            <span className="hidden @lg:block" aria-hidden />
          )}
          {next ? <SiblingLink direction="next" href={scienceHref(term.id, unit.number, next.id)} lesson={next} /> : null}
        </div>
      </nav>

      <Link href={scienceHref(term.id, unit.number)} className={cn(backLinkClass, "mx-auto")}>
        <ArrowLeftIcon aria-hidden />
        {unit.title} 차시 목록으로
      </Link>
    </div>
  );
}

function PageTile({ icon, label, pages }: { icon: ReactNode; label: string; pages: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-3xl bg-card p-4 shadow-(--shadow-sm) ring-1 ring-foreground/5 sm:p-5 dark:shadow-none dark:ring-foreground/10">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn("grid size-8 place-items-center rounded-xl", colors.chip)}>{icon}</span>
        {label}
      </dt>
      <dd className={cn("font-heading text-2xl sm:text-[1.75rem]", !pages && "text-muted-foreground")}>{pagesText(pages)}</dd>
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
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", colors.chip)} aria-hidden>
        {isPrev ? <ArrowLeftIcon className="size-5" /> : <ArrowRightIcon className="size-5" />}
      </span>
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
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="과학수업을 불러오는 중">
      <div className="h-80 animate-pulse rounded-[2rem] bg-muted sm:h-72" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="h-56 animate-pulse rounded-[2rem] bg-muted" />
        <div className="h-56 animate-pulse rounded-[2rem] bg-muted" />
      </div>
    </div>
  );
}
