/**
 * 관리자 "학생 응답" — 앱별 응답 매핑 타입 (docs/admin/responses-spec.md §3).
 *
 * app_results.details(학생이 적고 고른 내용)는 앱마다 모양이 다르고 질문 문구가 저장되지 않는다.
 * 그래서 이미 만든 앱은 앱마다 매핑(src/data/app-responses/{appId}.ts)을 두어 "질문 + 답" 목록(ResponseItem[])으로 바꾼다.
 * 앞으로 만드는 앱은 공통 틀이 detail.qa(질문-답 표준 목록)를 함께 저장하므로 매핑이 없어도 보인다(src/lib/app-responses.ts).
 *
 * 앱의 detail 모양을 바꾸면 그 앱의 매핑 파일도 같이 고친다(CLAUDE.md 과학 차시 앱 규칙).
 */

/** app_results.details (신뢰할 수 없는 학생 입력 — 화면에는 텍스트로만 그린다) */
export type Detail = Record<string, unknown>;

export type TextAnswer = {
  kind: "text";
  text: string;
  /** 정리하기처럼 '제출' 버튼이 있는 문항: 제출했는지(모르면 undefined) */
  submitted?: boolean;
};

export type ChoiceAnswer = {
  kind: "choice";
  /** 학생이 마지막으로 고른 보기(라벨) */
  chosen: string[];
  /** 정답 여부(채점하지 않는 문항이면 null) */
  correct: boolean | null;
  /** '확인하기'를 누른 횟수(모르면 null) */
  tries: number | null;
  /** 보기 전체(라벨) — 질문별 보기에서 선택 분포를 그릴 때 쓴다 */
  options?: string[];
};

export type TableAnswer = {
  kind: "table";
  columns: { key: string; label: string }[];
  /** 셀은 이미 표시용 문자열로 바뀐 값 */
  rows: Record<string, string>[];
};

export type GroupsAnswer = {
  kind: "groups";
  groups: { label: string; items: string[] }[];
  correct: boolean | null;
  tries: number | null;
};

/** 숫자·예/아니요 같은 짧은 값 */
export type ValueAnswer = { kind: "value"; text: string };

/** 모양을 알 수 없는 값(JSON으로 보여 준다) */
export type RawAnswer = { kind: "raw"; value: unknown };

export type Answer = TextAnswer | ChoiceAnswer | TableAnswer | GroupsAnswer | ValueAnswer | RawAnswer;

/** 화면이 그리는 질문-답 한 항목 */
export type ResponseItem = {
  /** `${stage}:${id}` — 질문별 보기에서 학생들의 같은 질문을 묶는 키 */
  key: string;
  stage: string;
  /** "질문 1", "분석 2", "결론" 같은 짧은 이름(선택) */
  label?: string;
  question: string;
  answer: Answer;
  /** 관리자에게 보여 줄 짧은 주의(예: 정답은 학생 자신의 기록으로 채점) */
  note?: string;
  /**
   * 이 질문이 나온 앱 버전(매핑 변형 id, detail.qa면 schema.qaVersion 또는 "qa").
   * 질문별 보기는 (버전 + key + 질문 문구)가 모두 같을 때만 같은 질문으로 묶는다 — 버전마다 같은 id를 다른 질문에 쓴 앱이 있다.
   */
  version?: string;
};

/** 매핑의 한 항목: detail에서 답을 뽑는 방법 */
export type ItemSpec = {
  stage: string;
  id: string;
  label?: string;
  question: string;
  note?: string;
  /** 이 항목이 읽는 detail 최상위 키(매핑하지 못한 "그 밖의 저장 값"을 고를 때 뺀다) */
  uses: string[];
  /** 값이 없으면 null(그 항목은 보여 주지 않는다) */
  read: (d: Detail) => Answer | null;
};

/**
 * 같은 앱이라도 버전에 따라 detail 모양이 다르다(예: 2단원 탐구 3·4·5는 2026-09-22 개정 전후).
 * 위에서부터 match되는 첫 변형을 쓴다. 어느 것도 맞지 않으면 원본 JSON으로 보여 준다.
 */
export type ResponseVariant = {
  id: string;
  /** 관리자에게 보여 줄 버전 이름(예: "개정 전(v1)") */
  label: string;
  match: (d: Detail) => boolean;
  items: ItemSpec[];
  /** 보여 주지 않아도 되는 최상위 키(질문-답이 아닌 보조 정보) */
  ignore?: string[];
};

export type ResponseSchema = {
  appId: string;
  kind: "sim" | "guide";
  /** legacy = 이전(긴) 기준, slim = 2026-09-22 새(짧은) 기준 */
  standard: "legacy" | "slim";
  /** 앱의 단계(진행률 · 섹션 제목) — 앱 lesson-config의 stages와 같게 */
  stages: { id: string; label: string }[];
  variants: ResponseVariant[];
  /** 이 앱 결과를 읽을 때 알아 둘 점 */
  notes?: string[];
  /**
   * detail.qa를 저장하는 지금 버전이 어느 매핑 변형과 같은 앱 버전인지(예: "v4").
   * qa를 넣으면서 다른 저장 필드는 바꾸지 않은 앱은 qa 결과와 그 변형의 예전 결과가 같은 질문이라 질문별 보기에서 함께 묶는다.
   * 없으면 qa 결과는 "qa"라는 별도 버전으로 본다.
   */
  qaVersion?: string;
};
