import { choiceItem, fixed1, getPath, has, hintsText, isObj, tableItem, textItem, valueItem } from "./helpers";
import type { Detail, ResponseSchema } from "./types";

/**
 * sci-6-1-2-3 같은 시간 동안 이동한 물체의 빠르기를 비교해 보자! (sim · 새 기준)
 * 출처: public/apps/sci-6-1-2-3/app.js buildDetail(), data/lesson-config.js (+ git 이력의 이전 버전)
 *
 * 2026-09-22부터 새로 저장되는 결과에는 detail.qa(질문-답 표준 목록)가 함께 들어가 그것을 먼저 쓴다.
 * 이 매핑은 qa가 없는 예전 결과용이다. 저장 모양이 세 번 바뀌었다.
 *  - v4(sci612sim3:v4, 측정 1회·소수 첫째 자리): records[{time,red,blue}], predict.q1, analysis.q1·q2, conclusion, curiosity(선택)
 *  - v2·v3(개정, 질문 축소): records[{time,red,blue,photo:{red,blue}}] — 사진 속 실제 거리(photo)가 함께 있음. 문구의 "5초"
 *  - v1(개정 전): records[{car,time,trial,distance,photo}], predict.q1·q2, analysis.q1~q6, myCompare, extension{q1,q2}, curiosity(필수)
 */

const CARS: Record<string, string> = { red: "빨간색 자동차", blue: "파란색 자동차" };

const STAGES_NOW = [
  { id: "predict", label: "예상하기" },
  { id: "experiment", label: "실험하기" },
  { id: "analyze", label: "기록·분석하기" },
  { id: "conclude", label: "정리하기" },
];

const Q1_OPTIONS = ["빨간색 자동차", "파란색 자동차", "둘의 빠르기는 같다"];
const SELF_GRADED = "정답은 이 학생 자신의 기록(더 긴 거리를 이동한 자동차)으로 채점했어요.";

function firstRecord(d: Detail): Record<string, unknown> | null {
  const r = getPath(d, "records");
  return Array.isArray(r) && isObj(r[0]) ? r[0] : null;
}

/** 분석 답의 보기 문구에 남은 시간 표기("5" 또는 "5.0"). 없으면 null */
function chosenMarker(d: Detail): "5" | "5.0" | null {
  const a = getPath(d, "analysis");
  if (!isObj(a)) return null;
  for (const q of Object.values(a)) {
    const list = isObj(q) && Array.isArray(q.choice) ? q.choice : [];
    for (const c of list) {
      if (typeof c !== "string") continue;
      if (c.includes("같은 5.0초")) return "5.0";
      if (c.includes("같은 5초")) return "5";
    }
  }
  return null;
}

