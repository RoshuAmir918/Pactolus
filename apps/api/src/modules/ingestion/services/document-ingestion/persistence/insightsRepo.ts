import dbClient from "@api/db/client";
import { documentInsights } from "@db/schema";
import type { InsightType, TargetDocument } from "../shared/types";

const { db } = dbClient;

export async function insertInsights(
  target: TargetDocument,
  insights: Array<{
    insightType: InsightType;
    title: string;
    payloadJson: unknown;
    confidence: string | null;
  }>,
) {
  if (insights.length === 0) {
    return;
  }
  await db.insert(documentInsights).values(
    insights.map((insight) => ({
      documentId: target.documentId,
      sheetId: null,
      orgId: target.orgId,
      snapshotId: target.snapshotId,
      insightType: insight.insightType,
      title: insight.title,
      payloadJson: insight.payloadJson ?? {},
      confidence: insight.confidence,
      source: "ai",
    })),
  );
}
