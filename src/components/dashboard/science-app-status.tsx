import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { scienceHref, scienceTerms, type Lesson, type Term, type Unit } from "@/data/science-curriculum";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

const colors = menuColorClasses.science;

type AppEntry = { term: Term; unit: Unit; lesson: Lesson & { app: NonNullable<Lesson["app"]> } };

/** 교육과정 순서대로 차시 앱이 연결된 차시 목록(로컬 데이터라 DB 호출 없음) */
export function scienceAppEntries(): AppEntry[] {
  const out: AppEntry[] = [];
  for (const term of scienceTerms) {
    for (const unit of term.units) {
      for (const lesson of unit.lessons) {
        if (lesson.app) out.push({ term, unit, lesson: lesson as AppEntry["lesson"] });
      }
    }
  }
  return out;
}

/** 과학 차시 앱 개수(홈 통계 카드) */
export function scienceAppCount(): number {
  return scienceAppEntries().length;
}

/**
 * 홈 "최근 과학 수업"의 차시 앱 현황(spec §6).
 * 단원별 앱 등록 수(예: 1. 산과 염기 6/6)와 교육과정상 가장 최근(뒤쪽) 차시 앱 몇 개를 바로가기로 보여 준다.
 */
export function ScienceAppStatus({ recent = 4 }: { recent?: number }) {
  const entries = scienceAppEntries();
  const units = scienceTerms.flatMap((term) =>
    term.units
      .map((unit) => ({ term, unit, total: unit.lessons.length, withApp: unit.lessons.filter((l) => l.app).length }))
      .filter((u) => u.withApp > 0),
  );
  const latest = entries.slice(-recent).reverse();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ul className="flex flex-wrap gap-2" aria-label="단원별 차시 앱 현황">
        {units.map(({ term, unit, total, withApp }) => (
          <li key={`${term.id}-${unit.number}`}>
            <Link
              href={scienceHref(term.id, unit.number)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3",
                colors.border,
                colors.focusRing,
              )}
            >
              <span className="font-medium">
                {unit.number}. {unit.title}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors.chip)}>
                앱 {withApp}/{total}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="flex flex-col gap-2" aria-label="최근 차시 앱">
        {latest.map(({ term, unit, lesson }) => (
          <li key={lesson.app.id}>
            <Link
              href={scienceHref(term.id, unit.number, lesson.id)}
              className="group flex items-center gap-3 rounded-xl p-3 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium",
                  lesson.app.kind === "sim" ? colors.chip : "bg-home-soft text-home-strong",
                )}
              >
                {lesson.app.kind === "sim" ? "실험" : "조사"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
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
    </div>
  );
}
