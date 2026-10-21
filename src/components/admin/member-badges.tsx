import { ClockIcon, FileCheck2Icon, FileQuestionIcon, KeyRoundIcon, ShieldCheckIcon, ShieldHalfIcon, UserMinusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PRIVACY_ADMIN_TEXT as T, fillText, splitBold } from "@/data/privacy-admin-text";
import { isWithdrawnMember, memberName, memberProviders, providerLabel } from "@/lib/admin";
import {
  consentTexts,
  PENDING_OVERDUE_DAYS,
  signedUpDaysOf,
  type GuardianConsent,
  type MemberPrivacyFlag,
} from "@/lib/admin-privacy";
import type { MemberRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 회원 아바타(이미지가 없으면 이름 첫 글자). 탈퇴한 회원은 원래 사진을 쓰지 않는다. */
export function MemberAvatar({ member, size = "default" }: { member: MemberRow; size?: "default" | "sm" | "lg" }) {
  const name = memberName(member);
  const withdrawn = isWithdrawnMember(member);
  return (
    <Avatar size={size}>
      {member.profiles?.avatar_url && !withdrawn ? <AvatarImage src={member.profiles.avatar_url} alt="" /> : null}
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

/** 탈퇴 처리된 회원 표시 */
export function WithdrawnBadge() {
  return (
    <Badge variant="outline" title="계정이 삭제되어 로그인할 수 없습니다. 학습 기록은 그대로 남아 있습니다.">
      <UserMinusIcon aria-hidden />
      탈퇴함
    </Badge>
  );
}

/** 가입 방식 배지(연결된 방식 모두) */
export function ProviderBadges({ member }: { member: MemberRow }) {
  const providers = memberProviders(member);
  if (!providers.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {providers.map((p) => (
        <Badge key={p} variant={p === "email" ? "secondary" : "outline"}>
          {providerLabel(p)}
        </Badge>
      ))}
    </span>
  );
}

/**
 * `**굵게**`·`{자리}`가 든 원문 글(src/data/privacy-admin-text.ts)을 그린다.
 * 굵은 조각은 <strong>, 자리는 values로 채운다.
 */
export function RichText({ text, values }: { text: string; values?: Record<string, string | number> }) {
  const filled = values ? fillText(text, values) : text;
  return (
    <>
      {splitBold(filled).map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** '인증 전'(노란 표) 배지의 설명 글: 원문 8-3 + "{새 가입 / 이전 가입} · 가입한 지 {n}일" */
export function pendingHintOf(flag: MemberPrivacyFlag | undefined, signedUpAt: string | null | undefined): string {
  const days = signedUpDaysOf(flag, signedUpAt);
  const origin = flag?.origin === "existing" ? T.googleTeacher.originExisting : flag?.origin === "new" ? T.googleTeacher.originNew : null;
  const meta =
    origin && days != null
      ? fillText(T.googleTeacher.pendingMeta, { "가입 종류": origin, n: days })
      : days != null
        ? `가입한 지 ${days}일`
        : origin ?? "";
  return meta ? `${T.googleTeacher.pendingHint} ${meta}` : T.googleTeacher.pendingHint;
}

/** 인증 전 구글 계정인가(총괄 화면 — admin_member_privacy_flags) */
export function isPendingMember(member: MemberRow, flag: MemberPrivacyFlag | undefined): boolean {
  return !!flag?.pending && member.profiles?.role !== "admin" && !isWithdrawnMember(member);
}

/** 인증 전 계정이 가입한 지 30일이 넘었는가(붉은 표) */
export function isPendingOverdue(member: MemberRow, flag: MemberPrivacyFlag | undefined): boolean {
  if (!isPendingMember(member, flag)) return false;
  const days = signedUpDaysOf(flag, member.signed_up_at);
  return days != null && days > PENDING_OVERDUE_DAYS;
}

/**
 * 역할 배지 + 비밀번호 변경 대기 + 탈퇴 표시.
 * flag(총괄만 — 개인정보 SQL 뒤)가 있으면 구글 계정 표시를 더한다(privacy-policy.md 8-3):
 * '인증 전'(노란 표)·'30일 넘음'(붉은 표)·'교사 · 내 학급 일만'·'교사'(모든 권한).
 */
export function RoleBadge({ member, flag }: { member: MemberRow; flag?: MemberPrivacyFlag }) {
  const isAdmin = member.profiles?.role === "admin";
  const pending = isPendingMember(member, flag);
  const overdue = isPendingOverdue(member, flag);
  return (
    <span className="flex flex-wrap gap-1">
      {isWithdrawnMember(member) ? <WithdrawnBadge /> : null}
      {isAdmin ? (
        flag?.teacherScope === "class" ? (
          <Badge variant="secondary" title={T.googleTeacher.classTeacherHint}>
            <ShieldHalfIcon aria-hidden />
            {T.googleTeacher.classTeacher}
          </Badge>
        ) : (
          <Badge title={flag ? T.googleTeacher.fullTeacherHint : "교사(관리자) 계정 — 관리자 대시보드를 쓸 수 있어요"}>
            <ShieldCheckIcon aria-hidden />
            {T.googleTeacher.fullTeacher}
          </Badge>
        )
      ) : pending ? (
        <Badge
          title={pendingHintOf(flag, member.signed_up_at)}
          className="border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100"
        >
          <ClockIcon aria-hidden />
          {T.googleTeacher.pending}
        </Badge>
      ) : (
        <Badge variant="outline">학생</Badge>
      )}
      {overdue ? (
        <Badge variant="destructive" title={T.googleTeacher.over30Hint}>
          {T.googleTeacher.over30}
        </Badge>
      ) : null}
      {member.profiles?.must_change_password ? (
        <Badge variant="destructive" title="임시 비밀번호로 초기화됨 — 다음 로그인 때 새 비밀번호를 설정해야 합니다">
          <KeyRoundIcon aria-hidden />
          변경 대기
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * 보호자 동의 열(8-2, 학생 행): "동의서 확인 {날짜}" / "기록 없음". 설명은 마우스를 올리면(title) 보이고,
 * withHint면 아래에 글로도 보인다(회원 상세 — 터치 화면에서도 읽을 수 있게).
 */
export function GuardianConsentStatus({
  consent,
  withHint = false,
  compact = false,
  canRecord = true,
  className,
}: {
  consent: GuardianConsent | null;
  withHint?: boolean;
  /**
   * 보는 사람에게 [동의서 받음으로 기록]이 있는가(그 학생의 담임만). 없으면 '기록 없음' 설명에서
   * 단추를 누르라는 둘째 문장을 빼고 원문 첫 문장만 보인다(총괄이 다른 학급 줄을 볼 때).
   */
  canRecord?: boolean;
  /** 카드 목록처럼 작은 글자 줄에 넣을 때 */
  compact?: boolean;
  className?: string;
}) {
  const noneHint = canRecord ? T.consentColumn.noneHint : firstSentence(T.consentColumn.noneHint);
  const texts = consent ? consentTexts(consent) : { label: T.consentColumn.none, hint: noneHint };
  // "동의서 확인 {날짜}"는 칸이 좁으면 날짜 앞에서만 줄을 바꾼다(보이는 글자는 그대로 — 회원 표가 상자 안에 들어오게).
  const [labelHead, labelDate] = consent ? splitConsentLabel(texts.label) : [texts.label, ""];
  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <span
        title={texts.hint}
        className={cn(
          "inline-flex w-fit items-start gap-1",
          compact ? "text-xs" : "text-sm",
          consent ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {consent ? (
          <FileCheck2Icon className={cn("mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400", compact ? "size-3.5" : "size-4")} aria-hidden />
        ) : (
          <FileQuestionIcon className={cn("mt-0.5 shrink-0", compact ? "size-3.5" : "size-4")} aria-hidden />
        )}
        <span>
          <span className="whitespace-nowrap">{labelHead}</span>
          {labelDate ? (
            <>
              {" "}
              <span className="whitespace-nowrap">{labelDate}</span>
            </>
          ) : null}
        </span>
        {withHint ? null : <span className="sr-only">. {texts.hint}</span>}
      </span>
      {withHint ? <span className="text-xs text-muted-foreground">{texts.hint}</span> : null}
    </span>
  );
}

/** 원문 문단의 첫 문장("…않았어요.")만 — 새 글을 만들지 않고 원문을 자른다 */
function firstSentence(text: string): string {
  const end = text.indexOf(". ");
  return end < 0 ? text : text.slice(0, end + 1);
}

/** "동의서 확인 2026. 10. 20." → ["동의서 확인", "2026. 10. 20."] (원문 틀의 {날짜} 앞에서 나눈다) */
function splitConsentLabel(label: string): [string, string] {
  const head = T.consentColumn.done.split("{날짜}")[0].trim();
  return label.startsWith(head) ? [head, label.slice(head.length).trim()] : [label, ""];
}
