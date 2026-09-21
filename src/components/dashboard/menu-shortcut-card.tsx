import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import type { MenuItem } from "@/data/menu";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/** 홈 대시보드의 메뉴 바로가기 카드(일러스트 + 이름 + 한 줄 설명). src/data/menu.ts 항목을 그대로 받는다. */
export function MenuShortcutCard({ item }: { item: MenuItem }) {
  const colors = menuColorClasses[item.color];
  const Illustration = item.illustration;
  return (
    <Link
      href={item.href}
      className={cn(
        "group/shortcut flex h-full flex-col items-center gap-1 rounded-3xl border p-5 text-center outline-none transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5 focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:shadow-none",
        colors.softBg,
        colors.border,
        colors.hoverBorder,
        colors.focusRing,
      )}
    >
      <Illustration className="h-28 w-40 transition-transform duration-200 group-hover/shortcut:scale-105 motion-reduce:transition-none" />
      <span className="font-heading text-xl text-foreground">{item.label}</span>
      {/* soft 배경 위 작은 글자는 대비(4.5:1)를 위해 muted-foreground 대신 옅은 foreground를 쓴다. */}
      <span className="text-sm text-foreground/75">{item.description}</span>
      <span
        className={cn(
          "mt-2 inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground ring-1 ring-foreground/10",
        )}
      >
        바로 가기
        <ArrowRightIcon className={cn("size-3.5 transition-transform group-hover/shortcut:translate-x-0.5", colors.strongText)} aria-hidden />
      </span>
    </Link>
  );
}
