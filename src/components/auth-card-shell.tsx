import type { CSSProperties, ReactNode } from "react";
import { Icon3D, type Icon3DName } from "@/components/illustrations/icon-3d";
import { Mascot } from "@/components/illustrations/mascot";
import { cn } from "@/lib/utils";

/**
 * 로그인 · 새 비밀번호 화면의 가운데 카드 틀(디자인 개편 2단계).
 * 카드 위에 작은 장식이 걸쳐 있다: 로그인은 인사하는 부엉이(owl-wave), 비밀번호 화면은 3D 소품.
 * 장식은 모두 alt="" + aria-hidden. 폼·흐름·문구는 각 화면 컴포넌트가 그대로 가진다.
 */
type Decoration = "owl" | "props";

const PROPS: { name: Icon3DName; className: string; tilt: number; dur: number; delay: number }[] = [
  { name: "light-bulb", className: "left-[calc(50%-5.5rem)] top-6 w-12", tilt: -12, dur: 5, delay: -1 },
  { name: "star", className: "left-[calc(50%-1.75rem)] top-0 w-14", tilt: 8, dur: 5.6, delay: -2.2 },
  { name: "sparkles", className: "left-[calc(50%+2.5rem)] top-7 w-11", tilt: 14, dur: 4.4, delay: -0.4 },
];

export function AuthCardShell({ decoration, children }: { decoration: Decoration; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <div className="relative z-10 -mb-9 flex h-32 justify-center" aria-hidden>
        {decoration === "owl" ? (
          <div className="mascot-float relative w-28 self-end drop-shadow-[0_14px_18px_oklch(0.35_0.12_288/0.28)] dark:drop-shadow-[0_0_22px_oklch(0.75_0.15_288/0.4)]">
            <Mascot pose="wave" width={112} priority className="w-full" />
          </div>
        ) : (
          PROPS.map((p) => (
            <span
              key={p.name}
              className={cn("prop-float absolute", p.className)}
              style={{ "--tilt": `${p.tilt}deg`, "--dur": `${p.dur}s`, "--delay": `${p.delay}s` } as CSSProperties}
            >
              <Icon3D
                name={p.name}
                size={56}
                loading="eager"
                className="h-auto w-full drop-shadow-[0_8px_10px_oklch(0.3_0.1_288/0.22)]"
              />
            </span>
          ))
        )}
      </div>
      {children}
    </div>
  );
}

/** 카드 자체의 모양(Card에 className으로): 큰 둥근 모서리 + 부드러운 그림자, 위쪽은 장식이 걸칠 자리만큼 여백 */
export const authCardClass =
  "rounded-[2rem] pt-12 pb-7 shadow-(--shadow-lg) ring-foreground/5 [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)] dark:shadow-none dark:ring-foreground/10";

/** 입력칸 모양(Input에 className으로) */
export const authInputClass = "h-11 rounded-xl px-3.5 text-base";
