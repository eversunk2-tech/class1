import { scienceTerms } from "@/data/science-curriculum";
import { schema as s111 } from "./sci-6-1-1-1";
import { schema as s112 } from "./sci-6-1-1-2";
import { schema as s113 } from "./sci-6-1-1-3";
import { schema as s114 } from "./sci-6-1-1-4";
import { schema as s115 } from "./sci-6-1-1-5";
import { schema as s116 } from "./sci-6-1-1-6";
import { schema as s121 } from "./sci-6-1-2-1";
import { schema as s122 } from "./sci-6-1-2-2";
import { schema as s123 } from "./sci-6-1-2-3";
import { schema as s124 } from "./sci-6-1-2-4";
import { schema as s125 } from "./sci-6-1-2-5";
import { schema as s126 } from "./sci-6-1-2-6";
import type { ResponseSchema } from "./types";

export type { Answer, Detail, ResponseItem, ResponseSchema } from "./types";

/**
 * appId → 응답 매핑 레지스트리 (docs/admin/responses-spec.md §3.1).
 * 새 앱은 공통 틀이 detail.qa를 저장하므로 여기에 넣지 않아도 "학생 응답"에 보인다.
 * 이미 만든 앱의 detail 모양을 바꾸면 그 앱 파일도 같이 고친다.
 */
const SCHEMAS: ResponseSchema[] = [s111, s112, s113, s114, s115, s116, s121, s122, s123, s124, s125, s126];

const BY_ID = new Map(SCHEMAS.map((s) => [s.appId, s]));

export function getResponseSchema(appId: string): ResponseSchema | null {
  return BY_ID.get(appId) ?? null;
}

export type ResponseApp = {
  id: string;
  kind: "sim" | "guide";
  /** 차시 제목(science-curriculum.ts) */
  title: string;
  /** "6학년 1학기 · 2. 물체의 운동 · 탐구 3" */
  context: string;
  /** 드롭다운 한 줄 표시 */
  label: string;
};

/**
 * 과학 차시 앱 목록 — src/data/science-curriculum.ts의 app이 있는 차시만(학기 → 단원 → 차시 순).
 * src/data/apps.ts의 webApps는 과학 앱을 담고 있지 않아 이 목록을 기준으로 쓴다(spec §2.13-⑧, Q9).
 */
export const responseApps: ResponseApp[] = scienceTerms.flatMap((term) =>
  term.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) =>
      lesson.app
        ? [
            {
              id: lesson.app.id,
              kind: lesson.app.kind,
              title: lesson.title,
              context: `${term.label} · ${unit.number}. ${unit.title} · 탐구 ${lesson.inquiry}`,
              label: `${unit.number}단원 탐구 ${lesson.inquiry} · ${lesson.title}`,
            },
          ]
        : [],
    ),
  ),
);

export function findResponseApp(appId: string | null | undefined): ResponseApp | null {
  return responseApps.find((a) => a.id === appId) ?? null;
}

/** 관리자 화면용 앱 제목: 과학 차시 제목 → 없으면 app_id */
export function responseAppTitle(appId: string): string {
  return findResponseApp(appId)?.title ?? appId;
}
