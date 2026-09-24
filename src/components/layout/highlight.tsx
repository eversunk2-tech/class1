import type { ReactNode } from "react";
import { Icon3D } from "@/components/illustrations/icon-3d";

/**
 * 큰 제목 속 핵심 낱말: 보라 그라데이션 글자 + 연노랑 형광펜 띠(홈 히어로와 같은 표현, 디자인 개편 2단계).
 * 큰 글씨 전용(대비: 라이트 5.2~5.4:1, 다크 4.8~4.9:1). 스크린리더에는 보통 글자로 읽힌다.
 */
export function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="relative isolate inline-block whitespace-nowrap">
      <span className="text-grad-primary">{children}</span>
      <span
        className="absolute inset-x-[-0.08em] bottom-[0.06em] -z-10 h-[0.38em] -rotate-1 rounded-full bg-(--highlight)"
        aria-hidden
      />
    </span>
  );
}

/** 섹션 제목: 앞에 작은 3D 반짝이 + 제목 글꼴(G마켓 산스, 홈 "어디로 가 볼까요?"와 같은 모양) */
export function SectionHeading({
  id,
  children,
  as: Tag = "h2",
  className,
}: {
  id?: string;
  children: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={
        className ?? "flex items-center gap-2 font-heading text-2xl leading-tight font-normal sm:text-[1.75rem]"
      }
    >
      <Icon3D name="sparkles" size={30} className="size-7 shrink-0 sm:size-7.5" />
      <span className="min-w-0">{children}</span>
    </Tag>
  );
}
