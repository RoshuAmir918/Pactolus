"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import type { IWorkbookData } from "@/lib/exceljs-to-univer";

// Univer is client-only — no SSR
const UniverViewer = dynamic(
  () => import("./univer-viewer").then((m) => ({ default: m.UniverViewer })),
  { ssr: false, loading: () => null },
);

export type PreviewDoc = {
  id: string;
  fileObjectId: string;
  name: string;
  sizeBytes: number;
};

type Props = {
  doc: PreviewDoc;
  onClose: () => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: IWorkbookData; downloadUrl: string };

export function DocumentPreview({ doc, onClose }: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      try {
        const { downloadUrl } = await trpc.storage.getDownloadUrl.query({
          fileObjectId: doc.fileObjectId,
        });
        if (cancelled) return;

        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        // Dynamically import ExcelJS browser bundle to avoid SSR issues
        const ExcelJS = (await import("exceljs/dist/exceljs.bare.min.js")).default;
        const { excelWorkbookToUniverData } = await import("@/lib/exceljs-to-univer");

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);

        if (cancelled) return;
        const data = excelWorkbookToUniverData(wb);
        setState({ status: "ready", data, downloadUrl });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load file.",
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [doc.fileObjectId]);

  function triggerDownload() {
    if (state.status !== "ready") return;
    const a = document.createElement("a");
    a.href = state.downloadUrl;
    a.download = doc.name;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-sm truncate">{doc.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={state.status !== "ready"}
            onClick={triggerDownload}
            className="h-7 text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        {state.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading spreadsheet…</span>
          </div>
        )}

        {state.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.message}
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <div className="w-full h-full">
            <UniverViewer data={state.data} />
          </div>
        )}
      </div>
    </div>
  );
}
