"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { BellIcon, CalendarClockIcon, SchoolIcon, Trash2Icon } from "lucide-react";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { ClassCleanupDialog, type ClassCleanupTarget } from "@/components/admin/class-cleanup-dialog";
import { ListSkeleton, NativeSelect } from "@/components/learning/learning-ui";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import { useAdminContext } from "@/hooks/use-admin-context";
import {
  fetchClassRetentionStatus,
  PrivacyMissingError,
  type RetentionClass,
  type RetentionStatus,
} from "@/lib/admin-privacy";
import type { AdminClass } from "@/lib/classes";
import { cn } from "@/lib/utils";

/**
 * 회원 추가에서 학생을 넣을 학급 고르기(docs/classes/spec.md 개정 1-2 ③). 과제 만들기(개정 3-2)도 같은 칸을 쓴다.
 * 내 학급이 하나면 자동으로 정해 보여 주기만 하고, 여럿이면 고르게 한다(잘못 넣지 않도록 미리 고르지 않음).
 * 학급이 하나도 없을 때는 호출하는 쪽이 "먼저 학급을 개설해 주세요"를 보여 준다.
 */
export function ClassSelectField({
  classes,
  value,
  onChange,
  disabled,
  help,
  pickHelp,
  invalid,
}: {
  classes: AdminClass[];
  value: string;
  onChange: (classId: string) => void;
  disabled?: boolean;
  /** 칸 아래 안내 문구 */
  help?: string;
  /** 아직 고르지 않았을 때의 안내 문구(기본: 학생 등록용) */
  pickHelp?: string;
  /** 저장하려는데 고르지 않았을 때 — 칸을 오류로 표시한다 */
  invalid?: boolean;
}) {
  const fieldId = useId();
  const helpId = `${fieldId}-help`;
  if (classes.length === 1) {
    const only = classes[0];
    return (
      <div className="flex flex-col gap-1.5">
        <span id={`${fieldId}-label`} className="text-sm font-medium">
          학급
        </span>
        <p
          aria-labelledby={`${fieldId}-label`}
          aria-describedby={helpId}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm"
        >
          <SchoolIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 truncate font-medium">{only.name}</span>
        </p>
        <p id={helpId} className="text-xs text-muted-foreground">
          {help ?? "내 학급이 하나라서 자동으로 골랐어요."}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium">
        학급
      </label>
      <NativeSelect
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={helpId}
        className="h-11 w-full px-3 aria-invalid:border-destructive"
      >
        <option value="" disabled>
          학급을 골라 주세요
        </option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </NativeSelect>
      <p
        id={helpId}
        role={invalid && !value ? "alert" : undefined}
        className={cn("text-xs", invalid && !value ? "text-destructive" : value ? "text-muted-foreground" : "text-foreground")}
      >
        {value ? (help ?? "학생은 고른 학급에 등록돼요.") : (pickHelp ?? "학생을 등록할 학급을 골라 주세요.")}
      </p>
    </div>
  );
}

/**
 * 학습 현황의 학급 고르기(내 학급이 2개 이상인 선생님에게만 보인다 — 개정 1 "학급 고르기 필터(선택)").
 * 학생별 화면(학생 응답·과제 제출 현황·웹앱 결과·참여 집계)의 학생 범위를 좁힌다. 기본은 "내 학급 전체".
 */
export function ClassScopePicker({ className }: { className?: string }) {
  const ctx = useAdminContext();
  const fieldId = useId();
  if (ctx.status !== "ready" || ctx.classes.length < 2) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label htmlFor={fieldId} className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
        <SchoolIcon className="size-4 text-muted-foreground" aria-hidden />
        학급
      </label>
      <NativeSelect
        id={fieldId}
        value={ctx.selectedClassId ?? ""}
        onChange={(e) => ctx.setSelectedClassId(e.target.value || null)}
        className="h-11 max-w-[16rem] px-3"
      >
        <option value="">내 학급 전체({ctx.classes.length}개)</option>
        {ctx.classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/** 학급을 하나 고른 상태에서, 학급으로 나눌 수 없는 숫자(서버 집계)를 보여 주는 화면에 붙이는 안내. */
export function WholeScopeNote({ className }: { className?: string }) {
  const ctx = useAdminContext();
  if (ctx.status !== "ready" || !ctx.selectedClassId) return null;
  return (
    <p role="note" className={cn("text-xs text-muted-foreground", className)}>
      이 화면의 숫자는 고른 학급이 아니라 <strong className="font-medium text-foreground">내 학급 전체</strong> 기준이에요.
    </p>
  );
}

/**
 * 학생 명단을 쓰는 학습 화면(학생 응답·과제·웹앱 결과·참여 집계)의 문지기: 내 학급을 알기 전에는 불러오지 않는다.
 * 총괄은 회원 명단에서 모든 학생을 읽을 수 있어서, 학급을 모른 채 불러오면 다른 학급 학생이 "시작 안 함·미제출"로 섞인다.
 * 학급 SQL 적용 전("missing")에는 예전처럼 바로 보여 준다.
 */
export function ClassScopeGate({ children }: { children: ReactNode }) {
  const ctx = useAdminContext();
  if (ctx.status === "loading") return <ListSkeleton label="내 학급을 확인하는 중" />;
  if (ctx.status === "error") {
    return <ErrorState message="학급 정보를 불러오지 못해 학생 목록을 보여 줄 수 없습니다." onRetry={ctx.retry} />;
  }
  return <>{children}</>;
}

type RetentionState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; data: RetentionStatus };

/**
 * 학급 정리 기한 카드(docs/privacy/spec.md 4.7-3 개정 3, 문구 privacy-policy.md 8-7 "학급 정리 기한"·"2월 알림").
 * - 학급 정리 기한: 기한(종업식 뒤 그 학년도의 2월 28일)이 지났는데 남은 학생이 있는 학급.
 * - 2월 알림: 2월 한 달 동안, 이번 학년도 학생이 남아 있는 학급(2월 28일까지 정리).
 * 담임은 자기 학급, 총괄은 전체(admin_class_retention_status가 거른다). 자동으로 지우지 않는다(사용자 결정 9) —
 * [학급 정리 열기]로 확인 창을 연다.
 * - 개요(variant "overview"): 보일 것이 없거나·읽는 중·SQL ① 전·못 읽음이면 아무것도 그리지 않는다(화면을 어지럽히지 않게).
 * - 개인정보 설정(variant "settings"): 읽는 중·못 읽음도 보인다.
 */
export function ClassRetentionCard({
  variant = "overview",
  className,
}: {
  variant?: "overview" | "settings";
  className?: string;
}) {
  const ctx = useAdminContext();
  const [state, setState] = useState<RetentionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [target, setTarget] = useState<ClassCleanupTarget | null>(null);
  const [open, setOpen] = useState(false);
  const ready = ctx.status === "ready";

  useEffect(() => {
    if (!ready) return;
    let active = true;
    fetchClassRetentionStatus().then(
      (data) => {
        if (active) setState({ status: "ready", data });
      },
      (e: unknown) => {
        if (active) setState({ status: e instanceof PrivacyMissingError ? "missing" : "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [ready, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  function openCleanup(c: RetentionClass) {
    setTarget({ classId: c.classId, className: c.className });
    setOpen(true);
  }

  // 확인 창은 목록이 비어도 같은 자리에 그대로 둔다(<>{내용}{창}</> — 내용만 바뀐다) — 정리를 마쳐 그 학급이 목록에서
  // 빠져도(다시 읽기) 창의 "정리했어요"와 [이어서 학급 삭제]·학급 삭제 창이 사라지거나 처음부터 다시 그려지지 않게(2026-10-22).
  let content: ReactNode = null;
  if (state.status === "loading") {
    content = variant === "settings" ? <ListSkeleton rows={1} label={T.settings.retentionHeading} /> : null;
  } else if (state.status === "missing") {
    content = null; // 준비 전 안내는 개인정보 설정 화면 위쪽에서 한 번만
  } else if (state.status === "error") {
    content = variant === "settings" ? <ErrorState message={EXTRA.overviewError} onRetry={reload} /> : null;
  } else if (state.data.classes.length || state.data.februaryClasses.length) {
    const { data } = state;
    content = (
      <div className={cn("flex flex-col gap-4", className)}>
        {data.classes.length ? (
          <RetentionBlock
            tone="overdue"
            heading={T.settings.retentionHeading}
            body={fillText(T.settings.retentionBody, { n: data.overdueStudents })}
            classes={data.classes}
            onOpen={openCleanup}
          />
        ) : null}
        {data.februaryClasses.length ? (
          <RetentionBlock
            tone="february"
            heading={T.settings.februaryHeading}
            body={fillText(T.settings.februaryBody, { n: data.februaryStudents })}
            classes={data.februaryClasses}
            onOpen={openCleanup}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      {content}
      <ClassCleanupDialog
        target={target}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => {
          reload();
          void ctx.refresh();
        }}
        onDeleted={reload}
      />
    </>
  );
}

function RetentionBlock({
  tone,
  heading,
  body,
  classes,
  onOpen,
}: {
  tone: "overdue" | "february";
  heading: string;
  body: string;
  classes: RetentionClass[];
  onOpen: (c: RetentionClass) => void;
}) {
  const headingId = useId();
  const overdue = tone === "overdue";
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4 sm:p-5",
        adminSurfaceClass,
        overdue ? "ring-destructive/35" : "ring-amber-400/60 dark:ring-amber-400/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            overdue ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
          )}
          aria-hidden
        >
          {overdue ? <CalendarClockIcon className="size-5" /> : <BellIcon className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={headingId} className="font-heading text-lg leading-tight font-normal">
            {heading}
          </h2>
          <p className="text-sm">{body}</p>
        </div>
      </div>
      <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
        {classes.map((c) => (
          <li key={c.classId} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={c.className}>
              {fillText(T.settings.retentionClass, { "학급 이름": c.className, n: c.students })}
            </span>
            <Button
              variant="outline"
              className="h-11 px-3 text-destructive hover:text-destructive"
              onClick={() => onOpen(c)}
              aria-label={`${c.className} ${T.settings.retentionOpen}`}
            >
              <Trash2Icon />
              {T.settings.retentionOpen}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
