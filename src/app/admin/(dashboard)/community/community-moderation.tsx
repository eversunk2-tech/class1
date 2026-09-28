"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminSurfaceClass, dangerSolidClass } from "@/components/admin/admin-styles";
import { CommunitySetupNotice } from "@/components/community/community-setup-notice";
import { REPORT_REASON_LABELS, type ReportReason } from "@/components/community/report-dialog";
import { ListSkeleton, NativeSelect } from "@/components/learning/learning-ui";
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
import { useAdminContext } from "@/hooks/use-admin-context";
import { useBoardAccess } from "@/hooks/use-board-access";
import { boardLabel, teacherTitle, type Board } from "@/lib/boards";
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
  /**
   * 신고한 글(댓글 신고면 그 글)의 종류 · 게시판 주인 스냅샷(담임교사별 게시판, 20260928010000 — 적용 전에는 읽지 않아 undefined).
   * 종류가 null = 대상이 이미 지워진 옛 댓글 신고(게시판인지 모름 — 총괄만 봄).
   */
  target_post_kind?: CommunityKind | null;
  target_board_owner?: string | null;
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
/** 담임교사별 게시판 SQL 적용 뒤: 신고의 게시판 스냅샷도 읽는다(적용 전에 읽으면 42703 — 따로 둔다) */
const REPORT_COLUMNS_WITH_BOARD = `${REPORT_COLUMNS},target_post_kind,target_board_owner`;

type PostRow = {
  id: string;
  kind: CommunityKind;
  title: string;
  hidden: boolean;
  game_path: string | null;
  /** 자유게시판 글의 게시판 주인(담임교사별 게시판 — SQL 적용 전에는 읽지 않아 undefined) */
  board_owner?: string | null;
  created_at: string;
  profiles: { display_name: string | null; withdrawn_at: string | null } | null;
  community_reports: { count: number }[] | null;
};

const ADMIN_POST_COLUMNS =
  "id,kind,title,hidden,game_path,created_at,profiles!community_posts_author_id_fkey(display_name,withdrawn_at)," +
  "community_reports!community_reports_post_id_fkey(count)";
const ADMIN_POST_COLUMNS_WITH_BOARD = `${ADMIN_POST_COLUMNS},board_owner`;

/** 글 목록의 게시판 거르기 값: "all" = 모든 게시판, "none" = 주인 없는 글(총괄만), 그 밖 = 게시판 주인 id */
type BoardFilter = "all" | "none" | string;

const NO_BOARDS: Board[] = [];

type ClassTeacherRow = { class_id: string; teacher_id: string; created_at: string };

/**
 * 게시판이 있는 교사 = 학급마다 "먼저 맡은 지금 교사"(SQL class_board_owner 와 같은 규칙: created_at, 같으면 teacher_id 순 —
 * spec 개정 2). 보조로만 맡은 교사·학급 없는 교사는 게시판이 없다. created_at 은 PostgREST 가 같은 모양(같은 시간대)으로
 * 주므로 글자 비교로 순서를 정한다(Date.parse 는 마이크로초를 버리고 기기마다 다르게 읽을 수 있다).
 */
function classBoardOwnerIds(rows: readonly ClassTeacherRow[], teacherIds: ReadonlySet<string>): string[] {
  const first = new Map<string, ClassTeacherRow>();
  for (const r of rows) {
    if (!teacherIds.has(r.teacher_id)) continue; // 지금 교사(role 'admin')만
    const cur = first.get(r.class_id);
    if (!cur || r.created_at < cur.created_at || (r.created_at === cur.created_at && r.teacher_id < cur.teacher_id)) {
      first.set(r.class_id, r);
    }
  }
  return [...new Set([...first.values()].map((r) => r.teacher_id))];
}

/**
 * 담임교사별 게시판 표시(docs/community/teacher-boards/spec.md 개정 1) — 이 화면 전용.
 * - 누가 어떤 글·신고를 보는지는 RLS가 정한다: 담임 = 자기 게시판(보조 담임은 그 학급 게시판도) + 학습게임 전부,
 *   총괄 = 관리용으로 모든 게시판. 이 훅은 "어느 선생님 게시판인지" 이름표와 게시판 거르기만 만든다.
 * - 이름표는 총괄과 게시판이 둘 이상인 교사에게만(게시판이 하나면 모두 내 게시판이라 붙이지 않는다).
 * - 이름: 내 게시판 목록(my_boards) → 총괄은 교사 목록(profiles 공개 열: 이름·역할) → 그래도 없으면(담임 해제된 옛 주인) id로 읽는다.
 * - SQL 적용 전(my_boards() 없음 — "legacy")이면 예전 화면 그대로(게시판 열을 읽지 않음).
 */
