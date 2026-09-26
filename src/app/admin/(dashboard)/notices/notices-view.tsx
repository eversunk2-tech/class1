"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type Ref } from "react";
import { CheckIcon, GlobeIcon, Loader2Icon, PencilIcon, PlusIcon, SchoolIcon, SendIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { ClassNameDialog } from "@/components/admin/class-card";
import { ConfirmDialog } from "@/components/learning/confirm-dialog";
import { ListSkeleton, NativeSelect } from "@/components/learning/learning-ui";
import { LinkifiedText } from "@/components/linkified-text";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminContext } from "@/hooks/use-admin-context";
import { useAsyncData } from "@/hooks/use-async-data";
import { useSession } from "@/hooks/use-session";
import { AdminActionError } from "@/lib/admin";
import { CLASSES_MISSING_MESSAGE } from "@/lib/classes";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  charCount,
  createClassNotice,
  deleteClassNotice,
  fetchClassNotices,
  normalizeNoticeBody,
  normalizeNoticeTitle,
  NOTICE_BODY_MAX,
  NOTICE_TITLE_MAX,
  noticeBodyProblem,
  NOTICES_MISSING_MESSAGE,
  noticeTitleProblem,
  updateClassNotice,
  type ClassNotice,
} from "@/lib/notices";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/** 쓰는 중인 글(새 글 또는 고치는 글). 학급 정보가 잠깐 다시 읽히는 동안(로그인 만료 등)에도 쓰던 내용이 남도록 화면 맨 위에 둔다. */
type Draft = {
  mode: "new" | "edit";
  /** 고치는 글 id(새 글이면 null) */
  noticeId: string | null;
  classId: string;
  className: string;
  /** 총괄 선생님이 쓴 글은 비로그인 방문자에게도 보인다(2026-09-26 사용자 결정) — 쓰기 시작할 때 정한 값 */
  publicNote: boolean;
  title: string;
  body: string;
  initialTitle: string;
  initialBody: string;
};

type ListData = { rows: ClassNotice[]; hasMore: boolean };

function isDirty(d: Draft | null): boolean {
  return !!d && (d.title !== d.initialTitle || d.body !== d.initialBody);
}

/** 본문이 길어 목록에서 접어 보여 주는 글인지(대략 — 세 줄을 넘을 만한 글) */
function isLongBody(body: string): boolean {
  return body.length > 120 || body.split("\n").length > 3;
}

/** 고친 적이 있는지(쓴 뒤 1분 넘게 지나 저장한 경우만 "고친 날"을 보인다) */
function wasEdited(n: ClassNotice): boolean {
  return new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 60_000;
}

/**
 * 관리자 '선생님 글'(/admin/notices/) — docs/classes/spec.md 개정 2-2.
 * 블로그 편집기('글 관리'·'새 글 작성') 대신, 담임이 **자기 학급 학생에게 보일 글**을 제목·본문 두 칸만으로 쓴다.
 * - 내 학급이 여럿이면 학급을 고른다(글은 학급마다 따로). 학급이 없으면 "먼저 학급을 개설해 주세요".
 * - 새 글·고치기·지우기(확인 대화 상자 + 진한 빨강 버튼). 목록에는 쓴 날짜를 작게(관리용 — 학생 화면에는 날짜 없음).
 * - 본문은 학생 화면에 글자 그대로 보인다(마크다운·HTML 해석 없음). 인터넷 주소(http·https)만 링크로(LinkifiedText, 2026-09-26 사용자 요청).
 * - 총괄 선생님이 쓴 글은 로그인하지 않은 방문자에게도 보인다(2026-09-26 사용자 결정) → 쓰기 칸에 안내.
 * 실제 권한은 RLS(그 학급 담임만 쓰기·고치기·지우기)가 판단한다. 이 화면의 검사는 편의다.
 */
