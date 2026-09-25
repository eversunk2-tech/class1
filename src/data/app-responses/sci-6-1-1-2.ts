import { choiceItem, groupsItem, tableItem, textItem } from "./helpers";
import type { ResponseSchema } from "./types";

/**
 * sci-6-1-1-2 지시약으로 여러 가지 용액을 분류해 볼까? (sim)
 * 출처: public/apps/sci-6-1-1-2/app.js buildDetail(), data/lesson-config.js (+ git 이력의 이전 버전)
 *
 * 2026-09-25 간략화(docs/science/sim-redesign/spec.md §1.4·개정 2)로 detail 모양이 두 가지다. 위에서부터 맞는 변형을 쓴다.
 *  - v2(간략화 후, 저장 키 sci611sim2:v2): questionSet: 2, predict{q1}, records[{phase,solution,indicator,result,recordedAt}]
 *        (indicator는 원본 id), classify{groups:{acid,base},correct,tries}, analysis.{q1,q4}(화면 번호는 "분석 1·2"),
 *        conclusion, curiosity('더 탐구하고 싶은 점' — 정리하기 안의 한 줄)
 *  - v1(간략화 전, 저장 키 sci611sim2:v1): predict{q1,q2}, records, classify, analysis.q1..q5, conclusion, extension{q1,q2},
 *        curiosity(따로 떨어진 5단계 '궁금한 점')
 * 실험(용액 × 지시약 24칸)과 분류하기는 두 판이 같다.
 */

const INDICATORS: Record<string, string> = {
  리트머스파랑: "푸른색 리트머스 시험지",
  리트머스빨강: "붉은색 리트머스 시험지",
  페놀프탈레인: "페놀프탈레인 용액",
  붉은양배추: "붉은 양배추 용액",
};

const PHASES: Record<string, string> = {
  A: "실험 A",
  B: "실험 B",
};

const BINS = [
  { id: "acid", label: "산성 용액" },
  { id: "base", label: "염기성 용액" },
];

const SOLUTIONS = ["식초", "레몬즙", "빨랫비누 물", "석회수", "묽은 염산", "묽은 수산화 나트륨 용액"];

