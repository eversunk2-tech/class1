import { choiceItem, customItem, getPath, hintsText, tableItem, textItem, valueItem } from "./helpers";
import type { Answer, Detail, ResponseSchema } from "./types";

/**
 * sci-6-1-1-6 산성화가 환경에 미치는 영향을 알아볼까? (guide)
 * 출처: public/apps/sci-6-1-1-6/app.js buildDetail(), data/lesson-config.js (+ git 이력의 이전 버전)
 * 저장 모양이 한 번 바뀌었다(2026-09-25 간략화, 저장 키 sci611guide6:v1 → v2).
 *  - v2(간략화 후, 최상위 questionSet: 2): kind("guide" 표시), questionSet:2, topic(주제 라벨), intro{q2,hintsOpened,revised?{q2}},
 *        research{cause,damage,solution,source}(줄 1개 고정), openedFacts, share{script,checked[],reflect}, quiz.{q1,q2}, conclusion,
 *        curiosity('더 탐구하고 싶은 점' — 정리하기 단계 안의 필수 한 줄). fill·why·extension·intro.q1·revised.q1은 없다.
 *  - v2의 research.source는 2026-09-26부터 직접 쓰지 않고 목록에서 고른 값(교과서·실험관찰, 사이언스올, 한국해양과학기술원, 에듀넷, 국가환경교육통합플랫폼, 기타(누리집·책)).
 *  - v1(간략화 전): kind("guide" 표시), topic(주제 라벨), intro{q1,q2,hintsOpened,revised?{q1,q2}}, research{cause,damage,solution,source}(줄 1개 고정),
 *        openedFacts, share{script,checked[],reflect}, fill, quiz.{q1,q2}, why, extension(문자열 1개), conclusion, curiosity(따로 있던 5단계 '궁금한 점')
 */

const SHARE_CHECKLIST = [
  "산성비·해양 산성화·토양 산성화 중 하나의 피해 사례를 옳게 설명했나요?",
  "조사한 내용의 출처를 밝혔나요?",
  "친구들에게 바른 자세로 설명할 준비가 되었나요?",
];

/** openedFacts(참고 자료 카드) → 기록의 실제 뜻 */
function openedFactsText(v: unknown): string | null {
  if (typeof v !== "boolean") return null;
  return v ? "펼친 상태로 기록됨(자료를 볼 수 있었어요)" : "알 수 없음(저절로 펼쳐진 뒤 그대로 두었거나, 학생이 접었어요)";
}

const QUIZ_OPTIONS = ["산성비", "해양 산성화", "토양 산성화", "대기 오염 물질"];

/** share.checked: 확인 표시한 항목(라벨 배열) → 채점하지 않는 여러 개 고르기 */
function checkedAnswer(d: Detail): Answer | null {
  const v = getPath(d, "share.checked");
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return { kind: "raw", value: v };
  return {
    kind: "choice",
    chosen: v.map((x) => (typeof x === "string" ? x : String(x))),
    correct: null,
    tries: null,
    options: SHARE_CHECKLIST,
  };
}

