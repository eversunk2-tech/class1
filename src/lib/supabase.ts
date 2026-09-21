import { createClient } from "@supabase/supabase-js";

// 브라우저 전용 Supabase 클라이언트. anon key만 사용하며 권한은 RLS로 제어한다.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
