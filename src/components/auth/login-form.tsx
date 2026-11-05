"use client";
// Email + password sign-in against Supabase Auth, then a server check that the person has ACTIVE access.
// Accounts are created by an admin (public sign-up is off in Supabase), so there is no "create account" link.

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const NOTICE: Record<string, string> = {
  link: "That link is invalid or has expired. Ask an admin for a new one.",
  "no-access": "Your account has no active access to this workspace.",
};

export function LoginForm({ from, notice }: { from?: string; notice?: string }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(notice ? NOTICE[notice] ?? null : null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setBusy(false);
      setError("Email or password is incorrect.");
      return;
    }
    const res = await fetch("/api/auth/session-start", { method: "POST" });
    if (!res.ok) {
      await supabase.auth.signOut();
      setBusy(false);
      setError(NOTICE["no-access"]);
      return;
    }
    // Only same-site paths are allowed as the post-sign-in destination.
    const dest = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
    window.location.assign(dest);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-control bg-destructive-tint px-3 py-2 text-footnote text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !email || !password}>
        {busy && <Loader2 className="animate-spin" />} Sign in
      </Button>
      <p className="text-center text-footnote text-muted-foreground">
        No account yet, or forgot your password? Ask your admin for a link.
      </p>
    </form>
  );
}
