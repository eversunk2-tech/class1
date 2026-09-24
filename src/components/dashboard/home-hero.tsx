import type { CSSProperties } from "react";
import Link from "next/link";
import { FlaskConicalIcon, MessageCircleIcon } from "lucide-react";
import { Icon3D, type Icon3DName } from "@/components/illustrations/icon-3d";
import { Mascot } from "@/components/illustrations/mascot";
import { SITE_NAME } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

/**
 * 홈 첫 화면(디자인 개편 1단계 개정 2 "더 화려하게", docs/design/redesign/build-1b-instructions.md).
 * - 흰색 → 연보라(다크: 짙은 남보라) 배경 + 보라·분홍·하늘 빛 번짐(globals.css `bg-hero-home`)
 * - 큰 인사 부엉이 + 발밑 보라 빛 원판 + 둥실 떠다니는 3D 소품(좁은 화면에선 3개만)
 * - Display 제목, 핵심 낱말 "배움터"는 보라 그라데이션 글자 + 형광펜 밑줄, 버튼 2개
 * 움직임은 transform만 쓰고 prefers-reduced-motion이면 멈춘다(globals.css). 모든 그림은 장식(alt="").
 */

type FloatingProp = {
  name: Icon3DName;
  /** 원본 대비 표시 크기(px, width/height 속성용) */
  size: number;
  /** 무대 안 위치·크기(Tailwind 클래스, @container 기준으로 키움) */
  className: string;
  tilt: number;
  dur: number;
  delay: number;
  /** 좁은 히어로(휴대폰·태블릿 세로)에서도 보일지 — 2~3개만 */
  always?: boolean;
};

// 부엉이 그림의 투명한 모서리에 둔다(왼쪽 가운데: 시험관 든 날개, 오른쪽 위: 흔드는 날개 → 피함).
const FLOATING_PROPS: FloatingProp[] = [
  { name: "star", size: 64, className: "top-[0%] left-[0%] w-11 @4xl:w-16", tilt: -12, dur: 5.2, delay: -1, always: true },
  { name: "sparkles", size: 48, className: "top-[2%] right-[1%] w-9 @4xl:w-12", tilt: 10, dur: 4.2, delay: -2.2, always: true },
  { name: "planet", size: 72, className: "bottom-[6%] left-[-2%] w-12 @4xl:w-18", tilt: -10, dur: 6.6, delay: -0.4, always: true },
  { name: "rocket", size: 80, className: "bottom-[8%] right-[-3%] w-14 @4xl:w-20", tilt: 12, dur: 5.6, delay: -3 },
  { name: "light-bulb", size: 44, className: "top-[40%] left-[-4%] w-8 @4xl:w-11", tilt: -14, dur: 4.8, delay: -1.6 },
];

function HeroStage() {
  return (
    // 무대 크기는 히어로 폭(@container)으로: 휴대폰 15rem → 태블릿 가로 17rem → 데스크톱 27rem.
    // 부엉이가 무대 높이의 약 92%를 차지하고, 무대가 위아래 여백을 조금 먹어(-my-6) 히어로 높이의 약 85~90%가 된다.
    <div className="relative aspect-[26/25] w-[15rem] shrink-0 @2xl:-my-6 @2xl:w-[17rem] @4xl:w-[27rem]">
      {/* 부엉이 뒤 큰 빛(밝은 모드는 흰 빛, 다크는 보라 빛) */}
      <span
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--card)_90%,transparent),transparent)] dark:bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_28%,transparent),transparent)]"
        aria-hidden
      />
      {/* 발밑 보라 빛 원판 */}
      <span
        className="absolute bottom-[2%] left-1/2 h-[15%] w-[72%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_42%,transparent),transparent)]"
        aria-hidden
      />
      {FLOATING_PROPS.map((p) => (
        <span
          key={p.name}
          className={cn("prop-float absolute", p.className, !p.always && "hidden @2xl:block")}
          style={{ "--tilt": `${p.tilt}deg`, "--dur": `${p.dur}s`, "--delay": `${p.delay}s` } as CSSProperties}
          aria-hidden
        >
          <Icon3D
            name={p.name}
            size={p.size}
            className="h-auto w-full drop-shadow-[0_8px_10px_oklch(0.3_0.1_288/0.2)]"
          />
        </span>
      ))}
      {/* 그림자·빛은 바깥 틀에, 가장자리 다듬기 필터는 그림 자체에(filter가 겹치지 않게) */}
      <div className="mascot-float absolute inset-x-[8%] bottom-[2%] drop-shadow-[0_20px_24px_oklch(0.35_0.12_288/0.25)] dark:drop-shadow-[0_0_26px_oklch(0.75_0.15_288/0.4)]">
        <Mascot pose="wave" width={363} priority className="w-full" />
      </div>
    </div>
  );
}

