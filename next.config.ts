import type { NextConfig } from "next";

// GitHub Pages 프로젝트 사이트(https://eversunk2-tech.github.io/class1/) 정적 배포용 설정.
// 서버 기능은 사용할 수 없다.
const basePath = "/class1";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // next/image src, iframe, 정적 앱 링크 등 basePath를 직접 붙여야 하는 곳에서 사용
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
