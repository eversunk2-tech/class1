"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon, LogInIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { CommunityDetailSkeleton } from "@/components/community/community-post-detail";
import { CommunitySetupNotice } from "@/components/community/community-setup-notice";
import { GameUploadField, type PickedGameFile } from "@/components/community/game-upload-field";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { NativeSelect } from "@/components/learning/learning-ui";
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBoardAccess } from "@/hooks/use-board-access";
import { useSession } from "@/hooks/use-session";
import { UUID_RE } from "@/lib/admin";
import {
  boardLabel,
  boardListHref,
  forgetBoardAccess,
  noBoardNotice,
  type Board,
} from "@/lib/boards";
import {
  communityErrorMessage,
  communityPostHref,
  fetchCommunityPost,
  GameFileError,
  isSetupMissing,
  KIND_META,
  LIMITS,
  loginHrefHere,
  removeGameFile,
  uploadGameHtml,
  type CommunityKind,
  type CommunityPost,
} from "@/lib/community";
import { backPillClass, outlinePillClass, primaryPillClass } from "@/lib/pill";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** 새 글 · 새 게임 작성 화면(로그인 필요) */
export function CommunityNewPost({ kind }: { kind: CommunityKind }) {
  const { loading, user } = useSession();
  if (loading) return <CommunityDetailSkeleton />;
  if (!user) return <LoginNeeded kind={kind} />;
  if (kind === "board") return <BoardNewPost userId={user.id} />;
  return <CommunityPostForm kind={kind} userId={user.id} post={null} />;
}

/** 새 글을 올릴 게시판(담임교사별 자유게시판 — docs/community/teacher-boards/spec.md 개정 1) */
type BoardChoice = {
  /** 처음 고른 게시판(주인 id) */
  initial: string;
  /** 교사에게 게시판이 둘 이상일 때만 고르기 목록. 학생·게시판 하나면 null(고르기 없이 그 게시판에 자동으로) */
  choices: Board[] | null;
};

/**
 * 새 자유게시판 글. 어느 게시판에 올릴지는 my_boards()로 정한다:
 * - 학생: 자기 학급의 먼저 맡은 담임 게시판 — **고르기·입력칸 없이 자동**(DB도 그 값만 받는다)
 * - 교사: 게시판이 둘 이상이면 폼 위에 "게시판" 고르기(목록에서 고른 게시판 `?board=`를 미리 고름)
 * - 학급 없는 계정: 폼 대신 "아직 배정된 담임 선생님이 없어요"(교사는 "아직 맡은 학급이 없어요" — 개정 2)
 * - SQL 적용 전(my_boards() 없음): 예전 폼 그대로(게시판 주인을 보내지 않는다)
 */
function BoardNewPost({ userId }: { userId: string }) {
  const { isAdmin, profileStatus } = useSession();
  const access = useBoardAccess();
  const searchParams = useSearchParams();
  const wanted = searchParams.get("board");
  if (access.status === "error") {
    return <ErrorState className="my-10" message="게시판 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." onRetry={access.retry} />;
  }
  // 교사 여부(고르기를 보일지)를 알고 나서 폼을 그린다 — 폼은 처음 고른 게시판을 한 번만 받는다.
  if (access.status !== "ready" || profileStatus === "loading") return <CommunityDetailSkeleton />;
  if (access.access.mode === "legacy") return <CommunityPostForm kind="board" userId={userId} post={null} />;
  const boards = access.access.boards;
  if (!boards.length) return <NoBoard isAdmin={isAdmin} />;
  const pickable = isAdmin && boards.length > 1;
  const initial = (pickable ? boards.find((b) => b.ownerId === wanted) : undefined) ?? boards[0];
  return (
    <CommunityPostForm
      kind="board"
      userId={userId}
      post={null}
      board={{ initial: initial.ownerId, choices: pickable ? boards : null }}
    />
  );
}

type EditState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "setup" }
  | { status: "error" }
  | { status: "ready"; post: CommunityPost };

