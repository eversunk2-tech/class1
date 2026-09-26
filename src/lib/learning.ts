import { webApps } from "@/data/apps";
import { findResponseApp } from "@/data/app-responses";
import { isMissingSchemaError, MISSING_SCHEMA_MESSAGE } from "@/lib/admin";
import { chunk, fetchAllPages } from "@/lib/paging";
import { supabase } from "@/lib/supabase";
import { AUTHOR_PROFILE_COLUMNS } from "@/lib/types";
import type {
  AppResult,
  Assignment,
  AssignmentSubmission,
  FeedbackContextType,
  FeedbackMessage,
  FeedbackThread,
  PostRead,
  Profile,
  SubmissionStatus,
} from "@/lib/types";

/**
 * 학습활동 · 과제 · 피드백 쿼리 헬퍼 (docs/admin/spec.md §3.5~3.9, §9.2).
 * 화면 컴포넌트가 Supabase 쿼리를 직접 들고 있지 않도록 여기에 모은다.
 * 모든 권한은 RLS가 결정한다(학생은 본인 것만, 관리자는 전체).
 * 새 테이블은 20260921020000_admin_learning.sql 실행 전에는 없으므로, 오류는 그대로 던지고
 * 화면에서 isMissingSchemaError로 "DB 설정 필요" 안내를 따로 보여 준다.
 */

// ─────────────────────────────────────────────
// 표시 헬퍼
// ─────────────────────────────────────────────

/** 학생 화면용 "아직 준비되지 않음" 문구(관리자용 MISSING_SCHEMA_MESSAGE는 SQL 실행 안내). */
export const STUDENT_NOT_READY_MESSAGE = "학습 기록 기능이 아직 준비되지 않았어요. 선생님께 알려 주세요.";

/** 오류 문구: 스키마 없음이면 안내 문구, 아니면 fallback */
export function errorMessage(missing: boolean, fallback: string, audience: "admin" | "student" = "admin"): string {
  if (!missing) return fallback;
  return audience === "admin" ? MISSING_SCHEMA_MESSAGE : STUDENT_NOT_READY_MESSAGE;
}

export { isMissingSchemaError };

/** 앱 제목: src/data/apps.ts의 웹앱 → 과학 차시 앱(science-curriculum) 순서로 찾는다. 없으면 null */
export function appTitle(appId: string): string | null {
  return webApps.find((a) => a.id === appId)?.title ?? findResponseApp(appId)?.title ?? null;
}

/** 앱 표시 이름(학생 화면). 목록에 없으면 "삭제된 앱"(spec §3.8) */
export function appLabel(appId: string): string {
  return appTitle(appId) ?? "삭제된 앱";
}

