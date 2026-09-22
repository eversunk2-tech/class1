import { cell, choiceItem, customItem, entriesItem, getPath, isObj, tableItem, textItem } from "./helpers";
import type { Answer, Detail, ResponseSchema } from "./types";

/**
 * sci-6-1-2-2 물체의 운동을 표현해 볼까? (sim · 이전 기준)
 * 출처: public/apps/sci-6-1-2-2/app.js buildDetail(), positionDetail(), data/lesson-config.js
 * detail: predict{q1,q2}, records[{from,to(꽃 이름),seconds,sentence|null,recordedAt(ms)}],
 *         positions{꽃 이름: {ok, wrongTries}}(예시 꽃 수선화꽃 제외), directions{"제비꽃→유채꽃": 초},
 *         countRetries{"수선화꽃~제비꽃": 걸린 시간을 틀린 횟수}, analysis.{q1..q4}(라벨), conclusion, extension{q1,q2}, curiosity
 */

const timeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function recordedTime(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? timeFormatter.format(new Date(v)) : "—";
}

/** positions: { 꽃 이름: { ok, wrongTries } } → 표 */
function positionsAnswer(d: Detail): Answer | null {
  const v = getPath(d, "positions");
  if (v === undefined || v === null) return null;
  if (!isObj(v)) return { kind: "raw", value: v };
  return {
    kind: "table",
    columns: [
      { key: "flower", label: "꽃" },
      { key: "ok", label: "바르게 나타냈나요?" },
      { key: "wrongTries", label: "틀린 횟수" },
    ],
    rows: Object.entries(v).map(([flower, st]) => {
      const o = isObj(st) ? st : {};
      return {
        flower,
        ok: typeof o.ok === "boolean" ? (o.ok ? "예" : "아니요") : cell(o.ok),
        wrongTries: typeof o.wrongTries === "number" ? `${o.wrongTries}번` : cell(o.wrongTries),
      };
    }),
  };
}

