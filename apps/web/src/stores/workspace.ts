"use client";

import { atom } from "jotai";

export type WorkspaceFile = {
  id: string;
  name: string;
};

export type WorkspaceSection = {
  id: string;
  name: string;
  files: WorkspaceFile[];
};

export type WorkspaceSnapshot = {
  id: string;
  name: string;
  sections: WorkspaceSection[];
};

export type DemoOrg = {
  id: string;
  name: string;
  plan: string;
  snapshots: WorkspaceSnapshot[];
};

const INITIAL_DEMO_ORGS: DemoOrg[] = [
  {
    id: "org-acme",
    name: "Acme Inc",
    plan: "Enterprise",
    snapshots: [
      {
        id: "acme-jun-2026",
        name: "June 2026",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [
              { id: "acme-jun-2026-raw-premium", name: "premium_book_june_2026.xlsx" },
              { id: "acme-jun-2026-raw-claims", name: "claims_extract_june_2026.csv" },
              { id: "acme-jun-2026-raw-bi", name: "portfolio_quality_june_2026.pbix" },
            ],
          },
          {
            id: "runs",
            name: "Runs",
            files: [
              { id: "acme-jun-2026-run-base", name: "base_scenario_run_01.csv" },
              { id: "acme-jun-2026-run-stress", name: "stress_scenario_run_02.csv" },
            ],
          },
          {
            id: "notes",
            name: "Notes",
            files: [
              { id: "acme-jun-2026-note-assumptions", name: "assumptions_june_2026.xlsx" },
              { id: "acme-jun-2026-note-summary", name: "review_notes_june_2026.csv" },
            ],
          },
        ],
      },
      {
        id: "acme-jan-2025",
        name: "January 2025",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [
              { id: "acme-jan-2025-raw-premium", name: "premium_book_jan_2025.xlsx" },
              { id: "acme-jan-2025-raw-claims", name: "claims_extract_jan_2025.csv" },
            ],
          },
          {
            id: "runs",
            name: "Runs",
            files: [
              { id: "acme-jan-2025-run-base", name: "base_scenario_run_01.csv" },
              { id: "acme-jan-2025-run-vol", name: "volatility_scenario_run_02.csv" },
            ],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "acme-jan-2025-note-kickoff", name: "kickoff_notes_jan_2025.csv" }],
          },
        ],
      },
      {
        id: "acme-oct-2024",
        name: "October 2024",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [{ id: "acme-oct-2024-raw-export", name: "historical_export_oct_2024.xlsx" }],
          },
          {
            id: "runs",
            name: "Runs",
            files: [{ id: "acme-oct-2024-run-backtest", name: "backtest_run_03.csv" }],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "acme-oct-2024-note-qc", name: "data_qc_notes_oct_2024.csv" }],
          },
        ],
      },
    ],
  },
  {
    id: "org-orion",
    name: "Orion Risk",
    plan: "Pro",
    snapshots: [
      {
        id: "orion-may-2026",
        name: "May 2026",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [
              { id: "orion-may-2026-raw-main", name: "portfolio_extract_may_2026.xlsx" },
              { id: "orion-may-2026-raw-loss", name: "loss_history_may_2026.csv" },
            ],
          },
          {
            id: "runs",
            name: "Runs",
            files: [{ id: "orion-may-2026-run", name: "main_run_2026_05_17.csv" }],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "orion-may-2026-note", name: "notes_may_2026.xlsx" }],
          },
        ],
      },
      {
        id: "orion-dec-2025",
        name: "December 2025",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [{ id: "orion-dec-2025-raw", name: "portfolio_extract_dec_2025.xlsx" }],
          },
          {
            id: "runs",
            name: "Runs",
            files: [{ id: "orion-dec-2025-run", name: "renewal_run_dec_2025.csv" }],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "orion-dec-2025-note", name: "meeting_notes_dec_2025.csv" }],
          },
        ],
      },
    ],
  },
  {
    id: "org-boreal",
    name: "Boreal Re",
    plan: "Enterprise",
    snapshots: [
      {
        id: "boreal-mar-2026",
        name: "March 2026",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [
              { id: "boreal-mar-2026-raw-exposure", name: "exposure_dump_mar_2026.xlsx" },
              { id: "boreal-mar-2026-raw-claims", name: "claims_dump_mar_2026.csv" },
            ],
          },
          {
            id: "runs",
            name: "Runs",
            files: [{ id: "boreal-mar-2026-run-1", name: "initial_run_mar_2026.csv" }],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "boreal-mar-2026-note", name: "analyst_notes_mar_2026.xlsx" }],
          },
        ],
      },
      {
        id: "boreal-feb-2026",
        name: "February 2026",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [{ id: "boreal-feb-2026-raw-1", name: "portfolio_dump_feb_2026.xlsx" }],
          },
          {
            id: "runs",
            name: "Runs",
            files: [{ id: "boreal-feb-2026-run-1", name: "rerun_feb_2026.csv" }],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "boreal-feb-2026-note-1", name: "followups_feb_2026.csv" }],
          },
        ],
      },
      {
        id: "boreal-jan-2026",
        name: "January 2026",
        sections: [
          {
            id: "raw-data",
            name: "Raw data",
            files: [{ id: "boreal-jan-2026-raw-1", name: "portfolio_dump_jan_2026.xlsx" }],
          },
          {
            id: "runs",
            name: "Runs",
            files: [{ id: "boreal-jan-2026-run-1", name: "run_jan_2026.csv" }],
          },
          {
            id: "notes",
            name: "Notes",
            files: [{ id: "boreal-jan-2026-note-1", name: "handoff_jan_2026.csv" }],
          },
        ],
      },
    ],
  },
];

export const demoOrgsAtom = atom<DemoOrg[]>(INITIAL_DEMO_ORGS);
