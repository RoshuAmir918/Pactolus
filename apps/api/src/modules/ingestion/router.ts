import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { mappingProposalSchema } from "@db/mappingSchema";
import { appendRunStep, ensureRunForSnapshot } from "@db/runHistory";
import { runSteps, runs, snapshotInputs, snapshots } from "@db/schema";
import { authenticatedProcedure, router } from "@api/trpc/base";
import {
  executeProposeMappingWorkflow,
  startRunCanonicalizationWorkflow,
} from "@worker/temporal/client";
import {
  persistCsvUpload,
  type PersistCsvUploadResult,
  type UploadEntityType,
} from "./services/persistUpload";

const { db } = dbClient;

const entityTypeSchema = z.enum(["claim", "policy"]);

const createSnapshotInputSchema = z.object({
  label: z.string().min(1),
  accountingPeriod: z.string().min(1).optional(),
});

const createSnapshotOutputSchema = z.object({
  snapshotId: z.uuid(),
  status: z.enum(["draft", "ingesting", "ready", "failed"]),
});

const uploadCsvInputSchema = z.object({
  snapshotId: z.uuid(),
  fileName: z.string().min(1),
  csvText: z.string().min(1),
});

const uploadCsvOutputSchema = z.object({
  runId: z.uuid(),
  uploadStepId: z.uuid(),
  snapshotInputId: z.uuid(),
  suggestedMappingStepId: z.uuid(),
  entityType: entityTypeSchema,
  detectedColumns: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  sampleRows: z.array(z.record(z.string(), z.string())).max(5),
});

const batchUploadFileSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1),
  entityType: entityTypeSchema.optional(),
});

const uploadBatchCsvInputSchema = z.object({
  snapshotId: z.uuid(),
  files: z.array(batchUploadFileSchema).min(1),
});

const uploadBatchCsvOutputSchema = z.object({
  uploads: z.array(uploadCsvOutputSchema),
});

const confirmMappingInputSchema = z.object({
  runId: z.uuid(),
  snapshotInputId: z.uuid(),
  suggestedMappingStepId: z.uuid(),
  acceptedMappingJson: mappingProposalSchema.optional(),
});

const confirmMappingOutputSchema = z.object({
  acceptedMappingStepId: z.uuid(),
  workflowId: z.string(),
  workflowRunId: z.string(),
});

function resolveEntityTypeForFile(file: z.infer<typeof batchUploadFileSchema>): UploadEntityType {
  if (!file.entityType) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "entityType is currently required until AI classification is enabled",
    });
  }

  return file.entityType;
}

async function uploadCsvAndSuggestMapping(input: {
  orgId: string;
  userId: string;
  snapshotId: string;
  fileName: string;
  csvText: string;
  entityType: UploadEntityType;
}): Promise<
  PersistCsvUploadResult & {
    runId: string;
    uploadStepId: string;
    suggestedMappingStepId: string;
  }
> {
  const run = await ensureRunForSnapshot(db, {
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    createdByUserId: input.userId,
  });

  const persisted = await persistCsvUpload({
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    fileName: input.fileName,
    csvText: input.csvText,
    entityType: input.entityType,
  });

  await db
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(runs.id, run.id));

  const uploadStep = await appendRunStep(db, {
    runId: run.id,
    snapshotInputId: persisted.snapshotInputId,
    stepType: "UPLOAD_DATASET",
    actorType: "user",
    actorId: input.userId,
    parametersJson: {
      snapshotId: input.snapshotId,
      snapshotInputId: persisted.snapshotInputId,
      entityType: input.entityType,
      fileName: input.fileName,
      rowCount: persisted.rowCount,
      detectedColumns: persisted.detectedColumns,
    },
  });

  const proposal = await executeProposeMappingWorkflow({
    runId: run.id,
    snapshotId: input.snapshotId,
    snapshotInputId: persisted.snapshotInputId,
    orgId: input.orgId,
    userId: input.userId,
    entityType: input.entityType,
  });

  if (!proposal.suggestedMappingStepId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Mapping proposal workflow completed without a suggested mapping step",
    });
  }

  return {
    ...persisted,
    runId: run.id,
    uploadStepId: uploadStep.id,
    suggestedMappingStepId: proposal.suggestedMappingStepId,
  };
}

