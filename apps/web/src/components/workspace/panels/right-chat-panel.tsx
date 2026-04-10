"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, X } from "lucide-react";
import { ChatPane } from "@shared/workspace/chat-pane";
import { useAtom, useAtomValue } from "jotai";
import { rightPanelOpenAtom, activeViewAtom, activeNodeIdAtom } from "@/stores/workspace-ui";
import { trpc } from "@/lib/trpc-client";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const INITIAL_MESSAGE: Message = {
  id: "0",
  role: "assistant",
  text: "Hi! I can help you analyze runs, compare scenarios, and dig into assumptions and outputs. Select a run or node to get started.",
};

export function RightChatPanel() {
  const [, setRightPanelOpen] = useAtom(rightPanelOpenAtom);
  const activeView = useAtomValue(activeViewAtom);
  const activeNodeId = useAtomValue(activeNodeIdAtom);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; text: string }>>([]);

  // Derive context from active view
  const snapshotId =
    activeView.type === "snapshot" || activeView.type === "run" || activeView.type === "node"
      ? activeView.snapshotId
      : null;
  const runId =
    activeView.type === "run" || activeView.type === "node"
      ? (activeView as { runId: string }).runId
      : null;
  const operationId = activeNodeId;

  // Reset conversation when the viewed run changes
  const prevRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (runId !== prevRunIdRef.current) {
      prevRunIdRef.current = runId;
      setMessages([INITIAL_MESSAGE]);
      historyRef.current = [];
    }
  }, [runId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !snapshotId) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const history = [...historyRef.current, { role: "user" as const, text }];

    try {
      const result = await trpc.chat.sendMessage.mutate({
        snapshotId,
        runId: runId ?? null,
        operationId: operationId ?? null,
        messages: history,
      });

      const reply = result.reply;
      historyRef.current = [...history, { role: "assistant", text: reply }];
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: reply }]);
    } catch (err) {
      const errText = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", text: errText }]);
    } finally {
      setIsTyping(false);
    }
  }

  const contextLabel = operationId
    ? "node"
    : runId
    ? "run"
    : snapshotId
    ? "snapshot"
    : null;

  return (
    <ChatPane
      title="Pactolus AI"
      badge={contextLabel}
      onClose={() => setRightPanelOpen(false)}
      canChat={Boolean(snapshotId)}
      cannotChatMessage="Select a snapshot, run, or node to start chatting."
      messages={messages}
      isTyping={isTyping}
      input={input}
      onInputChange={setInput}
      onSend={() => void handleSend()}
      inputPlaceholder={
        operationId ? "Ask about this node..." : runId ? "Ask about this run..." : "Ask about this snapshot..."
      }
      sendDisabled={!input.trim() || isTyping}
      headerIcon={<Bot className="w-4 h-4 text-primary" />}
      assistantAvatar={<Bot className="w-3 h-3 text-muted-foreground" />}
      userAvatar={<User className="w-3 h-3 text-primary-foreground" />}
      closeIcon={<X className="w-3.5 h-3.5" />}
      sendIcon={<Send className="w-3 h-3" />}
    />
  );
}
