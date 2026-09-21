import { AppCard } from "@/components/apps/app-card";
import { EmptyBoxIllustration } from "@/components/illustrations/empty-box-illustration";
import { EmptyState } from "@/components/states";
import { webApps } from "@/data/apps";

/**
 * 학습게임(웹앱) 카드 그리드. 등록된 앱이 없으면 안내 카드를 보여준다.
 * `limit`을 주면 앞에서 N개만 보여 준다(홈 대시보드 미리보기용).
 */
export function AppGrid({ limit }: { limit?: number }) {
  if (!webApps.length) {
    return (
      <EmptyState
        title="곧 공개될 학습게임을 위한 공간이에요"
        description="수업에서 만든 게임이 준비되면 이곳에서 바로 해 볼 수 있어요."
        illustration={<EmptyBoxIllustration accent="games" className="h-28 w-36" />}
        className="py-8"
      />
    );
  }
  const apps = limit == null ? webApps : webApps.slice(0, limit);
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {apps.map((app) => (
        <li key={app.id} className="flex">
          <AppCard app={app} />
        </li>
      ))}
    </ul>
  );
}
