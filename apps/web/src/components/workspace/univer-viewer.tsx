"use client";

import { useEffect, useRef } from "react";
import type { IWorkbookData } from "@/lib/exceljs-to-univer";

export function UniverViewer({ data }: { data: IWorkbookData }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;
    let disposeUniver: (() => void) | null = null;

    async function init() {
      const [{ createUniver, LocaleType }, { UniverSheetsCorePreset }, enUS] = await Promise.all([
        import("@univerjs/presets"),
        import("@univerjs/preset-sheets-core"),
        import("@univerjs/preset-sheets-core/locales/en-US"),
      ]);
      // CSS must be side-effect imported
      await import("@univerjs/preset-sheets-core/lib/index.css");

      if (disposed) return;

      const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: enUS.default },
        presets: [
          UniverSheetsCorePreset({
            container,
            workerURL: undefined as unknown as string,
            header: false,
            toolbar: false,
            formulaBar: false,
          }),
        ],
      });

      univerAPI.createWorkbook(data as Parameters<typeof univerAPI.createWorkbook>[0]);

      // Prevent any editing
      const wb = univerAPI.getActiveWorkbook();
      if (wb) {
        try {
          // Univer 0.19 facade method
          (wb as unknown as { setEditable?: (v: boolean) => void }).setEditable?.(false);
        } catch {
          // ignore — read-only via UI config is sufficient
        }
      }

      disposeUniver = () => univerAPI.dispose?.();
    }

    init().catch(console.error);

    return () => {
      disposed = true;
      disposeUniver?.();
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
      className="univer-container"
    />
  );
}
