import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import pg from "pg";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const migrationsDir = path.join(rootDir, "packages", "db", "migrations");
const metaDir = path.join(migrationsDir, "meta");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created ${dirPath}`);
  }
}

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

async function getAllOrganizationIds() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to fetch organizations before wipe",
    );
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query('select id from "organizations"');
    return result.rows.map((row) => row.id);
  } catch {
    console.warn(
      "Could not read organizations (possibly not migrated yet). Skipping S3 cleanup.",
    );
    return [];
  } finally {
    await pool.end();
  }
}

async function getActiveAnthropicFileIds() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to fetch Anthropic file ids before wipe",
    );
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query(
      'select anthropic_file_id from "anthropic_files" where status = \'active\'',
    );
    return result.rows.map((row) => row.anthropic_file_id).filter(Boolean);
  } catch {
    console.warn(
      "Could not read anthropic_files (possibly not migrated yet). Skipping Anthropic cleanup.",
    );
    return [];
  } finally {
    await pool.end();
  }
}

async function deleteAnthropicFile(fileId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for Anthropic file cleanup");
  }

  const response = await fetch(`https://api.anthropic.com/v1/files/${fileId}`, {
    method: "DELETE",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "files-api-2025-04-14",
    },
  });

  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(
      `Failed deleting Anthropic file ${fileId}: ${response.status} ${body}`,
    );
  }
}

function createS3Client() {
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;

  if (!region) {
    throw new Error("S3_REGION missing");
  }
  if (!bucket) {
    throw new Error("S3_BUCKET missing");
  }

  const s3Client = new S3Client({ region });
  return { s3Client, bucket };
}

async function deleteOrgPrefix(s3Client, bucket, orgId) {
  const prefix = `orgs/${orgId}/`;
  let continuationToken;
  let totalDeleted = 0;

  console.log(
    `Deleting S3 objects for org ${orgId} in bucket ${bucket} under prefix ${prefix}`,
  );

  do {
    const listResult = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = listResult.Contents ?? [];
    if (objects.length > 0) {
      const deleteParams = {
        Bucket: bucket,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
      };
      const deleteResult = await s3Client.send(
        new DeleteObjectsCommand(deleteParams),
      );
      totalDeleted += deleteResult.Deleted?.length ?? 0;
    }

    continuationToken = listResult.IsTruncated
      ? listResult.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(
    `Deleted ${totalDeleted} objects from prefix ${prefix} in bucket ${bucket}`,
  );
}

async function main() {
  // Ensure migrations structure exists even if files are gitignored/cleaned.
  ensureDir(migrationsDir);
  ensureDir(metaDir);

  console.log("Collecting active Anthropic file IDs before DB reset...");
  const anthropicFileIds = await getActiveAnthropicFileIds();
  console.log(`Found ${anthropicFileIds.length} active Anthropic files`);

  if (anthropicFileIds.length > 0) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(
        "ANTHROPIC_API_KEY missing; skipping Anthropic remote file deletion.",
      );
    } else {
      for (const fileId of anthropicFileIds) {
        try {
          await deleteAnthropicFile(fileId);
          console.log(`Deleted Anthropic file ${fileId}`);
        } catch (err) {
          console.warn(`Failed to delete Anthropic file ${fileId}:`, err);
        }
      }
    }
  }

  console.log("Collecting organization IDs before DB reset...");
  const orgIds = await getAllOrganizationIds();
  console.log(`Found ${orgIds.length} organizations`);

  if (orgIds.length > 0) {
    const { s3Client, bucket } = createS3Client();
    for (const orgId of orgIds) {
      await deleteOrgPrefix(s3Client, bucket, orgId);
    }
  } else {
    console.log("No organizations found; skipping S3 deletion.");
  }

  console.log("Removing existing migration SQL files...");
  const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => {
    return name.endsWith(".sql");
  });
  for (const file of migrationFiles) {
    safeUnlink(path.join(migrationsDir, file));
  }

  console.log(
    "Removing existing migration meta snapshot files (keeping _journal.json)...",
  );
  const metaSnapshotFiles = fs.readdirSync(metaDir).filter((name) => {
    return name !== "_journal.json" && name.endsWith("_snapshot.json");
  });
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

main().catch((err) => {
  console.error("db-wipe failed:", err);
  process.exitCode = 1;
});

