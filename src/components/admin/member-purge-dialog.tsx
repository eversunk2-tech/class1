"use client";

import { useRef, useState } from "react";
import { AlertTriangleIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { dangerSolidClass } from "@/components/admin/admin-styles";
import { Input } from "@/components/ui/input";
import {
  AdminActionError,
  MemberGoneError,
  accountLabel,
  isWithdrawnMember,
  memberProviders,
  memberRealName,
  providerLabel,
  purgeOAuthMember,
} from "@/lib/admin";
import type { MemberRow } from "@/lib/types";

type Stage = { kind: "confirm"; error?: string } | { kind: "working" };

/**
 * 구글·깃허브(OAuth) 전용 계정 완전 삭제 확인 다이얼로그(docs/admin/oauth-delete/spec.md 개정 1 — 총괄만).
 * MemberWithdrawDialog(기록 보존 탈퇴)를 본떴다: 되돌릴 수 없으므로 이름을 그대로 다시 입력해야 실행 버튼이 켜진다.
 * 읽는 사람은 교사라 무엇이 지워지는지 정확히 적는다.
 * - 성공(또는 이미 없는 회원): onPurged(대상 id) — 목록에서 빼고 새로 불러오거나, 상세 화면이면 목록으로 돌아간다.
 * - 경고(계정은 지웠지만 기록 정리가 남음): onPartial(대상 id) — 새로 불러온다. 같은 메뉴를 한 번 더 누르면 남은 것만 지운다.
 */
export function MemberPurgeDialog({
  target,
  open,
  onOpenChange,
  onPurged,
  onPartial,
}: {
  target: MemberRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurged?: (userId: string) => void;
  onPartial?: (userId: string) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "confirm" });
  const [typed, setTyped] = useState("");
  // 열릴 때마다 처음부터 시작한다(렌더 중 상태 보정 — 이전 값과 비교).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStage({ kind: "confirm" });
      setTyped("");
    }
  }

  // 확인 입력은 가려진 "탈퇴한 학생"이 아니라 실제 이름과 비교한다(관리자 화면 전용).
  const name = target ? memberRealName(target) : "";
  const matches = typed.trim() === name && name.length > 0;
  const providers = target ? memberProviders(target).map(providerLabel).join("·") : "";
  const withdrawn = target ? isWithdrawnMember(target) : false;
  const working = useRef(false);

  async function onConfirm() {
    if (!target || !matches || working.current) return; // 연타로 두 번 호출하지 않게
    working.current = true;
    setStage({ kind: "working" });
    try {
      const { warning } = await purgeOAuthMember(target.id);
      onOpenChange(false);
      if (warning) {
        onPartial?.(target.id);
        toast.warning(warning, { duration: 15000 });
      } else {
        onPurged?.(target.id);
        toast.success(`${name} 계정을 완전히 삭제했습니다.`);
      }
    } catch (e) {
      if (e instanceof MemberGoneError) {
        // 이미 지워진 회원 — 같은 결과이므로 목록에서 뺀다.
        onOpenChange(false);
        onPurged?.(target.id);
        toast.info("이미 지워진 계정입니다. 목록을 새로 불러왔어요.");
        return;
      }
      setStage({
        kind: "confirm",
        error: e instanceof AdminActionError ? e.message : "완전 삭제를 하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      working.current = false;
    }
  }

  const busy = stage.kind === "working";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return; // 처리 중에는 바깥 클릭/Esc로 닫지 않는다.
        onOpenChange(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setStage({ kind: "confirm" });
          setTyped("");
        }
      }}
    >
      {/* 문구가 길어 작은 화면(화면 키보드 포함)에서는 창 안에서 스크롤한다 */}
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{name} 계정을 완전히 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {name}({target ? accountLabel(target.email) : ""}) — {providers || "구글·깃허브"}로 가입한 계정입니다.{" "}
            {withdrawn
              ? "이미 탈퇴 처리되어 로그인할 수 없는 계정이며, 남아 있는 기록까지 모두 지웁니다."
              : "로그인 계정과 함께 이 계정의 기록을 모두 지웁니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="note">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            이 계정과 함께 학습 기록, 댓글·좋아요, 자유게시판·학습게임에 쓴 글과 올린 게임 파일, 관리 기록이 모두 지워집니다.
            그 글에 달린 다른 사람의 댓글도 함께 사라집니다. <strong>되돌릴 수 없습니다.</strong>
          </span>
        </p>

        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>같은 구글·깃허브 계정으로 다시 로그인하면 새 계정으로 시작합니다.</li>
          <li>
            교사였던 계정이면 학생에게 보낸 피드백·칭찬도 함께 지워지고, 쓴 선생님 글·과제·블로그 글은 쓴 사람 표시 없이 남습니다.
          </li>
        </ul>

        <label className="flex flex-col gap-1.5 text-sm">
          <span>
            계속하려면 이름 <strong className="font-mono">{name}</strong> 을(를) 그대로 입력하세요.
          </span>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            autoComplete="off"
            aria-label="확인을 위해 이름 입력"
            placeholder={name}
          />
        </label>

        {stage.kind === "confirm" && stage.error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            {stage.error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          {/* 되돌릴 수 없는 동작이라 마지막 확인 버튼은 진한 빨강(이름을 맞게 입력하기 전에는 흐리게 꺼져 있다) */}
          <AlertDialogAction variant="destructive" className={dangerSolidClass} disabled={busy || !matches} onClick={onConfirm}>
            {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            {stage.kind === "confirm" && stage.error ? "다시 시도" : "완전 삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
