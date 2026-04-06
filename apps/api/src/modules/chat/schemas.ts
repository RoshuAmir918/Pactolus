import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

export const sendMessageInputSchema = z.object({
  snapshotId: z.uuid(),
  runId: z.uuid().nullable(),
  operationId: z.uuid().nullable().optional(),
  messages: z.array(chatMessageSchema).min(1),
  selectedRange: z.string().nullable().optional(),
});

export const sendMessageOutputSchema = z.object({
  reply: z.string(),
  excelAction: z
    .object({
      type: z.literal("write_range"),
      startCell: z.string(),
      values: z.array(z.array(z.unknown())),
      sheetName: z.string().optional(),
      description: z.string(),
    })
    .nullable()
    .optional(),
});
