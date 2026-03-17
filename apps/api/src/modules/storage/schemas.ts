import { z } from "zod";

export const getUploadUrlInputSchema = z.object({
  snapshotId: z.uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const getUploadUrlOutputSchema = z.object({
  bucket: z.string(),
  objectKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.date(),
});

export const completeUploadInputSchema = z.object({
  snapshotId: z.uuid(),
  bucket: z.string().min(1),
  objectKey: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().min(1).optional(),
});

export const completeUploadOutputSchema = z.object({
  fileObjectId: z.uuid(),
  documentId: z.uuid(),
  status: z.enum(["pending", "ready", "failed", "deleted"]),
});

export const getDownloadUrlInputSchema = z.object({
  fileObjectId: z.uuid(),
});

export const getDownloadUrlOutputSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.date(),
});

export const listBySnapshotInputSchema = z.object({
  snapshotId: z.uuid(),
});

export const listBySnapshotOutputSchema = z.array(
  z.object({
    id: z.string().uuid(),
    fileName: z.string(),
    contentType: z.string(),
    sizeBytes: z.number(),
    createdAt: z.date(),
  }),
);

export const deleteFileInputSchema = z.object({
  fileObjectId: z.uuid(),
});

export const deleteFileOutputSchema = z.object({
  fileObjectId: z.uuid(),
  status: z.literal("deleted"),
});