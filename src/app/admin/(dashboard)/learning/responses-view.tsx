"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  ClockIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  PartyPopperIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { PraiseDialog, type PraiseCandidate } from "@/components/admin/praise-dialog";
import { PraisePresetManagerButton } from "@/components/admin/praise-preset-manager";
import { FeedbackDialogButton } from "@/components/feedback/feedback-center";
import { FeedbackThread } from "@/components/feedback/feedback-thread";
import { AsyncView, NativeSelect, StudentLink, TableWrap, tdClass, thClass } from "@/components/learning/learning-ui";
import { AnswerView, ResponsePanel } from "@/components/learning/response-panel";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findResponseApp, getResponseSchema, responseApps, type ResponseSchema } from "@/data/app-responses";
import { useAsyncData } from "@/hooks/use-async-data";
import { accountLabel } from "@/lib/admin";
import { extractResponses, groupByStage, progressInfo, questionIdentity, stageLabel, versionLabel } from "@/lib/app-responses";
import { formatDateTime } from "@/lib/format";
import { praiseNameOf } from "@/lib/praise";
import {
  FEEDBACK_CHANGED_EVENT,
  fetchAllAppResults,
  fetchAppProgressRows,
  fetchStudents,
  fetchTeacherFeedbackCounts,
  formatDuration,
  type AppProgressRow,
  type AppResultWithStudent,
} from "@/lib/learning";
import { cn } from "@/lib/utils";

type Status = "done" | "progress" | "none";

type StudentEntry = {
  id: string;
  name: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  /** 가장 최근 완료 결과(없으면 가장 최근 결과) */
  latest: AppResultWithStudent | null;
  completedCount: number;
  progress: AppProgressRow | null;
  status: Status;
  /** 이 앱의 이 학생 결과 전부(다시 한 것 포함)에 선생님이 보낸 메시지 수 — "이미 보냄"은 학생·앱 기준(review L6) */
  teacherMessages: number;
  /** 칭찬 문장에 넣을 이름(표시 이름이 없거나 이메일·아이디 모양이면 null — review M1) */
  praiseName: string | null;
  /** 학생 명단(role=user)에 있는지. 명단을 못 불러왔으면 true로 둔다 */
  inRoster: boolean;
};

type Data = {
  entries: StudentEntry[];
  progressMissing: boolean;
  /** 학생 명단(member_directory)을 못 불러와 기록이 있는 학생만 보여 주는지 */
  rosterMissing: boolean;
  feedbackStatusMissing: boolean;
};

/** 결과 목록 → 학생 id별 선생님 메시지 수(그 학생의 이 앱 결과 전부 합계) */
async function teacherCountsByStudent(results: { id: string; user_id: string }[]): Promise<Map<string, number>> {
  const byResult = await fetchTeacherFeedbackCounts(results.map((r) => ({ id: r.id, user_id: r.user_id })));
  const owner = new Map(results.map((r) => [r.id, r.user_id]));
  const out = new Map<string, number>();
  for (const [rid, n] of byResult) {
    const uid = owner.get(rid);
    if (uid) out.set(uid, (out.get(uid) ?? 0) + n);
  }
  return out;
}

/** 칭찬 보내기 직전에 "이미 보냄"을 서버에서 다시 확인한다(다른 탭·다른 기기에서 방금 보낸 경우) */
async function recheckTeacherCounts(appId: string): Promise<Map<string, number>> {
  return teacherCountsByStudent(await fetchAllAppResults(appId));
}

