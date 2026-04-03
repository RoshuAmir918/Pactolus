"use client";

import React, { useEffect, useState } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useAtom } from "jotai";
import { MessageSquare, GitBranch } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LeftSidebar } from "@/components/workspace/sidebar/left-sidebar";
import { CenterPanel } from "@/components/workspace/content/center-panel";
import { BottomRunTree } from "@/components/workspace/panels/bottom-run-tree";
import { RightChatPanel } from "@/components/workspace/panels/right-chat-panel";
import { DocumentPreview, type PreviewDoc } from "@/components/workspace/document-preview";
import { rightPanelOpenAtom, bottomPanelOpenAtom, activeDocumentIdAtom } from "@/stores/workspace-ui";
import { useWorkspaceBootstrap } from "@/hooks/use-workspace-bootstrap";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

const LAYOUT = {
  sidebarWidth: "16rem",
  bottomPanel: {
    defaultSizeWhenOpen: 45,
    centerSizeWhenBottomOpen: 55,
    minSize: 15,
    maxSize: 300,
  },
  chatPanel: {
    defaultWidth: 420,
    minWidth: 300,
    maxWidth: 640,
  },
} as const;

export function WorkspaceLayout() {
  useWorkspaceBootstrap();
  const [rightPanelOpen, setRightPanelOpen] = useAtom(rightPanelOpenAtom);
  const [bottomPanelOpen, setBottomPanelOpen] = useAtom(bottomPanelOpenAtom);
  const [chatWidth, setChatWidth] = React.useState<number>(LAYOUT.chatPanel.defaultWidth);
  const [activeDocumentId, setActiveDocumentId] = useAtom(activeDocumentIdAtom);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);

  useEffect(() => {
    if (!activeDocumentId) { setPreviewDoc(null); return; }
    trpc.storage.getDocumentById.query({ documentId: activeDocumentId }).then((doc) => {
      if (doc) setPreviewDoc({ id: doc.id, fileObjectId: doc.fileObjectId, name: doc.filename, sizeBytes: doc.fileSizeBytes });
    }).catch(() => setActiveDocumentId(null));
  }, [activeDocumentId, setActiveDocumentId]);

  const handleChatResizeStart = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = chatWidth;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(
        LAYOUT.chatPanel.minWidth,
        Math.min(LAYOUT.chatPanel.maxWidth, startWidth - deltaX),
      );
      setChatWidth(nextWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [chatWidth]);

  return (
    <>
    <SidebarProvider style={{ "--sidebar-width": LAYOUT.sidebarWidth } as React.CSSProperties}>
      <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }} className="bg-background">
        <LeftSidebar />

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-border shrink-0 bg-background">
            <button
              onClick={() => setBottomPanelOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                bottomPanelOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <GitBranch className="w-3.5 h-3.5" />
              History
            </button>
            <button
              onClick={() => setRightPanelOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                rightPanelOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex" }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
              <PanelGroup orientation="vertical" style={{ height: "100%" }}>
                <Panel
                  defaultSize={bottomPanelOpen ? LAYOUT.bottomPanel.centerSizeWhenBottomOpen : 100}
                  minSize={10}
                >
                  <div style={{ height: "100%", overflow: "auto" }}>
                    <CenterPanel />
                  </div>
                </Panel>

                {bottomPanelOpen && (
                  <>
                    <PanelResizeHandle className="h-1.5 bg-border hover:bg-primary/30 transition-colors cursor-row-resize shrink-0" />
                    <Panel
                      defaultSize={LAYOUT.bottomPanel.defaultSizeWhenOpen}
                      minSize={LAYOUT.bottomPanel.minSize}
                      maxSize={LAYOUT.bottomPanel.maxSize}
                    >
                      <div style={{ height: "100%", overflow: "hidden" }}>
                        <BottomRunTree />
                      </div>
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </div>

            {rightPanelOpen && (
              <>
                <div
                  role="separator"
                  aria-label="Resize chat panel"
                  aria-orientation="vertical"
                  onMouseDown={handleChatResizeStart}
                  className="w-1.5 bg-border hover:bg-primary/30 transition-colors cursor-col-resize shrink-0"
                />
                <aside
                  style={{
                    width: `${chatWidth}px`,
                    minWidth: `${LAYOUT.chatPanel.minWidth}px`,
                    maxWidth: `${LAYOUT.chatPanel.maxWidth}px`,
                    height: "100%",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <RightChatPanel />
                </aside>
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>

    {previewDoc && (
      <DocumentPreview
        doc={previewDoc}
        onClose={() => { setPreviewDoc(null); setActiveDocumentId(null); }}
      />
    )}
    </>
  );
}
