import { and, eq } from "drizzle-orm";
import { db, pool } from "./client";
import { deals, organizations, users } from "./schema";

async function main(): Promise<void> {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Pactolus Demo Org" })
    .onConflictDoNothing()
    .returning();

  let organizationId: string | null = org?.id ?? null;

  if (!organizationId) {
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.name, "Pactolus Demo Org"),
    });
    organizationId = existingOrg?.id ?? null;
  }

  if (!organizationId) {
    throw new Error("Could not resolve organization id during seed");
  }

  const [user] = await db
    .insert(users)
    .values({
      orgId: organizationId,
      email: "associate@pactolus.dev",
      fullName: "Pactolus Associate",
      role: "associate",
    })
    .onConflictDoNothing()
    .returning();

  let userId: string | null = user?.id ?? null;

  if (!userId) {
    const existingUser = await db.query.users.findFirst({
      where: and(
        eq(users.orgId, organizationId),
        eq(users.email, "associate@pactolus.dev"),
      ),
    });
    userId = existingUser?.id ?? null;
  }

  await db
    .insert(deals)
    .values({
      orgId: organizationId,
      name: "Demo Process",
      status: "active",
      createdByUserId: userId,
    })
    .onConflictDoNothing();

  console.log("Seed complete:", {
    orgId: organizationId,
    userId,
  });
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
