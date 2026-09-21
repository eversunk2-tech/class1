import { ILLUSTRATION_SVG_PROPS, type IllustrationProps } from "./parts";

const LINE = "color-mix(in srgb, var(--destructive) 60%, transparent)";

/** 오류 상태 공통: 살짝 시무룩한 동글이(과하지 않게) */
export function ErrorFaceIllustration(props: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 140" {...ILLUSTRATION_SVG_PROPS} {...props}>
      <ellipse cx="80" cy="128" rx="40" ry="6" fill="var(--foreground)" opacity="0.07" />

      {/* 시든 새싹 */}
      <path d="M80 38c0-6 1-9 5-12" style={{ stroke: LINE }} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M85 26c6-3 13 0 15 7-7 2.5-13 0-15-7Z" style={{ fill: LINE }} />
      <path d="M82 31c-5-4-12-3-15 3 6 3.5 12 2.5 15-3Z" style={{ fill: LINE }} opacity="0.7" />

      {/* 얼굴 */}
      <circle cx="80" cy="80" r="40" fill="var(--card)" style={{ stroke: LINE }} strokeWidth="3.5" />
      <path d="M59 66c4-3.5 9-4.5 14-3" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M101 66c-4-3.5-9-4.5-14-3" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="66" cy="77" r="3.4" fill="var(--foreground)" />
      <circle cx="94" cy="77" r="3.4" fill="var(--foreground)" />
      <circle cx="67" cy="75.8" r="1.1" fill="var(--card)" />
      <circle cx="95" cy="75.8" r="1.1" fill="var(--card)" />
      <path d="M69 98c6-5.5 16-5.5 22 0" stroke="var(--foreground)" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="56" cy="88" r="5" fill="var(--destructive)" opacity="0.22" />
      <circle cx="104" cy="88" r="5" fill="var(--destructive)" opacity="0.22" />

      {/* 땀방울 · 당황 표시 */}
      <path
        d="M120 48c4 5.5 6 8.5 6 11.5a6 6 0 0 1-12 0c0-3 2-6 6-11.5Z"
        fill="var(--home-strong)"
        opacity="0.75"
        className="illo-float"
      />
      <path d="M28 52l8 5M24 66h9M30 80l7-3" style={{ stroke: LINE }} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}
