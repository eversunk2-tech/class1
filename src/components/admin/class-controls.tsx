"use client";

import { useId, type ReactNode } from "react";
import { SchoolIcon } from "lucide-react";
import { ListSkeleton, NativeSelect } from "@/components/learning/learning-ui";
import { ErrorState } from "@/components/states";
import { useAdminContext } from "@/hooks/use-admin-context";
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
