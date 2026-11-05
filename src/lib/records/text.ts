// Text helpers for records: normalisation and the lower-case search blob that the trigram index covers.

const clean = (s?: string | null) => (s ?? "").trim();

export function normEmail(email?: string | null): string | null {
  const e = clean(email).toLowerCase();
  return e ? e : null;
}

export function normDomain(input?: string | null): string | null {
  const v = clean(input).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return v ? v : null;
}

export function fullName(first: string, last?: string | null): string {
  return [clean(first), clean(last)].filter(Boolean).join(" ");
}

/** One lower-case string holding everything a person might type to find a record. */
export function searchBlob(parts: (string | null | undefined)[]): string {
  return parts.map(clean).filter(Boolean).join(" ").toLowerCase();
}

/** Words typed into the search box, at least 2 characters each (shorter terms match nearly everything). */
export function searchTokens(q?: string): string[] {
  return clean(q).toLowerCase().split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);
}

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function cleanTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((t) => clean(t).toLowerCase()).filter(Boolean))].slice(0, 30);
}
