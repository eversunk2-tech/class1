/**
 * 과학수업 교육과정(학기 → 단원 → 차시) 데이터.
 *
 * 출처: 6학년 1·2학기 과학 교사용 지도서 각 단원의 "단원 지도 계획" 표.
 * (2학기 4단원 "과학과 나의 진로"는 사용자 결정으로 싣지 않는다.)
 * - 단원 순서·이름은 지도서 표기를 따른다.
 * - 교과 내용 차시인 "과학 탐구"만 싣는다(열려라 과학·창의가 팡팡·과학이 톡톡·마무리하기는 제외).
 * - `inquiry`는 교과서의 탐구 번호(예: "3. 줄기의 생김새와…"의 3), `period`는 지도서의 차시.
 * - 쪽수는 학생용 교과서(`science`)와 실험관찰(`workbook`)만 적는다. 없으면 빈 문자열.
 *
 * 화면·사이드바는 이 배열을 순회하므로 따로 고칠 필요가 없다.
 */

export type Lesson = {
  /** 단원 안에서 고유한 key (URL `lesson` 파라미터) */
  id: string;
  /** 교과서 탐구 번호 (1부터) */
  inquiry: number;
  /** 지도서 차시 표기. 예: "2", "3~4" */
  period: string;
  /** 차시 주제 (지도서 표기) */
  title: string;
  /** 과학 교과서 쪽 */
  science: string;
  /** 실험관찰 쪽 */
  workbook: string;
  /**
   * 차시 앱(`/public/apps/{id}/`). CLAUDE.md "과학 차시 앱 규칙" 참고.
   * sim = 실험 시뮬레이션, guide = 조사 도우미. 아직 없으면 생략.
   */
  app?: { id: string; kind: "sim" | "guide" };
};

export type Unit = {
  /** 학기 안에서 고유한 단원 번호 (URL `unit` 파라미터) */
  number: number;
  title: string;
  lessons: Lesson[];
};

export type Term = {
  /** URL `term` 파라미터. 예: "6-1" */
  id: string;
  label: string;
  units: Unit[];
};

