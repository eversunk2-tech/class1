"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { EyeIcon, EyeOffIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ReportButton } from "@/components/community/report-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import {
  authorName,
  COMMENT_COLUMNS,
  communityErrorMessage,
  LIMITS,
  loginHrefHere,
  type CommunityComment,
} from "@/lib/community";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";

async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select(COMMENT_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommunityComment[];
}

/**
 * 커뮤니티 댓글(CommentSection 패턴). 본문은 항상 텍스트로 렌더링한다(HTML 해석 없음).
 * 작성자: 수정·삭제 / 관리자: 숨김·삭제 / 로그인 사용자: 신고.
 */
export function CommunityCommentSection({
  postId,
  postHidden,
  isGame,
}: {
  postId: string;
  postHidden: boolean;
  isGame: boolean;
}) {
  const { loading: sessionLoading, user, isAdmin } = useSession();
  const userId = user?.id ?? null;
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
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
  }, [postId, userId, sessionLoading, attempt]);

  const reload = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setFormError("댓글 내용을 입력해 주세요.");
      return;
    }
    if (text.length > LIMITS.comment) {
      setFormError(`댓글은 ${LIMITS.comment.toLocaleString()}자까지 쓸 수 있어요.`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const { data, error } = await supabase
      .from("community_comments")
      .insert({ post_id: postId, body: text })
      .select(COMMENT_COLUMNS)
      .single();
    setSubmitting(false);
    if (error) {
      setFormError(communityErrorMessage(error, "댓글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요."));
      return;
    }
    setComments((prev) => [...prev, data as unknown as CommunityComment]);
    setBody("");
  }

  async function onDelete(id: string) {
    const { data, error } = await supabase.from("community_comments").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      toast.error("댓글을 삭제하지 못했어요.");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    toast.success("댓글을 삭제했어요.");
  }

  async function onToggleHidden(c: CommunityComment) {
    const { error } = await supabase.rpc("set_community_comment_hidden", { p_id: c.id, p_hidden: !c.hidden });
    if (error) {
      toast.error(communityErrorMessage(error, "댓글 숨김을 바꾸지 못했어요."));
      return;
    }
    setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, hidden: !c.hidden } : x)));
    toast.success(c.hidden ? "댓글을 다시 보이게 했어요." : "댓글을 숨겼어요.");
  }

  async function onEdit(c: CommunityComment, next: string): Promise<boolean> {
    const text = next.trim();
    if (!text || text.length > LIMITS.comment) {
      toast.error(`댓글은 1~${LIMITS.comment.toLocaleString()}자로 써 주세요.`);
      return false;
    }
    const { data, error } = await supabase
      .from("community_comments")
      .update({ body: text })
      .eq("id", c.id)
      .select(COMMENT_COLUMNS)
      .maybeSingle();
    if (error || !data) {
      toast.error(communityErrorMessage(error, "댓글을 고치지 못했어요."));
      return false;
    }
    setComments((prev) => prev.map((x) => (x.id === c.id ? (data as unknown as CommunityComment) : x)));
    return true;
  }

  return (
    <section aria-labelledby="comments-heading" className="flex flex-col gap-5">
      <h2 id="comments-heading" className="text-lg font-semibold">
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
        <ErrorState message="댓글을 불러오지 못했어요." onRetry={reload} />
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">첫 댓글을 남겨 보세요.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isMine={!!userId && userId === c.user_id}
              isAdmin={isAdmin}
              loggedIn={!!userId}
              isGame={isGame}
              onDelete={() => onDelete(c.id)}
              onToggleHidden={() => onToggleHidden(c)}
              onEdit={(next) => onEdit(c, next)}
            />
          ))}
        </ul>
      )}

      {sessionLoading ? null : !user ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          댓글을 남기려면{" "}
          <Link href={loginHrefHere()} className="font-medium text-foreground underline underline-offset-4">
            로그인
          </Link>
          이 필요해요.
        </div>
      ) : postHidden ? (
        <p className="text-sm text-muted-foreground">숨긴 글에는 댓글을 달 수 없어요.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <label htmlFor="comment-body" className="sr-only">
            댓글 작성
          </label>
          <Textarea
            id="comment-body"
            placeholder="친구가 기분 좋아지는 댓글을 남겨 주세요"
            value={body}
            maxLength={LIMITS.comment}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
            className="min-h-24"
          />
          <div className="flex items-center justify-between gap-3">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : (
              <span className="text-xs text-muted-foreground">
                {body.length.toLocaleString()} / {LIMITS.comment.toLocaleString()}
              </span>
            )}
            <Button type="submit" className="h-9 px-4" disabled={submitting || !body.trim()}>
              {submitting ? <Loader2Icon className="animate-spin" /> : null}
              등록
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function CommentItem({
  comment: c,
  isMine,
  isAdmin,
  loggedIn,
  isGame,
  onDelete,
  onToggleHidden,
  onEdit,
}: {
  comment: CommunityComment;
  isMine: boolean;
  isAdmin: boolean;
  loggedIn: boolean;
  isGame: boolean;
  onDelete: () => Promise<void>;
  onToggleHidden: () => Promise<void>;
  onEdit: (next: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const name = authorName(c);

  return (
    <li className="flex gap-3">
      <Avatar size="sm" className="mt-0.5">
        {c.profiles?.avatar_url ? <AvatarImage src={c.profiles.avatar_url} alt="" /> : null}
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-medium text-foreground">{name}</span>
          <time dateTime={c.created_at} className="text-muted-foreground">
            {formatDateTime(c.created_at)}
          </time>
          {c.hidden ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <EyeOffIcon className="size-3" aria-hidden />
              숨김
            </Badge>
          ) : null}
          <span className="ml-auto flex items-center gap-0.5">
            {isMine && !editing ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label="댓글 고치기"
                title="고치기"
                onClick={() => {
                  setDraft(c.body);
                  setEditing(true);
                }}
              >
                <PencilIcon />
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label={c.hidden ? "댓글 다시 보이기" : "댓글 숨기기"}
                title={c.hidden ? "다시 보이기" : "숨기기"}
                onClick={() => void onToggleHidden()}
              >
                {c.hidden ? <EyeIcon /> : <EyeOffIcon />}
              </Button>
            ) : null}
            {loggedIn && !isMine ? <ReportButton postId={c.post_id} commentId={c.id} targetLabel="댓글" isGame={isGame} compact /> : null}
            {isMine || isAdmin ? <DeleteCommentButton onConfirm={onDelete} /> : null}
          </span>
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`edit-${c.id}`} className="sr-only">
              댓글 고치기
            </label>
            <Textarea
              id={`edit-${c.id}`}
              value={draft}
              maxLength={LIMITS.comment}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-20"
              disabled={busy}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={busy}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={busy || !draft.trim()}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onEdit(draft);
                  setBusy(false);
                  if (ok) setEditing(false);
                }}
              >
                {busy ? <Loader2Icon className="animate-spin" /> : null}
                저장
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6 break-words whitespace-pre-wrap">{c.body}</p>
        )}
      </div>
    </li>
  );
}

function DeleteCommentButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="댓글 삭제" title="삭제" />}
      >
        <Trash2Icon />
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>댓글을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>삭제한 댓글은 되돌릴 수 없어요.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
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
