"use client";

import { useEffect, useState } from "react";
import { Calendar, Check, ChevronDown, CircleDot, FileText, Hash, Loader2, NotebookPen, Save, ArrowDown, ArrowUp } from "lucide-react";
import { NodeDetailView, toViewerNode, type ViewerCapture } from "@shared/workspace/node-viewer";
import { trpc } from "@/lib/trpc-client";

type Operation = {
  id: string;
  operationIndex: number;
  operationType: string;
  parametersJson: unknown;
  parentOperationId: string | null;
  supersedesOperationId: string | null;
  documentId: string | null;
  createdAt: Date;
};

type Props = {
  runId: string;
  stepId: string;
};

export function NodeDetailPanel({ runId, stepId }: Props) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [captures, setCaptures] = useState<ViewerCapture[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string>("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    trpc.operations.getRunOperations
      .query({ runId })
      .then(({ operations }) => {
        if (cancelled) return;
        setOperation((operations.find((item) => item.id === stepId) as Operation | undefined) ?? null);
      })
      .catch(() => {
        if (!cancelled) setOperation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, stepId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    trpc.operations.getOperationCaptures
      .query({ runId, operationId: stepId })
      .then(({ captures: result }) => {
        if (!cancelled) setCaptures(result as ViewerCapture[]);
      })
      .catch(() => {
        if (!cancelled) setCaptures([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, stepId]);

  useEffect(() => {
    let cancelled = false;
    setNote("");
    setNoteSaved(false);
    trpc.operations.getOperationNote
      .query({ runId, operationId: stepId })
      .then(({ noteText }) => {
        if (cancelled) return;
        if (noteText) {
          setNote(noteText);
          return;
        }
        trpc.operations.getOperationCaptures
          .query({ runId, operationId: stepId })
          .then(({ captures: result }) => {
            if (cancelled) return;
            const narrative = result.find((capture) => capture.captureType === "narrative");
            setNote(((narrative?.payloadJson as { text?: string } | null)?.text ?? "").trim());
          })
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [runId, stepId]);

  async function saveNote() {
    setNoteSaving(true);
    try {
      await trpc.operations.setOperationNote.mutate({ runId, operationId: stepId, noteText: note });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <NodeDetailView
      node={
        operation
          ? toViewerNode({
              id: operation.id,
              index: operation.operationIndex,
              type: operation.operationType,
              createdAt: operation.createdAt,
              parametersJson: operation.parametersJson,
            })
          : null
      }
      captures={captures}
      loading={loading}
      note={{
        value: note,
        onChange: (value) => {
          setNote(value);
          setNoteSaved(false);
        },
        onSave: saveNote,
        isSaving: noteSaving,
        isSaved: noteSaved,
      }}
      icons={{
        header: <Save className="w-4 h-4" />,
        operation: <Hash className="w-3.5 h-3.5" />,
        savedAt: <Calendar className="w-3.5 h-3.5" />,
        note: <NotebookPen className="w-3.5 h-3.5" />,
        saved: <Check className="w-3 h-3" />,
        saveAction: <Save className="w-3 h-3" />,
        narrative: <FileText className="w-3.5 h-3.5" />,
        loading: <Loader2 className="w-4 h-4 animate-spin" />,
        regionInput: <ArrowDown className="w-3.5 h-3.5 text-sky-500" />,
        regionOutput: <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />,
        genericCapture: <CircleDot className="w-3.5 h-3.5" />,
        expand: (expanded) => <ChevronDown className={expanded ? "w-3 h-3 rotate-180" : "w-3 h-3"} />,
      }}
    />
  );
}
