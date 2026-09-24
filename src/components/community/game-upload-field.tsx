"use client";

import { useId, useRef, useState } from "react";
import { FileCode2Icon, PlayIcon, UploadIcon, XIcon } from "lucide-react";
import { GamePlayer } from "@/components/community/game-player";
import { Icon3D } from "@/components/illustrations/icon-3d";
import { Button } from "@/components/ui/button";
import { formatBytes, GameFileError, readGameFile } from "@/lib/community";

export type PickedGameFile = { name: string; html: string; size: number };

/**
 * 게임 파일 고르기 + 검사(.html · 2MB · UTF-8 · HTML 내용) + 미리 해보기.
 * 미리 해보기도 상세 화면과 똑같은 sandbox 실행기(GamePlayer)로만 띄운다.
 */
export function GameUploadField({
  value,
  onChange,
  disabled,
  required,
  currentName,
  lockedMessage,
}: {
  value: PickedGameFile | null;
  onChange: (file: PickedGameFile | null) => void;
  disabled?: boolean;
  required?: boolean;
  /** 수정 화면: 이미 올린 파일이 있음을 알려 준다 */
  currentName?: string | null;
  /** 파일을 바꿀 수 없을 때(관리자가 다른 사람 게임을 고칠 때) 보여 줄 안내. 있으면 파일 고르기를 숨긴다. */
  lockedMessage?: string | null;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(false);

  async function onPick(file: File | undefined) {
    setError(null);
    setPreview(false);
    if (!file) return;
    setChecking(true);
    try {
      const html = await readGameFile(file);
      onChange({ name: file.name, html, size: new Blob([html]).size });
    } catch (e) {
      onChange(null);
      setError(e instanceof GameFileError ? e.message : "파일을 읽지 못했어요.");
    } finally {
      setChecking(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (lockedMessage) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">게임 파일 (index.html)</span>
        <p className="text-sm text-muted-foreground">{lockedMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        게임 파일 (index.html){required ? <span className="text-destructive"> *</span> : null}
      </label>
      {/* 파일 고르는 칸: 학습게임 색 점선 상자(디자인 개편 2단계, 동작은 그대로) */}
      {/* 숨긴 파일 입력칸에 키보드 초점이 오면 상자 둘레에 초점 링을 보여 준다(겉모양만) */}
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-games-strong/25 bg-games-soft/40 p-4 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/60 sm:p-5 dark:bg-games-soft/25">
        <div className="flex flex-wrap items-center gap-2">
          <Icon3D name="video-game" size={40} className="mr-1 size-10" />
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept=".html,.htm,text/html"
            className="sr-only"
            disabled={disabled || checking}
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full bg-card px-4 shadow-(--shadow-sm) dark:shadow-none"
            disabled={disabled || checking}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon />
            {value || currentName ? "다른 파일 고르기" : "파일 고르기"}
          </Button>
          {value ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm shadow-(--shadow-sm) ring-1 ring-foreground/5 dark:shadow-none">
              <FileCode2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{value.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(value.size)}</span>
              <button
                type="button"
                className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => {
                  onChange(null);
                  setPreview(false);
                }}
                aria-label="고른 파일 빼기"
                disabled={disabled}
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          ) : currentName ? (
            <span className="text-sm text-muted-foreground">지금 파일을 그대로 써요. 바꾸려면 새 파일을 고르세요.</span>
          ) : null}
          {value ? (
            <Button type="button" variant="ghost" className="h-10 rounded-full px-3.5" onClick={() => setPreview((v) => !v)} disabled={disabled}>
              <PlayIcon />
              {preview ? "미리 해보기 닫기" : "미리 해보기"}
            </Button>
          ) : null}
        </div>
        {checking ? <p className="text-sm text-muted-foreground">파일을 확인하는 중…</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <ul className="list-disc pl-5 text-xs leading-5 text-muted-foreground">
        <li>생성형 AI로 만든 게임의 index.html 한 개만 올려요(2MB 이하).</li>
        <li>코드가 파일 안에 모두 들어 있거나, CDN 주소(https://…)로 불러오는 게임만 돌아가요. 따로 된 이미지·JS 파일은 쓸 수 없어요.</li>
        <li>게임 안에서 진행 저장(localStorage)과 alert 창은 동작하지 않아요. 화면 안 글자로 알려 주게 만들어 주세요.</li>
        <li>끝나지 않는 반복(while(true) 등)이 있으면 태블릿 화면이 통째로 멈출 수 있어요. 올리기 전에 꼭 미리 해보기로 확인해 주세요.</li>
      </ul>
      {value && preview ? (
        <div className="mt-2">
          <GamePlayer html={value.html} title={`${value.name} 미리보기`} />
        </div>
      ) : null}
    </div>
  );
}
