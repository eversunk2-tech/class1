"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { CommentSection } from "@/components/comment-section";
import { LikeButton } from "@/components/like-button";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { editPostHref } from "@/components/post-card";
import { SITE_NAME } from "@/components/layout/topbar";
import { PostReadRecorder } from "@/components/post-read-recorder";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { TagList } from "@/components/tag-chip";
import { ViewCounter } from "@/components/view-counter";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { formatDate } from "@/lib/format";
import { outlinePillClass } from "@/lib/pill";
import { dangerSolidClass } from "@/lib/danger-button";
import { supabase } from "@/lib/supabase";
import type { Post } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; post: Post };

async function fetchPost(slug: string): Promise<Post | null> {
  // RLS: 비공개 글은 관리자에게만 반환되므로, 일반 사용자에겐 null(= 404 취급)
  const { data, error } = await supabase.from("posts").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Post | null) ?? null;
}

export function PostDetail() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug")?.trim() ?? "";
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>({ status: "loading" });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // slug 또는 로그인 사용자가 바뀌면 다시 조회(관리자 로그인 시 비공개 글 노출)
  const key = `${slug}|${userId ?? ""}`;
  const pending = !slug ? false : sessionLoading || loadedKey !== key;

  const load = useCallback(async (s: string, k: string) => {
    setState({ status: "loading" });
    try {
      const post = await fetchPost(s);
      setState(post ? { status: "ready", post } : { status: "not-found" });
    } catch {
      setState({ status: "error" });
    }
    setLoadedKey(k);
  }, []);

  useEffect(() => {
    if (!slug || sessionLoading) return;
    let active = true;
    fetchPost(slug)
      .then((post) => {
        if (active) setState(post ? { status: "ready", post } : { status: "not-found" });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      })
      .finally(() => {
        if (active) setLoadedKey(key);
      });
    return () => {
      active = false;
    };
  }, [slug, key, sessionLoading]);

  const title = state.status === "ready" ? state.post.title : null;
  useEffect(() => {
    if (title) document.title = `${title} | ${SITE_NAME}`;
  }, [title]);

  if (!slug || (!pending && state.status === "not-found")) return <PostNotFound />;
  if (pending && (state.status !== "ready" || state.post.slug !== slug)) return <PostDetailSkeleton />;
  if (state.status === "error") {
    return <ErrorState message="글을 불러오지 못했습니다." onRetry={() => load(slug, key)} />;
  }
  if (state.status !== "ready") return <PostDetailSkeleton />;

  return <PostView post={state.post} />;
}

function PostView({ post }: { post: Post }) {
  const { isAdmin } = useSession();
  const date = post.published_at ?? post.created_at;

  return (
    <article className="flex flex-col gap-6">
      {/* 제목·정보·본문을 흰 둥근 판에(디자인 개편 2단계): 연보라 배경 위에서도 본문 대비·가독성을 지킨다. */}
      <div className="flex flex-col gap-8 rounded-[2rem] bg-card p-5 shadow-(--shadow-md) ring-1 ring-foreground/5 sm:p-10 dark:shadow-none dark:ring-foreground/10">
        <header className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-home-soft py-1 pr-3 pl-1.5 text-xs font-semibold text-home-ink">
            <Icon3D name="newspaper" size={20} className="size-5" />
            선생님 글
          </span>
          {!post.published ? (
            <Badge variant="outline" className="w-fit">
              비공개 글 (관리자에게만 보임)
            </Badge>
          ) : null}
          <h1 className="font-heading text-3xl leading-tight font-normal break-keep sm:text-[2.5rem]">{post.title}</h1>
          {post.summary ? <p className="text-lg leading-relaxed text-muted-foreground">{post.summary}</p> : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <time dateTime={date}>{formatDate(date)}</time>
            <ViewCounter postId={post.id} slug={post.slug} published={post.published} />
            {/* 로그인 사용자의 읽기 기록(학습활동). 화면에는 아무것도 그리지 않는다. */}
            <PostReadRecorder postId={post.id} published={post.published} />
            {isAdmin ? <AdminActions post={post} /> : null}
          </div>
          <TagList tags={post.tags} />
          {post.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.cover_url} alt="" className="mt-2 w-full rounded-3xl bg-muted object-cover shadow-(--shadow-sm)" />
          ) : null}
        </header>

        <MarkdownViewer content={post.content_md} className="markdown-reading" />
      </div>

      <div className="flex justify-center">
        <LikeButton postId={post.id} published={post.published} />
      </div>

      <CommentSection postId={post.id} published={post.published} />
    </article>
  );
}

function AdminActions({ post }: { post: Post }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    // RLS가 0건으로 조용히 막는 경우도 실패로 본다.
    const { data, error } = await supabase.from("posts").delete().eq("id", post.id).select("id");
    setBusy(false);
    if (error || !data?.length) {
      toast.error("글을 삭제하지 못했습니다.");
      return;
    }
    setOpen(false);
    toast.success("글을 삭제했습니다.");
    router.replace("/");
  }

  return (
    <div className="ml-auto flex items-center gap-1">
      <Button variant="ghost" size="sm" className="rounded-full px-3" render={<Link href={editPostHref(post.slug)} />} nativeButton={false}>
        <PencilIcon />
        수정
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="rounded-full px-3 text-destructive" />}>
          <Trash2Icon />
          삭제
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              댓글·좋아요·조회수도 함께 삭제되며 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className={dangerSolidClass} disabled={busy} onClick={onDelete}>
              {busy ? <Loader2Icon className="animate-spin" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PostNotFound() {
  return (
    <EmptyState
      className="my-10"
      title="존재하지 않는 글입니다"
      description="주소가 잘못되었거나 삭제된 글일 수 있습니다."
      illustration={<EmptyOwl />}
      action={
        <Link href="/" className={outlinePillClass}>
          메인으로 이동
        </Link>
      }
    />
  );
}

export function PostDetailSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 rounded-[2rem] bg-card/70 p-5 ring-1 ring-foreground/5 sm:p-10 dark:ring-foreground/10"
      aria-busy="true"
      aria-label="글을 불러오는 중"
    >
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
