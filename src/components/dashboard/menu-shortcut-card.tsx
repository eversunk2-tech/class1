import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Icon3D } from "@/components/illustrations/icon-3d";
import type { MenuItem } from "@/data/menu";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/**
 * 홈 대시보드의 기능(메뉴 바로가기) 카드: 파스텔 그라데이션 + 큰 3D 아이콘(흰 반투명 원 위) +
 * 점선 링을 두른 동그란 흰 화살표 버튼(docs/design/redesign/spec.md §4.3, 개정 2 "더 화려하게").
 * - 그라데이션 위 글자는 대비를 위해 항상 foreground 계열만 쓴다(메뉴색 글자 금지, spec §7).
 * - 배치는 카드 자신의 폭(@container/card)으로 정한다: 내용 폭 16.5rem 이상이면 글자 왼쪽·그림 오른쪽,
 *   더 좁으면(사이드바가 펼쳐진 태블릿 가로·1280 데스크톱에서 3열) 그림을 위로 올려 제목이 끊기지 않게 한다.
 * - 올리면 카드가 떠오르고 메뉴색 그림자가 진해지며 아이콘이 살짝 커진다(움직임 줄이기면 없음).
 */
export function MenuShortcutCard({ item }: { item: MenuItem }) {
  const colors = menuColorClasses[item.color];
  return (
    <Link
      href={item.href}
      className={cn(
        "group/shortcut @container/card relative isolate flex h-full min-h-48 flex-col justify-between gap-4 overflow-hidden rounded-[2rem] p-6 ring-1 outline-none transition-[translate,box-shadow] duration-300",
        "shadow-(--shadow-md) hover:-translate-y-1.5 focus-visible:ring-3 dark:shadow-none",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        colors.gradientBg,
        colors.softRing,
        colors.hoverGlow,
        colors.focusRing,
      )}
    >
      <div className="flex flex-col-reverse items-start gap-2 @min-[16.5rem]/card:flex-row @min-[16.5rem]/card:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5 @min-[16.5rem]/card:pt-2">
          <span className="font-heading text-2xl leading-tight text-foreground">{item.label}</span>
          {/* 그라데이션 위 작은 글자는 대비(4.5:1)를 위해 muted-foreground 대신 옅은 foreground를 쓴다. */}
          <span className="text-sm leading-relaxed text-foreground/75">{item.description}</span>
        </div>
        {/* 3D 아이콘 + 뒤의 흰 반투명 원 */}
        {/* 크기: 이전 80~88px → 112~128px(약 1.4배). 그림이 원보다 조금 커서 튀어나와 보인다. */}
        <span className="relative grid size-28 shrink-0 place-items-center self-end @min-[16.5rem]/card:self-start @min-[24rem]/card:size-32">
          <span className="absolute inset-[8%] rounded-full bg-card/55 ring-1 ring-card/60 dark:bg-card/25 dark:ring-card/20" aria-hidden />
          <Icon3D
            name={item.image3d}
            size={128}
            className="relative size-full drop-shadow-[0_12px_14px_oklch(0_0_0/0.14)] transition-transform duration-300 group-hover/shortcut:scale-110 group-hover/shortcut:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover/shortcut:transform-none"
          />
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground/80">바로 가기</span>
        {/* 동그란 흰 화살표 버튼 + 둘레 점선 링(장식) */}
        <span className="relative grid size-14 shrink-0 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-full border-2 border-dashed border-card/90 dark:border-foreground/30" />
          <span
            className={cn(
              "grid size-11 place-items-center rounded-full bg-card shadow-(--shadow-sm) transition-colors duration-200 group-hover/shortcut:bg-primary dark:shadow-none",
              colors.strongText,
            )}
          >
            <ArrowRightIcon className="size-5 transition-transform duration-200 group-hover/shortcut:translate-x-0.5 group-hover/shortcut:text-primary-foreground motion-reduce:transition-none" />
          </span>
        </span>
      </div>
    </Link>
  );
}
