import { AppGrid } from "@/components/apps/app-grid";
import { PostList } from "@/components/post-list";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">최신 글</h1>
          <p className="text-sm text-muted-foreground">수업에서 배우고 만든 것들을 기록합니다.</p>
        </section>
        <section aria-label="글 목록">
          <PostList />
        </section>
      </div>
      <section aria-labelledby="apps-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="apps-heading" className="text-xl font-semibold tracking-tight">
            웹앱
          </h2>
          <p className="text-sm text-muted-foreground">카드를 누르면 바로 미리보고, 새 탭에서 열 수 있습니다.</p>
        </div>
        <AppGrid />
      </section>
    </div>
  );
}
