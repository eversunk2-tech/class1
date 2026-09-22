import { choiceItem, tableItem, textItem, valueItem } from "./helpers";
import type { ResponseSchema } from "./types";

/**
 * sci-6-1-2-1 운동하는 물체의 특징을 찾아라! (sim · 이전 기준, lesson-config에 title 없음)
 * 출처: public/apps/sci-6-1-2-1/app.js buildDetail(), data/lesson-config.js
 * detail: predict{q1,q2}, records[{scene(장면 id A/B/C),object(이름),result(라벨),recordedAt(ms)}], analysis.{q0..q4}(라벨),
 *         conclusion, extension{q1,q2}, curiosity, safetyChecked(확인한 안전 약속 개수)
 */

const SCENES: Record<string, string> = {
  A: "교실 안",
  B: "바닷가",
  C: "공원",
};

const SAFETY_TOTAL = 5;

const timeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function recordedTime(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? timeFormatter.format(new Date(v)) : "—";
}

export const schema: ResponseSchema = {
  appId: "sci-6-1-2-1",
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
    "안전 약속은 무엇을 확인했는지가 아니라 확인한 개수만 저장돼요.",
  ],
  variants: [
    {
      id: "v1",
      label: "현재 버전",
      match: () => true,
      items: [
        textItem("predict", "q1", "predict.q1", "나무에 앉아 있던 새가 사진을 찍는 사이 날아갔어요. 새와 나무 중에서 어느 것이 운동하는 물체일지 예상해 보고, 그 까닭도 적어 보세요.", { label: "질문 1" }),
        textItem("predict", "q2", "predict.q2", "운동장에 놓여 있는 공을 차면 공이 굴러갑니다. 가만히 놓여 있는 공과 굴러가는 공 중에서 운동하는 물체는 어느 것일지 예상해 보고, 까닭도 적어 보세요.", { label: "질문 2" }),
        valueItem(
          "experiment",
          "safetyChecked",
          "safetyChecked",
          "교실과 창밖을 직접 사진 찍어 관찰할 때 지킬 약속을 몇 개 확인했나요?",
          (v) => (typeof v === "number" ? `${v}/${SAFETY_TOTAL}개` : null),
          { label: "안전 약속" },
        ),
        tableItem("experiment", "records", "records", "이 물체는 사진 1과 사진 2에서 같은 위치에 있나요, 다른 위치에 있나요?", [
          { key: "scene", label: "장면", map: SCENES },
          { key: "object", label: "물체" },
          { key: "result", label: "관찰 결과" },
          { key: "recordedAt", label: "기록 시각", format: (v) => recordedTime(v) },
        ], { label: "관찰 기록" }),
        choiceItem("analyze", "q0", "analysis.q0", "사진 1과 사진 2를 비교한 결과를 떠올려 보세요. 운동하는 물체는 시간이 지났을 때 어떤 위치에 있는 물체라고 할 수 있을까요?", {
          label: "분석 1",
          options: ["같은 위치", "다른 위치"],
        }),
        choiceItem("analyze", "q1", "analysis.q1", "다음 중 운동하는 물체를 모두 고르세요. (바닷가 장면)", {
          label: "분석 2",
          options: ["등대", "갈매기", "배", "산책하는 사람", "개", "바위"],
        }),
        choiceItem("analyze", "q2", "analysis.q2", "운동하는 물체와 운동하지 않는 물체를 구분하는 공통된 기준은 무엇인가요?", {
          label: "분석 3",
          options: ["물체의 크기가 큰지 작은지", "물체가 빠르게 움직이는지", "시간이 지남에 따라 물체의 위치가 변했는지", "물체의 색깔이 화려한지"],
        }),
        choiceItem("analyze", "q3", "analysis.q3", "놀이터에 굴러가는 공, 축구 골대, 미끄럼틀, 나무가 있어요. 이 가운데 운동하는 물체는 무엇인가요?", {
          label: "분석 4",
          options: ["미끄럼틀", "굴러가는 공", "나무", "축구 골대"],
        }),
        choiceItem("analyze", "q4", "analysis.q4", "철봉에 가만히 매달려 있는 것은 운동일까요?", {
          label: "분석 5",
          options: ["운동이 아니다", "운동이다", "매달려 있는 시간에 따라 다르다"],
        }),
        textItem("conclude", "conclusion", "conclusion", "관찰한 내용을 바탕으로, 운동하는 물체의 공통된 특징을 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "주차된 자동차는 운동하는 물체인가요, 아닌가요? 그 까닭과 함께 적어 보세요.", { label: "발전 질문 1" }),
        textItem("conclude", "ext2", "extension.q2", "실험 장면에 나오지 않은 우리 주변(학교, 집, 길 등)의 물체 가운데 운동하는 물체와 운동하지 않는 물체를 각각 두 가지 이상 적고, 그렇게 나눈 까닭을 적어 보세요.", { label: "발전 질문 2" }),
        textItem("curiosity", "curiosity", "curiosity", "물체의 운동에 대해 더 탐구하고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
