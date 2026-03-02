import { eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { publicProcedure, router } from "@api/trpc/base";
import { organizations } from "@db/schema";

const { db } = dbClient;

export const organizationsRouter = router({
    myOrg: publicProcedure.query(async ({ ctx }) => {
        const [organization] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, ctx.orgId))
            .limit(1);

        return organization ?? null;
    }),
});

export type OrganizationsRouter = typeof organizationsRouter;