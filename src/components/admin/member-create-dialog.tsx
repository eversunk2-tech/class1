"use client";

import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  SchoolIcon,
  UserPlusIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminTabPanelClass } from "@/components/admin/admin-styles";
import { NO_CLASS_MESSAGE } from "@/components/admin/class-card";
import { ClassSelectField } from "@/components/admin/class-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminPermissions, useAdminContext, type AdminContextValue } from "@/hooks/use-admin-context";
import { AdminActionError } from "@/lib/admin";
import { withBasePath } from "@/lib/base-path";
import type { AdminClass } from "@/lib/classes";
import {
  applyRolePolicy,
  buildDrafts,
  createMembers,
  MAX_IMPORT_ROWS,
  MIN_PASSWORD_LENGTH,
  normalizeLoginId,
  roleLabel,
  summarize,
  validateLoginId,
  validatePassword,
  type CreateOutcome,
  type DraftRole,
  type MemberDraft,
} from "@/lib/member-import";
import { readSheetFile, SpreadsheetError } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";

/**
 * 회원 추가 모달 (docs/admin/create-members/build-instructions.md, 학급: docs/classes/spec.md 개정 1).
 * 탭 두 개: "한 명 만들기" / "엑셀로 여러 명".
 * - 학생은 **내 학급 중에서** 고른 학급에 등록된다(학급이 하나면 자동). 엑셀은 파일 하나 = 학급 하나.
 * - 역할 '교사'는 총괄에게만 보인다(교사 계정은 학급 없이 만들어진다).
 *
 * ⚠ 비밀번호는 이 컴포넌트 state에만 두고 **어디에도 저장하지 않는다**(localStorage·로그·미리보기 표 모두 금지).
 *   미리보기에는 길이만 보여 주고, 모달이 완전히 닫히면 state에서도 지운다.
 * 실제 권한 확인과 생성은 Edge Function(admin-create-member)이 한다. 이 화면의 검사는 편의일 뿐이다.
 */
export function MemberCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 한 명이라도 만들어졌을 때. 목록을 새로 고치는 데 쓴다. */
  onCreated?: () => void;
}) {
  const [tab, setTab] = useState<"one" | "file">("one");
  const [singleKey, setSingleKey] = useState(0);
  const [fileKey, setFileKey] = useState(0);

  function reset() {
    setTab("one");
    // key를 바꿔 각 탭을 새로 만든다 → 입력한 비밀번호가 state에서 사라진다.
    setSingleKey((n) => n + 1);
    setFileKey((n) => n + 1);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) reset();
      }}
    >
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>회원 추가</DialogTitle>
          <DialogDescription>
            새 계정을 만듭니다. 만든 계정은 <strong>첫 로그인 때 비밀번호를 새로 정하게</strong> 됩니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "one" | "file")}>
          <TabsList className="w-full">
            <TabsTrigger value="one">한 명 만들기</TabsTrigger>
            <TabsTrigger value="file">엑셀로 여러 명</TabsTrigger>
          </TabsList>
          {/* keepMounted: 탭을 잠깐 바꿔도 고른 파일·입력이 사라지지 않게 한다.
              (모달이 완전히 닫히면 위 reset()이 key를 바꿔 비밀번호까지 함께 지운다.) */}
          <TabsContent value="one" className={cn("pt-4", adminTabPanelClass)} keepMounted>
            <SingleForm key={singleKey} onCreated={onCreated} onClose={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="file" className={cn("pt-4", adminTabPanelClass)} keepMounted>
            <FileForm key={fileKey} onCreated={onCreated} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// 학급 칸(두 탭 공용)
// ─────────────────────────────────────────────

/** 학생을 넣을 학급: 내 학급이 하나면 자동, 여럿이면 고른 값(목록에 없는 값이면 빈 값). */
function effectiveClassId(classes: AdminClass[], picked: string): string {
  if (classes.length === 1) return classes[0].id;
  return classes.some((c) => c.id === picked) ? picked : "";
}

/** 학급이 하나도 없을 때(담임: 학생 등록 불가, 총괄: 교사 계정만 가능). */
function NoClassNote({ superAdmin }: { superAdmin: boolean }) {
  return (
    <div className="flex gap-2 rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm" role="note">
      <SchoolIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium">{NO_CLASS_MESSAGE}</p>
        <p className="text-xs text-muted-foreground">
          이 창을 닫고 ‘내 학급’ 카드의 <strong>학급 개설</strong>을 눌러 주세요.
          {superAdmin ? " 교사 계정은 학급 없이도 만들 수 있어요." : ""}
        </p>
      </div>
    </div>
  );
}

/** 학급 칸: 불러오는 중 / 못 읽음 / 학급 없음 / 고르기(하나면 자동). */
function ClassArea({
  ctx,
  value,
  onChange,
  disabled,
  help,
}: {
  ctx: AdminContextValue;
  value: string;
  onChange: (classId: string) => void;
  disabled?: boolean;
  help?: string;
}) {
  if (ctx.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        학급 정보를 불러오는 중…
      </p>
    );
  }
  if (ctx.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <span className="min-w-0 flex-1">학급 정보를 불러오지 못해 학생을 등록할 수 없습니다.</span>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={ctx.retry}>
          다시 시도
        </Button>
      </div>
    );
  }
  if (!ctx.classes.length) return <NoClassNote superAdmin={ctx.isSuperAdmin} />;
  return <ClassSelectField classes={ctx.classes} value={value} onChange={onChange} disabled={disabled} help={help} />;
}

