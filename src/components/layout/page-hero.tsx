import type { ComponentType, ReactNode, SVGProps } from "react";
import type { MenuColor } from "@/data/menu";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/**
 * 화면 맨 위 히어로 패널(홈 · 학습게임활동 · 과학수업 · 자유게시판 공용).
 * 파스텔 배경 위에 제목(제목 글꼴, G마켓 산스)과 큰 그림을 놓는다. 글자는 항상 foreground 계열을 쓴다.
 *
 * 기본값(`variant="soft"`, `size="default"`)은 지금까지의 모양 그대로다(디자인 개편 2단계에서 다른 화면을 옮긴다).
 * - `variant="gradient"`: 메뉴색 그라데이션 + 넉넉한 여백 + 큰 그림자(redesign spec §1.2·§1.4·§1.6)
 * - `size="display"`: 홈 히어로 전용 Display 제목(36px → 48px, spec §1.5)
 * - `media`: SVG 일러스트 대신 넣을 그림(예: 마스코트). `illustration`과 둘 중 하나만 준다.
 */
export function PageHero({
  color,
  eyebrow,
  title,
  description,
  illustration: Illustration,
  media,
  variant = "soft",
  size = "default",
  children,
}: {
  color: MenuColor;
  /** 제목 위 작은 꼬리표(선택) */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  illustration?: ComponentType<SVGProps<SVGSVGElement>>;
  media?: ReactNode;
  variant?: "soft" | "gradient";
  size?: "default" | "display";
  children?: ReactNode;
}) {
  const colors = menuColorClasses[color];
  const gradient = variant === "gradient";
  return (
    // 가로 배치 여부는 화면 폭이 아니라 패널 자신의 폭(@container)으로 정한다.
    // 사이드바가 펼쳐진 태블릿(본문 약 480px)에서 제목이 일러스트에 눌려 잘리는 것을 막기 위해서다.
    <div className="@container">
      <section
        className={cn(
          "relative isolate flex flex-col-reverse items-center overflow-hidden border text-center @2xl:flex-row @2xl:justify-between @2xl:text-left",
          gradient
            ? cn(
                "gap-4 rounded-[2rem] px-6 pt-6 pb-8 shadow-(--shadow-lg) @2xl:gap-8 @2xl:py-9 @2xl:pr-8 @2xl:pl-10 dark:shadow-none",
                colors.gradientBg,
              )
            : cn("gap-2 rounded-3xl px-6 py-6 @2xl:gap-6 @2xl:px-10 @2xl:py-8", colors.softBg),
          colors.border,
        )}
      >
        {gradient ? (
          // 그라데이션 위 흰 빛 번짐 2개(다크에서는 아래쪽이 은은한 보라 빛). 장식이라 가장자리에만 둔다.
          <>
            <span
              className="pointer-events-none absolute -top-24 -right-16 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--card)_70%,transparent),transparent)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--card)_22%,transparent),transparent)]"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute -bottom-28 -left-20 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--card)_55%,transparent),transparent)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
              aria-hidden
            />
          </>
        ) : null}
        <div className={cn("flex min-w-0 flex-col items-center @2xl:items-start", gradient ? "gap-3" : "gap-2")}>
          {eyebrow ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground",
                gradient && "px-3.5 py-1.5 shadow-(--shadow-sm) dark:shadow-none",
              )}
            >
              <span className={cn("size-1.5 rounded-full", colors.strongBg)} aria-hidden />
              {eyebrow}
            </span>
          ) : null}
          <h1
            className={cn(
              "font-heading leading-tight font-normal",
              size === "display" ? "text-4xl @2xl:text-5xl @2xl:leading-[1.15]" : "text-3xl @2xl:text-4xl",
            )}
          >
            {title}
          </h1>
          {/* 파스텔 배경 위에서는 muted-foreground의 대비가 4.5:1에 못 미치므로 foreground를 옅게 쓴다. */}
          {description ? (
            <p
              className={cn(
                "max-w-prose text-foreground/75",
                size === "display" ? "text-base leading-relaxed @2xl:text-lg" : "text-sm @2xl:text-base",
              )}
            >
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {media ?? (Illustration ? <Illustration className="h-36 w-48 shrink-0 @2xl:h-44 @2xl:w-60" /> : null)}
      </section>
    </div>
  );
}
