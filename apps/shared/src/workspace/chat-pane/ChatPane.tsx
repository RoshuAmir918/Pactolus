import { useEffect, useRef } from "react";

export type SharedChatMessage = {
  id?: string;
  role: "user" | "assistant";
  text: string;
};

export function ChatPane(props: {
  title?: string;
  badge?: string | null;
  showHeader?: boolean;
  onClose?: () => void;
  canChat?: boolean;
  cannotChatMessage?: string;
  messages: SharedChatMessage[];
  isTyping?: boolean;
  input: string;
  onInputChange: (next: string) => void;
  onSend: () => void;
  inputPlaceholder?: string;
  sendDisabled?: boolean;
  renderMessageContent?: (message: SharedChatMessage) => React.ReactNode;
  renderAfterMessage?: (message: SharedChatMessage, index: number) => React.ReactNode;
  footerTopContent?: React.ReactNode;
  className?: string;
  headerIcon?: React.ReactNode;
  assistantAvatar?: React.ReactNode;
  userAvatar?: React.ReactNode;
  closeIcon?: React.ReactNode;
  sendIcon?: React.ReactNode;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const showHeader = props.showHeader ?? true;
  const canChat = props.canChat ?? true;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.messages, props.isTyping]);

  return (
    <div className={cx("h-full flex flex-col bg-background border-l border-border overflow-hidden", props.className)}>
      {showHeader && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
          <span className="w-4 h-4 text-primary inline-flex items-center justify-center">
            {props.headerIcon ?? <span className="text-[10px]">AI</span>}
          </span>
          <span className="text-sm font-medium flex-1">{props.title ?? "Pactolus AI"}</span>
          {props.badge && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {props.badge}
            </span>
          )}
          {props.onClose && (
            <button
              type="button"
              onClick={props.onClose}
              className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            >
              {props.closeIcon ?? <span className="text-xs leading-none">x</span>}
            </button>
          )}
        </div>
      )}

      {!canChat && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {props.cannotChatMessage ?? "Select context to start chatting."}
          </p>
        </div>
      )}

      {canChat && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {props.messages.map((message, index) => (
              <div key={message.id ?? `${message.role}-${index}`} className="space-y-1.5">
                <div className={cx("flex gap-2", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div
                    className={cx(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      message.role === "user" ? "bg-primary" : "bg-muted",
                    )}
                  >
                    {message.role === "user" ? (
                      props.userAvatar ?? <span className="text-[9px] text-primary-foreground">U</span>
                    ) : (
                      props.assistantAvatar ?? <span className="text-[9px] text-muted-foreground">AI</span>
                    )}
                  </div>
                  <div
                    className={cx(
                      "max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {props.renderMessageContent ? props.renderMessageContent(message) : message.text}
                  </div>
                </div>
                {props.renderAfterMessage?.(message, index)}
              </div>
            ))}

            {props.isTyping && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {props.assistantAvatar ?? <span className="text-[9px] text-muted-foreground">AI</span>}
                </div>
                <div className="bg-muted px-3 py-2 rounded-lg">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-3 flex-shrink-0">
            {props.footerTopContent}
            <div className={cx("flex items-end gap-2 bg-muted rounded-lg px-3 py-2", props.footerTopContent ? "mt-2" : undefined)}>
              <textarea
                value={props.input}
                onChange={(event) => props.onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    props.onSend();
                  }
                }}
                placeholder={props.inputPlaceholder ?? "Ask a question..."}
                rows={1}
                className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-muted-foreground min-h-[20px] max-h-[80px]"
              />
              <button
                type="button"
                onClick={props.onSend}
                disabled={props.sendDisabled}
                className="p-1 rounded-md bg-primary text-primary-foreground disabled:opacity-40 transition-opacity flex-shrink-0"
              >
                <span className="w-3 h-3 inline-flex items-center justify-center">
                  {props.sendIcon ?? <span className="text-[10px]">^</span>}
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
