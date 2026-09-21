"use client";

import { useState, type FormEvent } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayNameOf, useSession } from "@/hooks/use-session";
import { LOGIN_EMAIL_DOMAIN } from "@/lib/auth";
import { isHttpUrl } from "@/lib/slug";
import { supabase } from "@/lib/supabase";

/** profiles.display_name 제약(마이그레이션 check)과 같은 값 */
const MAX_NAME_LENGTH = 50;

/** 헤더 유저 메뉴에서 여는 프로필 수정 다이얼로그 (display_name, avatar_url) */
export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* 팝업은 닫히면 언마운트되므로, 열릴 때마다 현재 프로필 값으로 폼이 새로 만들어진다. */}
        <ProfileForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({ onDone }: { onDone: () => void }) {
  const { user, profile, refreshProfile } = useSession();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [errors, setErrors] = useState<{ name?: string; avatar?: string }>({});
  const [saving, setSaving] = useState(false);

  const trimmedAvatar = avatarUrl.trim();
  const previewName = name.trim() || displayNameOf(null, user);
  // 사전 발급 계정은 {아이디}@class1.local 이므로 아이디만 보여준다.
  const email = user?.email ?? "";
  const accountLabel = email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`) ? `아이디: ${email.split("@")[0]}` : email;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const displayName = name.trim();
    const next: typeof errors = {};
    if (!displayName) next.name = "이름을 입력하세요.";
    else if (displayName.length > MAX_NAME_LENGTH) next.name = `이름은 ${MAX_NAME_LENGTH}자 이하로 입력하세요.`;
    if (trimmedAvatar && !isHttpUrl(trimmedAvatar)) next.avatar = "http:// 또는 https://로 시작하는 이미지 주소를 입력하세요.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, avatar_url: trimmedAvatar || null })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      setSaving(false);
      toast.error("프로필을 저장하지 못했습니다.");
      return;
    }
    await refreshProfile();
    setSaving(false);
    toast.success("프로필을 저장했습니다.");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>프로필 수정</DialogTitle>
        <DialogDescription>댓글과 메뉴에 표시되는 이름과 사진입니다.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {trimmedAvatar && isHttpUrl(trimmedAvatar) ? <AvatarImage src={trimmedAvatar} alt="" /> : null}
          <AvatarFallback>{previewName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 truncate text-sm text-muted-foreground">{accountLabel}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="profile-name">이름</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          aria-invalid={Boolean(errors.name)}
          className="h-9"
        />
        {errors.name ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="profile-avatar">프로필 사진 URL (선택)</Label>
        <Input
          id="profile-avatar"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
          aria-invalid={Boolean(errors.avatar)}
          className="h-9"
        />
        {errors.avatar ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.avatar}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">비워 두면 이름의 첫 글자가 표시됩니다.</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : null}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
