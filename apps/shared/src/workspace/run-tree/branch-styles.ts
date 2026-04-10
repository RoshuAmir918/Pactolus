export type BranchStyle = {
  dot: string;
  border: string;
  hover: string;
  active: string;
  edge: string;
  text: string;
};

export const branchStyles: BranchStyle[] = [
  { dot: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300/80 dark:border-emerald-800/80", hover: "hover:bg-emerald-50/70 dark:hover:bg-emerald-950/35", active: "bg-emerald-500 border-emerald-500 text-white", edge: "#6ee7b7" },
  { dot: "bg-sky-400",     text: "text-sky-700 dark:text-sky-300",         border: "border-sky-300/80 dark:border-sky-800/80",         hover: "hover:bg-sky-50/70 dark:hover:bg-sky-950/35",         active: "bg-sky-500 border-sky-500 text-white",     edge: "#7dd3fc" },
  { dot: "bg-violet-400",  text: "text-violet-700 dark:text-violet-300",   border: "border-violet-300/80 dark:border-violet-800/80",   hover: "hover:bg-violet-50/70 dark:hover:bg-violet-950/35",   active: "bg-violet-500 border-violet-500 text-white",  edge: "#c4b5fd" },
  { dot: "bg-amber-400",   text: "text-amber-700 dark:text-amber-300",     border: "border-amber-300/80 dark:border-amber-800/80",     hover: "hover:bg-amber-50/70 dark:hover:bg-amber-950/35",     active: "bg-amber-500 border-amber-500 text-white",   edge: "#fcd34d" },
  { dot: "bg-rose-400",    text: "text-rose-700 dark:text-rose-300",       border: "border-rose-300/80 dark:border-rose-800/80",       hover: "hover:bg-rose-50/70 dark:hover:bg-rose-950/35",       active: "bg-rose-500 border-rose-500 text-white",    edge: "#fda4af" },
  { dot: "bg-cyan-400",    text: "text-cyan-700 dark:text-cyan-300",       border: "border-cyan-300/80 dark:border-cyan-800/80",       hover: "hover:bg-cyan-50/70 dark:hover:bg-cyan-950/35",       active: "bg-cyan-500 border-cyan-500 text-white",    edge: "#67e8f9" },
  { dot: "bg-lime-400",    text: "text-lime-700 dark:text-lime-300",       border: "border-lime-300/80 dark:border-lime-800/80",       hover: "hover:bg-lime-50/70 dark:hover:bg-lime-950/35",       active: "bg-lime-500 border-lime-500 text-white",    edge: "#bef264" },
  { dot: "bg-fuchsia-400", text: "text-fuchsia-700 dark:text-fuchsia-300", border: "border-fuchsia-300/80 dark:border-fuchsia-800/80", hover: "hover:bg-fuchsia-50/70 dark:hover:bg-fuchsia-950/35", active: "bg-fuchsia-500 border-fuchsia-500 text-white", edge: "#f0abfc" },
];

export function buildBranchStyleMap<T extends { branchRootId?: string | null }>(
  nodes: T[],
): Map<string, BranchStyle> {
  const map = new Map<string, BranchStyle>();
  let idx = 0;
  for (const n of nodes) {
    const id = n.branchRootId;
    if (!id || id === "ingest" || map.has(id)) continue;
    map.set(id, branchStyles[idx++ % branchStyles.length]);
  }
  return map;
}
