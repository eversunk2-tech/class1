"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownIcon, NewspaperIcon, UsersIcon } from "lucide-react";
import { AsyncView, SectionTitle, StudentLink, TableWrap, tdClass, thClass } from "@/components/learning/learning-ui";
import { postHref } from "@/components/post-card";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { useAsyncData } from "@/hooks/use-async-data";
import { formatCount } from "@/lib/format";
import {
  fetchPostEngagement,
  fetchStudentEngagement,
  type PostEngagementRow,
  type StudentEngagementRow,
} from "@/lib/learning";
import { cn } from "@/lib/utils";

/** 정렬 가능한 표 머리글 */
function SortTh<K extends string>({
  id,
  label,
  sort,
  onSort,
}: {
  id: K;
  label: string;
  sort: K;
  onSort: (k: K) => void;
}) {
  const active = sort === id;
  return (
    <th className={thClass} aria-sort={active ? "descending" : "none"}>
      <button
        type="button"
        onClick={() => onSort(id)}
        className={cn("inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50", active && "text-foreground")}
      >
        {label}
        {active ? <ArrowDownIcon className="size-3" aria-hidden /> : null}
      </button>
    </th>
  );
}

type PostSort = "views" | "comments" | "likes" | "readers";
type StudentSort = "comments" | "likes" | "reads" | "results" | "submissions";

/** 학습 현황 > 참여 집계: 글별 조회/댓글/좋아요/읽은 인원 + 학생별 참여(spec §3.6, §4.9 — 새 테이블 없이 count). */
export function EngagementTable() {
  return (
    <div className="flex flex-col gap-10">
      <PostEngagement />
      <StudentEngagement />
    </div>
  );
}

function PostEngagement() {
  const load = useCallback(() => fetchPostEngagement(), []);
  const { state, reload } = useAsyncData(load);
  const [sort, setSort] = useState<PostSort>("views");

  return (
    <section className="flex flex-col gap-3" aria-labelledby="post-engagement">
      <SectionTitle>
        <span id="post-engagement" className="inline-flex items-center gap-2">
          <NewspaperIcon className="size-5 text-home-strong" aria-hidden />
          글별 참여
        </span>
      </SectionTitle>
      <AsyncView
        state={state}
        onRetry={reload}
        errorText="글별 참여를 불러오지 못했습니다."
        isEmpty={(d) => !d.rows.length}
        empty={<EmptyState title="아직 글이 없습니다" />}
      >
        {({ rows, readersMissing }) => (
          <div className="flex flex-col gap-2">
            {readersMissing ? (
              <p className="text-xs text-muted-foreground">
                읽은 인원은 DB 설정(20260921020000_admin_learning.sql) 적용 후 집계됩니다.
              </p>
            ) : null}
            <SortedPosts rows={rows} sort={sort} onSort={setSort} />
          </div>
        )}
      </AsyncView>
    </section>
  );
}

function SortedPosts({ rows, sort, onSort }: { rows: PostEngagementRow[]; sort: PostSort; onSort: (k: PostSort) => void }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1)), [rows, sort]);
  return (
    <TableWrap label="글별 참여">
      <thead>
        <tr>
          <th className={thClass}>글</th>
          <SortTh id="views" label="조회수" sort={sort} onSort={onSort} />
          <SortTh id="comments" label="댓글" sort={sort} onSort={onSort} />
          <SortTh id="likes" label="좋아요" sort={sort} onSort={onSort} />
          <SortTh id="readers" label="읽은 학생" sort={sort} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.id}>
            <td className={`${tdClass} max-w-80`}>
              <span className="flex min-w-0 items-center gap-2">
                {!p.published ? (
                  <Badge variant="outline" className="shrink-0">
                    초안
                  </Badge>
                ) : null}
                <Link href={postHref(p.slug)} className="truncate font-medium hover:underline">
                  {p.title}
                </Link>
              </span>
            </td>
            <td className={tdClass}>{formatCount(p.views)}</td>
            <td className={tdClass}>{formatCount(p.comments)}</td>
            <td className={tdClass}>{formatCount(p.likes)}</td>
            <td className={tdClass}>{p.readers == null ? "—" : `${formatCount(p.readers)}명`}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function StudentEngagement() {
  const load = useCallback(() => fetchStudentEngagement(), []);
  const { state, reload } = useAsyncData(load);
  const [sort, setSort] = useState<StudentSort>("reads");

  return (
    <section className="flex flex-col gap-3" aria-labelledby="student-engagement">
      <SectionTitle>
        <span id="student-engagement" className="inline-flex items-center gap-2">
          <UsersIcon className="size-5 text-games-strong" aria-hidden />
          학생별 참여
        </span>
      </SectionTitle>
      <AsyncView
        state={state}
        onRetry={reload}
        errorText="학생별 참여를 불러오지 못했습니다."
        isEmpty={(rows) => !rows.length}
        empty={<EmptyState title="아직 회원이 없습니다" />}
      >
        {(rows) => <SortedStudents rows={rows} sort={sort} onSort={setSort} />}
      </AsyncView>
    </section>
  );
}

function SortedStudents({
  rows,
  sort,
  onSort,
}: {
  rows: StudentEngagementRow[];
  sort: StudentSort;
  onSort: (k: StudentSort) => void;
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => Number(a.role === "admin") - Number(b.role === "admin") || b[sort] - a[sort],
      ),
    [rows, sort],
  );
  return (
    <TableWrap label="학생별 참여">
      <thead>
        <tr>
          <th className={thClass}>이름</th>
          <SortTh id="reads" label="읽은 글" sort={sort} onSort={onSort} />
          <SortTh id="comments" label="댓글" sort={sort} onSort={onSort} />
          <SortTh id="likes" label="좋아요" sort={sort} onSort={onSort} />
          <SortTh id="results" label="웹앱 결과" sort={sort} onSort={onSort} />
          <SortTh id="submissions" label="과제 제출" sort={sort} onSort={onSort} />
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id}>
            <td className={`${tdClass} max-w-56`}>
              <span className="flex min-w-0 items-center gap-2">
                <StudentLink id={s.id} profile={s} />
                {s.role === "admin" ? <Badge variant="outline">관리자</Badge> : null}
              </span>
            </td>
            <td className={tdClass}>{formatCount(s.reads)}</td>
            <td className={tdClass}>{formatCount(s.comments)}</td>
            <td className={tdClass}>{formatCount(s.likes)}</td>
            <td className={tdClass}>{formatCount(s.results)}</td>
            <td className={tdClass}>{formatCount(s.submissions)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
