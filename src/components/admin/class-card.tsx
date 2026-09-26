"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, SchoolIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminContext } from "@/hooks/use-admin-context";
import { AdminActionError } from "@/lib/admin";
import {
  CLASS_NAME_MAX,
  CLASS_NAME_RECOMMENDED,
  CLASSES_MISSING_MESSAGE,
  classNameLength,
  createClass,
  renameClass,
  validateClassName,
  type AdminClass,
} from "@/lib/classes";
import { formatCount } from "@/lib/format";
import { menuColorClasses } from "@/lib/menu-colors";
import { cn } from "@/lib/utils";

/** 학급이 하나도 없는 담임에게 보여 주는 안내(회원 추가 버튼 옆·대화 상자 안에서도 같은 문구). */
export const NO_CLASS_MESSAGE = "먼저 학급을 개설해 주세요. 학급을 만들어야 학생을 등록할 수 있어요.";

type DialogTarget = { mode: "create" } | { mode: "rename"; target: AdminClass };

/**
 * "내 학급" 카드(관리자 개요·회원 관리 맨 위, docs/classes/spec.md 개정 1-2).
 * 담임교사는 여기서 학급을 개설(이름을 스스로 정함)하고 이름을 바꾼다. 학급 이름은 관리자 화면에서만 보인다.
 */
