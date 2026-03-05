import { NativeConnection, Worker } from "@temporalio/worker";
import { env } from "../../env";
import {
  proposeMappingActivity,
  validateMappingActivity,
  canonicalizeActivity,
} from "../activities";

export async function createIngestionWorker(): Promise<Worker> {
  const connection = await NativeConnection.connect({
    address: env.TEMPORAL_ADDRESS,
  });

  return Worker.create({
    connection,
    namespace: env.TEMPORAL_NAMESPACE,
    taskQueue: env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE,
    workflowsPath: new URL("../workflows/ingestSnapshot.ts", import.meta.url).pathname,
    activities: {
      proposeMappingActivity,
      validateMappingActivity,
      canonicalizeActivity,
    },
  });
}
