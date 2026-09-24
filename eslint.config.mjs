import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase Edge Functions는 Deno 런타임 코드라 Next 빌드·lint 대상에서 뺀다.
    "supabase/functions/**",
    // 정적 웹앱(순수 HTML/CSS/JS, CLAUDE.md 웹앱 규칙)과 그 공통 틀은 Next/React 규칙 대상이 아니다.
    "public/apps/**",
    "scripts/templates/**",
    // 설계·보고 문서 폴더의 보조 스크립트(예: 마스코트 배경 제거 cutout.cjs)는 사이트 코드가 아니다.
    "docs/**",
  ]),
]);

export default eslintConfig;
