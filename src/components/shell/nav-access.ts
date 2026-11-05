// Which sections a role sees. Hiding is a convenience; each page and API checks again, and the database enforces.
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/scope";
import { NAV_ITEMS, type NavId } from "@/components/shell/nav-items";

const RULES: Record<NavId, (r: Role) => boolean> = {
  dashboard: () => true,
  contacts: (r) => can(r, "contacts.read"),
  accounts: (r) => can(r, "accounts.read"),
  pipeline: (r) => can(r, "pipeline.read"),
  tasks: (r) => can(r, "assignments.read"),
  imports: (r) => can(r, "imports.use"),
  exports: (r) => can(r, "exports.request") || can(r, "exports.approve"),
  integrations: (r) => can(r, "integrations.view"),
  reports: (r) => can(r, "reports.read"),
  settings: (r) => can(r, "settings.access") || can(r, "audit.read") || can(r, "users.read"),
};

export function visibleNavIds(role: Role): NavId[] {
  return NAV_ITEMS.filter((n) => RULES[n.id](role)).map((n) => n.id);
}
