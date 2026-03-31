import { and, asc, eq, ne } from "drizzle-orm";
import dbClient from "@api/db/client";
import { documents } from "@db/schema";

const { db } = dbClient;

export type GetSourceDocumentsInput = {
  orgId: string;
  snapshotId: string;
};

export type SourceDocumentItem = {
  id: string;
  filename: string;
  fileExtension: string | null;
  documentType: string;
  fileSizeBytes: number;
};

export type GetSourceDocumentsResult = {
  documents: SourceDocumentItem[];
};

export async function getSourceDocuments(
  input: GetSourceDocumentsInput,
): Promise<GetSourceDocumentsResult> {
  const rows = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      fileExtension: documents.fileExtension,
      documentType: documents.documentType,
      fileSizeBytes: documents.fileSizeBytes,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, input.orgId),
        eq(documents.snapshotId, input.snapshotId),
        ne(documents.documentType, "workbook_tool"),
      ),
    )
    .orderBy(asc(documents.filename));

  return {
    documents: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      fileExtension: r.fileExtension,
      documentType: r.documentType,
      fileSizeBytes: Number(r.fileSizeBytes),
    })),
  };
}
