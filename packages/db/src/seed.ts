import "dotenv/config";
import bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
    memberships,
    organizations,
    clients,
    snapshots,
    users,
    type SelectClient,
    type SelectMembership,
    type SelectOrganization,
    type SelectSnapshot,
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
    const email = "demo@pactolus.app";
    const password = "demo-access";
    const passwordHash = bcrypt.hashSync(password, 10);

    const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existingUser) {
        await db
            .update(users)
            .set({ password: passwordHash })
            .where(eq(users.id, existingUser.id));
        return existingUser;
    }

    const [createdUser] = await db
        .insert(users)
        .values({
            authProvider: "auth0",
            authSubjectId: "auth0|demo-user-1",
            email,
            fullName: "Demo User",
            password: passwordHash,
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

async function seedClientsForOrganization(orgId: string): Promise<void> {
    const clientNames = [
        "UnitedHealth Group",
        "Ping An Insurance",
        "Allianz",
        "AXA",
        "China Life Insurance",
        "Prudential Financial",
        "Berkshire Hathaway",
        "MetLife",
        "Japan Post Insurance",
        "Munich Re",
        "Zurich Insurance Group",
        "Cigna",
        "Chubb Limited",
        "AIA Group",
        "Generali",
        "State Farm",
        "Travelers",
        "Prudential plc",
        "Swiss Re",
        "AIG",
    ];

    await db
        .insert(clients)
        .values(
            clientNames.map((name) => ({
                orgId,
                name,
            })),
        )
        .onConflictDoNothing();
}

async function getOrCreateClient(
    orgId: string,
    name: string,
): Promise<SelectClient> {
    const [existingClient] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.orgId, orgId), eq(clients.name, name)))
        .limit(1);

    if (existingClient) {
        return existingClient;
    }

    const [createdClient] = await db
        .insert(clients)
        .values({
            orgId,
            name,
        })
        .returning();

    return createdClient;
}

async function getOrCreateSnapshotForClient(
    orgId: string,
    clientId: string,
    createdByUserId: string,
): Promise<SelectSnapshot> {
    const label = "Q4 2025 Baseline Snapshot";
    const accountingPeriod = "2025-Q4";

    const [existingSnapshot] = await db
        .select()
        .from(snapshots)
        .where(
            and(
                eq(snapshots.orgId, orgId),
                eq(snapshots.clientId, clientId),
                eq(snapshots.label, label),
            ),
        )
        .limit(1);

    if (existingSnapshot) {
        return existingSnapshot;
    }

    const [createdSnapshot] = await db
        .insert(snapshots)
        .values({
            orgId,
            clientId,
            createdByUserId,
            label,
            accountingPeriod,
            status: "ready",
        })
        .returning();

    return createdSnapshot;
}

async function main(): Promise<void> {
    const org = await getOrCreateOrganization();
    const user = await getOrCreateUser();
    const membership = await getOrCreateMembership(user.id, org.id);
    await seedClientsForOrganization(org.id);
    const fakeClientA = await getOrCreateClient(org.id, "Northstar Mutual");
    const fakeClientB = await getOrCreateClient(org.id, "Blue Harbor Re");
    const fakeSnapshot = await getOrCreateSnapshotForClient(
        org.id,
        fakeClientA.id,
        user.id,
    );

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
        fakeClients: [
            {
                id: fakeClientA.id,
                orgId: fakeClientA.orgId,
                name: fakeClientA.name,
                status: fakeClientA.status,
            },
            {
                id: fakeClientB.id,
                orgId: fakeClientB.orgId,
                name: fakeClientB.name,
                status: fakeClientB.status,
            },
        ],
        fakeSnapshot: {
            id: fakeSnapshot.id,
            orgId: fakeSnapshot.orgId,
            clientId: fakeSnapshot.clientId,
            createdByUserId: fakeSnapshot.createdByUserId,
            label: fakeSnapshot.label,
            accountingPeriod: fakeSnapshot.accountingPeriod,
            status: fakeSnapshot.status,
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