async function loadResponses(appId: string): Promise<Data> {
  const [results, progress, students] = await Promise.all([
    fetchAllAppResults(appId),
    fetchAppProgressRows(appId),
    // 명단은 "아직 시작하지 않은 학생"을 보여 주는 보조 정보라 실패해도 기록은 보여 준다.
    fetchStudents().catch(() => null),
  ]);

  const byUser = new Map<string, AppResultWithStudent[]>();
  for (const r of results) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r); // 최신순
  }
  const progressByUser = new Map(progress.rows.map((p) => [p.user_id, p]));

  const latestByUser = new Map<string, AppResultWithStudent>();
  for (const [uid, list] of byUser) latestByUser.set(uid, list.find((r) => r.completed) ?? list[0]);

  let counts = new Map<string, number>();
  let feedbackStatusMissing = false;
  try {
    counts = await teacherCountsByStudent(results);
  } catch {
    feedbackStatusMissing = true;
  }

  const ids = new Set<string>([...(students ?? []).map((s) => s.id), ...byUser.keys(), ...progressByUser.keys()]);
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const entries: StudentEntry[] = [...ids].map((id) => {
    const s = studentById.get(id);
    const list = byUser.get(id) ?? [];
    const latest = latestByUser.get(id) ?? null;
    const profile = s ? { display_name: s.display_name, avatar_url: s.avatar_url } : (latest?.profiles ?? null);
    const name = profile?.display_name?.trim() || (s ? accountLabel(s.email).split("@")[0] : "") || "이름 없음";
    const prog = progressByUser.get(id) ?? null;
    const status: Status = latest?.completed ? "done" : latest || prog ? "progress" : "none";
    return {
      id,
      name,
      profile,
      latest,
      completedCount: list.filter((r) => r.completed).length,
      progress: prog,
      status,
      teacherMessages: counts.get(id) ?? 0,
      praiseName: praiseNameOf(profile?.display_name),
      inRoster: students == null || studentById.has(id),
    };
  });
  entries.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { entries, progressMissing: progress.missing, rosterMissing: students == null, feedbackStatusMissing };
}

const STATUS_ORDER: Record<Status, number> = { done: 0, progress: 1, none: 2 };

function StatusBadge({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2Icon className="text-science-strong" aria-hidden />
        완료
      </Badge>
    );
  }
  if (status === "progress") {
    return (
      <Badge variant="outline" className="gap-1">
        <ClockIcon aria-hidden />
        진행 중
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CircleDashedIcon aria-hidden />
      시작 안 함
    </Badge>
  );
}

function ProgressLine({ schema, progress }: { schema: ResponseSchema | null; progress: AppProgressRow }) {
  const info = progressInfo(schema, progress.state);
  return (
    <span>
      {info.stageLabel ? `${info.stageLabel}${info.index && info.total ? ` (${info.index}/${info.total}단계)` : ""}` : "단계 정보 없음"}
      {" · 마지막 저장 "}
      {formatDateTime(progress.updated_at)}
    </span>
  );
}

