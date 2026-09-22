"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangleIcon, Maximize2Icon, Minimize2Icon, PlayIcon, RotateCcwIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSandboxDocument, GAME_PERMISSIONS, GAME_SANDBOX } from "@/lib/community";
import { cn } from "@/lib/utils";

/**
 * 업로드 게임 실행기(spec §4.1) — 업로드 HTML이 렌더링되는 유일한 곳.
 *
 * 보안 규칙(바꾸지 말 것):
 * - `sandbox="allow-scripts"`만. allow-same-origin을 넣으면 게임이 사이트 출처가 되어 로그인 토큰(localStorage)을 읽을 수 있다.
 *   allow-top-navigation·allow-popups·allow-modals·allow-forms·allow-pointer-lock도 넣지 않는다.
 * - 문서는 `srcdoc`으로만 넣는다(Storage 파일 URL·blob URL을 src로 쓰지 않는다). srcdoc + sandbox 문서는 매번 새 불투명 출처다.
 * - srcdoc은 고정 래퍼 문서(CSP meta가 맨 앞)이고, 게임 HTML은 래퍼 안 중첩 sandbox iframe의 srcdoc 속성값으로만 들어간다
 *   (buildSandboxDocument 참고 — 업로드 HTML의 주석 트릭으로 CSP를 밀어낼 수 없다).
 * - 게임은 처음엔 멈춘 상태로 두고 "게임 시작"을 눌러야 실행한다(무한 반복 게임이 화면을 바로 멈추지 않게).
 * - "새 탭으로 열기"는 제공하지 않는다(새 탭은 sandbox 밖 최상위 문서가 된다).
 * - 전체 화면은 게임이 아니라 부모(이 컴포넌트)가 바깥 div에 Fullscreen API를 호출한다 → iframe에 추가 권한이 필요 없다.
 */
/** 실행 중 표시(sessionStorage, 이 탭에만). 게임 때문에 탭이 멈춰 강제로 닫히면 표시가 남아 다음에 경고한다. */
const RUNNING_KEY = "community-game-running";
/** 부모 화면이 이 시간 이상 멈췄다가 풀리면 "게임이 화면을 멈추게 했어요" 안내를 띄운다. */
const STALL_MS = 2500;

