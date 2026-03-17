import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { anthropicFiles, documents, fileObjects, snapshotAnthropicFiles } from "@db/schema";
import { and, count, eq } from "drizzle-orm";

const { db } = dbClient;

export type DeleteFileObjectInput = {
  orgId: string;
  fileObjectId: string;
};

export type DeleteFileObjectResult = {
  fileObjectId: string;
  status: "deleted";
};

export async function deleteFileObject(
  input: DeleteFileObjectInput,
): Promise<DeleteFileObjectResult> {
  const [updated] = await db
    .update(fileObjects)
    .set({
      status: "deleted",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(fileObjects.id, input.fileObjectId), eq(fileObjects.orgId, input.orgId)))
    .returning({ id: fileObjects.id, status: fileObjects.status });

  if (!updated) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "File not found",
    });
  }

  if (updated.status !== "deleted") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to mark file as deleted",
    });
  }

  const [document] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.fileObjectId, updated.id))
    .limit(1);

  if (document) {
    const mappings = await db
      .update(snapshotAnthropicFiles)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(snapshotAnthropicFiles.documentId, document.id),
          eq(snapshotAnthropicFiles.status, "active"),
        ),
      )
      .returning({ fileRefId: snapshotAnthropicFiles.anthropicFileRefId });

    for (const mapping of mappings) {
      const [remaining] = await db
        .select({ count: count() })
        .from(snapshotAnthropicFiles)
        .where(
          and(
            eq(snapshotAnthropicFiles.anthropicFileRefId, mapping.fileRefId),
            eq(snapshotAnthropicFiles.status, "active"),
          ),
        );

      if (Number(remaining?.count ?? 0) > 0) {
        continue;
      }

      const [fileRef] = await db
        .select({
          id: anthropicFiles.id,
          anthropicFileId: anthropicFiles.anthropicFileId,
          status: anthropicFiles.status,
        })
        .from(anthropicFiles)
        .where(eq(anthropicFiles.id, mapping.fileRefId))
        .limit(1);

      if (!fileRef || fileRef.status !== "active") {
        continue;
      }

      try {
        await deleteAnthropicFile(fileRef.anthropicFileId);
      } catch {
        // Best-effort cleanup. We still mark as deleted locally to avoid repeated attempts.
      }

      await db
        .update(anthropicFiles)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(anthropicFiles.id, fileRef.id));
    }
  }

  return {
    fileObjectId: updated.id,
    status: "deleted",
  };
}

async function deleteAnthropicFile(anthropicFileId: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch(`https://api.anthropic.com/v1/files/${anthropicFileId}`, {
    method: "DELETE",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "files-api-2025-04-14",
    },
  });

  if (!response.ok) {
    throw new Error(`Anthropic file delete failed (${response.status})`);
  }
}

