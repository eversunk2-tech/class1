/**
 * 알약 버튼 모양(디자인 개편 1·2단계, spec §1.3). <Link>·<a>에는 그대로, shadcn <Button>에는 className으로 덧붙인다.
 * - primary: 화면에서 가장 중요한 버튼 1~2개(보라 그라데이션 + 색 그림자, 올리면 살짝 떠오름, 흰 글자 5.6:1 이상)
 * - outline: 보조 버튼(흰 알약)
 * Tailwind v4는 translate를 별도 속성으로 움직이므로 transition에 translate를 적는다.
 */
const PILL_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap outline-none transition-[translate,box-shadow,background-color] duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 [&_svg]:shrink-0";

export const primaryPillClass = `${PILL_BASE} h-11 px-5 text-sm bg-grad-primary text-primary-foreground shadow-(--shadow-brand) hover:shadow-[0_16px_30px_-10px_color-mix(in_oklch,var(--primary)_55%,transparent)]`;

export const outlinePillClass = `${PILL_BASE} h-11 px-5 text-sm bg-card text-foreground ring-1 ring-foreground/10 shadow-(--shadow-sm) hover:bg-muted/70 dark:shadow-none`;

/** "← 목록" 같은 작은 돌아가기 링크(흰 반투명 알약) */
export const backPillClass =
  "inline-flex w-fit items-center gap-1.5 rounded-full bg-card/80 px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-(--shadow-sm) ring-1 ring-foreground/5 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/60 dark:bg-card/60 dark:shadow-none dark:ring-foreground/10";