export const schema: ResponseSchema = {
  appId: "sci-6-1-1-6",
  kind: "guide",
  standard: "slim",
  // 앱의 4단계(2026-09-25 간략화 — '궁금한 점' 단계는 정리하기 안으로 합쳤다).
  // 간략화 전 기록의 curiosity 항목은 stage "curiosity"라 기본 이름 "궁금한 점"으로 맨 뒤에 모인다(src/lib/app-responses.ts groupByStage).
  stages: [
    { id: "intro", label: "조사 준비" },
    { id: "research", label: "조사하기" },
    { id: "share", label: "공유 준비하기" },
    { id: "wrapup", label: "정리하기" },
  ],
  notes: [
    "조사 준비의 답(간략화 전 기록은 두 답)은 '생각 다 적었어요'를 누른 때(개념 카드를 보기 전)의 처음 생각이에요. 그 뒤에 고쳤으면 '고친 생각'으로 따로 보여요.",
    "중간에 주제를 바꾸면 그 전에 적은 조사하기·공유 준비하기 내용은 지워져요. 지금 보이는 조사 내용은 마지막 주제의 것이에요.",
    "결론과 새롭게 알게 된 점(간략화 전 기록은 빈칸 채우기·서술형·발전 질문도)은 '제출'한 글만 저장돼요(비어 있으면 제출하지 않은 것).",
    "2026-09-25에 질문을 줄였어요(조사 준비 질문 1개, 빈칸 채우기·서술형·발전 질문을 빼고 '더 탐구하고 싶은 점'은 정리하기 단계 안으로). 그 전에 마친 기록은 '간략화 전' 버전으로 보여요.",
  ],
  variants: [
    {
      id: "v2",
      label: "간략화 후(2026-09-25~)",
      match: (d) => d.questionSet === 2,
      ignore: ["kind", "questionSet"],
      items: [
        textItem("intro", "q2", "intro.q2", "우리가 사는 호수, 바다, 흙이 점점 더 산성으로 변한다면 그곳에 사는 생물들은 어떻게 될까요?", { label: "질문 1" }),
        textItem("intro", "revised.q2", "intro.revised.q2", "우리가 사는 호수, 바다, 흙이 점점 더 산성으로 변한다면 그곳에 사는 생물들은 어떻게 될까요? (개념 카드를 본 뒤 고친 생각)", { label: "질문 1 고친 생각" }),
        valueItem("intro", "hintsOpened", "intro.hintsOpened", "열어 본 힌트 수", hintsText, { label: "힌트" }),
        valueItem("intro", "topic", "topic", "모둠별로 조사할 주제를 하나 골라요", undefined, { label: "조사 주제" }),
        tableItem("research", "research", "research", "조사 결과 정리하기(원인 · 피해 · 대책 · 출처)", [
          { key: "cause", label: "원인" },
          { key: "damage", label: "피해(현황·전망)" },
          { key: "solution", label: "대책" },
          { key: "source", label: "어디서 찾았나요?(출처)" },
        ], { label: "조사 정리" }),
        // openedFacts: 아래 v1 항목의 주석과 같다(자료를 본 학생도 대부분 false — review M2, 이번 간략화 범위 밖)
        valueItem(
          "research",
          "openedFacts",
          "openedFacts",
          "'참고 자료 속 사실과 비교해 보기' 카드(정리 틀 세 칸을 적고 출처를 고르면 저절로 펼쳐져요)",
          openedFactsText,
          {
            label: "참고 자료 카드",
            note: "앱은 학생이 카드를 직접 접거나 폈을 때(또는 조사를 마친 뒤 다시 들어왔을 때)만 이 값을 남겨요. '알 수 없음'이 '안 봤다'는 뜻은 아니에요(채점하지 않는 활동).",
          },
        ),
        textItem(
          "share",
          "script",
          "share.script",
          "조사한 내용을 친구들에게 어떻게 소개할지 적어 보세요. 초안 만들기 버튼을 누르면 내가 적은 말이 그대로 들어가요. 어색한 곳은 자연스럽게 다듬어요.",
          { label: "공유 대본" },
        ),
        customItem("share", "checked", "공유하기 전에 확인해요", ["share"], checkedAnswer, { label: "공유 전 확인" }),
        textItem("share", "reflect", "share.reflect", "내 조사와 다른 모둠의 공유 자료를 보고 새롭게 알게 된 점은 무엇인가요?", { label: "새롭게 알게 된 점" }),
        choiceItem("wrapup", "quiz.q1", "quiz.q1", "대기 중의 오염 물질이 빗물에 녹아 일반적인 비보다 더 산성을 띠는 비를 무엇이라고 할까요?", { label: "문제 1", options: QUIZ_OPTIONS }),
        choiceItem("wrapup", "quiz.q2", "quiz.q2", "산성비는 흙의 산성이 점점 강해지는 현상에도 영향을 끼치고, 동식물에게도 많은 피해를 줘요. 흙의 산성이 점점 강해지는 현상을 무엇이라고 할까요?", { label: "문제 2", options: QUIZ_OPTIONS }),
        textItem("wrapup", "conclusion", "conclusion", "오늘 조사한 산성화의 원인, 피해, 대책을 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("wrapup", "curiosity", "curiosity", "더 조사해 보고 싶은 산성화 피해나 궁금한 점을 한 줄로 적어 보세요.", { label: "더 탐구하고 싶은 점" }),
      ],
    },
    {
      id: "v1",
      label: "간략화 전(~2026-09-25)",
      match: () => true,
      ignore: ["kind"],
      items: [
        textItem("intro", "q1", "intro.q1", "산성을 띠는 비가 계속 내린다면 우리 주변에는 어떤 일이 생길까요?", { label: "질문 1" }),
        textItem("intro", "q2", "intro.q2", "우리가 사는 호수, 바다, 흙이 점점 더 산성으로 변한다면 그곳에 사는 생물들은 어떻게 될까요?", { label: "질문 2" }),
        textItem("intro", "revised.q1", "intro.revised.q1", "산성을 띠는 비가 계속 내린다면 우리 주변에는 어떤 일이 생길까요? (개념 카드를 본 뒤 고친 생각)", { label: "질문 1 고친 생각" }),
        textItem("intro", "revised.q2", "intro.revised.q2", "우리가 사는 호수, 바다, 흙이 점점 더 산성으로 변한다면 그곳에 사는 생물들은 어떻게 될까요? (개념 카드를 본 뒤 고친 생각)", { label: "질문 2 고친 생각" }),
        valueItem("intro", "hintsOpened", "intro.hintsOpened", "열어 본 힌트 수", hintsText, { label: "힌트" }),
        valueItem("intro", "topic", "topic", "모둠별로 조사할 주제를 하나 골라요", undefined, { label: "조사 주제" }),
        tableItem("research", "research", "research", "조사 결과 정리하기(원인 · 피해 · 대책 · 출처)", [
          { key: "cause", label: "원인" },
          { key: "damage", label: "피해(현황·전망)" },
          { key: "solution", label: "대책" },
          { key: "source", label: "어디서 찾았나요?(출처)" },
        ], { label: "조사 정리" }),
        // openedFacts = !!store.get("refOpen") && 조사 완료(app.js buildDetail). refOpen은 ref-cards.js가 카드의 toggle 이벤트에서
        // '잠기지 않은 상태'일 때만 저장한다. 잠금이 풀릴 때 카드는 이미 펼쳐져 있어 이벤트가 없으므로, 자료를 본 학생도 대부분 false다(review M2).
        // true = 펼친 상태가 기록됨(학생이 직접 폈거나, 조사를 마친 뒤 다시 들어와 펼쳐진 채 그려짐). false = 기록 없음 또는 학생이 접음.
        valueItem(
          "research",
          "openedFacts",
          "openedFacts",
          "'참고 자료 속 사실과 비교해 보기' 카드(정리 틀 네 칸을 채우면 저절로 펼쳐져요)",
          openedFactsText,
          {
            label: "참고 자료 카드",
            note: "앱은 학생이 카드를 직접 접거나 폈을 때(또는 조사를 마친 뒤 다시 들어왔을 때)만 이 값을 남겨요. '알 수 없음'이 '안 봤다'는 뜻은 아니에요(채점하지 않는 활동).",
          },
        ),
        textItem(
          "share",
          "script",
          "share.script",
          "조사한 내용을 친구들에게 어떻게 소개할지 적어 보세요. 초안 만들기 버튼을 누르면 내가 적은 말이 그대로 들어가요. 어색한 곳은 자연스럽게 다듬어요.",
          { label: "공유 대본" },
        ),
        customItem("share", "checked", "공유하기 전에 확인해요", ["share"], checkedAnswer, { label: "공유 전 확인" }),
        textItem("share", "reflect", "share.reflect", "내 조사와 다른 모둠의 공유 자료를 보고 새롭게 알게 된 점은 무엇인가요?", { label: "새롭게 알게 된 점" }),
        textItem("wrapup", "fill", "fill", "산성비, 해양 산성화, 토양 산성화 등 ( ＿＿＿＿ )은/는 생태계에 큰 피해를 주고 있습니다. 빈칸에 들어갈 말을 적어 보세요.", { label: "빈칸 채우기" }),
        choiceItem("wrapup", "quiz.q1", "quiz.q1", "대기 중의 오염 물질이 빗물에 녹아 일반적인 비보다 더 산성을 띠는 비를 무엇이라고 할까요?", { label: "문제 1", options: QUIZ_OPTIONS }),
        choiceItem("wrapup", "quiz.q2", "quiz.q2", "산성비는 흙의 산성이 점점 강해지는 현상에도 영향을 끼치고, 동식물에게도 많은 피해를 줘요. 흙의 산성이 점점 강해지는 현상을 무엇이라고 할까요?", { label: "문제 2", options: QUIZ_OPTIONS }),
        textItem("wrapup", "why", "why", "산성화된 호수에 염기성 물질을 뿌리는 까닭은 무엇일까요?", { label: "서술형" }),
        textItem("wrapup", "extension", "extension", "해양 산성화로 조개나 산호가 바다에서 잘 살지 못하는 모습을 보았어요. 이런 피해를 줄이려고 내가 생활에서 할 수 있는 일과, 그 일이 왜 도움이 되는지 적어 보세요.", { label: "발전 질문" }),
        textItem("wrapup", "conclusion", "conclusion", "오늘 조사한 산성화의 원인, 피해, 대책을 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("curiosity", "curiosity", "curiosity", "더 조사해 보고 싶은 산성화 피해나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
