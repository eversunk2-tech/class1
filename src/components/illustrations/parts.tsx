import type { SVGProps } from "react";

/**
 * 일러스트 공용 조각.
 * 색은 전부 CSS 변수(var(--*-soft|strong), var(--card), var(--foreground))를 써서 다크모드에 자동 대응한다.
 */

export type IllustrationProps = SVGProps<SVGSVGElement>;

/** 모든 일러스트가 공유하는 <svg> 기본 속성(장식용이므로 보조기기에서 숨긴다). */
export const ILLUSTRATION_SVG_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  "aria-hidden": true,
  focusable: false,
} as const;

/** 네 갈래 반짝이 */
export function Sparkle({
  x,
  y,
  size = 6,
  fill,
  className,
}: {
  x: number;
  y: number;
  size?: number;
  fill: string;
  className?: string;
}) {
  const s = size;
  const k = s * 0.22;
  return (
    <path
      className={className}
      fill={fill}
      d={`M${x} ${y - s}C${x + k} ${y - k} ${x + k} ${y - k} ${x + s} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + s}C${x - k} ${y + k} ${x - k} ${y + k} ${x - s} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - s}Z`}
    />
  );
}

/** 통통한 다섯 꼭지 별(모서리를 둥글게 보이도록 같은 색 stroke를 두른다) */
export function Star({
  x,
  y,
  r,
  fill,
  rotate = 0,
  className,
}: {
  x: number;
  y: number;
  r: number;
  fill: string;
  rotate?: number;
  className?: string;
}) {
  const inner = r * 0.52;
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2 + (rotate * Math.PI) / 180;
    return `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
  return (
    <polygon
      className={className}
      points={points}
      fill={fill}
      stroke={fill}
      strokeWidth={r * 0.28}
      strokeLinejoin="round"
    />
  );
}

/** 웃는 얼굴(눈 두 개 + 입 + 볼터치). cx, cy는 두 눈 사이 가운데. */
export function SmileFace({
  cx,
  cy,
  gap = 10,
  eye = 2.4,
  cheek = "var(--games-strong)",
  color = "var(--foreground)",
}: {
  cx: number;
  cy: number;
  gap?: number;
  eye?: number;
  cheek?: string;
  color?: string;
}) {
  const w = gap * 0.6;
  return (
    <g>
      <circle cx={cx - gap} cy={cy} r={eye} fill={color} />
      <circle cx={cx + gap} cy={cy} r={eye} fill={color} />
      <path
        d={`M${cx - w} ${cy + eye * 2.2}c${w * 0.5} ${w * 0.75} ${w * 1.5} ${w * 0.75} ${w * 2} 0`}
        stroke={color}
        strokeWidth={eye * 0.85}
        strokeLinecap="round"
      />
      <circle cx={cx - gap - eye * 1.6} cy={cy + eye * 2.4} r={eye * 1.15} fill={cheek} opacity="0.4" />
      <circle cx={cx + gap + eye * 1.6} cy={cy + eye * 2.4} r={eye * 1.15} fill={cheek} opacity="0.4" />
    </g>
  );
}
