import type { ComponentType, SVGProps } from "react";
import { FlaskConicalIcon, Gamepad2Icon, HouseIcon, RulerIcon, type LucideIcon } from "lucide-react";
import { GameIllustration } from "@/components/illustrations/game-illustration";
import { HomeIllustration } from "@/components/illustrations/home-illustration";
import { MathIllustration } from "@/components/illustrations/math-illustration";
import { ScienceIllustration } from "@/components/illustrations/science-illustration";

/**
 * 사이드바 · 모바일 드로어 · 홈 대시보드 바로가기 카드가 함께 읽는 메뉴 정의 (spec §3).
 *
 * 새 메뉴 추가 방법
 * 1. 아래 `menuItems` 배열에 항목을 추가한다.
 *    (아이콘은 lucide-react에서, 일러스트는 src/components/illustrations/ 에 새로 그린다)
 * 2. src/app/{경로}/page.tsx 를 만든다. 정적 export이므로 동적 세그먼트([slug])는 쓰지 않는다.
 * 3. 새 accent 색이 필요하면 globals.css에 --{color}-soft / --{color}-strong (light·dark)과
 *    @theme inline 매핑을 추가하고, src/lib/menu-colors.ts의 고정 클래스 매핑에도 항목을 추가한다.
 * 사이드바와 대시보드 카드는 이 배열을 순회할 뿐이라 따로 고칠 필요가 없다.
 */
export type MenuColor = "home" | "games" | "science" | "math";

export type MenuItem = {
  /** 고유 key */
  id: string;
  /** 사이드바/카드 표시 이름 */
  label: string;
  /** next/link용 경로. basePath는 자동으로 붙는다. trailingSlash 설정에 맞춰 "/"로 끝낸다. */
  href: string;
  /** 사이드바용 작은 아이콘 */
  icon: LucideIcon;
  /** 대시보드 바로가기 카드 · 화면 히어로용 큰 일러스트 */
  illustration: ComponentType<SVGProps<SVGSVGElement>>;
  /** globals.css의 {color}-soft / {color}-strong 토큰과 짝을 이룬다. */
  color: MenuColor;
  /** 대시보드 카드 한 줄 설명 */
  description: string;
};

export const menuItems: MenuItem[] = [
  {
    id: "home",
    label: "홈",
    href: "/",
    icon: HouseIcon,
    illustration: HomeIllustration,
    color: "home",
    description: "우리 반 소식을 한눈에 봐요",
  },
  {
    id: "games",
    label: "학습게임활동",
    href: "/games/",
    icon: Gamepad2Icon,
    illustration: GameIllustration,
    color: "games",
    description: "직접 만든 게임을 해봐요",
  },
  {
    id: "science",
    label: "과학수업",
    href: "/science/",
    icon: FlaskConicalIcon,
    illustration: ScienceIllustration,
    color: "science",
    description: "과학 시간에 배운 것들",
  },
  {
    id: "math",
    label: "수학수업",
    href: "/math/",
    icon: RulerIcon,
    illustration: MathIllustration,
    color: "math",
    description: "수학 시간에 배운 것들",
  },
];

/**
 * 현재 경로가 메뉴 항목과 일치하는지 판별한다.
 * usePathname()은 basePath(/class1)가 제거된 경로를 돌려주므로 href와 그대로 비교한다.
 * "/"는 정확히 일치할 때만 활성화해 다른 라우트에 걸치지 않게 한다.
 */
export function isMenuActive(item: MenuItem, pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (item.href === "/") return path === "/";
  return path === item.href || path.startsWith(item.href);
}
