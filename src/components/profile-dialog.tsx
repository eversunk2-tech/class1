"use client";

import { useId, useState, type FormEvent } from "react";
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
import { NEW_SIGNUP_WINDOW } from "@/data/privacy-policy";
import { displayNameOf, useSession } from "@/hooks/use-session";
import { LOGIN_EMAIL_DOMAIN } from "@/lib/auth";
import { PRIVACY_EXTRA_TEXT, validateNickname } from "@/lib/privacy";
import { supabase } from "@/lib/supabase";

/**
 * 헤더 유저 메뉴에서 여는 프로필 수정 다이얼로그 — **별명만**(2026-10-20 사용자 결정, docs/privacy/fix-1-ui-instructions.md).
 * - 사진 주소 칸은 없다: 사이트는 프로필 사진 주소를 받지 않는다(처리방침 개정 4 보충, SQL ② 뒤 avatar_url 수정 권한도 없음 —
 *   보내면 42501이므로 저장할 때 display_name만 보낸다). 예전에 저장된 사진은 표시만 그대로.
 * - 별명 검사는 구글 선생님 확인 창과 같은 규칙·같은 원문 문장(privacy-policy.md 4절 — src/lib/privacy.ts validateNickname)을
 *   모든 회원에게 쓴다.
 */
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

/** 별명 칸 이름과 도움말(원문 1·2·3-1절 "**별명** (2~20자, 실명 대신 별명)") */
const NICKNAME_FIELD = NEW_SIGNUP_WINDOW.nickname;

function ProfileForm({ onDone }: { onDone: () => void }) {
  const { user, profile, refreshProfile } = useSession();
  const ids = useId();
  const nameId = `${ids}-name`;
  const errId = `${ids}-name-err`;
  const [name, setName] = useState(profile?.display_name ?? "");
  // 저장을 한 번 누른 뒤부터 칸을 고칠 때마다 다시 검사해 보인다
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const problem = validateNickname(name);
  const showProblem = tried && !!problem;
  const avatarUrl = profile?.avatar_url ?? null;
  const previewName = name.trim() || displayNameOf(null, user);
  // 사전 발급 계정은 {아이디}@class1.local 이므로 아이디만 보여준다.
  // 구글 계정은 이메일을 화면에 쓰지 않는다(docs/privacy/spec.md 4.4 — 공용 PC 화면에 보이지 않게).
  const email = user?.email ?? "";
  const isGoogle =
    user?.app_metadata?.provider === "google" ||
    (Array.isArray(user?.app_metadata?.providers) && user.app_metadata.providers.includes("google")) ||
    (user?.identities ?? []).some((i) => i.provider === "google");
  const accountLabel = email.toLowerCase().endsWith(`@${LOGIN_EMAIL_DOMAIN}`)
    ? `아이디: ${email.split("@")[0]}`
    : isGoogle
      ? PRIVACY_EXTRA_TEXT.googleAccountLabel
      : email;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    setTried(true);
    if (problem) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
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
        <DialogDescription>댓글과 메뉴에 표시되는 별명입니다.</DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{previewName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 truncate text-sm text-muted-foreground">{accountLabel}</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor={nameId} className="text-sm font-semibold">
          {NICKNAME_FIELD.label} <span className="font-normal text-muted-foreground">{NICKNAME_FIELD.hint}</span>
        </label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="nickname"
          spellCheck={false}
          disabled={saving}
          aria-invalid={showProblem}
          aria-describedby={showProblem ? errId : undefined}
          className="h-11 text-base"
        />
        {showProblem ? (
          <p id={errId} role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={onDone} disabled={saving}>
          취소
        </Button>
        <Button type="submit" className="h-11 px-4" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
