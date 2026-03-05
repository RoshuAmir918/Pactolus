import type { IngestSnapshotWorkflowInput } from "../../workflows/ingestSnapshot";

export type ProposeMappingResult = {
  mappingRunId: string;
};

export type ValidateMappingInput = IngestSnapshotWorkflowInput & {
  mappingRunId: string;
  requireConfirmedMapping?: boolean;
};

export type ValidateMappingResult = {
  mappingRunId: string;
  isValid: boolean;
};

export type CanonicalizeInput = IngestSnapshotWorkflowInput & {
  mappingRunId: string;
};

export type CanonicalizeResult = {
  mappingRunId: string;
  canonicalRowsWritten: number;
  ingestionErrorsWritten: number;
};
