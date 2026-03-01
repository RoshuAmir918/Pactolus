import { z } from "zod";

export const transactionSchema = z.object({
  sourceTransactionId: z.string().min(1).optional(),
  contractName: z.string().min(1).optional(),
  cedent: z.string().min(1).optional(),
  broker: z.string().min(1).optional(),
  lineOfBusiness: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  inceptionDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  writtenPremium: z.number().nonnegative().nullable().optional(),
  expectedLoss: z.number().nonnegative().nullable().optional(),
  attachmentPoint: z.number().nonnegative().nullable().optional(),
  coverageLimit: z.number().nonnegative().nullable().optional(),
  sharePercent: z.number().min(0).max(100).nullable().optional(),
});
