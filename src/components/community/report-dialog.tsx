"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FlagIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { communityErrorMessage, LIMITS, loginHrefHere } from "@/lib/community";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type ReportReason = "spam" | "abuse" | "inappropriate" | "privacy" | "broken" | "other";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "광고·도배",
  abuse: "욕설·놀림·괴롭힘",
  inappropriate: "어울리지 않는 내용",
  privacy: "개인정보가 보여요",
  broken: "게임이 이상하게 동작해요",
  other: "기타",
};

/**
 * 신고하기(spec §13). 글·게임·댓글 공용. 같은 사람이 같은 대상을 두 번 신고하면 DB unique 제약(23505)으로 막힌다.
 * 신고 내용은 관리자와 신고자 본인만 볼 수 있다(RLS).
 */
export function ReportButton({
  postId,
  commentId,
  targetLabel,
  isGame = false,
  compact = false,
}: {
  postId: string;
  commentId?: string;
  /** "글" · "게임" · "댓글" */
  targetLabel: string;
  isGame?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = (Object.keys(REPORT_REASON_LABELS) as ReportReason[]).filter((r) => r !== "broken" || isGame);

  function onOpen() {
    if (!user) {
      router.push(loginHrefHere());
      return;
    }
    setReason(null);
    setDetail("");
    setError(null);
    setOpen(true);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason) {
      setError("신고 이유를 골라 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("community_reports").insert({
      post_id: postId,
      comment_id: commentId ?? null,
      reason,
      detail: detail.trim().slice(0, LIMITS.reportDetail),
    });
    setBusy(false);
    if (err) {
      if (err.code === "23505") {
        setOpen(false);
        toast.info(`이미 신고한 ${targetLabel}이에요. 선생님이 확인할 거예요.`);
        return;
      }
      // INSERT 정책 거부: 이미 숨겨졌거나 지워진 대상, 또는 내 글·댓글
      if (err.code === "42501" || (err.message ?? "").toLowerCase().includes("row-level security")) {
        setError(`신고할 수 없는 ${targetLabel}이에요. 이미 숨겨졌거나 지워졌을 수 있어요.`);
        return;
      }
      setError(communityErrorMessage(err, "신고하지 못했어요. 잠시 후 다시 시도해 주세요."));
      return;
    }
    setOpen(false);
    toast.success("신고했어요. 선생님이 확인할 거예요.");
  }

  return (
    <>
      <Button
        variant="ghost"
        size={compact ? "icon-xs" : "sm"}
        className={compact ? "rounded-full text-muted-foreground" : "rounded-full px-3 text-muted-foreground"}
        onClick={onOpen}
        aria-label={`${targetLabel} 신고하기`}
        title="신고하기"
      >
        <FlagIcon />
        {compact ? null : "신고"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{targetLabel} 신고하기</DialogTitle>
              <DialogDescription>신고 내용은 선생님과 나만 볼 수 있어요.</DialogDescription>
            </DialogHeader>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">어떤 문제인가요?</legend>
              {reasons.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                    reason === r ? "border-foreground/40 bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-4 accent-foreground"
                  />
                  {REPORT_REASON_LABELS[r]}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-detail">자세한 내용 (선택)</Label>
              <Textarea
                id="report-detail"
                value={detail}
                maxLength={LIMITS.reportDetail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="무엇이 문제인지 적어 주면 선생님이 빨리 확인할 수 있어요."
                className="min-h-20"
              />
              <span className="text-right text-xs text-muted-foreground">
                {detail.length} / {LIMITS.reportDetail}
              </span>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                취소
              </Button>
              <Button type="submit" disabled={busy || !reason}>
                {busy ? <Loader2Icon className="animate-spin" /> : null}
                신고하기
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
