/**
 * 관리자 화면 공용 겉모양 클래스(디자인 개편 4단계, docs/design/redesign/spec.md §4.9).
 * 관리자 화면은 색·글꼴·모서리·그림자만 새 디자인에 맞춘다 — 구조·동작은 그대로 두고 이 클래스만 덧붙인다.
 */

/**
 * 카드·목록·표의 겉면: 흰 판 + 옅은 윤곽 + 작은 그림자(다크는 그림자 대신 윤곽만).
 * 연보라 페이지 배경 위에서 표·목록 글자가 또렷하게 읽히도록 투명하던 목록에 판을 깐다.
 */
export const adminSurfaceClass = "bg-card ring-1 ring-foreground/10 shadow-(--shadow-sm) dark:shadow-none";

/** 되돌릴 수 없는 동작의 마지막 확인 버튼(진한 빨강 + 흰 글자) — 학생 화면과 같이 쓰도록 src/lib/danger-button.ts로 옮겼다. */
export { dangerSolidClass } from "@/lib/danger-button";

/**
 * 탭 내용 칸(TabsContent) 초점 표시: shadcn 기본값은 outline-none이라 Tab 키로 들어가도 아무 표시가 없었다.
 * 학생 화면(내 학습 활동)과 같은 방식의 둥근 링을 준다.
 */
export const adminTabPanelClass =
  "rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background";
