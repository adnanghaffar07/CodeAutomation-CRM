"use client";
// The signed-in user + workspace for client components inside the shell.
// Low-frequency, so plain context. Outside the shell: null.

import * as React from "react";

export type Role = "ceo_admin" | "manager" | "sales_bd" | "data_researcher";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  workspaceName: string;
  avatarUrl: string | null;
};

const ShellUserContext = React.createContext<ShellUser | null>(null);

export function ShellUserProvider({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return <ShellUserContext.Provider value={user}>{children}</ShellUserContext.Provider>;
}

export function useShellUser(): ShellUser | null {
  return React.useContext(ShellUserContext);
}
