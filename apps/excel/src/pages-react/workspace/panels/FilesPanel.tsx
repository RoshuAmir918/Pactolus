import { useRef, useState } from "react";
import { ArrowUp, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function SourceDoc(props: { label: string; ext: "xlsx" | "pdf" }) {
  const Icon = props.ext === "pdf" ? FileText : FileSpreadsheet;
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-3 cursor-pointer hover:bg-muted transition-colors">
      <div className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-background">
        <Icon className={cn("size-4", props.ext === "xlsx" ? "text-emerald-600" : "text-slate-500")} />
        <span
          className={cn(
            "absolute -bottom-1.5 -right-1.5 rounded px-1 py-px text-[7px] font-bold text-white leading-none",
            props.ext === "xlsx" ? "bg-emerald-600" : "bg-slate-600",
          )}
        >
          {props.ext}
        </span>
      </div>
      <span className="text-[9px] text-muted-foreground text-center leading-tight">{props.label}</span>
    </div>
  );
}

export function FilesPanel(props: {
  onUploadDocument: (file: File) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await props.onUploadDocument(file);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-y-auto h-full px-4 py-3 flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          Source documents
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowUp className="size-2.5" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {uploadError && (
        <p className="text-[10px] text-destructive">{uploadError}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <SourceDoc label="Loss triangles" ext="xlsx" />
        <SourceDoc label="Claims" ext="xlsx" />
        <SourceDoc label="Policies" ext="xlsx" />
        <SourceDoc label="Treaty" ext="pdf" />
      </div>
    </div>
  );
}
