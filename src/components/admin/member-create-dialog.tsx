"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminActionError } from "@/lib/admin";
import { withBasePath } from "@/lib/base-path";
import {
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
 * 회원 추가 모달 (docs/admin/create-members/build-instructions.md).
 * 탭 두 개: "한 명 만들기" / "엑셀로 여러 명".
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
          <TabsContent value="one" className="pt-4" keepMounted>
            <SingleForm key={singleKey} onCreated={onCreated} onClose={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="file" className="pt-4" keepMounted>
            <FileForm key={fileKey} onCreated={onCreated} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// 한 명 만들기
// ─────────────────────────────────────────────
function SingleForm({ onCreated, onClose }: { onCreated?: () => void; onClose: () => void }) {
  const idFieldId = useId();
  const pwFieldId = useId();
  const roleFieldId = useId();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<DraftRole>("user");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  const idError = id ? validateLoginId(id) : null;
  const pwError = password ? validatePassword(password) : null;
  const ready = !!id && !!password && !idError && !pwError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const normalized = normalizeLoginId(id);
    try {
      const draft: MemberDraft = {
        key: normalized,
        line: 1,
        id: normalized,
        rawId: id.trim(),
        password,
        role,
        rawRole: roleLabel(role),
        error: null,
        warning: null,
      };
      const [outcome] = await createMembers([draft]);
      if (outcome?.status === "created") {
        onCreated?.();
        if (outcome.warning) toast.warning(outcome.warning, { duration: 12000 });
        else toast.success(`${normalized} 계정을 만들었습니다. 첫 로그인 때 비밀번호를 바꾸게 됩니다.`);
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
            aria-invalid={!!pwError}
            aria-describedby={`${pwFieldId}-help`}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={roleFieldId}>역할</Label>
        <select
          id={roleFieldId}
          value={role}
          onChange={(e) => setRole(e.target.value as DraftRole)}
          disabled={busy}
          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="user">학생</option>
          <option value="admin">교사(관리자)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          교사는 관리자 대시보드를 모두 쓸 수 있습니다. 꼭 필요한 사람만 교사로 만들어 주세요.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" disabled={busy} />}>취소</DialogClose>
        <Button type="submit" disabled={!ready || busy}>
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<MemberDraft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<FilePhase>({ kind: "idle" });
  const working = useRef(false);

  const okCount = drafts.filter((d) => !d.error).length;
  const badCount = drafts.length - okCount;

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
      const outcomes = await createMembers(rows, (done, total) => setPhase({ kind: "working", done, total }));
      const { created, failed } = summarize(outcomes);
      setPhase({ kind: "done", outcomes });
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
    const failedKeys = new Set(outcomes.filter((o) => o.status !== "created").map((o) => o.key));
    run(drafts.filter((d) => failedKeys.has(d.key)));
  }

  const busy = phase.kind === "working" || phase.kind === "parsing";

  return (
    <div className="flex flex-col gap-4">
      <SpecGuide />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fileFieldId}>엑셀(.xlsx) 또는 CSV 파일</Label>
        <Input
          id={fileFieldId}
          type="file"
          accept=".xlsx,.csv,.txt,text/csv"
          onChange={onPick}
          disabled={busy}
          className="h-auto py-1.5"
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

      {drafts.length > 0 && phase.kind !== "done" ? (
        <>
          <PreviewTable drafts={drafts} />
          <p className="text-sm" aria-live="polite">
            만들 수 있는 행 <strong>{okCount}</strong>개
            {badCount > 0 ? (
              <>
                , 고쳐야 할 행 <strong className="text-destructive">{badCount}</strong>개
              </>
            ) : null}
          </p>
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

      {phase.kind === "done" ? <ResultView outcomes={phase.outcomes} onRetry={() => retryFailed(phase.outcomes)} /> : null}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" disabled={busy} />}>
          {phase.kind === "done" ? "닫기" : "취소"}
        </DialogClose>
        {phase.kind !== "done" ? (
          <Button disabled={busy || okCount === 0} onClick={() => run(drafts.filter((d) => !d.error))}>
            {phase.kind === "working" ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
            {okCount > 0 ? `${okCount}명 만들기` : "만들기"}
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

function SpecGuide() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-muted/40 p-3 text-sm">
      <p className="font-medium">엑셀 규격</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-muted-foreground">
        <li>
          첫 줄은 제목 줄: <strong>아이디 · 비밀번호 · 역할</strong> (순서는 달라도 됩니다)
        </li>
        <li>
          역할은 <strong>학생</strong> 또는 <strong>교사</strong>
        </li>
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
        <Button
          size="sm"
          variant="ghost"
          render={<a href={withBasePath("/templates/members-template.csv")} download="회원추가-서식.csv" />}
        >
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

function ResultView({ outcomes, onRetry }: { outcomes: CreateOutcome[]; onRetry: () => void }) {
  const { created, failed } = summarize(outcomes);
  const problems = outcomes.filter((o) => o.status !== "created");
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
          <div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              실패한 {problems.length}행만 다시 시도
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            “이미 있음”은 다시 시도해도 같은 결과입니다. 그 학생의 비밀번호를 바꾸려면 목록에서 <strong>비밀번호
            초기화</strong>를 쓰세요.
          </p>
        </>
      ) : null}
    </div>
  );
}
