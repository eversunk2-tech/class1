import type { ComponentType, ReactNode, SVGProps } from "react";
import type { MenuColor } from "@/data/menu";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/**
 * 화면 맨 위 히어로 패널(홈 · 학습게임활동 · 과학수업 · 자유게시판 공용).
 * 파스텔 soft 배경 위에 제목(Jua)과 큰 일러스트를 놓는다. 글자는 항상 foreground 계열을 쓴다.
 */
export function PageHero({
  color,
  eyebrow,
  title,
  description,
  illustration: Illustration,
  children,
}: {
  color: MenuColor;
  /** 제목 위 작은 꼬리표(선택) */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  illustration: ComponentType<SVGProps<SVGSVGElement>>;
  children?: ReactNode;
}) {
  const colors = menuColorClasses[color];
  return (
    // 가로 배치 여부는 화면 폭이 아니라 패널 자신의 폭(@container)으로 정한다.
    // 사이드바가 펼쳐진 태블릿(본문 약 480px)에서 제목이 일러스트에 눌려 잘리는 것을 막기 위해서다.
    <div className="@container">
      <section
        className={cn(
          "relative flex flex-col-reverse items-center gap-2 overflow-hidden rounded-3xl border px-6 py-6 text-center @2xl:flex-row @2xl:justify-between @2xl:gap-6 @2xl:px-10 @2xl:py-8 @2xl:text-left",
          colors.softBg,
          colors.border,
        )}
      >
        <div className="flex min-w-0 flex-col items-center gap-2 @2xl:items-start">
          {eyebrow ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", colors.strongBg)} aria-hidden />
              {eyebrow}
            </span>
          ) : null}
          <h1 className="font-heading text-3xl leading-tight font-normal @2xl:text-4xl">{title}</h1>
          {/* soft 배경 위에서는 muted-foreground의 대비가 4.5:1에 못 미치므로(라이트 약 4.0:1) foreground를 옅게 쓴다. */}
          {description ? <p className="max-w-prose text-sm text-foreground/75 @2xl:text-base">{description}</p> : null}
          {children}
        </div>
        <Illustration className="h-36 w-48 shrink-0 @2xl:h-44 @2xl:w-60" />
      </section>
    </div>
  );
}
