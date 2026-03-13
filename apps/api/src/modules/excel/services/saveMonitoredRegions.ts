import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { excelMonitoredRegions } from "@db/schema";
import { assertSnapshotAccess } from "./assertSnapshotAccess";

const { db } = dbClient;

export type SaveMonitoredRegionsInput = {
  orgId: string;
  userId: string;
  snapshotId: string;
  sheetName: string;
  regions: Array<{
    address: string;
    regionType: "input" | "output";
    confidencePercent: number;
    userConfirmed: boolean;
  }>;
};

export type SaveMonitoredRegionsResult = {
  regions: Array<{
    id: string;
    snapshotId: string;
    sheetName: string;
    address: string;
    regionType: "input" | "output";
    confidencePercent: number;
    userConfirmed: boolean;
    status: "active" | "archived";
  }>;
};

export async function saveMonitoredRegions(
  input: SaveMonitoredRegionsInput,
): Promise<SaveMonitoredRegionsResult> {
  await assertSnapshotAccess({
    snapshotId: input.snapshotId,
    orgId: input.orgId,
  });

  const now = new Date();
  const values: Array<typeof excelMonitoredRegions.$inferInsert> = input.regions.map((region) => ({
    orgId: input.orgId,
    snapshotId: input.snapshotId,
    sheetName: input.sheetName,
    address: region.address,
    regionType: region.regionType,
    confidencePercent: region.confidencePercent,
    userConfirmed: region.userConfirmed,
    status: "active",
    createdByUserId: input.userId,
  }));

  await db
    .update(excelMonitoredRegions)
    .set({
      status: "archived",
      updatedAt: now,
    })
    .where(
      and(
        eq(excelMonitoredRegions.orgId, input.orgId),
        eq(excelMonitoredRegions.snapshotId, input.snapshotId),
        eq(excelMonitoredRegions.sheetName, input.sheetName),
        eq(excelMonitoredRegions.status, "active"),
      ),
    );

  const created = await db
    .insert(excelMonitoredRegions)
    .values(values)
    .returning();

  return {
    regions: created.map((region) => ({
      id: region.id,
      snapshotId: region.snapshotId,
      sheetName: region.sheetName,
      address: region.address,
      regionType: region.regionType,
      confidencePercent: region.confidencePercent,
      userConfirmed: region.userConfirmed,
      status: region.status,
    })),
  };
}
