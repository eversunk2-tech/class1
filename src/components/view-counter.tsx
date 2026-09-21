"use client";

import { useEffect, useState } from "react";
import { EyeIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCount } from "@/lib/format";

const viewedKey = (slug: string) => `viewed:${slug}`;

function markViewed(slug: string): boolean {
  try {
    if (sessionStorage.getItem(viewedKey(slug))) return false;
    sessionStorage.setItem(viewedKey(slug), "1");
    return true;
  } catch {
    // sessionStorage를 쓸 수 없으면 중복 방지 없이 증가시키지 않는다.
    return false;
  }
}

function unmarkViewed(slug: string) {
  try {
    sessionStorage.removeItem(viewedKey(slug));
  } catch {}
}

async function readCount(postId: string): Promise<number | null> {
  const { data, error } = await supabase.from("views").select("count").eq("post_id", postId).maybeSingle();
  if (error) return null;
  return data ? Number(data.count) : 0;
}

/**
 * 조회수 표시 + 세션당 1회 증가(increment_post_view RPC).
 * 비공개 글(관리자 미리보기)은 증가시키지 않는다.
 */
export function ViewCounter({ postId, slug, published }: { postId: string; slug: string; published: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      let next: number | null = null;
      // 먼저 표시해 두어 StrictMode 이중 실행 시에도 한 번만 증가한다.
      if (published && markViewed(slug)) {
        const { data, error } = await supabase.rpc("increment_post_view", { p_slug: slug });
        if (error) unmarkViewed(slug);
        else if (data != null) next = Number(data);
      }
      if (next == null) next = await readCount(postId);
      if (active) setCount(next);
    };
    run();
    return () => {
      active = false;
    };
  }, [postId, slug, published]);

  return (
    <span className="inline-flex items-center gap-1" title="조회수">
      <EyeIcon className="size-3.5" aria-hidden />
      <span className="sr-only">조회수</span>
      {count == null ? "–" : formatCount(count)}
    </span>
  );
}
