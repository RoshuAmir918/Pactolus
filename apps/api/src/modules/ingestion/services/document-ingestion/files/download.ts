import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@api/modules/storage/services/s3Client";

export async function downloadFileToTemp(input: {
  tempDir: string;
  bucket: string;
  objectKey: string;
  fileName: string;
}): Promise<string> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
    }),
  );
  const body = response.Body as
    | {
        transformToByteArray?: () => Promise<Uint8Array>;
        transformToString?: () => Promise<string>;
      }
    | undefined;

  if (!body) {
    throw new Error("Unable to read uploaded object body");
  }

  const safeName = basename(input.fileName || "uploaded-file");
  const targetPath = join(input.tempDir, safeName);
  if (body.transformToByteArray) {
    const bytes = await body.transformToByteArray();
    await writeFile(targetPath, Buffer.from(bytes));
    return targetPath;
  }

  if (body.transformToString) {
    await writeFile(targetPath, await body.transformToString(), "utf8");
    return targetPath;
  }

  throw new Error("Unable to transform object body");
}
