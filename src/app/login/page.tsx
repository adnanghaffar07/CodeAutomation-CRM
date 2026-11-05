import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { from?: string; error?: string } }) {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard title="Sign in" subtitle="Use your CodeAutomation CRM account.">
      <LoginForm from={searchParams.from} notice={searchParams.error} />
    </AuthCard>
  );
}
