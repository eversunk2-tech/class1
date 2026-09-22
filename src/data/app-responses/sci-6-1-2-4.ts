import { choiceItem, fixed1, getPath, has, tableItem, textItem, type Column } from "./helpers";
import type { Detail, ItemSpec, ResponseSchema } from "./types";

/**
 * sci-6-1-2-4 같은 거리를 이동한 물체의 빠르기를 비교해 보자! (sim · 새 기준)
 * 출처: public/apps/sci-6-1-2-4/app.js buildDetail(), data/lesson-config.js (+ git 이력의 이전 버전)
 *
 * 2026-09-22부터 새로 저장되는 결과에는 detail.qa가 함께 들어가 그것을 먼저 쓴다. 이 매핑은 qa가 없는 예전 결과용이다.
 *  - v4(sci612sim4:v4, 측정 1회): records[{car,distanceCm,time,stopwatch}], times[{distanceCm, 초록색 자동차, 노란색 자동차}]
 *  - v3(개정, 질문 축소): records에 trial(회)이 있고 times 대신 averages[{…평균}]
 *  - v1(개정 전): 50·100·150 cm, averages 여러 줄, analysis.q1~q5, apply, extension{q1,q2}
 */

const STAGES_NOW = [
  { id: "predict", label: "예상하기" },
  { id: "experiment", label: "실험하기" },
  { id: "analyze", label: "기록·분석하기" },
  { id: "conclude", label: "정리하기" },
];

const CAR_OPTIONS = ["초록색 자동차", "노란색 자동차", "둘의 빠르기는 같다"];
const SELF_GRADED = "정답은 이 학생 자신의 기록(100 cm를 이동하는 데 걸린 시간이 더 짧은 자동차)으로 채점했어요.";

/** 거리별 두 자동차 시간 표(times · averages 공통 모양) */
const perDistanceColumns = (what: string): Column[] => [
  { key: "distanceCm", label: "이동 거리(cm)" },
  { key: "초록색 자동차", label: `초록색 자동차 ${what}(초)`, format: fixed1 },
  { key: "노란색 자동차", label: `노란색 자동차 ${what}(초)`, format: fixed1 },
];

const recordColumns = (withTrial: boolean): Column[] => [
  { key: "car", label: "자동차" },
  { key: "distanceCm", label: "이동 거리(cm)" },
  ...(withTrial ? [{ key: "trial", label: "회" }] : []),
  { key: "time", label: "걸린 시간(초)", format: fixed1 },
  { key: "stopwatch", label: "초시계 표시(초)", format: fixed1 },
];

function averagesRows(d: Detail): number {
  const a = getPath(d, "averages");
  return Array.isArray(a) ? a.length : 0;
}

function slimItems(withTrial: boolean, tableKey: "times" | "averages"): ItemSpec[] {
  return [
    textItem(
      "predict",
      "q1",
      "predict.q1",
      "태엽 자동차 두 대가 출발선에서 결승선까지 같은 거리를 이동해요. 어느 자동차가 더 빠른지 알려면 무엇을 측정하면 좋을까요?",
      { label: "예상" },
    ),
    tableItem("experiment", "records", "records", "100 cm를 이동하는 데 걸린 시간 측정 기록", recordColumns(withTrial), { label: "측정 기록" }),
    tableItem(
      "experiment",
      tableKey,
      tableKey,
      tableKey === "times" ? "자동차별 걸린 시간(내 기록표)" : "자동차별 평균 걸린 시간(내 기록표)",
      perDistanceColumns(tableKey === "times" ? "걸린 시간" : "평균"),
      { label: "내 기록표" },
    ),
    choiceItem("analyze", "q1", "analysis.q1", "내 기록표를 보세요. 두 자동차 가운데 더 빠른 자동차는 어느 것인가요?", {
      label: "분석 1",
      options: CAR_OPTIONS,
      note: SELF_GRADED,
    }),
    choiceItem("analyze", "q2", "analysis.q2", "그렇게 판단한 까닭으로 가장 알맞은 것은 무엇인가요?", {
      label: "분석 2",
      options: [
        "같은 거리를 이동하는 데 걸린 시간이 더 짧기 때문이에요.",
        "같은 거리를 이동하는 데 걸린 시간이 더 길기 때문이에요.",
        "결승선을 지나 더 멀리 가서 멈췄기 때문이에요.",
      ],
    }),
    textItem("conclude", "conclusion", "conclusion", "같은 거리를 이동한 물체의 빠르기는 어떻게 비교할 수 있나요? 내 실험 결과를 떠올리며 정리해 보세요.", {
      label: "결론",
    }),
    textItem("conclude", "curiosity", "curiosity", "(선택) 더 알아보고 싶은 점이나 궁금한 점이 있으면 한 줄로 적어요. 비워도 마칠 수 있어요.", {
      label: "궁금한 점(선택)",
    }),
  ];
}

