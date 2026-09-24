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
import { EmptyOwl, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { UUID_RE } from "@/lib/admin";
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
  return <CommunityPostForm kind={kind} userId={user.id} post={null} />;
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

function CommunityPostForm({ kind, userId, post }: { kind: CommunityKind; userId: string; post: CommunityPost | null }) {
  const router = useRouter();
  const meta = KIND_META[kind];
  const isGame = kind === "game";
  const bodyLimit = isGame ? LIMITS.gameBody : LIMITS.boardBody;
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [file, setFile] = useState<PickedGameFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelHref = post ? communityPostHref(kind, post.id) : meta.listHref;
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
      setError(
        err instanceof GameFileError
          ? err.message
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
