import "./styles.css";
const app = document.querySelector("#app");
if (!app) {
    throw new Error("Task pane root container is missing.");
}
app.innerHTML = `
  <section class="container">
    <h1 class="title">Pactolus Assistant</h1>
    <p class="subtitle">Capture a workbook snapshot and suggest input for the active cell.</p>
    <div class="actions">
      <button id="capture-btn">Capture snapshot</button>
      <button id="suggest-btn" class="secondary" disabled>Suggest input</button>
    </div>
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
const captureBtn = getElement("capture-btn");
const suggestBtn = getElement("suggest-btn");
const applyBtn = getElement("apply-btn");
const statusEl = getElement("status");
const snapshotPreview = getElement("snapshot-preview");
const suggestionText = getElement("suggestion-text");
let latestSnapshot = null;
let latestSuggestion = null;
let officeReady = false;
initializeOffice();
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
        applyBtn.disabled = true;
        renderOk("Snapshot captured from current selection.");
    }
    catch (error) {
        renderError(formatError(error));
    }
});
suggestBtn.addEventListener("click", async () => {
    if (!latestSnapshot) {
        renderError("Capture a snapshot first.");
        return;
    }
    latestSuggestion = makeSuggestion(latestSnapshot);
    suggestionText.textContent = `${latestSuggestion.value} (confidence ${Math.round(latestSuggestion.confidence * 100)}%) - ${latestSuggestion.reason}`;
    applyBtn.disabled = false;
    renderOk("Suggestion ready.");
});
applyBtn.addEventListener("click", async () => {
    if (!officeReady || !latestSuggestion) {
        renderError("No suggestion is available to apply.");
        return;
    }
    try {
        await applySuggestion(latestSuggestion.value);
        renderOk("Applied suggestion to the active cell.");
    }
    catch (error) {
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
async function captureSnapshot() {
    return Excel.run(async (context) => {
        const workbook = context.workbook;
        const sheet = workbook.worksheets.getActiveWorksheet();
        const range = workbook.getSelectedRange();
        workbook.load("name");
        sheet.load("name");
        range.load(["address", "values", "rowCount", "columnCount"]);
        await context.sync();
        const values = (range.values ?? []);
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
function makeSuggestion(snapshot) {
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
async function applySuggestion(value) {
    return Excel.run(async (context) => {
        const target = context.workbook.getActiveCell();
        target.values = [[value]];
        await context.sync();
    });
}
function stringifyCell(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required element: ${id}`);
    }
    return element;
}
function formatError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function renderOk(message) {
    statusEl.className = "status ok";
    statusEl.textContent = message;
}
function renderError(message) {
    statusEl.className = "status error";
    statusEl.textContent = message;
}