function useBoardDirectory(ownerIds: readonly (string | null | undefined)[]) {
  const access = useBoardAccess();
  const ctx = useAdminContext();
  const superAdmin = ctx.status === "ready" && ctx.isSuperAdmin;
  const mode: "loading" | "legacy" | "boards" =
    access.status === "ready" ? (access.access.mode === "legacy" ? "legacy" : "boards") : access.status === "error" ? "legacy" : "loading";
  // 같은 사용자의 게시판 목록은 기억된 같은 배열이다(src/lib/boards.ts) — 매번 새 배열을 만들지 않는다.
  const myBoards: Board[] = access.status === "ready" && access.access.mode === "boards" ? access.access.boards : NO_BOARDS;
  const boardsMode = mode === "boards";
  const showLabels = boardsMode && (superAdmin || myBoards.length > 1);

  // 총괄: 모든 교사 이름(이름표) + 게시판이 있는 교사(학급마다 먼저 맡은 지금 교사 — 게시판 거르기 목록, 재확인 N1)
  const [teachers, setTeachers] = useState<{ id: string; name: string | null }[] | null>(null);
  const [boardOwnerIds, setBoardOwnerIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!boardsMode || !superAdmin) return;
    let active = true;
    Promise.all([
      supabase.from("profiles").select("id,display_name").eq("role", "admin").order("display_name"),
      supabase.from("class_teachers").select("class_id,teacher_id,created_at"),
    ]).then(
      ([t, ct]) => {
        if (!active) return;
        // 못 읽으면 빈 목록(이름은 아래에서 id로 다시 읽는다 — 이름표가 기다리다 멈추지 않게)
        const rows = !t.error ? ((t.data ?? []) as { id: string; display_name: string | null }[]) : [];
        setTeachers(rows.map((r) => ({ id: r.id, name: r.display_name })));
        // 학급 담임 줄을 못 읽으면 null → 거르기 목록은 예전처럼 교사 전체
        setBoardOwnerIds(
          !t.error && !ct.error ? classBoardOwnerIds((ct.data ?? []) as ClassTeacherRow[], new Set(rows.map((r) => r.id))) : null,
        );
      },
      () => {
        if (!active) return;
        setTeachers([]);
        setBoardOwnerIds(null);
      },
    );
    return () => {
      active = false;
    };
  }, [boardsMode, superAdmin]);

  // 목록에 나온 주인 중 이름을 모르는 사람(담임 해제된 옛 주인 등)은 id로 읽는다
  const [extraNames, setExtraNames] = useState<ReadonlyMap<string, string | null>>(() => new Map());
  const known = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const t of teachers ?? []) m.set(t.id, t.name);
    for (const b of myBoards) m.set(b.ownerId, b.teacherName);
    return m;
  }, [teachers, myBoards]);
  const missingKey = showLabels
    ? [...new Set(ownerIds.filter((id): id is string => !!id && !known.has(id) && !extraNames.has(id)))].sort().join(",")
    : "";
  useEffect(() => {
    if (!missingKey || (superAdmin && !teachers)) return; // 총괄은 교사 목록을 먼저 읽는다
    let active = true;
    const ids = missingKey.split(",");
    supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", ids)
      .then(({ data, error }) => {
        if (!active) return;
        const rows = !error ? ((data ?? []) as { id: string; display_name: string | null }[]) : [];
        setExtraNames((prev) => {
          const next = new Map(prev);
          for (const id of ids) next.set(id, rows.find((r) => r.id === id)?.display_name ?? null);
          return next;
        });
      });
    return () => {
      active = false;
    };
  }, [missingKey, superAdmin, teachers]);

  const labelOf = useCallback(
    (ownerId: string | null | undefined): string => {
      if (!ownerId) return "주인 없는 게시판";
      const mine = myBoards.find((b) => b.ownerId === ownerId);
      if (mine) return boardLabel(mine);
      return `${teacherTitle(known.get(ownerId) ?? extraNames.get(ownerId) ?? null)} 게시판`;
    },
    [myBoards, known, extraNames],
  );

  // 게시판 거르기 목록(총괄 = 게시판이 있는 교사 + 주인 없는 글, 게시판이 둘 이상인 교사 = 내 게시판들)
  const filterOptions: { value: BoardFilter; label: string }[] = useMemo(() => {
    if (!showLabels) return [];
    const base: { value: BoardFilter; label: string }[] = [{ value: "all", label: "모든 게시판" }];
    if (superAdmin) {
      const owners = boardOwnerIds ?? (teachers ?? []).map((t) => t.id);
      const ids = new Set<string>([...myBoards.map((b) => b.ownerId), ...owners]);
      const items = [...ids].map((id) => ({ value: id, label: labelOf(id), mine: myBoards.some((b) => b.ownerId === id && b.mine) }));
      items.sort((a, b) => (a.mine === b.mine ? a.label.localeCompare(b.label, "ko") : a.mine ? -1 : 1));
      return [...base, ...items.map(({ value, label }) => ({ value, label })), { value: "none", label: "주인 없는 게시판(담임 해제·계정 삭제)" }];
    }
    return [...base, ...myBoards.map((b) => ({ value: b.ownerId, label: boardLabel(b) }))];
  }, [showLabels, superAdmin, myBoards, teachers, boardOwnerIds, labelOf]);

  return { mode, showLabels, labelOf, filterOptions };
}

const PAGE = 50;

type Load<T> = { status: "loading" } | { status: "setup" } | { status: "error" } | { status: "ready"; rows: T[]; hasMore: boolean };