export const schema: ResponseSchema = {
  appId: "sci-6-1-2-4",
  kind: "sim",
  standard: "slim",
  // detail.qa는 v4 저장 모양에 qa 한 필드만 더한 것이라 같은 앱 버전으로 본다(질문별 보기에서 함께 묶임).
  qaVersion: "v4",
  stages: STAGES_NOW,
  notes: ["결론은 '제출' 전 입력 중이던 글이 저장됐을 수 있어요(실험 앱 공통)."],
  variants: [
    {
      id: "v4",
      label: "측정 1회 버전(v4)",
      match: (d) => has(d, "times") || (!has(d, "averages") && !has(d, "extension") && !has(d, "apply")),
      items: slimItems(false, "times"),
    },
    {
      id: "v1",
      label: "개정 전 버전(v1)",
      match: (d) => has(d, "extension") || has(d, "apply") || averagesRows(d) > 1,
      items: [
        textItem("predict", "q1", "predict.q1", "수영 경기를 본 적이 있나요? 수영 경기에서는 선수들의 순위를 어떻게 정할까요?", { label: "질문 1" }),
        textItem(
          "predict",
          "q2",
          "predict.q2",
          "출발선에서 같은 거리를 이동한 두 태엽 자동차 중 어느 것이 더 빠른지, 무엇을 측정하면 알 수 있을까요?",
          { label: "질문 2" },
        ),
        tableItem("experiment", "records", "records", "거리별 걸린 시간 측정 기록", recordColumns(true), { label: "측정 기록" }),
        tableItem("experiment", "averages", "averages", "거리별 두 자동차의 평균 걸린 시간", perDistanceColumns("평균"), { label: "평균" }),
        choiceItem("analyze", "q1", "analysis.q1", "같은 거리를 이동한 물체는 걸린 시간이 어떠할수록 더 빠를까요?", {
          label: "분석 1",
          options: ["걸린 시간이 길수록", "걸린 시간이 짧을수록", "걸린 시간과 빠르기는 관계없다"],
        }),
        choiceItem("analyze", "q2", "analysis.q2", "내 기록에서 이동 거리가 100 cm일 때, 초록색 자동차와 노란색 자동차 중 어느 자동차가 더 빠른가요?", {
          label: "분석 2",
          options: ["초록색 자동차", "노란색 자동차", "두 자동차의 빠르기가 같다"],
          note: SELF_GRADED,
        }),
        choiceItem(
          "analyze",
          "q3",
          "analysis.q3",
          "표에서 50 cm, 100 cm, 150 cm마다 두 자동차의 평균 걸린 시간을 비교해 보세요. 걸린 시간이 더 짧았던 자동차가 이동 거리에 따라 바뀌었나요?",
          {
            label: "분석 3",
            options: ["거리마다 달랐다", "바뀌지 않았다(세 거리 모두 같은 자동차였다)", "알 수 없다"],
            note: "정답은 이 학생 자신의 기록으로 채점했어요.",
          },
        ),
        choiceItem(
          "analyze",
          "q4",
          "analysis.q4",
          "친구 세 명이 50 m 달리기를 했어요. 1위를 한 친구는 8초, 2위는 9초, 3위는 10초가 걸렸어요. 1위를 한 친구가 가장 빠르다고 말할 수 있는 까닭은 무엇일까요?",
          {
            label: "분석 4",
            options: ["출발선에 가장 먼저 섰기 때문에", "50 m를 이동하는 데 걸린 시간이 가장 길기 때문에", "50 m를 이동하는 데 걸린 시간이 가장 짧기 때문에"],
          },
        ),
        choiceItem(
          "analyze",
          "q5",
          "analysis.q5",
          "선수들의 100 m 달리기 기록이에요. ㈎ 17초, ㈏ 20초, ㈐ 18초, ㈑ 19초. 가장 빠른 선수와 가장 느린 선수를 순서대로 고르세요.",
          {
            label: "분석 5",
            options: [
              "가장 빠른 선수 ㈏, 가장 느린 선수 ㈎",
              "가장 빠른 선수 ㈐, 가장 느린 선수 ㈑",
              "가장 빠른 선수 ㈑, 가장 느린 선수 ㈐",
              "가장 빠른 선수 ㈎, 가장 느린 선수 ㈏",
            ],
          },
        ),
        textItem("conclude", "conclusion", "conclusion", "같은 거리를 이동한 물체의 빠르기를 비교하는 방법을 정리해 봅시다.", { label: "결론" }),
        textItem(
          "conclude",
          "apply",
          "apply",
          "쇼트트랙과 100 m 달리기에서 선수들의 빠르기를 비교해 순위를 정하는 공통적인 방법을 '출발선', '결승선', '걸린 시간'이라는 세 낱말을 모두 사용해 써 보세요. 그리고 이런 방법으로 순위를 정하는 운동 종목을 더 찾아 적어 보세요.",
          { label: "생활 속 적용" },
        ),
        textItem(
          "conclude",
          "ext1",
          "extension.q1",
          "새 파란색 태엽 자동차를 같은 방법으로 재었더니 100 cm를 이동하는 데 5.0초가 걸렸어요. 내 기록표의 100 cm 평균값과 비교해 초록색·노란색·파란색 자동차를 빠른 것부터 순서대로 쓰고, 그렇게 정한 까닭을 내 기록의 값을 들어 써 보세요.",
          { label: "발전 질문 1" },
        ),
        textItem(
          "conclude",
          "ext2",
          "extension.q2",
          "다른 모둠은 같은 초록색 자동차가 100 cm를 이동하는 데 4.3초가 걸렸다고 해요. 내 기록표를 보면, 같은 자동차를 같은 거리에서 재어도 잴 때마다 걸린 시간이 조금씩 달랐나요? 실제 실험에서 이렇게 조금씩 달라지는 까닭을 생각해 쓰고, 그래도 초록색 자동차가 노란색 자동차보다 빠르다고 말할 수 있는지 내 기록을 들어 설명해 보세요.",
          { label: "발전 질문 2" },
        ),
        textItem("curiosity", "curiosity", "curiosity", "이번 실험을 하면서 더 알아보고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
    {
      id: "v3",
      label: "개정 버전(v2·v3, 3회 측정 평균)",
      match: (d) => has(d, "averages"),
      items: slimItems(true, "averages"),
    },
  ],
};
