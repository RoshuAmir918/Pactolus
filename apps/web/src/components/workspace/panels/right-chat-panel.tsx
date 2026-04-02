"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { rightPanelOpenAtom } from "@/stores/workspace-ui";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "assistant",
    text: "Hi! I can help you analyze this snapshot's runs, compare scenarios, and answer questions about assumptions and outputs. Select a run or node to get started.",
  },
];

export function RightChatPanel() {
  const [, setRightPanelOpen] = useAtom(rightPanelOpenAtom);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Placeholder response — wire to tRPC chat.sendMessage later
    await new Promise((r) => setTimeout(r, 800));
    const reply: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      text: "Chat is not yet wired to the API on the web app — this will be connected to the same sendMessage endpoint used by the Excel add-in.",
    };
    setMessages((prev) => [...prev, reply]);
    setIsTyping(false);
  }

  return (
    <div className="h-full flex flex-col bg-background border-l border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <Bot className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium flex-1">Pactolus AI</span>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "user" ? "bg-primary" : "bg-muted",
              )}
            >
              {msg.role === "user" ? (
                <User className="w-3 h-3 text-primary-foreground" />
              ) : (
                <Bot className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-muted-foreground" />
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className="flex items-end gap-2 bg-muted rounded-lg px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Ask about this run..."
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none outline-none placeholder:text-muted-foreground min-h-[20px] max-h-[80px]"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isTyping}
            className="p-1 rounded-md bg-primary text-primary-foreground disabled:opacity-40 transition-opacity flex-shrink-0"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
