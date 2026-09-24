import type { ReactNode } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Mascot } from "@/components/illustrations/mascot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 빈 화면·안내 공용 그림: 생각하는 부엉이(owl-think, 장식). 옛 상자 그림(EmptyBoxIllustration)을 대신한다
 * (디자인 개편 2단계). 관리자 화면(4단계)에는 넣지 않았다 — EmptyState의 기본값은 여전히 "그림 없음".
 */
export function EmptyOwl({ className }: { className?: string }) {
  return <Mascot pose="think" width={112} className={cn("w-22 sm:w-26", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** 제목 위에 놓는 장식 그림(선택). 예: <EmptyOwl /> */
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/15 bg-card/60 px-6 py-12 text-center dark:bg-card/40",
        className,
      )}
    >
      {illustration}
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message = "데이터를 불러오지 못했습니다.",
  onRetry,
  illustration,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  /** 기본 경고 아이콘 대신 보여 줄 장식 일러스트(선택). 예: <ErrorFaceIllustration className="size-24" /> */
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      {illustration ?? <AlertCircleIcon className="size-5 text-destructive" aria-hidden />}
      <p className="text-sm">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="rounded-full px-3.5" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
