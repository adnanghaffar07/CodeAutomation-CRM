import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  // Reached only through a verified one-time link (the middleware requires a session); without active access, back to sign-in.
  if (!(await currentUser())) redirect("/login?error=no-access");
  return (
    <AuthCard title="Set your password" subtitle="Choose a password for signing in from now on.">
      <SetPasswordForm />
    </AuthCard>
  );
}
