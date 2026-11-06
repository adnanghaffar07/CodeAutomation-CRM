// CSV parsing, column matching, row checks and duplicate keys for imports (SPEC §R-8).
import { describe, expect, it } from "vitest";
import { checkRow, markFileDuplicates, mappingFromIndex, parseCsv, suggestMapping } from "../src/lib/imports";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, CRLF and a BOM", () => {
    const text = "﻿First Name,Email\r\n\"Ada, A.\",ada@x.com\r\n\"She said \"\"hi\"\"\",s@x.com\r\n";
    const p = parseCsv(text);
    expect(p.headers).toEqual(["First Name", "Email"]);
    expect(p.rows).toEqual([["Ada, A.", "ada@x.com"], ['She said "hi"', "s@x.com"]]);
  });

  it("skips blank lines and keeps a last row without a newline", () => {
    const p = parseCsv("a,b\n\n1,2\n3,4");
    expect(p.rows).toEqual([["1", "2"], ["3", "4"]]);
  });
});

describe("suggestMapping", () => {
  it("matches common header names and uses each column once", () => {
    const m = suggestMapping(["Company", "First", "Last", "E-mail", "Job Title"], "contact");
    expect(m.firstName).toBe(1);
    expect(m.lastName).toBe(2);
    expect(m.email).toBe(3);
    expect(m.jobTitle).toBe(4);
    expect(m.company).toBe(0);
    expect(new Set(Object.values(m)).size).toBe(Object.values(m).length);
  });

  it("turns indexes into header names for storage", () => {
    expect(mappingFromIndex({ email: 1 }, ["x", "Work email"])).toEqual({ email: "Work email" });
  });
});

describe("checkRow", () => {
  const headers = ["Name", "Email", "Company", "Website"];
  const map = { fullName: "Name", email: "Email", company: "Company" };

  it("accepts a good contact and splits the full name", () => {
    const r = checkRow("contact", headers, ["Ada Lovelace", "Ada@Example.com", "Acme", ""], map);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.key).toBe("email:ada@example.com");
      expect(r.values.firstName).toBe("Ada");
      expect(r.values.lastName).toBe("Lovelace");
      expect(r.values.companyName).toBe("Acme");
    }
  });

  it("rejects a bad email with a plain message", () => {
    const r = checkRow("contact", headers, ["Ada", "not-an-email", "", ""], map);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/email/i);
  });

  it("uses the domain as the account key", () => {
    const r = checkRow("account", ["Company", "Site"], ["Acme Ltd", "https://www.acme.com/about"], { name: "Company", website: "Site" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key).toBe("domain:acme.com");
  });

  it("rejects a company row with no name", () => {
    const r = checkRow("account", ["Company"], [""], { name: "Company" });
    expect(r.ok).toBe(false);
  });
});

describe("markFileDuplicates", () => {
  it("flags repeats after the first, ignores rows without a key", () => {
    expect(markFileDuplicates(["a", null, "a", "b", "b"])).toEqual([false, false, true, false, true]);
  });
});
