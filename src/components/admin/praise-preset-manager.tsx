"use client";

import { useCallback, useState } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/learning/confirm-dialog";
import { AsyncView } from "@/components/learning/learning-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncData } from "@/hooks/use-async-data";
import {
  createPraisePreset,
  deletePraisePreset,
  fetchPraisePresets,
  PRAISE_BODY_MAX,
  PRAISE_MISSING_MESSAGE,
  PRAISE_NAME_TOKEN,
  praiseBodyProblem,
  updatePraisePreset,
  type PraisePreset,
} from "@/lib/praise";

/** SQL 실행 전 안내(문구 편집 불가, 기본 문구로 보내기는 가능) */
export function PraiseMissingNotice() {
  return (
    <p role="status" className="rounded-lg border border-math-strong/30 bg-math-strong/5 px-3 py-2 text-xs leading-5">
      <span className="font-medium">SQL 실행 필요 · </span>
      {PRAISE_MISSING_MESSAGE}
    </p>
  );
}

function PresetEditor({
  initial,
  busy,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial: string;
  busy: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [body, setBody] = useState(initial);
  const problem = body.trim() ? praiseBodyProblem(body) : null;
  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor="praise-preset-editor">
        칭찬 문구
      </label>
      <Textarea
        id="praise-preset-editor"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={PRAISE_BODY_MAX}
        disabled={busy}
        autoFocus
        className="min-h-20"
        placeholder={`${PRAISE_NAME_TOKEN} 학생, …`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {problem ?? `${body.length} / ${PRAISE_BODY_MAX} · ${PRAISE_NAME_TOKEN}은 보낼 때 학생 이름으로 바뀌어요.`}
        </span>
        <span className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button type="button" size="sm" onClick={() => onSave(body)} disabled={busy || !!praiseBodyProblem(body)}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            {saveLabel}
          </Button>
        </span>
      </div>
    </div>
  );
}

/**
 * 칭찬 문구 추가 · 수정 · 삭제(관리자). praise_presets 테이블이 없으면 기본 문구를 읽기 전용으로 보여 준다.
 * onChanged: 목록이 바뀔 때마다(다른 화면의 문구 버튼 갱신용)
 */
export function PraisePresetManager({ onChanged }: { onChanged?: (presets: PraisePreset[]) => void }) {
  const load = useCallback(() => fetchPraisePresets(), []);
  const { state, reload, setData } = useAsyncData(load);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<PraisePreset | null>(null);

  function apply(next: PraisePreset[]) {
    const sorted = [...next].sort((a, b) => a.sort_order - b.sort_order);
    setData((d) => ({ ...d, presets: sorted }));
    onChanged?.(sorted);
  }

  async function save(body: string, current: PraisePreset[], target: PraisePreset | null) {
    if (busy) return;
    setBusy(true);
    try {
      if (target) {
        const updated = await updatePraisePreset(target.id, { body });
        apply(current.map((p) => (p.id === updated.id ? updated : p)));
        toast.success("문구를 고쳤어요.");
      } else {
        const nextOrder = current.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1;
        const created = await createPraisePreset(body, nextOrder);
        apply([...current, created]);
        toast.success("문구를 추가했어요.");
      }
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(current: PraisePreset[]) {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deletePraisePreset(deleting.id);
      apply(current.filter((p) => p.id !== deleting.id));
      toast.success("문구를 지웠어요.");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "지우지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AsyncView state={state} onRetry={reload} errorText="칭찬 문구를 불러오지 못했습니다.">
      {({ presets, missing }) => (
        <div className="flex flex-col gap-3">
          {missing ? <PraiseMissingNotice /> : null}
          {presets.length ? (
            <ol className="flex flex-col gap-2" aria-label="칭찬 문구 목록">
              {presets.map((p, i) => (
                <li key={p.id} className="flex flex-col gap-2 rounded-xl px-3 py-2.5 ring-1 ring-foreground/10">
                  {editing === p.id ? (
                    <PresetEditor
                      initial={p.body}
                      busy={busy}
                      saveLabel="저장"
                      onCancel={() => setEditing(null)}
                      onSave={(body) => void save(body, presets, p)}
                    />
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                      <p className="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">{p.body}</p>
                      {!missing ? (
                        <span className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing(p.id)}
                            disabled={busy || editing != null}
                            aria-label={`${i + 1}번 문구 고치기`}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(p)}
                            disabled={busy || editing != null}
                            aria-label={`${i + 1}번 문구 지우기`}
                          >
                            <Trash2Icon />
                          </Button>
                        </span>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              저장된 칭찬 문구가 없어요. 아래에서 추가해 보세요.
            </p>
          )}
          {!missing ? (
            editing === "new" ? (
              <div className="rounded-xl px-3 py-2.5 ring-1 ring-primary/40">
                <PresetEditor
                  initial={`${PRAISE_NAME_TOKEN} 학생, `}
                  busy={busy}
                  saveLabel="추가"
                  onCancel={() => setEditing(null)}
                  onSave={(body) => void save(body, presets, null)}
                />
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setEditing("new")} disabled={busy || editing != null}>
                <PlusIcon />
                문구 추가
              </Button>
            )
          ) : null}
          <ConfirmDialog
            open={deleting != null}
            onOpenChange={(o) => {
              if (!o) setDeleting(null);
            }}
            title="이 문구를 지울까요?"
            description={deleting ? `“${deleting.body}” — 이미 보낸 칭찬 메시지는 지워지지 않아요.` : ""}
            confirmLabel="지우기"
            destructive
            busy={busy}
            onConfirm={() => void remove(presets)}
          />
        </div>
      )}
    </AsyncView>
  );
}

/** 칭찬 문구 관리 버튼 + 다이얼로그 */
export function PraisePresetManagerButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <PencilIcon />
        칭찬 문구 관리
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>칭찬 문구 관리</DialogTitle>
            <DialogDescription>
              일괄 칭찬에서 누르기만 하면 되는 문구예요. {PRAISE_NAME_TOKEN}은 보낼 때 학생 이름으로 바뀌어요.
            </DialogDescription>
          </DialogHeader>
          {open ? <PraisePresetManager /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
