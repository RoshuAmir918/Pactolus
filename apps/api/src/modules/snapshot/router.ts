import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, datasetSnapshots, transactions } from "@pactolus/db";
import { snapshotCreateSchema, snapshotIngestRowsSchema } from "@pactolus/validation";
import { authedTenantProcedure, router, tenantProcedure } from "../../trpc/base.js";
import { z } from "zod";

export const snapshotRouter = router({
  create: authedTenantProcedure
    .input(snapshotCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const latest = await db
        .select({ version: datasetSnapshots.version })
        .from(datasetSnapshots)
        .where(
          and(
            eq(datasetSnapshots.orgId, ctx.orgId),
            eq(datasetSnapshots.dealId, input.dealId),
          ),
        )
        .orderBy(desc(datasetSnapshots.version))
        .limit(1);

      const nextVersion = (latest[0]?.version ?? 0) + 1;

      const [snapshot] = await db
        .insert(datasetSnapshots)
        .values({
          orgId: ctx.orgId,
          dealId: input.dealId,
          source: input.source,
          status: "draft",
          version: nextVersion,
          uploadedByUserId: ctx.userId,
        })
        .returning();

      return snapshot;
    }),

  listByDeal: tenantProcedure
    .input(
      z.object({
        dealId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(datasetSnapshots)
        .where(
          and(
            eq(datasetSnapshots.orgId, ctx.orgId),
            eq(datasetSnapshots.dealId, input.dealId),
          ),
        )
        .orderBy(desc(datasetSnapshots.version));
    }),

  get: tenantProcedure
    .input(
      z.object({
        snapshotId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [snapshot] = await db
        .select()
        .from(datasetSnapshots)
        .where(
          and(
            eq(datasetSnapshots.id, input.snapshotId),
            eq(datasetSnapshots.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found for this tenant",
        });
      }

      const [summary] = await db
        .select({
          rowCount: sql<number>`count(*)::int`,
          totalWrittenPremium:
            sql<string>`coalesce(sum(${transactions.writtenPremium}), 0)::text`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.orgId, ctx.orgId),
            eq(transactions.snapshotId, input.snapshotId),
          ),
        );

      return {
        snapshot,
        stats: {
          rowCount: summary?.rowCount ?? 0,
          totalWrittenPremium: summary?.totalWrittenPremium ?? "0",
        },
      };
    }),

  ingestRows: authedTenantProcedure
    .input(snapshotIngestRowsSchema)
    .mutation(async ({ ctx, input }) => {
      const [snapshot] = await db
        .select()
        .from(datasetSnapshots)
        .where(
          and(
            eq(datasetSnapshots.id, input.snapshotId),
            eq(datasetSnapshots.orgId, ctx.orgId),
          ),
        )
        .limit(1);

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Snapshot not found for this tenant",
        });
      }

      await db.insert(transactions).values(
        input.rows.map((row) => ({
          orgId: ctx.orgId,
          snapshotId: input.snapshotId,
          sourceTransactionId: row.sourceTransactionId ?? null,
          contractName: row.contractName ?? null,
          cedent: row.cedent ?? null,
          broker: row.broker ?? null,
          lineOfBusiness: row.lineOfBusiness ?? null,
          region: row.region ?? null,
          inceptionDate: row.inceptionDate ? new Date(row.inceptionDate) : null,
          expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
          writtenPremium:
            row.writtenPremium === undefined || row.writtenPremium === null
              ? null
              : row.writtenPremium.toString(),
          expectedLoss:
            row.expectedLoss === undefined || row.expectedLoss === null
              ? null
              : row.expectedLoss.toString(),
          attachmentPoint:
            row.attachmentPoint === undefined || row.attachmentPoint === null
              ? null
              : row.attachmentPoint.toString(),
          coverageLimit:
            row.coverageLimit === undefined || row.coverageLimit === null
              ? null
              : row.coverageLimit.toString(),
          sharePercent:
            row.sharePercent === undefined || row.sharePercent === null
              ? null
              : row.sharePercent.toString(),
        })),
      );

      return {
        snapshotId: input.snapshotId,
        ingestedRows: input.rows.length,
      };
    }),
});