function StudentCard({
  entry,
  appId,
  appTitle,
  schema,
  expanded,
  onToggle,
}: {
  entry: StudentEntry;
  appId: string;
  appTitle: string;
  schema: ResponseSchema | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const r = entry.latest;
  const redo =
    entry.status === "done" && entry.progress && r && entry.progress.updated_at > r.created_at && !progressInfo(schema, entry.progress.state).finished;
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl p-3 ring-1 ring-foreground/10 sm:p-4",
        entry.status === "none" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 max-w-full">
          <StudentLink id={entry.id} profile={entry.profile} fallback={entry.name} tab="apps" />
        </span>
        <StatusBadge status={entry.status} />
        {!entry.inRoster ? (
          <Badge variant="outline" className="gap-1 text-muted-foreground" title="학생 명단(일반 회원)에 없는 계정이에요. 칭찬 보내기 대상에서 빠져요.">
            명단 밖 계정
          </Badge>
        ) : null}
        {entry.teacherMessages > 0 ? (
          <Badge variant="outline" className="gap-1" title="이 앱의 결과(다시 한 것 포함)에 선생님이 보낸 피드백·칭찬이 있어요">
            <MessageSquareTextIcon aria-hidden />
            피드백 보냄
          </Badge>
        ) : null}
        {r ? (
          <span className="ml-auto text-xs text-muted-foreground">
            <time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
          </span>
        ) : null}
      </div>

      {entry.status === "none" ? <p className="text-sm text-muted-foreground">아직 시작하지 않음</p> : null}

      {entry.status === "progress" ? (
        <p className="text-sm">
          <span className="font-medium">진행 중</span>
          <span className="text-muted-foreground">
            {" — "}
            {entry.progress ? <ProgressLine schema={schema} progress={entry.progress} /> : "완료하지 않은 결과만 있어요"}
          </span>
        </p>
      ) : null}

      {r && entry.status === "done" ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>소요 시간 {formatDuration(r.duration_seconds)}</span>
          {entry.completedCount > 1 ? <span>완료 {entry.completedCount}번 · 가장 최근 결과를 보여 줘요</span> : null}
          {redo && entry.progress ? (
            <span>
              다시 하는 중: <ProgressLine schema={schema} progress={entry.progress} />
            </span>
          ) : null}
        </p>
      ) : null}

      {r ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-expanded={expanded}>
              <ChevronDownIcon className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
              {expanded ? "응답 접기" : "응답 보기"}
            </Button>
            <Button type="button" variant={feedbackOpen ? "secondary" : "outline"} size="sm" onClick={() => setFeedbackOpen((v) => !v)} aria-expanded={feedbackOpen}>
              <MessageSquareTextIcon />
              {feedbackOpen ? "피드백 닫기" : "피드백 쓰기"}
            </Button>
          </div>
          {expanded ? (
            <div className="rounded-xl bg-muted/20 p-2 sm:p-3">
              {!r.completed ? <p className="mb-2 text-xs text-muted-foreground">완료하지 않은 결과예요.</p> : null}
              <ResponsePanel appId={appId} details={r.details} />
            </div>
          ) : null}
          {feedbackOpen ? (
            <section className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-primary/30" aria-label={`${entry.name} 피드백`}>
              <p className="text-xs text-muted-foreground">
                {entry.name}에게 보이는 대화 · {appTitle} · {formatDateTime(r.created_at)} 결과
              </p>
              <FeedbackThread studentId={entry.id} context={{ type: "app_result", id: r.id }} audience="admin" studentName={entry.name} autoFocus />
            </section>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

type QuestionMeta = { id: string; key: string; stage: string; label?: string; question: string; version?: string };

type QuestionGroup = { id: string; label: string; old: boolean; items: QuestionMeta[] };

function QuestionView({
  entries,
  appId,
  appTitle,
  schema,
  questionKey,
  onQuestion,
}: {
  entries: StudentEntry[];
  appId: string;
  appTitle: string;
  schema: ResponseSchema | null;
  questionKey: string | null;
  onQuestion: (key: string) => void;
}) {
  const answered = useMemo(
    () =>
      entries
        .filter((e) => e.latest)
        .map((e) => {
          const items = extractResponses(appId, e.latest!.details).items;
          return { entry: e, result: e.latest!, items, byId: new Map(items.map((it) => [questionIdentity(it), it])) };
        }),
    [entries, appId],
  );
  // 질문은 (앱 버전 + key + 문구)로 가른다(review H1). 가장 최근 결과의 버전을 "지금 버전"으로, 나머지는 "이전 버전 질문"으로 따로 묶는다.
  const { groups, currentVersion } = useMemo(() => {
    const newest = [...answered].sort((x, y) => (x.result.created_at < y.result.created_at ? 1 : -1)).find((a) => a.items.length);
    const cur = newest?.items[0]?.version;
    const seen = new Map<string, QuestionMeta>();
    for (const a of answered) {
      for (const it of a.items) {
        const id = questionIdentity(it);
        if (!seen.has(id)) seen.set(id, { id, key: it.key, stage: it.stage, label: it.label, question: it.question, version: it.version });
      }
    }
    const all = [...seen.values()];
    const out: QuestionGroup[] = [];
    const now = all.filter((q) => q.version === cur);
    for (const g of groupByStage(now, schema)) out.push({ id: `now:${g.stage}`, label: g.label, old: false, items: g.items });
    const olderVersions = [...new Set(all.filter((q) => q.version !== cur).map((q) => q.version ?? "?"))];
    for (const v of olderVersions) {
      const list = all.filter((q) => (q.version ?? "?") === v);
      const ordered = groupByStage(list, schema).flatMap((g) => g.items);
      out.push({ id: `old:${v}`, label: `이전 버전 질문 · ${versionLabel(v, schema)}`, old: true, items: ordered });
    }
    return { groups: out, currentVersion: cur };
  }, [answered, schema]);
  const flat: QuestionMeta[] = groups.flatMap((g) => g.items);
  // 예전 URL(q=stage:id)도 지금 버전의 그 질문으로 연다
  const current = flat.find((q) => q.id === questionKey) ?? flat.find((q) => q.key === questionKey && q.version === currentVersion) ?? flat[0] ?? null;
  const currentGroup = current ? groups.find((g) => g.items.some((i) => i.id === current.id)) : undefined;
  const hasOlder = groups.some((g) => g.old);

  if (!answered.length) {
    return <EmptyState title="아직 이 앱의 결과가 없습니다" description="학생이 활동을 마치면 질문별로 비교할 수 있어요." />;
  }
  if (!current) {
    return <EmptyState title="질문별로 정리할 수 있는 답이 없습니다" description="학생별 보기에서 원본 데이터를 확인해 주세요." />;
  }

  const rows = answered.map((a) => {
    const item = a.byId.get(current.id) ?? null;
    // 같은 key의 질문에 다른 버전으로 답했는지(표에 "다른 버전 질문"으로 표시하고 집계에서 뺀다)
    const other = item ? null : (a.items.find((it) => it.key === current.key) ?? null);
    return { ...a, item, other };
  });
  const withAnswer = rows.filter((r) => r.item);
  const otherVersion = rows.filter((r) => !r.item && r.other).length;
  const noRecord = rows.length - withAnswer.length - otherVersion;
  const choiceAnswers = withAnswer.flatMap((r) => (r.item!.answer.kind === "choice" ? [r.item!.answer] : []));
  let distribution: { option: string; count: number }[] = [];
  if (choiceAnswers.length) {
    const options = choiceAnswers.find((a) => a.options?.length)?.options ?? [];
    const counts = new Map<string, number>(options.map((o) => [o, 0]));
    for (const a of choiceAnswers) for (const c of a.chosen) counts.set(c, (counts.get(c) ?? 0) + 1);
    distribution = [...counts.entries()].map(([option, count]) => ({ option, count }));
  }
  const correctCount = choiceAnswers.filter((a) => a.correct === true).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="question-select" className="text-sm font-medium">
          질문
        </label>
        <NativeSelect id="question-select" value={current.id} onChange={(e) => onQuestion(e.target.value)} className="h-10 w-full">
          {groups.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {g.items.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label ? `${q.label} · ` : ""}
                  {q.question.length > 70 ? `${q.question.slice(0, 70)}…` : q.question}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
        {hasOlder ? (
          <p className="text-xs text-muted-foreground">
            앱이 바뀌기 전에 한 학생의 질문은 &lsquo;이전 버전 질문&rsquo;에 따로 모았어요. 버전이 다르면 같은 번호라도 다른 질문이라 답과 집계를 섞지 않아요.
          </p>
        ) : null}
      </div>
      <div className={cn("rounded-xl px-3 py-2.5", currentGroup?.old ? "bg-math-soft/60 ring-1 ring-math-strong/30" : "bg-muted/30")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {currentGroup?.old ? (
            <Badge variant="outline" className="text-[0.7rem]">
              이전 버전 질문
            </Badge>
          ) : null}
          <span>
            {current.label ? `${current.label} · ` : ""}
            {stageLabel(current.stage, schema)}
            {current.version && (hasOlder || currentGroup?.old) ? ` · ${versionLabel(current.version, schema)}` : ""}
          </span>
        </p>
        <p className="mt-1 text-sm">{current.question}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          답한 학생 {withAnswer.length}명
          {otherVersion ? ` · 다른 버전 질문에 답함 ${otherVersion}명` : ""}
          {noRecord ? ` · 이 질문 기록 없음 ${noRecord}명` : ""}
          {choiceAnswers.some((a) => a.correct != null) ? ` · 정답 ${correctCount}명` : ""}
        </p>
      </div>

      {distribution.length ? (
        <section className="flex flex-col gap-1.5" aria-label="선택 분포">
          <h3 className="text-sm font-medium">보기별 선택 인원</h3>
          <ul className="flex flex-col gap-1.5">
            {distribution.map((d) => {
              const pct = choiceAnswers.length ? Math.round((d.count / choiceAnswers.length) * 100) : 0;
              return (
                <li key={d.option} className="flex flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">{d.option}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {d.count}명 ({pct}%)
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TableWrap label="질문별 학생 답">
        <thead>
          <tr>
            <th className={thClass}>학생</th>
            <th className={thClass}>답</th>
            <th className={thClass}>일시</th>
            <th className={thClass}>
              <span className="sr-only">피드백</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, result, item, other }) => (
            <tr key={entry.id}>
              <td className={`${tdClass} w-40 max-w-48 align-top`}>
                <StudentLink id={entry.id} profile={entry.profile} fallback={entry.name} tab="apps" />
              </td>
              <td className={`${tdClass} min-w-64 align-top`}>
                {item ? (
                  <AnswerView answer={item.answer} compact />
                ) : other ? (
                  <span className="text-sm text-muted-foreground">(다른 버전 질문에 답함 · {versionLabel(other.version, schema)})</span>
                ) : (
                  <span className="text-sm text-muted-foreground">(이 질문 기록 없음)</span>
                )}
              </td>
              <td className={`${tdClass} align-top whitespace-nowrap text-muted-foreground`}>{formatDateTime(result.created_at)}</td>
              <td className={`${tdClass} text-right align-top`}>
                <FeedbackDialogButton
                  studentId={entry.id}
                  context={{ type: "app_result", id: result.id }}
                  audience="admin"
                  studentName={entry.name}
                  title={`${appTitle} · ${entry.name}`}
                  size="xs"
                  variant="ghost"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <p className="text-xs text-muted-foreground">학생마다 가장 최근 결과(완료한 것 우선)의 답이에요.</p>
    </div>
  );
}

type Filter = "all" | Status;

/**
 * 학습 현황 > 학생 응답(docs/admin/responses-spec.md §4.2~4.5).
 * 앱을 고르면 학생별로 적고 고른 내용을 질문과 함께 보여 주고(학생별/질문별), 카드에서 바로 피드백을 쓰고, 완료한 학생에게 칭찬을 한 번에 보낸다.
 */
export function ResponsesView({ appParam, viewParam, questionParam }: { appParam: string | null; viewParam: string | null; questionParam: string | null }) {
  const router = useRouter();
  const appId = appParam || responseApps[0]?.id || "";
  const view: "student" | "question" = viewParam === "question" ? "question" : "student";
  const app = findResponseApp(appId);
  const appTitle = app?.title ?? appId;
  const schema = getResponseSchema(appId);

  const navigate = useCallback(
    (next: { app?: string; view?: string; q?: string | null }) => {
      const p = new URLSearchParams({ tab: "responses", app: next.app ?? appId, view: next.view ?? view });
      const q = next.q === undefined ? questionParam : next.q;
      if (q && (next.view ?? view) === "question") p.set("q", q);
      router.replace(`/admin/learning/?${p.toString()}`, { scroll: false });
    },
    [router, appId, view, questionParam],
  );

  const load = useCallback(() => loadResponses(appId), [appId]);
  const { state, reload, refresh, setData } = useAsyncData(load);

  // 피드백을 쓰거나 읽으면 "피드백 보냄" 표시를 조용히 갱신한다.
  useEffect(() => {
    window.addEventListener(FEEDBACK_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FEEDBACK_CHANGED_EVENT, refresh);
  }, [refresh]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [praiseOpen, setPraiseOpen] = useState(false);

  const entries = useMemo(() => (state.status === "ready" ? state.data.entries : []), [state]);
  const counts = useMemo(
    () => ({
      done: entries.filter((e) => e.status === "done").length,
      progress: entries.filter((e) => e.status === "progress").length,
      none: entries.filter((e) => e.status === "none").length,
    }),
    [entries],
  );
  const candidates: PraiseCandidate[] = useMemo(
    () =>
      entries
        // 명단 밖 계정(관리자가 시험 삼아 완료한 기록 등)은 칭찬 대상에서 뺀다(review L8)
        .filter((e) => e.status === "done" && e.latest && e.inRoster)
        .map((e) => ({ studentId: e.id, resultId: e.latest!.id, name: e.name, praiseName: e.praiseName, teacherMessages: e.teacherMessages })),
    [entries],
  );

  const appOptions = useMemo(() => {
    const list = responseApps.map((a) => ({ id: a.id, label: a.label }));
    if (appId && !list.some((a) => a.id === appId)) list.push({ id: appId, label: `${appId} (목록에 없는 앱)` });
    return list;
  }, [appId]);

  if (!appId) {
    return <EmptyState title="과학 차시 앱이 없습니다" description="src/data/science-curriculum.ts에 앱이 연결된 차시가 없어요." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="responses-app" className="text-sm font-medium">
            웹앱(과학 차시)
          </label>
          <NativeSelect
            id="responses-app"
            value={appId}
            onChange={(e) => {
              setCollapsed(new Set());
              navigate({ app: e.target.value, q: null });
            }}
            className="h-10 w-full sm:max-w-xl"
          >
            {appOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          {app ? <p className="text-xs text-muted-foreground">{app.context} · {app.kind === "sim" ? "실험 시뮬레이션" : "조사 도우미"}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg p-0.5 ring-1 ring-foreground/10" role="group" aria-label="보기 방식">
            <Button type="button" size="sm" variant={view === "student" ? "secondary" : "ghost"} aria-pressed={view === "student"} onClick={() => navigate({ view: "student" })}>
              <UsersIcon />
              학생별
            </Button>
            <Button type="button" size="sm" variant={view === "question" ? "secondary" : "ghost"} aria-pressed={view === "question"} onClick={() => navigate({ view: "question" })}>
              <ListChecksIcon />
              질문별
            </Button>
          </div>
          <span className="ml-auto flex flex-wrap gap-2">
            <PraisePresetManagerButton />
            <Button type="button" size="sm" onClick={() => setPraiseOpen(true)} disabled={state.status !== "ready" || !candidates.length}>
              <PartyPopperIcon />
              칭찬 보내기
            </Button>
          </span>
        </div>
      </div>

      <AsyncView state={state} onRetry={reload} errorText="학생 응답을 불러오지 못했습니다.">
        {(data) => (
          <div className="flex flex-col gap-4">
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
              <span>
                완료 <strong className="tabular-nums">{counts.done}</strong>명
              </span>
              <span>
                진행 중 <strong className="tabular-nums">{counts.progress}</strong>명
              </span>
              <span className="text-muted-foreground">
                시작 안 함 <span className="tabular-nums">{counts.none}</span>명
              </span>
            </p>
            {data.progressMissing ? (
              <p className="text-xs text-muted-foreground">진행 상황 테이블(app_progress)이 아직 없어 진행 중인 학생은 표시되지 않아요(20260922010000_app_progress.sql).</p>
            ) : null}
            {data.rosterMissing ? (
              <p className="text-xs text-muted-foreground">학생 명단을 불러오지 못해 기록이 있는 학생만 보여 줘요.</p>
            ) : null}
            {data.feedbackStatusMissing ? (
              <p className="text-xs text-muted-foreground">피드백을 보냈는지 확인하지 못했어요. 칭찬을 보내기 전에 대상을 한 번 더 확인해 주세요.</p>
            ) : null}

            {view === "question" ? (
              <QuestionView
                entries={data.entries}
                appId={appId}
                appTitle={appTitle}
                schema={schema}
                questionKey={questionParam}
                onQuestion={(q) => navigate({ q })}
              />
            ) : (
              <StudentList
                entries={data.entries}
                search={search}
                onSearch={setSearch}
                filter={filter}
                onFilter={setFilter}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                appId={appId}
                appTitle={appTitle}
                schema={schema}
              />
            )}

            <PraiseDialog
              open={praiseOpen}
              onOpenChange={setPraiseOpen}
              appTitle={appTitle}
              candidates={candidates}
              recheck={() => recheckTeacherCounts(appId)}
              onSent={(studentIds) => {
                const sent = new Set(studentIds);
                setData((d) => ({
                  ...d,
                  entries: d.entries.map((e) => (sent.has(e.id) ? { ...e, teacherMessages: e.teacherMessages + 1 } : e)),
                }));
              }}
            />
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function StudentList({
  entries,
  search,
  onSearch,
  filter,
  onFilter,
  collapsed,
  setCollapsed,
  appId,
  appTitle,
  schema,
}: {
  entries: StudentEntry[];
  search: string;
  onSearch: (v: string) => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
  collapsed: Set<string>;
  setCollapsed: (s: Set<string>) => void;
  appId: string;
  appTitle: string;
  schema: ResponseSchema | null;
}) {
  const term = search.trim().toLowerCase();
  const shown = entries
    .filter((e) => (filter === "all" ? true : e.status === filter))
    .filter((e) => !term || e.name.toLowerCase().includes(term))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "ko"));
  const withResult = shown.filter((e) => e.latest).map((e) => e.id);
  const allCollapsed = withResult.length > 0 && withResult.every((id) => collapsed.has(id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="학생 이름 검색" aria-label="학생 이름 검색" className="h-9 pl-8" />
        </div>
        <NativeSelect value={filter} onChange={(e) => onFilter(e.target.value as Filter)} aria-label="상태로 거르기" className="h-9">
          <option value="all">모든 학생</option>
          <option value="done">완료</option>
          <option value="progress">진행 중</option>
          <option value="none">시작 안 함</option>
        </NativeSelect>
        {withResult.length ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(withResult))}>
            <ChevronDownIcon className={allCollapsed ? "transition-transform" : "rotate-180 transition-transform"} />
            {allCollapsed ? "모두 펼치기" : "모두 접기"}
          </Button>
        ) : null}
      </div>
      {!entries.length ? (
        <EmptyState title="이 앱을 완료하거나 시작한 학생이 없습니다" description="학생이 로그인한 상태로 앱을 하면 여기에 모여요." />
      ) : !shown.length ? (
        <EmptyState title="조건에 맞는 학생이 없습니다" />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="학생별 응답">
          {shown.map((e) => (
            <StudentCard
              key={e.id}
              entry={e}
              appId={appId}
              appTitle={appTitle}
              schema={schema}
              expanded={!collapsed.has(e.id)}
              onToggle={() => {
                const next = new Set(collapsed);
                if (next.has(e.id)) next.delete(e.id);
                else next.add(e.id);
                setCollapsed(next);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
