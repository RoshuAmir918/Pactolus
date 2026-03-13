import "./styles.css";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";

type Snapshot = {
  workbookName: string;
  sheetName: string;
  selectedAddress: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  sampleRows: string[][];
};

type Suggestion = {
  value: string;
  reason: string;
  confidence: number;
};

type LiveHintSuggestion = {
  sourceColumn: string;
  confidence: number;
  sourceContextDocumentId: string;
  matchMethod: "exact" | "substring" | "token_overlap";
};

type MonitoredRegion = {
  id?: string;
  snapshotId?: string;
  sheetName?: string;
  address: string;
  regionType: "input" | "output";
  confidencePercent: number;
  userConfirmed: boolean;
  status?: "active" | "archived";
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Task pane root container is missing.");
}

app.innerHTML = `
  <section class="container">
    <h1 class="title">Pactolus Assistant</h1>
    <p class="subtitle">Barebones workflow validation for Excel -> API context hints.</p>
    <article class="card">
      <strong>Connection</strong>
      <label class="field-label" for="api-url">API URL</label>
      <input id="api-url" type="text" value="https://localhost:3001" />
      <label class="field-label" for="email">Email</label>
      <input id="email" type="email" placeholder="you@company.com" />
      <label class="field-label" for="password">Password</label>
      <input id="password" type="password" placeholder="password" />
      <div class="actions">
        <button id="login-btn" class="secondary">Login</button>
      </div>
    </article>
    <article class="card">
      <strong>Context</strong>
      <label class="field-label" for="snapshot-id">Snapshot ID</label>
      <input id="snapshot-id" type="text" placeholder="snapshot uuid" />
      <label class="field-label" for="target-columns">Target columns (comma-separated)</label>
      <textarea id="target-columns" rows="3" placeholder="policy_number, accident_year, paid_loss"></textarea>
    </article>
    <div class="actions">
      <button id="capture-btn">Capture snapshot</button>
      <button id="suggest-btn" class="secondary" disabled>Get live hints</button>
    </div>
    <article class="card">
      <strong>Monitored regions (v1)</strong>
      <div class="actions">
        <button id="detect-btn" class="secondary" disabled>Detect regions</button>
        <button id="save-regions-btn" class="secondary" disabled>Save monitored</button>
      </div>
      <div class="actions">
        <button id="start-monitoring-btn" class="secondary" disabled>Start monitoring</button>
        <button id="stop-monitoring-btn" class="secondary" disabled>Stop monitoring</button>
      </div>
      <pre id="regions-preview">No regions detected.</pre>
    </article>
    <article class="card">
      <strong>Current suggestion</strong>
      <p class="muted" id="suggestion-text">No suggestion yet.</p>
      <div class="actions">
        <button id="apply-btn" disabled>Apply to active cell</button>
      </div>
    </article>
    <article class="card">
      <strong>Snapshot preview</strong>
      <pre id="snapshot-preview">No snapshot captured.</pre>
    </article>
    <p id="status" class="status"></p>
  </section>
`;

const captureBtn = getElement<HTMLButtonElement>("capture-btn");
const suggestBtn = getElement<HTMLButtonElement>("suggest-btn");
const applyBtn = getElement<HTMLButtonElement>("apply-btn");
const detectBtn = getElement<HTMLButtonElement>("detect-btn");
const saveRegionsBtn = getElement<HTMLButtonElement>("save-regions-btn");
const startMonitoringBtn = getElement<HTMLButtonElement>("start-monitoring-btn");
const stopMonitoringBtn = getElement<HTMLButtonElement>("stop-monitoring-btn");
const loginBtn = getElement<HTMLButtonElement>("login-btn");
const apiUrlInput = getElement<HTMLInputElement>("api-url");
const emailInput = getElement<HTMLInputElement>("email");
const passwordInput = getElement<HTMLInputElement>("password");
const snapshotIdInput = getElement<HTMLInputElement>("snapshot-id");
const targetColumnsInput = getElement<HTMLTextAreaElement>("target-columns");
const statusEl = getElement<HTMLParagraphElement>("status");
const snapshotPreview = getElement<HTMLPreElement>("snapshot-preview");
const suggestionText = getElement<HTMLParagraphElement>("suggestion-text");
const regionsPreview = getElement<HTMLPreElement>("regions-preview");

let latestSnapshot: Snapshot | null = null;
let latestSuggestion: Suggestion | null = null;
let detectedRegions: MonitoredRegion[] = [];
let monitoredRegions: MonitoredRegion[] = [];
let monitoringSubscription: OfficeExtension.EventHandlerResult<Excel.WorksheetChangedEventArgs> | null =
  null;
let officeReady = false;
let authenticated = false;

