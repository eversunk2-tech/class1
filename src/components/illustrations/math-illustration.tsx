import { ILLUSTRATION_SVG_PROPS, type IllustrationProps, SmileFace, Sparkle } from "./parts";

const NUMBER_STYLE = { fontFamily: "var(--font-heading)", fontSize: 30 } as const;

/** 계산기 버튼 위치(3×3) */
const KEY_XS = [110, 129.5, 149];
const KEY_YS = [86, 105, 124];

/** 수학수업: 삼각자, 웃는 계산기, 숫자 1·2·3, 컴퍼스 */
export function MathIllustration(props: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 180" {...ILLUSTRATION_SVG_PROPS} {...props}>
      {/* 배경 블롭 */}
      <path
        d="M18 94c0-46 44-80 102-80s102 30 102 78-42 76-104 76S18 140 18 94Z"
        fill="var(--math-soft)"
      />

      {/* 통통 튀는 숫자 1 · 2 · 3 */}
      <g className="illo-float">
        <text x="30" y="60" transform="rotate(-12 38 50)" fill="var(--home-strong)" style={NUMBER_STYLE}>
          1
        </text>
      </g>
      <g className="illo-float-slow">
        <text x="56" y="44" fill="var(--games-strong)" style={NUMBER_STYLE}>
          2
        </text>
      </g>
      <g className="illo-float">
        <text x="82" y="62" transform="rotate(12 90 52)" fill="var(--science-strong)" style={NUMBER_STYLE}>
          3
        </text>
      </g>

      {/* 삼각자 */}
      <path
        d="M24 150V72l78 78Z"
        fill="var(--card)"
        stroke="var(--math-strong)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M40 134v-26l26 26Z"
        fill="var(--math-soft)"
        stroke="var(--math-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M27 90h6M27 100h4M27 110h6M27 120h4M27 130h6M27 140h4"
        stroke="var(--math-strong)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 계산기(살짝 기울임) */}
      <g transform="rotate(5 136 94)">
        <rect x="100" y="40" width="72" height="108" rx="15" fill="var(--card)" stroke="var(--math-strong)" strokeWidth="3.5" />
        <rect x="109" y="50" width="54" height="27" rx="8" fill="var(--math-soft)" />
        <SmileFace cx={136} cy={60} gap={9} eye={2.2} />
        {KEY_YS.map((y, row) =>
          KEY_XS.map((x, col) => {
            const isEquals = row === 2 && col === 2;
            return (
              <rect
                key={`${row}-${col}`}
                x={x}
                y={y}
                width="14"
                height="14"
                rx="5"
                fill={isEquals ? "var(--games-strong)" : "var(--math-strong)"}
                opacity={isEquals ? 0.9 : col === 2 ? 0.75 : 0.35}
              />
            );
          }),
        )}
        <path d="M153 129h6M153 133h6" stroke="var(--card)" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* 컴퍼스와 그리는 호 */}
      <path
        d="M182 152c14 8 30 6 42-6"
        stroke="var(--home-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="0.5 6.5"
      />
      <path d="M205 60l-15 78" stroke="var(--math-strong)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M205 60l16 72" stroke="var(--math-strong)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M190 138l-1.5 8" stroke="var(--foreground)" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
      <path d="M221 132l2.5 11" stroke="var(--games-strong)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M205 58V44" stroke="var(--math-strong)" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="205" cy="60" r="6.5" fill="var(--card)" stroke="var(--math-strong)" strokeWidth="3.5" />
      <path d="M196 96h18" stroke="var(--math-strong)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />

      {/* 연산 기호 · 반짝이 */}
      <path d="M186 22v12M180 28h12" stroke="var(--science-strong)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M150 16l8 8M158 16l-8 8" stroke="var(--games-strong)" strokeWidth="3.5" strokeLinecap="round" />
      <Sparkle x={124} y={24} size={5} fill="var(--math-strong)" className="illo-twinkle" />
      <Sparkle x={226} y={90} size={4.5} fill="var(--home-strong)" className="illo-twinkle-late" />
      <Sparkle x={70} y={160} size={4.5} fill="var(--math-strong)" className="illo-twinkle-late" />
    </svg>
  );
}
