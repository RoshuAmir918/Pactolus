import { useState, useRef, useEffect } from "react";
import { ArrowUp, MessageSquare, ClipboardPaste, Check, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import type { ChatMessage, ExcelAction } from "../types";

const PROMPT_HINTS = [
  "Summarise the tail development",
  "What anomalies were flagged?",
  "Compare this branch to main",
];

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.messages]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    props.onSend(text);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
        {props.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 pb-8">
            <div className="size-10 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
              <MessageSquare className="size-4 text-blue-500" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-medium text-foreground mb-0.5">Ask Pactolus</p>
              <p className="text-[10px] text-muted-foreground max-w-[180px] leading-relaxed">
                Ask about your data, analysis, or current run.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
              {PROMPT_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => props.onSend(hint)}
                  className="text-left text-[10px] text-muted-foreground px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted hover:text-foreground transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {props.messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}
          >
            <span className="text-[8px] font-medium uppercase tracking-widest text-muted-foreground px-1">
              {msg.role === "user" ? "You" : "Pactolus"}
            </span>
            <div
              className={cn(
                "text-[11px] leading-relaxed px-3 py-2 rounded-2xl max-w-[88%]",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-muted border border-border text-foreground rounded-bl-sm",
              )}
            >
              {msg.role === "assistant" ? (
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
                    th: ({ children }) => <th className="border border-border/50 px-1.5 py-0.5 font-semibold bg-black/5 text-left">{children}</th>,
                    td: ({ children }) => <td className="border border-border/50 px-1.5 py-0.5">{children}</td>,
                  }}
                >
                  {msg.text}
                </Markdown>
              ) : (
                msg.text
              )}
            </div>

            {msg.action && (
              <ExcelActionCard
                action={msg.action}
                onPaste={props.onPasteAction}
                onReadSelection={props.onReadActiveCell}
              />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-border px-3 pt-2.5 pb-3 flex flex-col gap-2">
        {props.selectedRange && (
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
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Ask about this run…"
            rows={1}
            className="flex-1 text-[11px] font-sans resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-300 dark:focus:border-blue-700 leading-relaxed min-h-[36px] max-h-[80px]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="size-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <ArrowUp className="size-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
