"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquareQuoteIcon } from "lucide-react";
import { CompletedMark, SuspiciousMark } from "@/components/learning/activity-panels";
import { FeedbackDialogButton } from "@/components/feedback/feedback-center";
import { AsyncView, NativeSelect, StudentLink, TableWrap, tdClass, thClass } from "@/components/learning/learning-ui";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { findResponseApp } from "@/data/app-responses";
import { webApps } from "@/data/apps";
import { useAsyncData } from "@/hooks/use-async-data";
import { adminDisplayName } from "@/lib/admin";
import { formatCount, formatDateTime } from "@/lib/format";
import { appLabel, appLabelAdmin, fetchAppResultsWithStudents, formatDuration, formatScore } from "@/lib/learning";

const ALL = "__all__";

/**
 * 학습 현황 > 웹앱 결과: 앱을 고르면 그 앱의 전체 학생 시도 목록(spec §3.6).
 * 드롭다운에는 등록된 앱(src/data/apps.ts)과, 등록되지 않았지만 기록이 있는 app_id를 함께 보여 준다.
 */
export function AppResultsView({ initialApp }: { initialApp: string | null }) {
  const [app, setApp] = useState<string>(initialApp || webApps[0]?.id || ALL);
  const load = useCallback(() => fetchAppResultsWithStudents({ appId: app === ALL ? undefined : app, limit: 1000 }), [app]);
  const { state, reload } = useAsyncData(load);

  // 선택지: 등록된 앱 + (전체 보기일 때 발견한) 등록되지 않은 app_id
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const found = state.status === "ready" ? [...new Set(state.data.map((r) => r.app_id))] : [];
  const newIds = found.filter((id) => !seenIds.includes(id));
  if (newIds.length) setSeenIds((prev) => [...prev, ...newIds.filter((id) => !prev.includes(id))]);

  const options = useMemo(() => {
    const ids = [...webApps.map((a) => a.id)];
    for (const id of [...seenIds, ...(initialApp ? [initialApp] : [])]) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => ({ id, label: webApps.some((a) => a.id === id) ? appLabel(id) : `${id} (목록에 없는 앱)` }));
  }, [seenIds, initialApp]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="app-select" className="text-sm font-medium">
          웹앱
        </label>
        <NativeSelect id="app-select" value={app} onChange={(e) => setApp(e.target.value)} className="h-9 max-w-full">
          <option value={ALL}>전체 앱</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        {app !== ALL && findResponseApp(app) ? (
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/admin/learning/?tab=responses&app=${encodeURIComponent(app)}`} />}
            nativeButton={false}
          >
            <MessageSquareQuoteIcon />
            학생 응답 보기
          </Button>
        ) : null}
        {state.status === "ready" ? (
          <span className="text-sm text-muted-foreground">
            {formatCount(state.data.length)}건{state.data.length >= 1000 ? " (최근 1,000건)" : ""}
          </span>
        ) : null}
      </div>
      {!webApps.length ? (
        <p className="text-xs text-muted-foreground">
          아직 src/data/apps.ts에 등록된 웹앱이 없습니다. 기록이 있으면 “전체 앱”에서 app_id로 볼 수 있습니다.
        </p>
      ) : null}

      <AsyncView
        state={state}
        onRetry={reload}
        errorText="웹앱 결과를 불러오지 못했습니다."
        isEmpty={(rows) => !rows.length}
        empty={<EmptyState title="아직 기록이 없습니다" description="학생이 로그인한 상태로 웹앱을 끝내면 결과가 쌓입니다." />}
      >
        {(rows) => (
          <TableWrap label="웹앱 결과 목록">
            <thead>
              <tr>
                <th className={thClass}>학생</th>
                {app === ALL ? <th className={thClass}>앱</th> : null}
                <th className={thClass}>점수</th>
                <th className={thClass}>완료</th>
                <th className={thClass}>소요 시간</th>
                <th className={thClass}>일시</th>
                <th className={thClass}>
                  <span className="sr-only">피드백</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${tdClass} max-w-48`}>
                    <StudentLink id={r.user_id} profile={r.profiles} tab="apps" />
                  </td>
                  {app === ALL ? <td className={tdClass}>{webApps.some((a) => a.id === r.app_id) ? appLabel(r.app_id) : r.app_id}</td> : null}
                  <td className={tdClass}>
                    {formatScore(r.score, r.max_score)}
                    <SuspiciousMark result={r} />
                  </td>
                  <td className={tdClass}>
                    <CompletedMark completed={r.completed} />
                  </td>
                  <td className={tdClass}>{formatDuration(r.duration_seconds)}</td>
                  <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{formatDateTime(r.created_at)}</td>
                  <td className={`${tdClass} text-right`}>
                    <FeedbackDialogButton
                      studentId={r.user_id}
                      context={{ type: "app_result", id: r.id }}
                      audience="admin"
                      studentName={r.profiles ? adminDisplayName(r.profiles, "") || undefined : undefined}
                      studentWithdrawn={Boolean(r.profiles?.withdrawn_at)}
                      title={`${appLabelAdmin(r.app_id)} · ${formatDateTime(r.created_at)}`}
                      size="xs"
                      variant="ghost"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </AsyncView>
    </div>
  );
}
