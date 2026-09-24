"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2Icon, SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { ErrorState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { isWithdrawnProfile, profileDisplayName } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { primaryPillClass } from "@/lib/pill";
import { dangerSolidClass } from "@/lib/danger-button";
import { supabase } from "@/lib/supabase";
import { AUTHOR_PROFILE_COLUMNS, type CommentWithAuthor } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;
const COMMENT_COLUMNS = `id,body,created_at,user_id,profiles(${AUTHOR_PROFILE_COLUMNS})`;

async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentWithAuthor[];
}

export function CommentSection({ postId, published }: { postId: string; published: boolean }) {
  const { loading: sessionLoading, user, isAdmin } = useSession();
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      setComments(await fetchComments(postId));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [postId]);

  useEffect(() => {
    let active = true;
    fetchComments(postId)
      .then((list) => {
        if (!active) return;
        setComments(list);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [postId]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setFormError("댓글 내용을 입력해 주세요.");
      return;
    }
    if (text.length > MAX_LENGTH) {
      setFormError(`댓글은 ${MAX_LENGTH.toLocaleString()}자까지 쓸 수 있습니다.`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, body: text })
      .select(COMMENT_COLUMNS)
      .single();
    setSubmitting(false);
    if (error) {
      setFormError("댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setComments((prev) => [...prev, data as unknown as CommentWithAuthor]);
    setBody("");
  }

  async function onDelete(id: string) {
    // RLS가 0건으로 조용히 막는 경우도 실패로 본다.
    const { data, error } = await supabase.from("comments").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      toast.error("댓글을 삭제하지 못했습니다.");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    toast.success("댓글을 삭제했습니다.");
  }

  return (
    // 흰 둥근 판 안에 댓글 목록 + 입력(디자인 개편 2단계, 자유게시판 댓글과 같은 모양)
    <section
      aria-labelledby="comments-heading"
      className="flex flex-col gap-5 rounded-[2rem] bg-card p-5 shadow-(--shadow-md) ring-1 ring-foreground/5 sm:p-7 dark:shadow-none dark:ring-foreground/10"
    >
      <h2 id="comments-heading" className="flex items-center gap-2 font-heading text-xl font-normal">
        <Icon3D name="speech-balloon" size={28} className="size-7" />
        댓글 {status === "ready" ? <span className="text-muted-foreground">{comments.length}</span> : null}
      </h2>

      {status === "loading" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <ErrorState message="댓글을 불러오지 못했습니다." onRetry={reload} />
      ) : comments.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.map((c) => {
            const name = profileDisplayName(c.profiles, "익명");
            const canDelete = !!user && (user.id === c.user_id || isAdmin);
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar size="sm" className="mt-1">
                  {c.profiles?.avatar_url && !isWithdrawnProfile(c.profiles) ? (
                    <AvatarImage src={c.profiles.avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">{name}</span>
                    <time dateTime={c.created_at} className="text-muted-foreground">
                      {formatDateTime(c.created_at)}
                    </time>
                    {canDelete ? <DeleteCommentButton onConfirm={() => onDelete(c.id)} /> : null}
                  </div>
                  <p className="w-fit max-w-full rounded-2xl rounded-tl-md bg-muted/60 px-4 py-2.5 text-sm leading-6 break-words whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sessionLoading ? null : !user ? (
        <div className="rounded-2xl border-2 border-dashed border-primary/15 bg-primary/5 px-4 py-5 text-center text-sm text-muted-foreground">
          댓글을 남기려면{" "}
          <Link href="/login/" className="font-semibold text-primary underline underline-offset-4">
            로그인
          </Link>
          이 필요합니다.
        </div>
      ) : !published ? (
        <p className="text-sm text-muted-foreground">비공개 글에는 댓글을 달 수 없습니다.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor="comment-body" className="sr-only">
            댓글 작성
          </label>
          <Textarea
            id="comment-body"
            placeholder="댓글을 입력하세요"
            value={body}
            maxLength={MAX_LENGTH}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
            className="min-h-24 rounded-2xl"
          />
          <div className="flex items-center justify-between gap-3">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : (
              <span className="text-xs text-muted-foreground">
                {body.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
              </span>
            )}
            <Button type="submit" className={cn(primaryPillClass, "h-10")} disabled={submitting || !body.trim()}>
              {submitting ? <Loader2Icon className="animate-spin" /> : <SendIcon className="size-4" />}
              등록
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function DeleteCommentButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-xs" className="ml-auto text-muted-foreground" aria-label="댓글 삭제" />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>댓글을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>삭제한 댓글은 되돌릴 수 없습니다.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className={dangerSolidClass}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              setOpen(false);
            }}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
