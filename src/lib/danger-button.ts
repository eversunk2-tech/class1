/**
 * 되돌릴 수 없는 동작(삭제·탈퇴·비밀번호 초기화·관리자 해제)의 **마지막 확인 버튼**: 진한 빨강 바탕 + 흰 글자.
 * 관리자·학생 화면 공용(디자인 개편 4단계 개정 1). `<Button variant="destructive">`·`<AlertDialogAction variant="destructive">`에
 * className으로 덧붙이면 cn(tailwind-merge)이 옅은 빨강 바탕·빨간 글자를 이것으로 바꾼다.
 *
 * 색은 토큰 대신 값으로 고정해 어느 화면에서나 같다(관리자 영역 admin-theme.css의 --destructive와 같은 빨강):
 * - 밝음 oklch(0.5 0.2 25) 위 흰 글자 6.48:1(hover /90 5.78:1)
 * - 어두움 oklch(0.55 0.22 25) 위 흰 글자 5.29:1(hover oklch(0.5 0.21 25) 6.36:1) — 다크의 --destructive는 밝은 빨강이라 흰 글자가 안 읽힌다.
 * 사이트 기본 옅은 빨강 버튼은 빨간 글자가 3.99:1로 AA(4.5) 미달이었다.
 */
export const dangerSolidClass =
  "bg-[color:oklch(0.5_0.2_25)] text-white hover:bg-[color:oklch(0.5_0.2_25)]/90 focus-visible:border-[color:oklch(0.5_0.2_25)] focus-visible:ring-destructive/30 dark:bg-[color:oklch(0.55_0.22_25)] dark:text-white dark:hover:bg-[color:oklch(0.5_0.21_25)] dark:focus-visible:ring-destructive/40";
