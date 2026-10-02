import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public profile lives at /@username (R-PUB-5); served from /u/[username].
  async rewrites() {
    return [
      { source: "/@:username", destination: "/u/:username" },
      { source: "/@:username/:path*", destination: "/u/:username/:path*" },
    ];
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=()" },
        ],
      },
    ];
  },
  images: { unoptimized: true },
};

export default nextConfig;
