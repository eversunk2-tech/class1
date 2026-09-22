"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircle2Icon, InfoIcon, Loader2Icon, PartyPopperIcon, PencilIcon, RotateCcwIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { PraiseMissingNotice, PraisePresetManager } from "@/components/admin/praise-preset-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import { FEEDBACK_BODY_MAX } from "@/lib/learning";
import {
  fetchPraisePresets,
  fillPraise,
  PRAISE_BODY_MAX,
  PRAISE_MAX_RECIPIENTS,
  PRAISE_NAME_TOKEN,
  praiseBodyProblem,
  sendPraise,
  type PraiseFailure,
  type PraiseTarget,
} from "@/lib/praise";
import { cn } from "@/lib/utils";

/** 칭찬 대상 후보(그 앱을 완료한 학생) */
export type PraiseCandidate = PraiseTarget & {
  /** 이 학생의 이 앱 결과 전부(다시 한 것 포함)에 선생님이 이미 보낸 메시지 수(0이면 아직 안 보냄) */
  teacherMessages: number;
};

/** 기본 선택: 아직 안 보낸 학생 중 앞에서부터 PRAISE_MAX_RECIPIENTS명(review L9) */
function defaultSelection(candidates: PraiseCandidate[]): Set<string> {
  return new Set(
    candidates
      .filter((c) => c.teacherMessages === 0)
      .slice(0, PRAISE_MAX_RECIPIENTS)
      .map((c) => c.studentId),
  );
}

type Step = "compose" | "manage" | "confirm" | "sending" | "done";

/** 보내는 중인지(다이얼로그 닫기 막기). 한 화면에 다이얼로그가 하나뿐이라 모듈 ref로 충분하다. */
const sendingRef = { current: false };

/**
 * 일괄 칭찬(docs/admin/responses-spec.md §4.5): 대상 고르기 → 문구(미리 만든 문구 클릭 또는 직접 입력) → 확인 → 보내기(진행 표시) → 결과(부분 실패 · 재시도).
 * - 이미 보낸 학생은 표시하고 기본 선택에서 뺀다(다시 골라 보낼 수는 있음 — 실수 방지용 표시).
 * - 한 번에 PRAISE_MAX_RECIPIENTS명까지.
 */
