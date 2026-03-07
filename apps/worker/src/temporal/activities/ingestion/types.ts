import type { IngestSnapshotWorkflowInput } from "../../workflows/ingestSnapshot";

export type ProposeMappingResult = {
  suggestedMappingStepId: string;
};

export type ValidateMappingInput = IngestSnapshotWorkflowInput & {
  acceptedMappingStepId: string;
};

export type ValidateMappingResult = {
  acceptedMappingStepId: string;
  isValid: boolean;
};

export type CanonicalizeInput = IngestSnapshotWorkflowInput & {
  acceptedMappingStepId: string;
};

export type CanonicalizeResult = {
  acceptedMappingStepId: string;
  canonicalizationStepId: string;
  canonicalRowsWritten: number;
  ingestionErrorsWritten: number;
};
