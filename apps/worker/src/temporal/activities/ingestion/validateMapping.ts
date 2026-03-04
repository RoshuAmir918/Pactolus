import type { ValidateMappingInput, ValidateMappingResult } from "./types";

export async function validateMappingActivity(
  input: ValidateMappingInput,
): Promise<ValidateMappingResult> {
  // TODO: run structural + required + sample execution gates.
  return {
    mappingRunId: input.mappingRunId,
    isValid: true,
  };
}
