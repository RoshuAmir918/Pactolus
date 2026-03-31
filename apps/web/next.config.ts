import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Without this, `/trpc` hits Next and returns HTML; tRPC needs JSON from the API. */
const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
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