export const schema: ResponseSchema = {
  appId: "sci-6-1-2-2",
  kind: "sim",
  standard: "legacy",
  stages: [
    { id: "predict", label: "예상하기" },
    { id: "experiment", label: "실험하기" },
    { id: "analyze", label: "기록·분석하기" },
    { id: "conclude", label: "정리하기" },
    { id: "curiosity", label: "궁금한 점" },
  ],
  notes: [
    "정리하기 답은 '제출' 전 입력 중이던 글이 저장됐을 수 있어요(실험 앱 공통).",
    "꽃 위치 나타내기는 학생이 적은 방향·칸 수가 아니라 맞혔는지와 틀린 횟수만 저장돼요(수선화꽃은 예시라 빠져요).",
    "기록은 '확인하기'(걸린 시간·문장 확인)를 통과한 것만 남아요. 같은 꽃 짝은 방향을 바꾸어 다시 기록하면 마지막 기록만 남고, 두 방향의 시간은 '방향별 시간'에 따로 남아요.",
  ],
  variants: [
    {
      id: "v1",
      label: "현재 버전",
      match: () => true,
      items: [
        textItem("predict", "q1", "predict.q1", "미끄럼틀을 타는 곰의 위치는 어떻게 바뀌었을지, 그 변화를 어떻게 표현하면 좋을지 자유롭게 적어 보세요.", { label: "질문 1" }),
        textItem("predict", "q2", "predict.q2", "오늘 하루 여러분이 이동했던 모습 한 가지를 떠올려, 어디에서 어디로 움직였는지 자유롭게 적어 보세요.", { label: "질문 2" }),
        customItem("experiment", "positions", "분수를 기준으로 꽃의 위치 나타내기(방향과 떨어진 칸 수)", ["positions"], positionsAnswer, { label: "꽃 위치" }),
        tableItem("experiment", "records", "records", "꿀벌이 이동하는 데 몇 초가 걸렸는지 적고, 꿀벌의 운동을 아래 예처럼 한 문장으로 써 보세요.", [
          { key: "from", label: "처음 위치" },
          { key: "to", label: "나중 위치" },
          { key: "seconds", label: "걸린 시간(초)" },
          { key: "sentence", label: "내가 쓴 꿀벌의 운동 문장" },
          { key: "recordedAt", label: "기록 시각", format: (v) => recordedTime(v) },
        ], { label: "관찰 기록" }),
        entriesItem("experiment", "directions", "directions", "방향별 걸린 시간(출발 꽃과 도착 꽃을 바꾸어 반대 방향으로도 움직여 본 결과)", {
          key: "출발 꽃 → 도착 꽃",
          value: "걸린 시간",
          format: (v) => (typeof v === "number" ? `${v}초` : cell(v)),
        }, { label: "방향별 시간" }),
        entriesItem("experiment", "countRetries", "countRetries", "꽃 짝별로 걸린 시간을 잘못 적어 '확인하기'에서 틀린 횟수", {
          key: "꽃 짝",
          value: "틀린 횟수",
          format: (v) => (typeof v === "number" ? `${v}번` : cell(v)),
        }, { label: "걸린 시간 틀린 횟수" }),
        choiceItem("analyze", "q1", "analysis.q1", "다음 중 물체의 운동을 빠짐없이 표현한 문장은 무엇일까요?", {
          label: "분석 1",
          options: ["공이 데굴데굴 굴러갔다.", "강아지는 20초 동안 대문에서 마당으로 이동했다.", "배는 3시간 동안 이동했다.", "고양이는 거실에서 부엌으로 갔다."],
        }),
        choiceItem("analyze", "q2", "analysis.q2", "내가 기록한 표와 막대그래프를 보세요. 꿀벌이 이동하는 데 걸린 시간이 가장 긴 꽃 짝은 무엇일까요?", {
          label: "분석 2",
          options: ["수선화꽃과 유채꽃", "제비꽃과 유채꽃", "수선화꽃과 진달래꽃", "유채꽃과 진달래꽃"],
        }),
        choiceItem("analyze", "q3", "analysis.q3", "출발 꽃과 도착 꽃을 서로 바꾸어 꿀벌을 반대 방향으로 움직이면 어떻게 될까요?", {
          label: "분석 3",
          options: [
            "걸린 시간이 두 배가 되고, 문장은 그대로이다.",
            "걸린 시간도 같고, 문장도 똑같다.",
            "걸린 시간은 같고, 문장의 처음 위치와 나중 위치가 서로 바뀐다.",
            "걸린 시간이 달라지고, 처음 위치와 나중 위치는 그대로이다.",
          ],
        }),
        choiceItem("analyze", "q4", "analysis.q4", "물체의 운동을 표현할 때 반드시 있어야 하는 것을 모두 고르세요.", {
          label: "분석 4",
          options: ["물체의 색깔", "걸린 시간", "물체의 무게", "처음 위치", "나중 위치"],
        }),
        textItem("conclude", "conclusion", "conclusion", "물체의 운동을 표현하는 방법을 정리해 적어 보세요.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "꿀벌이 제비꽃에서 출발해 유채꽃에 들렀다가, 쉬지 않고 바로 진달래꽃까지 날아갔어요. 내가 기록한 걸린 시간을 이용해 꿀벌의 이 운동을 한 문장으로 표현해 보세요.", { label: "발전 질문 1" }),
        textItem("conclude", "ext2", "extension.q2", "아래 그림을 보고 버스의 운동을 한 문장으로 표현해 보세요.", {
          label: "발전 질문 2",
          note: "그림: 버스가 '처음'에는 가 정류장, '5분 뒤'에는 나 정류장에 있어요.",
        }),
        textItem("curiosity", "curiosity", "curiosity", "물체의 운동을 표현하는 방법에 대해 더 탐구하고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
