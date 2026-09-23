"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  Gamepad2Icon,
  Loader2Icon,
  MessageSquareIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { CommunitySetupNotice } from "@/components/community/community-setup-notice";
import { REPORT_REASON_LABELS, type ReportReason } from "@/components/community/report-dialog";
import { ListSkeleton } from "@/components/learning/learning-ui";
import { EmptyState, ErrorState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  authorName,
  communityErrorMessage,
  communityPostHref,
  isSetupMissing,
  KIND_META,
  removeGameFile,
  type CommunityKind,
} from "@/lib/community";
import { adminDisplayName } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ReportRow = {
  id: string;
  /** 대상이 지워지면 null(신고 기록은 남는다) */
  post_id: string | null;
  comment_id: string | null;
  /** 신고 시점 스냅샷 */
  target_kind: CommunityKind | "comment" | null;
  target_title: string | null;
  target_body: string | null;
  target_author: { display_name: string | null; withdrawn_at: string | null } | null;
  reason: ReportReason;
  detail: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
  profiles: { display_name: string | null; withdrawn_at: string | null } | null;
  community_posts: { id: string; kind: CommunityKind; title: string; hidden: boolean; game_path: string | null } | null;
  community_comments: { id: string; body: string; hidden: boolean } | null;
};

const REPORT_COLUMNS =
  "id,post_id,comment_id,reason,detail,status,created_at,resolved_at,target_kind,target_title,target_body," +
  "profiles!community_reports_reporter_id_fkey(display_name,withdrawn_at)," +
  "target_author:profiles!community_reports_target_author_id_fkey(display_name,withdrawn_at)," +
  "community_posts!community_reports_post_id_fkey(id,kind,title,hidden,game_path)," +
  "community_comments!community_reports_comment_id_fkey(id,body,hidden)";

type PostRow = {
  id: string;
  kind: CommunityKind;
  title: string;
  hidden: boolean;
  game_path: string | null;
  created_at: string;
  profiles: { display_name: string | null; withdrawn_at: string | null } | null;
  community_reports: { count: number }[] | null;
};

const ADMIN_POST_COLUMNS =
  "id,kind,title,hidden,game_path,created_at,profiles!community_posts_author_id_fkey(display_name,withdrawn_at)," +
  "community_reports!community_reports_post_id_fkey(count)";
const PAGE = 50;

type Load<T> = { status: "loading" } | { status: "setup" } | { status: "error" } | { status: "ready"; rows: T[]; hasMore: boolean };

type Target = { postId: string; commentId: string | null; kind: CommunityKind; title: string; gamePath: string | null };

/**
 * 관리자 커뮤니티 관리(spec §13): 신고 목록 + 글·게임 목록(숨김/삭제).
 * 숨김·신고 처리는 SECURITY DEFINER RPC(set_community_*), 삭제는 RLS delete 정책(관리자 허용)으로 처리한다.
 */
export function CommunityModeration() {
  const [tab, setTab] = useState<"reports" | "posts">("reports");
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="커뮤니티 관리"
        description="자유게시판·학습게임의 신고를 확인하고, 글·게임·댓글을 숨기거나 삭제합니다."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "reports" | "posts")}>
        <TabsList>
          <TabsTrigger value="reports">
            <FlagIcon />
            신고
          </TabsTrigger>
          <TabsTrigger value="posts">
            <MessageSquareIcon />
            글·게임
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "reports" ? <ReportsPanel /> : <PostsPanel />}
    </div>
  );
}

// ─────────────────────────────────────────────
// 신고 목록
// ─────────────────────────────────────────────

