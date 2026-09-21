import type { MenuColor } from "@/data/menu";

/**
 * MenuColor → Tailwind 클래스 고정 매핑.
 * `bg-${color}-soft` 같은 동적 문자열은 Tailwind가 빌드 때 찾지 못하므로 전부 미리 적어 둔다.
 * 파스텔 색은 배경·아이콘·테두리에만 쓰고, 본문 글자는 text-foreground / text-muted-foreground를 쓴다.
 */
export type MenuColorClasses = {
  /** 옅은 배경 틴트 */
  softBg: string;
  /** 아이콘·포인트 글자색 */
  strongText: string;
  /** 포인트 배경(점, 막대 등) */
  strongBg: string;
  /** 옅은 테두리 */
  border: string;
  /** 카드 hover 시 테두리 강조 */
  hoverBorder: string;
  /** 아이콘 칩(soft 배경 + strong 아이콘) */
  chip: string;
  /** 키보드 포커스 링 */
  focusRing: string;
};

export const menuColorClasses: Record<MenuColor, MenuColorClasses> = {
  home: {
    softBg: "bg-home-soft",
    strongText: "text-home-strong",
    strongBg: "bg-home-strong",
    border: "border-home-strong/25",
    hoverBorder: "hover:border-home-strong/60",
    chip: "bg-home-soft text-home-strong",
    focusRing: "focus-visible:ring-home-strong/50",
  },
  games: {
    softBg: "bg-games-soft",
    strongText: "text-games-strong",
    strongBg: "bg-games-strong",
    border: "border-games-strong/25",
    hoverBorder: "hover:border-games-strong/60",
    chip: "bg-games-soft text-games-strong",
    focusRing: "focus-visible:ring-games-strong/50",
  },
  science: {
    softBg: "bg-science-soft",
    strongText: "text-science-strong",
    strongBg: "bg-science-strong",
    border: "border-science-strong/25",
    hoverBorder: "hover:border-science-strong/60",
    chip: "bg-science-soft text-science-strong",
    focusRing: "focus-visible:ring-science-strong/50",
  },
  math: {
    softBg: "bg-math-soft",
    strongText: "text-math-strong",
    strongBg: "bg-math-strong",
    border: "border-math-strong/25",
    hoverBorder: "hover:border-math-strong/60",
    chip: "bg-math-soft text-math-strong",
    focusRing: "focus-visible:ring-math-strong/50",
  },
};
