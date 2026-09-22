import { choiceItem, customItem, fixed1, has, isObj, tableItem, textItem, type Column } from "./helpers";
import type { Answer, ResponseSchema } from "./types";

/**
 * sci-6-1-2-5 물체의 빠르기를 속력으로 비교해 보자! (sim · 새 기준)
 * 출처: public/apps/sci-6-1-2-5/app.js buildDetail(), data/lesson-config.js (+ git 이력의 이전 버전)
 *
 * 2026-09-22부터 새로 저장되는 결과에는 detail.qa가 함께 들어가 그것을 먼저 쓴다. 이 매핑은 qa가 없는 예전 결과용이다.
 *  - v3·v4(개정): records[{car,distance,time,speed}](car는 id, speed는 저장 전에 소수 첫째 자리로 반올림), examples[](교과서 예시로 채운 자동차 id),
 *    analysis.order·units, conclusion, curiosity(선택, 정리하기 화면 안 한 줄)
 *  - v1(개정 전): transports{id:{speed,tries}}, order{cars,transports}, compare, analysis.meaning·units, extension{q1,q2}
 */

const CARS: Record<string, string> = {
  red: "빨간색 자동차",
  blue: "파란색 자동차",
  green: "초록색 자동차",
  yellow: "노란색 자동차",
};

const TRANSPORTS: Record<string, string> = { bike: "자전거", car: "자동차", train: "기차", ship: "배", plane: "비행기" };

const recordColumns: Column[] = [
  { key: "car", label: "자동차", map: CARS },
  { key: "distance", label: "이동 거리(cm)", format: fixed1 },
  { key: "time", label: "걸린 시간(초)", format: fixed1 },
  { key: "speed", label: "속력(cm/s)", format: fixed1 },
];

/** 순서 맞추기 결과 { order: [라벨…], correct, tries } → 보기 고르기처럼 */
function orderAnswer(v: unknown): Answer | null {
  if (v == null) return null;
  if (!isObj(v) || !Array.isArray(v.order)) return { kind: "raw", value: v };
  return {
    kind: "choice",
    chosen: [v.order.map((x) => String(x)).join(" → ")],
    correct: typeof v.correct === "boolean" ? v.correct : null,
    tries: typeof v.tries === "number" ? v.tries : null,
  };
}

