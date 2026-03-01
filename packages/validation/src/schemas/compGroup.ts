import { z } from "zod";

export const compGroupFilterSchema = z.object({
  industry: z.array(z.string()).default([]),
  geographies: z.array(z.string()).default([]),
  buyerTypes: z.array(z.string()).default([]),
});