/** 앱 표시 이름(관리자 화면). 목록에 없으면 app_id를 그대로 보여 준다(등록 전 앱도 구분할 수 있게). */
export function appLabelAdmin(appId: string): string {
  return appTitle(appId) ?? appId;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}분 ${rest}초` : `${m}분`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}

function num(n: number | string | null | undefined): number | null {
  if (n == null) return null;
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : null;
}

/** "8 / 10", 점수 없으면 "—" (numeric 컬럼은 문자열로 올 수 있어 숫자로 바꾼다) */
export function formatScore(score: number | string | null, maxScore: number | string | null): string {
  const s = num(score);
  const m = num(maxScore);
  if (s == null) return "—";
  const fmt = (v: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(v);
  return m == null ? fmt(s) : `${fmt(s)} / ${fmt(m)}`;
}

/** 점수 비율(0~1). 만점이 없거나 0이면 null */
export function scoreRatio(score: number | string | null, maxScore: number | string | null): number | null {
  const s = num(score);
  const m = num(maxScore);
  if (s == null || m == null || m <= 0) return null;
  return s / m;
}

/** 이상치(만점 · 0초 · 음수 점수 등) — 관리자 화면에서 눈에 띄게 한다(spec §8). */
export function isSuspiciousResult(r: Pick<AppResult, "score" | "max_score" | "duration_seconds">): boolean {
  const ratio = scoreRatio(r.score, r.max_score);
  if (ratio != null && ratio > 1) return true;
  if (r.duration_seconds === 0 && ratio != null && ratio >= 1) return true;
  const s = num(r.score);
  return s != null && s < 0;
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "제출",
  reviewed: "검토 완료",
  needs_revision: "수정 요청",
};

/** §14 Q1: 마감 후 제출이면 "지각" 배지(막지는 않는다). */
export function isLate(submittedAt: string | null | undefined, dueAt: string | null | undefined): boolean {
  if (!submittedAt || !dueAt) return false;
  return new Date(submittedAt).getTime() > new Date(dueAt).getTime();
}

export function isPastDue(dueAt: string | null | undefined, now = Date.now()): boolean {
  return !!dueAt && now >= new Date(dueAt).getTime();
}

/**
 * §14 Q8: 학생 본인 삭제 가능 조건(RLS 정책과 같은 조건).
 * 검토 완료(reviewed) 전이고, 마감이 없거나 마감 전일 때만.
 * 불가능하면 이유 문구, 가능하면 null.
 */
export function studentDeleteBlockReason(
  submission: Pick<AssignmentSubmission, "status">,
  dueAt: string | null | undefined,
): string | null {
  if (submission.status === "reviewed") return "선생님이 검토를 마친 제출물은 삭제할 수 없어요.";
  if (isPastDue(dueAt)) return "마감이 지난 제출물은 삭제할 수 없어요. 내용 수정은 할 수 있어요.";
  return null;
}

/** datetime-local 입력값("2026-09-21T15:30") ↔ ISO(timestamptz). 로컬 시간대 기준. */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 오늘 0시(브라우저 시간대)의 ISO 문자열 */
export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─────────────────────────────────────────────
// 웹앱 결과
// ─────────────────────────────────────────────

type ProfileMini = Pick<Profile, "display_name" | "avatar_url" | "withdrawn_at">;

export type AppResultWithStudent = AppResult & { profiles: ProfileMini | null };

const APP_RESULT_COLUMNS = "id,user_id,app_id,score,max_score,completed,duration_seconds,details,created_at";

/** 한 회원의 웹앱 결과(최신순). RLS: 본인 또는 관리자 */
export async function fetchUserAppResults(userId: string, limit = 500): Promise<AppResult[]> {
  const { data, error } = await supabase
    .from("app_results")
    .select(APP_RESULT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppResult[];
}

/** 전체 또는 앱별 결과 + 학생 프로필(관리자). */
export async function fetchAppResultsWithStudents(opts: { appId?: string; limit?: number } = {}): Promise<AppResultWithStudent[]> {
  let q = supabase
    .from("app_results")
    .select(`${APP_RESULT_COLUMNS},profiles(${AUTHOR_PROFILE_COLUMNS})`)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 1000);
  if (opts.appId) q = q.eq("app_id", opts.appId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AppResultWithStudent[];
}

export type AppSummary = {
  appId: string;
  title: string;
  /** src/data/apps.ts에 등록된 앱인지 */
  registered: boolean;
  attempts: number;
  students: number;
  completed: number;
  /** 점수 비율 평균(0~1). 만점 정보가 있는 기록만 */
  avgRatio: number | null;
  lastAt: string | null;
};

type AppStatRow = {
  app_id: string;
  attempts: number;
  students: number;
  completed: number;
  avg_ratio: number | null;
  last_at: string | null;
};

/**
 * 앱별 집계(관리자 개요). 서버 RPC(app_result_stats, group by)로 전체 기록을 센다 — 1000행 제한 없음(review #4).
 * 등록된 앱은 기록이 없어도 0으로 보여 준다.
 */
export async function fetchAppSummaries(): Promise<{ total: number; apps: AppSummary[] }> {
  const rows = await fetchAllPages<AppStatRow>((from, to) =>
    supabase.rpc("app_result_stats", {}, { count: "exact" }).order("app_id").range(from, to),
  );
  const map = new Map<string, AppStatRow>();
  for (const r of rows) map.set(r.app_id, r);
  for (const app of webApps) {
    if (!map.has(app.id)) {
      map.set(app.id, { app_id: app.id, attempts: 0, students: 0, completed: 0, avg_ratio: null, last_at: null });
    }
  }
  const apps = [...map.values()]
    .map((v) => ({
      appId: v.app_id,
      title: appTitle(v.app_id) ?? v.app_id,
      registered: appTitle(v.app_id) != null,
      attempts: Number(v.attempts ?? 0),
      students: Number(v.students ?? 0),
      completed: Number(v.completed ?? 0),
      avgRatio: v.avg_ratio == null ? null : Number(v.avg_ratio),
      lastAt: v.last_at,
    }))
    .sort((a, b) => Number(b.registered) - Number(a.registered) || b.attempts - a.attempts || a.title.localeCompare(b.title, "ko"));
  return { total: apps.reduce((n, a) => n + a.attempts, 0), apps };
}

// ─────────────────────────────────────────────
// 읽은 글 · 댓글 · 좋아요
// ─────────────────────────────────────────────

type PostMini = { title: string; slug: string; published?: boolean };

export type PostReadRow = PostRead & { posts: PostMini | null };

/** 한 회원이 읽은 글(최근 읽은 순). 글 기록은 record_post_read RPC로만 쌓인다. */
export async function fetchUserPostReads(userId: string): Promise<PostReadRow[]> {
  const { data, error } = await supabase
    .from("post_reads")
    .select("user_id,post_id,first_read_at,last_read_at,read_count,posts(title,slug,published)")
    .eq("user_id", userId)
    .order("last_read_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as PostReadRow[];
}

export type UserCommentRow = { id: string; body: string; created_at: string; post_id: string; posts: PostMini | null };
export type UserLikeRow = { post_id: string; created_at: string; posts: PostMini | null };

export async function fetchUserComments(userId: string): Promise<UserCommentRow[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id,body,created_at,post_id,posts(title,slug,published)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as UserCommentRow[];
}

export async function fetchUserLikes(userId: string): Promise<UserLikeRow[]> {
  const { data, error } = await supabase
    .from("likes")
    .select("post_id,created_at,posts(title,slug,published)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as UserLikeRow[];
}

/** 로그인 사용자가 글을 열면 읽기 기록(실패해도 화면에는 영향 없음). */
export async function recordPostRead(postId: string): Promise<boolean> {
  const { error } = await supabase.rpc("record_post_read", { p_post_id: postId });
  return !error;
}

export type PostEngagementRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  views: number;
  comments: number;
  likes: number;
  /** 읽은 인원 수. post_reads가 없거나 조회 실패 시 null */
  readers: number | null;
};

type CountEmbed = { count: number }[] | null;

type PostEngagementDbRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  comments: CountEmbed;
  likes: CountEmbed;
  post_reads?: CountEmbed;
};

/**
 * 글별 참여 집계(관리자). embed count(서버 집계)로 센다(spec §4.9).
 * 읽은 인원도 post_reads(count) embed라 행 수 제한과 무관하다(review #4). 글·조회수 목록은 페이지로 나눠 전부 받는다.
 */
export async function fetchPostEngagement(): Promise<{ rows: PostEngagementRow[]; readersMissing: boolean }> {
  const loadPosts = (withReads: boolean) =>
    fetchAllPages<PostEngagementDbRow>((from, to) =>
      supabase
        .from("posts")
        .select(`id,slug,title,published,created_at,comments(count),likes(count)${withReads ? ",post_reads(count)" : ""}`, {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  const [postsRes, views] = await Promise.all([
    loadPosts(true).then(
      (rows) => ({ rows, readersMissing: false }),
      async (err: unknown) => {
        // post_reads 테이블이 아직 없으면(마이그레이션 전) 읽은 인원 없이 보여 준다.
        if (!isMissingSchemaError(err)) throw err;
        return { rows: await loadPosts(false), readersMissing: true };
      },
    ),
    fetchAllPages<{ post_id: string; count: number }>((from, to) =>
      supabase.from("views").select("post_id,count", { count: "exact" }).order("post_id").range(from, to),
    ),
  ]);
  const viewMap = new Map<string, number>();
  for (const v of views) viewMap.set(v.post_id, Number(v.count));
  const rows = postsRes.rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    published: p.published,
    views: viewMap.get(p.id) ?? 0,
    comments: p.comments?.[0]?.count ?? 0,
    likes: p.likes?.[0]?.count ?? 0,
    readers: postsRes.readersMissing ? null : (p.post_reads?.[0]?.count ?? 0),
  }));
  return { rows, readersMissing: postsRes.readersMissing };
}

export type StudentEngagementRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** 탈퇴 처리된 시각. 있으면 화면에서 이름을 "탈퇴한 학생"으로 바꾼다. */
  withdrawn_at: string | null;
  role: Profile["role"];
  comments: number;
  likes: number;
  reads: number;
  results: number;
  submissions: number;
};

/** 학생별 참여 집계(관리자). profiles에서 embed count. */
export async function fetchStudentEngagement(): Promise<StudentEngagementRow[]> {
  const data = await fetchAllPages<unknown>((from, to) =>
    supabase
      .from("profiles")
      .select(
        `id,${AUTHOR_PROFILE_COLUMNS},role,comments(count),likes(count),post_reads(count),app_results(count),assignment_submissions(count)`,
        { count: "exact" },
      )
      .order("display_name", { ascending: true })
      .order("id")
      .range(from, to),
  );
  return (data as {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    withdrawn_at: string | null;
    role: Profile["role"];
    comments: CountEmbed;
    likes: CountEmbed;
    post_reads: CountEmbed;
    app_results: CountEmbed;
    assignment_submissions: CountEmbed;
  }[]).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    withdrawn_at: p.withdrawn_at ?? null,
    role: p.role,
    comments: p.comments?.[0]?.count ?? 0,
    likes: p.likes?.[0]?.count ?? 0,
    reads: p.post_reads?.[0]?.count ?? 0,
    results: p.app_results?.[0]?.count ?? 0,
    submissions: p.assignment_submissions?.[0]?.count ?? 0,
  }));
}

// ─────────────────────────────────────────────
// 과제
// ─────────────────────────────────────────────

const ASSIGNMENT_COLUMNS = "id,title,description_md,due_at,published,created_by,created_at,updated_at";
const SUBMISSION_COLUMNS = "id,assignment_id,user_id,body_md,link_url,status,submitted_at,updated_at";

export type AssignmentWithCount = Assignment & { submission_count: number };

/** 과제 목록. 관리자는 비공개 포함 전체, 학생은 RLS로 공개 과제만. */
export async function fetchAssignments(): Promise<AssignmentWithCount[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(`${ASSIGNMENT_COLUMNS},assignment_submissions(count)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as (Assignment & { assignment_submissions: CountEmbed })[]).map(
    ({ assignment_submissions, ...a }) => ({ ...a, submission_count: assignment_submissions?.[0]?.count ?? 0 }),
  );
}

