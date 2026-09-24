"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";
import { LoginRequiredTooltip } from "@/components/login-required";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { loginHrefHere } from "@/lib/community";
import { formatCount } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** 커뮤니티 글 좋아요(LikeButton과 같은 동작, 대상만 community_likes). 숨긴 글에는 누를 수 없다. */
export function CommunityLikeButton({ postId, disabled = false }: { postId: string; disabled?: boolean }) {
  const router = useRouter();
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (sessionLoading) return;
    let active = true;
    const load = async () => {
      const countReq = supabase.from("community_likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId);
      const mineReq = userId
        ? supabase.from("community_likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle()
        : null;
      const [countRes, mineRes] = await Promise.all([countReq, mineReq]);
      if (!active) return;
      setCount(countRes.error ? null : (countRes.count ?? 0));
      setLiked(!!mineRes && !mineRes.error && !!mineRes.data);
    };
    load();
    return () => {
      active = false;
    };
  }, [postId, userId, sessionLoading]);

  async function toggle() {
    if (!userId) {
      router.push(loginHrefHere());
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (c == null ? c : c + (wasLiked ? -1 : 1)));
    try {
      const { error } = wasLiked
        ? await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", userId)
        : await supabase.from("community_likes").insert({ post_id: postId });
      if (error && !(!wasLiked && error.code === "23505")) {
        setLiked(wasLiked);
        toast.error("좋아요를 처리하지 못했어요.");
      }
      const { count: fresh, error: countError } = await supabase
        .from("community_likes")
        .select("post_id", { count: "exact", head: true })
        .eq("post_id", postId);
      if (!countError) setCount(fresh ?? 0);
      else if (error) setCount((c) => (c == null ? c : c + (wasLiked ? 1 : -1)));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const button = (
    <Button
      variant="outline"
      className={cn(
        // 크고 둥근 흰 알약(디자인 개편 2단계). 누른 상태는 색 + 채운 하트 + aria-pressed로 알린다.
        "h-11 gap-2 rounded-full bg-card px-5 text-sm font-semibold shadow-(--shadow-sm) transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-(--shadow-md) motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:shadow-none [&_svg:not([class*='size-'])]:size-5",
        liked && "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400",
      )}
      onClick={toggle}
      disabled={busy || disabled}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
    >
      <HeartIcon className={cn(liked && "fill-current")} />
      <span>{count == null ? "–" : formatCount(count)}</span>
    </Button>
  );

  if (!sessionLoading && !userId) return <LoginRequiredTooltip>{button}</LoginRequiredTooltip>;
  return button;
}
