// The one permission matrix (SPEC §R-1). The UI hides what a role cannot use, but the API checks
// requireCapability() and the database enforces the same rules with RLS, so hiding is only a convenience.
import type { Role } from "@/lib/scope";

export type Capability =
  | "contacts.read" | "contacts.write"
  | "accounts.read" | "accounts.write"
  | "pipeline.read" | "pipeline.write"
  | "assignments.read" | "assignments.manage"
  | "imports.use"
  | "exports.request" | "exports.approve"
  | "integrations.view" | "integrations.manage"
  | "reports.read"
  | "users.read" | "users.manage"
  | "audit.read"
  | "settings.access";

const CEO: Role = "ceo_admin";
const MGR: Role = "manager";
const BD: Role = "sales_bd";
const DR: Role = "data_researcher";

/** Capability → roles holding it. Record-level limits (own/assigned records only) are enforced by RLS in Phase 2+. */
export const MATRIX: Record<Capability, readonly Role[]> = {
  "contacts.read": [CEO, MGR, BD, DR],
  "contacts.write": [CEO, MGR, BD, DR],
  "accounts.read": [CEO, MGR, BD, DR],
  "accounts.write": [CEO, MGR, BD, DR],
  "pipeline.read": [CEO, MGR, BD],
  "pipeline.write": [CEO, MGR, BD],
  "assignments.read": [CEO, MGR, BD, DR],
  "assignments.manage": [CEO, MGR],
  "imports.use": [CEO, MGR, DR],
  "exports.request": [MGR, BD, DR],
  "exports.approve": [CEO],
  "integrations.view": [CEO, MGR],
  "integrations.manage": [CEO],
  "reports.read": [CEO, MGR],
  "users.read": [CEO, MGR],
  "users.manage": [CEO],
  "audit.read": [CEO, MGR],
  "settings.access": [CEO],
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  return !!role && MATRIX[cap].includes(role);
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(cap: Capability) {
    super(`Not allowed: ${cap}`);
  }
}

export function requireCapability(role: Role | null | undefined, cap: Capability): void {
  if (!can(role, cap)) throw new ForbiddenError(cap);
}

export const ROLE_LABEL: Record<Role, string> = {
  ceo_admin: "CEO / Admin",
  manager: "Manager",
  sales_bd: "Sales / BD",
  data_researcher: "Data researcher",
};

export const ROLES: Role[] = ["ceo_admin", "manager", "sales_bd", "data_researcher"];
