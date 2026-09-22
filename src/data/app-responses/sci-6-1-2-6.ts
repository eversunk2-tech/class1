import { choiceItem, customItem, getPath, hintsText, isObj, tableItem, textItem, valueItem } from "./helpers";
import type { Answer, Detail, ResponseSchema } from "./types";

/**
 * sci-6-1-2-6 속력과 관련된 안전 수칙과 안전장치를 조사해 볼까? (guide · 이전 기준 — CLAUDE.md 예외)
 * 출처: public/apps/sci-6-1-2-6/app.js buildDetail(), data/lesson-config.js
 * detail: kind("guide" 표시), intro{zigzag,danger,hintsOpened}, rules[{situation,rule}], devices[{name,place,func}],
 *         placeDiffers[{name,mine,guide}], comparedWithModel{rules,devices}, share{script,reflect,checked[]},
 *         quiz.{q1..q3}(라벨), conclusion, extension{q1,q2}, curiosity
 */

const SHARE_CHECKLIST = ["다른 친구가 이해할 수 있게 설명했나요?", "조사한 자료의 출처를 확인했나요?", "친구 의견을 존중하며 들을 준비가 되었나요?"];

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

function yn(v: unknown): string {
  return typeof v === "boolean" ? (v ? "예" : "아니요") : "—";
}

/** comparedWithModel{rules,devices} → "안전 수칙: 예 · 안전장치: 아니요" */
function comparedAnswer(d: Detail): Answer | null {
  const v = getPath(d, "comparedWithModel");
  if (v === undefined || v === null) return null;
  if (!isObj(v)) return { kind: "raw", value: v };
  return { kind: "value", text: `안전 수칙: ${yn(v.rules)} · 안전장치: ${yn(v.devices)}` };
}

export const schema: ResponseSchema = {
  appId: "sci-6-1-2-6",
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
    "결론·적용 질문·발전 질문과 새롭게 알게 된 점(댓글)은 '제출'한 글만 저장돼요(비어 있으면 제출하지 않은 것).",
    "조사 정리 틀은 다 채운 줄만 저장돼요.",
  ],
  variants: [
    {
      id: "v1",
      label: "현재 버전",
      match: () => true,
      ignore: ["kind"],
      items: [
        textItem("intro", "zigzag", "intro.zigzag", "지그재그로 그려진 차선을 본 적이 있나요? 그 의미는 무엇일지 예상해서 적어 보세요.", { label: "질문 1" }),
        textItem("intro", "danger", "intro.danger", "사람이나 자동차의 속력이 빠를 때 생길 수 있는 위험한 상황을 한 가지 이상 예상해서 적어 보세요.", { label: "질문 2" }),
        valueItem("intro", "hintsOpened", "intro.hintsOpened", "열어 본 힌트 수", hintsText, { label: "힌트" }),
        tableItem("research", "rules", "rules", "① 속력과 관련된 안전 수칙 조사하기", [
          { key: "situation", label: "상황" },
          { key: "rule", label: "지켜야 할 안전 수칙" },
        ], { label: "안전 수칙" }),
        tableItem("research", "devices", "devices", "② 속력과 관련된 안전장치 조사하기", [
          { key: "name", label: "안전장치 이름" },
          { key: "place", label: "설치 위치" },
          { key: "func", label: "기능(하는 일)" },
        ], { label: "안전장치" }),
        tableItem("research", "placeDiffers", "placeDiffers", "예시 답안과 설치 위치가 다르게 적힌 안전장치", [
          { key: "name", label: "안전장치" },
          { key: "mine", label: "내가 고른 설치 위치" },
          { key: "guide", label: "예시 답안의 설치 위치" },
        ], { label: "설치 위치 차이", note: "비어 있으면 예시 답안과 다르게 적은 안전장치가 없어요." }),
        customItem("research", "comparedWithModel", "'📘 예시 답안과 비교해 보기'를 열어 보았나요?", ["comparedWithModel"], comparedAnswer, { label: "예시 답안 비교" }),
        textItem("share", "script", "share.script", "내가 조사한 안전 수칙이나 안전장치 중 하나를 골라 친구들에게 소개하는 말을 적어 보세요.", { label: "발표 대본" }),
        customItem("share", "checked", "발표하기 전에 확인해요", ["share"], checkedAnswer, { label: "발표 전 확인" }),
        textItem("share", "reflect", "share.reflect", "위의 공유 글(또는 친구들이 공유한 글)을 읽고 새롭게 알게 된 점을 댓글로 적어 보세요.", { label: "새롭게 알게 된 점" }),
        choiceItem("wrapup", "quiz.q1", "quiz.q1", "자동차가 충돌하거나 갑자기 멈출 때 탑승자를 자동차 좌석에 고정해 주는 안전장치는 무엇일까요?", {
          label: "문제 1",
          options: ["과속 방지턱", "안전띠", "안전 울타리"],
        }),
        choiceItem("wrapup", "quiz.q2", "quiz.q2", "다음 중 안전장치에 대한 설명으로 옳지 않은 것을 고르세요.", {
          label: "문제 2",
          options: [
            "에어백은 자동차가 빠른 속력으로 충돌할 때 공기주머니를 부풀려 탑승자를 보호한다.",
            "차간 거리 유지 장치는 앞차가 갑자기 정지했을 때 속력을 줄일 수 있는 안전거리를 유지하게 한다.",
            "안전 울타리는 자동차의 속력을 실시간으로 측정해 운전자에게 알려 준다.",
          ],
        }),
        choiceItem("wrapup", "quiz.q3", "quiz.q3", "빈칸에 알맞은 말은 무엇일까요? '속력이 빠를수록 안전사고의 위험이 커지므로 자동차나 도로에는 (　　)을/를 설치합니다.'", {
          label: "문제 3",
          options: ["안전장치", "안전 수칙", "속력"],
        }),
        textItem("wrapup", "conclusion", "conclusion", "오늘 조사한 내용을 바탕으로, 속력과 관련된 안전 수칙과 안전장치가 왜 필요한지 자신의 말로 정리해 보세요.", { label: "결론" }),
        textItem("wrapup", "ext1", "extension.q1", "비나 눈이 내리는 날에는 속력과 관련된 어떤 안전 수칙을 더 잘 지켜야 할까요? 보행자와 운전자로 나누어 생각해 보세요.", { label: "적용 질문" }),
        textItem("wrapup", "ext2", "extension.q2", "같은 속력으로 달려오더라도, 승용차보다 큰 버스나 화물차가 다가올 때 길을 건너기 전에 더 조심해야 해요. 그 까닭은 무엇일까요? 조사한 내용을 바탕으로 생각해 보세요.", { label: "발전 질문" }),
        textItem("curiosity", "curiosity", "curiosity", "속력과 관련된 안전 수칙이나 안전장치에 대해 더 탐구하고 싶은 점(또는 궁금한 점)을 적어 보세요.", { label: "궁금한 점" }),
      ],
    },
  ],
};