/** 공개 과제만(학생 화면). 관리자가 학생 화면을 볼 때도 공개 과제만 보이게 명시적으로 거른다. */
export async function fetchPublishedAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Assignment[];
}

export async function fetchAssignment(id: string): Promise<Assignment | null> {
  const { data, error } = await supabase.from("assignments").select(ASSIGNMENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Assignment | null) ?? null;
}

export type AssignmentInput = {
  title: string;
  description_md: string;
  due_at: string | null;
  published: boolean;
};

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const { data, error } = await supabase.from("assignments").insert(input).select(ASSIGNMENT_COLUMNS).single();
  if (error) throw error;
  return data as Assignment;
}

export async function updateAssignment(id: string, patch: Partial<AssignmentInput>): Promise<Assignment> {
  const { data, error } = await supabase.from("assignments").update(patch).eq("id", id).select(ASSIGNMENT_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("not-updated");
  return data as Assignment;
}

/** 과제 삭제(제출물도 cascade로 함께 삭제). 0건이면 실패로 본다. */
export async function deleteAssignment(id: string): Promise<void> {
  const { data, error } = await supabase.from("assignments").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("not-deleted");
}

export async function fetchSubmissionsForAssignment(assignmentId: string): Promise<AssignmentSubmission[]> {
  return fetchAllPages<AssignmentSubmission>((from, to) =>
    supabase
      .from("assignment_submissions")
      .select(SUBMISSION_COLUMNS, { count: "exact" })
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: true })
      .order("id")
      .range(from, to),
  );
}

