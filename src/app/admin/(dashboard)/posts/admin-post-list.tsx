"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2Icon, LockIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminSurfaceClass, dangerSolidClass } from "@/components/admin/admin-styles";
import { editPostHref, postHref } from "@/components/post-card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  canModifyContent,
  contentLockReason,
  isPermissionRejection,
  OWNER_ONLY_DELETE,
  OWNER_ONLY_EDIT,
  useAdminContext,
} from "@/hooks/use-admin-context";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

// author_id: 쓴 선생님과 총괄만 고치고 지운다(20260927030000_content_owner_only.sql) — 남의 글은 버튼을 끈다.
type AdminRow = Pick<Post, "id" | "slug" | "title" | "published" | "published_at" | "updated_at" | "author_id">;
const ADMIN_COLUMNS = "id,slug,title,published,published_at,updated_at,author_id";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; rows: AdminRow[] };

async function fetchAll(): Promise<AdminRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(ADMIN_COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdminRow[];
}

export function AdminPostList() {
  const ctx = useAdminContext();
  const [state, setState] = useState<State>({ status: "loading" });
  // 여러 행을 연달아 토글해도 각 행의 진행 상태가 서로 풀리지 않도록 id 집합으로 관리한다.
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  // 닫히는 애니메이션 동안 문구가 바뀌지 않도록 대상과 열림 상태를 따로 둔다.
  const [deleting, setDeleting] = useState<AdminRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const reload = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", rows: await fetchAll() });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchAll()
      .then((rows) => {
        if (active) setState({ status: "ready", rows });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  const replaceRow = (row: AdminRow) =>
    setState((s) => (s.status === "ready" ? { ...s, rows: s.rows.map((r) => (r.id === row.id ? row : r)) } : s));

  async function togglePublished(row: AdminRow, next: boolean) {
    if (busyIds.has(row.id)) return;
    setBusyIds((prev) => new Set(prev).add(row.id));
    // 처음 발행할 때만 published_at을 채운다. 비공개로 돌려도 원래 발행일은 유지한다.
    const patch = next ? { published: true, published_at: row.published_at ?? new Date().toISOString() } : { published: false };
    const { data, error } = await supabase.from("posts").update(patch).eq("id", row.id).select(ADMIN_COLUMNS).maybeSingle();
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(row.id);
      return next;
    });
    if (error || !data) {
      // 오류 없이 0행 = RLS가 남의 글을 걸렀다(또는 이미 지워짐).
      toast.error(!error || isPermissionRejection(error) ? `상태를 바꾸지 못했습니다. ${OWNER_ONLY_EDIT}` : "상태를 바꾸지 못했습니다.");
      return;
    }
    replaceRow(data as AdminRow);
    toast.success(next ? "발행했습니다." : "비공개로 바꿨습니다.");
  }

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    // select로 실제 삭제된 행을 돌려받아, RLS로 0건 처리된 경우도 실패로 본다.
    const { data, error } = await supabase.from("posts").delete().eq("id", deleting.id).select("id");
    setDeleteBusy(false);
    if (error || !data?.length) {
      toast.error(!error || isPermissionRejection(error) ? `글을 삭제하지 못했습니다. ${OWNER_ONLY_DELETE}` : "글을 삭제하지 못했습니다.");
      return;
    }
    const id = deleting.id;
    setState((s) => (s.status === "ready" ? { ...s, rows: s.rows.filter((r) => r.id !== id) } : s));
    setDeleteOpen(false);
    toast.success("글을 삭제했습니다.");
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="글 관리"
        description="발행된 글과 초안을 모두 볼 수 있습니다."
        actions={
          <Button className="h-9 px-4" render={<Link href="/admin/write/" />} nativeButton={false}>
            <PlusIcon />새 글 작성
          </Button>
        }
      />

      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="글 목록을 불러오는 중">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="글 목록을 불러오지 못했습니다." onRetry={reload} />
      ) : !state.rows.length ? (
        <EmptyState
          title="작성된 글이 없습니다"
          action={
            <Button variant="outline" render={<Link href="/admin/write/" />} nativeButton={false}>
              첫 글 작성하기
            </Button>
          }
        />
      ) : (
        <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)} aria-label="전체 글">
          {state.rows.map((row) => {
            // 쓴 선생님과 총괄만 고치고 지운다(화면 표시용 — 실제 판단은 RLS). 남의 글은 버튼을 끄고 까닭을 보인다.
            const canEdit = canModifyContent(ctx, row.author_id);
            const lockId = `post-lock-${row.id}`;
            const describedBy = canEdit ? undefined : lockId;
            return (
              <li key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant={row.published ? "default" : "outline"} className="shrink-0">
                      {row.published ? "발행" : "초안"}
                    </Badge>
                    <Link href={postHref(row.slug)} className="truncate font-medium hover:underline">
                      {row.title}
                    </Link>
                  </div>
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>발행 {row.published_at ? formatDateTime(row.published_at) : "—"}</span>
                    <span>수정 {formatDateTime(row.updated_at)}</span>
                  </p>
                  {!canEdit ? (
                    <p id={lockId} role="note" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <LockIcon className="size-3.5 shrink-0" aria-hidden />
                      {contentLockReason(ctx)}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={row.published}
                      disabled={busyIds.has(row.id) || !canEdit}
                      onCheckedChange={(checked) => togglePublished(row, checked)}
                      aria-label={`${row.title} 발행 여부`}
                      aria-describedby={describedBy}
                    />
                    <span className="w-10 text-muted-foreground">{row.published ? "공개" : "비공개"}</span>
                  </label>
                  <div className="ml-auto flex items-center gap-1">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${row.title} 수정`}
                        render={<Link href={editPostHref(row.slug)} />}
                        nativeButton={false}
                      >
                        <PencilIcon />
                      </Button>
                    ) : (
                      // 링크 대신 꺼진 버튼(남의 글 — 편집 화면으로 보내지 않는다)
                      <Button variant="ghost" size="icon-sm" aria-label={`${row.title} 수정`} aria-describedby={describedBy} disabled>
                        <PencilIcon />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={`${row.title} 삭제`}
                      aria-describedby={describedBy}
                      disabled={!canEdit}
                      onClick={() => {
                        setDeleting(row);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleteBusy) setDeleteOpen(open);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.title}” ` : ""}글과 댓글·좋아요·조회수가 함께 삭제되며 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>취소</AlertDialogCancel>
            <AlertDialogAction variant="destructive" className={dangerSolidClass} disabled={deleteBusy} onClick={onDelete}>
              {deleteBusy ? <Loader2Icon className="animate-spin" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
