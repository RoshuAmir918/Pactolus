"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, CornerDownLeft, Pencil, Plus, Trash2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Space = {
  id: string;
  name: string;
};

type OrganizationHeaderProps = {
  spaces: Space[];
  activeSpaceId: string;
  onSelectSpace: (id: string) => void;
  onAddSpace: () => void;
  onDeleteSpace: (id: string) => void;
  onRenameSpace: (id: string, name: string) => void;
};

export function OrganizationHeader({
  spaces,
  activeSpaceId,
  onSelectSpace,
  onAddSpace,
  onDeleteSpace,
  onRenameSpace,
}: OrganizationHeaderProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const editingSpanRef = useRef<HTMLSpanElement | null>(null);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0];

  const startEditing = (space: Space) => {
    setEditingId(space.id);
    setDraftName(space.name);
  };

  const commitEditing = () => {
    if (!editingId) return;
    onRenameSpace(editingId, draftName);
    setEditingId(null);
  };

  useEffect(() => {
    if (!editingId || !editingSpanRef.current) return;
    const el = editingSpanRef.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editingId]);

  return (
    <div className="shrink-0 border-b border-sidebar-border bg-sidebar-border/30 px-3 py-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent/40"
          >
            <div className="min-w-0">
              <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Workspace
              </div>
              <div className="truncate text-sm font-semibold text-sidebar-foreground">
                {activeSpace?.name ?? "Workspace"}
              </div>
            </div>
            <ChevronsUpDown className="ml-2 size-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-2 -ml-1"
          side="right"
          align="start"
          sideOffset={10}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Workspaces
            </span>
            <button
              type="button"
              onClick={() => {
                onAddSpace();
              }}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-sidebar-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Plus className="size-3" />
              New
            </button>
          </div>
          <div className="space-y-0">
            {spaces.map((space) => {
              const isActive = space.id === activeSpaceId;
              const isEditing = editingId === space.id;
              return (
                <div
                  key={space.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-xs hover:bg-sidebar-accent/30"
                  onClick={() => {
                    if (isEditing) return;
                    onSelectSpace(space.id);
                    setOpen(false);
                  }}
                >
                  <div
                    className={
                      "flex-1 truncate text-left " +
                      (isActive
                        ? "font-semibold text-sidebar-accent-foreground"
                        : "text-sidebar-foreground")
                    }
                  >
                    <span
                      ref={isEditing ? editingSpanRef : null}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onBlur={() => {
                        if (!isEditing) return;
                        commitEditing();
                      }}
                      onKeyDown={(event) => {
                        if (!isEditing) return;
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitEditing();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingId(null);
                        }
                      }}
                      onInput={(event) => {
                        if (!isEditing) return;
                        const target = event.target as HTMLElement;
                        setDraftName(target.textContent ?? "");
                      }}
                      className={
                        "inline-block min-w-[1ch] border-b border-transparent outline-none " +
                        (isEditing ? "border-sidebar-accent" : "")
                      }
                    >
                      {space.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isEditing) return;
                      startEditing(space);
                    }}
                    className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    aria-label={
                      isEditing
                        ? "Press Enter to save workspace name"
                        : `Rename workspace ${space.name}`
                    }
                  >
                    {isEditing ? (
                      <CornerDownLeft className="size-3.5" />
                    ) : (
                      <Pencil className="size-3.5" />
                    )}
                  </button>
                  {spaces.length > 1 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteSpace(space.id);
                      }}
                      className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-red-500"
                      aria-label={`Delete workspace ${space.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
