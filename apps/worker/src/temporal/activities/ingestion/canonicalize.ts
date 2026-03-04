import type { CanonicalizeInput, CanonicalizeResult } from "./types";

export async function canonicalizeActivity(
  input: CanonicalizeInput,
): Promise<CanonicalizeResult> {
  // TODO: apply validated mapping to raw_rows and write canonical tables.
  return {
    mappingRunId: input.mappingRunId,
    canonicalRowsWritten: 0,
    ingestionErrorsWritten: 0,
  };
}
