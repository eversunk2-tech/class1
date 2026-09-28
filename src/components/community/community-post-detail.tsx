"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { CommunityCommentSection } from "@/components/community/community-comment-section";
import { CommunityLikeButton } from "@/components/community/community-like-button";
import { CommunitySetupNotice } from "@/components/community/community-setup-notice";
import { GamePlayer } from "@/components/community/game-player";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { ReportButton } from "@/components/community/report-dialog";
import { SITE_NAME } from "@/components/layout/topbar";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
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
import { useBoardAccess } from "@/hooks/use-board-access";
import { useSession } from "@/hooks/use-session";
import { isWithdrawnProfile, UUID_RE } from "@/lib/admin";
import { boardLabel, boardListHref, teacherTitle } from "@/lib/boards";
import {
  authorName,
  communityEditHref,
  communityErrorMessage,
  downloadGameHtml,
  fetchCommunityPost,
  GameFileError,
  isSetupMissing,
  KIND_META,
  removeGameFile,
  type CommunityKind,
  type CommunityPost,
} from "@/lib/community";
import { formatDateTime } from "@/lib/format";
import { backPillClass, outlinePillClass } from "@/lib/pill";
import { dangerSolidClass } from "@/lib/danger-button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "setup" }
  | { status: "error" }
  | { status: "ready"; post: CommunityPost };

/**
 * 자유게시판 · 학습게임 상세(`?id=<uuid>`). 숨긴 글은 RLS가 작성자·관리자에게만 돌려준다.
 * 자유게시판은 담임교사별 게시판(docs/community/teacher-boards/spec.md 개정 1): 다른 게시판 글은 RLS가 돌려주지 않아
 * "찾을 수 없어요"가 된다. 보이지만 내가 참여하지 않는 게시판의 글(총괄의 관리용 보기 · 반을 옮긴 뒤 예전에 쓴 내 글)은
 * 댓글·좋아요 칸 대신 안내를 보인다(서버도 거부한다).
 */
export function CommunityPostDetail({ kind }: { kind: CommunityKind }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("id")?.trim() ?? "";
  const id = UUID_RE.test(raw) ? raw : "";
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const key = `${id}|${userId ?? ""}`;
  const [state, setState] = useState<{ key: string; value: State }>({ key: "", value: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id || sessionLoading) return;
    let active = true;
    fetchCommunityPost(id, { withBoard: kind === "board" })
      .then((post) => {
        if (!active) return;
        setState({ key, value: post && post.kind === kind ? { status: "ready", post } : { status: "not-found" } });
      })
      .catch((error: unknown) => {
        if (active) setState({ key, value: { status: isSetupMissing(error) ? "setup" : "error" } });
      });
    return () => {
      active = false;
    };
  }, [id, kind, key, sessionLoading, attempt]);

  const current = state.key === key ? state.value : ({ status: "loading" } as State);
  const title = current.status === "ready" ? current.post.title : null;
  useEffect(() => {
    if (title) document.title = `${title} | ${SITE_NAME}`;
  }, [title]);

  if (!id || current.status === "not-found") return <NotFound kind={kind} />;
  if (current.status === "setup") return <CommunitySetupNotice className="my-6" />;
  if (current.status === "error") {
    return (
      <ErrorState
        message="불러오지 못했어요."
        onRetry={() => {
          setState({ key: "", value: { status: "loading" } });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (current.status !== "ready") return <CommunityDetailSkeleton />;

  return (
    <PostView
      post={current.post}
      onChange={(post) => setState({ key, value: { status: "ready", post } })}
    />
  );
}

/** 게시판 주인(담임)의 이름 — 내 게시판 목록에 없는 게시판(총괄의 관리용 보기)을 표시할 때만 읽는다. undefined = 읽는 중 */
function useBoardOwnerName(ownerId: string | null): string | null | undefined {
  const [state, setState] = useState<{ id: string | null; name: string | null }>({ id: null, name: null });
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", ownerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        const name = !error ? ((data as { display_name: string | null } | null)?.display_name ?? null) : null;
        setState({ id: ownerId, name });
      });
    return () => {
      active = false;
    };
  }, [ownerId]);
  if (!ownerId) return null;
  return state.id === ownerId ? state.name : undefined;
}

