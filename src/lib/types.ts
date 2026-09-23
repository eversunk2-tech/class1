// supabase/migrations/*.sql 테이블 타입 (init_blog, admin_learning)

export type Role = "admin" | "user";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  /** 관리자가 비밀번호를 초기화하면 true. 본인이 비밀번호를 바꾸면 DB 트리거가 false로 만든다.
   *  컬럼 권한상 profiles에서 직접 읽지 않고 my_must_change_password()/admin_must_change_password_ids() RPC로 채운다.
   *  확인하지 못했으면 undefined. */
  must_change_password?: boolean;
  /** 관리자가 완전 탈퇴 처리한 시각(20260923000000_member_withdrawal.sql).
   *  null = 정상 회원. 값이 있으면 계정(auth.users)은 이미 삭제됐고 기록만 남은 상태다.
   *  이름은 화면 전체에서 "탈퇴한 학생"으로 바꿔 보여 준다(profileDisplayName).
   *  **필수 필드로 둔다**: select 목록에서 빠뜨리면 타입 오류가 나 실명 노출을 막는다(review U5). */
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string;
  cover_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

/** 목록 화면에서 조회하는 컬럼만 담은 글 요약 */
export type PostSummary = Pick<
  Post,
  "id" | "slug" | "title" | "summary" | "cover_url" | "tags" | "published_at"
>;

export const POST_SUMMARY_COLUMNS = "id,slug,title,summary,cover_url,tags,published_at";

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

/** 댓글 + 작성자 프로필(profiles 조인) */
export type CommentWithAuthor = Pick<Comment, "id" | "body" | "created_at" | "user_id"> & {
  profiles: Pick<Profile, "display_name" | "avatar_url" | "withdrawn_at"> | null;
};

export type Like = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type ViewRow = {
  post_id: string;
  count: number;
  updated_at: string;
};

// ─────────────────────────────────────────────
// 20260921020000_admin_learning.sql
// ─────────────────────────────────────────────

/** auth.users 동기화 테이블(관리자만 조회 가능) */
export type MemberDirectory = {
  id: string;
  email: string;
  /** 대표 가입 방식(email/github/google) */
  provider: string | null;
  /** 연결된 모든 가입 방식 */
  providers: string[];
  signed_up_at: string;
  last_sign_in_at: string | null;
  updated_at: string;
};

/** 회원 목록 1행: member_directory + profiles 조인 */
export type MemberRow = MemberDirectory & {
  profiles: Pick<Profile, "display_name" | "avatar_url" | "role" | "must_change_password" | "withdrawn_at"> | null;
};

/** must_change_password는 컬럼 권한으로 막혀 있어(20260922000000) embed하지 않는다 → admin.ts가 RPC로 채운다.
 *  withdrawn_at은 20260923000000에서 공개 컬럼으로 열어 두었다. */
export const MEMBER_ROW_COLUMNS =
  "id,email,provider,providers,signed_up_at,last_sign_in_at,updated_at,profiles(display_name,avatar_url,role,withdrawn_at)";

/** profiles에서 클라이언트가 읽을 수 있는 컬럼(select("*")는 컬럼 권한 때문에 실패한다). */
export const PROFILE_COLUMNS = "id,display_name,avatar_url,role,created_at,updated_at,withdrawn_at";

/** 작성자 이름 표시에 필요한 최소 컬럼(profiles embed). withdrawn_at이 있어야 "탈퇴한 학생"으로 바꿀 수 있다. */
export const AUTHOR_PROFILE_COLUMNS = "display_name,avatar_url,withdrawn_at";

export type AppResult = {
  id: string;
  user_id: string;
  app_id: string;
  score: number | null;
  max_score: number | null;
  completed: boolean;
  duration_seconds: number | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type PostRead = {
  user_id: string;
  post_id: string;
  first_read_at: string;
  last_read_at: string;
  read_count: number;
};

export type Assignment = {
  id: string;
  title: string;
  description_md: string;
  due_at: string | null;
  published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionStatus = "submitted" | "reviewed" | "needs_revision";

export type AssignmentSubmission = {
  id: string;
  assignment_id: string;
  user_id: string;
  body_md: string;
  link_url: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  updated_at: string;
};

export type FeedbackContextType = "general" | "app_result" | "assignment_submission";

export type FeedbackThread = {
  id: string;
  student_id: string;
  context_type: FeedbackContextType;
  context_id: string | null;
  context_key: string;
  created_at: string;
};

export type FeedbackMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/** admin_dashboard_stats() RPC 결과 1행 */
export type AdminDashboardStats = {
  total_members: number;
  results_today: number;
  pending_submissions: number;
  unread_feedback: number;
};
