"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AuthTRPC } from "@/lib/trpc";

/** Same-origin `/trpc` by default (Next rewrite). Set `NEXT_PUBLIC_API_URL` for a direct API origin. */
const apiBase = () => process.env.NEXT_PUBLIC_API_URL ?? "";

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
