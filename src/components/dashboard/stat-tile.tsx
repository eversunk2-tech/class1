"use client";

import { useEffect, useState } from "react";
import { FlaskConicalIcon, Gamepad2Icon, NewspaperIcon, RotateCwIcon, RulerIcon, type LucideIcon } from "lucide-react";
import { webApps } from "@/data/apps";
import type { MenuColor } from "@/data/menu";
import { formatCount } from "@/lib/format";
import { menuColorClasses } from "@/lib/menu-colors";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Status = "loading" | "ready" | "error";

/** 통계 타일 1개(표시 전용). 숫자는 제목 글꼴로 크게, 라벨은 본문 색으로 보여 준다. */
export function StatTile({
  label,
  value,
  unit = "개",
  icon: Icon,
  color,
  status = "ready",
  onRetry,
}: {
  label: string;
  value: number | null;
  unit?: string;
  icon: LucideIcon;
  color: MenuColor;
  status?: Status;
  onRetry?: () => void;
}) {
  const colors = menuColorClasses[color];
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-lg shadow-foreground/5 ring-1 ring-foreground/10 dark:shadow-none">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", colors.chip)} aria-hidden>
        <Icon className="size-5.5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground sm:text-sm">{label}</span>
        {status === "loading" ? (
          <span className="h-7 w-12 animate-pulse rounded-md bg-muted" aria-label={`${label} 불러오는 중`} role="status" />
        ) : status === "error" ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {/* 타일이 좁아(모바일 2열 · 데스크톱 4열) 긴 문구는 줄바꿈되므로 짧게 보여 주고, 전체 문장은 보조기기에만 전한다. */}
            <span role="alert">
              <span aria-hidden>앗, 오류</span>
              <span className="sr-only">{label}을 불러오지 못했어요</span>
            </span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                aria-label={`${label} 다시 불러오기`}
                title="다시 시도"
                className="rounded-md p-1 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <RotateCwIcon className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </span>
        ) : (
          <span className="font-heading text-2xl leading-none">
            {formatCount(value ?? 0)}
            <span className="ml-0.5 text-sm text-muted-foreground">{unit}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** 발행된 글 수. head:true로 본문 없이 개수만 받는다. tag가 있으면 그 태그가 달린 글만 센다. */
async function fetchPostCount(tag?: string): Promise<number> {
  let query = supabase.from("posts").select("id", { count: "exact", head: true }).eq("published", true);
  if (tag) query = query.contains("tags", [tag]);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** 글 수를 스스로 불러오는 통계 타일. 타일마다 독립적으로 로딩/오류 상태를 갖는다. */
function PostCountTile({
  label,
  tag,
  icon,
  color,
}: {
  label: string;
  tag?: string;
  icon: LucideIcon;
  color: MenuColor;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPostCount(tag)
      .then((n) => {
        if (!active) return;
        setCount(n);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [tag, attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  return <StatTile label={label} value={count} icon={icon} color={color} status={status} onRetry={retry} />;
}

/**
 * 홈 대시보드 통계 타일 4개(전체 글 · 과학 글 · 수학 글 · 학습게임).
 * 아이콘 컴포넌트는 서버 컴포넌트에서 props로 넘길 수 없으므로 이 클라이언트 컴포넌트 안에서 조립한다.
 * 학습게임 수는 Supabase가 아니라 로컬 데이터(src/data/apps.ts)에서 센다.
 */
export function StatTiles() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <li>
        <PostCountTile label="전체 글" icon={NewspaperIcon} color="home" />
      </li>
      <li>
        <PostCountTile label="과학 글" tag="과학" icon={FlaskConicalIcon} color="science" />
      </li>
      <li>
        <PostCountTile label="수학 글" tag="수학" icon={RulerIcon} color="math" />
      </li>
      <li>
        <StatTile label="학습게임" value={webApps.length} icon={Gamepad2Icon} color="games" />
      </li>
    </ul>
  );
}
