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
  status: "completed" | "failed";
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

export async function ingestSnapshotWorkflow(
  input: IngestSnapshotWorkflowInput,
): Promise<IngestSnapshotWorkflowResult> {
  const { mappingRunId } = await proposeMappingActivity(input);

  const validation = await validateMappingActivity({
    ...input,
    mappingRunId,
  });

  if (!validation.isValid) {
    return {
      status: "failed",
      snapshotId: input.snapshotId,
      snapshotInputId: input.snapshotInputId,
      mappingRunId,
      reason: "Mapping validation failed",
    };
  }

  await canonicalizeActivity({
    ...input,
    mappingRunId,
  });

  return {
    status: "completed",
    snapshotId: input.snapshotId,
    snapshotInputId: input.snapshotInputId,
    mappingRunId,
  };
}
