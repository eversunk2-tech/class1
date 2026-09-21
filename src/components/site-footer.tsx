/** 본문 컬럼(사이드바를 뺀 영역) 전체 폭에 맞춰 렌더링된다. */
export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="w-full px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        © {new Date().getFullYear()} 우리 반 배움터
      </div>
    </footer>
  );
}
