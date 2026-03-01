import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { datasetSnapshots } from "./snapshots";
import { organizations } from "./organizations";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => datasetSnapshots.id, { onDelete: "cascade" }),
    sourceTransactionId: text("source_transaction_id"),
    contractName: text("contract_name"),
    cedent: text("cedent"),
    broker: text("broker"),
    lineOfBusiness: text("line_of_business"),
    region: text("region"),
    inceptionDate: timestamp("inception_date", { withTimezone: true }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    writtenPremium: numeric("written_premium", { precision: 18, scale: 2 }),
    expectedLoss: numeric("expected_loss", { precision: 18, scale: 2 }),
    attachmentPoint: numeric("attachment_point", { precision: 18, scale: 2 }),
    coverageLimit: numeric("coverage_limit", { precision: 18, scale: 2 }),
    sharePercent: numeric("share_percent", { precision: 8, scale: 4 }),
  },
  (table) => ({
    orgIdIdx: index("transactions_org_id_idx").on(table.orgId),
    snapshotIdIdx: index("transactions_snapshot_id_idx").on(table.snapshotId),
  }),
);
