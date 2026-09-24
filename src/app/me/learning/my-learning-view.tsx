"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardListIcon, Gamepad2Icon, HeartIcon, MessageCircleIcon, NewspaperIcon, type LucideIcon } from "lucide-react";
import { FeedbackCenter } from "@/components/feedback/feedback-center";
import { UserAppResults, UserPostReads, UserSocial } from "@/components/learning/activity-panels";
import { UnreadCount } from "@/components/learning/learning-ui";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { EmptyOwl, EmptyState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { displayNameOf, useSession } from "@/hooks/use-session";
import { useUnreadFeedback } from "@/hooks/use-unread-feedback";
import { primaryPillClass } from "@/lib/pill";
import { MyAssignments } from "./my-assignments";

const TABS = [
  { id: "apps", label: "웹앱 결과", icon: Gamepad2Icon },
  { id: "posts", label: "읽은 글", icon: NewspaperIcon },
  { id: "social", label: "댓글·좋아요", icon: HeartIcon },
  { id: "assignments", label: "과제", icon: ClipboardListIcon },
  { id: "feedback", label: "피드백", icon: MessageCircleIcon },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

export function MyLearningSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="내 학습 활동을 불러오는 중">
      <Skeleton className="h-32 w-full rounded-[2rem]" />
      <Skeleton className="h-12 w-full max-w-lg rounded-full" />
      <Skeleton className="h-40 w-full rounded-[2rem]" />
    </div>
  );
}

/** 탭 내용 칸: 키보드로 칸에 들어오면 둥근 초점 링이 보이게(shadcn 기본은 outline-none) */
const PANEL_CLASS = "rounded-[2rem] focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background";

/** 내 학습 활동(학생 화면). 본인 데이터만 보인다(RLS). */
export function MyLearningView() {
  const { loading, user, profile } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const unread = useUnreadFeedback();
  const raw = params.get("tab");
  const tab: TabId = isTab(raw) ? raw : "apps";

  if (loading) return <MyLearningSkeleton />;
  if (!user) {
    return (
      <EmptyState
        className="my-10"
        title="로그인이 필요합니다"
        description="로그인하면 내 학습 기록과 선생님 피드백을 볼 수 있어요."
        illustration={<EmptyOwl />}
        action={
          <Link href="/login/" className={primaryPillClass}>
            로그인
          </Link>
        }
      />
    );
  }

  const name = displayNameOf(profile, user);

  return (
    <div className="flex flex-col gap-6">
      {/* 머리 판(디자인 개편 2단계): 연보라 그라데이션 + 별 3D 아이콘 */}
      <div className="relative isolate flex items-center justify-between gap-4 overflow-hidden rounded-[2rem] bg-hero-home p-5 shadow-(--shadow-md) ring-1 ring-primary/10 sm:p-8 dark:shadow-none">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-heading text-3xl leading-tight font-normal sm:text-4xl">내 학습 활동</h1>
          <p className="text-sm text-foreground/75">{name}님의 학습 기록과 선생님과의 대화를 모아 봤어요.</p>
        </div>
        <Icon3D
          name="star"
          size={88}
          loading="eager"
          className="mascot-float size-16 shrink-0 drop-shadow-[0_12px_14px_oklch(0.3_0.1_288/0.22)] sm:size-20"
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(`/me/learning/?tab=${String(v)}`, { scroll: false })}
        className="gap-5"
      >
        <div className="relative -mx-4 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:px-1">
          {/* 알약 탭: 고른 탭은 보라 바탕 + 흰 굵은 글자(색만으로 구분하지 않음, aria-selected도 있음) */}
          <TabsList className="h-12! w-max gap-1 rounded-full bg-card p-1.5 shadow-(--shadow-sm) ring-1 ring-foreground/5 dark:bg-card dark:shadow-none dark:ring-foreground/10">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="rounded-full px-4 data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:shadow-(--shadow-brand) dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground"
                >
                  <Icon aria-hidden />
                  {t.label}
                  {t.id === "feedback" ? <UnreadCount count={unread} /> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="apps" className={PANEL_CLASS}>
          <UserAppResults userId={user.id} audience="student" />
        </TabsContent>
        <TabsContent value="posts" className={PANEL_CLASS}>
          <UserPostReads userId={user.id} audience="student" />
        </TabsContent>
        <TabsContent value="social" className={PANEL_CLASS}>
          <UserSocial userId={user.id} audience="student" />
        </TabsContent>
        <TabsContent value="assignments" className={PANEL_CLASS}>
          <MyAssignments userId={user.id} />
        </TabsContent>
        <TabsContent value="feedback" className={PANEL_CLASS}>
          <FeedbackCenter studentId={user.id} audience="student" initialKey={params.get("thread")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