export function PraiseDialog({
  open,
  onOpenChange,
  appTitle,
  candidates,
  recheck,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appTitle: string;
  candidates: PraiseCandidate[];
  /** 보내기 직전 서버에서 다시 센 "학생 id → 선생님 메시지 수"(다른 탭·기기에서 방금 보낸 것 확인용) */
  recheck?: () => Promise<Map<string, number>>;
  /** 한 명이라도 보냈으면(목록의 "이미 보냄" 갱신용) — 학생 id 목록 */
  onSent: (studentIds: string[]) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && sendingRef.current) return; // 보내는 중에는 닫지 않는다
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl" showCloseButton={false}>
        {open ? <PraiseFlow appTitle={appTitle} candidates={candidates} recheck={recheck} onSent={onSent} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PraiseFlow({
  appTitle,
  candidates,
  recheck,
  onSent,
  onClose,
}: {
  appTitle: string;
  candidates: PraiseCandidate[];
  recheck?: () => Promise<Map<string, number>>;
  onSent: (studentIds: string[]) => void;
  onClose: () => void;
}) {
  const loadPresets = useCallback(() => fetchPraisePresets(), []);
  const presets = useAsyncData(loadPresets);

  /** 이 다이얼로그에서 보냈거나(또는 같은 문장이 이미 있어 건너뛴) 학생 id */
  const [sentNow, setSentNow] = useState<Set<string>>(() => new Set());
  /** 보내기 직전 다시 확인한 선생님 메시지 수(학생 id →) */
  const [fresh, setFresh] = useState<Map<string, number> | null>(null);
  /** 다시 확인에서 새로 "이미 보냄"이 된 학생 — 한 번 더 확인받는다 */
  const [newlySent, setNewlySent] = useState<string[]>([]);
  const alreadySent = useCallback(
    (c: PraiseCandidate) => c.teacherMessages > 0 || (fresh?.get(c.studentId) ?? 0) > 0 || sentNow.has(c.studentId),
    [sentNow, fresh],
  );
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(candidates));
  const [text, setText] = useState("");
  const [step, setStep] = useState<Step>("compose");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ sent: PraiseTarget[]; skipped: PraiseTarget[]; failed: PraiseFailure[] } | null>(null);
  const firing = useRef(false);

  const targets = useMemo(() => candidates.filter((c) => selected.has(c.studentId)), [candidates, selected]);
  const problem = text.trim() ? praiseBodyProblem(text) : null;
  const tooLongFor = targets.find((t) => fillPraise(text, t.praiseName).length > FEEDBACK_BODY_MAX);
  const overLimit = targets.length > PRAISE_MAX_RECIPIENTS;
  const resendCount = targets.filter(alreadySent).length;
  const canSend = targets.length > 0 && !!text.trim() && !problem && !tooLongFor && !overLimit;
  const unnamed = targets.filter((t) => t.praiseName == null);
  const firstNamed = targets.find((t) => t.praiseName != null);
  /** 미리보기: 이름 있는 학생 1명 + 이름 없는 학생 1명(있으면) — 실제로 나갈 문장 그대로 */
  const previews = [
    ...(firstNamed ? [{ who: `${firstNamed.name}에게`, body: fillPraise(text, firstNamed.praiseName) }] : []),
    ...(unnamed[0] ? [{ who: `${unnamed[0].name}에게(이름이 등록되지 않아 이름 없이)`, body: fillPraise(text, null) }] : []),
  ];
  if (!previews.length) previews.push({ who: "예: 김하늘에게", body: fillPraise(text, "김하늘") });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (firing.current || !canSend) return;
    firing.current = true;
    sendingRef.current = true;
    setStep("sending");
    setProgress({ done: 0, total: targets.length });
    try {
      // 보내기 직전에 최신 상태를 다시 조회한다(review L6·L7). 그사이 다른 곳에서 메시지를 받은 학생이 새로 생겼으면
      // 바로 보내지 않고 확인 화면에 알린 뒤 한 번 더 누르게 한다.
      if (recheck && !newlySent.length) {
        let latest: Map<string, number> | null = null;
        try {
          latest = await recheck();
        } catch {
          latest = null; // 확인 실패는 전송을 막지 않는다(같은 문장 중복은 sendPraise가 다시 막는다)
        }
        if (latest) {
          setFresh(latest);
          const appeared = targets.filter((t) => !alreadySent(t) && (latest.get(t.studentId) ?? 0) > 0);
          if (appeared.length) {
            setNewlySent(appeared.map((t) => t.studentId));
            setStep("confirm");
            return;
          }
        }
      }
      const res = await sendPraise(
        targets.map(({ studentId, resultId, name, praiseName }) => ({ studentId, resultId, name, praiseName })),
        text,
        (done, total) => setProgress({ done, total }),
      );
      setResult(res);
      setNewlySent([]);
      const delivered = [...res.sent, ...res.skipped].map((s) => s.studentId);
      if (delivered.length) setSentNow((prev) => new Set([...prev, ...delivered]));
      if (res.sent.length) onSent(res.sent.map((s) => s.studentId));
      // 다시 보내기 실수를 막기 위해 보낸 학생은 선택에서 뺀다(실패한 학생만 남김).
      setSelected(new Set(res.failed.map((f) => f.studentId)));
      const skippedNote = res.skipped.length ? ` ${res.skipped.length}명은 같은 문구를 이미 받아 건너뛰었어요.` : "";
      if (res.failed.length) toast.warning(`${res.sent.length}명에게 보냈고, ${res.failed.length}명은 보내지 못했어요.${skippedNote}`);
      else toast.success(`${res.sent.length}명에게 칭찬을 보냈어요.${skippedNote}`);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "칭찬을 보내지 못했어요.");
      setStep("confirm");
    } finally {
      firing.current = false;
      sendingRef.current = false;
    }
  }

  if (step === "manage") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>칭찬 문구 관리</DialogTitle>
          <DialogDescription>여기서 고친 문구는 다음에도 계속 쓸 수 있어요.</DialogDescription>
        </DialogHeader>
        <PraisePresetManager onChanged={(list) => presets.setData((d) => ({ ...d, presets: list }))} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setStep("compose")}>
            <ArrowLeftIcon />
            칭찬 보내기로 돌아가기
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (step === "confirm" || step === "sending") {
    const sending = step === "sending";
    return (
      <>
        <DialogHeader>
          <DialogTitle>{sending ? "칭찬을 보내고 있어요" : `${targets.length}명에게 칭찬을 보낼까요?`}</DialogTitle>
          <DialogDescription>
            {appTitle} · 학생마다 이 활동 결과에 연결된 피드백 대화로 보내요. 보낸 메시지는 지울 수 없어요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {newlySent.length ? (
            <p className="inline-flex items-start gap-1.5 rounded-xl bg-destructive/5 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30" role="alert">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                방금 다시 확인해 보니 {targets.filter((t) => newlySent.includes(t.studentId)).map((t) => t.name).join(", ")} 학생은 그사이 다른 곳에서 선생님 메시지를
                받았어요. 빼려면 &lsquo;고치기&rsquo;를, 그래도 보내려면 아래 버튼을 한 번 더 눌러 주세요.
              </span>
            </p>
          ) : null}
          {resendCount ? (
            <p className="inline-flex items-start gap-1.5 text-sm text-math-strong">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              이 가운데 {resendCount}명은 이 활동에서 이미 선생님 메시지를 받은 학생이에요(다시 한 결과 포함).
            </p>
          ) : null}
          {unnamed.length ? (
            <p className="inline-flex items-start gap-1.5 text-sm text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              이름이 등록되지 않은 {unnamed.length}명은 {PRAISE_NAME_TOKEN} 자리를 빼고 자연스러운 문장으로 보내요.
            </p>
          ) : null}
          <section className="flex flex-col gap-1.5" aria-label="학생별로 실제로 보낼 문장">
            <h3 className="text-sm font-medium">학생별로 보낼 문장</h3>
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-xl p-1 ring-1 ring-foreground/10">
              {targets.map((t) => (
                <li key={t.studentId} className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{t.name}</span>
                    {t.praiseName == null ? (
                      <Badge variant="outline" className="text-[0.7rem]">
                        이름 없이 보냄
                      </Badge>
                    ) : null}
                    {alreadySent(t) ? (
                      <Badge variant="outline" className="text-[0.7rem]">
                        이미 받은 메시지 있음
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-sm break-words whitespace-pre-wrap">{fillPraise(text, t.praiseName)}</span>
                </li>
              ))}
            </ul>
          </section>
          {sending ? (
            <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
              <p className="text-sm tabular-nums">
                {progress.done} / {progress.total} 보냄
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNewlySent([]);
              setStep("compose");
            }}
            disabled={sending}
          >
            <ArrowLeftIcon />
            고치기
          </Button>
          <Button type="button" onClick={() => void send()} disabled={sending || !canSend}>
            {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            {targets.length}명에게 보내기
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (step === "done" && result) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {result.failed.length ? `${result.sent.length}명 보냄 · ${result.failed.length}명 실패` : `${result.sent.length}명에게 보냈어요`}
            {result.skipped.length ? ` · ${result.skipped.length}명 건너뜀` : ""}
          </DialogTitle>
          <DialogDescription>학생은 &lsquo;내 학습&rsquo;의 피드백에서 칭찬을 볼 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {result.sent.length ? (
            <p className="inline-flex items-start gap-1.5 text-sm">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-science-strong" aria-hidden />
              {result.sent.map((s) => s.name).join(", ")}
            </p>
          ) : null}
          {result.skipped.length ? (
            <p className="inline-flex items-start gap-1.5 text-sm text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                같은 문구를 이미 받아 다시 보내지 않았어요(중복 방지): {result.skipped.map((s) => s.name).join(", ")}
              </span>
            </p>
          ) : null}
          {result.failed.length ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <p className="text-sm font-medium">보내지 못한 학생</p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {result.failed.map((f) => (
                  <li key={f.studentId} className="break-words">
                    {f.name} <span className="text-xs text-muted-foreground">— {f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          {result.failed.length ? (
            <Button type="button" variant="outline" onClick={() => setStep("confirm")}>
              <RotateCcwIcon />
              실패한 {result.failed.length}명 다시 보내기
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            닫기
          </Button>
        </DialogFooter>
      </>
    );
  }

  // compose
  const allIds = candidates.map((c) => c.studentId);
  const notSentIds = candidates.filter((c) => !alreadySent(c)).map((c) => c.studentId);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PartyPopperIcon className="size-5 text-primary" aria-hidden />
          칭찬 보내기
        </DialogTitle>
        <DialogDescription>{appTitle} · 완료한 학생에게 한 번에 칭찬을 보내요.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2" aria-labelledby="praise-targets">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="praise-targets" className="text-sm font-medium">
              받는 학생 <span className="text-muted-foreground tabular-nums">({targets.length}/{candidates.length})</span>
            </h3>
            <span className="flex flex-wrap gap-1">
              <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(new Set(allIds))}>
                전체
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(new Set(notSentIds))}>
                안 보낸 학생만
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(new Set())}>
                모두 해제
              </Button>
            </span>
          </div>
          {candidates.length ? (
            <ul className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-xl p-1 ring-1 ring-foreground/10 sm:grid-cols-2">
              {candidates.map((c) => {
                const sent = alreadySent(c);
                const checked = selected.has(c.studentId);
                return (
                  <li key={c.studentId}>
                    <label
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60",
                        sent && !checked && "text-muted-foreground",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => toggle(c.studentId)}
                      />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      {c.praiseName == null ? (
                        <Badge variant="outline" className="shrink-0 text-[0.7rem]" title="표시 이름이 없거나 아이디 모양이라 칭찬 문장에 이름을 넣지 않아요">
                          이름 없음
                        </Badge>
                      ) : null}
                      {sent ? (
                        <Badge variant="outline" className="shrink-0 text-[0.7rem]">
                          이미 보냄
                        </Badge>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">아직 이 활동을 완료한 학생이 없어요.</p>
          )}
          {overLimit ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
              한 번에 {PRAISE_MAX_RECIPIENTS}명까지 보낼 수 있어요. 받는 학생을 줄여 주세요.
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setSelected(new Set(candidates.filter((c) => selected.has(c.studentId)).slice(0, PRAISE_MAX_RECIPIENTS).map((c) => c.studentId)))}
              >
                앞 {PRAISE_MAX_RECIPIENTS}명만 남기기
              </Button>
            </p>
          ) : candidates.length > PRAISE_MAX_RECIPIENTS ? (
            <p className="text-xs text-muted-foreground">
              완료한 학생이 {candidates.length}명이라 한 번에 {PRAISE_MAX_RECIPIENTS}명씩 나눠 보내요. 보낸 학생은 &lsquo;이미 보냄&rsquo;으로 표시돼 다음에 &lsquo;안 보낸 학생만&rsquo;을 누르면 나머지가 골라져요.
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="praise-presets">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="praise-presets" className="text-sm font-medium">
              미리 만든 문구
            </h3>
            <Button type="button" variant="ghost" size="xs" onClick={() => setStep("manage")}>
              <PencilIcon />
              문구 편집
            </Button>
          </div>
          {presets.state.status === "loading" ? (
            <p className="text-sm text-muted-foreground">문구를 불러오는 중…</p>
          ) : presets.state.status === "error" ? (
            <p className="text-sm text-destructive">
              문구를 불러오지 못했어요. 직접 입력해서 보낼 수 있어요.{" "}
              <button type="button" className="underline" onClick={presets.reload}>
                다시 시도
              </button>
            </p>
          ) : (
            <>
              {presets.state.data.missing ? <PraiseMissingNotice /> : null}
              <div className="flex flex-wrap gap-2">
                {presets.state.data.presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setText(p.body)}
                    aria-pressed={text === p.body}
                    className={cn(
                      "max-w-full rounded-xl px-3 py-2 text-left text-sm break-words ring-1 ring-foreground/15 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      text === p.body && "bg-primary/10 ring-primary/50",
                    )}
                  >
                    {p.body}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <label htmlFor="praise-text" className="text-sm font-medium">
            보낼 문구 <span className="font-normal text-muted-foreground">(직접 고쳐 써도 돼요 · {PRAISE_NAME_TOKEN} → 학생 이름)</span>
          </label>
          <Textarea
            id="praise-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={PRAISE_BODY_MAX}
            className="min-h-24"
            placeholder={`${PRAISE_NAME_TOKEN} 학생, 오늘 …`}
          />
          <p className={cn("text-xs", problem || tooLongFor ? "text-destructive" : "text-muted-foreground")}>
            {problem ??
              (tooLongFor ? `${tooLongFor.name} 이름을 넣으면 ${FEEDBACK_BODY_MAX}자를 넘어요.` : `${text.length} / ${PRAISE_BODY_MAX}`)}
          </p>
          {text.trim() ? (
            <div className="flex flex-col gap-2">
              {previews.map((pv, i) => (
                <div key={i} className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">미리보기 — {pv.who}</p>
                  <p className="mt-1 text-sm break-words whitespace-pre-wrap">{pv.body}</p>
                </div>
              ))}
              {unnamed.length ? (
                <p className="text-xs text-muted-foreground">
                  이름이 등록되지 않은 학생 {unnamed.length}명({unnamed.map((u) => u.name).join(", ")})은 이름 없이 보내요. 다음 화면에서 학생별 문장을 모두 확인할 수 있어요.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="button" onClick={() => setStep("confirm")} disabled={!canSend}>
          <SendIcon />
          {targets.length}명에게 보내기…
        </Button>
      </DialogFooter>
    </>
  );
}
