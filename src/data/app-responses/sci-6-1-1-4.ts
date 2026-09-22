import { choiceItem, tableItem, textItem } from "./helpers";
import type { ResponseSchema } from "./types";

/**
 * sci-6-1-1-4 산성 용액과 염기성 용액을 섞으면 어떻게 될까? (sim · 이전 기준)
 * 출처: public/apps/sci-6-1-1-4/app.js buildDetail(), data/lesson-config.js
 * detail: predict{q1,q2}, records[{phase,drops,colorFamily,recordedAt}](colorFamily는 이미 보기 라벨),
 *         analysis{readA,inferA,q1,q2,q3}, conclusion, extension{q1,q2}, curiosity
 */

const PHASES: Record<string, string> = {
  A: "실험 A (묽은 염산에서 시작)",
  B: "실험 B (묽은 수산화 나트륨 용액에서 시작)",
};

const ADDED: Record<string, string> = {
  A: "묽은 수산화 나트륨 용액",
  B: "묽은 염산",
};

export const schema: ResponseSchema = {
  appId: "sci-6-1-1-4",
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
    "'넣은 방울 수'는 반대 용액(실험 A는 묽은 수산화 나트륨 용액, 실험 B는 묽은 염산)의 방울 수예요.",
  ],
  variants: [
    {
      id: "v1",
      label: "현재 버전",
      match: () => true,
      items: [
        textItem("predict", "q1", "predict.q1", "염기성 용액인 빨랫비누 물에 산성 용액인 식초를 섞으면 어떻게 될까요? 그렇게 생각한 까닭도 함께 적어 보세요.", { label: "질문 1" }),
        textItem("predict", "q2", "predict.q2", "묽은 염산에 묽은 수산화 나트륨 용액을 아주 조금씩 계속 넣으면 묽은 염산의 성질은 어떻게 될까요? 반대로 묽은 수산화 나트륨 용액에 묽은 염산을 계속 넣으면 어떻게 될까요?", { label: "질문 2" }),
        tableItem("experiment", "records", "records", "반대 용액을 넣은 방울 수에 따른 붉은 양배추 용액의 색깔 계열 기록", [
          { key: "phase", label: "실험", map: PHASES },
          {
            key: "drops",
            label: "넣은 방울 수",
            format: (v, row) => {
              const added = typeof row.phase === "string" ? ADDED[row.phase] : undefined;
              if (typeof v !== "number") return v == null ? "—" : String(v);
              return added ? `${added} ${v}방울` : `${v}방울`;
            },
          },
          { key: "colorFamily", label: "색깔 계열" },
        ], { label: "관찰 기록" }),
        choiceItem("analyze", "readA", "analysis.readA", "내 결과 표에서 실험 A 줄(묽은 염산에서 시작)을 0방울 칸부터 25방울 칸까지 차례로 짚어 보세요. 묽은 수산화 나트륨 용액을 많이 넣을수록 붉은 양배추 용액의 색깔은 어떻게 변했나요?", {
          label: "표 읽기",
          options: ["붉은색 계열에서 푸른색(노란색) 계열로 변했다.", "푸른색(노란색) 계열에서 붉은색 계열로 변했다.", "처음 색 그대로 변하지 않았다."],
        }),
        choiceItem("analyze", "inferA", "analysis.inferA", "실험 A의 색깔 변화를 색깔 변화표와 비교해 보세요. 묽은 염산에 묽은 수산화 나트륨 용액을 많이 넣을수록 용액의 성질은 어떻게 변했다고 할 수 있을까요?", {
          label: "추리하기",
          options: ["산성이 점점 강해졌다.", "산성이 약해지다가 염기성으로 변했다.", "성질은 변하지 않고 색만 변했다.", "5방울만 넣어도 곧바로 염기성으로 변했다."],
        }),
        choiceItem("analyze", "q1", "analysis.q1", "붉은 양배추 용액을 떨어뜨린 묽은 수산화 나트륨 용액에 묽은 염산을 계속 넣었더니 용액의 색깔이 노란색 계열에서 붉은색 계열로 변했어요. 이 실험에 대한 설명으로 옳은 것은 무엇일까요?", {
          label: "분석 1",
          options: ["용액의 성질은 변하지 않았다.", "염기성 용액의 성질이 점점 강해졌다.", "염기성 용액의 성질이 약해지다가 산성 용액이 되었다."],
        }),
        choiceItem("analyze", "q2", "analysis.q2", "페놀프탈레인 용액을 떨어뜨린 묽은 염산에 묽은 수산화 나트륨 용액을 계속 넣었더니 색깔이 붉은색으로 변했어요. 이 결과로 알 수 있는 용액의 성질 변화는 무엇일까요?", {
          label: "분석 2",
          options: ["염기성이 점점 더 강해지기만 한다.", "산성이 점점 약해지다가 염기성으로 변한다.", "성질이 전혀 변하지 않는다.", "한 방울만 넣어도 곧바로 반대 성질로 뒤바뀐다."],
        }),
        choiceItem("analyze", "q3", "analysis.q3", "이 실험에서는 산성 용액과 염기성 용액을 섞을 때 용액의 성질이 변하는 것을 무엇으로 알아보았나요?", {
          label: "분석 3",
          options: ["용액의 온도 변화", "용액에서 나는 냄새", "지시약(붉은 양배추 용액)의 색깔 변화", "용액의 무게 변화"],
        }),
        textItem("conclude", "conclusion", "conclusion", "산성 용액과 염기성 용액을 섞으면 용액의 성질이 어떻게 될까요? 실험 결과를 바탕으로 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("conclude", "ext1", "extension.q1", "묽은 염산에 묽은 수산화 나트륨 용액을 넣어 염기성으로 변한 용액을 다시 산성 용액으로 만드는 방법을 예상해 적어 보세요.", { label: "발전 질문 1" }),
        textItem("conclude", "ext2", "extension.q2", "산성 용액과 염기성 용액을 섞을 때 나타나는 성질 변화는 우리 생활에 어떻게 도움이 될 수 있을까요? 한 가지를 예상해 적어 보세요.", { label: "발전 질문 2" }),
        textItem("curiosity", "curiosity", "curiosity", "산성 용액과 염기성 용액을 섞는 것에 대해 더 탐구하고 싶은 점이나 궁금한 점을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
