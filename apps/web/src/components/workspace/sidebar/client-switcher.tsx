import { useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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

type ClientSwitcherProps = {
  selectedOrg: DemoOrg;
  orderedOrgs: DemoOrg[];
  clientSearch: string;
  onClientSearchChange: (value: string) => void;
  showExpandedClientList: boolean;
  onToggleExpanded: () => void;
  onSelectOrg: (orgId: string) => void;
};

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function ClientSwitcher({
  selectedOrg,
  orderedOrgs,
  clientSearch,
  onClientSearchChange,
  showExpandedClientList,
  onToggleExpanded,
  onSelectOrg,
}: ClientSwitcherProps) {
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
            <PopoverTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="cursor-pointer"
              >
                <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="text-sm font-semibold">
                    {getInitial(selectedOrg.name)}
                  </span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{selectedOrg.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Client
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
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
                    {orderedOrgs.map((org) => (
                      <CommandItem
                        key={org.id}
                        value={org.name}
                        onSelect={() => {
                          onSelectOrg(org.id);
                          setClientPickerOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <div className="mr-2 flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                          {getInitial(org.name)}
                        </div>
                        <div className="flex flex-1 flex-col text-left">
                          <span className="truncate text-sm font-medium">
                            {org.name}
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
                  <Button size="sm" className="cursor-pointer gap-1 text-xs">
                    <Plus className="size-3" />
                    Add client
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

