import type { MenuColor } from "@/data/menu";
import { ILLUSTRATION_SVG_PROPS, type IllustrationProps, Sparkle } from "./parts";

/** accent → CSS 변수(고정 매핑) */
const ACCENT_STRONG: Record<MenuColor, string> = {
  home: "var(--home-strong)",
  games: "var(--games-strong)",
  science: "var(--science-strong)",
  board: "var(--board-strong)",
};

const ACCENT_SOFT: Record<MenuColor, string> = {
  home: "var(--home-soft)",
  games: "var(--games-soft)",
  science: "var(--science-soft)",
  board: "var(--board-soft)",
};

/** 빈 상태 공통: 뚜껑 열린 상자 안을 들여다보는 동글이. accent로 리본 색만 바뀐다. */
export function EmptyBoxIllustration({
  accent = "home",
  ...props
}: IllustrationProps & { accent?: MenuColor }) {
  const strong = ACCENT_STRONG[accent];
  const soft = ACCENT_SOFT[accent];

  return (
    <svg viewBox="0 0 200 160" {...ILLUSTRATION_SVG_PROPS} {...props}>
      <ellipse cx="100" cy="146" rx="70" ry="8" fill="var(--foreground)" opacity="0.07" />
      <circle cx="100" cy="72" r="58" fill={soft} opacity="0.7" />

      {/* 상자 뒤에서 고개를 내민 동글이 */}
      <g className="illo-float-slow">
        {/* 새싹 */}
        <path d="M100 26c0-7 5-12 12-12 0 7-5 12-12 12Z" fill="var(--science-strong)" />
        <path d="M100 26c0-5.5-4-9.5-9.5-9.5 0 5.5 4 9.5 9.5 9.5Z" fill="var(--science-strong)" opacity="0.7" />
        <path d="M100 25v6" stroke="var(--science-strong)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="58" r="29" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="3" />
        {/* 아래를 내려다보는 눈 */}
        <ellipse cx="90" cy="64" rx="3" ry="3.6" fill="var(--foreground)" />
        <ellipse cx="110" cy="64" rx="3" ry="3.6" fill="var(--foreground)" />
        <circle cx="90.8" cy="65.4" r="1" fill="var(--card)" />
        <circle cx="110.8" cy="65.4" r="1" fill="var(--card)" />
        <path d="M84 55c3-2.5 6-2.5 9-1" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <path d="M107 54c3-1.5 6-1.5 9 1" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <ellipse cx="100" cy="74" rx="3" ry="3.5" fill="var(--foreground)" opacity="0.85" />
        <circle cx="82" cy="71" r="3.6" fill="var(--games-strong)" opacity="0.35" />
        <circle cx="118" cy="71" r="3.6" fill="var(--games-strong)" opacity="0.35" />
      </g>

      {/* 상자 안쪽(어두운 입구) */}
      <path d="M48 92 62 78h76l14 14Z" fill="var(--foreground)" opacity="0.14" />

      {/* 열린 날개 */}
      <path
        d="M48 92 62 78 40 66 24 82Z"
        fill="var(--muted)"
        stroke="var(--muted-foreground)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M152 92 138 78l22-12 16 16Z"
        fill="var(--muted)"
        stroke="var(--muted-foreground)"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* 상자 앞면 + 리본 */}
      <rect x="48" y="92" width="104" height="52" rx="7" fill="var(--muted)" stroke="var(--muted-foreground)" strokeWidth="3" />
      <rect x="92" y="93.5" width="16" height="49" fill={strong} opacity="0.85" />
      <path
        d="M124 116c0-3 4-4.5 5.5-1.5 1.5-3 5.5-1.5 5.5 1.5 0 3.5-5.5 7-5.5 7s-5.5-3.5-5.5-7Z"
        fill={strong}
        opacity="0.7"
      />

      {/* 상자 가장자리를 붙잡은 손 */}
      <ellipse cx="76" cy="86" rx="7" ry="5.5" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="2.5" />
      <ellipse cx="124" cy="86" rx="7" ry="5.5" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="2.5" />

      {/* 물음표 · 반짝이 */}
      <g className="illo-float">
        <text
          x="150"
          y="46"
          transform="rotate(14 156 38)"
          fill={strong}
          style={{ fontFamily: "var(--font-heading)", fontSize: 28 }}
        >
          ?
        </text>
      </g>
      <Sparkle x={38} y={40} size={5.5} fill={strong} className="illo-twinkle" />
      <Sparkle x={176} y={112} size={4.5} fill="var(--board-strong)" className="illo-twinkle-late" />
      <Sparkle x={22} y={118} size={4} fill="var(--home-strong)" className="illo-twinkle-late" />
    </svg>
  );
}
