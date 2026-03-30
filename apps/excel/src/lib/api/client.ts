import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

export function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.includes("localhost:3001")
      ? `https://${trimmed}`
      : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function getApiClient(apiUrl: string): any {
  return createTRPCProxyClient<any>({
    links: [
      httpBatchLink({
        url: `${apiUrl}/trpc`,
        fetch: async (url, options) => {
          const response = await fetch(url, {
            ...options,
            credentials: "include",
          });
          return response;
        },
      }),
    ],
  });
}

export async function testApiConnection(apiUrl: string): Promise<{
  healthOk: boolean;
  hasSession: boolean;
}> {
  const health = await fetch(`${apiUrl}/healthz`, {
    method: "GET",
    credentials: "include",
  });
  if (!health.ok) {
    return { healthOk: false, hasSession: false };
  }

  const client = getApiClient(apiUrl);
  try {
    await client.auth.me.query();
    return { healthOk: true, hasSession: true };
  } catch {
    return { healthOk: true, hasSession: false };
  }
}
