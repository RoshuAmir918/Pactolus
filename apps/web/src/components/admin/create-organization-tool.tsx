"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateInviteResult = Awaited<
  ReturnType<typeof trpc.invitations.createOrgInvite.mutate>
>;

export function CreateOrganizationTool() {
  const [organizationName, setOrganizationName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateInviteResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const created = await trpc.invitations.createOrgInvite.mutate({
        organizationName,
        inviteEmail,
      });
      setResult(created);
      setOrganizationName("");
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invitation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create organization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a pending organization and emails a 7-day invite link to set up the owner account.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2">
          <Label htmlFor="organization-name">Organization name</Label>
          <Input
            id="organization-name"
            placeholder="Acme Re"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-email">Invite email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="owner@acme.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Button type="submit" disabled={loading}>
            {loading ? "Sending invite…" : "Create and send invite"}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
          <p>
            Invite sent to <span className="font-medium">{result.inviteEmail}</span> for{" "}
            <span className="font-medium">{result.organizationName}</span>.
          </p>
          <p className="mt-1 text-muted-foreground">
            Expires at {new Date(result.expiresAt).toLocaleString()}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
