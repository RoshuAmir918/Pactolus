"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AuthTRPC } from "@/lib/trpc";

/**
 * In local dev, prefer talking directly to API to avoid Next proxy instability.
 * In prod, default to same-origin `/trpc` unless NEXT_PUBLIC_API_URL is set.
 */
const apiBase = () =>
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:4000" : "");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = createTRPCClient<any>({
  links: [
    httpBatchLink({
      url: `${apiBase()}/trpc`,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});

export const trpc = client as unknown as AuthTRPC;