export type SubmissionWithAssignment = AssignmentSubmission & {
  assignments: Pick<Assignment, "id" | "title" | "due_at" | "published"> | null;
};

/** 한 회원의 제출물 + 과제 정보 */
export async function fetchUserSubmissions(userId: string): Promise<SubmissionWithAssignment[]> {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(`${SUBMISSION_COLUMNS},assignments(id,title,due_at,published)`)
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SubmissionWithAssignment[];
}

export type SubmissionInput = { body_md: string; link_url: string | null };

/** 학생 제출(status/submitted_at은 DB 트리거가 강제). */
export async function createSubmission(assignmentId: string, input: SubmissionInput): Promise<AssignmentSubmission> {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .insert({ assignment_id: assignmentId, ...input })
    .select(SUBMISSION_COLUMNS)
    .single();
  if (error) throw error;
  return data as AssignmentSubmission;
}

export async function updateSubmissionContent(id: string, input: SubmissionInput): Promise<AssignmentSubmission> {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .update(input)
    .eq("id", id)
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("not-updated");
  return data as AssignmentSubmission;
}

/** 관리자 상태 변경 */
export async function updateSubmissionStatus(id: string, status: SubmissionStatus): Promise<AssignmentSubmission> {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({ status })
    .eq("id", id)
    .select(SUBMISSION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("not-updated");
  return data as AssignmentSubmission;
}

/** 제출 삭제(학생: §14 Q8 조건을 RLS가 강제 → 0건이면 실패). */
export async function deleteSubmission(id: string): Promise<void> {
  const { data, error } = await supabase.from("assignment_submissions").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("not-deleted");
}

/** 제출 폼 검증 */
export const SUBMISSION_BODY_MAX = 20000;
export const SUBMISSION_LINK_MAX = 2000;

// ─────────────────────────────────────────────
// 최근 학습활동(웹앱 결과 + 과제 제출 섞어서)
// ─────────────────────────────────────────────

export type ActivityItem =
  | { kind: "app_result"; id: string; at: string; userId: string; student: ProfileMini | null; result: AppResult }
  | {
      kind: "submission";
      id: string;
      at: string;
      userId: string;
      student: ProfileMini | null;
      submission: AssignmentSubmission;
      assignment: Pick<Assignment, "id" | "title" | "due_at"> | null;
    };

/** 최근 활동 n건(관리자). 제출은 처음 제출한 시각(submitted_at) 기준 — updated_at은 관리자 상태 변경에도 바뀐다. */
export async function fetchRecentActivity(limit: number): Promise<ActivityItem[]> {
  const [resultsRes, subsRes] = await Promise.all([
    supabase
      .from("app_results")
      .select(`${APP_RESULT_COLUMNS},profiles(${AUTHOR_PROFILE_COLUMNS})`)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("assignment_submissions")
      .select(`${SUBMISSION_COLUMNS},profiles(${AUTHOR_PROFILE_COLUMNS}),assignments(id,title,due_at)`)
      .order("submitted_at", { ascending: false })
      .limit(limit),
  ]);
  if (resultsRes.error) throw resultsRes.error;
  if (subsRes.error) throw subsRes.error;
  const items: ActivityItem[] = [];
  for (const r of (resultsRes.data ?? []) as unknown as AppResultWithStudent[]) {
    const { profiles, ...result } = r;
    items.push({ kind: "app_result", id: `r:${r.id}`, at: r.created_at, userId: r.user_id, student: profiles, result });
  }
  for (const s of (subsRes.data ?? []) as unknown as (AssignmentSubmission & {
    profiles: ProfileMini | null;
    assignments: Pick<Assignment, "id" | "title" | "due_at"> | null;
  })[]) {
    const { profiles, assignments, ...submission } = s;
    items.push({
      kind: "submission",
      id: `s:${s.id}`,
      at: s.submitted_at,
      userId: s.user_id,
      student: profiles,
      submission,
      assignment: assignments,
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}

// ─────────────────────────────────────────────
// 피드백
// ─────────────────────────────────────────────

export const FEEDBACK_BODY_MAX = 2000;

/** 스레드 변경(읽음 표시 · 새 메시지)을 알려 안 읽음 배지를 다시 세게 한다. */
export const FEEDBACK_CHANGED_EVENT = "class1:feedback-changed";

export function notifyFeedbackChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FEEDBACK_CHANGED_EVENT));
}

export type FeedbackMessageWithSender = FeedbackMessage & {
  profiles: (ProfileMini & Pick<Profile, "role">) | null;
};

export type FeedbackContext = { type: FeedbackContextType; id: string | null };

/** 기존 스레드 찾기(없으면 null). 빈 스레드가 쌓이지 않도록 첫 메시지를 보낼 때 만든다. */
export async function findFeedbackThread(studentId: string, context: FeedbackContext): Promise<FeedbackThread | null> {
  const key = `${context.type}:${context.type === "general" ? "" : (context.id ?? "")}`;
  const { data, error } = await supabase
    .from("feedback_threads")
    .select("id,student_id,context_type,context_id,context_key,created_at")
    .eq("student_id", studentId)
    .eq("context_key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as FeedbackThread | null) ?? null;
}

/** 스레드 찾기/만들기(get_or_create_feedback_thread RPC — 경쟁 상태 없이). */
export async function getOrCreateFeedbackThread(studentId: string, context: FeedbackContext): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_feedback_thread", {
    p_student_id: studentId,
    p_context_type: context.type,
    p_context_id: context.type === "general" ? null : context.id,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("thread-not-created");
  return data;
}

/** 한 스레드에서 한 번에 보여 주는 최대 메시지 수(최신 것부터). */
export const FEEDBACK_MESSAGES_MAX = 1000;

/**
 * 스레드 메시지(오래된 것 → 최신 순으로 정렬해 돌려준다).
 * 1000개가 넘으면 **최신** 1000개만 보여 주고 total로 전체 개수를 알린다(예전에는 오래된 1000개만 보였다).
 */
export async function fetchFeedbackMessages(threadId: string): Promise<{ messages: FeedbackMessageWithSender[]; total: number }> {
  const { data, error, count } = await supabase
    .from("feedback_messages")
    .select(`id,thread_id,sender_id,body,created_at,profiles(${AUTHOR_PROFILE_COLUMNS},role)`, { count: "exact" })
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEEDBACK_MESSAGES_MAX);
  if (error) throw error;
  const messages = ((data ?? []) as unknown as FeedbackMessageWithSender[]).reverse();
  return { messages, total: count ?? messages.length };
}

