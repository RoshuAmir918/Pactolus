import { z } from "zod";
import { createSelectSchema } from "drizzle-zod";
import { documentTypeEnum, fileObjectStatusEnum, documents } from "@db/schema";

// Derived from DB table — stays in sync automatically
const sourceDocumentSchema = createSelectSchema(documents).pick({
  id: true,
  fileObjectId: true,
  filename: true,
  fileExtension: true,
  documentType: true,
  fileSizeBytes: true,
});

export const getUploadUrlInputSchema = z.object({
  snapshotId: z.uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const getUploadUrlOutputSchema = z.object({
  bucket: z.string(),
  objectKey: z.string(),
  uploadUrl: z.url(),
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
  documentType: z.enum(documentTypeEnum.enumValues).optional(),
});

export const completeUploadOutputSchema = z.object({
  fileObjectId: z.uuid(),
  documentId: z.uuid(),
  status: z.enum(fileObjectStatusEnum.enumValues),
});

export const getDownloadUrlInputSchema = z.object({
  fileObjectId: z.uuid(),
});

export const getDownloadUrlOutputSchema = z.object({
  downloadUrl: z.url(),
  expiresAt: z.date(),
});

export const listBySnapshotInputSchema = z.object({
  snapshotId: z.uuid(),
});

export const listBySnapshotOutputSchema = z.array(
  z.object({
    id: z.uuid(),
    fileName: z.string(),
    contentType: z.string(),
    sizeBytes: z.number(),
    createdAt: z.date(),
  }),
);

export const getDownloadUrlByDocumentInputSchema = z.object({
  documentId: z.uuid(),
});

export const getSourceDocumentsInputSchema = z.object({
  snapshotId: z.uuid(),
});

export const getSourceDocumentsOutputSchema = z.object({
  documents: z.array(sourceDocumentSchema),
});

export const getDocumentByIdInputSchema = z.object({
  documentId: z.uuid(),
});

export const getDocumentByIdOutputSchema = createSelectSchema(documents)
  .pick({
    id: true,
    fileObjectId: true,
    filename: true,
    fileExtension: true,
    fileSizeBytes: true,
  })
  .nullable();

export const deleteFileInputSchema = z.object({
  fileObjectId: z.uuid(),
});

export const deleteFileOutputSchema = z.object({
  fileObjectId: z.uuid(),
  status: z.literal("deleted"),
});