export const scienceTerms: Term[] = [
  {
    id: "6-1",
    label: "6학년 1학기",
    units: [
      {
        number: 1,
        title: "산과 염기",
        lessons: [
          { id: "2", inquiry: 1, period: "2", title: "여러 가지 용액을 분류해 볼까?", science: "14~15", workbook: "6~7", app: { id: "sci-6-1-1-1", kind: "sim" } },
          { id: "3", inquiry: 2, period: "3~4", title: "지시약으로 여러 가지 용액을 분류해 볼까?", science: "16~19", workbook: "8~10", app: { id: "sci-6-1-1-2", kind: "sim" } },
          { id: "5", inquiry: 3, period: "5", title: "산성 용액과 염기성 용액의 성질을 비교해 볼까?", science: "20~21", workbook: "11", app: { id: "sci-6-1-1-3", kind: "sim" } },
          { id: "6", inquiry: 4, period: "6", title: "산성 용액과 염기성 용액을 섞으면 어떻게 될까?", science: "22~23", workbook: "12~13", app: { id: "sci-6-1-1-4", kind: "sim" } },
          { id: "7", inquiry: 5, period: "7", title: "산성 용액과 염기성 용액을 이용하는 예를 찾아라!", science: "24~25", workbook: "14~15", app: { id: "sci-6-1-1-5", kind: "guide" } },
          { id: "8", inquiry: 6, period: "8", title: "산성화가 환경에 미치는 영향을 알아볼까?", science: "26~27", workbook: "16~17", app: { id: "sci-6-1-1-6", kind: "guide" } },
        ],
      },
      {
        number: 2,
        title: "물체의 운동",
        lessons: [
          { id: "2", inquiry: 1, period: "2", title: "운동하는 물체의 특징을 찾아라!", science: "38~39", workbook: "22~23", app: { id: "sci-6-1-2-1", kind: "sim" } },
          { id: "3", inquiry: 2, period: "3", title: "물체의 운동을 표현해 볼까?", science: "40~41", workbook: "24~25", app: { id: "sci-6-1-2-2", kind: "sim" } },
          { id: "4", inquiry: 3, period: "4", title: "같은 시간 동안 이동한 물체의 빠르기를 비교해 보자!", science: "42~43", workbook: "26", app: { id: "sci-6-1-2-3", kind: "sim" } },
          { id: "5", inquiry: 4, period: "5", title: "같은 거리를 이동한 물체의 빠르기를 비교해 보자!", science: "44~45", workbook: "27", app: { id: "sci-6-1-2-4", kind: "sim" } },
          { id: "6", inquiry: 5, period: "6", title: "물체의 빠르기를 속력으로 비교해 보자!", science: "46~47", workbook: "28~29", app: { id: "sci-6-1-2-5", kind: "sim" } },
          { id: "7", inquiry: 6, period: "7~8", title: "속력과 관련된 안전 수칙과 안전장치를 조사해 볼까?", science: "48~51", workbook: "30~31", app: { id: "sci-6-1-2-6", kind: "guide" } },
        ],
      },
      {
        number: 3,
        title: "식물의 구조와 기능",
        lessons: [
          { id: "2", inquiry: 1, period: "2", title: "세포가 궁금해!", science: "62~63", workbook: "36~37" },
          { id: "3", inquiry: 2, period: "3", title: "뿌리의 생김새와 하는 일을 알아볼까?", science: "64~65", workbook: "38~39" },
          { id: "4", inquiry: 3, period: "4", title: "줄기의 생김새와 하는 일을 알아볼까?", science: "66~67", workbook: "40~41" },
          { id: "5", inquiry: 4, period: "5", title: "잎에서 양분이 만들어진다고?", science: "68~69", workbook: "42~43" },
          { id: "6", inquiry: 5, period: "6", title: "잎에 도달한 물은 어떻게 될까?", science: "70~71", workbook: "44" },
          { id: "7", inquiry: 6, period: "7", title: "꽃의 생김새와 하는 일을 알아볼까?", science: "72~75", workbook: "45" },
          { id: "8", inquiry: 7, period: "8", title: "식물의 각 기관은 연결되어 있어요!", science: "76~77", workbook: "46~47" },
        ],
      },
      {
        number: 4,
        title: "지구의 운동",
        lessons: [
          { id: "2", inquiry: 1, period: "2~3", title: "하루 동안 태양과 별의 위치는 어떻게 달라질까?", science: "88~91", workbook: "52~55" },
          { id: "4", inquiry: 2, period: "4", title: "지구의 자전을 알아볼까?", science: "92~93", workbook: "56~57" },
          { id: "5", inquiry: 3, period: "5", title: "낮과 밤이 생기는 까닭은 무엇일까?", science: "94~95", workbook: "58~59" },
          { id: "6", inquiry: 4, period: "6", title: "지구의 공전을 알아볼까?", science: "96~97", workbook: "60~61" },
          { id: "7", inquiry: 5, period: "7", title: "계절에 따라 달라지는 별자리가 궁금해!", science: "98~101", workbook: "62~63" },
        ],
      },
    ],
  },
  {
    id: "6-2",
    label: "6학년 2학기",
    units: [
      {
        number: 1,
        title: "계절의 변화",
        lessons: [
          { id: "2", inquiry: 1, period: "2", title: "태양 고도 측정기를 만들자!", science: "14~15", workbook: "6~7" },
          { id: "3", inquiry: 2, period: "3~4", title: "하루 동안 태양 고도, 그림자 길이, 기온의 관계는?", science: "16~19", workbook: "8~11", app: { id: "sci-6-2-1-2", kind: "sim" } },
          { id: "5", inquiry: 3, period: "5~6", title: "계절별 태양의 남중 고도와 낮의 길이의 관계는?", science: "20~21", workbook: "12~13", app: { id: "sci-6-2-1-3", kind: "sim" } },
          { id: "7", inquiry: 4, period: "7", title: "태양 고도와 태양 에너지양의 관계는?", science: "22~23", workbook: "14~15", app: { id: "sci-6-2-1-4", kind: "sim" } },
          { id: "8", inquiry: 5, period: "8~9", title: "계절 변화의 원인을 찾아라!", science: "24~27", workbook: "16~17", app: { id: "sci-6-2-1-5", kind: "sim" } },
        ],
      },
      {
        number: 2,
        title: "물질의 연소",
        lessons: [
          { id: "2", inquiry: 1, period: "2", title: "서로 다른 물질을 섞으면 어떻게 될까?", science: "38~39", workbook: "22~23", app: { id: "sci-6-2-2-1", kind: "sim" } },
          { id: "3", inquiry: 2, period: "3", title: "물질이 탈 때 어떤 현상이 나타날까?", science: "40~41", workbook: "24~25", app: { id: "sci-6-2-2-2", kind: "sim" } },
          { id: "4", inquiry: 3, period: "4~5", title: "물질이 타려면 무엇이 필요할까?", science: "42~45", workbook: "26~27", app: { id: "sci-6-2-2-3", kind: "sim" } },
          { id: "6", inquiry: 4, period: "6", title: "연소 후의 변화가 궁금해!", science: "46~47", workbook: "28~29", app: { id: "sci-6-2-2-4", kind: "sim" } },
          { id: "7", inquiry: 5, period: "7", title: "연소 생성물은 생태계에 어떤 피해를 줄까?", science: "48~49", workbook: "30~31" },
        ],
      },
      {
        number: 3,
        title: "전기의 이용",
        lessons: [
          { id: "2", inquiry: 1, period: "2", title: "전구에 불을 켜려면 어떻게 해야 할까?", science: "60~61", workbook: "36~37", app: { id: "sci-6-2-3-1", kind: "sim" } },
          { id: "3", inquiry: 2, period: "3", title: "전기 회로에 전지 한 개를 더 연결하면 어떻게 될까?", science: "62~63", workbook: "38~39", app: { id: "sci-6-2-3-2", kind: "sim" } },
          { id: "4", inquiry: 3, period: "4~5", title: "전자석의 성질이 궁금해!", science: "64~67", workbook: "40~43", app: { id: "sci-6-2-3-3", kind: "sim" } },
          { id: "6", inquiry: 4, period: "6", title: "전자석을 사용하는 예를 알아볼까?", science: "68~69", workbook: "44~45" },
          { id: "7", inquiry: 5, period: "7~8", title: "전기, 어떻게 사용해야 할까?", science: "70~73", workbook: "46~47" },
        ],
      },
    ],
  },
];

export function findTerm(termId: string | null | undefined): Term | undefined {
  return scienceTerms.find((t) => t.id === termId);
}

export function findUnit(term: Term | undefined, unitNumber: string | number | null | undefined): Unit | undefined {
  if (!term || unitNumber == null) return undefined;
  return term.units.find((u) => String(u.number) === String(unitNumber));
}

export function findLesson(unit: Unit | undefined, lessonId: string | null | undefined): Lesson | undefined {
  if (!unit || !lessonId) return undefined;
  return unit.lessons.find((l) => l.id === lessonId);
}

/** `/science/` 화면의 쿼리스트링 경로. next/link에 넘기면 basePath가 자동으로 붙는다. */
export function scienceHref(termId?: string, unitNumber?: number, lessonId?: string): string {
  const params = new URLSearchParams();
  if (termId) params.set("term", termId);
  if (termId && unitNumber != null) params.set("unit", String(unitNumber));
  if (termId && unitNumber != null && lessonId) params.set("lesson", lessonId);
  const qs = params.toString();
  return qs ? `/science/?${qs}` : "/science/";
}
