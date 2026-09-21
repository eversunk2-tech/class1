"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export const SIDEBAR_STORAGE_KEY = "sidebar:collapsed";

/** <html>에 붙는 속성 이름. 값이 "collapsed"면 접힘(globals.css의 .app-sidebar 규칙 참고). */
const SIDEBAR_ATTR = "data-sidebar";

/**
 * <head>에서 hydration 전에 실행되는 인라인 스크립트(첫 페인트 깜빡임 방지, spec §2.3).
 * 정적 export라 쿠키로 SSR 클래스를 정할 수 없으므로 테마와 같은 localStorage + 인라인 스크립트 방식을 쓴다.
 * 저장된 값이 "true"일 때만 <html data-sidebar="collapsed">를 세팅한다(기본은 펼침).
 */
export const SIDEBAR_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="true"){document.documentElement.setAttribute("${SIDEBAR_ATTR}","collapsed")}}catch(e){}})()`;

const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  return document.documentElement.getAttribute(SIDEBAR_ATTR) === "collapsed";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function applyCollapsed(collapsed: boolean) {
  const root = document.documentElement;
  if (collapsed) root.setAttribute(SIDEBAR_ATTR, "collapsed");
  else root.removeAttribute(SIDEBAR_ATTR);
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {}
  listeners.forEach((l) => l());
}

/**
 * 데스크톱 사이드바 펼침/접힘 상태.
 * 폭·라벨 표시는 <html data-sidebar> 속성과 CSS가 담당하고,
 * 이 훅의 값은 aria 속성·툴팁처럼 React가 알아야 하는 곳에만 쓴다.
 * 서버 스냅샷은 항상 "펼침"이라 hydration mismatch가 나지 않는다.
 */
export function useSidebar() {
  const collapsed = useSyncExternalStore<boolean>(subscribe, readCollapsed, () => false);
  const setCollapsed = useCallback((value: boolean) => applyCollapsed(value), []);
  const toggleCollapsed = useCallback(() => applyCollapsed(!readCollapsed()), []);
  return { collapsed, setCollapsed, toggleCollapsed };
}

/** Tailwind md 브레이크포인트. 이 폭 이상에서는 고정 사이드바가 보이므로 드로어를 닫는다. */
const DESKTOP_QUERY = "(min-width: 768px)";

/** 모바일 메뉴 드로어 열림 상태. 화면이 데스크톱 폭으로 넓어지면 자동으로 닫는다. */
export function useNavDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, close };
}