export async function sendFeedbackMessage(threadId: string, body: string): Promise<FeedbackMessageWithSender> {
  const { data, error } = await supabase
    .from("feedback_messages")
    .insert({ thread_id: threadId, body })
    .select(`id,thread_id,sender_id,body,created_at,profiles(${AUTHOR_PROFILE_COLUMNS},role)`)
    .single();
  if (error) throw error;
  return data as unknown as FeedbackMessageWithSender;
}

/**
 * 읽음 표시: 화면에 보여 준 마지막 메시지의 created_at까지만 읽음으로 기록한다(review #5).
 * until은 서버가 준 문자열 그대로 넘긴다(Date로 바꾸면 마이크로초가 잘려 그 메시지가 빠질 수 있다).
 * 서버는 이 스레드에 실제로 있는 메시지 시각으로 다시 맞추므로 미래 시각·다른 스레드 시각은 무시된다.
 */
export async function markThreadRead(threadId: string, until: string | null | undefined): Promise<void> {
  if (!until) return;
  const { error } = await supabase.rpc("mark_thread_read", { p_thread_id: threadId, p_until: until });
  if (!error) notifyFeedbackChanged();
}

/** 안 읽은 피드백 메시지 수(본인 기준: 학생은 선생님 메시지, 관리자는 학생 메시지). */
export async function fetchUnreadFeedbackCount(): Promise<number> {
  const { data, error } = await supabase.rpc("unread_feedback_count");
  if (error) throw error;
  return typeof data === "number" ? data : Number(data ?? 0);
}

