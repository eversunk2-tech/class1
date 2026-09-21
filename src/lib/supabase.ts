import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 환경변수가 비어 있으면 false. 이 경우 요청은 실패하고 각 화면이 오류 상태를 표시한다. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// 브라우저 전용 Supabase 클라이언트. anon key만 사용하며 권한은 RLS로 제어한다.
// 환경변수가 없을 때도 빌드(프리렌더)가 깨지지 않도록 자리표시 값으로 생성한다.
export const supabase = createClient(
  url || "https://invalid.supabase.co",
  anonKey || "missing-anon-key",
);
