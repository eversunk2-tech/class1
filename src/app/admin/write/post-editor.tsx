"use client";

import { useCallback, useDeferredValue, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, Loader2Icon, LockIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { adminSurfaceClass, dangerSolidClass } from "@/components/admin/admin-styles";
import {
  canModifyContent,
  contentLockReason,
  isPermissionRejection,
  OWNER_ONLY_DELETE,
  OWNER_ONLY_EDIT,
  useAdminContext,
} from "@/hooks/use-admin-context";
import { useSession } from "@/hooks/use-session";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { editPostHref, postHref } from "@/components/post-card";
import { EmptyState, ErrorState } from "@/components/states";
import { TagList } from "@/components/tag-chip";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { fallbackSlug, isHttpUrl, isValidSlug, parseTags, slugifyTitle } from "@/lib/slug";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// 로더: ?slug= 가 있으면 글을 불러와 수정 모드, 없으면 신규 작성
// ─────────────────────────────────────────────

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; post: Post };

async function fetchPostBySlug(slug: string): Promise<Post | null> {
  const { data, error } = await supabase.from("posts").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Post | null) ?? null;
}

export function PostEditorLoader() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug")?.trim() ?? "";
  // 저장 직후 URL(slug)이 바뀔 때 다시 조회하지 않도록 방금 저장한 글을 보관한다.
  const [saved, setSaved] = useState<Post | null>(null);
  const [state, setState] = useState<{ slug: string; load: LoadState }>({ slug: "", load: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);

  const savedMatches = saved !== null && saved.slug === slug;

  useEffect(() => {
    if (!slug || savedMatches) return;
    let active = true;
    fetchPostBySlug(slug)
      .then((post) => {
        if (active) setState({ slug, load: post ? { status: "ready", post } : { status: "not-found" } });
      })
      .catch(() => {
        if (active) setState({ slug, load: { status: "error" } });
      });
    return () => {
      active = false;
    };
  }, [slug, savedMatches, attempt]);

  if (!slug) return <PostEditor key="new" initial={null} onSaved={setSaved} />;
  if (savedMatches) return <PostEditor key={saved.id} initial={saved} onSaved={setSaved} />;

  const load = state.slug === slug ? state.load : { status: "loading" as const };
  if (load.status === "loading") return <PostEditorSkeleton />;
  if (load.status === "error") {
    return (
      <ErrorState
        message="글을 불러오지 못했습니다."
        onRetry={() => {
          setState({ slug: "", load: { status: "loading" } });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (load.status === "not-found") {
    return (
      <EmptyState
        className="my-10"
        title="수정할 글을 찾을 수 없습니다"
        description={`slug “${slug}”에 해당하는 글이 없습니다.`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" render={<Link href="/admin/posts/" />} nativeButton={false}>
              글 관리로
            </Button>
            <Button render={<Link href="/admin/write/" />} nativeButton={false}>
              새 글 작성
            </Button>
          </div>
        }
      />
    );
  }
  return <PostEditor key={load.post.id} initial={load.post} onSaved={setSaved} />;
}

// ─────────────────────────────────────────────
// 에디터
// ─────────────────────────────────────────────

type ViewMode = "write" | "preview" | "split";
type FieldErrors = Partial<Record<"title" | "slug" | "cover", string>>;

type Snapshot = {
  title: string;
  slug: string;
  summary: string;
  coverUrl: string;
  tagsText: string;
  content: string;
  published: boolean;
};

function snapshotOf(post: Post | null): Snapshot {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    summary: post?.summary ?? "",
    coverUrl: post?.cover_url ?? "",
    tagsText: post?.tags.join(", ") ?? "",
    content: post?.content_md ?? "",
    published: post?.published ?? false,
  };
}

const MAX_AUTO_SLUG_TRIES = 20;

/** slug를 쓰는 다른 글이 있으면 true (자기 자신은 제외) */
async function isSlugTaken(slug: string, ownId: string | null): Promise<boolean> {
  const { data, error } = await supabase.from("posts").select("id").eq("slug", slug).limit(1);
  if (error) throw error;
  return (data ?? []).some((r) => r.id !== ownId);
}

/** 자동 slug가 겹치면 -2, -3 …을 붙여 빈 slug를 찾는다. */
async function findFreeSlug(base: string, ownId: string | null): Promise<string | null> {
  for (let i = 1; i <= MAX_AUTO_SLUG_TRIES; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 60)}-${i}`;
    if (!(await isSlugTaken(candidate, ownId))) return candidate;
  }
  return null;
}

// ─────────────────────────────────────────────
// 세션 만료 시 임시 저장 (sessionStorage, 탭 단위)
// ─────────────────────────────────────────────

type Draft = { form: Snapshot; slugTouched: boolean; savedAt: string };

const DRAFT_PREFIX = "class1:post-draft:";

function draftKeyOf(post: Post | null): string {
  return `${DRAFT_PREFIX}${post?.id ?? "new"}`;
}

function isSnapshot(v: unknown): v is Snapshot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    ["title", "slug", "summary", "coverUrl", "tagsText", "content"].every((k) => typeof o[k] === "string") &&
    typeof o.published === "boolean"
  );
}

/** 저장된 임시 글. 없거나, 형식이 틀렸거나, 현재 글과 같으면 null */
function readDraft(key: string, current: Snapshot): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (!isSnapshot(d.form) || typeof d.slugTouched !== "boolean" || typeof d.savedAt !== "string") return null;
    if (JSON.stringify(d.form) === JSON.stringify(current)) return null;
    return { form: d.form, slugTouched: d.slugTouched, savedAt: d.savedAt };
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: Draft) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 무시한다(화면의 내용은 그대로 남아 있음).
  }
}

function clearDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

function initialViewMode(): ViewMode {
  // AdminGuard 통과 후 클라이언트에서만 렌더링되므로 window를 바로 써도 된다.
  if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) return "split";
  return "write";
}

function PostEditor({ initial, onSaved }: { initial: Post | null; onSaved: (post: Post) => void }) {
  const router = useRouter();
  const isEdit = initial !== null;

  const [form, setForm] = useState<Snapshot>(() => snapshotOf(initial));
  const [baseline, setBaseline] = useState<Snapshot>(() => snapshotOf(initial));
  // 신규 글은 사용자가 slug를 직접 고치기 전까지 제목에서 자동 생성한다. 기존 글은 자동으로 바꾸지 않는다.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [autoFallback] = useState(() => fallbackSlug());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>(initialViewMode);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { loading: sessionLoading, user } = useSession();
  // 남의 글은 쓴 선생님과 총괄만 고치고 지운다(20260927030000_content_owner_only.sql). 새 글은 교사 누구나(자기 이름으로).
  const adminCtx = useAdminContext();
  const canModify = !isEdit || canModifyContent(adminCtx, initial.author_id);
  const draftKey = draftKeyOf(initial);
  // 이전에 세션이 만료되며 임시 저장된 내용이 있으면 복원을 제안한다.
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(() => readDraft(draftKey, snapshotOf(initial)));

  const autoSlug = slugifyTitle(form.title) || autoFallback;
  const effectiveSlug = slugTouched ? form.slug : autoSlug;
  const deferredContent = useDeferredValue(form.content);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const set = <K extends keyof Snapshot>(key: K, value: Snapshot[K]) => setForm((f) => ({ ...f, [key]: value }));

  // 저장하지 않은 변경이 있으면 새로고침/탭 닫기 전에 확인
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // 세션이 사라진 상태(로그인 만료)에서 저장하지 않은 변경이 있으면 탭에 임시 저장한다.
  useEffect(() => {
    if (sessionLoading || user || !dirty) return;
    writeDraft(draftKey, { form, slugTouched, savedAt: new Date().toISOString() });
  }, [sessionLoading, user, dirty, form, slugTouched, draftKey]);

  function restoreDraft() {
    if (!pendingDraft) return;
    setForm(pendingDraft.form);
    setSlugTouched(pendingDraft.slugTouched || isEdit);
    setPendingDraft(null);
    clearDraft(draftKey);
    toast.success("임시 저장된 내용을 복원했습니다. 확인 후 저장해 주세요.");
  }

  function discardDraft() {
    setPendingDraft(null);
    clearDraft(draftKey);
  }

  const save = useCallback(async () => {
    if (saving) return;
    if (!canModify) {
      // 저장 버튼은 꺼 두지만 Ctrl/Cmd + S로도 들어온다.
      toast.error(`저장하지 못했습니다. ${OWNER_ONLY_EDIT}`);
      return;
    }
    const title = form.title.trim();
    const slugInput = effectiveSlug.trim();
    const coverUrl = form.coverUrl.trim();
    const next: FieldErrors = {};
    if (!title) next.title = "제목을 입력하세요.";
    else if (title.length > 200) next.title = "제목은 200자 이하로 입력하세요.";
    if (!isValidSlug(slugInput)) next.slug = "slug는 영문 소문자·숫자와 하이픈(-)만 쓸 수 있습니다. 예: my-first-post";
    if (coverUrl && !isHttpUrl(coverUrl)) next.cover = "http:// 또는 https://로 시작하는 주소를 입력하세요.";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("입력값을 확인해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const ownId = initial?.id ?? null;
      let slug = slugInput;
      if (slugTouched) {
        if (await isSlugTaken(slug, ownId)) {
          setErrors({ slug: "이미 사용 중인 slug입니다. 다른 값을 입력하세요." });
          toast.error("slug가 다른 글과 겹칩니다.");
          return;
        }
      } else {
        const free = await findFreeSlug(slug, ownId);
        if (!free) {
          setErrors({ slug: "사용 가능한 slug를 찾지 못했습니다. 직접 입력하세요." });
          return;
        }
        slug = free;
      }

      const payload = {
        slug,
        title,
        summary: form.summary.trim() || null,
        cover_url: coverUrl || null,
        tags: parseTags(form.tagsText),
        content_md: form.content,
        published: form.published,
        // 처음 발행할 때만 발행일을 채운다(비공개로 돌려도 기존 발행일 유지).
        published_at: form.published ? (initial?.published_at ?? new Date().toISOString()) : (initial?.published_at ?? null),
      };

      const result = isEdit
        ? await supabase.from("posts").update(payload).eq("id", initial.id).select("*").maybeSingle()
        : await supabase.from("posts").insert(payload).select("*").single();

      if (result.error) {
        if (result.error.code === "23505") {
          setErrors({ slug: "이미 사용 중인 slug입니다. 다른 값을 입력하세요." });
          toast.error("slug가 다른 글과 겹칩니다.");
        } else if (isEdit && isPermissionRejection(result.error)) {
          toast.error(`저장하지 못했습니다. ${OWNER_ONLY_EDIT}`);
        } else {
          toast.error("저장하지 못했습니다. 네트워크 상태나 권한을 확인해 주세요.");
        }
        return;
      }
      if (!result.data) {
        // 오류 없이 0행 = RLS가 남의 글을 걸렀거나 그사이 글이 지워졌다.
        toast.error(`저장하지 못했습니다. ${OWNER_ONLY_EDIT} 글이 이미 지워졌을 수도 있어요.`);
        return;
      }

      const post = result.data as Post;
      const snap = snapshotOf(post);
      setForm(snap);
      setBaseline(snap);
      setSlugTouched(true);
      clearDraft(draftKey);
      setPendingDraft(null);
      toast.success(isEdit ? "저장했습니다." : "글을 만들었습니다.");
      onSaved(post);
      if (!isEdit || post.slug !== initial.slug) router.replace(editPostHref(post.slug));
    } catch {
      toast.error("저장하지 못했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }, [saving, canModify, form, effectiveSlug, slugTouched, initial, isEdit, onSaved, router, draftKey]);

  // Ctrl/Cmd + S 로 저장
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  async function onDelete() {
    if (!initial) return;
    setDeleting(true);
    const { data, error } = await supabase.from("posts").delete().eq("id", initial.id).select("id");
    setDeleting(false);
    if (error || !data?.length) {
      // 오류 없이 0행 = RLS가 남의 글을 걸렀다(또는 이미 지워짐).
      toast.error(!error || isPermissionRejection(error) ? `글을 삭제하지 못했습니다. ${OWNER_ONLY_DELETE}` : "글을 삭제하지 못했습니다.");
      return;
    }
    setDeleteOpen(false);
    toast.success("글을 삭제했습니다.");
    router.replace("/admin/posts/");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save();
  }

  const showEditor = view !== "preview";
  const showPreview = view !== "write";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      // 폭은 page.tsx의 wrapper가 정한다(넓은 화면에서 72rem). 예전처럼 100vw 기준으로 넓히면 사이드바 밑으로 넘친다.
      className="flex w-full flex-col gap-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/admin/posts/" />} nativeButton={false}>
          <ArrowLeftIcon />
          글 관리
        </Button>
        <h1 className="mr-auto font-heading text-2xl leading-tight font-normal sm:text-3xl">{isEdit ? "글 수정" : "새 글 작성"}</h1>
        {dirty ? <span className="text-xs text-muted-foreground">저장하지 않은 변경 사항</span> : null}
        {isEdit && initial.published ? (
          <Button variant="outline" size="sm" render={<Link href={postHref(initial.slug)} />} nativeButton={false}>
            <ExternalLinkIcon />글 보기
          </Button>
        ) : null}
      </div>

      {!canModify ? (
        <p id="post-owner-lock" role="note" className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium">
          <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {contentLockReason(adminCtx)}
          {adminCtx.status === "ready" ? " 이 글은 볼 수만 있고 저장·삭제는 할 수 없어요." : ""}
        </p>
      ) : null}

      {pendingDraft ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            로그인이 만료되었을 때 임시 저장된 내용이 있습니다
            {` (${new Date(pendingDraft.savedAt).toLocaleString("ko-KR")})`}. 복원할까요?
          </p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" onClick={restoreDraft}>
              복원
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
              버리기
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field id="post-title" label="제목" error={errors.title} className="lg:col-span-2">
          <Input
            id="post-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={200}
            placeholder="글 제목"
            aria-invalid={Boolean(errors.title)}
            className="h-9 bg-card text-base"
          />
        </Field>

        <Field
          id="post-slug"
          label="slug (주소)"
          error={errors.slug}
          hint={
            slugTouched
              ? isEdit
                ? "slug를 바꾸면 기존 글 주소로는 접속할 수 없습니다."
                : "영문 소문자·숫자·하이픈만 사용합니다."
              : "제목에서 자동으로 만듭니다. 한글 제목은 날짜 기반으로 만들어집니다."
          }
        >
          <Input
            id="post-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value.toLowerCase());
            }}
            placeholder="my-first-post"
            spellCheck={false}
            autoCapitalize="off"
            aria-invalid={Boolean(errors.slug)}
            className="h-9 bg-card font-mono"
          />
        </Field>

        <Field id="post-tags" label="태그" hint="쉼표(,)로 구분합니다.">
          <Input
            id="post-tags"
            value={form.tagsText}
            onChange={(e) => set("tagsText", e.target.value)}
            placeholder="nextjs, 수업, 회고"
            className="h-9 bg-card"
          />
          <TagList tags={parseTags(form.tagsText)} linked={false} />
        </Field>

        <Field id="post-summary" label="요약" hint="목록과 검색에 표시됩니다." className="lg:col-span-2">
          <Textarea
            id="post-summary"
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            rows={2}
            placeholder="한두 문장으로 글을 소개해 주세요."
            className="bg-card"
          />
        </Field>

        <Field id="post-cover" label="커버 이미지 URL" error={errors.cover} className="lg:col-span-2">
          <Input
            id="post-cover"
            type="url"
            value={form.coverUrl}
            onChange={(e) => set("coverUrl", e.target.value)}
            placeholder="https://…"
            aria-invalid={Boolean(errors.cover)}
            className="h-9 bg-card"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="post-content">본문 (마크다운)</Label>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="write">작성</TabsTrigger>
              <TabsTrigger value="preview">미리보기</TabsTrigger>
              <TabsTrigger value="split" className="hidden lg:inline-flex">
                나란히
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className={cn("grid gap-4", view === "split" && "lg:grid-cols-2")}>
          {showEditor ? (
            <Textarea
              id="post-content"
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              placeholder={"# 제목\n\n마크다운으로 본문을 작성하세요."}
              spellCheck={false}
              className="min-h-[60vh] bg-card font-mono text-sm leading-6 md:text-sm"
            />
          ) : null}
          {showPreview ? (
            <div
              className={cn("min-h-[60vh] min-w-0 rounded-xl px-4 py-3 lg:max-h-[80vh] lg:overflow-y-auto", adminSurfaceClass)}
              aria-label="미리보기"
            >
              {deferredContent.trim() ? (
                <MarkdownViewer content={deferredContent} />
              ) : (
                <p className="text-sm text-muted-foreground">미리볼 내용이 없습니다.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:shadow-(--shadow-md) dark:shadow-none">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={form.published}
            onCheckedChange={(checked) => set("published", checked)}
            aria-label="발행 여부"
          />
          {form.published ? "발행 (누구나 볼 수 있음)" : "초안 (관리자만 볼 수 있음)"}
        </label>
        <div className="ml-auto flex items-center gap-2">
          {isEdit ? (
            <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
              <AlertDialogTrigger
                disabled={!canModify}
                aria-describedby={canModify ? undefined : "post-owner-lock"}
                render={<Button type="button" variant="ghost" className="h-9 text-destructive" />}
              >
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
                  <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" className={dangerSolidClass} disabled={deleting} onClick={onDelete}>
                    {deleting ? <Loader2Icon className="animate-spin" /> : null}
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button
            type="submit"
            className="h-9 px-4"
            disabled={saving || !canModify}
            aria-describedby={canModify ? undefined : "post-owner-lock"}
          >
            {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function PostEditorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="에디터를 불러오는 중">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