initializeOffice();

loginBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!apiUrl || !email || !password) {
    renderError("Enter API URL, email, and password.");
    return;
  }

  const startedAt = Date.now();
  console.log(`[excel.login] start apiUrl=${apiUrl} email=${email}`);
  renderOk("Logging in...");
  loginBtn.disabled = true;

  try {
    const client = getApiClient(apiUrl);
    await client.auth.login.mutate({
      email,
      password,
    });
    const me = await client.auth.me.query();
    console.log(
      `[excel.login] success email=${email} elapsedMs=${Date.now() - startedAt} me=${JSON.stringify(me)}`,
    );
    authenticated = true;
    renderOk("Authenticated with Pactolus API.");
  } catch (error) {
    authenticated = false;
    console.log(
      `[excel.login] failure email=${email} elapsedMs=${Date.now() - startedAt} error=${formatError(error)}`,
    );
    renderError(`Login failed: ${formatError(error)}`);
  } finally {
    loginBtn.disabled = false;
  }
});

captureBtn.addEventListener("click", async () => {
  if (!officeReady) {
    renderError("Office is not ready yet.");
    return;
  }

  try {
    const snapshot = await captureSnapshot();
    latestSnapshot = snapshot;
    latestSuggestion = null;
    suggestionText.textContent = "No suggestion yet.";
    snapshotPreview.textContent = JSON.stringify(snapshot, null, 2);
    suggestBtn.disabled = false;
    detectBtn.disabled = false;
    applyBtn.disabled = true;
    renderOk("Snapshot captured from current selection.");
  } catch (error) {
    renderError(formatError(error));
  }
});

detectBtn.addEventListener("click", async () => {
  if (!latestSnapshot) {
    renderError("Capture a snapshot first.");
    return;
  }
  const snapshotId = snapshotIdInput.value.trim();
  if (!snapshotId) {
    renderError("Enter a snapshot ID.");
    return;
  }
  if (!authenticated) {
    renderError("Login first.");
    return;
  }

  try {
    const client = getApiClient(apiUrlInput.value.trim());
    const result = await client.excel.detectRegions.query({
      snapshotId,
      maxRegionsPerType: 2,
      sheetSlice: {
        workbookName: latestSnapshot.workbookName,
        sheetName: latestSnapshot.sheetName,
        selectedAddress: latestSnapshot.selectedAddress,
        rowCount: latestSnapshot.rowCount,
        columnCount: latestSnapshot.columnCount,
        headers: latestSnapshot.headers,
        sampleRows: latestSnapshot.sampleRows,
      },
    });
    detectedRegions = result.candidates;
    regionsPreview.textContent = JSON.stringify(detectedRegions, null, 2);
    saveRegionsBtn.disabled = detectedRegions.length === 0;
    startMonitoringBtn.disabled = true;
    renderOk("Detected region candidates from current selection.");
  } catch (error) {
    renderError(`Region detection failed: ${formatError(error)}`);
  }
});

saveRegionsBtn.addEventListener("click", async () => {
  if (!latestSnapshot) {
    renderError("Capture a snapshot first.");
    return;
  }
  if (detectedRegions.length === 0) {
    renderError("Detect regions first.");
    return;
  }
  const snapshotId = snapshotIdInput.value.trim();
  if (!snapshotId) {
    renderError("Enter a snapshot ID.");
    return;
  }
  if (!authenticated) {
    renderError("Login first.");
    return;
  }

  try {
    const client = getApiClient(apiUrlInput.value.trim());
    const result = await client.excel.saveMonitoredRegions.mutate({
      snapshotId,
      sheetName: latestSnapshot.sheetName,
      regions: detectedRegions.map((region) => ({
        ...region,
        userConfirmed: true,
      })),
    });
    monitoredRegions = result.regions;
    regionsPreview.textContent = JSON.stringify(monitoredRegions, null, 2);
    startMonitoringBtn.disabled = monitoredRegions.length === 0;
    renderOk("Saved monitored regions.");
  } catch (error) {
    renderError(`Save monitored regions failed: ${formatError(error)}`);
  }
});

startMonitoringBtn.addEventListener("click", async () => {
  if (!latestSnapshot) {
    renderError("Capture a snapshot first.");
    return;
  }
  const snapshotId = snapshotIdInput.value.trim();
  if (!snapshotId) {
    renderError("Enter a snapshot ID.");
    return;
  }
  if (!authenticated) {
    renderError("Login first.");
    return;
  }

  try {
    const client = getApiClient(apiUrlInput.value.trim());
    const result = await client.excel.getMonitoredRegions.query({
      snapshotId,
      sheetName: latestSnapshot.sheetName,
    });
    monitoredRegions = result.regions;
    regionsPreview.textContent = JSON.stringify(monitoredRegions, null, 2);
    await startWorksheetMonitoring(snapshotId, latestSnapshot.sheetName);
    stopMonitoringBtn.disabled = false;
    startMonitoringBtn.disabled = true;
    renderOk("Monitoring started for detected regions.");
  } catch (error) {
    renderError(`Start monitoring failed: ${formatError(error)}`);
  }
});

