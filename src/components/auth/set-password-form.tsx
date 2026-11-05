"use client";
// Choose a password after following an invite or reset link. The person already holds a session
// (created when the one-time link was verified), so this just updates their Supabase password.

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export const MIN_PASSWORD = 12;

export function SetPasswordForm() {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: updateError } = await createBrowserSupabase().auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      return setError(updateError.message);
    }
    const res = await fetch("/api/auth/password-set", { method: "POST" });
    if (!res.ok) {
      setBusy(false);
      return setError("Your password was saved, but this account has no active access. Ask an admin.");
    }
    window.location.assign("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-caption text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-control bg-destructive-tint px-3 py-2 text-footnote text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !password || !confirm}>
        {busy && <Loader2 className="animate-spin" />} Save password and continue
      </Button>
    </form>
  );
}
