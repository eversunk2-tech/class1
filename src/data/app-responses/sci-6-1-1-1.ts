import { choiceItem, groupsItem, tableItem, textItem } from "./helpers";
import type { ResponseSchema } from "./types";

/**
 * sci-6-1-1-1 여러 가지 용액을 분류해 볼까? (sim)
 * 출처: public/apps/sci-6-1-1-1/app.js buildDetail(), data/lesson-config.js (+ git 이력의 이전 버전)
 *
 * 2026-09-25 간략화(docs/science/sim-redesign/spec.md §1.4·개정 2)로 detail 모양이 두 가지다. 위에서부터 맞는 변형을 쓴다.
 *  - v2(간략화 후, 저장 키 sci611sim1:v2): questionSet: 2, predict{q1}, records[{solution,method,result,recordedAt}],
 *        skipped[](안전 안내 — 질문 아님), myCriterion{criterion,result}, analysis.criteria, classify.{color,transparent,foam},
 *        conclusion, curiosity('더 탐구하고 싶은 점' — 정리하기 안의 한 줄)
 *  - v1(간략화 전, 저장 키 sci611sim1:v1): predict{q1,q2}, records, skipped, myCriterion{criterion,result}, analysis.criteria,
 *        classify.{color,transparent,foam}, conclusion, extension{q1,q2}, curiosity(따로 떨어진 5단계 '궁금한 점')
 * 관찰·분류 활동과 값은 두 판이 같다.
 */

const BINS = [
  { id: "yes", label: "그렇다" },
  { id: "no", label: "그렇지 않다" },
];

const METHODS: Record<string, string> = {
  색깔: "색깔 관찰",
  투명도: "투명한 정도 관찰",
  거품: "흔들어 보기(5초 이상 거품 유지)",
  냄새: "냄새 맡아 보기",
};

export const schema: ResponseSchema = {
  appId: "sci-6-1-1-1",
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
    "예상 질문 2·발전 질문 1·2와 따로 떨어진 '궁금한 점' 단계는 간략화 전(~2026-09-25) 기록만 해당해요.",
  ],
  variants: [
    {
      id: "v2",
      label: "간략화 후(2026-09-25~)",
      match: (d) => d.questionSet === 2,
      ignore: ["skipped", "questionSet"],
      items: [
        textItem("predict", "q1", "predict.q1", "가게에 진열된 여러 가지 용액(음료수, 세제 등)을 종류별로 찾기 쉽게 나누어 놓으려면, 어떻게 나눌 수 있을까요?", { label: "예상" }),
        tableItem("experiment", "records", "records", "여섯 가지 용액의 겉보기 성질 관찰 기록", [
          { key: "solution", label: "용액" },
          { key: "method", label: "관찰 방법", map: METHODS },
          { key: "result", label: "결과" },
        ], { label: "관찰 기록", note: "묽은 염산의 냄새는 안전을 위해 관찰하지 않아요." }),
        textItem("analyze", "criterion", "myCriterion.criterion", "내가 세운 분류 기준을 '~인가?' 질문으로 적어 보세요.", { label: "내 분류 기준" }),
        textItem("analyze", "criterionResult", "myCriterion.result", "내 기준으로 나누면 '그렇다'와 '그렇지 않다'에 어떤 용액이 들어가나요?", { label: "내 분류 결과" }),
        choiceItem("analyze", "criteria", "analysis.criteria", "여러 가지 용액을 분류하는 기준으로 알맞은 것을 모두 고르세요.", {
          label: "분석 1",
          options: ["색깔이 있는가?", "투명한가?", "흔든 뒤 5초 이상 거품이 유지되는가?", "용액이 예쁜가?", "냄새가 나는가?"],
        }),
        groupsItem("analyze", "classify.color", "classify.color", "기준 1: 색깔이 있는가?", BINS, { label: "분류 1" }),
        groupsItem("analyze", "classify.transparent", "classify.transparent", "기준 2: 투명한가?", BINS, { label: "분류 2" }),
        groupsItem("analyze", "classify.foam", "classify.foam", "기준 3: 흔든 뒤 5초 이상 거품이 유지되는가?", BINS, { label: "분류 3" }),
        textItem("conclude", "conclusion", "conclusion", "여러 가지 용액을 분류하는 방법을 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "curiosity", "curiosity", "이번 실험을 하고 나서 더 탐구하고 싶은 점이나 궁금한 점을 한 줄로 적어 보세요.", {
          label: "더 탐구하고 싶은 점",
        }),
      ],
    },
    {
      id: "v1",
      label: "간략화 전(~2026-09-25)",
      match: () => true,
      ignore: ["skipped"],
      items: [
        textItem("predict", "q1", "predict.q1", "가게에 진열된 여러 가지 용액(음료수, 세제 등)을 종류별로 찾기 쉽게 나누어 놓으려면, 어떻게 나눌 수 있을까요?", { label: "질문 1" }),
        textItem("predict", "q2", "predict.q2", "용액을 나누는 기준을 정하려면 용액의 어떤 점들을 살펴봐야 할까요? 아는 대로 적어 보세요.", { label: "질문 2" }),
        tableItem("experiment", "records", "records", "여섯 가지 용액의 겉보기 성질 관찰 기록", [
          { key: "solution", label: "용액" },
          { key: "method", label: "관찰 방법", map: METHODS },
          { key: "result", label: "결과" },
        ], { label: "관찰 기록", note: "묽은 염산의 냄새는 안전을 위해 관찰하지 않아요." }),
        textItem("analyze", "criterion", "myCriterion.criterion", "내가 세운 분류 기준을 '~인가?' 질문으로 적어 보세요.", { label: "내 분류 기준" }),
        textItem("analyze", "criterionResult", "myCriterion.result", "내 기준으로 나누면 '그렇다'와 '그렇지 않다'에 어떤 용액이 들어가나요?", { label: "내 분류 결과" }),
        choiceItem("analyze", "criteria", "analysis.criteria", "여러 가지 용액을 분류하는 기준으로 알맞은 것을 모두 고르세요.", {
          label: "분석 1",
          options: ["색깔이 있는가?", "투명한가?", "흔든 뒤 5초 이상 거품이 유지되는가?", "용액이 예쁜가?", "냄새가 나는가?"],
        }),
        groupsItem("analyze", "classify.color", "classify.color", "기준 1: 색깔이 있는가?", BINS, { label: "분류 1" }),
        groupsItem("analyze", "classify.transparent", "classify.transparent", "기준 2: 투명한가?", BINS, { label: "분류 2" }),
        groupsItem("analyze", "classify.foam", "classify.foam", "기준 3: 흔든 뒤 5초 이상 거품이 유지되는가?", BINS, { label: "분류 3" }),
        textItem("conclude", "conclusion", "conclusion", "여러 가지 용액을 분류하는 방법을 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "겉보기 성질(색깔, 투명한 정도, 거품, 냄새)만으로 용액을 분류할 때 어려운 점은 무엇일까요?", { label: "발전 질문 1" }),
        textItem("conclude", "ext2", "extension.q2", "투명한 용액은 항상 색깔이 없을까요? 오늘 관찰한 용액 중에서 생각해 보고, 그 까닭도 적어 보세요.", { label: "발전 질문 2" }),
        textItem("curiosity", "curiosity", "curiosity", "이번 실험을 하고 나서 더 탐구하고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
