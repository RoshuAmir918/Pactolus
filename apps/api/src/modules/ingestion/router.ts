import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { mappingRuns, snapshotInputs, snapshots } from "@db/schema";
import { publicProcedure, router } from "@api/trpc/base";
import {
    startProposeMappingWorkflow,
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
    snapshotInputId: z.uuid(),
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
    mappingRunId: z.uuid(),
    validatedMappingJson: z
        .object({
            entityType: z.enum(["claim", "policy"]),
            mappings: z.array(
                z.object({
                    canonicalField: z.string(),
                    sourceColumns: z.array(z.string()),
                    transform: z.enum(["identity", "sum", "parseDate", "parseMoney"]),
                    confidence: z.number().optional(),
                }),
            ),
        })
        .optional(),
});

const confirmMappingOutputSchema = z.object({
    workflowId: z.string(),
    runId: z.string(),
});

function resolveEntityTypeForFile(file: z.infer<typeof batchUploadFileSchema>): UploadEntityType {
    // AI classification will be added here later.
    if (!file.entityType) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "entityType is currently required until AI classification is enabled",
        });
    }
    return file.entityType;
}

export const ingestionRouter = router({
    createSnapshot: publicProcedure
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

    uploadClaimsCsv: publicProcedure
        .input(uploadCsvInputSchema)
        .output(uploadCsvOutputSchema)
        .mutation(async ({ ctx, input }) => {
            const result = await persistCsvUpload({
                orgId: ctx.orgId,
                snapshotId: input.snapshotId,
                fileName: input.fileName,
                csvText: input.csvText,
                entityType: "claim",
            });
            await startProposeMappingWorkflow({
                snapshotId: input.snapshotId,
                snapshotInputId: result.snapshotInputId,
                orgId: ctx.orgId,
                userId: ctx.userId,
                entityType: "claim",
            });
            return result;
        }),

    uploadPoliciesCsv: publicProcedure
        .input(uploadCsvInputSchema)
        .output(uploadCsvOutputSchema)
        .mutation(async ({ ctx, input }) => {
            const result = await persistCsvUpload({
                orgId: ctx.orgId,
                snapshotId: input.snapshotId,
                fileName: input.fileName,
                csvText: input.csvText,
                entityType: "policy",
            });
            await startProposeMappingWorkflow({
                snapshotId: input.snapshotId,
                snapshotInputId: result.snapshotInputId,
                orgId: ctx.orgId,
                userId: ctx.userId,
                entityType: "policy",
            });
            return result;
        }),

    uploadCsvFiles: publicProcedure
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

            const uploads: PersistCsvUploadResult[] = [];
            for (const file of input.files) {
                const entityType = resolveEntityTypeForFile(file);
                const upload = await persistCsvUpload({
                    orgId: ctx.orgId,
                    snapshotId: input.snapshotId,
                    fileName: file.fileName,
                    csvText: file.csvText,
                    entityType,
                });
                uploads.push(upload);
                await startProposeMappingWorkflow({
                    snapshotId: input.snapshotId,
                    snapshotInputId: upload.snapshotInputId,
                    orgId: ctx.orgId,
                    userId: ctx.userId,
                    entityType,
                });
            }

            return { uploads };
        }),

    confirmMapping: publicProcedure
        .input(confirmMappingInputSchema)
        .output(confirmMappingOutputSchema)
        .mutation(async ({ ctx, input }) => {
            const [run] = await db
                .select({
                    id: mappingRuns.id,
                    snapshotId: mappingRuns.snapshotId,
                    snapshotInputId: mappingRuns.snapshotInputId,
                    aiProposalJson: mappingRuns.aiProposalJson,
                    entityType: snapshotInputs.entityType,
                })
                .from(mappingRuns)
                .innerJoin(snapshots, eq(mappingRuns.snapshotId, snapshots.id))
                .innerJoin(snapshotInputs, eq(mappingRuns.snapshotInputId, snapshotInputs.id))
                .where(
                    and(
                        eq(mappingRuns.id, input.mappingRunId),
                        eq(snapshots.orgId, ctx.orgId),
                    ),
                )
                .limit(1);

            if (!run) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Mapping run not found for this organization",
                });
            }

            const validatedMappingJson =
                input.validatedMappingJson ?? (run.aiProposalJson as object);

            if (!validatedMappingJson) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "No mapping to confirm; AI proposal may not have completed yet",
                });
            }

            await db
                .update(mappingRuns)
                .set({
                    validatedMappingJson: validatedMappingJson as object,
                    status: "validated",
                })
                .where(eq(mappingRuns.id, input.mappingRunId));

            const { workflowId, runId } = await startRunCanonicalizationWorkflow({
                snapshotId: run.snapshotId,
                snapshotInputId: run.snapshotInputId,
                mappingRunId: input.mappingRunId,
                orgId: ctx.orgId,
                userId: ctx.userId,
                entityType: run.entityType,
            });

            return { workflowId, runId };
        }),
});

export type IngestionRouter = typeof ingestionRouter;
