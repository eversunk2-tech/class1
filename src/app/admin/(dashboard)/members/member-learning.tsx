"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardListIcon, Gamepad2Icon, HeartIcon, MessageCircleIcon, NewspaperIcon } from "lucide-react";
import { FeedbackCenter } from "@/components/feedback/feedback-center";
import { UserAppResults, UserPostReads, UserSocial, UserSubmissions } from "@/components/learning/activity-panels";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { id: "apps", label: "웹앱 결과", icon: Gamepad2Icon },
  { id: "posts", label: "읽은 글", icon: NewspaperIcon },
  { id: "social", label: "댓글·좋아요", icon: HeartIcon },
  { id: "assignments", label: "과제 제출", icon: ClipboardListIcon },
  { id: "feedback", label: "피드백 대화", icon: MessageCircleIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

/**
 * 회원 상세의 학습활동 영역(docs/admin/spec.md §3.5).
 * 탭은 ?tab= 으로 유지한다(/admin/members/?id=…&tab=feedback&thread=…). 탭마다 독립 로딩/빈/오류.
 */
export function MemberLearning({
  memberId,
  memberName,
  memberWithdrawn,
}: {
  memberId: string;
  memberName: string;
  /** 탈퇴 처리된 학생인지 — 피드백 대화에 "학생이 읽을 수 없음" 안내를 띄운다(review U6). */
  memberWithdrawn?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: TabId = isTab(raw) ? raw : "apps";

  return (
    <section aria-label="학습활동" className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-normal">학습활동</h2>
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(`/admin/members/?id=${memberId}&tab=${String(v)}`, { scroll: false })}
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
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <TabsContent value="apps">
          <UserAppResults userId={memberId} audience="admin" studentName={memberName} />
        </TabsContent>
        <TabsContent value="posts">
          <UserPostReads userId={memberId} audience="admin" />
        </TabsContent>
        <TabsContent value="social">
          <UserSocial userId={memberId} audience="admin" />
        </TabsContent>
        <TabsContent value="assignments">
          <UserSubmissions userId={memberId} studentName={memberName} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackCenter
            studentId={memberId}
            audience="admin"
            studentName={memberName}
            studentWithdrawn={memberWithdrawn}
            initialKey={params.get("thread")}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
