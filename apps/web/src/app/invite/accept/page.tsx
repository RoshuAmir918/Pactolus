"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMe } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc-client";
import { authUserAtom } from "@/stores/auth";

type InviteInfo = Awaited<ReturnType<typeof trpc.invitations.getInfo.query>>;

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") ?? "").trim(), [searchParams]);
  const authUser = useAtomValue(authUserAtom);
  const setAuthUser = useSetAtom(authUserAtom);

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(setAuthUser)
      .catch(() => {});
  }, [setAuthUser]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setInfo({ valid: false, reason: "not_found" });
        setLoadingInfo(false);
        return;
      }

      setLoadingInfo(true);
      setInfoError(null);
      try {
        const data = await trpc.invitations.getInfo.query({ token });
        if (!cancelled) setInfo(data);
      } catch (err) {
        if (!cancelled) {
          setInfoError(err instanceof Error ? err.message : "Could not validate invite");
        }
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await trpc.invitations.accept.mutate({
        token,
        fullName,
        password,
      });
      setAccepted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setSubmitting(false);
    }
  }

  async function onJoinWithLogin() {
    if (!token) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      await trpc.invitations.joinWithToken.mutate({ token });
      setAccepted(true);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join organization");
    } finally {
      setJoinBusy(false);
    }
  }

  if (loadingInfo) {
    return <main className="mx-auto max-w-xl p-8 text-sm text-muted-foreground">Loading invite…</main>;
  }

  if (infoError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p className="text-sm text-destructive">{infoError}</p>
      </main>
    );
  }

  if (!info || !info.valid) {
    const reason = info?.reason ?? "not_found";
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {reason === "expired"
            ? "This invite has expired."
            : reason === "used"
              ? "This invite has already been used."
              : "This invite link is invalid."}
        </p>
      </main>
    );
  }

  const isMemberInvite = info.organizationStatus === "active";
  const emailMatchesInvite =
    authUser !== null &&
    authUser.email.trim().toLowerCase() === info.inviteEmail.trim().toLowerCase();

  if (accepted) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isMemberInvite ? "You are in" : "Organization activated"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isMemberInvite
            ? `You have joined ${info.organizationName}. You can open the workspace.`
            : `Your account is ready for ${info.organizationName}. You can sign in now.`}
        </p>
        <Button asChild className="mt-4">
          <Link href={isMemberInvite ? "/workspace" : "/login"}>
            {isMemberInvite ? "Go to workspace" : "Go to login"}
          </Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isMemberInvite ? "Join organization" : "Finish organization setup"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You were invited to {isMemberInvite ? "join" : "activate"}{" "}
          <span className="font-medium">{info.organizationName}</span> as{" "}
          <span className="font-medium">{info.inviteEmail}</span>.
        </p>
      </div>

      {isMemberInvite && emailMatchesInvite ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            You are signed in as the invited email. Accept to add this organization to your account
            and switch your session to it.
          </p>
          {joinError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {joinError}
            </p>
          ) : null}
          <Button className="mt-4" type="button" disabled={joinBusy} onClick={() => void onJoinWithLogin()}>
            {joinBusy ? "Joining…" : "Accept invitation"}
          </Button>
        </div>
      ) : null}

      {isMemberInvite && authUser !== null && !emailMatchesInvite ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p>
            You are signed in as <strong>{authUser.email}</strong>, but this invite is for{" "}
            <strong>{info.inviteEmail}</strong>. Log out and sign in with the invited email, then open
            this link again.
          </p>
          <Button asChild variant="outline" className="mt-3" size="sm">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      ) : null}

      {isMemberInvite && authUser === null ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Already have an account with {info.inviteEmail}?{" "}
          <Link href={`/login?next=${encodeURIComponent(`/invite/accept?token=${encodeURIComponent(token)}`)}`} className="underline">
            Log in
          </Link>{" "}
          and return to this page to accept.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">
          {isMemberInvite ? "New to Pactolus? Create your account" : "Create your account"}
        </p>
        <div className="grid gap-2">
          <Label htmlFor="full-name">Full name</Label>
          <Input
            id="full-name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? isMemberInvite
                ? "Creating account…"
                : "Activating…"
              : isMemberInvite
                ? "Create account and join"
                : "Create account and activate organization"}
          </Button>
        </div>
      </form>

      {submitError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}
    </main>
  );
}
