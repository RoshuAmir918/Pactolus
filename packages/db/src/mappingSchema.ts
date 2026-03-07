import { z } from "zod";

export const mappingRuleSchema = z.object({
  canonicalField: z.string().min(1),
  sourceColumns: z.array(z.string().min(1)).min(1),
  transform: z.enum(["identity", "sum", "parseDate", "parseMoney"]),
  confidence: z.number().min(0).max(1).optional(),
});

export const mappingProposalSchema = z.object({
  entityType: z.enum(["claim", "policy"]),
  mappings: z.array(mappingRuleSchema),
});

export type MappingProposal = z.infer<typeof mappingProposalSchema>;
export type MappingRule = z.infer<typeof mappingRuleSchema>;
