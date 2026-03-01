import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { z } from "zod";
export type ApiContext = {
  orgId: string | null;
  userId: string | null;
  requestId: string;
};

const optionalUuidHeader = z
  .string()
  .trim()
  .uuid()
  .optional()
  .nullable()
  .transform((value) => value ?? null);

function headerValue(
  headers: CreateExpressContextOptions["req"]["headers"],
  key: string,
): string | undefined {
  const value = headers[key];
  return Array.isArray(value) ? value[0] : value;
}

export function createContext({
  req,
}: CreateExpressContextOptions): ApiContext {
  const orgHeader = optionalUuidHeader.safeParse(
    headerValue(req.headers, "x-org-id"),
  );
  const userHeader = optionalUuidHeader.safeParse(
    headerValue(req.headers, "x-user-id"),
  );

  return {
    orgId: orgHeader.success ? orgHeader.data : null,
    userId: userHeader.success ? userHeader.data : null,
    requestId:
      headerValue(req.headers, "x-request-id") ?? `req_${Date.now().toString(36)}`,
  };
}
