import { useState, useEffect, useMemo } from "react";
import { useAtom } from "jotai";
import { Cog, GitBranch, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonitoredRegion, OperationRecord, RunSession, SourceDocument } from "@/features/types";
import { chatMessagesAtom } from "@/features/session/atoms";
import { ChatPanel } from "./panels/ChatPanel";
import { RunsPanel } from "./panels/RunsPanel";
import { buildTreeFromOperations } from "./tree/layout";
import { getSelectedRangeSlice, formatRangeSliceForContext, writeRangeValues, getActiveCell } from "@/lib/office/worksheet";
import type { RangeSlice } from "@/lib/office/worksheet";
import type { Tab, ChatMessage, ExcelAction, SaveContext } from "./types";

export function WorkspacePage(props: {
  runSession: RunSession;
  operations: OperationRecord[];
  sourceDocuments: SourceDocument[];
  detectedRegions: MonitoredRegion[];
  isDetectingRegions: boolean;
  onDetectRegions: () => Promise<void>;
  onSelectRegion: (sheetName: string | undefined, address: string) => Promise<void>;
  status: { kind: "ok" | "error"; message: string } | null;
  onBackToRun: () => void;
  onSaveScenario: (narrative: string, context: SaveContext) => Promise<void>;
  onUploadDocument: (file: File) => Promise<void>;
  onAsk?: (text: string, context: { runId: string; selectedRange: string | null; history: ChatMessage[] }) => Promise<{ reply: string; excelAction?: ExcelAction | null }>;
  clientId?: string;
  snapshotId?: string;
  webUrl?: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useAtom(chatMessagesAtom);
  const [selectedRangeSlice, setSelectedRangeSlice] = useState<RangeSlice | null>(null);

  // Subscribe to Excel selection changes
  useEffect(() => {
    if (typeof Excel === "undefined") return;

    let handlerResult: OfficeExtension.EventHandlerResult<Excel.SelectionChangedEventArgs> | null = null;

    Excel.run(async (context) => {
      handlerResult = context.workbook.onSelectionChanged.add(async () => {
        try {
          const slice = await getSelectedRangeSlice();
          setSelectedRangeSlice(slice);
        } catch {
          // ignore
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

  const root = useMemo(
    () => buildTreeFromOperations(props.operations),
    [props.operations],
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
    const history = messages;
    const formattedRange = selectedRangeSlice ? formatRangeSliceForContext(selectedRangeSlice) : null;
    setMessages((m) => [...m, { role: "user", text }]);
    setMessages((m) => [...m, { role: "assistant", text: "Thinking…" }]);
    try {
      const result = await props.onAsk(text, {
        runId: props.runSession.runId ?? "",
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
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "runs", label: "Runs", icon: GitBranch },
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

      {/* Run status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
        <span className="size-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
        <button type="button" onClick={() => setActiveTab("runs")} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <span className="text-[11px] font-medium text-foreground truncate flex-1">
            Active analysis
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
            activeRunName="this run"
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
            runId={props.runSession.runId ?? undefined}
            root={root}
            operations={props.operations}
            sourceDocuments={props.sourceDocuments}
            detectedRegions={props.detectedRegions}
            isDetectingRegions={props.isDetectingRegions}
            onDetectRegions={props.onDetectRegions}
            onSelectRegion={props.onSelectRegion}
            onSaveScenario={props.onSaveScenario}
            onSelectNode={() => {}}
            clientId={props.clientId}
            snapshotId={props.snapshotId}
            webUrl={props.webUrl}
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
