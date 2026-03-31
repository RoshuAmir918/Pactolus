import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Cog, GitBranch, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BranchOption, MonitoredRegion, RunSession, SourceDocument, StepRecord } from "@/features/types";
import { chatMessagesAtom } from "@/features/session/atoms";
import { ChatPanel } from "./panels/ChatPanel";
import { RunsPanel } from "./panels/RunsPanel";
import { buildTreeFromSteps } from "./tree/layout";
import { getSelectedRangeSlice, formatRangeSliceForContext, writeRangeValues, getActiveCell } from "@/lib/office/worksheet";
import type { RangeSlice } from "@/lib/office/worksheet";
import type { Tab, ChatMessage, ExcelAction } from "./types";

export function WorkspacePage(props: {
  runSession: RunSession;
  availableBranches: BranchOption[];
  committedOperations: StepRecord[];
  sourceDocuments: SourceDocument[];
  detectedRegions: MonitoredRegion[];
  onDetectRegions: () => Promise<void>;
  onSelectRegion: (sheetName: string | undefined, address: string) => Promise<void>;
  status: { kind: "ok" | "error"; message: string } | null;
  canFork: boolean;
  onBackToRun: () => void;
  onSelectBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => Promise<void> | void;
  onNewScenario: (name: string) => Promise<void>;
  onSaveScenario: () => Promise<void>;
  onOpenWorkbook: (documentId: string) => void;
  onOpenDocument: (documentId: string, fileExtension: string | null) => void;
  onUploadDocument: (file: File) => Promise<void>;
  onAsk?: (text: string, context: { runId: string; branchId: string | null; selectedRange: string | null; history: ChatMessage[] }) => Promise<{ reply: string; excelAction?: ExcelAction | null }>;
}) {
  const activeBranch = props.availableBranches.find((b) => b.id === props.runSession.branchId);

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useAtom(chatMessagesAtom);
  const [selectedRangeSlice, setSelectedRangeSlice] = useState<RangeSlice | null>(null);

  // Subscribe to Excel selection changes and read cell values when user highlights a range
  useEffect(() => {
    if (typeof Excel === "undefined") return;

    let handlerResult: OfficeExtension.EventHandlerResult<Excel.SelectionChangedEventArgs> | null = null;

    Excel.run(async (context) => {
      handlerResult = context.workbook.onSelectionChanged.add(async () => {
        try {
          const slice = await getSelectedRangeSlice();
          setSelectedRangeSlice(slice);
        } catch {
          // ignore — selection may have moved before we could read it
        }
      });
      await context.sync();
    }).catch(() => {});

    return () => {
      if (handlerResult) {
        Excel.run(handlerResult.context, async (context) => {
          handlerResult!.remove();
          await context.sync();
        }).catch(() => {});
      }
    };
  }, []);

  const root = buildTreeFromSteps(
    props.committedOperations,
    props.availableBranches,
    props.runSession.branchId,
    props.runSession.runId,
  );

  async function handleSend(text: string) {
    if (!props.onAsk) {
      setMessages((m) => [
        ...m,
        { role: "user", text },
        { role: "assistant", text: "Chat not yet connected." },
      ]);
      return;
    }
    const history = messages; // capture history before adding new messages
    const formattedRange = selectedRangeSlice ? formatRangeSliceForContext(selectedRangeSlice) : null;
    setMessages((m) => [...m, { role: "user", text }]);
    setMessages((m) => [...m, { role: "assistant", text: "Thinking…" }]);
    try {
      const result = await props.onAsk(text, {
        runId: props.runSession.runId ?? "",
        branchId: props.runSession.branchId ?? null,
        selectedRange: formattedRange,
        history,
      });
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "assistant", text: result.reply, action: result.excelAction ?? null },
      ]);
    } catch {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "assistant", text: "Something went wrong. Please try again." },
      ]);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "chat", label: "Chat",  icon: MessageSquare },
    { id: "runs", label: "Runs",  icon: GitBranch },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Pactolus
        </span>
        <button
          type="button"
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          title="Settings"
        >
          <Cog className="size-3.5" />
        </button>
      </div>

      {/* Scenario status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
        <span className="size-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
        <button type="button" onClick={() => setActiveTab("runs")} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <span className="text-[11px] font-medium text-foreground truncate flex-1">
            {activeBranch?.name ?? "Active scenario"}
          </span>
          <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">
            {props.runSession.runId?.slice(0, 8) ?? "—"}
          </span>
        </button>
      </div>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <ChatPanel
            activeRunName={activeBranch?.name ?? "this run"}
            selectedRange={selectedRangeSlice ? `${selectedRangeSlice.sheetName}!${selectedRangeSlice.address} (${selectedRangeSlice.rowCount}×${selectedRangeSlice.columnCount})` : null}
            onClearRange={() => setSelectedRangeSlice(null)}
            messages={messages}
            onSend={handleSend}
            onPasteAction={(action) =>
              writeRangeValues({
                startCell: action.startCell,
                values: action.values,
                sheetName: action.sheetName,
              })
            }
            onReadActiveCell={getActiveCell}
          />
        )}
        {activeTab === "runs" && (
          <RunsPanel
            activeBranchName={activeBranch?.name ?? "Active scenario"}
            runId={props.runSession.runId ?? undefined}
            canNewScenario={props.canFork}
            onNewScenario={props.onNewScenario}
            onSaveScenario={props.onSaveScenario}
            root={root}
            committedOperations={props.committedOperations}
            sourceDocuments={props.sourceDocuments}
            detectedRegions={props.detectedRegions}
            onDetectRegions={props.onDetectRegions}
            onSelectRegion={props.onSelectRegion}
            onSelectNode={(_id, branchId) => {
              if (branchId) props.onSelectBranch(branchId);
            }}
            onOpenWorkbook={props.onOpenWorkbook}
            onOpenDocument={props.onOpenDocument}
          />
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 border-t border-border bg-background">
        <div className="flex">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors relative",
                activeTab === id
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="text-[9px] font-medium">{label}</span>
              {activeTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