// 사이트 이름의 마지막 낱말(예: "배움터")만 강조한다.
const SPLIT = SITE_NAME.lastIndexOf(" ");
const SITE_LEAD = SITE_NAME.slice(0, SPLIT);
const SITE_KEY = SITE_NAME.slice(SPLIT + 1);

/** 버튼 공통: 알약 + 올리면 살짝 떠오름 + 뚜렷한 초점 테두리 */
const PILL =
  "inline-flex h-13 items-center gap-2 rounded-full px-6 text-base font-semibold outline-none transition-[translate,box-shadow] duration-200 hover:-translate-y-1 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function HomeHero() {
  return (
    <div className="@container">
      <section
        aria-labelledby="home-hero-title"
        className="relative isolate flex flex-col-reverse items-center gap-5 overflow-hidden rounded-[2.25rem] border border-primary/10 bg-hero-home px-6 pt-6 pb-9 text-center shadow-[0_30px_60px_-32px_color-mix(in_oklch,var(--primary)_45%,transparent)] @2xl:flex-row @2xl:justify-between @2xl:gap-6 @2xl:py-10 @2xl:pr-6 @2xl:pl-10 @2xl:text-left dark:border-primary/20 dark:shadow-none"
      >
        <div className="flex min-w-0 flex-col items-center gap-4 @2xl:items-start">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-(--shadow-sm) ring-1 ring-primary/10 dark:shadow-none">
            <Icon3D name="sparkles" size={18} className="size-4.5" />
            오늘도 반가워요
          </span>
          <h1
            id="home-hero-title"
            className="font-heading text-[2.5rem] leading-[1.12] font-normal @2xl:text-5xl @4xl:text-6xl"
          >
            안녕하세요!
            <br />
            {SITE_LEAD}{" "}
            <span className="whitespace-nowrap">
              {/* 핵심 낱말: 보라 그라데이션 글자 + 연노랑 형광펜 띠(글자 뒤, 대비 4.6:1 이상) */}
              <span className="relative isolate inline-block">
                <span className="text-grad-primary">{SITE_KEY}</span>
                <span
                  className="absolute inset-x-[-0.08em] bottom-[0.06em] -z-10 h-[0.38em] -rotate-1 rounded-full bg-(--highlight)"
                  aria-hidden
                />
              </span>
              예요
            </span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-foreground/75 @2xl:text-lg">
            우리 반이 <strong className="font-semibold text-primary">함께</strong> 배우고 만든 것을 모아 둔 곳이에요. 궁금한
            메뉴를 눌러 구경해 봐요!
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3 @2xl:justify-start">
            {/* 화면에서 가장 중요한 버튼 하나만 보라 그라데이션(spec §1.3) */}
            <Link
              href="/science/"
              className={cn(
                PILL,
                "bg-grad-primary text-primary-foreground shadow-(--shadow-brand) hover:shadow-[0_18px_34px_-10px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
              )}
            >
              <FlaskConicalIcon className="size-5" aria-hidden />
              오늘의 과학 탐구 시작하기
            </Link>
            <Link
              href="/board/"
              className={cn(
                PILL,
                "bg-card text-foreground shadow-(--shadow-md) ring-1 ring-foreground/10 hover:shadow-(--shadow-lg) dark:shadow-none",
              )}
            >
              <MessageCircleIcon className="size-5 text-board-strong" aria-hidden />
              자유게시판 구경하기
            </Link>
          </div>
        </div>
        <HeroStage />
      </section>
    </div>
  );
}