function PostView({ post, onChange }: { post: CommunityPost; onChange: (p: CommunityPost) => void }) {
  const router = useRouter();
  const { user, isAdmin } = useSession();
  const isMine = !!user && user.id === post.author_id;
  const isGame = post.kind === "game";
  const meta = KIND_META[post.kind];
  const name = authorName(post);
  const edited = new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000;
  const [hiding, setHiding] = useState(false);

  // 담임교사별 게시판: 게시판 주인을 읽었을 때(SQL 적용 뒤)만 따진다. 적용 전·학습게임은 예전처럼 누구나 참여.
  const boardKnown = post.kind === "board" && post.board_owner !== undefined;
  const boardAccess = useBoardAccess(boardKnown);
  const myBoards = boardAccess.status === "ready" && boardAccess.access.mode === "boards" ? boardAccess.access.boards : null;
  const myBoard = myBoards?.find((b) => b.ownerId === post.board_owner) ?? null;
  // 이 글의 게시판에 댓글·좋아요를 남길 수 있나: null = 아직 모름(칸을 잠시 비움). 게시판 목록을 못 읽으면 막지 않는다(서버가 판단).
  const canParticipate: boolean | null = !boardKnown
    ? true
    : boardAccess.status === "ready"
      ? boardAccess.access.mode === "legacy" || !!myBoard
      : boardAccess.status === "error"
        ? true
        : null;
  // 관리용 보기 = 교사가 참여하지 않는 게시판의 남의 글을 볼 때(총괄은 모든 게시판을 관리한다)
  const managementView = boardKnown && canParticipate === false && isAdmin && !isMine;
  // 교사에게만 "어느 게시판 글인지" 표시: 게시판이 둘 이상이거나, 내 게시판이 아닌 글을 관리용으로 볼 때
  const showBoard = isAdmin && boardKnown && !!myBoards && (!myBoard || myBoards.length > 1);
  const otherOwnerName = useBoardOwnerName(showBoard && !myBoard && post.board_owner ? post.board_owner : null);
  const boardText = !showBoard
    ? null
    : myBoard
      ? boardLabel(myBoard)
      : !post.board_owner
        ? "주인 없는 게시판"
        : otherOwnerName === undefined
          ? null
          : `${teacherTitle(otherOwnerName)} 게시판`;
  // 목록으로: 관리용으로 연 글은 커뮤니티 관리로, 게시판 글은 그 게시판 목록(?board=)으로
  const listHref = managementView ? "/admin/community/" : boardKnown && post.board_owner ? boardListHref(post.board_owner) : meta.listHref;
  const listLabel = managementView ? "커뮤니티 관리" : `${meta.label} 목록`;
  const readOnlyNote = managementView
    ? "관리용으로 보는 글이에요. 이 게시판에는 댓글과 좋아요를 남길 수 없어요."
    : "지금 내가 참여하는 게시판의 글이 아니라서 댓글과 좋아요를 남길 수 없어요.";

  async function toggleHidden() {
    setHiding(true);
    const { error } = await supabase.rpc("set_community_post_hidden", { p_id: post.id, p_hidden: !post.hidden });
    setHiding(false);
    if (error) {
      toast.error(communityErrorMessage(error, "숨김 상태를 바꾸지 못했어요."));
      return;
    }
    onChange({ ...post, hidden: !post.hidden });
    toast.success(post.hidden ? "다시 보이게 했어요." : "숨겼어요. 작성자와 선생님만 볼 수 있어요.");
  }

  async function onDelete(): Promise<boolean> {
    const { data, error } = await supabase.from("community_posts").delete().eq("id", post.id).select("id");
    if (error || !data?.length) {
      toast.error(communityErrorMessage(error, "삭제하지 못했어요."));
      return false;
    }
    await removeGameFile(post.game_path);
    toast.success("삭제했어요.");
    router.replace(listHref);
    return true;
  }

  return (
    <article className="flex flex-col gap-6">
      <Link href={listHref} className={backPillClass}>
        <ArrowLeftIcon className="size-4" aria-hidden />
        {listLabel}
      </Link>

      {/* 제목·작성자·본문을 흰 둥근 판에(디자인 개편 2단계). 게임은 판 아래에 실행기를 둔다. */}
      <div className="flex flex-col gap-6 rounded-[2rem] bg-card p-5 shadow-(--shadow-md) ring-1 ring-foreground/5 sm:p-8 dark:shadow-none dark:ring-foreground/10">
        <header className="flex flex-col gap-4">
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-xs font-semibold",
              isGame ? "bg-games-soft text-games-ink" : "bg-board-soft text-board-ink",
            )}
          >
            <Icon3D name={isGame ? "video-game" : "speech-balloon"} size={20} className="size-5" />
            {meta.label}
            {boardText ? (
              <>
                <span aria-hidden>·</span>
                <span>{boardText}</span>
              </>
            ) : null}
          </span>
          {managementView ? (
            <Badge variant="outline" className="w-fit">
              관리용으로 보는 글
            </Badge>
          ) : null}
          {post.hidden ? (
            <Badge variant="outline" className="w-fit gap-1">
              <EyeOffIcon className="size-3" aria-hidden />
              숨긴 {meta.noun} (작성자와 선생님만 보여요)
            </Badge>
          ) : null}
          <h1 className="font-heading text-3xl leading-tight font-normal break-words break-keep sm:text-4xl">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Avatar size="sm">
                {post.profiles?.avatar_url && !isWithdrawnProfile(post.profiles) ? (
                  <AvatarImage src={post.profiles.avatar_url} alt="" />
                ) : null}
                <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{name}</span>
            </span>
            <time dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
            {edited ? <span>(수정됨)</span> : null}
            <div className="ml-auto flex flex-wrap items-center gap-1">
              {isMine || isAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-3"
                  render={<Link href={communityEditHref(post.kind, post.id)} />}
                  nativeButton={false}
                >
                  <PencilIcon />
                  수정
                </Button>
              ) : null}
              {isAdmin ? (
                <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={toggleHidden} disabled={hiding}>
                  {hiding ? <Loader2Icon className="animate-spin" /> : post.hidden ? <EyeIcon /> : <EyeOffIcon />}
                  {post.hidden ? "다시 보이기" : "숨기기"}
                </Button>
              ) : null}
              {isMine || isAdmin ? <DeletePostButton noun={meta.noun} onConfirm={onDelete} /> : null}
              {user && !isMine && !managementView ? <ReportButton postId={post.id} targetLabel={meta.noun} isGame={isGame} /> : null}
            </div>
          </div>
        </header>

        {isGame ? (
          post.body ? (
            <section aria-label="게임 설명" className="rounded-3xl bg-games-soft/60 p-4 sm:p-5 dark:bg-games-soft/40">
              <p className="text-[0.95rem] leading-7 break-words whitespace-pre-wrap">{post.body}</p>
            </section>
          ) : null
        ) : (
          <MarkdownViewer content={post.body} ugc className="markdown-reading" />
        )}
      </div>

      {isGame ? <GamePostPlayer path={post.game_path} title={post.title} /> : null}

      <div className="flex justify-center">
        <CommunityLikeButton postId={post.id} disabled={post.hidden || canParticipate !== true} />
      </div>

      <CommunityCommentSection
        postId={post.id}
        postHidden={post.hidden}
        isGame={isGame}
        canWrite={canParticipate}
        readOnlyNote={readOnlyNote}
        hideReport={managementView}
      />
    </article>
  );
}