function ReportsPanel() {
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [state, setState] = useState<Load<ReportRow>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("community_reports")
      .select(REPORT_COLUMNS)
      .eq("status", filter)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setState({ status: isSetupMissing(error) ? "setup" : "error" });
        else setState({ status: "ready", rows: (data ?? []) as unknown as ReportRow[], hasMore: false });
      });
    return () => {
      active = false;
    };
  }, [filter, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  async function setStatus(row: ReportRow, status: "open" | "resolved") {
    setBusy(row.id);
    const { error } = await supabase.rpc("set_community_report_status", { p_id: row.id, p_status: status });
    setBusy(null);
    if (error) return toast.error(communityErrorMessage(error, "신고 상태를 바꾸지 못했습니다."));
    toast.success(status === "resolved" ? "처리 완료로 옮겼습니다." : "다시 열었습니다.");
    setState((s) => (s.status === "ready" ? { ...s, rows: s.rows.filter((r) => r.id !== row.id) } : s));
  }

  async function toggleTargetHidden(row: ReportRow) {
    if (!row.post_id) return;
    const isComment = !!row.comment_id;
    const hidden = isComment ? row.community_comments?.hidden : row.community_posts?.hidden;
    setBusy(row.id);
    const { error } = isComment
      ? await supabase.rpc("set_community_comment_hidden", { p_id: row.comment_id, p_hidden: !hidden })
      : await supabase.rpc("set_community_post_hidden", { p_id: row.post_id, p_hidden: !hidden });
    if (error) {
      setBusy(null);
      return toast.error(communityErrorMessage(error, "숨김 상태를 바꾸지 못했습니다."));
    }
    let resolved = 0;
    if (!hidden) {
      // 숨겼으면 같은 대상의 열린 신고를 한꺼번에 처리 완료로 옮긴다.
      const res = await supabase.rpc("resolve_community_reports_for", { p_post_id: row.post_id, p_comment_id: row.comment_id });
      if (!res.error && typeof res.data === "number") resolved = res.data;
    }
    setBusy(null);
    toast.success(hidden ? "다시 보이게 했습니다." : `숨겼습니다.${resolved ? ` 관련 신고 ${resolved}건을 처리 완료로 옮겼습니다.` : ""}`);
    reload();
  }

  if (state.status === "loading") return <ListSkeleton rows={3} label="신고를 불러오는 중" />;
  if (state.status === "setup") return <CommunitySetupNotice />;
  if (state.status === "error") return <ErrorState message="신고 목록을 불러오지 못했습니다." onRetry={reload} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="신고 상태">
        {(["open", "resolved"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={filter === f}
            onClick={() => {
              setState({ status: "loading" });
              setFilter(f);
            }}
          >
            {f === "open" ? "처리 전" : "처리 완료"}
          </Button>
        ))}
      </div>

      {!state.rows.length ? (
        <EmptyState title={filter === "open" ? "처리할 신고가 없습니다" : "처리 완료된 신고가 없습니다"} className="py-10" />
      ) : (
        <ul className="flex flex-col gap-3">
          {state.rows.map((r) => {
            const post = r.community_posts;
            const comment = r.community_comments;
            const kind: CommunityKind = post?.kind ?? (r.target_kind === "game" ? "game" : "board");
            const isComment = r.target_kind === "comment" || !!r.comment_id;
            const targetHidden = isComment ? comment?.hidden : post?.hidden;
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="destructive">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</Badge>
                  <Badge variant="outline">{isComment ? "댓글" : KIND_META[kind].noun}</Badge>
                  {targetHidden ? (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <EyeOffIcon className="size-3" aria-hidden />
                      숨김 중
                    </Badge>
                  ) : null}
                  <span className="text-muted-foreground">
                    신고: {adminDisplayName(r.profiles, "이름 없음")} · {formatDateTime(r.created_at)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 text-sm">
                  {post ? (
                    <Link href={communityPostHref(kind, post.id)} className="font-medium break-all underline-offset-4 hover:underline">
                      {post.title}
                    </Link>
                  ) : (
                    <span className="break-all text-muted-foreground">
                      (삭제된 {KIND_META[kind].noun}){!isComment && r.target_title ? ` ${r.target_title}` : ""}
                    </span>
                  )}
                  {isComment ? (
                    <p className="line-clamp-3 break-all whitespace-pre-wrap text-muted-foreground">
                      댓글: {comment?.body ?? (r.target_body != null ? `(삭제된 댓글) ${r.target_body}` : "(삭제된 댓글)")}
                    </p>
                  ) : !post && r.target_body ? (
                    <p className="line-clamp-3 break-all whitespace-pre-wrap text-muted-foreground">{r.target_body}</p>
                  ) : null}
                  {r.target_author ? (
                    <span className="text-xs text-muted-foreground">
                      작성자: {adminDisplayName(r.target_author, "이름 없음")}
                    </span>
                  ) : null}
                </div>
                {r.detail ? <p className="text-sm break-all whitespace-pre-wrap">“{r.detail}”</p> : null}
                <div className="flex flex-wrap gap-2">
                  {post && (!isComment || comment) ? (
                    <>
                      <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void toggleTargetHidden(r)}>
                        {targetHidden ? <EyeIcon /> : <EyeOffIcon />}
                        {targetHidden ? "대상 다시 보이기" : "대상 숨기기"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        disabled={busy === r.id}
                        onClick={() =>
                          setDeleting({ postId: post.id, commentId: r.comment_id, kind, title: isComment ? "댓글" : post.title, gamePath: post.game_path })
                        }
                      >
                        <Trash2Icon />
                        대상 삭제
                      </Button>
                    </>
                  ) : null}
                  {r.status === "open" ? (
                    <Button size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, "resolved")}>
                      {busy === r.id ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
                      처리 완료
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, "open")}>
                      <RotateCcwIcon />
                      다시 열기
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DeleteTargetDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </div>
  );
}

// ─────────────────────────────────────────────
// 글·게임 목록
// ─────────────────────────────────────────────

function PostsPanel() {
  const [kind, setKind] = useState<CommunityKind | "all">("all");
  const [state, setState] = useState<Load<PostRow>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (from: number) => {
      let q = supabase.from("community_posts").select(ADMIN_POST_COLUMNS);
      if (kind !== "all") q = q.eq("kind", kind);
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE - 1);
    },
    [kind],
  );

  useEffect(() => {
    let active = true;
    query(0).then(({ data, error }) => {
      if (!active) return;
      if (error) setState({ status: isSetupMissing(error) ? "setup" : "error" });
      else {
        const rows = (data ?? []) as unknown as PostRow[];
        setState({ status: "ready", rows, hasMore: rows.length === PAGE });
      }
    });
    return () => {
      active = false;
    };
  }, [query, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  async function loadMore() {
    if (state.status !== "ready") return;
    setLoadingMore(true);
    const { data, error } = await query(state.rows.length);
    setLoadingMore(false);
    if (error) return toast.error("더 불러오지 못했습니다.");
    const rows = (data ?? []) as unknown as PostRow[];
    setState((s) => {
      if (s.status !== "ready") return s;
      const known = new Set(s.rows.map((r) => r.id));
      return { ...s, rows: [...s.rows, ...rows.filter((r) => !known.has(r.id))], hasMore: rows.length === PAGE };
    });
  }

  async function toggleHidden(row: PostRow) {
    setBusy(row.id);
    const { error } = await supabase.rpc("set_community_post_hidden", { p_id: row.id, p_hidden: !row.hidden });
    setBusy(null);
    if (error) return toast.error(communityErrorMessage(error, "숨김 상태를 바꾸지 못했습니다."));
    setState((s) => (s.status === "ready" ? { ...s, rows: s.rows.map((r) => (r.id === row.id ? { ...r, hidden: !row.hidden } : r)) } : s));
    toast.success(row.hidden ? "다시 보이게 했습니다." : "숨겼습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="종류">
        {(["all", "board", "game"] as const).map((k) => (
          <Button
            key={k}
            variant={kind === k ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={kind === k}
            onClick={() => {
              setState({ status: "loading" });
              setKind(k);
            }}
          >
            {k === "all" ? "전체" : KIND_META[k].label}
          </Button>
        ))}
      </div>

      {state.status === "loading" ? (
        <ListSkeleton rows={4} label="글을 불러오는 중" />
      ) : state.status === "setup" ? (
        <CommunitySetupNotice />
      ) : state.status === "error" ? (
        <ErrorState message="글 목록을 불러오지 못했습니다." onRetry={reload} />
      ) : !state.rows.length ? (
        <EmptyState title="아직 올라온 글이 없습니다" className="py-10" />
      ) : (
        <ul className="divide-y rounded-xl ring-1 ring-foreground/10">
          {state.rows.map((r) => {
            const reports = r.community_reports?.[0]?.count ?? 0;
            return (
              <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {r.kind === "game" ? (
                      <Gamepad2Icon className="size-4 shrink-0 text-games-strong" aria-label="게임" />
                    ) : (
                      <MessageSquareIcon className="size-4 shrink-0 text-board-strong" aria-label="자유게시판 글" />
                    )}
                    <Link href={communityPostHref(r.kind, r.id)} className="truncate text-sm font-medium underline-offset-4 hover:underline">
                      {r.title}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{authorName(r)}</span>
                    <span>{formatDateTime(r.created_at)}</span>
                    {r.hidden ? (
                      <Badge variant="outline" className="gap-1">
                        <EyeOffIcon className="size-3" aria-hidden />
                        숨김
                      </Badge>
                    ) : null}
                    {reports ? (
                      <Badge variant="destructive" className="gap-1">
                        <FlagIcon className="size-3" aria-hidden />
                        신고 {reports}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => void toggleHidden(r)}>
                    {busy === r.id ? <Loader2Icon className="animate-spin" /> : r.hidden ? <EyeIcon /> : <EyeOffIcon />}
                    {r.hidden ? "보이기" : "숨기기"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleting({ postId: r.id, commentId: null, kind: r.kind, title: r.title, gamePath: r.game_path })}
                  >
                    <Trash2Icon />
                    삭제
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {state.status === "ready" && state.hasMore ? (
        <Button variant="outline" className="mx-auto h-9 px-4" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
        </Button>
      ) : null}

      <DeleteTargetDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </div>
  );
}

function DeleteTargetDialog({ target, onClose, onDeleted }: { target: Target | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const isComment = !!target?.commentId;

  async function onDelete() {
    if (!target) return;
    setBusy(true);
    // 신고 기록은 대상이 지워져도 남는다(스냅샷 보관). 지우기 전에 관련 열린 신고를 처리 완료로 옮긴다
    // (지운 뒤에는 post_id/comment_id가 비어 대상으로 찾을 수 없다). 글을 지우면 그 글의 댓글 신고도 함께 처리한다.
    await supabase.rpc("resolve_community_reports_for", {
      p_post_id: target.postId,
      p_comment_id: target.commentId,
      p_include_comments: !isComment,
    });
    const { data, error } = isComment
      ? await supabase.from("community_comments").delete().eq("id", target.commentId!).select("id")
      : await supabase.from("community_posts").delete().eq("id", target.postId).select("id");
    if (error || !data?.length) {
      setBusy(false);
      toast.error(communityErrorMessage(error, "삭제하지 못했습니다."));
      return;
    }
    if (!isComment) await removeGameFile(target.gamePath);
    setBusy(false);
    toast.success("삭제했습니다.");
    onClose();
    onDeleted();
  }

  return (
    <AlertDialog open={!!target} onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{isComment ? "댓글을 삭제할까요?" : `${target ? KIND_META[target.kind].noun : ""}을 삭제할까요?`}</AlertDialogTitle>
          <AlertDialogDescription className={cn("break-all")}>
            {isComment
              ? "이 댓글이 삭제되며 되돌릴 수 없습니다. 관련 신고는 처리 완료로 옮겨지고 기록은 남습니다."
              : `“${target?.title ?? ""}”과 댓글·좋아요가 모두 삭제되며 되돌릴 수 없습니다. 관련 신고는 처리 완료로 옮겨지고 기록은 남습니다.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={busy} onClick={onDelete}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