export type ThreadContextInfo =
  | { kind: "general"; label: string }
  | { kind: "app_result"; label: string; deleted: boolean; result?: Pick<AppResult, "id" | "app_id" | "score" | "max_score" | "created_at"> }
  | {
      kind: "assignment_submission";
      label: string;
      deleted: boolean;
      assignmentId?: string;
    };

export type ThreadSummary = FeedbackThread & {
  student: ProfileMini | null;
  context: ThreadContextInfo;
  messageCount: number;
  lastMessageAt: string | null;
  lastMessage: string | null;
  lastSenderId: string | null;
  /** 내가 읽지 않은(상대가 보낸) 메시지 수 */
  unread: number;
};

type ThreadSummaryStat = {
  thread_id: string;
  message_count: number;
  last_message_at: string | null;
  last_message: string | null;
  last_sender_id: string | null;
  unread: number;
};

/**
 * 스레드 요약(메시지 수 · 마지막 메시지 · 안 읽은 수 · 연결 대상 이름).
 * studentId를 주면 그 학생 스레드만, 없으면(관리자) 전체.
 * - 스레드 목록과 통계(feedback_thread_summaries RPC, 서버 집계)는 모두 페이지로 나눠 전부 받는다(review #4, #7).
 *   안 읽은 수는 unread_feedback_count(헤더 배지)와 같은 기준이라 배지와 목록이 어긋나지 않는다.
 * - profiles embed는 FK를 명시한다: feedback_read_marks가 threads↔profiles 조인 테이블로도 인식돼
 *   그냥 profiles(...)라고 쓰면 PGRST201(관계가 여러 개)이 난다(review #1).
 * - audience: 학생 화면이면 목록에 없는 앱을 "삭제된 앱"으로 표시한다(review #23).
 */
export async function fetchThreadSummaries(
  studentId?: string,
  audience: "admin" | "student" = "admin",
): Promise<ThreadSummary[]> {
  const [threads, stats] = await Promise.all([
    fetchAllPages<FeedbackThread & { profiles: ProfileMini | null }>((from, to) => {
      let q = supabase
        .from("feedback_threads")
        .select(
          `id,student_id,context_type,context_id,context_key,created_at,profiles!feedback_threads_student_id_fkey(${AUTHOR_PROFILE_COLUMNS})`,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to);
      if (studentId) q = q.eq("student_id", studentId);
      return q;
    }),
    fetchAllPages<ThreadSummaryStat>((from, to) =>
      supabase
        .rpc("feedback_thread_summaries", { p_student_id: studentId ?? null }, { count: "exact" })
        .order("thread_id")
        .range(from, to),
    ),
  ]);
  if (!threads.length) return [];

  const statMap = new Map<string, ThreadSummaryStat>();
  for (const st of stats) statMap.set(st.thread_id, st);

  const contexts = await resolveThreadContexts(threads, audience);

  return threads
    .map((t) => {
      const { profiles, ...thread } = t;
      const st = statMap.get(t.id);
      return {
        ...thread,
        student: profiles,
        context: contexts.get(t.id) ?? { kind: "general" as const, label: "일반 대화" },
        messageCount: Number(st?.message_count ?? 0),
        lastMessageAt: st?.last_message_at ?? null,
        lastMessage: st?.last_message ?? null,
        lastSenderId: st?.last_sender_id ?? null,
        unread: Number(st?.unread ?? 0),
      };
    })
    .sort((a, b) => {
      // 일반 대화가 맨 앞, 그다음 최근 메시지 순
      if (studentId && a.context_type !== b.context_type) {
        if (a.context_type === "general") return -1;
        if (b.context_type === "general") return 1;
      }
      const at = a.lastMessageAt ?? a.created_at;
      const bt = b.lastMessageAt ?? b.created_at;
      return at < bt ? 1 : at > bt ? -1 : 0;
    });
}

/** in.(...) 필터 한 번에 넣는 id 수(GET URL 길이 제한 회피, review #7) */
const IN_CHUNK = 100;

/**
 * 연결 대상(웹앱 결과 · 과제 제출) 이름 찾기. 원본이 지워졌으면 "삭제된 …"으로 표시한다.
 * 조회 자체가 실패하면 throw한다 — 실패를 "삭제됨"으로 잘못 표시하지 않기 위해서다(review #7).
 */
