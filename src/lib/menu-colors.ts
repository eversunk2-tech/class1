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
  /** 큰 카드 전용 그라데이션 배경(soft → grad-to, globals.css의 @utility bg-grad-*). 칩·배지에는 쓰지 않는다. */
  gradientBg: string;
  /** 그라데이션 카드의 옅은 윤곽선(ring) */
  softRing: string;
  /** soft 배경 위 **작은 글자**용 메뉴색(strong + foreground 섞음, AA 4.5:1 이상). 아이콘은 strongText 그대로 */
  ink: string;
  /** 부드러운 메뉴색 그림자(통계 칸·정보 카드) — globals.css의 --{color}-glow */
  glowShadow: string;
  /** hover 때 진해지는 메뉴색 그림자(기능 카드) */
  hoverGlow: string;
  /** "더 보기" 같은 작은 알약 링크: soft 바탕 + ink 글자, hover 때 바탕이 조금 진해짐 */
  pill: string;
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
    gradientBg: "bg-grad-home",
    softRing: "ring-home-strong/15",
    ink: "text-home-ink",
    glowShadow: "shadow-[0_14px_32px_-18px_var(--home-glow)]",
    hoverGlow: "hover:shadow-[0_26px_48px_-20px_var(--home-glow)]",
    pill: "bg-home-soft text-home-ink hover:bg-[color-mix(in_oklch,var(--home-soft),var(--home-strong)_14%)]",
  },
  games: {
    softBg: "bg-games-soft",
    strongText: "text-games-strong",
    strongBg: "bg-games-strong",
    border: "border-games-strong/25",
    hoverBorder: "hover:border-games-strong/60",
    chip: "bg-games-soft text-games-strong",
    focusRing: "focus-visible:ring-games-strong/50",
    gradientBg: "bg-grad-games",
    softRing: "ring-games-strong/15",
    ink: "text-games-ink",
    glowShadow: "shadow-[0_14px_32px_-18px_var(--games-glow)]",
    hoverGlow: "hover:shadow-[0_26px_48px_-20px_var(--games-glow)]",
    pill: "bg-games-soft text-games-ink hover:bg-[color-mix(in_oklch,var(--games-soft),var(--games-strong)_14%)]",
  },
  science: {
    softBg: "bg-science-soft",
    strongText: "text-science-strong",
    strongBg: "bg-science-strong",
    border: "border-science-strong/25",
    hoverBorder: "hover:border-science-strong/60",
    chip: "bg-science-soft text-science-strong",
    focusRing: "focus-visible:ring-science-strong/50",
    gradientBg: "bg-grad-science",
    softRing: "ring-science-strong/15",
    ink: "text-science-ink",
    glowShadow: "shadow-[0_14px_32px_-18px_var(--science-glow)]",
    hoverGlow: "hover:shadow-[0_26px_48px_-20px_var(--science-glow)]",
    pill: "bg-science-soft text-science-ink hover:bg-[color-mix(in_oklch,var(--science-soft),var(--science-strong)_14%)]",
  },
  board: {
    softBg: "bg-board-soft",
    strongText: "text-board-strong",
    strongBg: "bg-board-strong",
    border: "border-board-strong/25",
    hoverBorder: "hover:border-board-strong/60",
    chip: "bg-board-soft text-board-strong",
    focusRing: "focus-visible:ring-board-strong/50",
    gradientBg: "bg-grad-board",
    softRing: "ring-board-strong/15",
    ink: "text-board-ink",
    glowShadow: "shadow-[0_14px_32px_-18px_var(--board-glow)]",
    hoverGlow: "hover:shadow-[0_26px_48px_-20px_var(--board-glow)]",
    pill: "bg-board-soft text-board-ink hover:bg-[color-mix(in_oklch,var(--board-soft),var(--board-strong)_14%)]",
  },
};
