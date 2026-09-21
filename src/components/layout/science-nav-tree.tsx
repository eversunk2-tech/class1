"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { scienceHref, scienceTerms } from "@/data/science-curriculum";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

const colors = menuColorClasses.science;

type Props = {
  /** 현재 경로가 /science/ 인지 */
  onSciencePage: boolean;
  /** 링크를 누른 직후 호출(모바일 드로어 닫기) */
  onNavigate?: () => void;
};

/**
 * 사이드바 · 모바일 드로어의 "과학수업" 하위 트리(학기 → 단원). 차시는 화면에서 고른다.
 * - `.sidebar-subtree-toggle` / `.sidebar-subtree`는 사이드바 레일(접힘) 상태에서 CSS로 숨긴다(globals.css).
 * - 현재 URL의 term/unit을 활성 표시하고 그 학기를 자동으로 펼친다.
 * useSearchParams를 쓰므로 Suspense 경계로 감싼다. 정적 HTML에는 활성 표시 없는 트리가 먼저 그려진다.
 */
export function ScienceNavTree(props: Props) {
  return (
    <Suspense fallback={<ScienceNavTreeInner {...props} termId={null} unitNumber={null} />}>
      <ScienceNavTreeWithParams {...props} />
    </Suspense>
  );
}

function ScienceNavTreeWithParams(props: Props) {
  const params = useSearchParams();
  return (
    <ScienceNavTreeInner
      {...props}
      termId={props.onSciencePage ? params.get("term") : null}
      unitNumber={props.onSciencePage ? params.get("unit") : null}
    />
  );
}

function ScienceNavTreeInner({
  onSciencePage,
  onNavigate,
  termId,
  unitNumber,
}: Props & { termId: string | null; unitNumber: string | null }) {
  const baseId = useId();
  const treeId = `${baseId}-science`;

  // 사용자가 직접 펼치고 접을 수 있되, 과학수업 화면에 들어오거나 다른 학기로 이동하면 자동으로 펼친다.
  // (렌더 중 이전 값과 비교해 상태를 맞추는 React 권장 패턴: effect 없이 한 번에 반영)
  const [open, setOpen] = useState(onSciencePage);
  const [openTerms, setOpenTerms] = useState<string[]>(termId ? [termId] : []);
  const [prev, setPrev] = useState({ onSciencePage, termId });
  if (prev.onSciencePage !== onSciencePage || prev.termId !== termId) {
    setPrev({ onSciencePage, termId });
    if (onSciencePage && !prev.onSciencePage) setOpen(true);
    if (termId && termId !== prev.termId) {
      setOpen(true);
      setOpenTerms((list) => (list.includes(termId) ? list : [...list, termId]));
    }
  }

  const toggleTerm = (id: string) =>
    setOpenTerms((list) => (list.includes(id) ? list.filter((t) => t !== id) : [...list, id]));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={treeId}
        aria-label={open ? "과학수업 하위 메뉴 접기" : "과학수업 하위 메뉴 펼치기"}
        title={open ? "하위 메뉴 접기" : "하위 메뉴 펼치기"}
        className={cn(
          "sidebar-subtree-toggle absolute top-2 right-1.5 flex size-8 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-3",
          colors.focusRing,
        )}
      >
        <ChevronDownIcon
          className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")}
          aria-hidden
        />
      </button>

      {open ? (
        <ul id={treeId} className="sidebar-subtree mt-1 ml-6 flex flex-col gap-0.5 border-l pl-2" aria-label="과학수업 학기">
          {scienceTerms.map((term) => {
            const termActive = termId === term.id;
            const termExact = termActive && unitNumber == null;
            const termOpen = openTerms.includes(term.id);
            const unitsId = `${baseId}-term-${term.id}`;
            return (
              <li key={term.id}>
                <div className="flex items-center gap-0.5">
                  <Link
                    href={scienceHref(term.id)}
                    onClick={onNavigate}
                    aria-current={termExact ? "page" : undefined}
                    className={cn(
                      "flex h-9 min-w-0 flex-1 items-center rounded-xl px-2.5 text-sm outline-none transition-colors focus-visible:ring-3",
                      colors.focusRing,
                      termExact ? cn(colors.softBg, "font-semibold") : termActive ? "font-semibold hover:bg-muted" : "hover:bg-muted",
                    )}
                  >
                    <span className="truncate">{term.label}</span>
                  </Link>
                  {term.units.length ? (
                    <button
                      type="button"
                      onClick={() => toggleTerm(term.id)}
                      aria-expanded={termOpen}
                      aria-controls={unitsId}
                      aria-label={`${term.label} 단원 ${termOpen ? "접기" : "펼치기"}`}
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3",
                        colors.focusRing,
                      )}
                    >
                      <ChevronDownIcon
                        className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", !termOpen && "-rotate-90")}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground">준비 중</span>
                  )}
                </div>

                {term.units.length && termOpen ? (
                  <ul id={unitsId} className="mt-0.5 mb-1 ml-3 flex flex-col gap-0.5 border-l pl-2" aria-label={`${term.label} 단원`}>
                    {term.units.map((unit) => {
                      const unitActive = termActive && unitNumber === String(unit.number);
                      return (
                        <li key={unit.number}>
                          <Link
                            href={scienceHref(term.id, unit.number)}
                            onClick={onNavigate}
                            aria-current={unitActive ? "page" : undefined}
                            className={cn(
                              "flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-[0.8rem] leading-snug outline-none transition-colors focus-visible:ring-3",
                              colors.focusRing,
                              unitActive ? cn(colors.softBg, "font-semibold") : "text-foreground/80 hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <span
                              className={cn("size-1.5 shrink-0 rounded-full", unitActive ? colors.strongBg : "bg-foreground/25")}
                              aria-hidden
                            />
                            <span className="min-w-0">
                              {unit.number}. {unit.title}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