stopMonitoringBtn.addEventListener("click", async () => {
  try {
    await stopWorksheetMonitoring();
    stopMonitoringBtn.disabled = true;
    startMonitoringBtn.disabled = monitoredRegions.length === 0;
    renderOk("Monitoring stopped.");
  } catch (error) {
    renderError(`Stop monitoring failed: ${formatError(error)}`);
  }
});

suggestBtn.addEventListener("click", async () => {
  if (!latestSnapshot) {
    renderError("Capture a snapshot first.");
    return;
  }

  const snapshotId = snapshotIdInput.value.trim();
  const targetColumns = parseTargetColumns(targetColumnsInput.value);
  if (!snapshotId) {
    renderError("Enter a snapshot ID.");
    return;
  }
  if (targetColumns.length === 0) {
    renderError("Provide at least one target column.");
    return;
  }
  if (!authenticated) {
    renderError("Login first.");
    return;
  }

  try {
    const apiUrl = apiUrlInput.value.trim();
    const client = getApiClient(apiUrl);
    const result = await client.excel.getLiveHints.query({
      snapshotId,
      targetColumns,
      maxSuggestionsPerColumn: 1,
      sheetSlice: {
        workbookName: latestSnapshot.workbookName,
        sheetName: latestSnapshot.sheetName,
        selectedAddress: latestSnapshot.selectedAddress,
        rowCount: latestSnapshot.rowCount,
        columnCount: latestSnapshot.columnCount,
        headers: latestSnapshot.headers,
        sampleRows: latestSnapshot.sampleRows,
      },
    });

    const best = pickBestSuggestion(result.hints);
    if (!best) {
      latestSuggestion = null;
      suggestionText.textContent = "No live hint found.";
      applyBtn.disabled = true;
      renderOk("No suggestions returned for current target columns.");
      return;
    }

    latestSuggestion = {
      value: best.sourceColumn,
      confidence: best.confidence,
      reason: `Live hint (${best.matchMethod}) from context doc ${best.sourceContextDocumentId}`,
    };
    suggestionText.textContent = `${latestSuggestion.value} (confidence ${Math.round(latestSuggestion.confidence * 100)}%) - ${latestSuggestion.reason}`;
    applyBtn.disabled = false;
    renderOk("Live hint suggestion ready.");
  } catch (error) {
    renderError(`Hint request failed: ${formatError(error)}`);
  }
});

applyBtn.addEventListener("click", async () => {
  if (!officeReady || !latestSuggestion) {
    renderError("No suggestion is available to apply.");
    return;
  }

  try {
    await applySuggestion(latestSuggestion.value);
    renderOk("Applied suggestion to the active cell.");
  } catch (error) {
    renderError(formatError(error));
  }
});

function initializeOffice() {
  if (!("Office" in window)) {
    renderError("Office.js is unavailable. Open this via Excel add-in sideload.");
    return;
  }

  Office.onReady((info) => {
    if (info.host !== Office.HostType.Excel) {
      renderError("This add-in currently supports only Excel.");
      return;
    }

    officeReady = true;
    renderOk("Connected to Excel.");
  });
}

async function captureSnapshot(): Promise<Snapshot> {
  return Excel.run(async (context) => {
    const workbook = context.workbook;
    const sheet = workbook.worksheets.getActiveWorksheet();
    const range = workbook.getSelectedRange();

    workbook.load("name");
    sheet.load("name");
    range.load(["address", "values", "rowCount", "columnCount"]);
    await context.sync();

    const values = (range.values ?? []) as unknown[][];
    const normalized = values.map((row) => row.map((cell) => stringifyCell(cell)));
    const headers = normalized[0] ?? [];
    const sampleRows = normalized.slice(1, 11);

    return {
      workbookName: workbook.name,
      sheetName: sheet.name,
      selectedAddress: range.address,
      rowCount: range.rowCount,
      columnCount: range.columnCount,
      headers,
      sampleRows,
    };
  });
}

