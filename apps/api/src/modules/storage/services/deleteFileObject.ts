import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { fileObjects } from "@db/schema";
import { and, eq } from "drizzle-orm";

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

  return {
    fileObjectId: updated.id,
    status: "deleted",
  };
}
