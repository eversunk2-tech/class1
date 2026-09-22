import { ILLUSTRATION_SVG_PROPS, type IllustrationProps, SmileFace, Sparkle, Star } from "./parts";

/** 자유게시판: 서로 이야기하는 말풍선 두 개와 하트 */
export function BoardIllustration(props: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 180" {...ILLUSTRATION_SVG_PROPS} {...props}>
      {/* 배경 블롭 · 그림자 */}
      <path d="M20 94c0-48 44-80 102-80s100 30 100 80-42 74-104 74S20 142 20 94Z" fill="var(--board-soft)" />
      <ellipse cx="120" cy="160" rx="70" ry="7" fill="var(--foreground)" opacity="0.08" />

      {/* 큰 말풍선 */}
      <g className="illo-float-slow">
        <path
          d="M50 44h84a22 22 0 0 1 22 22v30a22 22 0 0 1-22 22H84l-18 16 4-16h-20a22 22 0 0 1-22-22V66a22 22 0 0 1 22-22Z"
          fill="var(--card)"
          stroke="var(--board-strong)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <SmileFace cx={92} cy={74} gap={11} eye={2.6} cheek="var(--board-strong)" />
        <rect x="64" y="96" width="38" height="5" rx="2.5" fill="var(--board-strong)" opacity="0.35" />
        <rect x="106" y="96" width="18" height="5" rx="2.5" fill="var(--board-strong)" opacity="0.35" />
      </g>

      {/* 작은 말풍선 */}
      <g className="illo-float">
        <path
          d="M150 88h46a18 18 0 0 1 18 18v14a18 18 0 0 1-18 18h-6l3 13-15-13h-28a18 18 0 0 1-18-18v-14a18 18 0 0 1 18-18Z"
          fill="var(--card)"
          stroke="var(--games-strong)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* 하트 */}
        <path
          d="M173 105c-4-6-14-4-14 3 0 6 8 11 14 16 6-5 14-10 14-16 0-7-10-9-14-3Z"
          fill="var(--games-strong)"
        />
      </g>

      {/* 반짝이 · 별 */}
      <Star x={196} y={40} r={9} rotate={8} fill="var(--board-strong)" className="illo-twinkle" />
      <Star x={30} y={124} r={5} fill="var(--science-strong)" className="illo-twinkle-late" />
      <Sparkle x={168} y={24} size={5} fill="var(--home-strong)" className="illo-twinkle-late" />
      <Sparkle x={222} y={96} size={5} fill="var(--board-strong)" className="illo-twinkle" />
      <Sparkle x={40} y={30} size={4.5} fill="var(--games-strong)" className="illo-twinkle" />
    </svg>
  );
}
