// supabase/migrations/20260921000000_init_blog.sql 테이블 타입

export type Role = "admin" | "user";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
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
  profiles: Pick<Profile, "display_name" | "avatar_url"> | null;
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
