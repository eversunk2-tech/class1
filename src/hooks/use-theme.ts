"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/**
 * <head>에서 hydration 전에 실행되는 인라인 스크립트(FOUC 방지).
 * 저장된 값 → 없으면 OS 설정 순으로 <html>에 dark 클래스를 적용한다.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t}catch(e){}})()`;

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // 사용자가 직접 고른 적이 없으면 OS 설정 변경을 따라간다.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = (e: MediaQueryListEvent) => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (stored !== "light" && stored !== "dark") applyTheme(e.matches ? "dark" : "light", false);
  };
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onChange);
  };
}

function applyTheme(theme: Theme, persist: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");
  const setTheme = useCallback((t: Theme) => applyTheme(t, true), []);
  const toggleTheme = useCallback(
    () => applyTheme(readTheme() === "dark" ? "light" : "dark", true),
    [],
  );
  return { theme, setTheme, toggleTheme };
}
