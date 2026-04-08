import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { documents } from "@db/schema";

const { db } = dbClient;

export type GetDocumentByIdInput = {
  orgId: string;
  documentId: string;
};

export async function getDocumentById(input: GetDocumentByIdInput) {
  const rows = await db
    .select({
      id: documents.id,
      fileObjectId: documents.fileObjectId,
      filename: documents.filename,
      fileExtension: documents.fileExtension,
      fileSizeBytes: documents.fileSizeBytes,
    })
    .from(documents)
    .where(and(eq(documents.id, input.documentId), eq(documents.orgId, input.orgId)))
    .limit(1);

  const row = rows[0];
  if (!row?.fileObjectId) return null;

  return {
    id: row.id,
    fileObjectId: row.fileObjectId,
    filename: row.filename,
    fileExtension: row.fileExtension,
    fileSizeBytes: Number(row.fileSizeBytes),
  };
}

export type GetDocumentByIdResult = NonNullable<Awaited<ReturnType<typeof getDocumentById>>>;
