import Image from "next/image";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DemoOrg = {
  id: string;
  name: string;
  plan: string;
  snapshots: Array<{ id: string; name: string }>;
};

type ClientViewProps = {
  viewId: string;
  org: DemoOrg;
  orderedOrgs: DemoOrg[];
  snapshotId?: string;
  activeSelection?: { viewId: string; snapshotId: string };
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  showExpandedClientList: boolean;
  onToggleExpanded: () => void;
  onChangeOrg: (viewId: string, orgId: string) => void;
  onChangeSnapshot: (viewId: string, snapshotId: string) => void;
  canRemove: boolean;
  onRemove: (viewId: string) => void;
  openFolders: Record<string, boolean>;
  onToggleFolder: (viewId: string, folderId: string) => void;
  collapsed: boolean;
  onToggleCollapsed: (viewId: string) => void;
};

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function ClientViewItem({
  viewId,
  org,
  orderedOrgs,
  snapshotId,
  activeSelection,
  clientSearch,
  onClientSearchChange,
  showExpandedClientList,
  onToggleExpanded,
  onChangeOrg,
  onChangeSnapshot,
  canRemove,
  onRemove,
  openFolders,
  onToggleFolder,
  collapsed,
  onToggleCollapsed,
}: ClientViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const folders = useMemo(
    () => [
      {
        id: `${viewId}-snapshots`,
        name: "Snapshots",
        files: [
          {
            id: `${viewId}-snapshots-1`,
            name: "portfolio_snapshot_q4_2025.csv",
          },
          {
            id: `${viewId}-snapshots-2`,
            name: "renewal_scenario_q1_2026.csv",
          },
          {
            id: `${viewId}-snapshots-3`,
            name: "claims_deep_dive_export.xlsx",
          },
        ],
      },
      {
        id: `${viewId}-notes`,
        name: "Notes",
        files: [
          {
            id: `${viewId}-notes-1`,
            name: "underwriting_assumptions.xlsx",
          },
          {
            id: `${viewId}-notes-2`,
            name: "pricing_memo_internal.csv",
          },
        ],
      },
      {
        id: `${viewId}-runs`,
        name: "Runs",
        files: [
          {
            id: `${viewId}-runs-1`,
            name: "stochastic_run_2026_q1.csv",
          },
          {
            id: `${viewId}-runs-2`,
            name: "stress_test_2026_market_shock.xlsx",
          },
        ],
      },
    ],
    [viewId],
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "cursor-pointer px-3 py-5.5",
                pickerOpen && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
              onClick={() => {
                const first = org.snapshots[0]?.id;
                if (first) {
                  onChangeSnapshot(viewId, first);
                }
              }}
            >
              <div className="mr-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {getInitial(org.name)}
              </div>
              <div className="flex-1 truncate text-left text-sm font-semibold">
                <span className="truncate">{org.name}</span>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapsed(viewId);
                }}
                role="button"
                tabIndex={0}
                className="flex shrink-0 cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={collapsed ? "Expand client" : "Condense client"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleCollapsed(viewId);
                  }
                }}
              >
                {collapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </div>
              <ChevronsUpDown className="ml-0.5 size-3 shrink-0 text-muted-foreground" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 -ml-2"
            side="right"
            align="start"
            sideOffset={10}
          >
            <Command>
              <CommandInput
                placeholder="Search clients..."
                value={clientSearch}
                onValueChange={onClientSearchChange}
              />
              <CommandList
                className={cn(
                  "max-h-60 overflow-y-auto",
                  showExpandedClientList && "max-h-96",
                )}
              >
                <CommandEmpty>No clients found.</CommandEmpty>
                <CommandGroup heading="Clients">
                  {orderedOrgs.map((candidate) => (
                    <CommandItem
                      key={candidate.id}
                      value={candidate.name}
                      onSelect={() => {
                        onChangeOrg(viewId, candidate.id);
                        setPickerOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <div className="mr-2 flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {getInitial(candidate.name)}
                      </div>
                      <div className="flex flex-1 flex-col text-left">
                        <span className="truncate text-sm font-medium">
                          {candidate.name}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <CommandSeparator />
              <div className="flex items-center justify-between gap-2 px-2 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-xs"
                  onClick={onToggleExpanded}
                >
                  {showExpandedClientList ? "View less" : "View more"}
                </Button>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-xs text-destructive hover:text-destructive"
                    onClick={() => onRemove(viewId)}
                  >
                    Remove view
                  </Button>
                )}
              </div>
            </Command>
          </PopoverContent>
        </Popover>

        {!collapsed && (
          <SidebarMenuSub className="mt-1.5 space-y-0.5 mr-0 px-0 py-0">
            {folders.map((folder) => {
            const isOpen = openFolders[folder.id] ?? false;
            return (
              <div key={folder.id} className="space-y-0">
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    onClick={() => onToggleFolder(viewId, folder.id)}
                    className="cursor-pointer h-9 translate-x-0 rounded-none py-1.5 text-xs"
                  >
                    <ChevronRight
                      className={`mr-0 size-3 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                    <span>{folder.name}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>

                {isOpen &&
                  folder.files.map((file) => (
                    <SidebarMenuSubItem key={file.id}>
                      <SidebarMenuSubButton
                        isActive={
                          activeSelection?.viewId === viewId &&
                          activeSelection?.snapshotId === file.id
                        }
                        onClick={() => onChangeSnapshot(viewId, file.id)}
                        className="cursor-pointer h-9 translate-x-0 rounded-none py-1.5 pl-6 text-xs"
                      >
                        <Image
                          src={
                            file.name.toLowerCase().endsWith(".csv")
                              ? "/icons/csv.png"
                              : "/icons/xlsx.svg"
                          }
                          alt={
                            file.name.toLowerCase().endsWith(".csv")
                              ? "CSV file"
                              : "Excel file"
                          }
                          width={12}
                          height={12}
                          className="mr-0 rounded-[3px]"
                        />
                        <span>{file.name}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
              </div>
            );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

