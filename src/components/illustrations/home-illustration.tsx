import { ILLUSTRATION_SVG_PROPS, type IllustrationProps, SmileFace, Sparkle } from "./parts";

/** 구름 색. 다크모드의 --card는 거의 검정이라 먹구름처럼 보이므로 옅은 밝은색으로 바꾼다. */
const CLOUD_FILL = "fill-card dark:fill-foreground/25";

/** 홈 히어로: 둥근 지붕의 작은 학교, 웃는 창문, 종이비행기 */
export function HomeIllustration(props: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 180" {...ILLUSTRATION_SVG_PROPS} {...props}>
      {/* 배경 블롭 · 언덕 */}
      <path
        d="M24 96c0-46 42-82 98-82s96 30 96 78-40 76-100 76S24 142 24 96Z"
        fill="var(--home-soft)"
      />
      <ellipse cx="120" cy="164" rx="104" ry="14" fill="var(--science-soft)" />

      {/* 해 */}
      <g className="illo-twinkle">
        <circle cx="196" cy="44" r="13" fill="var(--board-strong)" opacity="0.85" />
        <path
          d="M196 22v5M196 61v5M174 44h5M213 44h5M180.5 28.5l3.5 3.5M208 56l3.5 3.5M211.5 28.5 208 32M184 56l-3.5 3.5"
          stroke="var(--board-strong)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>

      {/* 구름 */}
      <g className="illo-float-slow">
        <path
          d="M150 40a8 8 0 0 1 2-15.5 11 11 0 0 1 21 1.5 7.5 7.5 0 0 1-1 14.5Z"
          className={CLOUD_FILL}
        />
      </g>
      <g className="illo-float">
        <path d="M36 98a6.5 6.5 0 0 1 1.5-12.5 9 9 0 0 1 17 1.5 6 6 0 0 1-1 11.5Z" className={CLOUD_FILL} />
      </g>

      {/* 종이비행기 + 점선 꼬리 */}
      <g className="illo-float">
        <g transform="translate(-12 -6)">
        <path
          d="M18 74c8-2 14-7 19-14"
          stroke="var(--home-strong)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="0.5 7"
        />
        <path
          d="M40 52 84 30 66 70l-9-13Z"
          fill="var(--card)"
          stroke="var(--home-strong)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M57 57 84 30" stroke="var(--home-strong)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>

      {/* 깃발 */}
      <path d="M120 38V14" stroke="var(--home-strong)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M121.5 15.5 140 21l-18.5 6.5Z"
        fill="var(--games-strong)"
        stroke="var(--games-strong)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 둥근 지붕 + 시계 */}
      <path
        d="M56 88c6-32 32-52 64-52s58 20 64 52Z"
        fill="var(--home-strong)"
        stroke="var(--home-strong)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M74 78c6-16 18-27 34-31" stroke="var(--card)" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
      <circle cx="120" cy="64" r="13" fill="var(--card)" />
      <path d="M120 56v8.5l6 3.5" stroke="var(--home-strong)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* 건물 몸통 */}
      <rect x="64" y="88" width="112" height="68" rx="10" fill="var(--card)" stroke="var(--home-strong)" strokeWidth="3.5" />

      {/* 웃는 창문 두 개 */}
      <rect x="75" y="100" width="30" height="30" rx="9" fill="var(--home-soft)" stroke="var(--home-strong)" strokeWidth="2.5" />
      <SmileFace cx={90} cy={111} gap={6} eye={1.9} />
      <rect x="135" y="100" width="30" height="30" rx="9" fill="var(--home-soft)" stroke="var(--home-strong)" strokeWidth="2.5" />
      <SmileFace cx={150} cy={111} gap={6} eye={1.9} />

      {/* 문 · 계단 */}
      <path
        d="M109 156v-24a11 11 0 0 1 22 0v24Z"
        fill="var(--board-soft)"
        stroke="var(--board-strong)"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <circle cx="126" cy="142" r="2" fill="var(--board-strong)" />
      <rect x="100" y="155" width="40" height="6" rx="3" fill="var(--home-strong)" />

      {/* 덤불과 꽃 */}
      <circle cx="52" cy="154" r="10" fill="var(--science-strong)" />
      <circle cx="40" cy="158" r="7" fill="var(--science-strong)" opacity="0.75" />
      <circle cx="50" cy="150" r="2.2" fill="var(--games-soft)" />
      <circle cx="188" cy="154" r="10" fill="var(--science-strong)" />
      <circle cx="200" cy="158" r="7" fill="var(--science-strong)" opacity="0.75" />
      <circle cx="191" cy="150" r="2.2" fill="var(--board-soft)" />

      {/* 반짝이 */}
      <Sparkle x={104} y={22} size={5} fill="var(--board-strong)" className="illo-twinkle-late" />
      <Sparkle x={218} y={92} size={6} fill="var(--games-strong)" className="illo-twinkle" />
      <Sparkle x={22} y={128} size={4.5} fill="var(--home-strong)" className="illo-twinkle-late" />
    </svg>
  );
}
