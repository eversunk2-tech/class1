"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCapIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PenSquareIcon,
  SproutIcon,
  UserPenIcon,
  UsersIcon,
} from "lucide-react";
import { UnreadCount } from "@/components/learning/learning-ui";
import { ProfileDialog } from "@/components/profile-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { displayNameOf, useSession } from "@/hooks/use-session";
import { useUnreadFeedback } from "@/hooks/use-unread-feedback";
import { userHasPasswordLogin } from "@/lib/admin";
import { signOut } from "@/lib/auth";

export function UserMenu() {
  const { loading, user, profile, isAdmin } = useSession();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  // 학생: 선생님이 보낸 안 읽은 메시지 / 관리자: 학생이 보낸 안 읽은 메시지
  const unread = useUnreadFeedback();

  if (loading) return <Skeleton className="size-8 rounded-full sm:size-9" />;

  if (!user) {
    // 머리말의 알약 모양 흰 버튼(spec §4.2). 휴대폰에서는 사이트 이름이 잘리지 않게 예전 크기 유지.
    return (
      <Button
        variant="outline"
        size="sm"
        className="rounded-full shadow-(--shadow-sm) sm:ml-1 sm:h-9 sm:px-4 sm:text-sm dark:shadow-none"
        render={<Link href="/login/" />}
        nativeButton={false}
      >
        로그인
      </Button>
    );
  }

  const name = displayNameOf(profile, user);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full sm:size-9"
              aria-label={unread > 0 ? `사용자 메뉴 (안 읽은 피드백 ${unread}개)` : "사용자 메뉴"}
            />
          }
        >
          <Avatar size="sm">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          {unread > 0 ? (
            <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" aria-hidden />
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate text-sm text-foreground">{name}</span>
              {isAdmin ? <span className="text-xs">관리자</span> : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push("/me/learning/")}>
              <SproutIcon />
              내 학습 활동
              {!isAdmin ? <UnreadCount count={unread} className="ml-auto" /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <UserPenIcon />
              프로필 수정
            </DropdownMenuItem>
            {userHasPasswordLogin(user) ? (
              <DropdownMenuItem onClick={() => router.push("/reset-password/")}>
                <KeyRoundIcon />
                비밀번호 변경
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/admin/")}>
                  <LayoutDashboardIcon />
                  관리자 대시보드
                </DropdownMenuItem>
                {/* 블로그 '글 관리'·'새 글 작성' 대신 학급별 '선생님 글'(docs/classes/spec.md 개정 2) */}
                <DropdownMenuItem onClick={() => router.push("/admin/notices/")}>
                  <PenSquareIcon />
                  선생님 글
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/admin/members/")}>
                  <UsersIcon />
                  회원 관리
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/admin/learning/")}>
                  <GraduationCapIcon />
                  학습 현황
                  <UnreadCount count={unread} className="ml-auto" />
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              const { cancelled } = await signOut();
              if (!cancelled) router.replace("/");
            }}
          >
            <LogOutIcon />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