function makeSuggestion(snapshot: Snapshot): Suggestion {
  const firstRow = snapshot.sampleRows[0];
  if (firstRow && firstRow[0]) {
    return {
      value: firstRow[0],
      confidence: 0.62,
      reason: "Using first observed value in the selected sample as a baseline.",
    };
  }

  if (snapshot.headers.length > 0 && snapshot.headers[0]) {
    return {
      value: `Example ${snapshot.headers[0]}`,
      confidence: 0.45,
      reason: "Using first header label as a fallback suggestion.",
    };
  }

  return {
    value: "Example Input",
    confidence: 0.3,
    reason: "No row/header signal detected, returning generic placeholder.",
  };
}

function parseTargetColumns(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

async function startWorksheetMonitoring(snapshotId: string, sheetName: string): Promise<void> {
  await stopWorksheetMonitoring();

  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    monitoringSubscription = sheet.onChanged.add(async (eventArgs) => {
      await handleWorksheetChanged(snapshotId, sheetName, eventArgs);
    });
    await context.sync();
  });
}

async function stopWorksheetMonitoring(): Promise<void> {
  if (!monitoringSubscription) {
    return;
  }

  await Excel.run(monitoringSubscription.context, async (context) => {
    monitoringSubscription?.remove();
    await context.sync();
  });
  monitoringSubscription = null;
}

async function handleWorksheetChanged(
  snapshotId: string,
  sheetName: string,
  eventArgs: Excel.WorksheetChangedEventArgs,
): Promise<void> {
  const changedAddress = normalizeAddress(eventArgs.address);
  if (!changedAddress) {
    return;
  }

  const triggered = monitoredRegions.filter(
    (region) =>
      region.sheetName === sheetName &&
      region.status === "active" &&
      rangesIntersect(normalizeAddress(region.address), changedAddress),
  );
  if (triggered.length === 0) {
    return;
  }

  const client = getApiClient(apiUrlInput.value.trim());
  for (const region of triggered) {
    await client.excel.ingestRegionEvent.mutate({
      snapshotId,
      sheetName,
      address: changedAddress,
      eventType: region.regionType === "input" ? "input_change" : "output_change",
      detailsJson: {
        regionId: region.id,
        regionAddress: region.address,
        changeType: eventArgs.changeType,
      },
    });
  }

  renderOk(`Captured ${triggered.length} monitored change event(s).`);
}

function pickBestSuggestion(
  hints: Array<{
    targetColumn: string;
    suggestions: LiveHintSuggestion[];
  }>,
): LiveHintSuggestion | null {
  let best: LiveHintSuggestion | null = null;
  for (const hint of hints) {
    for (const suggestion of hint.suggestions) {
      if (!best || suggestion.confidence > best.confidence) {
        best = suggestion;
      }
    }
  }
  return best;
}

function getApiClient(apiUrl: string): any {
  return createTRPCProxyClient<any>({
    links: [
      httpBatchLink({
        url: `${apiUrl}/trpc`,
        fetch: async (url, options) => {
          console.log(`[excel.api] request url=${String(url)}`);
          const response = await fetch(url, {
            ...options,
            credentials: "include",
          });
          console.log(
            `[excel.api] response url=${String(url)} status=${response.status} ok=${response.ok}`,
          );
          return response;
        },
      }),
    ],
  });
}

function normalizeAddress(address: string): string {
  const withoutSheet = address.includes("!")
    ? address.substring(address.indexOf("!") + 1)
    : address;
  const withoutAbsolute = withoutSheet.replace(/\$/g, "");
  return withoutAbsolute.split(",")[0]?.trim().toUpperCase() ?? "";
}

function rangesIntersect(left: string, right: string): boolean {
  const a = parseRange(left);
  const b = parseRange(right);
  if (!a || !b) {
    return false;
  }

  return !(
    a.endRow < b.startRow ||
    b.endRow < a.startRow ||
    a.endCol < b.startCol ||
    b.endCol < a.startCol
  );
}

function parseRange(value: string):
  | { startRow: number; endRow: number; startCol: number; endCol: number }
  | null {
  if (!value) {
    return null;
  }

  const [startPart, endPart] = value.split(":");
  const start = parseCell(startPart);
  const end = parseCell(endPart ?? startPart);
  if (!start || !end) {
    return null;
  }

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
}

function parseCell(value: string): { row: number; col: number } | null {
  const match = value.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return null;
  }
  const col = columnToNumber(match[1]);
  const row = Number(match[2]);
  if (!col || !row) {
    return null;
  }
  return { row, col };
}

function columnToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i += 1) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

async function applySuggestion(value: string): Promise<void> {
  return Excel.run(async (context) => {
    const target = context.workbook.getActiveCell();
    target.values = [[value]];
    await context.sync();
  });
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }

  return element as T;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function renderOk(message: string) {
  statusEl.className = "status ok";
  statusEl.textContent = message;
}

function renderError(message: string) {
  statusEl.className = "status error";
  statusEl.textContent = message;
}
