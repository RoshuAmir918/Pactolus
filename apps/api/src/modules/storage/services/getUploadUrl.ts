import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Bucket, s3Client } from "./s3Client";

export type GetUploadUrlInput = {
  orgId: string;
  snapshotId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type GetUploadUrlResult = {
  bucket: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: Date;
};

export async function getUploadUrl(input: GetUploadUrlInput): Promise<GetUploadUrlResult> {
  const objectKey = buildObjectKey(input);
  const expiresInSeconds = 60 * 15;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: objectKey,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: expiresInSeconds,
  });

  return {
    bucket: s3Bucket,
    objectKey,
    uploadUrl,
    expiresAt,
  };
}

function buildObjectKey(input: {
  orgId: string;
  snapshotId: string;
  fileName: string;
}): string {
  const sanitizedFileName = sanitizeFileName(input.fileName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nonce = randomUUID();
  return `orgs/${input.orgId}/snapshots/${input.snapshotId}/raw/${timestamp}_${nonce}_${sanitizedFileName}`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}
