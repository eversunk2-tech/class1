"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, KeyRoundIcon, Loader2Icon, ShieldCheckIcon, ShieldOffIcon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import { MemberAvatar, ProviderBadges, RoleBadge } from "@/components/admin/member-badges";
import { MemberWithdrawDialog } from "@/components/admin/member-withdraw-dialog";
import { PasswordResetDialog } from "@/components/admin/password-reset-dialog";
import { EmptyState, ErrorState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import {
  AdminActionError,
  accountLabel,
  canResetPassword,
  fetchLatestWithdrawal,
  fetchMember,
  isWithdrawnMember,
  memberRealName,
  passwordResetBlockReason,
  isMissingSchemaError,
  memberName,
  MISSING_SCHEMA_MESSAGE,
  setMemberRole,
  UUID_RE,
  withdrawBlockReason,
} from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import type { MemberRow, Role } from "@/lib/types";
import { MemberLearning } from "./member-learning";

type State =
  | { status: "loading" }
  | { status: "error"; missing: boolean }
  | { status: "not-found" }
  | { status: "ready"; member: MemberRow };

function BackLink() {
  return (
    <Button variant="ghost" size="sm" className="self-start" render={<Link href="/admin/members/" />} nativeButton={false}>
      <ArrowLeftIcon />
      회원 목록
    </Button>
  );
}

/**
 * 회원 상세(/admin/members/?id=): 프로필 요약 · 비밀번호 초기화 · 관리자 지정/해제 +
 * 학습활동 탭(웹앱 결과/읽은 글/댓글·좋아요/과제 제출/피드백 대화, docs/admin/spec.md §3.5).
 */
export function MemberDetail({ id }: { id: string }) {
  const { user } = useSession();
  const validId = UUID_RE.test(id);
  const [state, setState] = useState<State>(validId ? { status: "loading" } : { status: "not-found" });
  const [resetOpen, setResetOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawInfo, setWithdrawInfo] = useState<{ created_at: string; actor_name: string | null } | null>(null);

  const load = useCallback(async (): Promise<State> => {
    try {
      const member = await fetchMember(id);
      return member ? { status: "ready", member } : { status: "not-found" };
    } catch (e) {
      return { status: "error", missing: isMissingSchemaError(e) };
    }
  }, [id]);

  useEffect(() => {
    if (!validId) return;
    let active = true;
    load().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [load, validId]);

  async function reload() {
    setState({ status: "loading" });
    setState(await load());
  }

  // 탈퇴한 회원이면 "언제·누가" 처리했는지 감사 로그에서 최근 1건을 읽는다(표가 없으면 조용히 건너뛴다).
  const withdrawn = state.status === "ready" && isWithdrawnMember(state.member);
  useEffect(() => {
    if (!withdrawn) return;
    let active = true;
    fetchLatestWithdrawal(id).then(
      (info) => {
        if (active) setWithdrawInfo(info);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [withdrawn, id]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="회원 정보를 불러오는 중">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorState message={state.missing ? MISSING_SCHEMA_MESSAGE : "회원 정보를 불러오지 못했습니다."} onRetry={reload} />
      </div>
    );
  }
  if (state.status === "not-found") {
    return (
      <EmptyState
        className="my-6"
        title="회원을 찾을 수 없습니다"
        description="주소가 잘못되었거나 탈퇴한 회원일 수 있습니다."
        action={
          <Button variant="outline" render={<Link href="/admin/members/" />} nativeButton={false}>
            회원 목록으로
          </Button>
        }
      />
    );
  }

  const member = state.member;
  const name = memberName(member);
  // 관리자 화면에서는 기록의 주인을 알아볼 수 있게 탈퇴 전 이름도 함께 보여 준다.
  const realName = memberRealName(member);
  const isWithdrawn = isWithdrawnMember(member);
  const isAdmin = member.profiles?.role === "admin";
  const isSelf = user?.id === member.id;
  const nextRole: Role = isAdmin ? "user" : "admin";
  const resetBlock = passwordResetBlockReason(member, user?.id);
  const withdrawBlock = withdrawBlockReason(member, user?.id);

  function patchMember(patch: (m: MemberRow) => MemberRow) {
    setState((s) => (s.status === "ready" ? { ...s, member: patch(s.member) } : s));
  }

  async function onChangeRole() {
    setRoleBusy(true);
    try {
      await setMemberRole(member.id, nextRole);
      patchMember((m) => (m.profiles ? { ...m, profiles: { ...m.profiles, role: nextRole } } : m));
      setRoleOpen(false);
      toast.success(nextRole === "admin" ? `${name}님을 관리자로 지정했습니다.` : `${name}님의 관리자 권한을 해제했습니다.`);
    } catch (e) {
      toast.error(e instanceof AdminActionError ? e.message : "역할을 바꾸지 못했습니다.");
    } finally {
      setRoleBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <section
        aria-labelledby="member-name"
        className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/10 sm:p-6 dark:shadow-none"
      >
        <div className="flex flex-wrap items-center gap-4">
          <MemberAvatar member={member} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 id="member-name" className="truncate font-heading text-2xl leading-tight font-normal sm:text-3xl">
              {name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {accountLabel(member.email)}
              {isWithdrawn ? ` · 탈퇴 전 이름: ${realName}` : ""}
            </p>
          </div>
          <RoleBadge member={member} />
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="아이디/이메일">{member.email || "—"}</Field>
          <Field label="가입 방식">
            <ProviderBadges member={member} />
          </Field>
          <Field label="가입일">{formatDateTime(member.signed_up_at)}</Field>
          <Field label="마지막 로그인">
            {member.last_sign_in_at ? formatDateTime(member.last_sign_in_at) : "로그인 기록 없음"}
          </Field>
          <Field label="역할">{isAdmin ? "관리자" : "학생(일반 회원)"}</Field>
          <Field label="비밀번호">
            {isWithdrawn
              ? "없음(계정 삭제됨)"
              : member.profiles?.must_change_password
                ? "임시 비밀번호 발급됨 — 다음 로그인 때 변경 필요"
                : canResetPassword(member)
                  ? "설정됨"
                  : "없음(OAuth 전용 계정)"}
          </Field>
          {isWithdrawn ? (
            <Field label="탈퇴 처리">
              {member.profiles?.withdrawn_at ? formatDateTime(member.profiles.withdrawn_at) : "처리됨"}
              {withdrawInfo?.actor_name ? ` · ${withdrawInfo.actor_name}` : ""}
            </Field>
          ) : null}
        </dl>

        {isWithdrawn ? (
          <p className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground" role="note">
            이 학생의 계정은 삭제되어 더 이상 로그인할 수 없습니다. 아래 학습 기록과 게시글은 그대로 남아 있으며,
            학생·다른 사람에게는 이름이 “탈퇴한 학생”으로 보입니다. 되돌릴 수 없습니다.
          </p>
        ) : null}

        <div className="flex flex-wrap items-start gap-2 border-t pt-4">
          {resetBlock ? (
            <div className="flex flex-col gap-1">
              <Button variant="outline" disabled title={resetBlock.long} className="self-start">
                <KeyRoundIcon />
                비밀번호 초기화 불가({resetBlock.short})
              </Button>
              <p className="max-w-md text-xs text-muted-foreground">{resetBlock.long}</p>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <KeyRoundIcon />
              비밀번호 초기화
            </Button>
          )}
          {isAdmin && isSelf ? (
            <Button variant="outline" disabled title="자기 자신의 관리자 권한은 해제할 수 없습니다.">
              <ShieldOffIcon />
              관리자 해제(본인 불가)
            </Button>
          ) : (
            <Button
              variant={isAdmin ? "destructive" : "outline"}
              disabled={isWithdrawn}
              title={isWithdrawn ? "탈퇴한 학생의 역할은 바꿀 수 없습니다." : undefined}
              onClick={() => setRoleOpen(true)}
            >
              {isAdmin ? <ShieldOffIcon /> : <ShieldCheckIcon />}
              {isAdmin ? "관리자 해제" : "관리자로 지정"}
            </Button>
          )}
          {withdrawBlock ? (
            <div className="flex flex-col gap-1">
              <Button variant="outline" disabled title={withdrawBlock.long} className="self-start">
                <UserMinusIcon />
                탈퇴 처리 불가({withdrawBlock.short})
              </Button>
              <p className="max-w-md text-xs text-muted-foreground">{withdrawBlock.long}</p>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setWithdrawOpen(true)}>
              <UserMinusIcon />
              탈퇴 처리
            </Button>
          )}
        </div>
      </section>

      {/* 학습활동 영역: 웹앱 결과 / 읽은 글 / 댓글·좋아요 / 과제 제출 / 피드백 대화 (탈퇴해도 그대로 남는다) */}
      <MemberLearning memberId={member.id} memberName={name} memberWithdrawn={isWithdrawn} />

      <PasswordResetDialog
        target={member}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onReset={() =>
          patchMember((m) => (m.profiles ? { ...m, profiles: { ...m.profiles, must_change_password: true } } : m))
        }
      />

      <MemberWithdrawDialog
        target={member}
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        onWithdrawn={(_id, withdrawnAt) =>
          patchMember((m) => (m.profiles ? { ...m, profiles: { ...m.profiles, withdrawn_at: withdrawnAt } } : m))
        }
      />

      <AlertDialog
        open={roleOpen}
        onOpenChange={(open) => {
          if (!roleBusy) setRoleOpen(open);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{isAdmin ? "관리자 권한을 해제할까요?" : "관리자로 지정할까요?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin
                ? `${name}님은 더 이상 글 관리·회원 관리 화면을 쓸 수 없게 됩니다.`
                : `${name}님이 글 작성·삭제, 회원 비밀번호 초기화 등 모든 관리자 기능을 쓸 수 있게 됩니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={roleBusy}>취소</AlertDialogCancel>
            <AlertDialogAction variant={isAdmin ? "destructive" : "default"} disabled={roleBusy} onClick={onChangeRole}>
              {roleBusy ? <Loader2Icon className="animate-spin" /> : null}
              {isAdmin ? "해제" : "지정"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  );
}
