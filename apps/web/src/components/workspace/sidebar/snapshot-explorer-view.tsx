"use client";

import Image from "next/image";
import { FileText } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { WorkspaceSnapshot } from "@/stores/workspace";

type SnapshotExplorerViewProps = {
  snapshot: WorkspaceSnapshot;
};

export function SnapshotExplorerView({ snapshot }: SnapshotExplorerViewProps) {
  return (
    <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="space-y-1 py-2">
            {snapshot.sections.map((section) => (
              <SidebarMenuItem key={section.id}>
                <SidebarMenuSub className="mr-0 space-y-0 px-0 py-0">
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton className="h-8 cursor-default rounded-none py-1.5 text-xs font-medium">
                      {section.name}
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  {section.files.map((file) => (
                    <SidebarMenuSubItem key={file.id}>
                      <SidebarMenuSubButton className="h-8 cursor-pointer rounded-none py-1.5 pl-5 text-xs">
                        {file.name.toLowerCase().endsWith(".csv") && (
                          <Image
                            src="/icons/csv.png"
                            alt="CSV file"
                            width={12}
                            height={12}
                            className="rounded-[3px]"
                          />
                        )}
                        {file.name.toLowerCase().endsWith(".xlsx") && (
                          <Image
                            src="/icons/xlsx.svg"
                            alt="Excel file"
                            width={12}
                            height={12}
                            className="rounded-[3px]"
                          />
                        )}
                        {file.name.toLowerCase().endsWith(".pbix") && (
                          <FileText className="size-3 text-muted-foreground" />
                        )}
                        <span>{file.name}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}