/** 개정 후(v2~v4): 한 번 달려 두 자동차 거리를 한 줄에 기록 */
function slimVariant(id: string, label: string, sec: string, withPhoto: boolean) {
  return {
    id,
    label,
    match: (d: Detail) => {
      if (has(d, "extension") || has(d, "myCompare")) return false;
      const r = firstRecord(d);
      if (r && "car" in r) return false;
      if (r) return withPhoto ? "photo" in r : !("photo" in r);
      // 기록이 비어 있으면 photo로 가를 수 없다(review L12). 분석 2에서 고른 보기 문구로 가른다: v2·v3 "같은 5초", v4 "같은 5.0초".
      const marker = chosenMarker(d);
      if (marker) return withPhoto ? marker === "5" : marker === "5.0";
      return !withPhoto;
    },
    items: [
      textItem(
        "predict",
        "q1",
        "predict.q1",
        `태엽 자동차 두 대를 동시에 출발시켜 같은 시간(${sec}초) 동안 달리게 했어요. 어느 자동차가 더 빠른지 어떻게 알아낼 수 있을까요? 그렇게 생각한 까닭도 함께 적어 보세요.`,
        { label: "예상" },
      ),
      valueItem("predict", "hintsOpened", "hintsOpened", "열어 본 힌트 수", hintsText, { label: "힌트" }),
      tableItem(
        "experiment",
        "records",
        "records",
        `${sec}초 동안 두 자동차가 이동한 거리`,
        [
          { key: "time", label: "관찰 시간(초)", format: fixed1 },
          { key: "red", label: "빨간색 자동차(cm)", format: fixed1 },
          { key: "blue", label: "파란색 자동차(cm)", format: fixed1 },
          ...(withPhoto
            ? [
                {
                  key: "photo",
                  label: "사진 속 실제 거리(빨강 / 파랑, cm)",
                  format: (v: unknown) => (isObj(v) ? `${fixed1(v.red)} / ${fixed1(v.blue)}` : "—"),
                },
              ]
            : []),
        ],
        { label: "내 기록" },
      ),
      choiceItem("analyze", "q1", "analysis.q1", `내 기록에서 ${sec}초 동안 더 빠른 자동차는 어느 것인가요?`, {
        label: "분석 1",
        options: Q1_OPTIONS,
        note: SELF_GRADED,
      }),
      choiceItem("analyze", "q2", "analysis.q2", "그렇게 판단할 수 있는 까닭으로 가장 알맞은 것은 무엇인가요?", {
        label: "분석 2",
        options: [
          `같은 ${sec}초 동안 이동한 거리가 더 길기 때문이에요.`,
          "다 달리고 멈춘 곳이 출발선에서 더 멀기 때문이에요.",
          "자동차의 색깔이 더 빨라 보이는 색이기 때문이에요.",
        ],
      }),
      textItem("conclude", "conclusion", "conclusion", "내 실험 결과를 바탕으로, 같은 시간 동안 이동한 물체의 빠르기는 어떻게 비교할 수 있는지 써 보세요.", {
        label: "결론",
      }),
      textItem("conclude", "curiosity", "curiosity", "더 탐구하고 싶은 점이나 궁금한 점이 있으면 한 줄로 적어 보세요. (비워 두어도 마칠 수 있어요)", {
        label: "궁금한 점(선택)",
      }),
    ],
  };
}

const LETTERS = ["㉠", "㉡", "㉢", "㉣"];

