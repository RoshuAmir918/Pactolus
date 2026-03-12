# Pactolus Excel Add-in (Barebones)

This folder contains a minimal Excel task-pane add-in scaffold.

## What is included

- Excel add-in manifest (`manifest.xml`)
- Task pane web app powered by Vite + TypeScript
- Local snapshot capture from selected Excel range
- Placeholder suggestion logic
- "Apply to active cell" action

## Prerequisites

- Microsoft Excel (Desktop or Web with sideload support)
- Node.js 20+

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start local web app + sideload into Excel:

   ```bash
   npm start
   ```

   This runs:
   - Vite on `https://localhost:3001`
   - Office sideloading via `manifest.xml`

3. Open the task pane from the ribbon button:
   - Home tab
   - Group: "Pactolus"
   - Button: "Open Assistant"

## Useful scripts

- `npm run dev` - run only Vite task pane app
- `npm run sideload` - sideload manifest into Excel
- `npm run stop` - stop sideload debugging
- `npm run validate` - validate add-in manifest
- `npm run build` - type-check + production build

## Notes

- Suggestion generation is intentionally local and simple for now.
- No backend calls are wired yet.
