"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Loader2,
  Trash2,
  Upload,
  FileSpreadsheet,
  FileType,
  Download,
} from "lucide-react";
import { DocumentPreview, type PreviewDoc } from "@/components/workspace/document-preview";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type DocFile = {
  id: string;
  fileObjectId: string;
  name: string;
  sizeBytes: number;
  documentType: string;
  fileExtension: string | null;
};

function FileIcon({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-8 h-8 shrink-0" : "w-3.5 h-3.5 shrink-0";
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return <FileType className={`${cls} text-emerald-500`} />;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls"))
    return <FileSpreadsheet className={`${cls} text-green-600`} />;
  return <FileText className={`${cls} text-muted-foreground`} />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docTypeLabel(type: string) {
  const map: Record<string, string> = {
    claims: "Claims",
    policies: "Policies",
    loss_triangles: "Loss Triangles",
    other: "Other",
  };
  return map[type] ?? type;
}

type Props = { snapshotId: string };

export function SourceDocumentsSection({ snapshotId }: Props) {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setListLoading(true);
    try {
      const result = await trpc.storage.getSourceDocuments.query({ snapshotId });
      setFiles(
        result.documents.map((d) => ({
          id: d.id,
          fileObjectId: d.fileObjectId,
          name: d.filename,
          sizeBytes: d.fileSizeBytes,
          documentType: d.documentType,
          fileExtension: d.fileExtension,
        })),
      );
    } catch {
      setFiles([]);
    } finally {
      setListLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleDelete(fileId: string) {
    setDeletingId(fileId);
    setError(null);
    try {
      const file = files.find((f) => f.id === fileId);
      await trpc.storage.deleteFile.mutate({ fileObjectId: file!.fileObjectId });
      if (previewDoc?.id === fileId) setPreviewDoc(null);
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
      setError("Only .xlsx and .csv files are supported.");
      return;
    }
    if (file.size <= 0) {
      setError("File is empty.");
      return;
    }

    const contentType = lower.endsWith(".csv") ? "text/csv" : XLSX_CONTENT_TYPE;

    setUploadLoading(true);
    setError(null);
    setStatusText("Uploading…");
    try {
      const { uploadUrl, bucket, objectKey } = await trpc.storage.getUploadUrl.mutate({
        snapshotId,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });

      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      const completed = await trpc.storage.completeUpload.mutate({
        snapshotId,
        bucket,
        objectKey,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });

      setStatusText("Ingesting…");
      await trpc.ingestion.startDocumentIngestion.mutate({
        snapshotId,
        documentId: completed.documentId,
      });
      await waitForIngestion(snapshotId, completed.documentId, setStatusText);
      await loadFiles();
      setStatusText(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setStatusText(null);
    } finally {
      setUploadLoading(false);
    }
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-wider flex items-center justify-between pr-2">
          <span>Source documents</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded"
            disabled={uploadLoading}
            onClick={() => {
              setError(null);
              setStatusText(null);
              fileInputRef.current?.click();
            }}
          >
            {uploadLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
          </Button>
        </SidebarGroupLabel>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />

        <SidebarGroupContent>
          <SidebarMenu>
            {statusText && (
              <p className="px-4 py-1 text-xs text-muted-foreground animate-pulse">{statusText}</p>
            )}
            {error && <p className="px-4 py-1 text-xs text-destructive">{error}</p>}

            {listLoading && !uploadLoading && (
              <div className="px-3 py-1 space-y-1.5">
                <div className="h-6 rounded bg-muted/60 animate-pulse" />
                <div className="h-6 rounded bg-muted/40 animate-pulse" />
              </div>
            )}

            {!listLoading && files.length === 0 && !uploadLoading && (
              <SidebarMenuItem>
                <button
                  onClick={() => {
                    setError(null);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-md mx-2 my-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload a document
                </button>
              </SidebarMenuItem>
            )}

            {files.map((file) => (
              <SidebarMenuItem key={file.id}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <SidebarMenuButton
                      className="gap-2"
                      disabled={deletingId === file.id}
                      isActive={previewDoc?.id === file.id}
                      onClick={() => setPreviewDoc(file)}
                    >
                      {deletingId === file.id ? (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <FileIcon name={file.name} />
                      )}
                      <span className="truncate flex-1 text-xs">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </SidebarMenuButton>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      className="text-xs cursor-pointer"
                      onSelect={() => setPreviewDoc(file)}
                    >
                      <Download className="w-3 h-3 mr-2" />
                      Open / Download
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive text-xs cursor-pointer"
                      disabled={deletingId === file.id}
                      onSelect={() => handleDelete(file.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete file
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {previewDoc && (
        <DocumentPreview
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </>
  );
}

// ── Ingestion polling ─────────────────────────────────────────────────────────

async function waitForIngestion(
  snapshotId: string,
  documentId: string,
  onProgress: (text: string) => void,
): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const s = await trpc.ingestion.getDocumentIngestionStatus.query({ snapshotId, documentId });
    if (s.profileStatus === "failed" || s.aiStatus === "failed") {
      throw new Error(s.errorText ?? "Ingestion failed.");
    }
    if (s.profileStatus === "completed" && s.aiStatus === "completed") return;
    onProgress(`Ingesting… ${s.sheetCount} sheets · ${s.triangleCount} triangles`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Ingestion timed out.");
}
