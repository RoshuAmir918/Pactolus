/** Sidebar entries for admin tools — add a route under `app/admin/<segment>/page.tsx` for each. */
export const ADMIN_TOOLS = [
  {
    segment: "create-organization",
    label: "Create organization",
    description: "Invite an owner to activate a pending organization",
  },
] as const;