/** Storage에서 게임 원문을 텍스트로 받아 sandbox 실행기에 넘긴다(공개 URL을 직접 쓰지 않음). */
function GamePostPlayer({ path, title }: { path: string | null; title: string }) {
  const [state, setState] = useState<{ path: string | null; html: string | null; error: string | null }>({
    path: null,
    html: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    downloadGameHtml(path)
      .then((html) => {
        if (active) setState({ path, html, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof GameFileError ? error.message : communityErrorMessage(error, "게임 파일을 불러오지 못했어요.");
        setState({ path, html: null, error: message });
      });
    return () => {
      active = false;
    };
  }, [path, attempt]);

  if (!path) return <ErrorState message="게임 파일이 없어요." />;
  if (state.path !== path || (!state.html && !state.error)) {
    return <Skeleton className="h-[40vh] min-h-[240px] w-full rounded-[2rem]" aria-label="게임을 불러오는 중" />;
  }
  if (state.error) {
    return (
      <ErrorState
        message={state.error}
        onRetry={() => {
          setState({ path: null, html: null, error: null });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <GamePlayer html={state.html!} title={title} />;
}

function DeletePostButton({ noun, onConfirm }: { noun: string; onConfirm: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="rounded-full px-3 text-destructive" />}>
        <Trash2Icon />
        삭제
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{noun}을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>댓글·좋아요도 함께 삭제되며 되돌릴 수 없어요.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className={dangerSolidClass}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm();
              setBusy(false);
              if (ok) setOpen(false);
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

function NotFound({ kind }: { kind: CommunityKind }) {
  const meta = KIND_META[kind];
  return (
    <EmptyState
      className="my-10"
      title={`${meta.noun}을 찾을 수 없어요`}
      description="주소가 잘못되었거나 삭제·숨김 처리되었을 수 있어요."
      illustration={<EmptyOwl />}
      action={
        <Link href={meta.listHref} className={outlinePillClass}>
          {meta.label} 목록으로
        </Link>
      }
    />
  );
}

export function CommunityDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-9 w-32 rounded-full" />
      <div className="flex flex-col gap-4 rounded-[2rem] bg-card/70 p-5 ring-1 ring-foreground/5 sm:p-8">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
