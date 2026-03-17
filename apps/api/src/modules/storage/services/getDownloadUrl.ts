import { GetObjectCommand } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { fileObjects } from "@db/schema";
import { s3Client } from "./s3Client";

const { db } = dbClient;

export type GetDownloadUrlInput = {
  orgId: string;
  fileObjectId: string;
};

export type GetDownloadUrlResult = {
  downloadUrl: string;
  expiresAt: Date;
};

export async function getDownloadUrl(input: GetDownloadUrlInput): Promise<GetDownloadUrlResult> {
  const [fileObject] = await db
    .select()
    .from(fileObjects)
    .where(and(eq(fileObjects.id, input.fileObjectId), eq(fileObjects.orgId, input.orgId)))
    .limit(1);

  if (!fileObject || fileObject.status !== "ready") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "File object not found or unavailable",
    });
  }

  const expiresInSeconds = 60 * 10;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  const downloadUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: fileObject.bucket,
      Key: fileObject.objectKey,
    }),
    { expiresIn: expiresInSeconds },
  );

  return {
    downloadUrl,
    expiresAt,
  };
}