// ─────────────────────────────────────────────
// 한 명 만들기
// ─────────────────────────────────────────────
function SingleForm({ onCreated, onClose }: { onCreated?: () => void; onClose: () => void }) {
  const idFieldId = useId();
  const pwFieldId = useId();
  const roleFieldId = useId();
  const ctx = useAdminContext();
  const perms = adminPermissions(ctx);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<DraftRole>("user");
  const [pickedClassId, setPickedClassId] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  // 교사 역할은 총괄만(학급 기능 전에는 예전처럼 누구나). 권한이 없으면 언제나 학생.
  const effectiveRole: DraftRole = perms.canCreateTeacher ? role : "user";
  const classId = effectiveClassId(ctx.classes, pickedClassId);
  const needsClass = !perms.legacy && effectiveRole === "user";
  const contextReady = perms.legacy || ctx.status === "ready";
  const idError = id ? validateLoginId(id) : null;
  const pwError = password ? validatePassword(password) : null;
  const ready = contextReady && !!id && !!password && !idError && !pwError && (!needsClass || !!classId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const normalized = normalizeLoginId(id);
    const className = needsClass ? (ctx.classes.find((c) => c.id === classId)?.name ?? null) : null;
    try {
      const draft: MemberDraft = {
        key: normalized,
        line: 1,
        id: normalized,
        rawId: id.trim(),
        password,
        role: effectiveRole,
        rawRole: roleLabel(effectiveRole),
        error: null,
        warning: null,
      };
      const { outcomes, notices } = await createMembers([draft], {
        source: "single",
        classId: needsClass ? classId : null,
      });
      const [outcome] = outcomes;
      if (outcome?.status === "created") {
        onCreated?.();
        for (const notice of notices) toast.warning(notice, { duration: 12000 });
        if (outcome.warning) toast.warning(outcome.warning, { duration: 12000 });
        else if (effectiveRole === "admin" && !perms.legacy) {
          toast.success(`${normalized} 교사 계정을 만들었습니다. 그 선생님이 로그인해 학급을 개설하면 학생을 등록할 수 있어요.`);
        } else {
          toast.success(
            `${normalized} 계정을 ${className ? `‘${className}’에 ` : ""}만들었습니다. 첫 로그인 때 비밀번호를 바꾸게 됩니다.`,
          );
        }
        setPassword("");
        setId("");
        onClose();
        return;
      }
      setError(outcome?.message ?? "계정을 만들지 못했습니다.");
    } catch (err) {
      setError(err instanceof AdminActionError ? err.message : "계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idFieldId}>아이디</Label>
        <Input
          id={idFieldId}
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="예: 60101"
          className="h-11"
          aria-invalid={!!idError}
          aria-describedby={`${idFieldId}-help`}
        />
        <p id={`${idFieldId}-help`} className={cn("text-xs", idError ? "text-destructive" : "text-muted-foreground")}>
          {idError ?? "영문·숫자와 . _ - 만 쓸 수 있습니다. 로그인할 때 쓰는 아이디입니다."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={pwFieldId}>초기 비밀번호</Label>
        <div className="flex items-center gap-2">
          <Input
            id={pwFieldId}
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="new-password"
            placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
            className="h-11"
            aria-invalid={!!pwError}
            aria-describedby={`${pwFieldId}-help`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "비밀번호 가리기" : "비밀번호 보기"}
            aria-pressed={show}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        </div>
        <p id={`${pwFieldId}-help`} className={cn("text-xs", pwError ? "text-destructive" : "text-muted-foreground")}>
          {pwError ?? "학생에게 직접 알려 줄 임시 비밀번호입니다. 학생이 첫 로그인 때 새로 정합니다."}
        </p>
      </div>

      {/* 역할 '교사'는 총괄에게만 보인다(개정 1-1). 담임에게는 칸 자체가 없고 언제나 학생 계정을 만든다. */}
      {perms.canCreateTeacher ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={roleFieldId}>역할</Label>
          <select
            id={roleFieldId}
            value={role}
            onChange={(e) => setRole(e.target.value as DraftRole)}
            disabled={busy}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="user">학생</option>
            <option value="admin">교사(담임)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {perms.legacy
              ? "교사는 관리자 대시보드를 모두 쓸 수 있습니다. 꼭 필요한 사람만 교사로 만들어 주세요."
              : effectiveRole === "admin"
                ? "교사 계정은 학급 없이 만들어져요. 그 선생님이 로그인해 직접 학급을 개설하고 학생을 등록합니다."
                : "교사로 만들면 관리자 대시보드에서 자기 학급을 개설하고 학생을 등록할 수 있어요. 꼭 필요한 사람만 교사로 만들어 주세요."}
          </p>
        </div>
      ) : null}

      {needsClass ? (
        <ClassArea
          ctx={ctx}
          value={classId}
          onChange={setPickedClassId}
          disabled={busy}
          help={ctx.classes.length === 1 ? "내 학급이 하나라서 이 학급에 등록돼요." : undefined}
        />
      ) : null}

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" className="h-11 px-4" disabled={busy} />}>취소</DialogClose>
        <Button type="submit" className="h-11 px-4" disabled={!ready || busy}>
          {busy ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
          만들기
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─────────────────────────────────────────────
// 엑셀로 여러 명
// ─────────────────────────────────────────────
type FilePhase =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "ready" }
  | { kind: "working"; done: number; total: number }
  | { kind: "done"; outcomes: CreateOutcome[] };

function FileForm({ onCreated }: { onCreated?: () => void }) {
  const fileFieldId = useId();
  const ctx = useAdminContext();
  const perms = adminPermissions(ctx);
  const [fileName, setFileName] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<MemberDraft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  /** 행과 상관없는 서버 안내(예: 감사 로그용 SQL 미실행). */
  const [serverNotices, setServerNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FilePhase>({ kind: "idle" });
  const [pickedClassId, setPickedClassId] = useState("");
  const working = useRef(false);

  // 담임에게는 "교사" 줄을 고쳐야 할 줄로 보여 준다(교사 계정은 총괄만 — 서버도 거부한다).
  const checked = useMemo(() => applyRolePolicy(drafts, perms.canCreateTeacher), [drafts, perms.canCreateTeacher]);
  const okCount = checked.filter((d) => !d.error).length;
  const badCount = checked.length - okCount;
  const studentCount = checked.filter((d) => !d.error && d.role === "user").length;
  const teacherCount = okCount - studentCount;

  // 파일 하나 = 학급 하나: 학생 줄은 모두 이 학급에 등록된다(개정 1 — 서식 파일은 바꾸지 않음).
  const classId = effectiveClassId(ctx.classes, pickedClassId);
  const className = ctx.classes.find((c) => c.id === classId)?.name ?? null;
  const classMissing = !perms.legacy && studentCount > 0 && !classId;
  const contextReady = perms.legacy || ctx.status === "ready";
  // 학급이 없는 담임은 만들 수 있는 것이 없다(학생은 학급 필요, 교사는 총괄만).
  const nothingAllowed = ctx.status === "ready" && !ctx.classes.length && !perms.canCreateTeacher;

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setNotice(null);
    setDrafts([]);
    setPhase({ kind: "parsing" });
    try {
      const table = await readSheetFile(file);
      const result = buildDrafts(table);
      if (!result.ok) {
        setError(result.message);
        setPhase({ kind: "idle" });
        return;
      }
      setDrafts(result.drafts);
      setNotice(result.notice);
      setPhase({ kind: "ready" });
    } catch (err) {
      setError(
        err instanceof SpreadsheetError
          ? err.message
          : "파일을 읽지 못했습니다. 엑셀(.xlsx) 또는 CSV 파일인지 확인해 주세요.",
      );
      setPhase({ kind: "idle" });
    }
  }

  async function run(rows: MemberDraft[]) {
    if (!rows.length || working.current) return;
    working.current = true;
    setError(null);
    setPhase({ kind: "working", done: 0, total: rows.length });
    try {
      const { outcomes, notices } = await createMembers(rows, {
        source: "bulk",
        classId: perms.legacy ? null : classId || null,
        onProgress: (done, total) => setPhase({ kind: "working", done, total }),
      });
      const { created, failed } = summarize(outcomes);
      setPhase({ kind: "done", outcomes });
      setServerNotices(notices);
      if (created > 0) onCreated?.();
      if (created > 0 && failed === 0) toast.success(`${created}명을 만들었습니다.`);
      else if (created > 0) toast.warning(`${created}명 성공, ${failed}명 실패했습니다.`);
      else toast.error("한 명도 만들지 못했습니다. 아래 사유를 확인해 주세요.");
    } catch (err) {
      setError(err instanceof AdminActionError ? err.message : "회원을 만들지 못했습니다.");
      setPhase({ kind: "ready" });
    } finally {
      working.current = false;
    }
  }

  function retryFailed(outcomes: CreateOutcome[]) {
    // 다시 보낼 값이 있는 행만 보낸다(review L3).
    // "이미 있음"은 다시 해도 같은 결과이고, "형식 오류"는 파일을 고쳐야 하므로 호출을 낭비하지 않는다.
    const retryKeys = new Set(retryable(outcomes).map((o) => o.key));
    run(checked.filter((d) => !d.error && retryKeys.has(d.key)));
  }

  const busy = phase.kind === "working" || phase.kind === "parsing";

  return (
    <div className="flex flex-col gap-4">
      <SpecGuide allowTeacher={perms.canCreateTeacher} classMode={!perms.legacy} />

      {!perms.legacy ? (
        <ClassArea
          ctx={ctx}
          value={classId}
          onChange={setPickedClassId}
          disabled={busy || phase.kind === "done"}
          help={
            ctx.classes.length === 1
              ? "내 학급이 하나라서 파일의 학생은 모두 이 학급에 등록돼요."
              : "파일의 학생은 모두 고른 학급에 등록돼요(파일 하나에 학급 하나)."
          }
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fileFieldId}>엑셀(.xlsx) 또는 CSV 파일</Label>
        <Input
          id={fileFieldId}
          type="file"
          accept=".xlsx,.csv,.txt,text/csv"
          onChange={onPick}
          disabled={busy || nothingAllowed}
          className="h-auto min-h-11 py-2"
        />
        {fileName ? <p className="text-xs text-muted-foreground">고른 파일: {fileName}</p> : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {phase.kind === "parsing" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          파일을 읽는 중…
        </p>
      ) : null}

      {notice ? (
        <p className="flex gap-2 rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm" role="note">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{notice}</span>
        </p>
      ) : null}

      {checked.length > 0 && phase.kind !== "done" ? (
        <>
          <PreviewTable drafts={checked} />
          <p className="text-sm" aria-live="polite">
            만들 수 있는 행 <strong>{okCount}</strong>개
            {badCount > 0 ? (
              <>
                , 고쳐야 할 행 <strong className="text-destructive">{badCount}</strong>개
              </>
            ) : null}
          </p>
          {!perms.legacy && okCount > 0 ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
              {studentCount > 0 ? (
                <span>
                  학생 <strong className="text-foreground">{studentCount}</strong>명 →{" "}
                  {className ? <strong className="text-foreground">‘{className}’</strong> : <span className="text-foreground">학급을 골라 주세요</span>}
                </span>
              ) : null}
              {teacherCount > 0 ? (
                <span>
                  교사 <strong className="text-foreground">{teacherCount}</strong>명(학급 없이 만들어져요)
                </span>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}

      {phase.kind === "working" ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${phase.total ? Math.round((phase.done / phase.total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            만드는 중… {phase.done}/{phase.total}
          </p>
        </div>
      ) : null}

      {phase.kind === "done" ? (
        <ResultView
          outcomes={phase.outcomes}
          serverNotices={serverNotices}
          onRetry={() => retryFailed(phase.outcomes)}
        />
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" className="h-11 px-4" disabled={busy} />}>
          {phase.kind === "done" ? "닫기" : "취소"}
        </DialogClose>
        {phase.kind !== "done" ? (
          <Button
            className="h-11 px-4"
            disabled={busy || okCount === 0 || classMissing || !contextReady}
            onClick={() => run(checked.filter((d) => !d.error))}
          >
            {phase.kind === "working" ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
            {okCount > 0 ? `${okCount}명 만들기` : "만들기"}
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

/** CSV 서식은 파일로 두지 않고 화면에서 만든다 — .gitignore가 `*.csv`를 막기 때문(계정 CSV에는 비밀번호가 들어간다). */
const CSV_TEMPLATE = "아이디,비밀번호,역할\n60101,class1234,학생\n60102,class1234,학생\n";

function downloadCsvTemplate() {
  // 엑셀이 한글을 깨뜨리지 않도록 BOM을 붙인다.
  const blob = new Blob([`﻿${CSV_TEMPLATE}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "회원추가-서식.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SpecGuide({ allowTeacher, classMode }: { allowTeacher: boolean; classMode: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-muted/40 p-3 text-sm">
      <p className="font-medium">엑셀 규격</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-muted-foreground">
        <li>
          첫 줄은 제목 줄: <strong>아이디 · 비밀번호 · 역할</strong> (순서는 달라도 됩니다)
        </li>
        {allowTeacher ? (
          <li>
            역할은 <strong>학생</strong> 또는 <strong>교사</strong>
            {classMode ? " (교사는 학급 없이 만들어져요)" : ""}
          </li>
        ) : (
          <li>
            역할은 <strong>학생</strong> (교사 계정은 총괄 선생님만 만들 수 있어요)
          </li>
        )}
        {classMode ? <li>학생은 아래에서 고른 학급에 모두 등록돼요 — 파일 하나에 학급 하나</li> : null}
        <li>비밀번호는 {MIN_PASSWORD_LENGTH}자 이상, 앞뒤 공백 없이</li>
        <li>아이디는 영문·숫자와 . _ - (한글·공백 불가)</li>
        <li>한 번에 최대 {MAX_IMPORT_ROWS}명까지</li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          render={<a href={withBasePath("/templates/members-template.xlsx")} download="회원추가-서식.xlsx" />}
        >
          <FileSpreadsheetIcon />
          서식 내려받기 (.xlsx)
        </Button>
        <Button size="sm" variant="ghost" onClick={downloadCsvTemplate}>
          <DownloadIcon />
          CSV 서식
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">서식의 예시 2줄은 지우고 실제 명단을 적어 주세요.</p>
    </div>
  );
}

function PreviewTable({ drafts }: { drafts: MemberDraft[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <caption className="sr-only">올린 파일에서 읽은 회원 목록과 검사 결과</caption>
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-medium">
              줄
            </th>
            <th scope="col" className="px-2 py-1.5 font-medium">
              아이디
            </th>
            <th scope="col" className="px-2 py-1.5 font-medium">
              역할
            </th>
            <th scope="col" className="px-2 py-1.5 font-medium">
              비밀번호
            </th>
            <th scope="col" className="px-2 py-1.5 font-medium">
              검사 결과
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {drafts.map((d) => (
            <tr key={d.key} className={cn(d.error && "bg-destructive/5 text-destructive")}>
              <td className="px-2 py-1.5 tabular-nums">{d.line}</td>
              <td className="max-w-40 truncate px-2 py-1.5 font-medium">{d.id || d.rawId || "—"}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{d.role ? roleLabel(d.role) : d.rawRole || "—"}</td>
              {/* 비밀번호 값은 절대 보여 주지 않는다. 길이만 확인한다. */}
              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                {d.password ? `${d.password.length}자` : "없음"}
              </td>
              <td className="px-2 py-1.5">
                {d.error ? (
                  <span className="flex items-start gap-1">
                    <XCircleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>{d.error}</span>
                  </span>
                ) : d.warning ? (
                  <span className="flex items-start gap-1 text-muted-foreground">
                    <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>{d.warning}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2Icon className="size-3.5 shrink-0" aria-hidden />
                    만들 수 있음
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_LABELS: Record<CreateOutcome["status"], string> = {
  created: "만들어짐",
  exists: "이미 있음",
  invalid: "형식 오류",
  failed: "실패",
};

/** 다시 보내 볼 값이 있는 행(review L3). "이미 있음"·"형식 오류"는 다시 보내도 결과가 같다. */
function retryable(outcomes: CreateOutcome[]): CreateOutcome[] {
  return outcomes.filter((o) => o.status === "failed");
}

function ResultView({
  outcomes,
  serverNotices,
  onRetry,
}: {
  outcomes: CreateOutcome[];
  serverNotices: string[];
  onRetry: () => void;
}) {
  const { created, failed } = summarize(outcomes);
  const problems = outcomes.filter((o) => o.status !== "created");
  const retryList = retryable(outcomes);
  const warnings = outcomes.filter((o) => o.status === "created" && o.warning);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="rounded-xl border border-foreground/10 bg-muted/40 p-3 text-sm">
        성공 <strong>{created}</strong>명
        {failed > 0 ? (
          <>
            , 실패 <strong className="text-destructive">{failed}</strong>명
          </>
        ) : null}
        . 만들어진 계정은 첫 로그인 때 비밀번호를 새로 정합니다.
      </p>

      {serverNotices.map((notice) => (
        <p
          key={notice}
          className="flex gap-2 rounded-xl border border-foreground/10 bg-muted/50 p-3 text-sm"
          role="note"
        >
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{notice}</span>
        </p>
      ))}

      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {warnings.map((o) => (
            <li key={o.key} className="flex gap-2">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                {o.line}줄 {o.id}: {o.warning}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {problems.length > 0 ? (
        <>
          <div className="max-h-48 overflow-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <caption className="sr-only">만들지 못한 행과 사유</caption>
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    줄
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    아이디
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    결과
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-medium">
                    사유
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {problems.map((o) => (
                  <tr key={o.key} className="bg-destructive/5">
                    <td className="px-2 py-1.5 tabular-nums">{o.line}</td>
                    <td className="max-w-40 truncate px-2 py-1.5 font-medium">{o.id}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{STATUS_LABELS[o.status]}</td>
                    <td className="px-2 py-1.5">{o.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {retryList.length > 0 ? (
            <div>
              <Button variant="outline" size="sm" onClick={onRetry}>
                다시 시도할 수 있는 {retryList.length}행만 다시 시도
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            “이미 있음”과 “형식 오류”는 다시 시도해도 같은 결과라 다시 보내지 않습니다. 형식 오류는 파일을 고쳐 다시
            올려 주세요. 이미 있는 학생의 비밀번호를 바꾸려면 목록에서 <strong>비밀번호 초기화</strong>를 쓰세요.
          </p>
        </>
      ) : null}
    </div>
  );
}
