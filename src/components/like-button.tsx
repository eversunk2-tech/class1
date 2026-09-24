"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "lucide-react";
import { toast } from "sonner";
import { LoginRequiredTooltip } from "@/components/login-required";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { formatCount } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function LikeButton({ postId, published }: { postId: string; published: boolean }) {
  const router = useRouter();
  const { loading: sessionLoading, user } = useSession();
  const userId = user?.id ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  // 같은 틱의 연속 클릭까지 막기 위해 state와 별도로 ref로 진행 여부를 관리한다.
  const busyRef = useRef(false);

  useEffect(() => {
    if (sessionLoading) return;
    let active = true;
    const load = async () => {
      const countReq = supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", postId);
      const mineReq = userId
        ? supabase.from("likes").select("post_id").eq("post_id", postId).eq("user_id", userId).maybeSingle()
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
      router.push("/login/");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const wasLiked = liked;
    // 낙관적 업데이트
    setLiked(!wasLiked);
    setCount((c) => (c == null ? c : c + (wasLiked ? -1 : 1)));
    try {
      // delete는 0건이어도(이미 취소됨) 성공, insert의 23505(이미 좋아요)도 성공으로 본다.
      const { error } = wasLiked
        ? await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", userId)
        : await supabase.from("likes").insert({ post_id: postId });
      if (error && !(!wasLiked && error.code === "23505")) {
        setLiked(wasLiked);
        toast.error("좋아요를 처리하지 못했습니다.");
      }
      // 다른 탭·다른 사용자의 변경까지 반영되도록 실제 개수를 다시 조회한다.
      const { count: fresh, error: countError } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
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
      // 크고 둥근 흰 알약(디자인 개편 2단계). 누른 상태는 색 + 채운 하트 + aria-pressed로 알린다.
      className={cn(
        "h-11 gap-2 rounded-full bg-card px-5 text-sm font-semibold shadow-(--shadow-sm) transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-(--shadow-md) motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:shadow-none [&_svg:not([class*='size-'])]:size-5",
        liked && "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400",
      )}
      onClick={toggle}
      disabled={busy || !published}
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
