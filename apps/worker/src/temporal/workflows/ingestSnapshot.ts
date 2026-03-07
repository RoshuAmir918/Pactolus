import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

export type IngestSnapshotWorkflowInput = {
  runId: string;
  snapshotId: string;
  snapshotInputId: string;
  orgId: string;
  userId: string;
  entityType: "claim" | "policy";
};

export type IngestSnapshotWorkflowResult = {
  status: "awaiting_confirmation" | "completed" | "failed";
  runId: string;
  snapshotId: string;
  snapshotInputId: string;
  suggestedMappingStepId?: string;
  acceptedMappingStepId?: string;
  canonicalizationStepId?: string;
  reason?: string;
};

const {
  proposeMappingActivity,
  validateMappingActivity,
  canonicalizeActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minute",
  retry: {
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumInterval: "30 seconds",
    maximumAttempts: 3,
  },
});

export async function proposeMappingWorkflow(
  input: IngestSnapshotWorkflowInput,
): Promise<IngestSnapshotWorkflowResult> {
  const { suggestedMappingStepId } = await proposeMappingActivity(input);

  return {
    status: "awaiting_confirmation",
    runId: input.runId,
    snapshotId: input.snapshotId,
    snapshotInputId: input.snapshotInputId,
    suggestedMappingStepId,
  };
}

export type RunCanonicalizationWorkflowInput = IngestSnapshotWorkflowInput & {
  acceptedMappingStepId: string;
};

export async function runCanonicalizationWorkflow(
  input: RunCanonicalizationWorkflowInput,
): Promise<IngestSnapshotWorkflowResult> {
  const validation = await validateMappingActivity({
    ...input,
  });

  if (!validation.isValid) {
    return {
      status: "failed",
      runId: input.runId,
      snapshotId: input.snapshotId,
      snapshotInputId: input.snapshotInputId,
      acceptedMappingStepId: input.acceptedMappingStepId,
      reason: "Mapping validation failed",
    };
  }

  const canonicalization = await canonicalizeActivity({
    ...input,
  });

  return {
    status: "completed",
    runId: input.runId,
    snapshotId: input.snapshotId,
    snapshotInputId: input.snapshotInputId,
    acceptedMappingStepId: input.acceptedMappingStepId,
    canonicalizationStepId: canonicalization.canonicalizationStepId,
  };
}
