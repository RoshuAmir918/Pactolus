import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

export type IngestSnapshotWorkflowInput = {
  snapshotId: string;
  snapshotInputId: string;
  orgId: string;
  userId: string;
  entityType: "claim" | "policy";
};

export type IngestSnapshotWorkflowResult = {
  status: "awaiting_confirmation" | "completed" | "failed";
  snapshotId: string;
  snapshotInputId: string;
  mappingRunId?: string;
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
  const { mappingRunId } = await proposeMappingActivity(input);

  return {
    status: "awaiting_confirmation",
    snapshotId: input.snapshotId,
    snapshotInputId: input.snapshotInputId,
    mappingRunId,
  };
}

export type RunCanonicalizationWorkflowInput = IngestSnapshotWorkflowInput & {
  mappingRunId: string;
};

export async function runCanonicalizationWorkflow(
  input: RunCanonicalizationWorkflowInput,
): Promise<IngestSnapshotWorkflowResult> {
  const validation = await validateMappingActivity({
    ...input,
    requireConfirmedMapping: true,
  });

  if (!validation.isValid) {
    return {
      status: "failed",
      snapshotId: input.snapshotId,
      snapshotInputId: input.snapshotInputId,
      mappingRunId: input.mappingRunId,
      reason: "Mapping validation failed",
    };
  }

  await canonicalizeActivity({
    ...input,
  });

  return {
    status: "completed",
    snapshotId: input.snapshotId,
    snapshotInputId: input.snapshotInputId,
    mappingRunId: input.mappingRunId,
  };
}
