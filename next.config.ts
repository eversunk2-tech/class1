import type { NextConfig } from "next";

// GitHub Pages(사용자 사이트) 정적 배포용 설정. 서버 기능은 사용할 수 없다.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
