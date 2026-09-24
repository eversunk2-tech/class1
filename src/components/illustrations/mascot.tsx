import { useId } from "react";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * 우리 반 마스코트 "부엉이 과학자"(public/illustrations/mascot/, 투명 배경 WebP).
 * - wave: 홈 히어로(인사) · tablet: 과학수업 히어로 · think: 빈 화면·오류 안내 · cheer: 완료·축하
 *   (spec 개정 1. 1단계에서는 wave만 쓴다.)
 * - 장식용 그림이라 alt="" + aria-hidden. 화면의 뜻은 제목·설명 글자가 전한다.
 * - `priority`: 첫 화면(LCP 후보)에만 켠다 → loading="eager" + fetchpriority="high". 나머지는 lazy.
 * - 흰 배경을 지워 만든 그림이라 가장자리에 흰 테두리가 1~2px 남아 어두운 바탕에서 보인다.
 *   이미지 파일은 그대로 두고, 표시할 때 SVG 필터로 알파 가장자리를 1px 깎아(erode) 가린다.
 */
export type MascotPose = "wave" | "tablet" | "think" | "cheer";

/** 원본 픽셀 크기(가로·세로). 표시 폭에서 세로를 계산해 width/height 속성으로 자리를 잡는다. */
const MASCOT_PIXELS: Record<MascotPose, readonly [number, number]> = {
  wave: [605, 640],
  tablet: [431, 640],
  think: [483, 640],
  cheer: [640, 604],
};

export function Mascot({
  pose,
  width,
  priority = false,
  className,
}: {
  pose: MascotPose;
  /** 기본 표시 폭(px). 실제 폭은 className으로 반응형 조절 가능(비율은 유지). */
  width: number;
  priority?: boolean;
  className?: string;
}) {
  const filterId = `mascot-edge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [pw, ph] = MASCOT_PIXELS[pose];
  const height = Math.round((width * ph) / pw);
  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <filter id={filterId} colorInterpolationFilters="sRGB">
          {/* 알파를 1px 깎고 살짝 흐려 가장자리를 부드럽게 한 뒤, 원래 그림을 그 모양으로 오려 낸다. */}
          <feMorphology in="SourceAlpha" operator="erode" radius="1" result="eroded" />
          <feGaussianBlur in="eroded" stdDeviation="0.4" result="soft" />
          <feComposite in="SourceGraphic" in2="soft" operator="in" />
        </filter>
      </svg>
      {/* 정적 export(images.unoptimized)라 <img>를 직접 쓰고 basePath를 수동으로 붙인다(CLAUDE.md). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBasePath(`/illustrations/mascot/owl-${pose}.webp`)}
        width={width}
        height={height}
        alt=""
        aria-hidden
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        draggable={false}
        style={{ filter: `url(#${filterId})` }}
        className={cn("pointer-events-none h-auto select-none", className)}
      />
    </>
  );
}
