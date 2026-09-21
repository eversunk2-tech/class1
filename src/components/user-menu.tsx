"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutListIcon, LogOutIcon, PenSquareIcon, UserPenIcon } from "lucide-react";
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
import { signOut } from "@/lib/auth";

export function UserMenu() {
  const { loading, user, profile, isAdmin } = useSession();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  if (loading) return <Skeleton className="size-8 rounded-full" />;

  if (!user) {
    return (
      <Button variant="outline" size="sm" render={<Link href="/login/" />} nativeButton={false}>
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
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="사용자 메뉴" />
          }
        >
          <Avatar size="sm">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate text-sm text-foreground">{name}</span>
              {isAdmin ? <span className="text-xs">관리자</span> : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <UserPenIcon />
              프로필 수정
            </DropdownMenuItem>
            {isAdmin ? (
              <>
                <DropdownMenuItem onClick={() => router.push("/admin/")}>
                  <LayoutListIcon />
                  글 관리
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/admin/write/")}>
                  <PenSquareIcon />새 글 작성
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              router.replace("/");
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
