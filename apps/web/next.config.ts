import type { NextConfig } from "next";

/** Without this, `/trpc` hits Next and returns HTML; tRPC needs JSON from the API. */
const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/trpc/:path*",
        destination: `${apiProxyTarget}/trpc/:path*`,
      },
    ];
  },
};

export default nextConfig;
