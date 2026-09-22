import { choiceItem, tableItem, textItem } from "./helpers";
import type { ResponseSchema } from "./types";

/**
 * sci-6-1-1-3 산성 용액과 염기성 용액의 성질을 비교해 볼까? (sim · 이전 기준)
 * 출처: public/apps/sci-6-1-1-3/app.js buildDetail(), data/lesson-config.js
 * detail: predict{q1,q2}, records[{solution,material,result,recordedAt}](solution·material은 이미 이름),
 *         analysis.q1..q4, conclusion, extension{q1,q2}, curiosity
 */

export const schema: ResponseSchema = {
  appId: "sci-6-1-1-3",
  kind: "sim",
  standard: "legacy",
  stages: [
    { id: "predict", label: "예상하기" },
    { id: "experiment", label: "실험하기" },
    { id: "analyze", label: "기록·분석하기" },
    { id: "conclude", label: "정리하기" },
    { id: "curiosity", label: "궁금한 점" },
  ],
  notes: ["정리하기 답은 '제출' 전 입력 중이던 글이 저장됐을 수 있어요(실험 앱 공통)."],
  variants: [
    {
      id: "v1",
      label: "현재 버전",
      match: () => true,
      items: [
        textItem("predict", "q1", "predict.q1", "산성 용액과 염기성 용액은 어떤 성질을 가지고 있을까요? 알고 있는 것을 자유롭게 적어 보세요.", { label: "질문 1" }),
        textItem("predict", "q2", "predict.q2", "산성 용액인 식초에 달걀을 일주일 정도 담가 두면 달걀 껍데기는 어떻게 될까요? 그렇게 생각한 까닭도 적어 보세요.", { label: "질문 2" }),
        tableItem("experiment", "records", "records", "네 가지 물질을 두 가지 용액에 넣고 관찰한 변화 기록", [
          { key: "solution", label: "용액" },
          { key: "material", label: "물질" },
          { key: "result", label: "관찰 결과" },
        ], { label: "관찰 기록" }),
        choiceItem("analyze", "q1", "analysis.q1", "달걀 껍데기를 넣었을 때 기포가 발생하며 녹은 용액은 어느 것일까요?", {
          label: "분석 1",
          options: ["산성 용액인 묽은 염산", "염기성 용액인 묽은 수산화 나트륨 용액", "두 용액 모두", "두 용액 모두 아님"],
        }),
        choiceItem("analyze", "q2", "analysis.q2", "다음 중 넣었을 때 반응이 일어나는(녹는) 짝을 모두 고르세요.", {
          label: "분석 2",
          options: [
            "묽은 염산 + 달걀 껍데기",
            "묽은 염산 + 조개껍데기",
            "묽은 염산 + 삶은 닭 가슴살",
            "묽은 수산화 나트륨 용액 + 삶은 달걀흰자",
            "묽은 수산화 나트륨 용액 + 달걀 껍데기",
          ],
        }),
        choiceItem("analyze", "q3", "analysis.q3", "산성 용액이 달걀 껍데기와 조개껍데기를 녹이는 까닭은 무엇일까요?", {
          label: "분석 3",
          options: [
            "달걀 껍데기와 조개껍데기의 주요 성분인 탄산 칼슘과 산성 용액이 반응하기 때문",
            "달걀 껍데기와 조개껍데기가 원래 잘 부서지는 재료이기 때문",
            "산성 용액의 냄새 때문",
          ],
        }),
        choiceItem("analyze", "q4", "analysis.q4", "묽은 염산에 조개껍데기와 같은 성분(탄산 칼슘)으로 된 대리암 조각을 넣으면 어떻게 될까요?", {
          label: "분석 4",
          options: ["기포가 발생하며 녹는다", "변화가 없다", "흐물흐물해진다"],
        }),
        textItem("conclude", "conclusion", "conclusion", "실험 결과를 바탕으로 산성 용액과 염기성 용액의 성질을 각각 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "머리카락의 주요 성분은 단백질이에요. 머리카락 때문에 막힌 하수구를 뚫으려면 산성 용액과 염기성 용액 중 어느 용액을 쓰는 것이 좋을지, 그 까닭도 함께 적어 보세요.", { label: "발전 질문 1" }),
        textItem("conclude", "ext2", "extension.q2", "식초(산성 용액)에 메추리알을 넣으면 어떤 변화가 나타날지, 그 까닭까지 적어 보세요.", { label: "발전 질문 2" }),
        textItem("curiosity", "curiosity", "curiosity", "산성 용액과 염기성 용액에 대해 더 탐구하고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
