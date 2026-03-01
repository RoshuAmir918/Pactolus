export const roles = ["associate", "reviewer", "admin"] as const;
export type Role = (typeof roles)[number];