export async function resolveThreadContexts(
  threads: Pick<FeedbackThread, "id" | "context_type" | "context_id">[],
  audience: "admin" | "student" = "admin",
): Promise<Map<string, ThreadContextInfo>> {
  const resultIds = [...new Set(threads.filter((t) => t.context_type === "app_result" && t.context_id).map((t) => t.context_id!))];
  const subIds = [
    ...new Set(threads.filter((t) => t.context_type === "assignment_submission" && t.context_id).map((t) => t.context_id!)),
  ];
  const [resultRows, subRows] = await Promise.all([
    Promise.all(
      chunk(resultIds, IN_CHUNK).map(async (ids) => {
        const { data, error } = await supabase.from("app_results").select("id,app_id,score,max_score,created_at").in("id", ids);
        if (error) throw error;
        return (data ?? []) as Pick<AppResult, "id" | "app_id" | "score" | "max_score" | "created_at">[];
      }),
    ),
    Promise.all(
      chunk(subIds, IN_CHUNK).map(async (ids) => {
        const { data, error } = await supabase
          .from("assignment_submissions")
          .select("id,assignment_id,assignments(title)")
          .in("id", ids);
        if (error) throw error;
        return (data ?? []) as unknown as { id: string; assignment_id: string; assignments: { title: string } | null }[];
      }),
    ),
  ]);
  const results = new Map<string, Pick<AppResult, "id" | "app_id" | "score" | "max_score" | "created_at">>();
  for (const r of resultRows.flat()) results.set(r.id, r);
  const subs = new Map<string, { assignment_id: string; title: string | null }>();
  for (const s of subRows.flat()) subs.set(s.id, { assignment_id: s.assignment_id, title: s.assignments?.title ?? null });

  const appName = audience === "student" ? appLabel : appLabelAdmin;
  const map = new Map<string, ThreadContextInfo>();
  for (const t of threads) {
    if (t.context_type === "app_result") {
      const r = t.context_id ? results.get(t.context_id) : undefined;
      map.set(
        t.id,
        r
          ? { kind: "app_result", label: `웹앱 결과 · ${appName(r.app_id)}`, deleted: false, result: r }
          : { kind: "app_result", label: "삭제된 웹앱 기록", deleted: true },
      );
    } else if (t.context_type === "assignment_submission") {
      const s = t.context_id ? subs.get(t.context_id) : undefined;
      map.set(
        t.id,
        s
          ? { kind: "assignment_submission", label: `과제 · ${s.title ?? "제목 없음"}`, deleted: false, assignmentId: s.assignment_id }
          : { kind: "assignment_submission", label: "삭제된 제출물", deleted: true },
      );
    } else {
      map.set(t.id, { kind: "general", label: "일반 대화" });
    }
  }
  return map;
}

// ─────────────────────────────────────────────
// 개요 통계
// ─────────────────────────────────────────────

export type LearningStats = {
  totalMembers: number;
  resultsToday: number;
  pendingSubmissions: number;
  unreadFeedback: number;
};

/**
 * admin_dashboard_stats() RPC(카드 4개) + "오늘 학습결과"는 브라우저 시간대의 자정 기준으로 다시 센다.
 * (RPC는 DB 시간대(UTC) 기준 date_trunc라, 한국 시간 오전 9시 전 결과가 "어제"로 빠진다.)
 */
export async function fetchLearningStats(): Promise<LearningStats> {
  const [statsRes, todayRes] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.from("app_results").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayIso()),
  ]);
  if (statsRes.error) throw statsRes.error;
  const row = (Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data) as
    | { total_members: number; results_today: number; pending_submissions: number; unread_feedback: number }
    | undefined;
  if (!row) throw new Error("not-admin");
  return {
    totalMembers: Number(row.total_members ?? 0),
    resultsToday: todayRes.error ? Number(row.results_today ?? 0) : (todayRes.count ?? 0),
    pendingSubmissions: Number(row.pending_submissions ?? 0),
    unreadFeedback: Number(row.unread_feedback ?? 0),
  };
}

/** 학생(일반 회원) 목록: 과제 제출 현황의 "미제출" 행을 만들 때 쓴다. */
export type StudentMini = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  withdrawn_at: string | null;
  email: string | null;
  /** 학급 id(학급 범위로 읽었을 때만). 관리자 화면 전용 */
  class_id?: string | null;
};

/**
 * 학생 명단(학습 기록 화면의 "미제출·시작 안 함" 행과 학생 수).
 * classIds — 학급 범위(docs/classes/spec.md 개정 1-1: 학습 기록은 **자기 학급 학생만** 본다, 총괄도 같음):
 *   - 배열이면 그 학급 학생만. 총괄은 member_directory에서 모든 회원을 읽을 수 있으므로(명단 관리용) 반드시 걸러야
 *     다른 학급 학생이 "시작 안 함·미제출"로 섞여 보이지 않는다. 빈 배열이면 학생 없음.
 *   - null이면 거르지 않는다(학급 기능 SQL 적용 전의 예전 동작).
 */