export function NoticesView() {
  const ctx = useAdminContext();
  const { user } = useSession();
  const myId = user?.id ?? null;
  const pickerId = useId();
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const ready = ctx.status === "ready";
  const classes = ready ? ctx.classes : [];
  const current = classes.find((c) => c.id === pickedClassId) ?? classes[0] ?? null;
  const classId = current?.id ?? null;
  const superAdmin = ready && ctx.isSuperAdmin;

  const load = useCallback(async (): Promise<ListData> => {
    if (!classId) return { rows: [], hasMore: false };
    const rows = await fetchClassNotices(classId, 0, PAGE_SIZE);
    return { rows, hasMore: rows.length === PAGE_SIZE };
  }, [classId]);
  const { state, reload, setData } = useAsyncData(load);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const working = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLFormElement | null>(null);

  // 지우기: 닫히는 동안 문구가 바뀌지 않게 대상과 열림 상태를 따로 둔다.
  const [deleteTarget, setDeleteTarget] = useState<ClassNotice | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [classDialogOpen, setClassDialogOpen] = useState(false);

  const listMissing = state.status === "error" && state.missing;
  const dirty = isDirty(draft);

  // 저장하지 않은 글이 있으면 탭을 닫거나 새로고침할 때 브라우저가 한 번 묻는다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // 관리자 메뉴 같은 사이트 안 링크를 누를 때도 한 번 묻는다(Review L1 — 화면 전환은 beforeunload가 잡지 못한다).
  // 문서 capture 단계에서 막으면 next/link의 이동(React 이벤트)보다 먼저 멈춘다.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link || link.getAttribute("target") === "_blank" || link.hasAttribute("download")) return;
      if ((link.getAttribute("href") ?? "").startsWith("#")) return;
      if (window.confirm("저장하지 않은 글이 있어요. 이 화면을 떠나면 쓰던 글이 사라져요. 그래도 떠날까요?")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  // 쓰기 칸을 열면 화면 위쪽의 쓰기 칸으로 옮겨 간다(목록 아래쪽 글의 "고치기"를 눌렀을 때).
  useEffect(() => {
    if (draftKey === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    editorRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [draftKey]);

  function openDraft(next: Draft, opener: HTMLElement | null) {
    returnFocus.current = opener;
    setDraft(next);
    setDraftKey((k) => k + 1);
    setSaveError(null);
    setShowProblems(false);
  }

  function closeDraft() {
    setDraft(null);
    setSaveError(null);
    setShowProblems(false);
    // 쓰기 칸을 연 버튼으로 초점을 돌려준다(없어졌으면 목록 제목으로).
    const target = returnFocus.current;
    returnFocus.current = null;
    requestAnimationFrame(() => {
      if (target && target.isConnected && !target.hasAttribute("disabled")) target.focus();
      else document.getElementById("notice-list-heading")?.focus();
    });
  }

  function startNew(opener: HTMLElement | null) {
    if (!current || draft) return;
    openDraft(
      {
        mode: "new",
        noticeId: null,
        classId: current.id,
        className: current.name,
        publicNote: superAdmin,
        title: "",
        body: "",
        initialTitle: "",
        initialBody: "",
      },
      opener,
    );
  }

  function startEdit(n: ClassNotice, opener: HTMLElement | null) {
    if (draft) return;
    openDraft(
      {
        mode: "edit",
        noticeId: n.id,
        classId: n.class_id,
        className: ctx.classNameOf(n.class_id) ?? current?.name ?? "내 학급",
        // 비로그인 방문자에게 보이는지는 "쓴 사람이 총괄인가"로 정해진다(RLS) — 내가 쓴 글을 총괄이 고칠 때만 안내
        publicNote: superAdmin && !!myId && n.author_id === myId,
        title: n.title,
        body: n.body,
        initialTitle: n.title,
        initialBody: n.body,
      },
      opener,
    );
  }

  function cancelDraft() {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else closeDraft();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft || working.current) return;
    const titleProblem = noticeTitleProblem(draft.title);
    const bodyProblem = noticeBodyProblem(draft.body);
    if (titleProblem || bodyProblem) {
      setShowProblems(true);
      document.getElementById(titleProblem ? "notice-title" : "notice-body")?.focus();
      return;
    }
    working.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (draft.mode === "new") {
        const created = await createClassNotice({ classId: draft.classId, title: draft.title, body: draft.body });
        if (state.status === "ready" && created.class_id === classId) {
          setData((prev) => ({ ...prev, rows: [created, ...prev.rows.filter((r) => r.id !== created.id)] }));
        } else reload();
        toast.success("글을 올렸어요. 학생 홈 화면의 ‘선생님 글’에 바로 보여요.");
      } else if (draft.noticeId) {
        const updated = await updateClassNotice(draft.noticeId, { title: draft.title, body: draft.body });
        if (state.status === "ready") setData((prev) => ({ ...prev, rows: prev.rows.map((r) => (r.id === updated.id ? updated : r)) }));
        else reload();
        toast.success("글을 고쳤어요.");
      }
      closeDraft();
    } catch (err) {
      setSaveError(err instanceof AdminActionError ? err.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      working.current = false;
      setSaving(false);
    }
  }

  async function onDelete() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteBusy(true);
    try {
      await deleteClassNotice(target.id);
      setData((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== target.id) }));
      setDeleteOpen(false);
      toast.success("글을 지웠어요.");
    } catch (err) {
      toast.error(err instanceof AdminActionError ? err.message : "글을 지우지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function loadMore(offset: number) {
    if (!classId) return;
    const forClass = classId;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchClassNotices(forClass, offset, PAGE_SIZE);
      setData((prev) => {
        const known = new Set(prev.rows.map((r) => r.id));
        return { rows: [...prev.rows, ...page.filter((r) => !known.has(r.id) && r.class_id === forClass)], hasMore: page.length === PAGE_SIZE };
      });
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canStart = ready && !!current && !draft && !listMissing;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="선생님 글"
        description="담임 학급 학생의 홈 화면 ‘선생님 글’에 보여요. 제목과 본문만 쓰면 바로 올라가요."
        actions={
          <Button className="h-11 px-4" onClick={(e) => startNew(e.currentTarget)} disabled={!canStart}>
            <PlusIcon />새 글 쓰기
          </Button>
        }
      />

      {draft ? (
        <NoticeEditor
          ref={editorRef}
          key={draftKey}
          draft={draft}
          saving={saving}
          error={saveError}
          showProblems={showProblems}
          onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
          onSubmit={onSubmit}
          onCancel={cancelDraft}
        />
      ) : null}

      {ctx.status === "loading" ? (
        <ListSkeleton rows={3} label="내 학급을 확인하는 중" />
      ) : ctx.status === "error" ? (
        <ErrorState message="학급 정보를 불러오지 못했습니다." onRetry={ctx.retry} />
      ) : ctx.status === "missing" ? (
        <p role="note" className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">학급 기능 준비 전 · </span>
          선생님 글은 학급별로 올라가서 학급 기능 설정 뒤에 쓸 수 있어요. {CLASSES_MISSING_MESSAGE}
        </p>
      ) : !current ? (
        <EmptyState
          title="먼저 학급을 개설해 주세요"
          description="선생님 글은 학급마다 따로 올라가요. 학급을 개설하면 그 학급 학생에게 보이는 글을 쓸 수 있어요."
          action={
            <Button className="h-11 px-4" onClick={() => setClassDialogOpen(true)}>
              <PlusIcon />
              학급 개설
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="notice-list-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="notice-list-heading" tabIndex={-1} className="mr-auto font-heading text-xl font-normal outline-none">
              쓴 글
            </h2>
            {classes.length > 1 ? (
              <div className="flex items-center gap-2">
                <label htmlFor={pickerId} className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
                  <SchoolIcon className="size-4 text-muted-foreground" aria-hidden />
                  학급
                </label>
                <NativeSelect
                  id={pickerId}
                  value={current.id}
                  onChange={(e) => setPickedClassId(e.target.value)}
                  disabled={!!draft}
                  aria-describedby={`${pickerId}-help`}
                  className="h-11 max-w-[16rem] px-3"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>
          <p id={`${pickerId}-help`} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <SchoolIcon className="size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-medium text-foreground">{current.name}</strong>{" "}
              {/* 총괄 글은 비로그인 방문자에게도 보인다(개정 2 보충, Review L4 — "학생에게만"은 사실과 다름) */}
              {superAdmin ? "학생에게 보이고, 내가 쓴 글은 로그인하지 않은 방문자에게도 보여요." : "학생에게만 보여요."}
              {draft && classes.length > 1 ? " 쓰기를 마치면 학급을 바꿀 수 있어요." : ""}
            </span>
          </p>

          {state.status === "loading" ? (
            <ListSkeleton rows={3} label="선생님 글을 불러오는 중" />
          ) : state.status === "error" ? (
            <ErrorState message={state.missing ? NOTICES_MISSING_MESSAGE : "선생님 글을 불러오지 못했습니다."} onRetry={reload} />
          ) : !state.data.rows.length ? (
            <EmptyState
              title="아직 쓴 글이 없어요"
              description="‘새 글 쓰기’를 누르면 제목과 본문만 적어 바로 올릴 수 있어요."
              action={
                <Button variant="outline" className="h-11 px-4" onClick={(e) => startNew(e.currentTarget)} disabled={!canStart}>
                  <PlusIcon />새 글 쓰기
                </Button>
              }
            />
          ) : (
            <>
              <ul className={cn("flex flex-col divide-y rounded-2xl", adminSurfaceClass)} aria-label={`${current.name} 선생님 글`}>
                {state.data.rows.map((n) => {
                  const long = isLongBody(n.body);
                  const open = expanded.has(n.id);
                  return (
                    <li key={n.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="font-semibold break-keep [overflow-wrap:anywhere]">{n.title}</p>
                        <p
                          id={`notice-body-${n.id}`}
                          className={cn("text-sm text-foreground/80 whitespace-pre-wrap [overflow-wrap:anywhere]", long && !open && "line-clamp-3")}
                        >
                          {/* 접힌 긴 본문은 글자로만 — 가려진 링크에 Tab 초점이 가서 칸이 밀리지 않게(Review links L2) */}
                          {long && !open ? n.body : <LinkifiedText text={n.body} />}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>쓴 날 {formatDateTime(n.created_at)}</span>
                          {wasEdited(n) ? <span>고친 날 {formatDateTime(n.updated_at)}</span> : null}
                          {long ? (
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-controls={`notice-body-${n.id}`}
                              onClick={() => toggleExpanded(n.id)}
                              className="-my-2 inline-flex min-h-11 items-center rounded-md px-1 font-medium text-foreground/80 underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {open ? "본문 접기" : "본문 모두 보기"}
                            </button>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                        <Button
                          variant="ghost"
                          className="h-11 px-3"
                          onClick={(e) => startEdit(n, e.currentTarget)}
                          disabled={!!draft}
                          aria-label={`‘${n.title}’ 고치기`}
                        >
                          <PencilIcon />
                          고치기
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-11 px-3 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget(n);
                            setDeleteOpen(true);
                          }}
                          disabled={!!draft}
                          aria-label={`‘${n.title}’ 지우기`}
                        >
                          <Trash2Icon />
                          지우기
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {moreError ? (
                <p role="alert" className="text-center text-sm text-destructive">
                  더 불러오지 못했어요.
                </p>
              ) : null}
              {state.data.hasMore ? (
                <Button
                  variant="outline"
                  className="mx-auto h-11 px-5"
                  onClick={() => loadMore(state.data.rows.length)}
                  disabled={loadingMore}
                >
                  {loadingMore ? <Loader2Icon className="animate-spin" /> : null}더 보기
                </Button>
              ) : null}
            </>
          )}
        </section>
      )}

      {/* 학급 개설(학급이 없는 담임) — 개설하면 위 목록이 새 학급으로 바뀌므로 대화 상자는 조건 밖에 둔다(닫히는 동안 사라지지 않게) */}
      <ClassNameDialog
        target={{ mode: "create" }}
        open={classDialogOpen}
        onOpenChange={setClassDialogOpen}
        onSaved={(id) => setPickedClassId(id)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="이 글을 지울까요?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” — 학생 홈 화면에서도 바로 사라지고, 되돌릴 수 없어요.`
            : "학생 홈 화면에서도 바로 사라지고, 되돌릴 수 없어요."
        }
        confirmLabel="지우기"
        destructive
        busy={deleteBusy}
        onConfirm={() => void onDelete()}
      />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="쓰던 내용을 버릴까요?"
        description="저장하지 않은 제목과 본문이 사라져요."
        confirmLabel="버리기"
        destructive
        busy={false}
        onConfirm={() => {
          setDiscardOpen(false);
          closeDraft();
        }}
      />
    </div>
  );
}

/** 제목·본문 두 칸 쓰기 칸(새 글·고치기 공용). 글자 수는 한글·이모지를 한 글자로 센다(DB와 같은 기준). */
function NoticeEditor({
  ref,
  draft,
  saving,
  error,
  showProblems,
  onChange,
  onSubmit,
  onCancel,
}: {
  ref: Ref<HTMLFormElement>;
  draft: Draft;
  saving: boolean;
  error: string | null;
  showProblems: boolean;
  onChange: (patch: Partial<Pick<Draft, "title" | "body">>) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const headingId = useId();
  const titleLen = charCount(normalizeNoticeTitle(draft.title));
  const bodyLen = charCount(normalizeNoticeBody(draft.body));
  const titleProblem = noticeTitleProblem(draft.title);
  const bodyProblem = noticeBodyProblem(draft.body);
  // 너무 긴 것은 쓰는 동안 바로, "비어 있음"은 올리기를 누른 뒤에만 알린다.
  const titleShown = titleProblem && (titleLen > 0 || showProblems) ? titleProblem : null;
  const bodyShown = bodyProblem && (bodyLen > 0 || showProblems) ? bodyProblem : null;
  const unchanged = draft.mode === "edit" && !isDirty(draft);

  return (
    <form
      ref={ref}
      onSubmit={onSubmit}
      aria-labelledby={headingId}
      noValidate
      className={cn("flex scroll-mt-24 flex-col gap-4 rounded-2xl p-4 ring-2 ring-primary/25 sm:p-5", adminSurfaceClass)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="mr-auto font-heading text-xl font-normal">
          {draft.mode === "new" ? "새 글 쓰기" : "글 고치기"}
        </h2>
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
          <SchoolIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{draft.className} 학생에게 보여요</span>
        </span>
      </div>

      {draft.publicNote ? (
        <p className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2.5 text-sm ring-1 ring-primary/15">
          <GlobeIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          총괄 선생님 글은 로그인하지 않은 방문자에게도 보여요.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notice-title">제목</Label>
        <Input
          id="notice-title"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          disabled={saving}
          autoComplete="off"
          autoFocus
          placeholder="예: 내일 과학 실험 준비물"
          className="h-11"
          aria-invalid={!!titleShown}
          aria-describedby="notice-title-help"
        />
        <p id="notice-title-help" className={cn("flex justify-between gap-2 text-xs", titleShown ? "text-destructive" : "text-muted-foreground")}>
          <span>{titleShown ?? `1~${NOTICE_TITLE_MAX}자, 한 줄로 적어 주세요.`}</span>
          <span className="shrink-0 tabular-nums" aria-hidden>
            {titleLen}/{NOTICE_TITLE_MAX}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notice-body">본문</Label>
        <Textarea
          id="notice-body"
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          disabled={saving}
          placeholder="학생에게 전할 내용을 적어 주세요."
          className="min-h-48 text-base leading-relaxed md:text-base"
          aria-invalid={!!bodyShown}
          aria-describedby="notice-body-help"
        />
        <p id="notice-body-help" className={cn("flex justify-between gap-2 text-xs", bodyShown ? "text-destructive" : "text-muted-foreground")}>
          <span>{bodyShown ?? `1~${formatCount(NOTICE_BODY_MAX)}자. 쓴 그대로(줄바꿈 포함) 보여요. http:// 또는 https://로 시작하는 주소는 누르면 새 창에서 열리는 링크가 돼요 — 주소창에서 복사해 붙이고, 주소 뒤는 한 칸 띄어 주세요.`}</span>
          <span className="shrink-0 tabular-nums" aria-hidden>
            {formatCount(bodyLen)}/{formatCount(NOTICE_BODY_MAX)}
          </span>
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="h-11 px-4" onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button type="submit" className="h-11 px-4" disabled={saving || unchanged}>
          {saving ? <Loader2Icon className="animate-spin" /> : draft.mode === "new" ? <SendIcon /> : <CheckIcon />}
          {draft.mode === "new" ? "올리기" : "고친 내용 저장"}
        </Button>
      </div>
    </form>
  );
}
