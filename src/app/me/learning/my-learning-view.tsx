"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardListIcon, Gamepad2Icon, HeartIcon, MessageCircleIcon, NewspaperIcon, type LucideIcon } from "lucide-react";
import { FeedbackCenter } from "@/components/feedback/feedback-center";
import { UserAppResults, UserPostReads, UserSocial } from "@/components/learning/activity-panels";
import { UnreadCount } from "@/components/learning/learning-ui";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { displayNameOf, useSession } from "@/hooks/use-session";
import { useUnreadFeedback } from "@/hooks/use-unread-feedback";
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
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-9 w-full max-w-lg" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

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
        action={
          <Button render={<Link href="/login/" />} nativeButton={false}>
            로그인
          </Button>
        }
      />
    );
  }

  const name = displayNameOf(profile, user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-normal">내 학습 활동</h1>
        <p className="text-sm text-muted-foreground">{name}님의 학습 기록과 선생님과의 대화를 모아 봤어요.</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(`/me/learning/?tab=${String(v)}`, { scroll: false })}
        className="gap-5"
      >
        <div className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <TabsList className="h-10! w-max">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.id} value={t.id} className="px-3">
                  <Icon aria-hidden />
                  {t.label}
                  {t.id === "feedback" ? <UnreadCount count={unread} /> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="apps">
          <UserAppResults userId={user.id} audience="student" />
        </TabsContent>
        <TabsContent value="posts">
          <UserPostReads userId={user.id} audience="student" />
        </TabsContent>
        <TabsContent value="social">
          <UserSocial userId={user.id} audience="student" />
        </TabsContent>
        <TabsContent value="assignments">
          <MyAssignments userId={user.id} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackCenter studentId={user.id} audience="student" initialKey={params.get("thread")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