type Target = { postId: string; commentId: string | null; kind: CommunityKind; title: string; gamePath: string | null };

/**
 * 관리자 커뮤니티 관리(spec §13): 신고 목록 + 글·게임 목록(숨김/삭제).
 * 숨김·신고 처리는 SECURITY DEFINER RPC(set_community_*), 삭제는 RLS delete 정책으로 처리한다.
 * 자유게시판은 담임교사별(20260928010000): 담임은 자기 게시판(보조 담임은 그 학급 게시판도)과 학습게임 전부,
 * 총괄은 관리용으로 모든 게시판의 글·신고를 본다 — 서버(RLS·RPC)가 거른다. 총괄·게시판이 둘 이상인 교사에게는
 * 글·신고마다 "○○ 선생님 게시판" 이름표와 게시판 거르기를 보인다.
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
  const board = useBoardDirectory(state.status === "ready" ? state.rows.map((r) => r.target_board_owner) : []);
  const boardMode = board.mode;

  useEffect(() => {
    if (boardMode === "loading") return; // 게시판 SQL 적용 여부(읽을 열)를 알고 나서 읽는다
    let active = true;
    supabase
      .from("community_reports")
      .select(boardMode === "boards" ? REPORT_COLUMNS_WITH_BOARD : REPORT_COLUMNS)
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
  }, [filter, attempt, boardMode]);

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
            const kind: CommunityKind = post?.kind ?? (r.target_kind === "game" || r.target_post_kind === "game" ? "game" : "board");
            const isComment = r.target_kind === "comment" || !!r.comment_id;
            const targetHidden = isComment ? comment?.hidden : post?.hidden;
            // 어느 게시판 신고인지(총괄 · 게시판이 둘 이상인 교사). 학습게임은 이름표 없음.
            const boardText = !board.showLabels
              ? null
              : r.target_post_kind === "board"
                ? board.labelOf(r.target_board_owner)
                : r.target_post_kind === null
                  ? "게시판 알 수 없음(옛 신고)"
                  : null;
            return (
              <li key={r.id} className={cn("flex flex-col gap-3 rounded-xl p-4", adminSurfaceClass)}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="destructive">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</Badge>
                  <Badge variant="outline">{isComment ? "댓글" : KIND_META[kind].noun}</Badge>
                  {boardText ? (
                    <Badge variant="secondary" className="gap-1">
                      <UsersIcon className="size-3" aria-hidden />
                      {boardText}
                    </Badge>
                  ) : null}
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
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [state, setState] = useState<Load<PostRow>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const board = useBoardDirectory(state.status === "ready" ? state.rows.map((r) => r.board_owner) : []);
  const boardMode = board.mode;
  const boardPickerId = useId();
  // 게시판 거르기는 "자유게시판"을 골랐을 때만(거를 게시판이 둘 이상일 때)
  const showBoardFilter = kind === "board" && board.filterOptions.length > 2;
  const appliedBoardFilter: BoardFilter = showBoardFilter && board.filterOptions.some((o) => o.value === boardFilter) ? boardFilter : "all";

  const query = useCallback(
    (from: number) => {
      let q = supabase.from("community_posts").select(boardMode === "boards" ? ADMIN_POST_COLUMNS_WITH_BOARD : ADMIN_POST_COLUMNS);
      if (kind !== "all") q = q.eq("kind", kind);
      if (kind === "board" && appliedBoardFilter !== "all") {
        q = appliedBoardFilter === "none" ? q.is("board_owner", null) : q.eq("board_owner", appliedBoardFilter);
      }
      return q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE - 1);
    },
    [kind, boardMode, appliedBoardFilter],
  );

  useEffect(() => {
    if (boardMode === "loading") return; // 게시판 SQL 적용 여부(읽을 열)를 알고 나서 읽는다
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
  }, [query, attempt, boardMode]);

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
      {showBoardFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={boardPickerId} className="flex items-center gap-1.5 text-sm font-medium">
            <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
            게시판
          </label>
          <NativeSelect
            id={boardPickerId}
            value={appliedBoardFilter}
            onChange={(e) => {
              setState({ status: "loading" });
              setBoardFilter(e.target.value);
            }}
            className="h-11 max-w-full min-w-[14rem] px-3"
          >
            {board.filterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <ListSkeleton rows={4} label="글을 불러오는 중" />
      ) : state.status === "setup" ? (
        <CommunitySetupNotice />
      ) : state.status === "error" ? (
        <ErrorState message="글 목록을 불러오지 못했습니다." onRetry={reload} />
      ) : !state.rows.length ? (
        <EmptyState title="아직 올라온 글이 없습니다" className="py-10" />
      ) : (
        <ul className={cn("divide-y rounded-xl", adminSurfaceClass)}>
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
                    {r.kind === "board" && board.showLabels ? (
                      <Badge variant="secondary" className="gap-1">
                        <UsersIcon className="size-3" aria-hidden />
                        {board.labelOf(r.board_owner)}
                      </Badge>
                    ) : null}
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
          <AlertDialogAction variant="destructive" className={dangerSolidClass} disabled={busy} onClick={onDelete}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
