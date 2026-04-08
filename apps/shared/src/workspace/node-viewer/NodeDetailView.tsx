import { useState } from "react";
import { toNarrative, toRegions, typeLabel } from "./adapters";
import type { ViewerCapture, ViewerIconSet, ViewerNode, ViewerNote, ViewerRegion } from "./types";

export function NodeDetailView(props: {
  node: ViewerNode | null;
  captures: ViewerCapture[] | null;
  loading: boolean;
  note?: ViewerNote;
  actions?: React.ReactNode;
  emptyMessage?: string;
  icons?: ViewerIconSet;
  compact?: boolean;
}) {
  const regions = toRegions(props.captures);
  const narrative = toNarrative(props.captures);
  const genericCaptures = (props.captures ?? []).filter(
    (capture) => !["narrative", "region_values", "output_values"].includes(capture.captureType),
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background rounded-xl border border-border">
      <div className={cx("border-b border-border shrink-0", props.compact ? "px-3 py-3" : "px-5 py-4", props.node ? "bg-emerald-500/5" : "")}>
        {props.node ? (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              {props.icons?.header ?? <span className="text-xs">S</span>}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-sm text-foreground leading-tight">{props.node.label}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{typeLabel(props.node.type)}</p>
            </div>
          </div>
        ) : (
          <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
        )}
      </div>

      <div className={cx("flex-1 overflow-y-auto", props.compact ? "px-3 py-3 space-y-3" : "px-5 py-4 space-y-5")}>
        {props.compact ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
              <div className="flex items-center gap-1 text-foreground/70">
                {props.icons?.operation ?? <span className="text-[10px]">#</span>}
                <span className="text-[10px] uppercase tracking-wide">Operation</span>
              </div>
              <div className="mt-0.5 text-foreground font-semibold font-mono">#{props.node?.index ?? "—"}</div>
            </div>
            <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
              <div className="flex items-center gap-1 text-foreground/70">
                {props.icons?.savedAt ?? <span className="text-[10px]">Cal</span>}
                <span className="text-[10px] uppercase tracking-wide">Saved at</span>
              </div>
              <div className="mt-0.5 text-foreground font-semibold truncate">
                {props.node?.createdAt ? fmtDateTime(props.node.createdAt) : "—"}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetaCell icon={props.icons?.operation ?? <span className="text-[10px]">#</span>} label="Operation">
              <span className="font-medium font-mono">#{props.node?.index ?? "—"}</span>
            </MetaCell>
            <MetaCell icon={props.icons?.savedAt ?? <span className="text-[10px]">Cal</span>} label="Saved at" span={2}>
              <span className="font-medium">{props.node?.createdAt ? fmtDateTime(props.node.createdAt) : "—"}</span>
            </MetaCell>
          </div>
        )}

        {props.actions}

        {props.note && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              {props.icons?.note ?? <span className="text-[10px]">Note</span>}
              <span>{props.note.label ?? "Analyst Note"}</span>
            </div>
            <textarea
              value={props.note.value}
              onChange={(event) => props.note?.onChange(event.target.value)}
              placeholder={props.note.placeholder ?? "Add a note about this scenario..."}
              rows={3}
              className={cx(
                "w-full resize-none rounded-md border border-border/50 bg-muted/20 px-3 py-2",
                "text-sm text-foreground placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors",
              )}
            />
            <div className="flex items-center justify-end gap-2">
              {props.note.isSaved && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                  {props.icons?.saved ?? <span className="text-[10px]">ok</span>} Saved
                </span>
              )}
              <button
                onClick={props.note.onSave}
                disabled={props.note.isSaving}
                className={cx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
                )}
              >
                {props.note.isSaving
                  ? (props.icons?.loading ?? <span className="text-[10px]">...</span>)
                  : (props.icons?.saveAction ?? <span className="text-[10px]">Save</span>)}
                Save Note
              </button>
            </div>
          </div>
        )}

        {narrative && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              {props.icons?.narrative ?? <span className="text-[10px]">Txt</span>}
              Narrative
            </div>
            <p className="text-sm leading-relaxed text-foreground bg-muted/30 rounded-md px-3 py-2.5 border border-border/50">
              {narrative}
            </p>
          </div>
        )}

        <div className="border-t border-border" />

        {props.loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            {props.icons?.loading ?? <span className="text-xs">...</span>}
            <span className="text-xs">Loading...</span>
          </div>
        ) : regions.length > 0 ? (
          <>
            <RegionSection regions={regions} type="output" icons={props.icons} />
            <RegionSection regions={regions} type="input" icons={props.icons} />
          </>
        ) : (
          <p className="text-xs text-foreground/70 italic py-2">
            {props.emptyMessage ?? "No region data captured for this save yet."}
          </p>
        )}

        {genericCaptures.length > 0 && <GenericCaptures captures={genericCaptures} icon={props.icons?.genericCapture} />}
      </div>
    </div>
  );
}

