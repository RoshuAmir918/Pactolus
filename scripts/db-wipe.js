import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const migrationsDir = path.join(rootDir, "packages", "db", "migrations");
const metaDir = path.join(migrationsDir, "meta");

function safeUnlink(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted ${filePath}`);
        }
    } catch (err) {
        console.error(`Failed to delete ${filePath}:`, err);
    }
}

function main() {
    console.log("Removing existing migration SQL files...");
    const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((name) => name.endsWith(".sql"));
    for (const file of migrationFiles) {
        safeUnlink(path.join(migrationsDir, file));
    }

    console.log("Removing existing migration meta snapshot files (keeping _journal.json)...");
    const metaSnapshotFiles = fs
        .readdirSync(metaDir)
        .filter(
            (name) => name !== "_journal.json" && name.endsWith("_snapshot.json"),
        );
    for (const file of metaSnapshotFiles) {
        safeUnlink(path.join(metaDir, file));
    }

    console.log("Writing blank migrations journal...");
    const journalPath = path.join(metaDir, "_journal.json");
    const blankJournal = {
        version: "7",
        dialect: "postgresql",
        entries: [],
    };
    fs.writeFileSync(journalPath, JSON.stringify(blankJournal, null, 2) + "\n");
    console.log(`Wrote blank journal to ${journalPath}`);

    console.log("Running db:reset (docker compose down -v && up -d)...");
    execSync("npm run db:reset", {
        cwd: rootDir,
        stdio: "inherit",
    });

    console.log("Generating fresh migrations from current schema...");
    execSync("npm run db:generate", {
        cwd: rootDir,
        stdio: "inherit",
    });

    console.log("Applying migrations to empty database...");
    execSync("npm run db:migrate", {
        cwd: rootDir,
        stdio: "inherit",
    });

    console.log("Seeding database...");
    execSync("npm run db:seed", {
        cwd: rootDir,
        stdio: "inherit",
    });

    console.log("Hard reset complete.");
}

main();

