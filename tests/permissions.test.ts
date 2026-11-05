// The permission matrix is the contract in SPEC §R-1. These tests pin the rules that matter most.
import { describe, expect, it } from "vitest";
import { MATRIX, ROLES, can, requireCapability, ForbiddenError, type Capability } from "../src/lib/permissions";
import { visibleNavIds } from "../src/components/shell/nav-access";

describe("permission matrix", () => {
  it("lets only the CEO/Admin manage users, credentials and export approval", () => {
    for (const cap of ["users.manage", "integrations.manage", "exports.approve", "settings.access"] as Capability[]) {
      expect(MATRIX[cap]).toEqual(["ceo_admin"]);
    }
  });

  it("lets every non-CEO role request exports (SPEC R-1)", () => {
    for (const role of ["manager", "sales_bd", "data_researcher"] as const) expect(can(role, "exports.request")).toBe(true);
    expect(can("ceo_admin", "exports.request")).toBe(false); // the CEO exports directly
  });

  it("keeps the audit log to CEO/Admin and manager", () => {
    expect(ROLES.filter((r) => can(r, "audit.read"))).toEqual(["ceo_admin", "manager"]);
  });

  it("only lets CEO/Admin and manager assign work", () => {
    expect(ROLES.filter((r) => can(r, "assignments.manage"))).toEqual(["ceo_admin", "manager"]);
  });

  it("denies unknown or missing roles", () => {
    expect(can(null, "contacts.read")).toBe(false);
    expect(can(undefined, "users.manage")).toBe(false);
  });

  it("throws a 403-shaped error when a capability is missing", () => {
    expect(() => requireCapability("sales_bd", "users.manage")).toThrow(ForbiddenError);
    expect(() => requireCapability("ceo_admin", "users.manage")).not.toThrow();
  });
});

describe("role-based navigation", () => {
  it("shows the CEO/Admin everything", () => {
    expect(visibleNavIds("ceo_admin")).toHaveLength(10);
  });

  it("hides admin-only sections from sales and researchers", () => {
    for (const role of ["sales_bd", "data_researcher"] as const) {
      const ids = visibleNavIds(role);
      expect(ids).not.toContain("integrations");
      expect(ids).not.toContain("settings");
      expect(ids).not.toContain("reports");
      expect(ids).toContain("contacts");
    }
  });

  it("gives researchers imports but not the pipeline, and sales the reverse", () => {
    expect(visibleNavIds("data_researcher")).toContain("imports");
    expect(visibleNavIds("data_researcher")).not.toContain("pipeline");
    expect(visibleNavIds("sales_bd")).not.toContain("imports");
    expect(visibleNavIds("sales_bd")).toContain("pipeline");
  });
});
