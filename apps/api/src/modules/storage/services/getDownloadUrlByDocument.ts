import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { documents } from "@db/schema";
import { getDownloadUrl, type GetDownloadUrlResult } from "./getDownloadUrl";

const { db } = dbClient;

export type GetDownloadUrlByDocumentInput = {
  orgId: string;
  documentId: string;
};

export async function getDownloadUrlByDocument(
  input: GetDownloadUrlByDocumentInput,
): Promise<GetDownloadUrlResult> {
  const [doc] = await db
    .select({ fileObjectId: documents.fileObjectId })
    .from(documents)
    .where(and(eq(documents.id, input.documentId), eq(documents.orgId, input.orgId)))
    .limit(1);

  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
  }

  return getDownloadUrl({ orgId: input.orgId, fileObjectId: doc.fileObjectId });
}
