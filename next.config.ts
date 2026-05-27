import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // 클릭재킹(iframe 삽입) 차단
          { key: "X-Frame-Options", value: "DENY" },
          // MIME 타입 스니핑 차단
          { key: "X-Content-Type-Options", value: "nosniff" },
          // XSS 필터 (구형 브라우저 대비)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Referrer 정보 최소화
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HTTPS 강제 유지 (Vercel은 이미 HTTPS지만 명시)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // 불필요한 브라우저 기능 비활성화
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
