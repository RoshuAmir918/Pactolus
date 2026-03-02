import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
    memberships,
    organizations,
    users,
    type SelectMembership,
    type SelectOrganization,
    type SelectUser,
} from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is required in .env before running seed");
}

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool);

async function getOrCreateOrganization(): Promise<SelectOrganization> {
    const orgName = "Demo Org";

    const [existingOrg] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.name, orgName))
        .limit(1);

    if (existingOrg) {
        return existingOrg;
    }

    const [createdOrg] = await db
        .insert(organizations)
        .values({
            name: orgName,
            status: "active",
        })
        .returning();

    return createdOrg;
}

async function getOrCreateUser(): Promise<SelectUser> {
    const email = "demo@pactolus.dev";

    const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existingUser) {
        return existingUser;
    }

    const [createdUser] = await db
        .insert(users)
        .values({
            authProvider: "auth0",
            authSubjectId: "auth0|demo-user-1",
            email,
            fullName: "Demo User",
            status: "active",
        })
        .returning();

    return createdUser;
}

async function getOrCreateMembership(
    userId: string,
    orgId: string,
): Promise<SelectMembership> {
    const [existingMembership] = await db
        .select()
        .from(memberships)
        .where(
            and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)),
        )
        .limit(1);

    if (existingMembership) {
        return existingMembership;
    }

    const [createdMembership] = await db
        .insert(memberships)
        .values({
            userId,
            orgId,
            role: "admin",
            status: "active",
        })
        .returning();

    return createdMembership;
}

async function main(): Promise<void> {
    const org = await getOrCreateOrganization();
    const user = await getOrCreateUser();
    const membership = await getOrCreateMembership(user.id, org.id);

    console.log("Seed complete");
    console.log({
        organization: {
            id: org.id,
            name: org.name,
            status: org.status,
        },
        user: {
            id: user.id,
            email: user.email,
            authProvider: user.authProvider,
            authSubjectId: user.authSubjectId,
            status: user.status,
        },
        membership: {
            id: membership.id,
            userId: membership.userId,
            orgId: membership.orgId,
            role: membership.role,
            status: membership.status,
        },
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
