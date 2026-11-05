// Centered card used by the sign-in and set-password pages (no app shell around them).
import * as React from "react";
import { Logo } from "@/components/shell/logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center px-4 py-10">
      <div aria-hidden className="app-backdrop" />
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Logo className="h-9" />
        </div>
        <div className="rounded-card bg-card p-6 shadow-e2 md:p-7">
          <h1 className="text-title2 font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}
