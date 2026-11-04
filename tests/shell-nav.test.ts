// Every nav section must have a real page that sets its own <title>, and shortcut keys must not collide.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NAV_ITEMS, isNavActive } from "../src/components/shell/nav-items";

const appDir = path.join(__dirname, "../src/app/(app)");

describe("navigation", () => {
  it("has a page for every section, each with metadata.title", () => {
    for (const item of NAV_ITEMS) {
      const file = path.join(appDir, item.href === "/" ? "" : item.href, "page.tsx");
      expect(fs.existsSync(file), `${item.id} page`).toBe(true);
      expect(fs.readFileSync(file, "utf8"), `${item.id} title`).toMatch(/metadata[^=]*=\s*\{\s*title:/);
    }
  });

  it("uses unique ids, hrefs and G-chord keys", () => {
    const unique = (xs: (string | undefined)[]) => new Set(xs.filter(Boolean)).size === xs.filter(Boolean).length;
    expect(unique(NAV_ITEMS.map((n) => n.id))).toBe(true);
    expect(unique(NAV_ITEMS.map((n) => n.href))).toBe(true);
    expect(unique(NAV_ITEMS.map((n) => n.go))).toBe(true);
  });

  it("marks the right item active", () => {
    const dash = NAV_ITEMS.find((n) => n.id === "dashboard")!;
    const contacts = NAV_ITEMS.find((n) => n.id === "contacts")!;
    expect(isNavActive("/", dash)).toBe(true);
    expect(isNavActive("/contacts", dash)).toBe(false);
    expect(isNavActive("/contacts/123", contacts)).toBe(true);
    expect(isNavActive("/contactsX", contacts)).toBe(false);
  });
});