function fmtDateTime(value: Date): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCellVal(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}

function maxCols(values: unknown[][]): number {
  if (!values.length) return 0;
  return Math.max(...values.map((row) => row.filter((value) => value !== null && value !== undefined && value !== "").length));
}

function NarrowInline(props: { region: ViewerRegion; accentText: string; expandIcon?: (expanded: boolean) => React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const cellRef = `${props.region.sheetName ? `${props.region.sheetName}!` : ""}${props.region.address}`;
  const count = props.region.values.flat().filter((value) => value !== null && value !== undefined && value !== "").length;
  const flat = props.region.values.flatMap((row, rowIndex) =>
    row
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value, colIndex) => ({
        label: props.region.rowHeaders?.[rowIndex] ?? props.region.colHeaders?.[colIndex] ?? null,
        value: formatCellVal(value),
      })),
  );

  return (
    <div className="rounded-lg border border-border bg-card text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((curr) => !curr)}
        className="w-full flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <p className="font-medium text-foreground truncate leading-tight">
          {props.region.description ?? props.region.reason ?? cellRef}
        </p>
        <div className="flex items-center justify-between gap-1">
        <p className={cx("text-[10px] font-mono truncate", props.accentText)}>{cellRef}</p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground">{count} value{count !== 1 ? "s" : ""}</span>
            <span className={cx("text-[10px] text-muted-foreground transition-transform inline-block", expanded && "rotate-180")}>
              {props.expandIcon?.(expanded) ?? "v"}
            </span>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 flex flex-wrap gap-1">
          {flat.map((item, index) => (
            <div key={index} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">
              {item.label && <span className="text-muted-foreground text-[9px] max-w-[60px] truncate">{item.label}</span>}
              {item.label && <span className="text-muted-foreground/40 text-[8px]">.</span>}
              <span className="font-medium tabular-nums text-[10px]">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WideExpandable(props: { region: ViewerRegion; accentText: string; expandIcon?: (expanded: boolean) => React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const cellRef = `${props.region.sheetName ? `${props.region.sheetName}!` : ""}${props.region.address}`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setExpanded((curr) => !curr)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{props.region.description ?? props.region.reason ?? cellRef}</p>
          <p className={cx("text-[10px] font-mono mt-0.5", props.accentText)}>{cellRef}</p>
        </div>
        <span className={cx("text-[10px] text-muted-foreground shrink-0 transition-transform inline-block", expanded && "rotate-180")}>
          {props.expandIcon?.(expanded) ?? "v"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border overflow-auto max-h-56">
          <table className="text-[11px] font-mono w-full">
            {props.region.colHeaders && props.region.colHeaders.some((header) => header !== "") && (
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {props.region.rowHeaders && <th className="px-2 py-1 text-left text-muted-foreground font-medium border-r border-border/40" />}
                  {props.region.colHeaders.map((header, index) => (
                    <th key={index} className="px-2 py-1 text-right text-muted-foreground font-medium whitespace-nowrap border-r border-border/40 last:border-r-0">
                      {header || ""}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {props.region.values.map((row, rowIndex) => {
                let lastNonEmpty = row.length - 1;
                while (lastNonEmpty > 0 && (row[lastNonEmpty] === null || row[lastNonEmpty] === undefined || row[lastNonEmpty] === "")) {
                  lastNonEmpty--;
                }
                const trimmed = row.slice(0, lastNonEmpty + 1);
                return (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-muted/20" : ""}>
                    {props.region.rowHeaders && (
                      <td className="px-2 py-0.5 text-left text-muted-foreground font-medium whitespace-nowrap border-r border-border/40 sticky left-0 bg-inherit">
                        {props.region.rowHeaders[rowIndex] ?? ""}
                      </td>
                    )}
                    {trimmed.map((cell, colIndex) => (
                      <td key={colIndex} className="px-2 py-0.5 text-right tabular-nums whitespace-nowrap border-r border-border/40 last:border-r-0">
                        {cell === null || cell === undefined || cell === "" ? <span className="text-muted-foreground/30">.</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RegionCard(props: { region: ViewerRegion; type: "input" | "output"; expandIcon?: (expanded: boolean) => React.ReactNode }) {
  const accentText = props.type === "input" ? "text-sky-600 dark:text-sky-400" : "text-emerald-600 dark:text-emerald-400";
  const cols = maxCols(props.region.values);
  if (cols <= 1 && props.region.values.length === 1) {
    const cellRef = `${props.region.sheetName ? `${props.region.sheetName}!` : ""}${props.region.address}`;
    return (
      <div className="rounded-lg border border-border bg-card text-xs flex flex-col gap-1 px-3 py-2.5">
        <p className="font-medium text-foreground truncate leading-tight">{props.region.description ?? props.region.reason ?? cellRef}</p>
        <div className="flex items-end justify-between gap-1 min-w-0">
          <p className={cx("text-[10px] font-mono truncate", accentText)}>{cellRef}</p>
          <span className="font-semibold tabular-nums text-foreground text-sm shrink-0 leading-tight">
            {formatCellVal(props.region.values[0]?.[0])}
          </span>
        </div>
      </div>
    );
  }
  if (cols <= 2) return <NarrowInline region={props.region} accentText={accentText} expandIcon={props.expandIcon} />;
  return <WideExpandable region={props.region} accentText={accentText} expandIcon={props.expandIcon} />;
}

const SHOW_DEFAULT = 3;

function regionPriority(region: ViewerRegion): number {
  const cols = maxCols(region.values);
  const rows = region.values.length;
  if (cols <= 1 && rows === 1) return 0;
  if (cols <= 2) return 1;
  return 2;
}

function RegionSection(props: { regions: ViewerRegion[]; type: "input" | "output"; icons?: ViewerIconSet }) {
  const [showAll, setShowAll] = useState(false);
  const filtered = props.regions
    .filter((region) => region.regionType === props.type)
    .sort((a, b) => regionPriority(a) - regionPriority(b));

  if (!filtered.length) return null;
  const visible = showAll ? filtered : filtered.slice(0, SHOW_DEFAULT);
  const hidden = filtered.length - SHOW_DEFAULT;
  const compact = visible.filter((region) => maxCols(region.values) <= 2 || region.values.length === 1);
  const wide = visible.filter((region) => maxCols(region.values) > 2 && region.values.length > 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {props.type === "input" ? (
          props.icons?.regionInput ?? <span className="text-[10px] text-sky-500">IN</span>
        ) : (
          props.icons?.regionOutput ?? <span className="text-[10px] text-emerald-500">OUT</span>
        )}
        {props.type === "input" ? "Inputs" : "Outputs"}
        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
      </div>
      {compact.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {compact.map((region, index) => (
            <RegionCard key={index} region={region} type={props.type} expandIcon={props.icons?.expand} />
          ))}
        </div>
      )}
      {wide.length > 0 && (
        <div className="space-y-1.5">
          {wide.map((region, index) => (
            <RegionCard key={index} region={region} type={props.type} expandIcon={props.icons?.expand} />
          ))}
        </div>
      )}
      {!showAll && hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          + {hidden} more
        </button>
      )}
      {showAll && filtered.length > SHOW_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function GenericCaptures(props: { captures: ViewerCapture[]; icon?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="border-t border-border" />
      {props.captures.map((capture) => (
        <div key={capture.id} className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {props.icon ?? <span className="text-[10px]">.</span>}
            {capture.captureType.replace(/_/g, " ")}
          </div>
          <pre className="text-[11px] font-mono bg-muted/30 border border-border/50 rounded-md p-3 overflow-auto max-h-40 text-muted-foreground">
            {JSON.stringify(capture.payloadJson, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

function MetaCell(props: { icon: React.ReactNode; label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={cx("flex flex-col gap-1 bg-background rounded-md px-3 py-2 border border-border", props.span === 2 && "col-span-2")}>
      <div className="flex items-center gap-1 text-foreground/70">
        {props.icon}
        <span className="text-[10px] uppercase tracking-wide">{props.label}</span>
      </div>
      <div className="text-xs">{props.children}</div>
    </div>
  );
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
