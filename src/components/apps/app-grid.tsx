import { AppCard } from "@/components/apps/app-card";
import { EmptyState } from "@/components/states";
import { webApps } from "@/data/apps";

/** 메인 화면의 웹앱 카드 섹션. 등록된 앱이 없으면 안내 카드를 보여준다. */
export function AppGrid() {
  if (!webApps.length) {
    return (
      <EmptyState
        title="곧 공개될 웹앱들을 위한 공간입니다"
        description="수업에서 만든 웹앱이 준비되면 이곳에서 바로 실행해 볼 수 있습니다."
      />
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {webApps.map((app) => (
        <li key={app.id} className="flex">
          <AppCard app={app} />
        </li>
      ))}
    </ul>
  );
}
