import { z } from "zod";
import {
  snapshotStatusEnum,
  documentTypeEnum,
  documentAiClassificationEnum,
  documentProcessStatusEnum,
} from "@db/schema";

export const createSnapshotInputSchema = z.object({
  clientId: z.uuid().optional(),
  label: z.string().min(1),
  accountingPeriod: z.string().min(1).optional(),
});

export const createSnapshotOutputSchema = z.object({
  snapshotId: z.uuid(),
  status: z.enum(snapshotStatusEnum.enumValues),
});

const ingestionStatusSchema = z.object({
  documentId: z.uuid(),
  profileStatus: z.enum(documentProcessStatusEnum.enumValues),
  aiStatus: z.enum(documentProcessStatusEnum.enumValues),
  documentType: z.enum(documentTypeEnum.enumValues),
  aiClassification: z.enum(documentAiClassificationEnum.enumValues),
  sheetCount: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
  errorText: z.string().nullable(),
});

export const startDocumentIngestionInputSchema = z.object({
  snapshotId: z.uuid(),
  documentId: z.uuid(),
});

export const startDocumentIngestionOutputSchema = ingestionStatusSchema;

export const getDocumentIngestionStatusInputSchema = z.object({
  snapshotId: z.uuid(),
  documentId: z.uuid(),
});

export const getDocumentIngestionStatusOutputSchema = ingestionStatusSchema;
