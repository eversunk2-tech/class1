import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { memberName, memberProviders, providerLabel } from "@/lib/admin";
import type { MemberRow } from "@/lib/types";

/** 회원 아바타(이미지가 없으면 이름 첫 글자) */
export function MemberAvatar({ member, size = "default" }: { member: MemberRow; size?: "default" | "sm" | "lg" }) {
  const name = memberName(member);
  return (
    <Avatar size={size}>
      {member.profiles?.avatar_url ? <AvatarImage src={member.profiles.avatar_url} alt="" /> : null}
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
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

/** 역할 배지 + 비밀번호 변경 대기 표시 */
export function RoleBadge({ member }: { member: MemberRow }) {
  const isAdmin = member.profiles?.role === "admin";
  return (
    <span className="flex flex-wrap gap-1">
      {isAdmin ? (
        <Badge>
          <ShieldCheckIcon aria-hidden />
          관리자
        </Badge>
      ) : (
        <Badge variant="outline">학생</Badge>
      )}
      {member.profiles?.must_change_password ? (
        <Badge variant="destructive" title="임시 비밀번호로 초기화됨 — 다음 로그인 때 새 비밀번호를 설정해야 합니다">
          <KeyRoundIcon aria-hidden />
          변경 대기
        </Badge>
      ) : null}
    </span>
  );
}
