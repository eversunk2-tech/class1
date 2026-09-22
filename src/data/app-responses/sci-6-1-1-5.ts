import { choiceItem, hintsText, tableItem, textItem, valueItem, yesNo } from "./helpers";
import type { ResponseSchema } from "./types";

/**
 * sci-6-1-1-5 산성 용액과 염기성 용액을 이용하는 예를 찾아라! (guide · 이전 기준)
 * 출처: public/apps/sci-6-1-1-5/app.js buildDetail(), data/lesson-config.js
 * detail: kind:"guide", intro{answer,experience,hintsOpened}, worksheet[{name,property,use}],
 *         propertyDiffers[{name,mine,guide}], comparedWithModel(bool), share{script,reflect},
 *         quiz.q1..q4(choice는 이미 라벨), conclusion, extension{q1,q2}, curiosity
 */

export const schema: ResponseSchema = {
  appId: "sci-6-1-1-5",
  kind: "guide",
  standard: "legacy",
  stages: [
    { id: "intro", label: "조사 시작하기" },
    { id: "research", label: "조사하기" },
    { id: "share", label: "발표 준비하기" },
    { id: "wrapup", label: "정리 질문" },
    { id: "curiosity", label: "궁금한 점" },
  ],
  notes: [
    "정리하기(결론·발전 질문)와 발표 준비의 '새롭게 알게 된 점'은 '제출'을 누른 글만 저장돼요. 비어 있으면 제출하지 않은 거예요.",
    "'참고 예시와 성질이 다른 줄'은 학생이 적은 용액 이름을 참고 예시의 이름·별칭과 맞춰 본 뒤(띄어쓰기·문장 부호 무시, 두 글자 이상 겹치면 부분 일치도 인정, '용액'·'세제'처럼 뜻이 넓은 말은 제외) 짝지어진 줄만 비교해요.",
  ],
  variants: [
    {
      id: "v1",
      label: "현재 버전",
      match: () => true,
      ignore: ["kind"],
      items: [
        textItem("intro", "answer", "intro.answer", "생선 요리에 레몬이 같이 나오는 까닭은 무엇일까요? 자신의 생각을 적어 보세요.", { label: "질문 1" }),
        textItem("intro", "experience", "intro.experience", "산성 용액이나 염기성 용액을 이용하는 것을 본 적이 있나요? 언제, 무엇을 이용하는 모습이었는지 적어 보세요.", { label: "질문 2" }),
        valueItem("intro", "hintsOpened", "intro.hintsOpened", "열어 본 힌트 수", hintsText, { label: "힌트" }),
        tableItem("research", "worksheet", "worksheet", "조사 결과 정리하기: 조사한 용액을 한 줄에 하나씩 적어요.", [
          { key: "name", label: "용액 이름" },
          { key: "property", label: "성질" },
          { key: "use", label: "이용하는 예" },
        ], { label: "조사 정리" }),
        valueItem("research", "comparedWithModel", "comparedWithModel", "참고 예시와 비교해 보기를 열어 보았나요?", yesNo, { label: "참고 예시 비교" }),
        tableItem("research", "propertyDiffers", "propertyDiffers", "참고 예시와 성질이 다르게 적힌 용액", [
          { key: "name", label: "용액" },
          { key: "mine", label: "내가 고른 성질" },
          { key: "guide", label: "참고 예시의 성질" },
        ], { label: "성질 확인 필요" }),
        textItem("share", "script", "share.script", "내가 조사한 것을 친구들에게 어떻게 소개할지 적어 보세요.", { label: "발표 대본" }),
        textItem("share", "reflect", "share.reflect", "다른 모둠의 발표를 들었다면 새롭게 알게 된 점은 무엇일까요?", { label: "새롭게 알게 된 점" }),
        choiceItem("wrapup", "q1", "quiz.q1", "다음 중 이용한 용액의 성질이 다른 하나는?", {
          label: "문제 1",
          options: ["제빵 소다 용액으로 과일 씻기", "욕실 청소용 표백제로 욕실 청소하기", "변기 청소용 세제로 변기 청소하기"],
        }),
        choiceItem("wrapup", "q2", "quiz.q2", "위액은 산성이에요. 속이 쓰릴 때 먹는 제산제는 어떤 성질일까요?", {
          label: "문제 2",
          options: ["산성", "염기성"],
        }),
        choiceItem("wrapup", "q3", "quiz.q3", "생선을 손질한 도마에서 비린내가 날 때 뿌리면 좋은 것은?", {
          label: "문제 3",
          options: ["식초(레몬즙)", "욕실 청소용 표백제"],
        }),
        choiceItem("wrapup", "q4", "quiz.q4", "변기의 때는 염기성이에요. 변기 청소용 세제가 없을 때 대신 쓸 수 있는 용액은?", {
          label: "문제 4",
          options: ["구연산 용액", "제빵 소다 용액", "손 세정제"],
        }),
        textItem("wrapup", "conclusion", "conclusion", "우리 생활에서 산성 용액과 염기성 용액은 어떻게 이용되나요? 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("wrapup", "ext1", "extension.q1", "손자국이 남아 더러워진 유리창을 닦을 때 쓰는 유리 세정제는 산성과 염기성 가운데 어떤 성질의 용액일지 예상하고, 그 까닭을 적어 보세요. (손자국에는 몸에서 나온 단백질 같은 물질이 남아 있어요.)", { label: "발전 질문 1" }),
        textItem("wrapup", "ext2", "extension.q2", "산성 물질과 염기성 물질이 만나 성질이 달라지는 것을 이용하는 예를, 앞에서 나온 레몬즙·제산제 말고 더 예상해 보세요.", { label: "발전 질문 2" }),
        textItem("curiosity", "curiosity", "curiosity", "산성 용액과 염기성 용액에 대해 더 탐구하고 싶은 점(또는 궁금한 점)을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
