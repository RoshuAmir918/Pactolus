import { and, asc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { excelMonitoredRegions } from "@db/schema";
import { assertSnapshotAccess } from "./assertSnapshotAccess";

const { db } = dbClient;

export type GetMonitoredRegionsInput = {
  orgId: string;
  snapshotId: string;
  sheetName: string;
};

export type GetMonitoredRegionsResult = {
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

export async function getMonitoredRegions(
  input: GetMonitoredRegionsInput,
): Promise<GetMonitoredRegionsResult> {
  await assertSnapshotAccess({
    snapshotId: input.snapshotId,
    orgId: input.orgId,
  });

  const regions = await db
    .select()
    .from(excelMonitoredRegions)
    .where(
      and(
        eq(excelMonitoredRegions.orgId, input.orgId),
        eq(excelMonitoredRegions.snapshotId, input.snapshotId),
        eq(excelMonitoredRegions.sheetName, input.sheetName),
        eq(excelMonitoredRegions.status, "active"),
      ),
    )
    .orderBy(asc(excelMonitoredRegions.regionType), asc(excelMonitoredRegions.createdAt));

  return {
    regions: regions.map((region) => ({
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