export const schema: ResponseSchema = {
  appId: "sci-6-1-1-2",
  kind: "sim",
  standard: "slim",
  // 앱의 지금 단계(간략화 뒤 4단계). 간략화 전 기록의 '궁금한 점'(curiosity 단계)은 기본 이름 "궁금한 점"으로 맨 뒤에 모인다.
  stages: [
    { id: "predict", label: "예상하기" },
    { id: "experiment", label: "실험하기" },
    { id: "analyze", label: "기록·분석하기" },
    { id: "conclude", label: "정리하기" },
  ],
  notes: [
    "정리하기 답은 '제출' 전 입력 중이던 글이 저장됐을 수 있어요(실험 앱 공통).",
    "예상 질문 2·분석 질문 2·3·5·발전 질문 1·2와 따로 떨어진 '궁금한 점' 단계는 간략화 전(~2026-09-25) 기록만 해당해요.",
  ],
  variants: [
    {
      id: "v2",
      label: "간략화 후(2026-09-25~)",
      match: (d) => d.questionSet === 2,
      ignore: ["questionSet"],
      items: [
        textItem("predict", "q1", "predict.q1", "색깔도 없고 투명해서 눈으로 구별할 수 없는 두 용액(예: 석회수, 묽은 염산)을 어떻게 구별할 수 있을까요?", { label: "예상" }),
        tableItem("experiment", "records", "records", "여섯 가지 용액에 지시약을 넣고 관찰한 색깔 변화 기록", [
          { key: "phase", label: "실험", map: PHASES },
          { key: "solution", label: "용액" },
          { key: "indicator", label: "지시약", map: INDICATORS },
          { key: "result", label: "관찰 결과" },
        ], { label: "관찰 기록" }),
        groupsItem("analyze", "classify", "classify", "위의 내 기록 표를 보고 여섯 가지 용액을 알맞은 곳으로 옮겨 보세요.", BINS, { label: "분류" }),
        choiceItem("analyze", "q1", "analysis.q1", "위에서 용액을 분류할 때 근거로 쓸 수 있는 결과를 모두 고르세요.", {
          label: "분석 1",
          options: ["푸른색 리트머스 시험지가 붉은색으로 변했는지", "붉은색 리트머스 시험지가 푸른색으로 변했는지", "페놀프탈레인 용액이 붉은색으로 변했는지", "용액의 색깔과 투명한 정도"],
        }),
        choiceItem("analyze", "q4", "analysis.q4", "리트머스 시험지와 페놀프탈레인 용액은 색이 다르게 변하는데도 분류 결과가 같은 까닭은 무엇일까요?", {
          label: "분석 2",
          options: [
            "두 지시약 모두 용액이 산성인지 염기성인지에 따라 색깔이 변하기 때문",
            "용액의 색깔과 투명한 정도가 같은 것끼리 묶였기 때문",
            "지시약마다 반응하는 용액이 서로 다르기 때문",
            "우연히 결과가 같게 나온 것",
          ],
        }),
        textItem("conclude", "conclusion", "conclusion", "지시약을 이용하면 왜 눈으로 구별하기 어려운 용액도 분류할 수 있을까요? 내 말로 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "curiosity", "curiosity", "이번 실험을 하고 나서 더 탐구하고 싶은 점이나 궁금한 점을 한 줄로 적어 보세요.", {
          label: "더 탐구하고 싶은 점",
        }),
      ],
    },
    {
      id: "v1",
      label: "간략화 전(~2026-09-25)",
      match: () => true,
      items: [
        textItem("predict", "q1", "predict.q1", "색깔도 없고 투명해서 눈으로 구별할 수 없는 두 용액(예: 석회수, 묽은 염산)을 어떻게 구별할 수 있을까요?", { label: "질문 1" }),
        textItem("predict", "q2", "predict.q2", "지시약을 여섯 가지 용액에 각각 넣으면 지시약의 색깔이 용액마다 같게 변할까요, 다르게 변할까요? 그렇게 생각한 까닭도 적어 보세요.", { label: "질문 2" }),
        tableItem("experiment", "records", "records", "여섯 가지 용액에 지시약을 넣고 관찰한 색깔 변화 기록", [
          { key: "phase", label: "실험", map: PHASES },
          { key: "solution", label: "용액" },
          { key: "indicator", label: "지시약", map: INDICATORS },
          { key: "result", label: "관찰 결과" },
        ], { label: "관찰 기록" }),
        groupsItem("analyze", "classify", "classify", "위의 내 기록 표를 보고 여섯 가지 용액을 알맞은 곳으로 옮겨 보세요.", BINS, { label: "분류" }),
        choiceItem("analyze", "q1", "analysis.q1", "위에서 용액을 분류할 때 근거로 쓸 수 있는 결과를 모두 고르세요.", {
          label: "분석 1",
          options: ["푸른색 리트머스 시험지가 붉은색으로 변했는지", "붉은색 리트머스 시험지가 푸른색으로 변했는지", "페놀프탈레인 용액이 붉은색으로 변했는지", "용액의 색깔과 투명한 정도"],
        }),
        choiceItem("analyze", "q2", "analysis.q2", "페놀프탈레인 용액을 떨어뜨렸을 때 붉은색으로 변하는 용액을 모두 고르세요.", {
          label: "분석 2",
          options: SOLUTIONS,
        }),
        choiceItem("analyze", "q3", "analysis.q3", "어떤 용액에 페놀프탈레인 용액을 떨어뜨렸더니 색깔이 변하지 않았고, 붉은 양배추 용액을 떨어뜨렸더니 붉은색 계열로 변했어요. 이 용액에 푸른색 리트머스 시험지를 넣으면 어떻게 될까요?", {
          label: "분석 3",
          options: [
            "붉은색으로 변한다. 이 용액은 산성 용액이기 때문이다.",
            "변화가 없다. 이 용액은 산성 용액이기 때문이다.",
            "변화가 없다. 이 용액은 염기성 용액이기 때문이다.",
            "붉은색으로 변한다. 이 용액은 염기성 용액이기 때문이다.",
          ],
        }),
        choiceItem("analyze", "q4", "analysis.q4", "리트머스 시험지와 페놀프탈레인 용액은 색이 다르게 변하는데도 분류 결과가 같은 까닭은 무엇일까요?", {
          label: "분석 4",
          options: [
            "두 지시약 모두 용액이 산성인지 염기성인지에 따라 색깔이 변하기 때문",
            "용액의 색깔과 투명한 정도가 같은 것끼리 묶였기 때문",
            "지시약마다 반응하는 용액이 서로 다르기 때문",
            "우연히 결과가 같게 나온 것",
          ],
        }),
        choiceItem("analyze", "q5", "analysis.q5", "붉은 양배추 용액으로 분류한 결과를 리트머스 시험지·페놀프탈레인 용액으로 분류한 결과와 비교해 보세요. 옳은 것은 무엇일까요?", {
          label: "분석 5",
          options: [
            "두 결과가 같다. 붉은 양배추 용액이 노란색으로 변한 묽은 수산화 나트륨 용액도 염기성 용액이다.",
            "묽은 수산화 나트륨 용액만 노란색이 되었으니 산성 용액도 염기성 용액도 아닌 다른 무리이다.",
            "붉은 양배추 용액은 산성 용액에서 푸른색 계열로 변하므로 분류 결과가 반대이다.",
            "레몬즙은 붉은 양배추 용액으로 분류하면 염기성 용액이 된다.",
          ],
        }),
        textItem("conclude", "conclusion", "conclusion", "지시약을 이용하면 왜 눈으로 구별하기 어려운 용액도 분류할 수 있을까요? 내 말로 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "우리 주변의 산성 용액과 염기성 용액을 한 가지씩 적어 보세요.", { label: "발전 질문 1" }),
        textItem("conclude", "ext2", "extension.q2", "붉은 양배추 용액처럼 색깔이 변하는 다른 식물(재료)을 알고 있거나 예상해 보세요.", { label: "발전 질문 2" }),
        textItem("curiosity", "curiosity", "curiosity", "이번 실험을 하고 나서 더 탐구하고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
