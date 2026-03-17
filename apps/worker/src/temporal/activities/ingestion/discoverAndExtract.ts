import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export type DiscoverAndExtractInput = {
  filePath: string;
  fileExtension: string | null;
};

export type DiscoverAndExtractResult = {
  route: "deterministic_claims_policies" | "hybrid_triangles" | "claude_contract";
  document: {
    documentType: "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other";
    aiClassification: "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other" | "unknown";
    aiConfidence: number;
    searchText: string;
  };
  sheets: Array<Record<string, unknown>>;
  triangles: Array<Record<string, unknown>>;
  deterministic: {
    segmentManifest: Array<Record<string, unknown>>;
    aggregateStats: Record<string, unknown>;
    qualityFlags: Array<Record<string, unknown>>;
  };
};

export async function discoverAndExtractActivity(
  input: DiscoverAndExtractInput,
): Promise<DiscoverAndExtractResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "pactolus-det-"));
  const inputPath = join(tempDir, "input.json");
  const scriptPath = new URL("./python/deterministic_ingest.py", import.meta.url).pathname;
  const pythonBin = process.env.PYTHON_BIN ?? "python3";

  try {
    await writeFile(
      inputPath,
      JSON.stringify({
        filePath: input.filePath,
        fileExtension: input.fileExtension,
      }),
      "utf8",
    );

    const output = await runPython(pythonBin, scriptPath, inputPath);
    return JSON.parse(output) as DiscoverAndExtractResult;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runPython(pythonBin: string, scriptPath: string, inputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, inputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`deterministic_ingest.py failed (${code}): ${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
