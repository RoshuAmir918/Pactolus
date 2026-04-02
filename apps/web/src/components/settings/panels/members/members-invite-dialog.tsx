"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function parseInviteEmailList(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    if (t.includes("@")) {
      out.push(t);
    }
  }
  return out;
}

export function MembersInviteDialog({
  open,
  onOpenChange,
  busy,
  errorMessage,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  errorMessage: string | null;
  onSend: (emails: string[]) => void | Promise<void>;
}) {
  const [raw, setRaw] = useState("");

  const parsedEmails = useMemo(() => parseInviteEmailList(raw), [raw]);
  const canSend = parsedEmails.length > 0;

  useEffect(() => {
    if (!open) {
      setRaw("");
    }
  }, [open]);

  function handleSend() {
    const emails = parseInviteEmailList(raw);
    if (emails.length === 0) {
      return;
    }
    void onSend(emails);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Invite New Members</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-1">
          <Label htmlFor="invite-members-emails">Emails</Label>
          <Textarea
            id="invite-members-emails"
            placeholder="Add emails, separated by comma"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            disabled={busy}
            className="min-h-[140px] resize-none bg-background/80"
          />
          {errorMessage ? (
            <p className="text-sm text-destructive whitespace-pre-wrap">{errorMessage}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={busy || !canSend} onClick={handleSend}>
            {busy ? "Sending…" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
