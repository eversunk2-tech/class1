import { WrenchIcon } from "lucide-react";
import { SETUP_REQUIRED_MESSAGE } from "@/lib/community";
import { cn } from "@/lib/utils";

/** 20260922040000_community.sql 실행 전(테이블·버킷 없음)에 화면 대신 보여 주는 "준비 중" 안내 */
export function CommunitySetupNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <WrenchIcon className="size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">준비 중이에요 (SQL 실행 필요)</p>
      <p className="max-w-md text-sm break-keep text-muted-foreground">{SETUP_REQUIRED_MESSAGE}</p>
    </div>
  );
}
