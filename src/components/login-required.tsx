"use client";

import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** 비로그인 사용자에게 "로그인이 필요합니다" 툴팁을 보여주는 래퍼 */
export function LoginRequiredTooltip({
  children,
  message = "로그인이 필요합니다",
}: {
  children: ReactElement;
  message?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{message}</TooltipContent>
    </Tooltip>
  );
}
