"use client";

import { useEffect, useState } from "react";
import { FlaskConicalIcon, Gamepad2Icon, LockIcon, MessageSquareIcon, NewspaperIcon, RotateCwIcon, type LucideIcon } from "lucide-react";
import { scienceAppCount } from "@/components/dashboard/science-app-status";
import { Icon3D, type Icon3DName } from "@/components/illustrations/icon-3d";
import type { MenuColor } from "@/data/menu";
import { useLoginLocked } from "@/hooks/use-login-lock";
import { formatCount } from "@/lib/format";
import { countCommunityPosts, isSetupMissing, type CommunityKind } from "@/lib/community";
import { menuColorClasses } from "@/lib/menu-colors";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// "locked" = "로그인해야만 이용"이 켜져 있고 로그인하지 않음 → 0이 아니라 잠김 표시를 보여 준다.
type Status = "loading" | "ready" | "error" | "setup" | "locked";

/**
 * 통계 타일 1개(표시 전용). 숫자는 제목 글꼴로 크게, 라벨은 본문 색으로 보여 준다.
 * `image`를 주면 lucide 아이콘 대신 3D 아이콘 칩을 쓴다(홈). 관리자 화면은 lucide 그대로(spec §3.2).
 * `tone="vivid"`(홈, 디자인 개편 개정 2): 더 둥근 칸 + 메뉴색 부드러운 그림자 + 원형 파스텔 배지 위 3D 아이콘 +
 * 굵은 메뉴색 숫자(큰 글씨라 대비 3:1 기준, 라이트 4.1~5.3:1). 기본값(`default`)은 예전 모양 그대로.
 */
export function StatTile({
  label,
  value,
  unit = "개",
  icon: Icon,
  image,
  color,
  status = "ready",
  onRetry,
  tone = "default",
  className,
}: {
  label: string;
  value: number | null;
  unit?: string;
  icon: LucideIcon;
  /** 3D 아이콘 이름(public/illustrations/3d/). 있으면 icon 대신 쓴다. */
  image?: Icon3DName;
  color: MenuColor;
  status?: Status;
  onRetry?: () => void;
  tone?: "default" | "vivid";
  className?: string;
}) {
  const colors = menuColorClasses[color];
  const vivid = tone === "vivid";
  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-card ring-1",
        vivid
          ? cn("rounded-[1.75rem] p-4 ring-foreground/5 sm:gap-3.5 sm:p-5 dark:shadow-none dark:ring-foreground/10", colors.glowShadow)
          : "rounded-2xl p-4 shadow-lg shadow-foreground/5 ring-foreground/10 dark:shadow-none",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          // vivid: 휴대폰 2열에서는 라벨이 잘리지 않게 배지를 44px, sm부터 56px
          vivid ? cn("size-11 rounded-full sm:size-14", colors.gradientBg) : cn("size-11 rounded-xl", colors.chip),
        )}
        aria-hidden
      >
        {image ? (
          <Icon3D name={image} size={vivid ? 36 : 30} className={vivid ? "size-7.5 sm:size-9" : "size-7.5"} />
        ) : (
          <Icon className="size-5.5" />
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground sm:text-sm">{label}</span>
        {status === "loading" ? (
          <span className="h-7 w-12 animate-pulse rounded-md bg-muted" aria-label={`${label} 불러오는 중`} role="status" />
        ) : status === "setup" ? (
          <span className="text-sm text-muted-foreground" title="SQL 실행 후 열려요">
            준비 중
          </span>
        ) : status === "locked" ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LockIcon className="size-3.5" aria-hidden />
            로그인 필요
          </span>
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
          <span
            className={cn(
              "leading-none",
              // Jua는 굵기가 하나뿐이라, 더 굵은 숫자는 본문 글꼴 800으로 그린다.
              vivid ? cn("text-3xl font-extrabold tracking-tight tabular-nums", colors.strongText) : "font-heading text-2xl",
            )}
          >
            {formatCount(value ?? 0)}
            <span className={cn("ml-0.5 text-sm text-muted-foreground", vivid && "ml-1 font-medium tracking-normal")}>
              {unit}
            </span>
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

/** 개수를 스스로 불러오는 통계 타일. 타일마다 독립적으로 로딩/오류 상태를 갖는다. */
function PostCountTile({
  label,
  tag,
  community,
  icon,
  image,
  color,
  tone,
}: {
  label: string;
  tag?: string;
  /** 있으면 posts 대신 community_posts(kind)의 숨기지 않은 글 수를 센다. */
  community?: CommunityKind;
  icon: LucideIcon;
  image?: Icon3DName;
  color: MenuColor;
  tone?: "default" | "vivid";
}) {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  // 잠금 중 비로그인이면 RLS가 0을 돌려준다 → "0개"가 아니라 "로그인 필요"로 보여 준다.
  const locked = useLoginLocked();

  useEffect(() => {
    let active = true;
    (community ? countCommunityPosts(community) : fetchPostCount(tag))
      .then((n) => {
        if (!active) return;
        setCount(n);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (active) setStatus(community && isSetupMissing(error) ? "setup" : "error");
      });
    return () => {
      active = false;
    };
  }, [tag, community, attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  return (
    <StatTile
      label={label}
      value={count}
      icon={icon}
      image={image}
      color={color}
      status={locked ? "locked" : status}
      onRetry={retry}
      tone={tone}
    />
  );
}

/**
 * 홈 대시보드 통계 타일 4개(과학 차시 앱 · 자유게시판 · 학습게임 · 선생님 글), `tone="vivid"`.
 * 과학 카드는 차시 앱 개수(src/data/science-curriculum.ts, 로컬 계산)를 센다(spec §6).
 * 아이콘 컴포넌트는 서버 컴포넌트에서 props로 넘길 수 없으므로 이 클라이언트 컴포넌트 안에서 조립한다.
 * 열 수는 본문 폭(@container) 기준: 사이드바가 펼쳐진 태블릿에서도 글자가 눌리지 않게 한다.
 */
export function StatTiles() {
  return (
    <div className="@container">
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 @3xl:grid-cols-4">
        <li>
          <StatTile
            label="과학 차시 앱"
            value={scienceAppCount()}
            icon={FlaskConicalIcon}
            image="test-tube"
            color="science"
            tone="vivid"
          />
        </li>
        <li>
          <PostCountTile
            label="자유게시판 글"
            community="board"
            icon={MessageSquareIcon}
            image="speech-balloon"
            color="board"
            tone="vivid"
          />
        </li>
        <li>
          <PostCountTile label="학습게임" community="game" icon={Gamepad2Icon} image="video-game" color="games" tone="vivid" />
        </li>
        <li>
          <PostCountTile label="선생님 글" icon={NewspaperIcon} image="newspaper" color="home" tone="vivid" />
        </li>
      </ul>
    </div>
  );
}
