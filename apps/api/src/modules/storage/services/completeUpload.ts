import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { documents, fileObjects, type InsertDocument } from "@db/schema";
import { assertSnapshotAccess } from "@api/modules/guards/services/assertSnapshotAccess";
import { s3Bucket, s3Client } from "./s3Client";

const { db } = dbClient;

export type CompleteUploadInput = {
  orgId: string;
  userId: string;
  snapshotId: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256?: string;
  documentType?: "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other";
};

export type CompleteUploadResult = {
  fileObjectId: string;
  documentId: string;
  status: "pending" | "ready" | "failed" | "deleted";
};

export async function completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult> {
  const snapshot = await assertSnapshotAccess({
    snapshotId: input.snapshotId,
    orgId: input.orgId,
  });

  if (input.bucket !== s3Bucket) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Bucket does not match configured storage bucket",
    });
  }

  const head = await s3Client.send(
    new HeadObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
    }),
  );

  if (typeof head.ContentLength === "number" && head.ContentLength !== input.sizeBytes) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Uploaded object size does not match expected size",
    });
  }

  const [stored] = await db
    .insert(fileObjects)
    .values({
      orgId: input.orgId,
      clientId: snapshot.clientId ?? null,
      snapshotId: input.snapshotId,
      bucket: input.bucket,
      objectKey: input.objectKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256 ?? null,
      status: "ready",
      uploadedByUserId: input.userId,
    })
    .onConflictDoUpdate({
      target: [fileObjects.bucket, fileObjects.objectKey],
      set: {
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256 ?? null,
        snapshotId: input.snapshotId,
        clientId: snapshot.clientId ?? null,
        status: "ready",
        updatedAt: new Date(),
      },
    })
    .returning({ id: fileObjects.id, status: fileObjects.status });

  const [document] = await db
    .insert(documents)
    .values(buildDocumentValues(input, stored.id))
    .onConflictDoUpdate({
      target: [documents.fileObjectId],
      set: {
        orgId: input.orgId,
        snapshotId: input.snapshotId,
        filename: input.fileName,
        mimeType: input.contentType,
        fileExtension: inferFileExtension(input.fileName),
        s3Key: input.objectKey,
        fileHash: input.sha256 ?? null,
        fileSizeBytes: input.sizeBytes,
        uploadedByUserId: input.userId,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning({ id: documents.id });

  return {
    fileObjectId: stored.id,
    documentId: document.id,
    status: stored.status,
  };
}

function buildDocumentValues(input: CompleteUploadInput, fileObjectId: string): InsertDocument {
  return {
    fileObjectId,
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    documentType: input.documentType ?? "other",
    filename: input.fileName,
    mimeType: input.contentType,
    fileExtension: inferFileExtension(input.fileName),
    s3Key: input.objectKey,
    fileHash: input.sha256 ?? null,
    fileSizeBytes: input.sizeBytes,
    uploadedByUserId: input.userId,
    uploadedAt: new Date(),
    aiClassification: "unknown",
    profileStatus: "pending",
    aiStatus: "pending",
  };
}

function inferFileExtension(fileName: string): string | null {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return null;
  }

  return parts[parts.length - 1]?.toLowerCase() ?? null;
}
