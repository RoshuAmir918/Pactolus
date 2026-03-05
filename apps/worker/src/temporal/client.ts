import { Client, Connection } from "@temporalio/client";
import { env } from "../env";
import type {
  IngestSnapshotWorkflowInput,
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

export async function startProposeMappingWorkflow(input: IngestSnapshotWorkflowInput): Promise<{
  workflowId: string;
  runId: string;
}> {
  const client = await getTemporalClient();
  const handle = await client.workflow.start(proposeMappingWorkflow, {
    taskQueue: env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE,
    args: [input],
    workflowId: `propose-${input.snapshotInputId}`,
  });

  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}

export async function startRunCanonicalizationWorkflow(
  input: RunCanonicalizationWorkflowInput,
): Promise<{
  workflowId: string;
  runId: string;
}> {
  const client = await getTemporalClient();
  const handle = await client.workflow.start(runCanonicalizationWorkflow, {
    taskQueue: env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE,
    args: [input],
    workflowId: `canonicalize-${input.mappingRunId}`,
  });

  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}
