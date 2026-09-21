import type { ReactNode } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  /** 제목 위에 놓는 장식 일러스트(선택). 예: <EmptyBoxIllustration className="size-32" /> */
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {illustration}
      <p className="font-medium">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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
        "flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      {illustration ?? <AlertCircleIcon className="size-5 text-destructive" aria-hidden />}
      <p className="text-sm">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
