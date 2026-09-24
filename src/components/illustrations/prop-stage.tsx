import type { CSSProperties, ReactNode } from "react";
import { Icon3D, type Icon3DName } from "@/components/illustrations/icon-3d";
import { cn } from "@/lib/utils";

/**
 * 히어로 오른쪽 "무대": 가운데 큰 그림(마스코트·큰 3D 아이콘) + 뒤쪽 빛 + 발밑 빛 원판 + 둥실 떠다니는 3D 소품.
 * 홈 히어로(개정 2)와 같은 표현을 과학수업·게시판·학습게임 히어로에서 다시 쓰려고 뺀 공용 조각(디자인 개편 2단계).
 * - 소품은 모두 장식(alt="", aria-hidden, width/height). 히어로와 함께 보이므로 eager(각 5~9KB).
 * - 움직임은 transform만(globals.css `.prop-float`), prefers-reduced-motion이면 멈춘다.
 * - `always`가 아닌 소품은 좁은 히어로(@2xl 미만: 휴대폰·태블릿 세로)에서 숨겨 2~3개만 남긴다.
 */
export type StageProp = {
  name: Icon3DName;
  /** width/height 속성(px) */
  size: number;
  /** 무대 안 위치·크기(Tailwind, 가장 가까운 @container 기준) */
  className: string;
  tilt: number;
  dur: number;
  delay: number;
  always?: boolean;
};

export function PropStage({
  props,
  className,
  children,
}: {
  props: StageProp[];
  /** 무대 크기(너비·비율) */
  className?: string;
  /** 가운데 큰 그림 */
  children: ReactNode;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {/* 그림 뒤 큰 빛(밝은 모드는 흰 빛, 다크는 보라 빛) */}
      <span
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--card)_88%,transparent),transparent)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_26%,transparent),transparent)]"
        aria-hidden
      />
      {/* 발밑 보라 빛 원판 */}
      <span
        className="absolute bottom-[2%] left-1/2 h-[14%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_38%,transparent),transparent)]"
        aria-hidden
      />
      {props.map((p) => (
        <span
          key={p.name}
          className={cn("prop-float absolute", p.className, !p.always && "hidden @2xl:block")}
          style={{ "--tilt": `${p.tilt}deg`, "--dur": `${p.dur}s`, "--delay": `${p.delay}s` } as CSSProperties}
          aria-hidden
        >
          <Icon3D
            name={p.name}
            size={p.size}
            loading="eager"
            className="h-auto w-full drop-shadow-[0_8px_10px_oklch(0.3_0.1_288/0.2)]"
          />
        </span>
      ))}
      {children}
    </div>
  );
}

/** 무대 가운데 큰 3D 아이콘(게시판·학습게임 히어로): 둥실 떠 있고 부드러운 그림자 */
export function StageIcon({ name, size = 176, className }: { name: Icon3DName; size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "mascot-float absolute inset-[16%] grid place-items-center drop-shadow-[0_22px_26px_oklch(0.35_0.12_288/0.28)] dark:drop-shadow-[0_0_26px_oklch(0.75_0.15_288/0.35)]",
        className,
      )}
    >
      <Icon3D name={name} size={size} loading="eager" className="h-auto w-full" />
    </div>
  );
}
