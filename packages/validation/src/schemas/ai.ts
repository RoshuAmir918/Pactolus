import { z } from "zod";

export const aiFilterPlanSchema = z.object({
  rationale: z.string(),
  filters: z.record(z.string(), z.unknown()),
});