export const schema: ResponseSchema = {
  appId: "sci-6-1-2-5",
  kind: "sim",
  standard: "slim",
  // detail.qa는 v3 저장 모양에 qa 한 필드만 더한 것이라 같은 앱 버전으로 본다(질문별 보기에서 함께 묶임).
  qaVersion: "v3",
  stages: [
    { id: "predict", label: "예상하기" },
    { id: "experiment", label: "실험하기" },
    { id: "analyze", label: "기록·분석하기" },
    { id: "conclude", label: "정리하기" },
  ],
  notes: ["결론은 '제출' 전 입력 중이던 글이 저장됐을 수 있어요(실험 앱 공통).", "기록 표의 속력은 저장할 때 이미 소수 첫째 자리로 반올림된 값이에요."],
  variants: [
    {
      id: "v3",
      label: "개정 버전(v3·v4)",
      match: (d) => !has(d, "extension") && !has(d, "transports") && !has(d, "order"),
      items: [
        textItem("predict", "q1", "predict.q1", "반대 방향으로 이동하는 두 자동차의 빠르기는 어떻게 비교할 수 있을까요? 내 생각을 적어 봅시다.", { label: "예상" }),
        tableItem("experiment", "records", "records", "직접 측정·계산한 자동차의 이동 거리 · 걸린 시간 · 속력", recordColumns, { label: "기록 표" }),
        customItem(
          "experiment",
          "examples",
          "교과서 예시 값으로 표를 채운 자동차",
          ["examples"],
          (d) => {
            const v = d.examples;
            if (!Array.isArray(v)) return v == null ? null : { kind: "raw", value: v };
            return { kind: "value", text: v.length ? v.map((id) => CARS[String(id)] ?? String(id)).join(", ") : "없음" };
          },
          { label: "예시 값" },
        ),
        choiceItem("analyze", "order", "analysis.order", "기록 표를 보고, 네 자동차를 빠른 순서대로 나타낸 것을 골라 봅시다.", {
          label: "분석 1",
          options: ["빨강 → 파랑 → 노랑 → 초록", "노랑 → 초록 → 파랑 → 빨강", "빨강 → 파랑 → 초록 → 노랑"],
        }),
        choiceItem("analyze", "units", "analysis.units", "파란색 자동차는 24.4 cm/s, 자전거(교통수단 표)는 20.0 km/h예요. 알맞은 설명을 골라 봅시다.", {
          label: "분석 2",
          // v3와 v4는 저장 모양이 같아 구분할 수 없다(review L5). v3 학생 화면에는 "20 km/h"로 보였다 — 보기·정답은 같다.
          note: "2026-09-22 오후 개정(v4) 전에 한 학생은 이 질문을 '20 km/h'로 보았어요(보기와 정답은 같아요).",
          options: ["숫자가 크니까 파란색 자동차가 더 빠르다.", "단위가 달라서 숫자만 보고 비교할 수 없다.", "숫자가 작으니까 자전거가 더 빠르다."],
        }),
        textItem("conclude", "conclusion", "conclusion", "물체의 빠르기를 속력으로 비교하는 방법을 설명해 봅시다.", { label: "결론" }),
        textItem("conclude", "curiosity", "curiosity", "(선택) 속력에 대해 더 알아보고 싶은 점이 있으면 한 줄로 적어 봅시다.", { label: "궁금한 점(선택)" }),
      ],
    },
    {
      id: "v1",
      label: "개정 전 버전(v1)",
      match: () => true,
      items: [
        textItem("predict", "q1", "predict.q1", "반대 방향으로 이동하는 두 자동차의 빠르기는 어떻게 비교할 수 있을까요? 내 생각을 적어 봅시다.", { label: "예상" }),
        tableItem("experiment", "records", "records", "자동차의 이동 거리 · 걸린 시간 · 속력", recordColumns, { label: "기록 표" }),
        customItem(
          "experiment",
          "transports",
          "교통수단의 속력 구하기",
          ["transports"],
          (d) => {
            const v = d.transports;
            if (v == null) return null;
            if (!isObj(v)) return { kind: "raw", value: v };
            return {
              kind: "table",
              columns: [
                { key: "name", label: "교통수단" },
                { key: "speed", label: "구한 속력(km/h)" },
                { key: "tries", label: "시도" },
              ],
              rows: Object.entries(v).map(([id, x]) => ({
                name: TRANSPORTS[id] ?? id,
                speed: isObj(x) && typeof x.speed === "number" ? String(x.speed) : "—",
                tries: isObj(x) && typeof x.tries === "number" ? `${x.tries}번` : "—",
              })),
            };
          },
          { label: "교통수단" },
        ),
        choiceItem("analyze", "meaning", "analysis.meaning", "빨간색 자동차의 속력 27.0 cm/s에 대한 설명으로 알맞은 것은 무엇일까요?", {
          label: "분석 1",
          options: [
            "1초마다 이동한 거리를 한 번씩 재어 보니 매 초마다 정확히 27.0 cm씩 이동했다는 뜻이다.",
            "5초 동안 이동한 전체 거리를 걸린 시간으로 나누어 구한, 평균적인 빠르기라는 뜻이다.",
            "5초 동안 이동한 전체 거리가 27.0 cm라는 뜻이다.",
          ],
        }),
        choiceItem(
          "analyze",
          "units",
          "analysis.units",
          "민재는 “10 km/h로 달리는 물체가 5 m/s로 달리는 물체보다 숫자가 크니까 더 빨라.”라고 말했어요. 민재의 생각에 대한 설명으로 알맞은 것은 무엇일까요?",
          {
            label: "분석 2",
            options: [
              "맞다. 속력은 단위와 상관없이 숫자가 클수록 빠르다.",
              "알맞지 않다. 속력은 숫자가 작을수록 빠르다.",
              "알맞지 않다. 단위가 다르므로 숫자만 보고 바로 비교할 수 없고, 단위를 같게 맞춰야 비교할 수 있다.",
            ],
          },
        ),
        customItem("analyze", "order.cars", "태엽 자동차의 빠르기를 속력으로 비교해 빠른 순서대로 써 봅시다.", ["order"], (d) =>
          orderAnswer(isObj(d.order) ? d.order.cars : undefined),
          { label: "순서 1" },
        ),
        customItem("analyze", "order.transports", "교통수단을 빠른 순서대로 써 봅시다.", ["order"], (d) =>
          orderAnswer(isObj(d.order) ? d.order.transports : undefined),
          { label: "순서 2" },
        ),
        textItem("analyze", "compare", "compare", "교통수단 중 두 가지를 골라 빠르기를 속력으로 비교해 써 봅시다.", { label: "비교하기" }),
        textItem("conclude", "conclusion", "conclusion", "물체의 빠르기를 속력으로 비교하는 방법을 설명해 봅시다.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "자동차의 빠르기를 속력으로 나타내면 어떤 점이 편리할지 이야기해 봅시다.", { label: "발전 질문 1" }),
        textItem(
          "conclude",
          "ext2",
          "extension.q2",
          "타조는 5초에 110 m를, 갈매기는 2초에 80 m를 이동합니다. 두 동물의 속력을 구해 단위와 함께 바르게 읽어 보고, 빠르기를 비교해 봅시다.",
          { label: "발전 질문 2" },
        ),
        textItem("curiosity", "curiosity", "curiosity", "속력에 대해 더 알아보고 싶은 점(또는 궁금한 점)을 적어 봅시다.", { label: "궁금한 점" }),
      ],
    },
  ],
};
