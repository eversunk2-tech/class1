import { ILLUSTRATION_SVG_PROPS, type IllustrationProps, SmileFace, Sparkle, Star } from "./parts";

/** 학습게임활동: 둥근 게임 컨트롤러와 반짝이는 별 */
export function GameIllustration(props: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 180" {...ILLUSTRATION_SVG_PROPS} {...props}>
      {/* 배경 블롭 · 그림자 */}
      <path
        d="M18 92c0-46 42-78 100-78s104 28 104 78-44 76-106 76S18 138 18 92Z"
        fill="var(--games-soft)"
      />
      <ellipse cx="120" cy="158" rx="72" ry="7" fill="var(--foreground)" opacity="0.08" />

      {/* 별 */}
      <Star x={46} y={42} r={12} rotate={-12} fill="var(--math-strong)" className="illo-twinkle" />
      <Star x={198} y={38} r={9.5} rotate={10} fill="var(--math-strong)" className="illo-twinkle-late" />
      <Star x={160} y={22} r={5.5} fill="var(--home-strong)" className="illo-twinkle" />
      <Star x={24} y={104} r={5} rotate={8} fill="var(--science-strong)" className="illo-twinkle-late" />

      {/* 케이블 */}
      <path
        d="M120 64c0-12-12-10-12-22s10-12 10-22"
        stroke="var(--games-strong)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* 컨트롤러 몸통 */}
      <g className="illo-float-slow">
        <path
          d="M70 62h100a34 34 0 0 1 33 27l8 38a20 20 0 0 1-36 15l-12-16H77l-12 16a20 20 0 0 1-36-15l8-38a34 34 0 0 1 33-27Z"
          fill="var(--card)"
          stroke="var(--games-strong)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* 윗면 하이라이트 · 어깨 버튼 */}
        <path d="M56 74c4-3 9-5 15-5h30" stroke="var(--games-soft)" strokeWidth="4" strokeLinecap="round" />

        {/* 십자 키 */}
        <rect x="76" y="80" width="12" height="32" rx="4.5" fill="var(--games-strong)" />
        <rect x="66" y="90" width="32" height="12" rx="4.5" fill="var(--games-strong)" />
        <circle cx="82" cy="96" r="2.5" fill="var(--card)" opacity="0.6" />

        {/* 네 가지 색 버튼 */}
        <circle cx="160" cy="82" r="7" fill="var(--home-strong)" />
        <circle cx="175" cy="96" r="7" fill="var(--science-strong)" />
        <circle cx="145" cy="96" r="7" fill="var(--math-strong)" />
        <circle cx="160" cy="110" r="7" fill="var(--games-strong)" />

        {/* 얼굴 · 시작 버튼 */}
        <SmileFace cx={120} cy={88} gap={8} eye={2.3} />
        <rect x="107" y="112" width="11" height="4.5" rx="2.2" fill="var(--foreground)" opacity="0.25" />
        <rect x="122" y="112" width="11" height="4.5" rx="2.2" fill="var(--foreground)" opacity="0.25" />
      </g>

      {/* 반짝이 */}
      <Sparkle x={222} y={84} size={6} fill="var(--games-strong)" className="illo-twinkle" />
      <Sparkle x={92} y={26} size={5} fill="var(--games-strong)" className="illo-twinkle-late" />
      <Sparkle x={210} y={150} size={4.5} fill="var(--home-strong)" className="illo-twinkle" />
      <Sparkle x={34} y={148} size={5} fill="var(--math-strong)" className="illo-twinkle" />
    </svg>
  );
}
