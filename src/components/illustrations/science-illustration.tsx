import { useId } from "react";
import { ILLUSTRATION_SVG_PROPS, type IllustrationProps, SmileFace, Sparkle } from "./parts";

/** 과학수업: 기포가 올라오는 플라스크, 고리 달린 행성, 돋보기 */
export function ScienceIllustration(props: IllustrationProps) {
  const clipId = useId();

  return (
    <svg viewBox="0 0 240 180" {...ILLUSTRATION_SVG_PROPS} {...props}>
      <defs>
        <clipPath id={clipId}>
          <path d="M92 44h26v34l31 54a11 11 0 0 1-9.5 16.5H70.5A11 11 0 0 1 61 132l31-54Z" />
        </clipPath>
      </defs>

      {/* 배경 블롭 */}
      <path
        d="M20 92c0-44 40-78 98-78s102 26 102 76-44 78-104 78S20 138 20 92Z"
        fill="var(--science-soft)"
      />

      {/* 원자 */}
      {/* CSS 애니메이션의 transform이 transform 속성을 덮어쓰므로 <g>를 한 겹 더 둔다. */}
      <g className="illo-float-slow">
        <g transform="translate(40 58)">
          <ellipse rx="17" ry="6.5" transform="rotate(32)" stroke="var(--science-strong)" strokeWidth="2.2" />
          <ellipse rx="17" ry="6.5" transform="rotate(-32)" stroke="var(--science-strong)" strokeWidth="2.2" />
          <circle r="4" fill="var(--games-strong)" />
          <circle cx="14.5" cy="9" r="2.2" fill="var(--home-strong)" />
        </g>
      </g>

      {/* 플라스크 */}
      <path
        d="M92 44h26v34l31 54a11 11 0 0 1-9.5 16.5H70.5A11 11 0 0 1 61 132l31-54Z"
        fill="var(--card)"
      />
      <g clipPath={`url(#${clipId})`}>
        {/* 물결치는 용액 */}
        <path
          d="M56 108c9-6 17-6 26 0s17 6 26 0 17-6 26 0 14 5 22 0v46H56Z"
          style={{ fill: "color-mix(in oklab, var(--science-strong) 45%, var(--card))" }}
        />
        <circle cx="80" cy="134" r="3" fill="var(--card)" opacity="0.7" />
        <circle cx="132" cy="138" r="2.2" fill="var(--card)" opacity="0.7" />
        <circle cx="126" cy="120" r="1.8" fill="var(--card)" opacity="0.7" />
      </g>
      <path
        d="M92 44h26v34l31 54a11 11 0 0 1-9.5 16.5H70.5A11 11 0 0 1 61 132l31-54Z"
        stroke="var(--science-strong)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <rect x="86" y="36" width="38" height="10" rx="5" fill="var(--card)" stroke="var(--science-strong)" strokeWidth="3.5" />
      <path d="M100 56v16" stroke="var(--science-strong)" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
      <SmileFace cx={105} cy={126} gap={9} eye={2.4} />

      {/* 올라오는 기포 */}
      <g className="illo-float">
        <circle cx="110" cy="24" r="5.5" fill="var(--card)" stroke="var(--science-strong)" strokeWidth="2.5" />
        <circle cx="96" cy="14" r="3.5" fill="var(--card)" stroke="var(--science-strong)" strokeWidth="2.2" />
      </g>
      <circle cx="122" cy="9" r="2.5" fill="var(--science-strong)" className="illo-twinkle" />

      {/* 고리 달린 행성 */}
      <g className="illo-float-slow">
        <g transform="rotate(-18 186 50)">
          <ellipse cx="186" cy="50" rx="33" ry="9" stroke="var(--science-strong)" strokeWidth="3.5" />
          <circle cx="186" cy="50" r="20" fill="var(--math-strong)" />
          <path d="M170 42c5-5 11-8 18-8" stroke="var(--card)" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
          <circle cx="196" cy="62" r="3" fill="var(--card)" opacity="0.3" />
          <path d="M153 50a33 9 0 0 0 66 0" stroke="var(--science-strong)" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        {/* 행성 얼굴(고리 위쪽) */}
        <circle cx="180" cy="41" r="1.9" fill="var(--card)" />
        <circle cx="191" cy="39" r="1.9" fill="var(--card)" />
        <path d="M183 45.5c2 1.8 4.5 1.5 6-0.5" stroke="var(--card)" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* 돋보기 */}
      <path d="M196 132l17 17" stroke="var(--science-strong)" strokeWidth="8" strokeLinecap="round" />
      <circle cx="182" cy="118" r="19" fill="var(--home-soft)" stroke="var(--science-strong)" strokeWidth="4.5" />
      <path d="M170 114c1.5-6 6-10 12-11" stroke="var(--card)" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
      <Sparkle x={187} y={122} size={6} fill="var(--home-strong)" className="illo-twinkle" />

      {/* 반짝이 */}
      <Sparkle x={58} y={26} size={5} fill="var(--math-strong)" className="illo-twinkle-late" />
      <Sparkle x={150} y={22} size={4.5} fill="var(--games-strong)" className="illo-twinkle" />
      <Sparkle x={34} y={124} size={5.5} fill="var(--science-strong)" className="illo-twinkle-late" />
    </svg>
  );
}
