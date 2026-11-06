// Who may see which dashboard and whose numbers. Pure, so it is unit tested (tests/dashboard.test.ts).
// This mirrors the permission matrix and the record rules in SPEC §R-1:
//   CEO / Admin  → the whole organisation (Executive, Sales, Admin views)
//   Manager      → their own team (and its pipeline when it is a sales team)
//   Sales / BD   → only their own work and deals; team figures appear only as one anonymous average
//   Researcher   → only their own work
// The view is decided on the server from the signed-in role. A "?view=" the role may not open falls back to its default.
import type { Role } from "@/lib/scope";
import type { Dataset, Person } from "@/lib/demo/dataset";

export const VIEWS = ["executive", "sales", "admin", "team", "personal"] as const;
export type DashboardView = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<DashboardView, string> = {
  executive: "Executive", sales: "Sales", admin: "Administration", team: "My team", personal: "My work",
};

/** Views a role may open, default first. */
export function allowedViews(role: Role, person?: Person): DashboardView[] {
  switch (role) {
    case "ceo_admin": return ["executive", "sales", "admin"];
    case "manager": return person?.department === "Sales" ? ["team", "sales"] : ["team"];
    case "sales_bd": return ["sales", "personal"];
    default: return ["personal"];
  }
}

export function resolveView(role: Role, person: Person | undefined, requested: string | undefined): DashboardView {
  const allowed = allowedViews(role, person);
  return allowed.find((v) => v === requested) ?? allowed[0];
}

/**
 * The demo organisation has its own fictional people, so a signed-in person is shown as a demo person of the SAME role
 * (picked stably from their user id). Real identities are never mixed into the demo numbers.
 */
export function resolveViewer(ds: Dataset, user: { userId: string; role: Role }): Person {
  const pool = ds.people.filter((p) => p.role === user.role && p.status === "active");
  const list = pool.length ? pool : ds.people.filter((p) => p.role === user.role);
  let h = 0;
  for (const ch of user.userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length] ?? ds.people[0];
}

export type Visibility = {
  scope: "org" | "team" | "self";
  /** People whose work the viewer may see (always includes the viewer, except for pure organisation scope where everyone is included). */
  ids: Set<string>;
  teamId: string | null;
};

export function visibilityFor(ds: Dataset, viewer: Person): Visibility {
  if (viewer.role === "ceo_admin") return { scope: "org", ids: new Set(ds.people.map((p) => p.id)), teamId: null };
  if (viewer.role === "manager") {
    const ids = new Set(ds.people.filter((p) => p.managerId === viewer.id || p.id === viewer.id).map((p) => p.id));
    return { scope: "team", ids, teamId: viewer.teamId };
  }
  return { scope: "self", ids: new Set([viewer.id]), teamId: viewer.teamId };
}

/** Throws unless every id asked for is inside the viewer's visibility. Guard for any future drill-down endpoint. */
export function assertVisible(vis: Visibility, ids: Iterable<string>): void {
  for (const id of ids) if (!vis.ids.has(id)) throw new Error("Not allowed: outside your dashboard scope");
}