export const schema: ResponseSchema = {
  appId: "sci-6-1-2-3",
  kind: "sim",
  standard: "slim",
  // detail.qa는 v4 저장 모양에 qa 한 필드만 더한 것이라 같은 앱 버전으로 본다(질문별 보기에서 함께 묶임).
  qaVersion: "v4",
  stages: STAGES_NOW,
  notes: ["결론은 '제출' 전 입력 중이던 글이 저장됐을 수 있어요(실험 앱 공통)."],
  variants: [
    slimVariant("v4", "측정 1회 버전(v4)", "5.0", false),
    slimVariant("v3", "개정 버전(v2·v3, 사진 눈금 읽기)", "5", true),
    {
      id: "v1",
      label: "개정 전 버전(v1)",
      match: (d) => has(d, "extension") || has(d, "myCompare") || !!firstRecord(d)?.car,
      items: [
        textItem(
          "predict",
          "q1",
          "predict.q1",
          "땅속에서 두더지와 개미가 동시에 굴을 파기 시작해 동시에 땅 위로 나왔어요. 나와서 보니 두더지가 판 굴이 개미가 판 굴보다 훨씬 길었어요. 둘 중 어느 동물이 더 빠르다고 할 수 있을까요? 그렇게 생각한 까닭도 함께 적어 보세요.",
          { label: "질문 1" },
        ),
        textItem(
          "predict",
          "q2",
          "predict.q2",
          "태엽을 감아 움직이는 자동차 두 대를 동시에 출발시켜 같은 시간 동안 달리게 한다면, 어떤 자동차가 더 빠른지 어떻게 알아낼 수 있을까요?",
          { label: "질문 2" },
        ),
        valueItem("predict", "hintsOpened", "hintsOpened", "열어 본 힌트 수", hintsText, { label: "힌트" }),
        tableItem(
          "experiment",
          "records",
          "records",
          "관찰 시간별 이동 거리 기록",
          [
            { key: "car", label: "자동차", map: CARS },
            { key: "time", label: "관찰 시간(초)" },
            { key: "trial", label: "회" },
            { key: "distance", label: "이동 거리(cm)" },
            { key: "photo", label: "사진 속 실제 거리(cm)" },
          ],
          { label: "내 기록" },
        ),
        textItem(
          "analyze",
          "myCompare",
          "myCompare",
          "내 기록 표에서 5초 동안 두 자동차가 이동한 거리(평균)를 보고, 더 빠른 태엽 자동차는 어느 것인지와 그렇게 생각한 까닭을 내 기록의 수를 넣어 써 보세요.",
          { label: "내 기록으로 쓰기" },
        ),
        choiceItem("analyze", "q1", "analysis.q1", "5초 동안 빨간색 자동차는 135 cm, 파란색 자동차는 122 cm를 이동했어요. 어느 자동차가 더 빠른가요?", {
          label: "분석 1",
          options: Q1_OPTIONS,
        }),
        choiceItem(
          "analyze",
          "q2",
          "analysis.q2",
          "그림은 물체 ㉠~㉣이 같은 출발선에서 동시에 출발해 10초 동안 이동한 곳을 점(●)으로 나타낸 것이에요. 가장 빠른 물체는 어느 것인가요?",
          { label: "분석 2", options: LETTERS },
        ),
        choiceItem("analyze", "q3", "analysis.q3", "같은 그림에서 가장 느린 물체는 어느 것인가요?", { label: "분석 3", options: LETTERS }),
        choiceItem("analyze", "q4", "analysis.q4", "1시간 동안 ㈎ 기차는 150 km, ㈏ 기차는 120 km를 이동했어요. 어느 기차가 더 빠른가요?", {
          label: "분석 4",
          options: ["㈎ 기차", "㈏ 기차", "알 수 없다"],
        }),
        choiceItem(
          "analyze",
          "q5",
          "analysis.q5",
          "여러 대의 자동차가 각자 다른 때에 출발해 달리고 있어요. 지금 가장 앞에 있는 자동차가 가장 빠른 자동차라고 할 수 있을까요?",
          {
            label: "분석 5",
            options: ["그렇다, 앞에 있으니 가장 빠르다", "아니다, 동시에 출발하지 않았다면 알 수 없다", "자동차 색깔로 알 수 있다"],
          },
        ),
        choiceItem("analyze", "q6", "analysis.q6", "'무궁화꽃이 피었습니다' 놀이에서 술래에게 가장 먼저 도착하려면 어떻게 해야 할까요?", {
          label: "분석 6",
          options: [
            "술래가 구호를 외치는 동안 가장 긴 거리를 이동한다",
            "술래가 구호를 외치는 동안 가장 짧은 거리를 이동한다",
            "술래가 구호를 외치는 동안 움직이지 않는다",
          ],
        }),
        textItem("conclude", "conclusion", "conclusion", "실험 결과를 바탕으로, 같은 시간 동안 이동한 물체의 빠르기는 어떻게 비교할 수 있는지 써 보세요.", {
          label: "결론",
        }),
        textItem(
          "conclude",
          "ext1",
          "extension.q1",
          "아래 표를 보고 ① 가장 빠른 물체와 가장 느린 물체를 쓰세요. ② 한 친구가 이 표를 보고 \"송골매는 언제나 사람보다 약 10배 빠르게 움직여.\"라고 말했어요. 이 말이 옳은지, 표 아래의 안내를 읽고 까닭과 함께 써 보세요.",
          { label: "발전 질문 1" },
        ),
        textItem(
          "conclude",
          "ext2",
          "extension.q2",
          "사이클 단체 추발은 두 팀이 트랙의 서로 반대편에서 동시에 출발하는 경기예요. 동시에 출발했으니, 같은 시간 동안 더 긴 거리를 달린 팀이 상대 팀을 따라잡게 돼요(따라잡지 못하면 결승선까지 달린 기록으로 겨뤄요). 이처럼 같은 시간 동안 이동한 거리로 빠르기를 비교하는 모습을 운동 경기나 생활에서 하나 더 찾아 설명해 보세요.",
          { label: "발전 질문 2" },
        ),
        textItem("curiosity", "curiosity", "curiosity", "더 알아보고 싶은 점을 자유롭게 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
