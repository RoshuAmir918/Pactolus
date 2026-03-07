import { Client, Connection } from "@temporalio/client";
import { env } from "../env";
import type {
  IngestSnapshotWorkflowInput,
  IngestSnapshotWorkflowResult,
  RunCanonicalizationWorkflowInput,
} from "./workflows/ingestSnapshot";
import { proposeMappingWorkflow, runCanonicalizationWorkflow } from "./workflows/ingestSnapshot";

let cachedClient: Client | null = null;

async function getTemporalClient(): Promise<Client> {
  if (cachedClient) {
    return cachedClient;
  }

  const connection = await Connection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  cachedClient = new Client({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
  });

  return cachedClient;
}

export async function executeProposeMappingWorkflow(
  input: IngestSnapshotWorkflowInput,
): Promise<
  IngestSnapshotWorkflowResult & {
    workflowId: string;
    workflowRunId: string;
  }
> {
  const client = await getTemporalClient();
  const handle = await client.workflow.start(proposeMappingWorkflow, {
    taskQueue: env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE,
    args: [input],
    workflowId: `propose-${input.runId}-${input.snapshotInputId}`,
  });

  const result = await handle.result();

  return {
    workflowId: handle.workflowId,
    workflowRunId: handle.firstExecutionRunId,
    ...result,
  };
}

export async function startProposeMappingWorkflow(input: IngestSnapshotWorkflowInput): Promise<{
  workflowId: string;
  workflowRunId: string;
}> {
  const client = await getTemporalClient();
  const handle = await client.workflow.start(proposeMappingWorkflow, {
    taskQueue: env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE,
    args: [input],
    workflowId: `propose-${input.runId}-${input.snapshotInputId}`,
  });

  return {
    workflowId: handle.workflowId,
    workflowRunId: handle.firstExecutionRunId,
  };
}

export async function startRunCanonicalizationWorkflow(
  input: RunCanonicalizationWorkflowInput,
): Promise<{
  workflowId: string;
  workflowRunId: string;
}> {
  const client = await getTemporalClient();
  const handle = await client.workflow.start(runCanonicalizationWorkflow, {
    taskQueue: env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE,
    args: [input],
    workflowId: `canonicalize-${input.acceptedMappingStepId}`,
  });

  return {
    workflowId: handle.workflowId,
    workflowRunId: handle.firstExecutionRunId,
  };
}
