import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * 3D 아이콘(Microsoft Fluent Emoji 3D, MIT — public/illustrations/3d/LICENSE-fluent-emoji.txt).
 * 파일은 192px WebP. 메뉴 칩·카드·섹션 머리의 **장식**이라 항상 alt="" + aria-hidden이고,
 * 뜻은 옆의 글자 라벨이 전한다(docs/design/redesign/spec.md §3·§7).
 */
export type Icon3DName =
  | "house"
  | "video-game"
  | "test-tube"
  | "speech-balloon"
  | "newspaper"
  | "package"
  | "magnifying-glass"
  // 개정 2(더 화려하게)에서 추가된 소품
  | "star"
  | "sparkles"
  | "planet"
  | "rocket"
  | "light-bulb"
  | "atom"
  | "magnet"
  | "microscope";

export function Icon3D({
  name,
  size,
  className,
  loading = "lazy",
}: {
  name: Icon3DName;
  /** 표시 크기(px). width/height 속성으로 들어가 자리를 미리 잡는다(레이아웃 흔들림 방지). */
  size: number;
  className?: string;
  /** 기본 lazy. 첫 화면 히어로 소품처럼 함께 보여야 하는 작은 그림만 eager. */
  loading?: "lazy" | "eager";
}) {
  return (
    // 정적 export(images.unoptimized)라 next/image를 써도 최적화가 없으므로 <img>를 직접 쓴다.
    // basePath가 자동으로 붙지 않는 경로라 withBasePath()를 붙인다(CLAUDE.md).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={withBasePath(`/illustrations/3d/${name}.webp`)}
      width={size}
      height={size}
      alt=""
      aria-hidden
      loading={loading}
      decoding="async"
      draggable={false}
      className={cn("pointer-events-none shrink-0 select-none", className)}
    />
  );
}
