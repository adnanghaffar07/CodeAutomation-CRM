// Text normalisation, search tokens, filter parsing and change tracking for contacts and accounts.
import { describe, expect, it } from "vitest";
import { cleanTags, escapeLike, fullName, normDomain, normEmail, searchBlob, searchTokens } from "../src/lib/records/text";
import { parseFilters } from "../src/lib/records/list";
import { accountSchema, contactSchema, diffFields } from "../src/lib/records/schemas";

describe("text helpers", () => {
  it("normalises emails and domains", () => {
    expect(normEmail("  Ada.Lovelace@Example.COM ")).toBe("ada.lovelace@example.com");
    expect(normEmail("   ")).toBeNull();
    expect(normDomain("https://www.Example.com/about")).toBe("example.com");
    expect(normDomain("")).toBeNull();
  });

  it("builds names and a lower-case search blob", () => {
    expect(fullName(" Ada ", "Lovelace")).toBe("Ada Lovelace");
    expect(fullName("Prince", "")).toBe("Prince");
    expect(searchBlob(["Ada Lovelace", null, "CTO", undefined, "Acme"])).toBe("ada lovelace cto acme");
  });

  it("splits search input into useful tokens only", () => {
    expect(searchTokens("  Grace   Hopper ")).toEqual(["grace", "hopper"]);
    expect(searchTokens("a b cd")).toEqual(["cd"]); // one-letter terms match nearly everything
    expect(searchTokens(undefined)).toEqual([]);
    expect(searchTokens("a1 b2 c3 d4 e5 f6 g7 h8")).toHaveLength(6); // capped
  });

  it("escapes LIKE wildcards so users cannot widen a search", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
  });

  it("cleans, lower-cases and de-duplicates tags", () => {
    expect(cleanTags([" Hot ", "hot", "", "Webinar"])).toEqual(["hot", "webinar"]);
  });
});

describe("list filters from the URL", () => {
  it("accepts valid values", () => {
    const f = parseFilters({ q: "ada", status: "qualified", emailStatus: "bounced", owner: "me", due: "overdue", sort: "name" });
    expect(f).toMatchObject({ q: "ada", status: "qualified", emailStatus: "bounced", owner: "me", due: "overdue", sort: "name" });
  });

  it("ignores unknown or malicious values and defaults the sort", () => {
    const f = parseFilters({ status: "'; drop table", emailStatus: "nope", due: "someday", sort: "random", q: ["first", "second"] });
    expect(f.status).toBeUndefined();
    expect(f.emailStatus).toBeUndefined();
    expect(f.due).toBeUndefined();
    expect(f.sort).toBe("newest");
    expect(f.q).toBe("first");
  });

  it("trims and caps free text", () => {
    expect(parseFilters({ q: "x".repeat(500) }).q).toHaveLength(120);
    expect(parseFilters({ q: "   " }).q).toBeUndefined();
  });
});

describe("change tracking", () => {
  const labels = { jobTitle: "Job title", tags: "Tags", followUpAt: "Follow-up date" };

  it("reports only what changed", () => {
    const changes = diffFields({ jobTitle: "CTO", tags: ["a"], followUpAt: null }, { jobTitle: "CEO", tags: ["a"], followUpAt: null }, labels);
    expect(changes).toEqual([{ field: "Job title", from: "CTO", to: "CEO" }]);
  });

  it("treats empty and null as the same, and compares dates by day", () => {
    expect(diffFields({ jobTitle: null }, { jobTitle: null }, labels)).toEqual([]);
    const d = diffFields({ followUpAt: new Date("2026-11-05T09:00:00Z") }, { followUpAt: new Date("2026-11-05T17:00:00Z") }, labels);
    expect(d).toEqual([]);
  });

  it("notices tag changes", () => {
    expect(diffFields({ tags: ["a"] }, { tags: ["a", "b"] }, labels)).toHaveLength(1);
  });
});

describe("input validation", () => {
  it("requires a first name and a valid email, and blanks become null", () => {
    expect(contactSchema.safeParse({ firstName: "" }).success).toBe(false);
    expect(contactSchema.safeParse({ firstName: "Ada", email: "not-an-email" }).success).toBe(false);
    const ok = contactSchema.parse({ firstName: " Ada ", email: "", phone: "  " });
    expect(ok.firstName).toBe("Ada");
    expect(ok.email).toBeNull();
    expect(ok.phone).toBeNull();
    expect(ok.qualification).toBe("new");
  });

  it("rejects an unknown status", () => {
    expect(contactSchema.safeParse({ firstName: "A", qualification: "super-hot" }).success).toBe(false);
  });

  it("requires a company name for accounts", () => {
    expect(accountSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(accountSchema.parse({ name: "Acme" }).tags).toEqual([]);
  });
});