export const ingestionRouter = router({
  createSnapshot: authenticatedProcedure
    .input(createSnapshotInputSchema)
    .output(createSnapshotOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(snapshots)
        .values({
          orgId: ctx.orgId,
          createdByUserId: ctx.userId,
          label: input.label,
          accountingPeriod: input.accountingPeriod,
          status: "draft",
        })
        .returning({ snapshotId: snapshots.id, status: snapshots.status });

      return created;
    }),

  uploadClaimsCsv: authenticatedProcedure
    .input(uploadCsvInputSchema)
    .output(uploadCsvOutputSchema)
    .mutation(async ({ ctx, input }) =>
      uploadCsvAndSuggestMapping({
        orgId: ctx.orgId,
        userId: ctx.userId,
        snapshotId: input.snapshotId,
        fileName: input.fileName,
        csvText: input.csvText,
        entityType: "claim",
      }),
    ),

  uploadPoliciesCsv: authenticatedProcedure
    .input(uploadCsvInputSchema)
    .output(uploadCsvOutputSchema)
    .mutation(async ({ ctx, input }) =>
      uploadCsvAndSuggestMapping({
        orgId: ctx.orgId,
        userId: ctx.userId,
        snapshotId: input.snapshotId,
        fileName: input.fileName,
        csvText: input.csvText,
        entityType: "policy",
      }),
    ),

  uploadCsvFiles: authenticatedProcedure
    .input(uploadBatchCsvInputSchema)
    .output(uploadBatchCsvOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const [snapshot] = await db
        .select({ id: snapshots.id, orgId: snapshots.orgId })
        .from(snapshots)
        .where(eq(snapshots.id, input.snapshotId))
        .limit(1);

      if (!snapshot || snapshot.orgId !== ctx.orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found for this organization",
        });
      }

      const uploads: Array<z.infer<typeof uploadCsvOutputSchema>> = [];
      for (const file of input.files) {
        const entityType = resolveEntityTypeForFile(file);
        const upload = await uploadCsvAndSuggestMapping({
          orgId: ctx.orgId,
          userId: ctx.userId,
          snapshotId: input.snapshotId,
          fileName: file.fileName,
          csvText: file.csvText,
          entityType,
        });
        uploads.push(upload);
      }

      return { uploads };
    }),

  confirmMapping: authenticatedProcedure
    .input(confirmMappingInputSchema)
    .output(confirmMappingOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const [suggestedStep] = await db
        .select({
          id: runSteps.id,
          runId: runSteps.runId,
          snapshotInputId: runSteps.snapshotInputId,
          parametersJson: runSteps.parametersJson,
          entityType: snapshotInputs.entityType,
          snapshotId: runs.snapshotId,
        })
        .from(runSteps)
        .innerJoin(runs, eq(runSteps.runId, runs.id))
        .innerJoin(snapshotInputs, eq(runSteps.snapshotInputId, snapshotInputs.id))
        .where(
          and(
            eq(runSteps.id, input.suggestedMappingStepId),
            eq(runSteps.runId, input.runId),
            eq(runSteps.snapshotInputId, input.snapshotInputId),
            eq(runSteps.stepType, "SUGGESTED_MAPPING"),
            eq(runs.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (!suggestedStep) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Suggested mapping step not found for this organization",
        });
      }

      const acceptedMapping = input.acceptedMappingJson
        ? mappingProposalSchema.parse(input.acceptedMappingJson)
        : mappingProposalSchema.parse(suggestedStep.parametersJson);

      const acceptedStep = await appendRunStep(db, {
        runId: input.runId,
        snapshotInputId: input.snapshotInputId,
        stepType: "ACCEPTED_MAPPING",
        actorType: "user",
        actorId: ctx.userId,
        supersedesStepId: input.suggestedMappingStepId,
        parametersJson: acceptedMapping,
      });

      await db
        .update(runs)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(runs.id, input.runId));

      const { workflowId, workflowRunId } = await startRunCanonicalizationWorkflow({
        runId: input.runId,
        snapshotId: suggestedStep.snapshotId,
        snapshotInputId: input.snapshotInputId,
        acceptedMappingStepId: acceptedStep.id,
        orgId: ctx.orgId,
        userId: ctx.userId,
        entityType: suggestedStep.entityType,
      });

      return {
        acceptedMappingStepId: acceptedStep.id,
        workflowId,
        workflowRunId,
      };
    }),
});

export type IngestionRouter = typeof ingestionRouter;
