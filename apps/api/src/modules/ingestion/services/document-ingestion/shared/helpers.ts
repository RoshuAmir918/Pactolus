import { extname } from "node:path";

export function inferFileExtension(fileName: string): string | null {
  const ext = extname(fileName).replace(".", "").toLowerCase();
  return ext || null;
}

export function toErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 4000);
  }
  return "Document ingestion failed";
}