/** 수정 화면(`?id=`). 작성자 본인 또는 관리자만. 실제 권한은 RLS가 판단한다. */
export function CommunityEditPost({ kind }: { kind: CommunityKind }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("id")?.trim() ?? "";
  const id = UUID_RE.test(raw) ? raw : "";
  const { loading, user, isAdmin, profileStatus } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ key: string; value: EditState }>({ key: "", value: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);
  const key = `${id}|${userId ?? ""}|${attempt}`;

  useEffect(() => {
    if (!id || loading || !userId) return;
    let active = true;
    fetchCommunityPost(id)
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
  }, [id, kind, key, loading, userId]);

  if (loading) return <CommunityDetailSkeleton />;
  if (!user) return <LoginNeeded kind={kind} />;
  if (!id) return <NotFound kind={kind} />;
  const current = state.key === key ? state.value : ({ status: "loading" } as EditState);
  if (current.status === "not-found") return <NotFound kind={kind} />;
  if (current.status === "setup") return <CommunitySetupNotice className="my-6" />;
  if (current.status === "error") return <ErrorState message="불러오지 못했어요." onRetry={() => setAttempt((n) => n + 1)} />;
  if (current.status !== "ready") return <CommunityDetailSkeleton />;
  const post = current.post;
  if (post.author_id !== user.id && !isAdmin) {
    // 관리자 여부를 아직 확인 중이면 기다린다.
    if (profileStatus === "loading") return <CommunityDetailSkeleton />;
    return (
      <EmptyState
        className="my-10"
        title="고칠 수 없어요"
        description="내가 쓴 글만 고칠 수 있어요."
        action={
          <Button variant="outline" render={<Link href={communityPostHref(kind, post.id)} />} nativeButton={false}>
            돌아가기
          </Button>
        }
      />
    );
  }
  return <CommunityPostForm kind={kind} userId={user.id} post={post} />;
}

/** 게시판 쓰기가 권한으로 거부됐을 때(학급·담임이 바뀌어 그 게시판에 더는 쓸 수 없음) */
const BOARD_REJECTED_MESSAGE =
  "이 게시판에는 글을 쓸 수 없어요. 학급이나 담임 선생님이 바뀌었을 수 있어요. 새로고침한 뒤 다시 시도해 주세요.";

function isRlsRejection(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null | undefined;
  return e?.code === "42501" || (e?.message ?? "").toLowerCase().includes("row-level security");
}