function readRunningFlag(): string | null {
  try {
    return window.sessionStorage.getItem(RUNNING_KEY);
  } catch {
    return null;
  }
}
function writeRunningFlag(value: string | null) {
  try {
    if (value == null) window.sessionStorage.removeItem(RUNNING_KEY);
    else window.sessionStorage.setItem(RUNNING_KEY, value);
  } catch {
    // 저장소를 쓸 수 없는 환경이면 무시
  }
}

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function GamePlayer({ html, title }: { html: string; title: string }) {
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  // 지난번 이 탭에서 게임을 실행하다 탭이 멈춰 닫혔는지(실행 중 표시가 남아 있음)
  const [crashedBefore, setCrashedBefore] = useState(false);
  // 실행 중 부모 화면이 오래 멈춘 적이 있는지
  const [stalled, setStalled] = useState(false);
  // 브라우저 전체 화면(Fullscreen API) 또는, 지원하지 않는 기기(iPhone 등)에서는 화면 가득 채우기(CSS)
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => buildSandboxDocument(html, title), [html, title]);

  // 지난번 실행 표시가 남아 있으면(정상 종료라면 지워졌을 것) 멈춤 경고를 보여 준다.
  useEffect(() => {
    if (readRunningFlag() == null) return;
    writeRunningFlag(null);
    const id = window.setTimeout(() => setCrashedBefore(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // 실행 중에는 표시를 남기고, 정지·화면 이동·탭 닫기(정상)에는 지운다.
  useEffect(() => {
    if (!running) return;
    writeRunningFlag(String(Date.now()));
    const clear = () => writeRunningFlag(null);
    window.addEventListener("pagehide", clear);
    // 부모 화면이 오래 멈췄다가 풀렸는지 잰다(게임이 CPU를 붙잡은 경우).
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (now - last > STALL_MS && document.visibilityState === "visible") setStalled(true);
      last = now;
    }, 500);
    return () => {
      window.removeEventListener("pagehide", clear);
      window.clearInterval(timer);
      clear();
    };
  }, [running, runId]);

  useEffect(() => {
    const onChange = () => {
      const d = document as FullscreenDocument;
      setFullscreen((d.fullscreenElement ?? d.webkitFullscreenElement ?? null) === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // 화면 가득 채우기 상태에서는 Esc로 빠져나온다.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  async function toggleFullscreen() {
    const d = document as FullscreenDocument;
    if (fullscreen) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    if (maximized) {
      setMaximized(false);
      return;
    }
    const el = wrapperRef.current as FullscreenElement | null;
    const request = el?.requestFullscreen ? () => el.requestFullscreen() : el?.webkitRequestFullscreen ? () => el.webkitRequestFullscreen!() : null;
    if (!request || document.fullscreenEnabled === false) {
      setMaximized(true);
      return;
    }
    try {
      // 일부 브라우저(앱 내장 브라우저 등)는 요청을 조용히 무시한다 → 잠시 뒤에도 전체 화면이 아니면 화면 가득 채우기로 대신한다.
      await Promise.race([Promise.resolve(request()), new Promise((r) => setTimeout(r, 700))]);
      const now = d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
      if (now !== wrapperRef.current) setMaximized(true);
    } catch {
      setMaximized(true);
    }
  }

  function stop() {
    const d = document as FullscreenDocument;
    if (fullscreen) void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
    setMaximized(false);
    setRunning(false);
  }

  function start() {
    setStalled(false);
    setRunId((n) => n + 1);
    setRunning(true);
  }

  const expanded = fullscreen || maximized;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapperRef}
        className={cn(
          "relative flex flex-col overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10",
          fullscreen && "rounded-none bg-black",
          maximized && "fixed inset-0 z-[60] rounded-none bg-black",
        )}
      >
        {expanded ? (
          <div className="flex items-center justify-end gap-2 bg-black/80 p-2">
            <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
              <Minimize2Icon />
              전체 화면 끝내기
            </Button>
            <Button variant="secondary" size="sm" onClick={stop}>
              <SquareIcon />
              정지
            </Button>
          </div>
        ) : null}
        {running ? (
          <iframe
            key={runId}
            ref={iframeRef}
            title={`${title} (게임)`}
            sandbox={GAME_SANDBOX}
            srcDoc={srcDoc}
            allow={GAME_PERMISSIONS}
            referrerPolicy="no-referrer"
            onLoad={() => iframeRef.current?.focus()}
            className={cn(
              "block w-full border-0 bg-white",
              expanded ? "min-h-0 flex-1" : "h-[68vh] min-h-[320px] max-h-[820px]",
            )}
          />
        ) : (
          <div className="flex h-[40vh] min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Button size="lg" className="h-11 gap-2 rounded-full px-6 text-base" onClick={start}>
              <PlayIcon className="size-5" />
              게임 시작
            </Button>
            <p className="text-xs text-muted-foreground">버튼을 누르면 게임이 시작돼요.</p>
            {crashedBefore ? (
              <p role="alert" className="flex max-w-sm items-start gap-1.5 text-left text-xs leading-5 break-keep text-amber-700 dark:text-amber-400">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                지난번에 게임을 하다가 화면이 멈췄을 수 있어요. 또 멈추면 탭을 닫았다가 다시 열고, 선생님께 알려 주세요.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {running && stalled ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 break-keep text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangleIcon className="mt-1 size-4 shrink-0" aria-hidden />
          게임이 화면을 잠깐 멈추게 했어요. 계속 느리면 정지를 눌러 주세요.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <>
            <Button variant="outline" className="h-9 px-3.5" onClick={stop}>
              <SquareIcon />
              정지
            </Button>
            <Button variant="outline" className="h-9 px-3.5" onClick={start}>
              <RotateCcwIcon />
              다시 시작
            </Button>
            <Button variant="outline" className="h-9 px-3.5" onClick={toggleFullscreen}>
              <Maximize2Icon />
              전체 화면
            </Button>
          </>
        ) : null}
        <p className="flex w-full items-start gap-1.5 text-xs leading-5 break-keep text-muted-foreground sm:ml-auto sm:w-auto sm:max-w-md">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          게임은 사이트와 분리된 안전한 칸에서 실행돼요. 게임 안에 이름·비밀번호 같은 개인정보를 입력하지 마세요.
          진행 저장과 알림창(alert)은 동작하지 않아요. 화면이 멈춰 버튼이 눌리지 않으면 브라우저 탭을 닫았다가 다시 열어 주세요.
        </p>
      </div>
    </div>
  );
}