export function MyClassesCard({ className }: { className?: string }) {
  const ctx = useAdminContext();
  const headingId = useId();
  const [target, setTarget] = useState<DialogTarget>({ mode: "create" });
  const [open, setOpen] = useState(false);

  function openDialog(next: DialogTarget) {
    setTarget(next);
    setOpen(true);
  }

  // 학급 SQL 적용 전: 예전처럼 동작한다는 짧은 안내만(자물쇠 방지 — 다른 화면은 그대로 쓸 수 있다).
  if (ctx.status === "missing") {
    return (
      <p role="note" className={cn("rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground", className)}>
        <span className="font-medium text-foreground">학급 기능 준비 전 · </span>
        {CLASSES_MISSING_MESSAGE}
      </p>
    );
  }

  const superAdmin = ctx.status === "ready" && ctx.isSuperAdmin;
  const chip = menuColorClasses.games.chip;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-3 rounded-2xl p-4 sm:p-5", adminSurfaceClass, className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", chip)} aria-hidden>
          <SchoolIcon className="size-5" />
        </span>
        {/* 좁은 화면에서는 설명이 세 줄로 눌리지 않게 버튼이 아래 줄로 내려간다(min-w) */}
        <div className="flex min-w-[min(100%,15rem)] flex-1 flex-col">
          <h2 id={headingId} className="flex flex-wrap items-center gap-2 font-heading text-lg leading-tight font-normal">
            내 학급
            {superAdmin ? (
              <Badge variant="secondary" title="모든 회원의 비밀번호 초기화·탈퇴 처리, 담임 지정, 로그인 잠금 스위치를 쓸 수 있어요">
                <ShieldCheckIcon aria-hidden />
                총괄
              </Badge>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">학급 이름은 관리자 화면에서만 보여요. 학생 화면에는 나오지 않아요.</p>
        </div>
        <Button className="h-11 px-4" onClick={() => openDialog({ mode: "create" })} disabled={ctx.status !== "ready"}>
          <PlusIcon />
          학급 개설
        </Button>
      </div>

      {ctx.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="내 학급을 불러오는 중">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : ctx.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm">
          <span className="min-w-0 flex-1">학급 정보를 불러오지 못했습니다. 학생 등록 전에 다시 시도해 주세요.</span>
          <Button variant="outline" className="h-11 px-4" onClick={ctx.retry}>
            다시 시도
          </Button>
        </div>
      ) : !ctx.classes.length ? (
        <div className="flex flex-col gap-1 rounded-xl border-2 border-dashed border-primary/20 bg-card/60 px-4 py-4 text-sm" role="status">
          <p className="font-semibold">아직 개설한 학급이 없어요.</p>
          <p className="text-muted-foreground">{NO_CLASS_MESSAGE}</p>
          {superAdmin ? (
            <p className="text-xs text-muted-foreground">
              총괄 선생님도 학습 기록은 내 학급 학생 것만 볼 수 있어요. 교사 계정 만들기·담임 지정은 학급 없이도 할 수 있어요.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10" aria-label="내 학급 목록">
            {ctx.classes.map((c) => (
              <li key={c.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-medium" title={c.name}>
                  {c.name}
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <UsersIcon className="size-4" aria-hidden />
                  학생 {formatCount(c.studentCount)}명
                </span>
                <Button
                  variant="ghost"
                  className="h-11 px-3"
                  onClick={() => openDialog({ mode: "rename", target: c })}
                  aria-label={`${c.name} 이름 바꾸기`}
                >
                  <PencilIcon />
                  이름 바꾸기
                </Button>
              </li>
            ))}
          </ul>
          {superAdmin ? (
            <p className="text-xs text-muted-foreground">
              총괄 선생님은 모든 회원을 찾아 비밀번호 초기화·탈퇴 처리를 할 수 있지만, 학습 기록(웹앱 결과·학생 응답·과제·피드백)은 내
              학급 학생 것만 볼 수 있어요.
            </p>
          ) : null}
        </>
      )}

      <ClassNameDialog target={target} open={open} onOpenChange={setOpen} />
    </section>
  );
}

/**
 * 학급 개설 / 이름 바꾸기 대화 상자. 이름은 앞뒤 공백을 빼고 1~40자(20자 이내 권장).
 * 저장이 끝나면 카드를 바로 고치고(낙관적 갱신) 서버 값으로 다시 읽는다.
 */
export function ClassNameDialog({
  target,
  open,
  onOpenChange,
  onSaved,
}: {
  target: DialogTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 저장 뒤(개설이면 새 학급 id) */
  onSaved?: (classId: string) => void;
}) {
  // 열 때마다 입력 칸을 새로 만든다(이전 입력·오류가 남지 않게). 닫히는 동안에는 내용을 그대로 둔다(렌더 중 상태 보정).
  const [prevOpen, setPrevOpen] = useState(open);
  const [formKey, setFormKey] = useState(0);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setFormKey((k) => k + 1);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ClassNameForm key={formKey} target={target} onDone={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function ClassNameForm({
  target,
  onDone,
  onSaved,
}: {
  target: DialogTarget;
  onDone: () => void;
  onSaved?: (classId: string) => void;
}) {
  const ctx = useAdminContext();
  const fieldId = useId();
  const initial = target.mode === "rename" ? target.target.name : "";
  const [name, setName] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  // 서버와 같은 규칙: 1~40자, 제어 문자 불가, 내 학급끼리 같은 이름 불가(두 번 눌러 같은 학급이 둘 생기는 것도 막는다)
  const selfId = target.mode === "rename" ? target.target.id : null;
  const duplicate = ctx.classes.some((c) => c.id !== selfId && c.name === name.trim());
  const problem = validateClassName(name) ?? (duplicate ? "내 학급에 이미 같은 이름이 있어요. 다른 이름을 적어 주세요." : null);
  const len = classNameLength(name);
  const unchanged = target.mode === "rename" && name.trim() === target.target.name;
  // 확실한 잘못(너무 김·같은 이름·제어 문자)은 적는 동안 바로, "비어 있음"은 칸을 떠난 뒤에만 알린다.
  const showProblem = name.trim() ? problem : touched ? problem : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problem || unchanged || working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const trimmed = name.trim();
    try {
      if (target.mode === "create") {
        const id = await createClass(trimmed);
        ctx.patchClasses((prev) => [...prev.filter((c) => c.id !== id), { id, name: trimmed, studentCount: 0 }]);
        toast.success(`‘${trimmed}’ 학급을 개설했습니다. 이제 이 학급에 학생을 등록할 수 있어요.`);
        onSaved?.(id);
      } else {
        const id = target.target.id;
        await renameClass(id, trimmed);
        ctx.patchClasses((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
        toast.success(`학급 이름을 ‘${trimmed}’(으)로 바꿨습니다.`);
        onSaved?.(id);
      }
      void ctx.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof AdminActionError ? err.message : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{target.mode === "create" ? "학급 개설" : "학급 이름 바꾸기"}</DialogTitle>
        <DialogDescription>
          {target.mode === "create"
            ? "학급 이름을 직접 정해 주세요. 개설하면 내가 이 학급의 담임이 되고, 이 학급에 학생을 등록할 수 있어요."
            : "바꾼 이름은 관리자 화면에만 보여요. 학생 계정과 학습 기록은 그대로예요."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>학급 이름</Label>
        <Input
          id={fieldId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={busy}
          autoComplete="off"
          autoFocus
          placeholder="예: 부엉이반, 6학년 2반"
          className="h-11"
          aria-invalid={!!showProblem}
          aria-describedby={`${fieldId}-help`}
        />
        <p
          id={`${fieldId}-help`}
          className={cn("flex justify-between gap-2 text-xs", showProblem ? "text-destructive" : "text-muted-foreground")}
        >
          <span>
            {showProblem
              ? problem
              : `1~${CLASS_NAME_MAX}자(${CLASS_NAME_RECOMMENDED}자 이내 권장). 학생 화면에는 보이지 않아요.`}
          </span>
          <span className="shrink-0 tabular-nums" aria-hidden>
            {len}/{CLASS_NAME_MAX}
          </span>
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" className="h-11 px-4" disabled={busy} />}>취소</DialogClose>
        <Button type="submit" className="h-11 px-4" disabled={busy || !!problem || unchanged}>
          {busy ? <Loader2Icon className="animate-spin" /> : target.mode === "create" ? <PlusIcon /> : <PencilIcon />}
          {target.mode === "create" ? "개설하기" : "바꾸기"}
        </Button>
      </DialogFooter>
    </form>
  );
}