function CommunityPostForm({
  kind,
  userId,
  post,
  board,
}: {
  kind: CommunityKind;
  userId: string;
  post: CommunityPost | null;
  /** 새 자유게시판 글을 올릴 게시판(담임교사별 게시판). 없으면 게시판 주인을 보내지 않는다(고치기 · 학습게임 · SQL 적용 전). */
  board?: BoardChoice;
}) {
  const router = useRouter();
  const meta = KIND_META[kind];
  const isGame = kind === "game";
  const bodyLimit = isGame ? LIMITS.gameBody : LIMITS.boardBody;
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [file, setFile] = useState<PickedGameFile | null>(null);
  const [boardOwner, setBoardOwner] = useState<string | null>(board?.initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 게시판을 고르는 교사는 고른 게시판 목록으로 돌아간다(?board=). 학생·게시판 하나는 예전처럼 /board/.
  const cancelHref = post ? communityPostHref(kind, post.id) : board?.choices ? boardListHref(boardOwner) : meta.listHref;
  // 게임 파일은 작성자 폴더에만 둘 수 있다(DB 트리거도 강제). 관리자가 남의 게임을 고칠 때는 제목·설명만 바꾼다.
  const fileLocked = isGame && !!post && post.author_id !== userId;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t) return setError("제목을 입력해 주세요.");
    if (t.length > LIMITS.title) return setError(`제목은 ${LIMITS.title}자까지 쓸 수 있어요.`);
    if (!isGame && !b) return setError("내용을 입력해 주세요.");
    if (b.length > bodyLimit) return setError(`${isGame ? "설명" : "내용"}은 ${bodyLimit.toLocaleString()}자까지 쓸 수 있어요.`);
    if (isGame && !post && !file) return setError("게임 파일(.html)을 골라 주세요.");

    setBusy(true);
    setError(null);
    let uploaded: { path: string; size: number } | null = null;
    try {
      if (isGame && file && !fileLocked) uploaded = await uploadGameHtml(userId, file.html);

      if (!post) {
        const row: Record<string, unknown> = { kind, title: t, body: b };
        // 자유게시판: 이 글의 게시판(담임) — 학생은 자기 담임 게시판이 자동으로 들어간다(DB가 그 값만 받는다)
        if (board && boardOwner) row.board_owner = boardOwner;
        if (uploaded) {
          row.game_path = uploaded.path;
          row.game_size = uploaded.size;
        }
        const { data, error: err } = await supabase.from("community_posts").insert(row).select("id").single();
        if (err || !data) throw err ?? new Error("insert failed");
        toast.success(isGame ? "게임을 올렸어요!" : "글을 올렸어요!");
        router.replace(communityPostHref(kind, (data as { id: string }).id));
        return;
      }

      const patch: Record<string, unknown> = { title: t, body: b };
      if (uploaded) {
        patch.game_path = uploaded.path;
        patch.game_size = uploaded.size;
      }
      const { data, error: err } = await supabase.from("community_posts").update(patch).eq("id", post.id).select("id");
      if (err || !data?.length) throw err ?? new Error("update failed");
      // 파일을 바꿨으면 옛 파일을 지운다(새 경로에 올려 캐시된 옛 버전이 남지 않게).
      if (uploaded && post.game_path && post.game_path !== uploaded.path) await removeGameFile(post.game_path);
      toast.success("고쳤어요.");
      router.replace(communityPostHref(kind, post.id));
    } catch (err) {
      if (uploaded) await removeGameFile(uploaded.path);
      // 새 게시판 글이 권한으로 거부되면 게시판 목록을 다시 읽게 한다(학급·담임이 바뀌었을 수 있다).
      const boardRejected = !post && !!board && isRlsRejection(err);
      if (boardRejected) forgetBoardAccess();
      setError(
        err instanceof GameFileError
          ? err.message
          : boardRejected
            ? BOARD_REJECTED_MESSAGE
            : communityErrorMessage(err, post ? "고치지 못했어요. 잠시 후 다시 시도해 주세요." : "올리지 못했어요. 잠시 후 다시 시도해 주세요."),
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Link href={cancelHref} className={backPillClass}>
        <ArrowLeftIcon className="size-4" aria-hidden />
        {post ? "돌아가기" : `${meta.label} 목록`}
      </Link>
      <h1 className="flex items-center gap-3 font-heading text-3xl font-normal">
        <span
          className={cn("grid size-13 shrink-0 place-items-center rounded-2xl", isGame ? "bg-grad-games" : "bg-grad-board")}
          aria-hidden
        >
          <Icon3D name={isGame ? "video-game" : "speech-balloon"} size={36} className="size-9" />
        </span>
        {post ? `${meta.noun} 고치기` : isGame ? "게임 올리기" : "글쓰기"}
      </h1>

      {/* 입력칸을 흰 둥근 판에 모은다(디자인 개편 2단계) */}
      <div className="flex flex-col gap-6 rounded-[2rem] bg-card p-5 shadow-(--shadow-md) ring-1 ring-foreground/5 sm:p-8 dark:shadow-none dark:ring-foreground/10">

      {board?.choices ? (
        // 교사에게 게시판이 둘 이상일 때만(자기 게시판 + 보조로 맡은 학급의 게시판) — 학생 화면에는 없다
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="community-board">
            게시판<span className="text-destructive"> *</span>
          </Label>
          <NativeSelect
            id="community-board"
            value={boardOwner ?? ""}
            onChange={(e) => setBoardOwner(e.target.value)}
            disabled={busy}
            aria-describedby="community-board-help"
            className="h-11 rounded-xl px-3.5 text-base"
          >
            {board.choices.map((b) => (
              <option key={b.ownerId} value={b.ownerId}>
                {boardLabel(b)}
              </option>
            ))}
          </NativeSelect>
          <span id="community-board-help" className="text-xs text-muted-foreground">
            고른 게시판의 선생님과 학생들에게 보여요.
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="community-title">
          제목<span className="text-destructive"> *</span>
        </Label>
        <Input
          id="community-title"
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isGame ? "예) 산과 염기 퀴즈 게임" : "제목을 입력하세요"}
          className="h-11 rounded-xl px-3.5 text-base"
          disabled={busy}
          required
        />
        <span className="text-right text-xs text-muted-foreground">
          {title.length} / {LIMITS.title}
        </span>
      </div>

      {isGame ? (
        <GameUploadField
          value={file}
          onChange={setFile}
          disabled={busy}
          required={!post}
          currentName={post?.game_path ?? null}
          lockedMessage={
            fileLocked
              ? "다른 사람의 게임 파일은 바꿀 수 없어요. 제목과 설명만 고칠 수 있어요. 문제가 있는 게임은 숨기거나 삭제해 주세요."
              : null
          }
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="community-body">
          {isGame ? "게임 설명 (선택)" : "내용"}
          {isGame ? null : <span className="text-destructive"> *</span>}
        </Label>
        <Textarea
          id="community-body"
          value={body}
          maxLength={bodyLimit}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isGame ? "어떻게 하는 게임인지, 무엇을 배울 수 있는지 적어 주세요." : "내용을 입력하세요. **굵게**, - 목록 같은 마크다운을 쓸 수 있어요."}
          className={cn("rounded-2xl px-3.5 py-3 text-base", isGame ? "min-h-28" : "min-h-64")}
          disabled={busy}
        />
        <span className="text-right text-xs text-muted-foreground">
          {body.length.toLocaleString()} / {bodyLimit.toLocaleString()}
        </span>
      </div>

      <p className="rounded-2xl bg-muted/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
        친구를 놀리거나 개인정보(전화번호·주소 등)를 올리지 말아 주세요. 문제가 있는 {meta.noun}은 선생님이 숨기거나 지울 수 있어요.
      </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={outlinePillClass}>
          취소
        </Link>
        <Button type="submit" className={cn(primaryPillClass, "px-6")} disabled={busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {post ? "저장" : isGame ? "올리기" : "등록"}
        </Button>
      </div>
    </form>
  );
}

function LoginNeeded({ kind }: { kind: CommunityKind }) {
  const meta = KIND_META[kind];
  return (
    <EmptyState
      className="my-10"
      title="로그인이 필요해요"
      description={`${meta.noun}을 올리려면 먼저 로그인해 주세요.`}
      illustration={<EmptyOwl />}
      action={
        <Link href={loginHrefHere()} className={primaryPillClass}>
          <LogInIcon className="size-4.5" aria-hidden />
          로그인
        </Link>
      }
    />
  );
}

/** 학급이 없는 계정(쓸 수 있는 자유게시판이 없음) — 글쓰기 폼 대신. 교사는 학급 개설 안내 */
function NoBoard({ isAdmin }: { isAdmin: boolean }) {
  const notice = noBoardNotice(isAdmin);
  return (
    <EmptyState
      className="my-10"
      title={notice.title}
      description={notice.description}
      illustration={<EmptyOwl />}
      action={
        <Link href="/" className={outlinePillClass}>
          홈으로
        </Link>
      }
    />
  );
}

function NotFound({ kind }: { kind: CommunityKind }) {
  const meta = KIND_META[kind];
  return (
    <EmptyState
      className="my-10"
      title={`${meta.noun}을 찾을 수 없어요`}
      description="주소가 잘못되었거나 삭제되었을 수 있어요."
      illustration={<EmptyOwl />}
      action={
        <Link href={meta.listHref} className={outlinePillClass}>
          {meta.label} 목록으로
        </Link>
      }
    />
  );
}
