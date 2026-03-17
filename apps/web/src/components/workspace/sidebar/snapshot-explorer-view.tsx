"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FileText, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { trpc } from "@/lib/trpc";
import type { WorkspaceFile, WorkspaceSnapshot } from "@/stores/workspace";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type SnapshotExplorerViewProps = {
  snapshot: WorkspaceSnapshot;
};

function fileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".pbix")) return "pbix";
  return null;
}

export function SnapshotExplorerView({ snapshot }: SnapshotExplorerViewProps) {
  const [rawDataFiles, setRawDataFiles] = useState<WorkspaceFile[] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRawDataFiles = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await trpc.storage.listBySnapshot.query({ snapshotId: snapshot.id });
      setRawDataFiles(list.map((f) => ({ id: f.id, name: f.fileName })));
    } catch {
      // Leave rawDataFiles null so we fall back to section.files (e.g. demo data)
    } finally {
      setListLoading(false);
    }
  }, [snapshot.id]);

  useEffect(() => {
    loadRawDataFiles();
  }, [loadRawDataFiles]);

  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx")) {
      setUploadError("Only .xlsx files are supported.");
      return;
    }

    const contentType = XLSX_CONTENT_TYPE;
    const sizeBytes = file.size;
    if (sizeBytes <= 0) {
      setUploadError("File is empty.");
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    try {
      const { uploadUrl, bucket, objectKey } = await trpc.storage.getUploadUrl.mutate({
        snapshotId: snapshot.id,
        fileName: file.name,
        contentType,
        sizeBytes,
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": contentType },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`);
      }

      await trpc.storage.completeUpload.mutate({
        snapshotId: snapshot.id,
        bucket,
        objectKey,
        fileName: file.name,
        contentType,
        sizeBytes,
      });

      await loadRawDataFiles();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="space-y-1 py-2">
            {snapshot.sections.map((section) => {
              const isRawData = section.id === "raw-data";
              const files: WorkspaceFile[] =
                isRawData && rawDataFiles !== null ? rawDataFiles : section.files;

              return (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuSub className="mr-0 space-y-0 px-0 py-0">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton className="h-8 cursor-default rounded-none py-1.5 text-xs font-medium">
                        {section.name}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {isRawData && (
                      <SidebarMenuSubItem>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start gap-1.5 rounded-none pl-5 text-xs font-normal"
                          onClick={handleUploadClick}
                          disabled={uploadLoading || listLoading}
                        >
                          {uploadLoading ? (
                            <Loader2 className="size-3 shrink-0 animate-spin" />
                          ) : (
                            <Upload className="size-3 shrink-0" />
                          )}
                          Upload .xlsx
                        </Button>
                      </SidebarMenuSubItem>
                    )}
                    {isRawData && uploadError && (
                      <SidebarMenuSubItem>
                        <p className="px-5 py-1 text-xs text-destructive">{uploadError}</p>
                      </SidebarMenuSubItem>
                    )}
                    {isRawData && listLoading && files.length === 0 ? (
                      <SidebarMenuSubItem>
                        <span className="pl-5 text-xs text-muted-foreground">
                          Loading…
                        </span>
                      </SidebarMenuSubItem>
                    ) : (
                      files.map((file) => (
                        <SidebarMenuSubItem key={file.id}>
                          <SidebarMenuSubButton className="h-8 cursor-pointer rounded-none py-1.5 pl-5 text-xs">
                            {fileIcon(file.name) === "csv" && (
                              <Image
                                src="/icons/csv.png"
                                alt="CSV file"
                                width={12}
                                height={12}
                                className="rounded-[3px]"
                              />
                            )}
                            {fileIcon(file.name) === "xlsx" && (
                              <Image
                                src="/icons/xlsx.svg"
                                alt="Excel file"
                                width={12}
                                height={12}
                                className="rounded-[3px]"
                              />
                            )}
                            {fileIcon(file.name) === "pbix" && (
                              <FileText className="size-3 text-muted-foreground" />
                            )}
                            <span>{file.name}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))
                    )}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}
