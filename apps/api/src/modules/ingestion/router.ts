import { TRPCError } from "@trpc/server";
import { z } from "zod";
import dbClient from "@api/db/client";
import { snapshots } from "@db/schema";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "@api/trpc/base";
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
        .mutation(async ({ ctx, input }) =>
            persistCsvUpload({
                orgId: ctx.orgId,
                snapshotId: input.snapshotId,
                fileName: input.fileName,
                csvText: input.csvText,
                entityType: "claim",
            }),
        ),

    uploadPoliciesCsv: publicProcedure
        .input(uploadCsvInputSchema)
        .output(uploadCsvOutputSchema)
        .mutation(async ({ ctx, input }) =>
            persistCsvUpload({
                orgId: ctx.orgId,
                snapshotId: input.snapshotId,
                fileName: input.fileName,
                csvText: input.csvText,
                entityType: "policy",
            }),
        ),

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
            }

            return { uploads };
        }),
});

export type IngestionRouter = typeof ingestionRouter;
