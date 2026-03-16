import { and, asc, desc, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { authenticatedProcedure, router } from "@api/trpc/base";
import { clients, organizations, snapshots } from "@db/schema";

const { db } = dbClient;

export const organizationsRouter = router({
  myOrg: authenticatedProcedure.query(async ({ ctx }) => {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);

    return organization ?? null;
  }),

  myClients: authenticatedProcedure.query(async ({ ctx }) => {
    const orgClients = await db
      .select({
        id: clients.id,
        name: clients.name,
        status: clients.status,
      })
      .from(clients)
      .where(and(eq(clients.orgId, ctx.orgId), eq(clients.status, "active")))
      .orderBy(asc(clients.name));

    return orgClients.map((client) => ({
      id: client.id,
      name: client.name,
      status: client.status,
    }));
  }),

  mySnapshots: authenticatedProcedure.query(async ({ ctx }) => {
    const orgSnapshots = await db
      .select({
        id: snapshots.id,
        clientId: snapshots.clientId,
        label: snapshots.label,
        accountingPeriod: snapshots.accountingPeriod,
        status: snapshots.status,
        createdAt: snapshots.createdAt,
      })
      .from(snapshots)
      .where(eq(snapshots.orgId, ctx.orgId))
      .orderBy(desc(snapshots.createdAt));

    return orgSnapshots.filter((snapshot) => snapshot.clientId !== null).map((snapshot) => ({
      id: snapshot.id,
      clientId: snapshot.clientId as string,
      label: snapshot.label,
      accountingPeriod: snapshot.accountingPeriod,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
    }));
  }),
});

export type OrganizationsRouter = typeof organizationsRouter;