export async function fetchStudents(classIds: readonly string[] | null = null): Promise<StudentMini[]> {
  if (classIds && classIds.length === 0) return [];
  const data = await fetchAllPages<unknown>((from, to) => {
    let q = supabase
      .from("member_directory")
      .select(`id,email,${classIds ? "class_id," : ""}profiles!inner(${AUTHOR_PROFILE_COLUMNS},role)`, { count: "exact" })
      .eq("profiles.role", "user");
    if (classIds) q = q.in("class_id", [...classIds]);
    return q.order("id").range(from, to);
  });
  return (data as { id: string; email: string; class_id?: string | null; profiles: ProfileMini | null }[]).map((m) => ({
    id: m.id,
    email: m.email,
    display_name: m.profiles?.display_name ?? null,
    avatar_url: m.profiles?.avatar_url ?? null,
    withdrawn_at: m.profiles?.withdrawn_at ?? null,
    ...(classIds ? { class_id: m.class_id ?? null } : {}),
  }));
}

// ─────────────────────────────────────────────
// 학생 응답(앱별 모아 보기 · 일괄 칭찬) — docs/admin/responses-spec.md §4
// ─────────────────────────────────────────────

/** app_progress 한 행(관리자 조회 가능, 20260922010000_app_progress.sql) */
export type AppProgressRow = { user_id: string; app_id: string; state: unknown; updated_at: string };

/** 한 앱의 전체 결과(최신순, 학생 프로필 포함). 1000행이 넘어도 페이지로 나눠 모두 받는다. */
export async function fetchAllAppResults(appId: string): Promise<AppResultWithStudent[]> {
  return fetchAllPages<AppResultWithStudent>((from, to) =>
    supabase
      .from("app_results")
      .select(`${APP_RESULT_COLUMNS},profiles(${AUTHOR_PROFILE_COLUMNS})`, { count: "exact" })
      .eq("app_id", appId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

/**
 * 한 앱의 진행 중 스냅샷(관리자). 테이블이 아직 없으면(마이그레이션 전) missing=true와 빈 목록.
 * state 전체를 받지만 화면은 단계(keys.step)와 저장 시각만 쓴다(spec §12 Q3).
 */
export async function fetchAppProgressRows(appId: string): Promise<{ rows: AppProgressRow[]; missing: boolean }> {
  try {
    const rows = await fetchAllPages<AppProgressRow>((from, to) =>
      supabase
        .from("app_progress")
        .select("user_id,app_id,state,updated_at", { count: "exact" })
        .eq("app_id", appId)
        .order("user_id")
        .range(from, to),
    );
    return { rows, missing: false };
  } catch (err) {
    if (isMissingSchemaError(err)) return { rows: [], missing: true };
    throw err;
  }
}

/**
 * 결과(app_result)마다 관리자가 보낸 피드백 메시지가 있는지 — 일괄 칭찬 "이미 보냄" 표시(spec §4.5, Q7 클라이언트 조합 쿼리).
 * 학생 본인이 아닌 사람이 보낸 메시지를 선생님 메시지로 본다(스레드 주인은 학생).
 * 돌려주는 Map: 결과 id → 선생님 메시지 수
 */
export async function fetchTeacherFeedbackCounts(results: { id: string; user_id: string }[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!results.length) return out;
  const threads = (
    await Promise.all(
      chunk(
        [...new Set(results.map((r) => r.id))],
        IN_CHUNK,
      ).map(async (ids) => {
        const { data, error } = await supabase
          .from("feedback_threads")
          .select("id,student_id,context_id")
          .eq("context_type", "app_result")
          .in("context_id", ids);
        if (error) throw error;
        return (data ?? []) as { id: string; student_id: string; context_id: string }[];
      }),
    )
  ).flat();
  if (!threads.length) return out;
  const threadById = new Map(threads.map((t) => [t.id, t]));
  const messages = (
    await Promise.all(
      chunk(threads.map((t) => t.id), IN_CHUNK).map((ids) =>
        fetchAllPages<{ id: string; thread_id: string; sender_id: string }>((from, to) =>
          supabase
            .from("feedback_messages")
            .select("id,thread_id,sender_id", { count: "exact" })
            .in("thread_id", ids)
            .order("id")
            .range(from, to),
        ),
      ),
    )
  ).flat();
  for (const m of messages) {
    const t = threadById.get(m.thread_id);
    if (!t || m.sender_id === t.student_id) continue;
    out.set(t.context_id, (out.get(t.context_id) ?? 0) + 1);
  }
  return out;
}
