// Pure rules for CSV imports: parsing, column matching, row validation and duplicate keys (SPEC §R-8).
// No server-only imports, so vitest can load it.
import { contactSchema, accountSchema } from "@/lib/records/schemas";
import { fullName, normDomain, normEmail } from "@/lib/records/text";

export type ImportKind = "contact" | "account";

// The import runs inside one request (Vercel time limit), so files stay small.
export const MAX_IMPORT_ROWS = 1_000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** Fields a column can map to, with the label shown in the mapping screen. */
export const IMPORT_FIELDS: Record<ImportKind, Record<string, string>> = {
  contact: {
    firstName: "First name", lastName: "Last name", fullName: "Full name", email: "Email", phone: "Phone",
    jobTitle: "Job title", linkedinUrl: "LinkedIn", city: "City", region: "Region", country: "Country",
    source: "Source", company: "Company (matches an account by name)", serviceInterest: "Service interest",
  },
  account: {
    name: "Company name", domain: "Domain", website: "Website", industry: "Industry", sizeBand: "Size",
    city: "City", region: "Region", country: "Country", phone: "Phone", linkedinUrl: "LinkedIn", source: "Source",
  },
};

// Header words that usually mean a given field (compared lower-case, letters only).
const SYNONYMS: Record<string, string[]> = {
  firstName: ["firstname", "first", "givenname"], lastName: ["lastname", "last", "surname", "familyname"],
  fullName: ["fullname", "name", "contactname"], email: ["email", "emailaddress", "mail"], phone: ["phone", "phonenumber", "mobile", "tel"],
  jobTitle: ["jobtitle", "title", "position", "role"], linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile"],
  city: ["city", "town"], region: ["region", "state", "province"], country: ["country"], source: ["source", "leadsource"],
  company: ["company", "companyname", "organisation", "organization", "account", "accountname"], serviceInterest: ["service", "serviceinterest", "interest"],
  name: ["companyname", "company", "accountname", "organisation", "organization", "name"], domain: ["domain", "companydomain"],
  website: ["website", "url", "site", "web"], industry: ["industry", "sector"], sizeBand: ["size", "companysize", "employees", "headcount"],
};

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** RFC 4180-style CSV: quoted fields, doubled quotes, CRLF or LF, optional BOM. Returns header + rows. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const all: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      all.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); all.push(row); }
  const nonEmpty = all.filter((r) => r.some((c) => c.trim() !== ""));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}

/** Guess which file column feeds which field. Each column is used at most once. */
export function suggestMapping(headers: string[], kind: ImportKind): Record<string, number> {
  const out: Record<string, number> = {};
  const used = new Set<number>();
  const fields = Object.keys(IMPORT_FIELDS[kind]);
  for (const field of fields) {
    const words = [letters(field), ...(SYNONYMS[field] ?? [])];
    const idx = headers.findIndex((h, i) => !used.has(i) && words.includes(letters(h)));
    if (idx >= 0) { out[field] = idx; used.add(idx); }
  }
  return out;
}

/** Mapping is stored as field -> header name (so a re-uploaded file with the same columns still lines up). */
export function mappingFromIndex(mapping: Record<string, number>, headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, i] of Object.entries(mapping)) if (headers[i] !== undefined) out[field] = headers[i];
  return out;
}

export type RowResult =
  | { ok: true; values: Record<string, unknown>; key: string | null; name: string }
  | { ok: false; message: string };

/** Turn one file row into validated record values. Uses the same rules as the forms (contactSchema / accountSchema). */
export function checkRow(kind: ImportKind, headers: string[], row: string[], mapping: Record<string, string>): RowResult {
  const get = (field: string) => {
    const h = mapping[field];
    if (!h) return "";
    const i = headers.indexOf(h);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  if (kind === "contact") {
    let first = get("firstName");
    let last = get("lastName");
    if (!first && get("fullName")) {
      const parts = get("fullName").split(/\s+/);
      first = parts[0] ?? "";
      last = parts.slice(1).join(" ");
    }
    const email = normEmail(get("email"));
    const parsed = contactSchema.safeParse({
      firstName: first, lastName: last, email: email ?? "", phone: get("phone"), jobTitle: get("jobTitle"),
      linkedinUrl: get("linkedinUrl"), city: get("city"), region: get("region"), country: get("country"),
      source: get("source"), serviceInterest: get("serviceInterest"),
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check this row." };
    const v = parsed.data;
    const name = fullName(v.firstName, v.lastName);
    return {
      ok: true,
      key: email ? `email:${email}` : null,
      name,
      values: { ...v, email, fullName: name, companyName: get("company") || null },
    };
  }

  const domain = normDomain(get("domain") || get("website"));
  const parsed = accountSchema.safeParse({
    name: get("name"), domain: domain ?? "", website: get("website"), industry: get("industry"), sizeBand: get("sizeBand"),
    city: get("city"), region: get("region"), country: get("country"), phone: get("phone"), linkedinUrl: get("linkedinUrl"), source: get("source"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check this row." };
  return {
    ok: true,
    key: domain ? `domain:${domain}` : null,
    name: parsed.data.name,
    values: { ...parsed.data, domain },
  };
}

/** Within-file duplicate check: first row with a key wins, later ones are duplicates. */
export function markFileDuplicates(keys: (string | null)[]): boolean[] {
  const seen = new Set<string>();
  return keys.map((k) => {
    if (!k) return false;
    if (seen.has(k)) return true;
    seen.add(k);
    return false;
  });
}

export const DUPLICATE_MESSAGE = "Duplicate: a matching record already exists in this workspace, or appears earlier in the file.";
