"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3Icon, ClipboardListIcon, Gamepad2Icon, LayoutGridIcon, MessageSquareQuoteIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminTabPanelClass } from "@/components/admin/admin-styles";
import { ClassScopeGate, ClassScopePicker, WholeScopeNote } from "@/components/admin/class-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UUID_RE } from "@/lib/admin";
import { AppResultsView } from "./app-results-view";
import { AssignmentManager } from "./assignment-manager";
import { EngagementTable } from "./engagement-table";
import { LearningOverview } from "./learning-overview";
import { ResponsesView } from "./responses-view";
import { SubmissionReview } from "./submission-review";

const TABS = [
  { id: "overview", label: "개요", icon: LayoutGridIcon },
  { id: "apps", label: "웹앱 결과", icon: Gamepad2Icon },
  { id: "responses", label: "학생 응답", icon: MessageSquareQuoteIcon },
  { id: "assignments", label: "과제 관리", icon: ClipboardListIcon },
  { id: "engagement", label: "참여 집계", icon: BarChart3Icon },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

export function LearningViewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="학습 현황을 불러오는 중">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

/**
 * 학습 현황(관리자). 탭은 ?tab= 으로 전환해 정적 export와 호환된다.
 * 기록은 RLS가 내 학급 학생 것만 돌려준다(총괄도 같음 — docs/classes/spec.md 개정 1-1).
 * 학생 명단을 쓰는 탭은 ClassScopeGate로 내 학급을 안 뒤에 불러온다. 내 학급이 2개 이상이면 머리에 학급 고르기가 보인다.
 */
export function LearningView() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: TabId = isTab(raw) ? raw : "overview";
  const assignmentParam = params.get("assignment");
  const assignmentId = tab === "assignments" && assignmentParam ? assignmentParam : null;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="학습 현황"
        description="웹앱 결과 · 과제 · 참여를 한눈에 보고 학생과 피드백을 주고받습니다."
        actions={<ClassScopePicker />}
      />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(`/admin/learning/?tab=${String(v)}`, { scroll: false })}
        className="gap-6"
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
        <TabsContent value="overview" className={adminTabPanelClass}>
          <WholeScopeNote className="mb-4" />
          <LearningOverview />
        </TabsContent>
        <TabsContent value="apps" className={adminTabPanelClass}>
          <ClassScopeGate>
            <AppResultsView initialApp={params.get("app")} />
          </ClassScopeGate>
        </TabsContent>
        <TabsContent value="responses" className={adminTabPanelClass}>
          {tab === "responses" ? (
            <ClassScopeGate>
              <ResponsesView appParam={params.get("app")} viewParam={params.get("view")} questionParam={params.get("q")} />
            </ClassScopeGate>
          ) : null}
        </TabsContent>
        <TabsContent value="assignments" className={adminTabPanelClass}>
          <ClassScopeGate>
            {assignmentId ? (
              UUID_RE.test(assignmentId) ? (
                <SubmissionReview key={assignmentId} assignmentId={assignmentId} />
              ) : (
                <SubmissionReview key="invalid" assignmentId={null} />
              )
            ) : (
              // 과제 목록은 학급 고르기와 같이 움직인다(학급별 과제 — 개정 3-2). "내 학급 전체 기준" 안내는 학급 없는
              // 예전 과제일 때만 AssignmentManager 안에서 보인다.
              <AssignmentManager />
            )}
          </ClassScopeGate>
        </TabsContent>
        <TabsContent value="engagement" className={adminTabPanelClass}>
          <ClassScopeGate>
            <EngagementTable />
          </ClassScopeGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
