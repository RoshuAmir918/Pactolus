import { useState, useEffect } from "react";
import { Bot, ClipboardPaste, Check, Crosshair, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import type { ChatMessage, ExcelAction } from "../types";
import { ChatPane, type SharedChatMessage } from "@shared/workspace/chat-pane";

// ── action card ───────────────────────────────────────────────────────────────

function ExcelActionCard(props: {
  action: ExcelAction;
  onPaste: (action: ExcelAction) => Promise<void>;
  onReadSelection: () => Promise<string | null>;
}) {
  const [startCell, setStartCell] = useState(props.action.startCell);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState(false);

  // Auto-follow Excel selection unless the user has typed a custom address
  useEffect(() => {
    if (pasted || manuallyEdited || typeof Excel === "undefined") return;

    let handlerResult: OfficeExtension.EventHandlerResult<Excel.SelectionChangedEventArgs> | null = null;

    Excel.run(async (context) => {
      handlerResult = context.workbook.onSelectionChanged.add(async () => {
        const cell = await props.onReadSelection();
        if (cell) setStartCell(cell);
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
  }, [pasted, manuallyEdited]);

  async function handlePaste() {
    setPasting(true);
    try {
      await props.onPaste({ ...props.action, startCell });
      setPasted(true);
    } finally {
      setPasting(false);
    }
  }

  return (
    <div className="max-w-[88%] w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 flex flex-col gap-2">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-0.5">
          Ready to paste
        </p>
        <p className="text-[10px] text-emerald-800 dark:text-emerald-300 leading-tight">
          {props.action.description}
        </p>
        <p className="text-[9px] text-emerald-600 dark:text-emerald-500 mt-0.5">
          {props.action.values.length} rows × {props.action.values[0]?.length ?? 0} cols
          {props.action.sheetName ? ` · ${props.action.sheetName}` : ""}
        </p>
      </div>

      {/* Cell address input */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-emerald-700 dark:text-emerald-400 shrink-0">Start at</span>
        <div className="relative">
          <input
            value={startCell}
            onChange={(e) => {
              setStartCell(e.target.value.toUpperCase());
              setManuallyEdited(true);
            }}
            disabled={pasted}
            className="w-16 text-[10px] font-mono text-center rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950/50 px-1.5 py-0.5 text-emerald-900 dark:text-emerald-100 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          {!manuallyEdited && !pasted && (
            <span title="Follows your Excel selection" className="absolute -right-3.5 top-1/2 -translate-y-1/2">
              <Crosshair className="size-2.5 text-emerald-500 animate-pulse" />
            </span>
          )}
        </div>
        {manuallyEdited && !pasted && (
          <button
            type="button"
            onClick={() => setManuallyEdited(false)}
            className="text-[9px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
          >
            resume tracking
          </button>
        )}
      </div>

      {/* Paste button */}
      <button
        type="button"
        disabled={pasting || pasted || !startCell.trim()}
        onClick={handlePaste}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold py-1.5 rounded-lg transition-colors",
          pasted
            ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 cursor-default"
            : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {pasted ? (
          <><Check className="size-3" /> Pasted into {startCell}</>
        ) : pasting ? (
          "Pasting…"
        ) : (
          <><ClipboardPaste className="size-3" /> Paste into {startCell}</>
        )}
      </button>
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────

export function ChatPanel(props: {
  activeRunName: string;
  selectedRange: string | null;
  onClearRange: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onPasteAction: (action: ExcelAction) => Promise<void>;
  onReadActiveCell: () => Promise<string | null>;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text) return;
    props.onSend(text);
    setDraft("");
  }

  const sharedMessages: SharedChatMessage[] = props.messages.map((message, index) => ({
    id: `excel-msg-${index}`,
    role: message.role,
    text: message.text,
  }));

  return (
    <ChatPane
      showHeader={false}
      className="border-l-0"
      canChat
      messages={sharedMessages}
      input={draft}
      onInputChange={setDraft}
      onSend={submit}
      inputPlaceholder="Ask about this run..."
      sendDisabled={!draft.trim()}
      renderMessageContent={(message) =>
        message.role === "assistant" ? (
          <Markdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              h1: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
              h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
              h3: ({ children }) => <p className="font-medium mb-0.5">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-3 mb-1 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-3 mb-1 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ children }) => <code className="font-mono bg-black/10 rounded px-0.5">{children}</code>,
              table: ({ children }) => (
                <div className="overflow-x-auto my-1">
                  <table className="text-[10px] border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-border/50 px-1.5 py-0.5 font-semibold bg-black/5 text-left">{children}</th>
              ),
              td: ({ children }) => <td className="border border-border/50 px-1.5 py-0.5">{children}</td>,
            }}
          >
            {message.text}
          </Markdown>
        ) : (
          message.text
        )
      }
      renderAfterMessage={(_, index) => {
        const fullMessage = props.messages[index];
        if (!fullMessage?.action) return null;
        return (
          <ExcelActionCard
            action={fullMessage.action}
            onPaste={props.onPasteAction}
            onReadSelection={props.onReadActiveCell}
          />
        );
      }}
      footerTopContent={
        props.selectedRange ? (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {props.selectedRange}
              <button
                type="button"
                onClick={props.onClearRange}
                className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
              >
                ×
              </button>
            </span>
          </div>
        ) : null
      }
      assistantAvatar={<Bot className="w-3 h-3 text-muted-foreground" />}
      userAvatar={<User className="w-3 h-3 text-primary-foreground" />}
      sendIcon={<Send className="w-3 h-3" />}
    />
  );
}
